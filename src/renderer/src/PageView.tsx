import { useCallback, useEffect, useState } from "react";
import type {
  BacklinkHit,
  CommentThread,
  PageRecord,
  PageViewMode,
  TipTapDocument,
} from "../../shared/types";
import type { CoverId } from "../../shared/covers";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";
import { commentTools } from "./editor/comments/controller";
import { ChildrenTable } from "./components/ChildrenTable";
import { CoverPicker } from "./components/CoverPicker";
import { EmojiPicker } from "./components/EmojiPicker";
import { getApi } from "./lib/api";
import { session } from "./lib/session";

export interface PageViewProps {
  record: PageRecord;
  editorEpoch: number;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: CoverId | null) => void;
  onViewChange: (view: PageViewMode) => void;
  onOpenPage: (id: string) => void;
}

export function PageView({
  record,
  editorEpoch,
  onDocChange,
  onTitleChange,
  autoFocusEditor,
  onIconChange,
  onCoverChange,
  onViewChange,
  onOpenPage,
}: PageViewProps) {
  const api = getApi();
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkHit[]>([]);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftQuote, setDraftQuote] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const displayTitle = record.meta.title.length > 0 ? record.meta.title : BRAND.empty.untitled;
  const icon = record.meta.icon;
  const cover = (record.meta.cover ?? null) as CoverId | null;
  const view: PageViewMode = record.meta.view === "table" ? "table" : "doc";

  useEffect(() => {
    let cancelled = false;
    void api.pages
      .backlinks(record.meta.id)
      .then((hits) => {
        if (!cancelled) {
          setBacklinks(hits);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, record.meta.id, editorEpoch]);

  const refreshThreads = useCallback(async () => {
    try {
      const list = await api.comments.list(record.meta.id);
      setThreads(list);
      commentTools.sanitize(list.map((thread) => thread.id));
    } catch {
      // Keep the previous list on failure.
    }
  }, [api, record.meta.id]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads, editorEpoch]);

  useEffect(() => {
    setCommentsOpen(false);
    setDraftQuote(null);
    setDraftBody("");
    setReplyDrafts({});
    setActiveThreadId(null);
    setShowResolved(false);
  }, [record.meta.id]);

  const handleCommentRequest = useCallback((quote: string) => {
    setCommentsOpen(true);
    setActiveThreadId(null);
    setDraftQuote(quote);
    setDraftBody("");
  }, []);

  const handleCommentClick = useCallback((threadId: string) => {
    setCommentsOpen(true);
    setActiveThreadId(threadId);
  }, []);

  const submitDraft = async () => {
    if (draftQuote === null || draftBody.trim().length === 0) {
      return;
    }
    const created = await api.comments.create({
      pageId: record.meta.id,
      quote: draftQuote,
      body: draftBody.trim(),
      author: session.getUserName(),
    });
    if (created) {
      commentTools.applyThread(created.id);
      setActiveThreadId(created.id);
    }
    setDraftQuote(null);
    setDraftBody("");
    await refreshThreads();
  };

  const submitReply = async (threadId: string) => {
    const body = (replyDrafts[threadId] ?? "").trim();
    if (body.length === 0) {
      return;
    }
    const updated = await api.comments.reply({ threadId, body, author: session.getUserName() });
    if (updated) {
      setReplyDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
    }
    await refreshThreads();
  };

  const toggleResolved = async (thread: CommentThread) => {
    await api.comments.resolve({ threadId: thread.id, resolved: !thread.resolved });
    await refreshThreads();
  };

  const deleteThread = async (threadId: string) => {
    const removed = await api.comments.remove(threadId);
    if (removed) {
      commentTools.sanitize(
        threads.filter((thread) => thread.id !== threadId).map((thread) => thread.id),
      );
    }
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    await refreshThreads();
  };

  const openThreads = threads.filter((thread) => !thread.resolved);
  const resolvedThreads = threads.filter((thread) => thread.resolved);

  const renderThread = (thread: CommentThread) => (
    <li
      key={thread.id}
      className={thread.resolved ? "comment-thread comment-thread--resolved" : "comment-thread"}
      data-thread-id={thread.id}
      data-active={thread.id === activeThreadId ? "true" : "false"}
    >
      <blockquote className="comment-thread__quote">{thread.quote}</blockquote>
      <ul className="comment-thread__messages">
        {thread.messages.map((message) => (
          <li key={message.id} className="comment-thread__message">
            <span className="comment-thread__author">{message.author}</span>
            <p className="comment-thread__body">{message.body}</p>
          </li>
        ))}
      </ul>
      {thread.resolved ? null : (
        <div className="comment-thread__reply">
          <textarea
            className="comment-thread__reply-input"
            aria-label="Reply text"
            placeholder="Reply"
            rows={1}
            value={replyDrafts[thread.id] ?? ""}
            onChange={(event) =>
              setReplyDrafts((drafts) => ({ ...drafts, [thread.id]: event.target.value }))
            }
          />
          <button
            type="button"
            className="ghost-btn ghost-btn--small"
            onClick={() => void submitReply(thread.id)}
            disabled={(replyDrafts[thread.id] ?? "").trim().length === 0}
          >
            Reply
          </button>
        </div>
      )}
      <div className="comment-thread__actions">
        <button type="button" className="ghost-btn ghost-btn--small" onClick={() => void toggleResolved(thread)}>
          {thread.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          className="ghost-btn ghost-btn--small"
          onClick={() => void deleteThread(thread.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );

  return (
    <main className={cover ? "page page--has-cover" : "page"}>
      {cover ? (
        <div className={`page__cover cover--${cover}`} data-page-cover={cover}>
          <div className="page__cover-actions">
            <button
              type="button"
              className="cover-action"
              onClick={() => setPicker(picker === "cover" ? null : "cover")}
            >
              Change cover
            </button>
            <button
              type="button"
              className="cover-action"
              onClick={() => {
                setPicker(null);
                onCoverChange(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
      <div className="page__meta">
        {icon ? (
          <button
            type="button"
            className="page__icon"
            aria-label="Change page icon"
            data-page-icon={icon}
            onClick={() => setPicker(picker === "icon" ? null : "icon")}
          >
            {icon}
          </button>
        ) : null}
        <div className="page__meta-actions">
          <button
            type="button"
            className="page__meta-btn"
            onClick={() => setPicker(picker === "icon" ? null : "icon")}
          >
            {icon ? "Change icon" : "Add icon"}
          </button>
          <button
            type="button"
            className="page__meta-btn"
            onClick={() => setPicker(picker === "cover" ? null : "cover")}
          >
            {cover ? "Change cover" : "Add cover"}
          </button>
          <div className="page__view-toggle" role="group" aria-label="Page view">
            <button
              type="button"
              className={view === "doc" ? "page__view-btn page__view-btn--active" : "page__view-btn"}
              aria-pressed={view === "doc"}
              onClick={() => onViewChange("doc")}
            >
              Document
            </button>
            <button
              type="button"
              className={view === "table" ? "page__view-btn page__view-btn--active" : "page__view-btn"}
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
            >
              Table
            </button>
          </div>
          {view === "doc" ? (
            <button
              type="button"
              className="page__meta-btn"
              aria-label="Comments"
              onClick={() => setCommentsOpen((open) => !open)}
            >
              {openThreads.length > 0 ? `Comments (${openThreads.length})` : "Comments"}
            </button>
          ) : null}
        </div>
        {picker === "icon" ? (
          <EmojiPicker
            current={icon}
            onPick={(emoji) => {
              setPicker(null);
              onIconChange(emoji);
            }}
            onRemove={() => {
              setPicker(null);
              onIconChange(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
        {picker === "cover" ? (
          <CoverPicker
            current={cover}
            onPick={(id) => {
              setPicker(null);
              onCoverChange(id);
            }}
            onRemove={() => {
              setPicker(null);
              onCoverChange(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
      </div>
      <input
        className="page__title"
        value={record.meta.title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={BRAND.empty.untitled}
        aria-label="Page title"
        spellCheck={false}
        autoComplete="off"
        data-page-title={displayTitle}
      />
      {view === "table" ? (
        <ChildrenTable parentId={record.meta.id} refreshKey={editorEpoch} onOpenPage={onOpenPage} />
      ) : (
        <Editor
          key={`${record.meta.id}:${editorEpoch}`}
          pageId={record.meta.id}
          onDocChange={onDocChange}
          autoFocus={autoFocusEditor}
          onOpenPage={onOpenPage}
          onCommentRequest={handleCommentRequest}
          onCommentClick={handleCommentClick}
        />
      )}
      {view === "doc" && backlinks.length > 0 ? (
        <section className="page__backlinks" aria-label="Linked from">
          <h2 className="page__backlinks-title">Linked from</h2>
          <ul className="page__backlinks-list">
            {backlinks.map((hit) => {
              const parentPath = hit.path.slice(0, -1);
              return (
                <li key={hit.id}>
                  <button type="button" className="page__backlink" onClick={() => onOpenPage(hit.id)}>
                    <span className="page__backlink-title">
                      {hit.title.length > 0 ? hit.title : BRAND.empty.untitled}
                    </span>
                    {parentPath.length > 0 ? (
                      <span className="page__backlink-path">{parentPath.join(" / ")}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {view === "doc" && commentsOpen ? (
        <aside className="comments-panel" aria-label="Comments">
          <div className="comments-panel__head">
            <h2 className="comments-panel__title">Comments</h2>
            <button
              type="button"
              className="comments-panel__close"
              aria-label="Close comments"
              onClick={() => setCommentsOpen(false)}
            >
              ×
            </button>
          </div>
          {draftQuote !== null ? (
            <div className="comment-composer">
              <blockquote className="comment-thread__quote">{draftQuote}</blockquote>
              <textarea
                className="comment-composer__input"
                aria-label="Comment text"
                placeholder="Write a comment"
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
              />
              <div className="comment-composer__actions">
                <button
                  type="button"
                  className="ghost-btn ghost-btn--small"
                  onClick={() => {
                    setDraftQuote(null);
                    setDraftBody("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void submitDraft()}
                  disabled={draftBody.trim().length === 0}
                >
                  Post
                </button>
              </div>
            </div>
          ) : null}
          {openThreads.length === 0 && draftQuote === null ? (
            <p className="comments-panel__empty">
              Select text in the page, then press Comment to start a thread.
            </p>
          ) : null}
          {openThreads.length > 0 ? (
            <ul className="comments-panel__list">{openThreads.map(renderThread)}</ul>
          ) : null}
          {resolvedThreads.length > 0 ? (
            <div className="comments-panel__resolved">
              <button
                type="button"
                className="comments-panel__resolved-toggle"
                onClick={() => setShowResolved((open) => !open)}
              >
                {showResolved
                  ? "Hide resolved"
                  : `Show resolved (${resolvedThreads.length})`}
              </button>
              {showResolved ? (
                <ul className="comments-panel__list">{resolvedThreads.map(renderThread)}</ul>
              ) : null}
            </div>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
