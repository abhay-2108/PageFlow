import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BRAND } from "../../shared/brand";
import { childrenOf } from "../../shared/tree";
import type { PageMeta, PageRecord, PageViewMode, TipTapDocument } from "../../shared/types";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { PageView } from "./PageView";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { OllamaOfflineModal } from "./components/OllamaOfflineModal";
import { Sidebar } from "./components/Sidebar";
import { Toast, type ToastData } from "./components/Toast";
import { getApi } from "./lib/api";
import { emitWorkspaceChanged, onWorkspaceChanged } from "./lib/bus";
import { exportMarkdown } from "./lib/markdown";
import { session } from "./lib/session";
import { debounce } from "../../shared/debounce";
import { useTabs, type DesktopTab } from "./hooks/useTabs";

const SAVE_DEBOUNCE_MS = 250;
const RENAME_DEBOUNCE_MS = 400;

const debouncedSave = debounce((id: string, doc: TipTapDocument) => {
  void getApi().pages.updateDoc(id, doc).catch(() => undefined);
}, SAVE_DEBOUNCE_MS);

const debouncedRename = debounce((id: string, title: string) => {
  void getApi().pages.rename(id, title).catch(() => undefined);
}, RENAME_DEBOUNCE_MS);

function LoadingSkeleton() {
  return (
    <div className="app__scroll app__loading" aria-label="Loading workspace" role="status">
      <div className="loading-skeleton">
        <div className="loading-skeleton__title" />
        <div className="loading-skeleton__line" />
        <div className="loading-skeleton__line" />
        <div className="loading-skeleton__line loading-skeleton__line--short" />
        <div className="loading-skeleton__line" />
        <div className="loading-skeleton__line loading-skeleton__line--short" />
      </div>
    </div>
  );
}

export default function App() {
  const api = getApi();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [trash, setTrash] = useState<PageMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<PageRecord | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusPageId, setFocusPageId] = useState<string | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sessionState = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const latestDocRef = useRef<{ id: string; doc: TipTapDocument } | null>(null);

  const flushSave = useCallback(() => {
    debouncedSave.flush();
  }, []);

  const flushRename = useCallback(() => {
    debouncedRename.flush();
  }, []);

  const queueSave = useCallback(
    (id: string, doc: TipTapDocument) => {
      latestDocRef.current = { id, doc };
      debouncedSave(id, doc);
    },
    [],
  );

  const queueRename = useCallback(
    (id: string, title: string) => {
      setPages((prev) => prev.map((page) => (page.id === id ? { ...page, title } : page)));
      setActiveRecord((prev) =>
        prev && prev.meta.id === id ? { ...prev, meta: { ...prev.meta, title } } : prev,
      );
      debouncedRename(id, title);
    },
    [],
  );

  const refreshLists = useCallback(async () => {
    const [nextPages, nextTrash] = await Promise.all([api.pages.list(), api.pages.listTrash()]);
    setPages(nextPages);
    setTrash(nextTrash);
    return nextPages;
  }, [api]);

  const openPage = useCallback(
    async (id: string) => {
      const record = await api.pages.get(id);
      if (record) {
        setActiveId(id);
        setActiveRecord(record);
      }
    },
    [api],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [info, nextPages, nextTrash] = await Promise.all([
        api.workspace.info(),
        api.pages.list(),
        api.pages.listTrash(),
      ]);
      if (cancelled) {
        return;
      }
      setWorkspaceDir(info.dir);
      setPages(nextPages);
      setTrash(nextTrash);
      setLoading(false);
      await session.init({
        userName: info.userName,
        onRemoteMeta: () => {
          void refreshLists();
        },
      });
      if (!cancelled) {
        setSessionReady(true);
      }
      const first = childrenOf(nextPages, null)[0] ?? nextPages[0];
      if (first) {
        const initialTabId = crypto.randomUUID();
        setTabs([{ id: initialTabId, pageId: first.id }]);
        setActiveTabId(initialTabId);
        await openPage(first.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, openPage, refreshLists]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    session.reconcileMeta(pages, trash);
    session.syncPages(pages);
  }, [sessionReady, pages, trash, sessionState.status]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onWorkspaceChanged(() => {
      void (async () => {
        const nextPages = await refreshLists();
        setEditorEpoch((epoch) => epoch + 1);
        if (!cancelled && activeId !== null && nextPages.some((page) => page.id === activeId)) {
          await openPage(activeId);
        }
      })();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeId, openPage, refreshLists]);

  useEffect(() => {
    const onUnload = () => {
      flushSave();
      flushRename();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      onUnload();
    };
  }, [flushSave, flushRename]);

  useEffect(() => {
    const trimmed = activeRecord?.meta.title.trim() ?? "";
    document.title = trimmed.length > 0 ? `${trimmed} — ${BRAND.name}` : BRAND.name;
  }, [activeRecord?.meta.title]);

  const onBeforeTabSwitch = useCallback(() => {
    flushSave();
    flushRename();
  }, [flushRename, flushSave]);

  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    selectTab,
    switchTab,
    closeTab,
    openNewTab,
  } = useTabs({
    onOpenPage: openPage,
    onBeforeSwitch: onBeforeTabSwitch,
  });

  const selectPage = useCallback(
    async (id: string, inNewTab = false) => {
      setFocusPageId(null);
      await selectTab(id, inNewTab);
    },
    [selectTab],
  );

  const createPage = useCallback(
    async (parentId: string | null) => {
      flushSave();
      flushRename();
      const meta = await api.pages.create({ parentId });
      await refreshLists();
      if (parentId !== null) {
        setExpanded((prev) => new Set(prev).add(parentId));
      }
      setFocusPageId(meta.id);
      const tabId = crypto.randomUUID();
      setTabs((prev) => [...prev, { id: tabId, pageId: meta.id }]);
      setActiveTabId(tabId);
      await openPage(meta.id);
    },
    [api, flushSave, flushRename, openPage, refreshLists],
  );

  const addNewTab = useCallback(async () => {
    const defaultPage = childrenOf(pages, null)[0] ?? pages[0];
    if (defaultPage) {
      const tabId = crypto.randomUUID();
      setTabs((prev) => [...prev, { id: tabId, pageId: defaultPage.id }]);
      setActiveTabId(tabId);
      await openPage(defaultPage.id);
    } else {
      await createPage(null);
    }
  }, [createPage, openPage, pages]);

  const trashPage = useCallback(
    async (id: string) => {
      flushSave();
      flushRename();
      const label = pages.find((page) => page.id === id)?.title.trim();
      await api.pages.trash(id);
      const nextPages = await refreshLists();
      if (activeId !== null && !nextPages.some((page) => page.id === activeId)) {
        setActiveId(null);
        setActiveRecord(null);
      }
      const remainingTabs = tabs.filter((t) => t.pageId !== id);
      if (remainingTabs.length > 0) {
        setTabs(remainingTabs);
        const next = remainingTabs[0];
        if (activeId === id && next) {
          setActiveTabId(next.id);
          await openPage(next.pageId);
        }
      }
      setToast({
        message: `Moved "${label && label.length > 0 ? label : BRAND.empty.untitled}" to Trash`,
        actionLabel: "Undo",
        onAction: () => {
          void api.pages
            .restore(id)
            .then(refreshLists)
            .catch(() => undefined);
        },
      });
    },
    [activeId, api, flushSave, flushRename, openPage, pages, refreshLists, tabs],
  );

  const restorePage = useCallback(
    async (id: string) => {
      await api.pages.restore(id);
      await refreshLists();
    },
    [api, refreshLists],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      flushSave();
      flushRename();
      const label = pages.find((page) => page.id === id)?.title.trim();
      try {
        const meta = await api.pages.duplicate(id);
        if (meta.parentId !== null) {
          setExpanded((prev) => new Set(prev).add(meta.parentId as string));
        }
        await refreshLists();
        setToast({
          message: `Duplicated "${label && label.length > 0 ? label : BRAND.empty.untitled}"`,
        });
      } catch {
        setToast({ message: "Could not duplicate that page." });
      }
    },
    [api, flushRename, flushSave, pages, refreshLists],
  );

  const copyPageLink = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(`pagegrove://page/${id}`);
        setToast({ message: "Page link copied" });
      } catch {
        setToast({ message: "Could not copy the link." });
      }
    },
    [],
  );

  const applyMetaUpdate = useCallback((meta: PageMeta) => {
    setPages((prev) => prev.map((page) => (page.id === meta.id ? meta : page)));
    setActiveRecord((prev) =>
      prev && prev.meta.id === meta.id ? { ...prev, meta } : prev,
    );
  }, []);

  const movePage = useCallback(
    async (id: string, parentId: string | null, beforeId: string | null) => {
      try {
        flushSave();
        flushRename();
        await api.pages.move({ id, parentId, beforeId });
        if (parentId !== null) {
          setExpanded((prev) => new Set(prev).add(parentId));
        }
        await refreshLists();
      } catch {
        setToast({ message: "Could not move that page." });
      }
    },
    [api, flushRename, flushSave, refreshLists],
  );

  const setPageIcon = useCallback(
    async (id: string, icon: string | null) => {
      try {
        const meta = await api.pages.setIcon(id, icon);
        applyMetaUpdate(meta);
      } catch {
        setToast({ message: "Could not update the page icon." });
      }
    },
    [api, applyMetaUpdate],
  );

  const setPageCover = useCallback(
    async (id: string, cover: string | null) => {
      try {
        const meta = await api.pages.setCover(id, cover);
        applyMetaUpdate(meta);
      } catch {
        setToast({ message: "Could not update the page cover." });
      }
    },
    [api, applyMetaUpdate],
  );

  const setPageView = useCallback(
    async (id: string, view: PageViewMode) => {
      try {
        const meta = await api.pages.setView(id, view);
        applyMetaUpdate(meta);
      } catch {
        setToast({ message: "Could not switch the page view." });
      }
    },
    [api, applyMetaUpdate],
  );

  const setPageFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      try {
        const meta = await api.pages.setFavorite(id, favorite);
        applyMetaUpdate(meta);
      } catch {
        setToast({ message: "Could not update Favorites." });
      }
    },
    [api, applyMetaUpdate],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createPage(null);
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "k" || event.key.toLowerCase() === "p")
      ) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        void addNewTab();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
        event.preventDefault();
        if (activeTabId) {
          void closeTab(activeTabId);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTabId, addNewTab, closeTab, createPage]);

  const exportCurrentPageMarkdown = useCallback(async () => {
    if (!activeRecord) {
      return;
    }
    try {
      const id = activeRecord.meta.id;
      const doc =
        latestDocRef.current && latestDocRef.current.id === id
          ? latestDocRef.current.doc
          : ((await api.pages.get(id))?.doc ?? null);
      if (!doc) {
        return;
      }
      flushSave();
      const label = activeRecord.meta.title.trim().length > 0 ? activeRecord.meta.title : BRAND.empty.untitled;
      const markdown = exportMarkdown(doc, activeRecord.meta.title);
      const result = await api.files.exportMarkdown(activeRecord.meta.title, markdown);
      if (result.ok) {
        setToast({ message: `Exported "${label}" as Markdown` });
      }
    } catch {
      setToast({ message: "Could not export the page." });
    }
  }, [activeRecord, api, flushSave]);

  const exportBundle = useCallback(async () => {
    try {
      const result = await api.sync.exportBundle();
      if (result.ok) {
        setToast({ message: "Sync bundle exported" });
      }
    } catch {
      setToast({ message: "Could not export the sync bundle." });
    }
  }, [api]);

  const importBundle = useCallback(async () => {
    try {
      const result = await api.sync.importBundle();
      if (result.ok) {
        emitWorkspaceChanged();
        setToast({ message: `Merged ${result.applied} pages from bundle` });
      }
    } catch {
      setToast({ message: "Could not import the sync bundle." });
    }
  }, [api]);

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const pageActions: PaletteAction[] = pages.map((page) => ({
      id: `page-${page.id}`,
      group: "Pages",
      label: page.title.trim().length > 0 ? page.title : BRAND.empty.untitled,
      icon: page.icon ?? "📄",
      keywords: [page.title, "page", "note", "doc"],
      onRun: () => {
        void openPage(page.id);
      },
    }));

    const commandActions: PaletteAction[] = [
      {
        id: "new-page",
        group: "Actions",
        label: "New page",
        icon: "➕",
        keywords: ["create", "add"],
        onRun: () => {
          void createPage(null);
        },
      },
      {
        id: "new-tab",
        group: "Actions",
        label: "New tab",
        icon: "📑",
        keywords: ["tab", "open", "window"],
        onRun: () => {
          void addNewTab();
        },
      },
      {
        id: "close-tab",
        group: "Actions",
        label: "Close current tab",
        icon: "✕",
        keywords: ["tab", "close"],
        onRun: () => {
          if (activeTabId) {
            void closeTab(activeTabId);
          }
        },
      },
    ];
    if (activeRecord) {
      commandActions.push(
        {
          id: "export-markdown",
          group: "Actions",
          label: "Export page as Markdown",
          icon: "📥",
          keywords: ["download", "md"],
          onRun: () => {
            void exportCurrentPageMarkdown();
          },
        },
        {
          id: "trash-page",
          group: "Actions",
          label: "Move current page to trash",
          icon: "🗑️",
          keywords: ["delete", "remove"],
          onRun: () => {
            void trashPage(activeRecord.meta.id);
          },
        },
      );
    }
    commandActions.push(
      {
        id: "export-bundle",
        group: "Actions",
        label: "Export sync bundle",
        icon: "📦",
        keywords: ["backup", "sync", "file"],
        onRun: () => {
          void exportBundle();
        },
      },
      {
        id: "import-bundle",
        group: "Actions",
        label: "Import sync bundle",
        icon: "🔄",
        keywords: ["merge", "sync", "file"],
        onRun: () => {
          void importBundle();
        },
      },
      {
        id: "open-logs",
        group: "Actions",
        label: "Open Diagnostic Logs (app.log)",
        icon: "📋",
        keywords: ["logs", "debug", "diagnostic", "error"],
        onRun: () => {
          void api.app.openLogs().catch(() => {
            setToast({ message: "Could not open log folder." });
          });
        },
      },
    );
    return [...pageActions, ...commandActions];
  }, [
    pages,
    openPage,
    activeRecord,
    activeTabId,
    addNewTab,
    closeTab,
    createPage,
    exportBundle,
    exportCurrentPageMarkdown,
    importBundle,
    trashPage,
  ]);

  return (
    <div className="shell">
      <Sidebar
        pages={pages}
        trash={trash}
        activeId={activeId}
        workspaceDir={workspaceDir}
        expanded={expanded}
        onToggleExpanded={(id) =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return next;
          })
        }
        onSelect={(id) => {
          void selectPage(id);
        }}
        onCreate={(parentId) => {
          void createPage(parentId);
        }}
        onRename={(id, title) => queueRename(id, title)}
        onTrash={(id) => {
          void trashPage(id);
        }}
        onRestore={(id) => {
          void restorePage(id);
        }}
        onMove={(id, parentId, beforeId) => {
          void movePage(id, parentId, beforeId);
        }}
        onFavorite={(id, favorite) => {
          void setPageFavorite(id, favorite);
        }}
        onDuplicate={(id) => {
          void duplicatePage(id);
        }}
        onOpenSearch={() => {
          setPaletteOpen(true);
        }}
        onToggleAi={() => {
          window.dispatchEvent(new CustomEvent("pageflow:toggle-ai"));
        }}
      />
      <div className="app__main-column">
        {tabs.length > 0 ? (
          <div className="pg-tabs-bar" role="tablist" aria-label="Desktop tabs">
            <div className="pg-tabs-scroll">
              {tabs.map((tab) => {
                const tabMeta = pages.find((p) => p.id === tab.pageId);
                const isActive = tab.id === activeTabId;
                const title = tabMeta?.title?.trim() ? tabMeta.title : BRAND.empty.untitled;
                return (
                  <div
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    className={isActive ? "pg-tab pg-tab--active" : "pg-tab"}
                    onClick={() => void switchTab(tab.id)}
                  >
                    <span className="pg-tab__icon">{tabMeta?.icon ?? "📄"}</span>
                    <span className="pg-tab__title" title={title}>
                      {title}
                    </span>
                    {tabs.length > 1 ? (
                      <button
                        type="button"
                        className="pg-tab__close"
                        aria-label={`Close ${title} tab`}
                        title="Close tab (Ctrl+W)"
                        onClick={(e) => {
                          e.stopPropagation();
                          void closeTab(tab.id);
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="pg-tab__new-btn"
              aria-label="New tab (Ctrl+T)"
              title="New tab (Ctrl+T)"
              onClick={() => void addNewTab()}
            >
              +
            </button>
          </div>
        ) : null}
        <div className="app__scroll">
          {loading ? (
            <LoadingSkeleton />
          ) : pages.length === 0 ? (
            <EmptyWorkspace
              onCreate={() => {
                void createPage(null);
              }}
            />
          ) : null}
          {activeRecord ? (
            <PageView
              record={activeRecord}
              pages={pages}
              editorEpoch={editorEpoch}
              onDocChange={(doc) => {
                latestDocRef.current = { id: activeRecord.meta.id, doc };
                queueSave(activeRecord.meta.id, doc);
              }}
              onTitleChange={(title) => queueRename(activeRecord.meta.id, title)}
              autoFocusEditor={focusPageId !== null && focusPageId === activeRecord.meta.id}
              onIconChange={(icon) => {
                void setPageIcon(activeRecord.meta.id, icon);
              }}
              onCoverChange={(cover) => {
                void setPageCover(activeRecord.meta.id, cover);
              }}
              onViewChange={(view) => {
                void setPageView(activeRecord.meta.id, view);
              }}
              onOpenPage={(id) => {
                void selectPage(id);
              }}
              onDuplicatePage={(id) => {
                void duplicatePage(id);
              }}
              onTrashPage={(id) => {
                void trashPage(id);
              }}
              onExportMarkdown={() => {
                void exportCurrentPageMarkdown();
              }}
              onCopyLink={(id) => {
                void copyPageLink(id);
              }}
              onFavoriteChange={(favorite) => {
                void setPageFavorite(activeRecord.meta.id, favorite);
              }}
            />
          ) : null}
        </div>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
      <OllamaOfflineModal />
    </div>
  );
}
