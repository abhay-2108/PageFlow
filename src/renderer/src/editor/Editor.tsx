import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { TipTapDocument } from "../../../shared/types";
import { getApi } from "../lib/api";
import { colorFor, session, type DocBinding } from "../lib/session";
import { BlockGutter } from "./blocks/BlockGutter";
import { buildExtensions } from "./editorExtensions";
import { SelectionBubble } from "./format/SelectionBubble";
import { MentionMenu } from "./mention/MentionMenu";
import { SlashMenu } from "./slash/SlashMenu";
import { TableBar } from "./table/TableBar";

const UPDATE_FLUSH_MS = 300;

export interface EditorProps {
  pageId: string;
  onDocChange: (doc: TipTapDocument) => void;
  autoFocus?: boolean;
  onOpenPage?: (id: string) => void;
  onCommentRequest?: (quote: string) => void;
  onCommentClick?: (threadId: string) => void;
}

export function Editor({
  pageId,
  onDocChange,
  autoFocus = false,
  onOpenPage,
  onCommentRequest,
  onCommentClick,
}: EditorProps) {
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
          pageId={pageId}
          ydoc={binding.doc}
          provider={binding.provider}
          onDocChange={onDocChange}
          autoFocus={autoFocus}
          onOpenPage={onOpenPage}
          onCommentRequest={onCommentRequest}
          onCommentClick={onCommentClick}
        />
      ) : null}
      <SlashMenu />
      <MentionMenu />
      <TableBar />
      <BlockGutter />
      <SelectionBubble onCommentRequest={onCommentRequest} />
    </div>
  );
}

interface BoundEditorProps {
  pageId: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider | null;
  onDocChange: (doc: TipTapDocument) => void;
  autoFocus: boolean;
  onOpenPage?: (id: string) => void;
  onCommentRequest?: (quote: string) => void;
  onCommentClick?: (threadId: string) => void;
}

function BoundEditor({
  pageId,
  ydoc,
  provider,
  onDocChange,
  autoFocus,
  onOpenPage,
  onCommentClick,
}: BoundEditorProps) {
  const extensions = buildExtensions(
    {
      document: ydoc,
      provider,
      user: { name: session.getUserName(), color: colorFor(session.getUserName()) },
    },
    { currentPageId: pageId },
  );

  const editor = useEditor({
    extensions,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "pg-editor",
        spellcheck: "true",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const mentionEl = target?.closest("[data-page-mention]");
        if (mentionEl && onOpenPage) {
          const id = mentionEl.getAttribute("data-page-mention");
          if (id) {
            onOpenPage(id);
            return true;
          }
        }
        const commentEl = target?.closest("[data-comment-thread]");
        if (commentEl && onCommentClick) {
          const threadId = commentEl.getAttribute("data-comment-thread");
          if (threadId) {
            onCommentClick(threadId);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      onDocChange(instance.getJSON() as TipTapDocument);
    },
  });

  return <EditorContent editor={editor} />;
}
