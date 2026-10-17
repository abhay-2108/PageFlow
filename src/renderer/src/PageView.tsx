import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BacklinkHit,
  CommentThread,
  PageMeta,
  PageRecord,
  PageViewMode,
  TipTapDocument,
} from "../../shared/types";
import { isCoverId } from "../../shared/covers";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";
import { commentTools } from "./editor/comments/controller";
import { ChildrenTable } from "./components/ChildrenTable";
import { CoverPicker } from "./components/CoverPicker";
import { EmojiPicker } from "./components/EmojiPicker";
import { getApi } from "./lib/api";
import { assetUrl } from "./lib/assetUrl";
import { session } from "./lib/session";

export interface PageViewProps {
  record: PageRecord;
  pages: PageMeta[];
  editorEpoch: number;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: string | null) => void;
  onViewChange: (view: PageViewMode) => void;
  onOpenPage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
  onTrashPage: (id: string) => void;
  onExportMarkdown: () => void;
  onCopyLink: (id: string) => void;
}

export function PageView({
  record,
  pages,
  editorEpoch,
  onDocChange,
  onTitleChange,
  autoFocusEditor,
  onIconChange,
  onCoverChange,
  onViewChange,
  onOpenPage,
  onDuplicatePage,
  onTrashPage,
  onExportMarkdown,
  onCopyLink,
}: PageViewProps) {
  const api = getApi();
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const [crumbsMenuOpen, setCrumbsMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
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
  const cover = record.meta.cover ?? null;
  const view: PageViewMode = record.meta.view === "table" ? "table" : "doc";

  useEffect(() => {
    if (!crumbsMenuOpen && !optionsOpen) {
      return;
    }
    const close = () => {
      setCrumbsMenuOpen(false);
      setOptionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [crumbsMenuOpen, optionsOpen]);

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

  const crumbPath = useMemo(() => {
    const byId = new Map(pages.map((page) => [page.id, page]));
    const path: PageMeta[] = [];
    const visited = new Set<string>();
    let current: PageMeta | undefined = byId.get(record.meta.id) ?? record.meta;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return path;
  }, [pages, record.meta]);

  const collapsedCrumbs =
    crumbPath.length > 4 ? crumbPath.slice(1, crumbPath.length - 2) : [];
  const visibleCrumbs: Array<PageMeta | "ellipsis"> =
    collapsedCrumbs.length > 0
      ? [crumbPath[0] as PageMeta, "ellipsis", ...crumbPath.slice(-2)]
      : crumbPath;
  const crumbLabel = (page: PageMeta) =>
    page.title.trim().length > 0 ? page.title : BRAND.empty.untitled;

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
      <nav className="page__crumbs" aria-label="Breadcrumbs">
        {icon ? (
          <span className="page__crumbs-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {visibleCrumbs.map((entry, index) => {
          if (entry === "ellipsis") {
            return (
              <span key="ellipsis" className="crumb-ellipsis-wrap">
                <button
                  type="button"
                  className="crumb crumb--ellipsis"
                  aria-label="Show hidden pages"
                  aria-expanded={crumbsMenuOpen}
                  onClick={() => setCrumbsMenuOpen((open) => !open)}
                >
                  …
                </button>
                {crumbsMenuOpen ? (
                  <div
                    className="menu-popover crumbs-menu"
                    role="menu"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {collapsedCrumbs.map((hidden) => (
                      <button
                        key={hidden.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCrumbsMenuOpen(false);
                          onOpenPage(hidden.id);
                        }}
                      >
                        {hidden.icon ? <span aria-hidden="true">{hidden.icon} </span> : null}
                        {crumbLabel(hidden)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
            );
          }
          const isLast = index === visibleCrumbs.length - 1;
          return (
            <span key={entry.id} className="crumb-slot">
              {index > 0 ? (
                <span className="crumb-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span className="crumb crumb--current" aria-current="page" title={crumbLabel(entry)}>
                  {crumbLabel(entry)}
                </span>
              ) : (
                <button
                  type="button"
                  className="crumb"
                  title={crumbLabel(entry)}
                  onClick={() => onOpenPage(entry.id)}
                >
                  {entry.icon ? <span aria-hidden="true">{entry.icon} </span> : null}
                  {crumbLabel(entry)}
                </button>
              )}
            </span>
          );
        })}
        <span className="page__crumbs-spacer" />
        <div className="page__options-wrap" onMouseDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="icon-btn page__options-btn"
            aria-label="Page options"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            …
          </button>
          {optionsOpen ? (
            <div className="menu-popover menu-popover--anchored" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOptionsOpen(false);
                  onCopyLink(record.meta.id);
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOptionsOpen(false);
                  onDuplicatePage(record.meta.id);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOptionsOpen(false);
                  onExportMarkdown();
                }}
              >
                Export as Markdown
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-popover__danger"
                onClick={() => {
                  setOptionsOpen(false);
                  onTrashPage(record.meta.id);
                }}
              >
                Move to trash
              </button>
            </div>
          ) : null}
        </div>
      </nav>
      {cover ? (
        <div
          className={isCoverId(cover) ? `page__cover cover--${cover}` : "page__cover page__cover--asset"}
          data-page-cover={cover}
        >
          {isCoverId(cover) ? null : (
            <img className="page__cover-image" src={assetUrl(cover)} alt="" draggable={false} />
          )}
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
