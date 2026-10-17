import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { TipTapDocument } from "../../../shared/types";
import { getApi } from "../lib/api";
import { colorFor, session, type DocBinding } from "../lib/session";
import { buildExtensions } from "./editorExtensions";
import { SlashMenu } from "./slash/SlashMenu";

const UPDATE_FLUSH_MS = 300;

export interface EditorProps {
  pageId: string;
  onDocChange: (doc: TipTapDocument) => void;
  autoFocus?: boolean;
}

export function Editor({ pageId, onDocChange, autoFocus = false }: EditorProps) {
  const [binding, setBinding] = useState<DocBinding | null>(null);
  const bindingRef = useRef<DocBinding | null>(null);
  const sessionState = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const status = sessionState.status;

  useEffect(() => {
    let cancelled = false;
    setBinding(null);
    void (async () => {
      const previous = bindingRef.current;
      const carryFrom =
        previous && !previous.shared && session.isActive() ? previous.doc : null;
      const next = await session.acquireDoc(pageId, carryFrom);
      if (cancelled) {
        return;
      }
      bindingRef.current = next;
      setBinding(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, status]);

  useEffect(() => {
    if (!binding || binding.shared) {
      return;
    }
    const api = getApi();
    const doc = binding.doc;
    const pending: Uint8Array[] = [];
    let timer: number | null = null;
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
    const onUpdate = (update: Uint8Array, origin: unknown) => {
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
    };
    doc.on("update", onUpdate);
    return () => {
      doc.off("update", onUpdate);
      flush();
    };
  }, [binding, pageId]);

  return (
    <div className="editor-shell">
      {binding ? (
        <BoundEditor
          key={binding.doc.guid}
          ydoc={binding.doc}
          provider={binding.provider}
          onDocChange={onDocChange}
          autoFocus={autoFocus}
        />
      ) : null}
      <SlashMenu />
    </div>
  );
}

interface BoundEditorProps {
  ydoc: Y.Doc;
  provider: WebrtcProvider | null;
  onDocChange: (doc: TipTapDocument) => void;
  autoFocus: boolean;
}

function BoundEditor({ ydoc, provider, onDocChange, autoFocus }: BoundEditorProps) {
  const extensions = buildExtensions({
    document: ydoc,
    provider,
    user: { name: session.getUserName(), color: colorFor(session.getUserName()) },
  });

  const editor = useEditor({
    extensions,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "pg-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onDocChange(instance.getJSON() as TipTapDocument);
    },
  });

  return <EditorContent editor={editor} />;
}
