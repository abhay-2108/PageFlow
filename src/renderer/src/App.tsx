import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "../../shared/brand";
import { childrenOf } from "../../shared/tree";
import type { PageMeta, PageRecord, TipTapDocument } from "../../shared/types";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { PageView } from "./PageView";
import { Sidebar } from "./components/Sidebar";
import { Toast, type ToastData } from "./components/Toast";
import { getApi } from "./lib/api";

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
      const first = childrenOf(nextPages, null)[0] ?? nextPages[0];
      if (first) {
        await openPage(first.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, openPage]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createPage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createPage]);

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
            onDocChange={(doc) => queueSave(activeRecord.meta.id, doc)}
            onTitleChange={(title) => queueRename(activeRecord.meta.id, title)}
            autoFocusEditor={focusPageId !== null && focusPageId === activeRecord.meta.id}
          />
        ) : null}
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
