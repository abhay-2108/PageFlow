import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AiAssistantDrawer } from "./components/AiAssistantDrawer";
import { ollamaModal } from "./components/ollamaModalController";
import { aiModelStore } from "./lib/aiModels";
import { getApi } from "./lib/api";
import { assetUrl } from "./lib/assetUrl";
import { session } from "./lib/session";
import { activeEditor } from "./editor/activeEditor";
import { renderMarkdownToHtml } from "./components/AiMarkdownView";

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
  onFavoriteChange?: (favorite: boolean) => void;
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
  onFavoriteChange,
}: PageViewProps) {
  const api = getApi();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const [crumbsMenuOpen, setCrumbsMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkHit[]>([]);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftQuote, setDraftQuote] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [fullWidth, setFullWidth] = useState(() => localStorage.getItem("pg_full_width") === "true");
  const [smallText, setSmallText] = useState(() => localStorage.getItem("pg_small_text") === "true");
  const [fontStyle, setFontStyle] = useState<"sans" | "serif" | "mono">(
    () => (localStorage.getItem("pg_font_style") as "sans" | "serif" | "mono") ?? "sans",
  );
  const [theme, setTheme] = useState<"system" | "light" | "dark">(
    () => (localStorage.getItem("pg_theme") as "system" | "light" | "dark") ?? "system",
  );

  const handleToggleAiDrawer = useCallback(async () => {
    if (!aiDrawerOpen) {
      const st = await aiModelStore.refreshStatus();
      if (!st.available) {
        ollamaModal.open();
        return;
      }
    }
    setAiDrawerOpen((open) => !open);
  }, [aiDrawerOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        void handleToggleAiDrawer();
      }
    };
    const onToggleAiEvent = () => {
      void handleToggleAiDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageflow:toggle-ai", onToggleAiEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageflow:toggle-ai", onToggleAiEvent);
    };
  }, [handleToggleAiDrawer]);

  const displayTitle = record.meta.title.length > 0 ? record.meta.title : BRAND.empty.untitled;
  const icon = record.meta.icon;
  const cover = record.meta.cover ?? null;
  const view: PageViewMode = record.meta.view === "table" ? "table" : "doc";

  const handleInsertAiContent = useCallback(
    async (text: string) => {
      let ed = activeEditor.get();
      if (!ed || ed.isDestroyed) {
        const editorEl = editorContainerRef.current?.querySelector<HTMLElement>(".pg-editor");
        if (editorEl) {
          editorEl.focus();
        }
        ed = activeEditor.get();
      }

      const html = renderMarkdownToHtml(text);

      if (view === "table") {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
        if (tableLines.length >= 2) {
          const dataRows = tableLines.slice(1).filter((r) => {
            const cells = r.slice(1, -1).split("|").map((c) => c.trim());
            return !cells.every((c) => /^:?-+:?$/.test(c));
          });

          for (const row of dataRows) {
            const cells = row.slice(1, -1).split("|").map((c) => c.trim());
            const title = cells[0] || BRAND.empty.untitled;
            await api.pages.create({ parentId: record.meta.id, title });
          }
          return;
        }

        // Check for gallery / list items: e.g. "### Title", "- Item", "1. Item"
        const itemLines = lines.filter((l) =>
          /^###\s+/.test(l) || /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l),
        );
        if (itemLines.length > 0) {
          for (const item of itemLines) {
            const cleanTitle = item
              .replace(/^###\s+/, "")
              .replace(/^[-*]\s+/, "")
              .replace(/^\d+\.\s+/, "")
              .split(" - ")[0]
              ?.split(":")[0]
              ?.trim();
            if (cleanTitle) {
              await api.pages.create({ parentId: record.meta.id, title: cleanTitle });
            }
          }
          return;
        }

        onViewChange("doc");
        setTimeout(() => {
          const newEd = activeEditor.get();
          if (newEd && !newEd.isDestroyed) {
            newEd.chain().focus().insertContent(html).run();
          }
        }, 150);
        return;
      }

      if (ed && !ed.isDestroyed) {
        ed.chain().focus().insertContent(html).run();
      } else {
        setTimeout(() => {
          const retryEd = activeEditor.get();
          if (retryEd && !retryEd.isDestroyed) {
            retryEd.chain().focus().insertContent(html).run();
          }
        }, 150);
      }
    },
    [api, onViewChange, record.meta.id, view],
  );

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("pg_theme", theme);
  }, [theme]);

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
    <main
      className={[
        "page",
        cover ? "page--has-cover" : "",
        fullWidth ? "page--full-width" : "",
        smallText ? "page--small-text" : "",
        fontStyle === "serif"
          ? "page--font-serif"
          : fontStyle === "mono"
            ? "page--font-mono"
            : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
        <button
          type="button"
          className={`page__ai-btn ${aiDrawerOpen ? "page__ai-btn--active" : ""}`}
          aria-label="Toggle AI Assistant"
          title="Ask AI Assistant (Ctrl+Shift+J)"
          onClick={() => void handleToggleAiDrawer()}
        >
          <span>✦ Ask AI</span>
        </button>
        {onFavoriteChange ? (
          <button
            type="button"
            className={record.meta.favorite ? "page__fav-star-btn page__fav-star-btn--active" : "page__fav-star-btn"}
            aria-label={record.meta.favorite ? "Remove from Favorites" : "Add to Favorites"}
            title={record.meta.favorite ? "Remove from Favorites" : "Add to Favorites"}
            onClick={() => onFavoriteChange(!record.meta.favorite)}
          >
            {record.meta.favorite ? "★" : "☆"}
          </button>
        ) : null}
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
            <div className="menu-popover menu-popover--anchored pg-page-options-menu" role="menu">
              <div className="pg-menu-section-title">Style</div>
              <div className="pg-font-picker" role="group" aria-label="Font style">
                <button
                  type="button"
                  className={
                    fontStyle === "sans" ? "pg-font-btn pg-font-btn--active" : "pg-font-btn"
                  }
                  onClick={() => {
                    setFontStyle("sans");
                    localStorage.setItem("pg_font_style", "sans");
                  }}
                >
                  <span className="pg-font-preview" style={{ fontFamily: "var(--pg-font)" }}>
                    Ag
                  </span>
                  <span className="pg-font-label">Default</span>
                </button>
                <button
                  type="button"
                  className={
                    fontStyle === "serif" ? "pg-font-btn pg-font-btn--active" : "pg-font-btn"
                  }
                  onClick={() => {
                    setFontStyle("serif");
                    localStorage.setItem("pg_font_style", "serif");
                  }}
                >
                  <span className="pg-font-preview" style={{ fontFamily: "Georgia, serif" }}>
                    Ag
                  </span>
                  <span className="pg-font-label">Serif</span>
                </button>
                <button
                  type="button"
                  className={
                    fontStyle === "mono" ? "pg-font-btn pg-font-btn--active" : "pg-font-btn"
                  }
                  onClick={() => {
                    setFontStyle("mono");
                    localStorage.setItem("pg_font_style", "mono");
                  }}
                >
                  <span className="pg-font-preview" style={{ fontFamily: "var(--pg-font-mono)" }}>
                    Ag
                  </span>
                  <span className="pg-font-label">Mono</span>
                </button>
              </div>

              <div className="pg-menu-divider" />

              <div
                className="pg-menu-toggle-row"
                onClick={() => {
                  setSmallText((prev) => {
                    const next = !prev;
                    localStorage.setItem("pg_small_text", String(next));
                    return next;
                  });
                }}
              >
                <span>Small text</span>
                <span className={smallText ? "pg-switch pg-switch--on" : "pg-switch"}>
                  <span className="pg-switch__knob" />
                </span>
              </div>

              <div
                className="pg-menu-toggle-row"
                onClick={() => {
                  setFullWidth((prev) => {
                    const next = !prev;
                    localStorage.setItem("pg_full_width", String(next));
                    return next;
                  });
                }}
              >
                <span>Full width</span>
                <span className={fullWidth ? "pg-switch pg-switch--on" : "pg-switch"}>
                  <span className="pg-switch__knob" />
                </span>
              </div>

              <div className="pg-menu-divider" />

              <div className="pg-menu-section-title">Theme</div>
              <div className="page__view-toggle" style={{ margin: "4px 8px 8px 8px" }}>
                <button
                  type="button"
                  className={
                    theme === "light"
                      ? "page__view-btn page__view-btn--active"
                      : "page__view-btn"
                  }
                  onClick={() => setTheme("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={
                    theme === "dark"
                      ? "page__view-btn page__view-btn--active"
                      : "page__view-btn"
                  }
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={
                    theme === "system"
                      ? "page__view-btn page__view-btn--active"
                      : "page__view-btn"
                  }
                  onClick={() => setTheme("system")}
                >
                  System
                </button>
              </div>

              <div className="pg-menu-divider" />

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
        <div className="page__meta-actions" aria-label="Page header actions">
          {!icon ? (
            <button
              type="button"
              className="page__meta-btn"
              onClick={() => setPicker(picker === "icon" ? null : "icon")}
            >
              + Add icon
            </button>
          ) : null}
          {!cover ? (
            <button
              type="button"
              className="page__meta-btn"
              onClick={() => setPicker(picker === "cover" ? null : "cover")}
            >
              + Add cover
            </button>
          ) : null}
          {view === "doc" ? (
            <button
              type="button"
              className="page__meta-btn"
              aria-label="Add comment"
              onClick={() => setCommentsOpen(true)}
            >
              {openThreads.length > 0 ? `Comments (${openThreads.length})` : "+ Add comment"}
            </button>
          ) : null}
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
              Database
            </button>
          </div>
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
        <ChildrenTable
          parentId={record.meta.id}
          pages={pages}
          refreshKey={editorEpoch}
          onOpenPage={onOpenPage}
        />
      ) : (
        <div ref={editorContainerRef} className="page__editor-container">
          <Editor
            key={`${record.meta.id}:${editorEpoch}`}
            pageId={record.meta.id}
            onDocChange={onDocChange}
            autoFocus={autoFocusEditor}
            onOpenPage={onOpenPage}
            onCommentRequest={handleCommentRequest}
            onCommentClick={handleCommentClick}
          />
        </div>
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
      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        pageTitle={displayTitle}
        pageId={record.meta.id}
        onInsertContent={handleInsertAiContent}
      />
    </main>
  );
}
