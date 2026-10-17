import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BRAND } from "../../shared/brand";
import type { CoverId } from "../../shared/covers";
import { childrenOf } from "../../shared/tree";
import type { PageMeta, PageRecord, TipTapDocument } from "../../shared/types";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { PageView } from "./PageView";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { Toast, type ToastData } from "./components/Toast";
import { getApi } from "./lib/api";
import { emitWorkspaceChanged, onWorkspaceChanged } from "./lib/bus";
import { exportMarkdown } from "./lib/markdown";
import { session } from "./lib/session";

const SAVE_DEBOUNCE_MS = 250;
const RENAME_DEBOUNCE_MS = 400;

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
  const latestDoc = useRef<{ id: string; doc: TipTapDocument } | null>(null);

  const pendingSave = useRef<{ id: string; doc: TipTapDocument } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const pendingRename = useRef<{ id: string; title: string } | null>(null);
  const renameTimer = useRef<number | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSave.current;
    pendingSave.current = null;
    if (pending) {
      void api.pages.updateDoc(pending.id, pending.doc).catch(() => undefined);
    }
  }, [api]);

  const flushRename = useCallback(() => {
    if (renameTimer.current !== null) {
      window.clearTimeout(renameTimer.current);
      renameTimer.current = null;
    }
    const pending = pendingRename.current;
    pendingRename.current = null;
    if (pending) {
      void api.pages.rename(pending.id, pending.title).catch(() => undefined);
    }
  }, [api]);

  const queueSave = useCallback(
    (id: string, doc: TipTapDocument) => {
      pendingSave.current = { id, doc };
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  const queueRename = useCallback(
    (id: string, title: string) => {
      setPages((prev) => prev.map((page) => (page.id === id ? { ...page, title } : page)));
      setActiveRecord((prev) =>
        prev && prev.meta.id === id ? { ...prev, meta: { ...prev.meta, title } } : prev,
      );
      pendingRename.current = { id, title };
      if (renameTimer.current !== null) {
        window.clearTimeout(renameTimer.current);
      }
      renameTimer.current = window.setTimeout(() => {
        renameTimer.current = null;
        flushRename();
      }, RENAME_DEBOUNCE_MS);
    },
    [flushRename],
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

  const selectPage = useCallback(
    async (id: string) => {
      flushSave();
      flushRename();
      setFocusPageId(null);
      await openPage(id);
    },
    [flushSave, flushRename, openPage],
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
      await openPage(meta.id);
    },
    [api, flushSave, flushRename, openPage, refreshLists],
  );

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
    [activeId, api, flushSave, flushRename, pages, refreshLists],
  );

  const restorePage = useCallback(
    async (id: string) => {
      await api.pages.restore(id);
      await refreshLists();
    },
    [api, refreshLists],
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
    async (id: string, cover: CoverId | null) => {
      try {
        const meta = await api.pages.setCover(id, cover);
        applyMetaUpdate(meta);
      } catch {
        setToast({ message: "Could not update the page cover." });
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createPage]);

  const exportCurrentPageMarkdown = useCallback(async () => {
    if (!activeRecord) {
      return;
    }
    try {
      const id = activeRecord.meta.id;
      const doc =
        latestDoc.current && latestDoc.current.id === id
          ? latestDoc.current.doc
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
    const actions: PaletteAction[] = [
      {
        id: "new-page",
        label: "New page",
        keywords: ["create", "add"],
        onRun: () => {
          void createPage(null);
        },
      },
    ];
    if (activeRecord) {
      actions.push(
        {
          id: "export-markdown",
          label: "Export page as Markdown",
          keywords: ["download", "md"],
          onRun: () => {
            void exportCurrentPageMarkdown();
          },
        },
        {
          id: "trash-page",
          label: "Move current page to trash",
          keywords: ["delete", "remove"],
          onRun: () => {
            void trashPage(activeRecord.meta.id);
          },
        },
      );
    }
    actions.push(
      {
        id: "export-bundle",
        label: "Export sync bundle",
        keywords: ["backup", "sync", "file"],
        onRun: () => {
          void exportBundle();
        },
      },
      {
        id: "import-bundle",
        label: "Import sync bundle",
        keywords: ["merge", "sync", "file"],
        onRun: () => {
          void importBundle();
        },
      },
    );
    return actions;
  }, [activeRecord, createPage, exportBundle, exportCurrentPageMarkdown, importBundle, trashPage]);

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
      />
      <div className="app__scroll">
        {!loading && pages.length === 0 ? (
          <EmptyWorkspace
            onCreate={() => {
              void createPage(null);
            }}
          />
        ) : null}
        {activeRecord ? (
          <PageView
            record={activeRecord}
            editorEpoch={editorEpoch}
            onDocChange={(doc) => {
              latestDoc.current = { id: activeRecord.meta.id, doc };
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
            onOpenPage={(id) => {
              void selectPage(id);
            }}
          />
        ) : null}
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
    </div>
  );
}
