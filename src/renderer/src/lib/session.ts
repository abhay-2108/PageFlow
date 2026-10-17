import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import { decodeJoinCode, type JoinCodePayload } from "../../../shared/join-code";
import { extractDocText } from "../../../shared/doc-text";
import { metaDiff } from "../../../shared/meta";
import type { PageMeta } from "../../../shared/types";
import { EDITOR_FIELD, editorSchema } from "../editor/editorExtensions";
import { getApi } from "./api";

export type SessionStatus = "solo" | "hosting" | "joined";

export interface PeerPresence {
  name: string;
  color: string;
}

export interface SessionState {
  status: SessionStatus;
  code: string | null;
  peers: PeerPresence[];
}

export interface DocBinding {
  doc: Y.Doc;
  provider: WebrtcProvider | null;
  shared: boolean;
}

const PEER_COLORS = [
  "#e07a5f",
  "#3d9970",
  "#5c7cfa",
  "#d97706",
  "#a855f7",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

const META_DOC_ID = "__meta__";
const UPDATE_FLUSH_MS = 300;

export function colorFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length] as string;
}

interface SharedDoc {
  doc: Y.Doc;
  provider: WebrtcProvider;
  flush: () => void;
}

class SessionManager {
  private state: SessionState = { status: "solo", code: null, peers: [] };
  private readonly listeners = new Set<() => void>();
  private metaDoc: Y.Doc | null = null;
  private metaMap: Y.Map<PageMeta> | null = null;
  private metaProvider: WebrtcProvider | null = null;
  private payload: JoinCodePayload | null = null;
  private signalingUrl: string | null = null;
  private readonly sharedDocs = new Map<string, SharedDoc>();
  private readonly sharedPromises = new Map<string, Promise<SharedDoc | null>>();
  private onRemoteMeta: (() => void) | null = null;
  private userName = "Someone";
  private initialized = false;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getState = (): SessionState => this.state;

  getUserName(): string {
    return this.userName;
  }

  isActive(): boolean {
    return this.state.status !== "solo";
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async init(options: { userName: string; onRemoteMeta: () => void }): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.userName = options.userName.trim().length > 0 ? options.userName.trim() : "Someone";
    this.onRemoteMeta = options.onRemoteMeta;

    const api = getApi();
    const doc = new Y.Doc();
    const map = doc.getMap<PageMeta>("pages");
    const stored = await api.sync.loadDocUpdates(META_DOC_ID).catch(() => [] as number[][]);
    for (const update of stored) {
      try {
        Y.applyUpdate(doc, Uint8Array.from(update), "init");
      } catch {
        // Skip corrupt updates; later updates in the log may still apply.
      }
    }

    let timer: number | null = null;
    const pending: Uint8Array[] = [];
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "init") {
        return;
      }
      pending.push(update);
      if (timer === null) {
        timer = window.setTimeout(() => {
          timer = null;
          const batch = pending.splice(0);
          void api.sync
            .appendDocUpdates(META_DOC_ID, batch.map((bytes) => Array.from(bytes)))
            .catch(() => undefined);
        }, UPDATE_FLUSH_MS);
      }
    });

    map.observe((event, transaction) => {
      if (transaction.origin === "local") {
        return;
      }
      const entries: PageMeta[] = [];
      for (const key of event.keys.keys()) {
        const value = map.get(key);
        if (value) {
          entries.push(value);
        }
      }
      if (entries.length === 0) {
        return;
      }
      void api.sync
        .applyMeta(entries)
        .then(() => {
          this.onRemoteMeta?.();
        })
        .catch(() => undefined);
    });

    this.metaDoc = doc;
    this.metaMap = map;
  }

  reconcileMeta(pages: PageMeta[], trash: PageMeta[]): void {
    const map = this.metaMap;
    const doc = this.metaDoc;
    if (!map || !doc) {
      return;
    }
    const current = new Map<string, PageMeta>();
    map.forEach((value, key) => {
      current.set(key, value);
    });
    const changed = metaDiff(current, [...pages, ...trash]);
    if (changed.length === 0) {
      return;
    }
    doc.transact(() => {
      for (const entry of changed) {
        map.set(entry.id, entry);
      }
    }, "local");
  }

  syncPages(pages: PageMeta[]): void {
    if (!this.isActive()) {
      return;
    }
    for (const page of pages) {
      void this.ensureSharedDoc(page.id);
    }
  }

  async start(): Promise<void> {
    const api = getApi();
    const { code } = await api.session.start();
    const payload = decodeJoinCode(code);
    if (!payload) {
      throw new Error("The host generated an invalid session code");
    }
    await this.activate(payload, "hosting", code);
  }

  async join(rawCode: string): Promise<void> {
    const payload = decodeJoinCode(rawCode);
    if (!payload) {
      throw new Error("That code does not look like a Pagegrove session code");
    }
    await this.activate(payload, "joined", rawCode.trim());
  }

  async stop(): Promise<void> {
    const api = getApi();
    await this.persistSharedDocs();
    this.teardown();
    await api.session.stop().catch(() => undefined);
  }

  async acquireDoc(pageId: string, carryFrom?: Y.Doc | null): Promise<DocBinding> {
    if (this.isActive()) {
      const shared = await this.ensureSharedDoc(pageId);
      if (shared) {
        if (carryFrom) {
          Y.applyUpdate(shared.doc, Y.encodeStateAsUpdate(carryFrom), "init");
        }
        return { doc: shared.doc, provider: shared.provider, shared: true };
      }
    }
    const doc = new Y.Doc();
    await this.loadAndSeed(doc, pageId);
    if (carryFrom) {
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(carryFrom), "init");
    }
    return { doc, provider: null, shared: false };
  }

  private async loadAndSeed(doc: Y.Doc, pageId: string): Promise<void> {
    const api = getApi();
    const stored = await api.sync.loadDocUpdates(pageId).catch(() => [] as number[][]);
    for (const update of stored) {
      try {
        Y.applyUpdate(doc, Uint8Array.from(update), "init");
      } catch {
        // Skip corrupt updates; later updates in the log may still apply.
      }
    }
    const fragment = doc.getXmlFragment(EDITOR_FIELD);
    if (fragment.length > 0) {
      return;
    }
    const record = await api.pages.get(pageId).catch(() => null);
    if (record && extractDocText(record.doc).length > 0) {
      try {
        const seeded = prosemirrorJSONToYDoc(editorSchema, record.doc, EDITOR_FIELD);
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(seeded), "init");
        seeded.destroy();
      } catch {
        // Unrepresentable legacy content stays available via the JSON snapshot.
      }
    }
  }

  private ensureSharedDoc(pageId: string): Promise<SharedDoc | null> {
    if (!this.payload || !this.signalingUrl) {
      return Promise.resolve(null);
    }
    const existing = this.sharedDocs.get(pageId);
    if (existing) {
      return Promise.resolve(existing);
    }
    const inflight = this.sharedPromises.get(pageId);
    if (inflight) {
      return inflight;
    }
    const promise = (async (): Promise<SharedDoc | null> => {
      const signalingUrl = this.signalingUrl;
      const payload = this.payload;
      if (!payload || !signalingUrl) {
        return null;
      }
      const api = getApi();
      const doc = new Y.Doc();
      await this.loadAndSeed(doc, pageId);

      let timer: number | null = null;
      const pending: Uint8Array[] = [];
      const flush = () => {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
        if (pending.length === 0) {
          return;
        }
        const batch = pending.splice(0);
        void api.sync
          .appendDocUpdates(pageId, batch.map((bytes) => Array.from(bytes)))
          .catch(() => undefined);
      };
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin === "init") {
          return;
        }
        pending.push(update);
        if (timer === null) {
          timer = window.setTimeout(() => {
            timer = null;
            flush();
          }, UPDATE_FLUSH_MS);
        }
      });

      if (this.signalingUrl !== signalingUrl || this.payload !== payload) {
        return null;
      }
      const provider = new WebrtcProvider(this.roomName(`p-${pageId}`), doc, {
        signaling: [signalingUrl],
        password: payload.password,
        maxConns: 24,
        filterBcConns: false,
      });
      provider.awareness.setLocalStateField("user", {
        name: this.userName,
        color: colorFor(this.userName),
      });

      if (this.signalingUrl !== signalingUrl || this.payload !== payload) {
        try {
          provider.destroy();
        } catch {
          // Already destroyed.
        }
        return null;
      }

      const shared: SharedDoc = { doc, provider, flush };
      this.sharedDocs.set(pageId, shared);
      return shared;
    })();
    this.sharedPromises.set(pageId, promise);
    void promise.finally(() => {
      this.sharedPromises.delete(pageId);
    });
    return promise;
  }

  private async persistSharedDocs(): Promise<void> {
    const api = getApi();
    for (const [pageId, shared] of [...this.sharedDocs.entries()]) {
      shared.flush();
      try {
        const snapshot = Y.encodeStateAsUpdate(shared.doc);
        if (snapshot.length > 2) {
          await api.sync.appendDocUpdates(pageId, [Array.from(snapshot)]).catch(() => undefined);
        }
      } catch {
        // Doc already destroyed.
      }
    }
  }

  private async activate(payload: JoinCodePayload, status: SessionStatus, code: string): Promise<void> {
    await this.persistSharedDocs();
    this.teardown();
    this.payload = payload;
    this.signalingUrl = `ws://${payload.host}:${payload.port}`;
    if (this.metaDoc) {
      const provider = new WebrtcProvider(this.roomName("meta"), this.metaDoc, {
        signaling: [this.signalingUrl],
        password: payload.password,
        maxConns: 24,
        filterBcConns: false,
      });
      provider.awareness.setLocalStateField("user", {
        name: this.userName,
        color: colorFor(this.userName),
      });
      provider.awareness.on("change", this.awarenessListener);
      this.metaProvider = provider;
    }
    this.state = { status, code, peers: [] };
    this.refreshPeers();
  }

  private readonly awarenessListener = (): void => {
    this.refreshPeers();
  };

  private refreshPeers(): void {
    const provider = this.metaProvider;
    if (!provider) {
      this.state = { ...this.state, peers: [] };
      this.emit();
      return;
    }
    const peers: PeerPresence[] = [];
    provider.awareness.getStates().forEach((value, clientId) => {
      if (clientId === provider.awareness.clientID) {
        return;
      }
      const user = (value as { user?: { name?: unknown; color?: unknown } }).user;
      if (user && typeof user.name === "string") {
        peers.push({
          name: user.name,
          color: typeof user.color === "string" ? user.color : "#888888",
        });
      }
    });
    this.state = { ...this.state, peers };
    this.emit();
  }

  private roomName(suffix: string): string {
    return `${this.payload?.room ?? "none"}::${suffix}`;
  }

  private teardown(): void {
    for (const [pageId, shared] of [...this.sharedDocs.entries()]) {
      this.sharedDocs.delete(pageId);
      try {
        shared.provider.destroy();
      } catch {
        // Already destroyed.
      }
      try {
        shared.doc.destroy();
      } catch {
        // Already destroyed.
      }
    }
    this.sharedPromises.clear();
    if (this.metaProvider) {
      try {
        this.metaProvider.destroy();
      } catch {
        // Already destroyed.
      }
      this.metaProvider = null;
    }
    this.payload = null;
    this.signalingUrl = null;
    this.state = { status: "solo", code: null, peers: [] };
    this.emit();
  }
}

export const session = new SessionManager();
