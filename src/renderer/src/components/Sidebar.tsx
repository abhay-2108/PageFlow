import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { BRAND, searchNoResults } from "../../../shared/brand";
import { isDescendant } from "../../../shared/tree";
import type { PageMeta, SearchHit } from "../../../shared/types";
import { getApi } from "../lib/api";
import { SessionPanel } from "./SessionPanel";

interface MenuState {
  id: string;
  x: number;
  y: number;
}

type DropZone = "before" | "after" | "into";

interface DropHint {
  id: string;
  zone: DropZone;
}

function zoneFromEvent(event: ReactDragEvent<HTMLElement>): DropZone {
  const rect = event.currentTarget.getBoundingClientRect();
  const edge = Math.min(12, rect.height * 0.3);
  if (event.clientY <= rect.top + edge) {
    return "before";
  }
  if (event.clientY >= rect.bottom - edge) {
    return "after";
  }
  return "into";
}

interface TreeRowProps {
  page: PageMeta;
  depth: number;
  childrenMap: Map<string | null, PageMeta[]>;
  activeId: string | null;
  expanded: Set<string>;
  editingId: string | null;
  dragId: string | null;
  dropHint: DropHint | null;
  dragging: boolean;
  onToggleExpanded: (id: string) => void;
  onSelect: (id: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onCreateChild: (parentId: string) => void;
  onOpenMenu: (event: ReactMouseEvent, id: string) => void;
  onDragStartRow: (id: string) => void;
  onDragEndRow: () => void;
  onDragOverRow: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  onDropRow: (event: ReactDragEvent<HTMLElement>, id: string) => void;
}

const TreeRow = memo(function TreeRow(props: TreeRowProps) {
  const {
    page,
    depth,
    childrenMap,
    activeId,
    expanded,
    editingId,
    dragId,
    dropHint,
    dragging,
    onToggleExpanded,
    onSelect,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onCreateChild,
    onOpenMenu,
    onDragStartRow,
    onDragEndRow,
    onDragOverRow,
    onDropRow,
  } = props;

  const children = childrenMap.get(page.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(page.id);
  const isActive = page.id === activeId;
  const isEditing = editingId === page.id;
  const isDragged = dragId === page.id;
  const hint = dropHint && dropHint.id === page.id ? dropHint.zone : null;
  const label = page.title.length > 0 ? page.title : BRAND.empty.untitled;

  const classNames = ["tree-row"];
  if (isActive) {
    classNames.push("tree-row--active");
  }
  if (isDragged) {
    classNames.push("tree-row--dragging");
  }
  if (hint === "before") {
    classNames.push("tree-row--drop-before");
  } else if (hint === "after") {
    classNames.push("tree-row--drop-after");
  } else if (hint === "into") {
    classNames.push("tree-row--drop-into");
  }

  return (
    <li className="tree-item">
      <div
        className={classNames.join(" ")}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        data-page-row={page.id}
        draggable={!isEditing}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", page.id);
          event.dataTransfer.effectAllowed = "move";
          onDragStartRow(page.id);
        }}
        onDragEnd={onDragEndRow}
        onDragOver={(event) => onDragOverRow(event, page.id)}
        onDrop={(event) => onDropRow(event, page.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            className={isExpanded ? "tree-row__chevron tree-row__chevron--open" : "tree-row__chevron"}
            aria-label={isExpanded ? "Collapse subpages" : "Expand subpages"}
            aria-expanded={isExpanded}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(page.id);
            }}
          />
        ) : (
          <span className="tree-row__chevron tree-row__chevron--empty" aria-hidden="true" />
        )}
        {isEditing ? (
          <RenameInput
            initialValue={page.title}
            onCommit={(title) => onCommitRename(page.id, title)}
            onCancel={onCancelRename}
          />
        ) : (
          <button
            type="button"
            className="tree-row__title"
            title={label}
            onClick={() => onSelect(page.id)}
            onDoubleClick={() => onStartRename(page.id)}
            onContextMenu={(event) => onOpenMenu(event, page.id)}
          >
            {page.icon ? (
              <span className="tree-row__icon" aria-hidden="true">
                {page.icon}
              </span>
            ) : null}
            <span className="tree-row__label">{label}</span>
          </button>
        )}
        {!isEditing && !dragging ? (
          <span className="tree-row__actions">
            <button
              type="button"
              className="icon-btn"
              aria-label="New subpage"
              title="New subpage"
              onClick={(event) => {
                event.stopPropagation();
                onCreateChild(page.id);
              }}
            >
              +
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="More options"
              title="More options"
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu(event, page.id);
              }}
            >
              …
            </button>
          </span>
        ) : null}
      </div>
    </li>
  );
});

function RenameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const committed = useRef(false);

  return (
    <input
      className="rename-input"
      value={value}
      autoFocus
      aria-label="Page name"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (!committed.current) {
          committed.current = true;
          onCommit(value.trim());
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          committed.current = true;
          onCommit(value.trim());
        } else if (event.key === "Escape") {
          committed.current = true;
          onCancel();
        }
      }}
    />
  );
}

export interface SidebarProps {
  pages: PageMeta[];
  trash: PageMeta[];
  activeId: string | null;
  workspaceDir: string | null;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onMove: (id: string, parentId: string | null, beforeId: string | null) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onDuplicate: (id: string) => void;
  onOpenSearch?: () => void;
  onToggleAi?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const {
    pages,
    trash,
    activeId,
    workspaceDir,
    expanded,
    onToggleExpanded,
    onSelect,
    onCreate,
    onRename,
    onTrash,
    onRestore,
    onMove,
    onFavorite,
    onDuplicate,
    onOpenSearch,
    onToggleAi,
  } = props;

  const api = getApi();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [moveQuery, setMoveQuery] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [rootHint, setRootHint] = useState(false);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, PageMeta[]>();
    for (const page of pages) {
      const bucket = map.get(page.parentId) ?? [];
      bucket.push(page);
      map.set(page.parentId, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.rank - b.rank);
    }
    return map;
  }, [pages]);

  const visibleNodes = useMemo(() => {
    const result: Array<{ page: PageMeta; depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        result.push({ page: child, depth });
        if (expanded.has(child.id)) {
          walk(child.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return result;
  }, [childrenMap, expanded]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setHits(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.search.query(trimmed).then((results) => {
        if (!cancelled) {
          setHits(results);
        }
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, query]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const openMenu = (event: ReactMouseEvent, id: string) => {
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth - 240);
    const y = Math.min(event.clientY, window.innerHeight - 340);
    setMoveMode(false);
    setMoveQuery("");
    setMenu({ id, x, y });
  };

  const isValidDrop = (draggedId: string, target: PageMeta, zone: DropZone): boolean => {
    if (target.id === draggedId) {
      return false;
    }
    if (zone === "into") {
      return !isDescendant(pages, draggedId, target.id);
    }
    const parent = target.parentId;
    if (parent === null) {
      return true;
    }
    return parent !== draggedId && !isDescendant(pages, draggedId, parent);
  };

  const clearDrag = () => {
    setDragId(null);
    setDropHint(null);
    setRootHint(false);
  };

  const handleDragStartRow = (id: string) => {
    setDragId(id);
    setDropHint(null);
  };

  const handleDragOverRow = (event: ReactDragEvent<HTMLElement>, targetId: string) => {
    if (!dragId || dragId === targetId) {
      return;
    }
    const target = pages.find((page) => page.id === targetId);
    if (!target) {
      return;
    }
    const zone = zoneFromEvent(event);
    if (!isValidDrop(dragId, target, zone)) {
      setDropHint(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setRootHint(false);
    setDropHint({ id: targetId, zone });
  };

  const handleDropRow = (event: ReactDragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const dragged = dragId ?? event.dataTransfer.getData("text/plain");
    const target = pages.find((page) => page.id === targetId);
    const zone = zoneFromEvent(event);
    clearDrag();
    if (!dragged || !target || !isValidDrop(dragged, target, zone)) {
      return;
    }
    if (zone === "into") {
      onMove(dragged, target.id, null);
      return;
    }
    const parentId = target.parentId;
    if (zone === "before") {
      onMove(dragged, parentId, target.id);
      return;
    }
    const siblings = (childrenMap.get(parentId) ?? []).filter((sibling) => sibling.id !== dragged);
    const index = siblings.findIndex((sibling) => sibling.id === target.id);
    const next = index >= 0 ? (siblings[index + 1] ?? null) : null;
    onMove(dragged, parentId, next ? next.id : null);
  };

  const handleDragOverRoot = (event: ReactDragEvent<HTMLElement>) => {
    if (!dragId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropHint(null);
    setRootHint(true);
  };

  const handleDropRoot = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    const dragged = dragId ?? event.dataTransfer.getData("text/plain");
    clearDrag();
    if (dragged) {
      onMove(dragged, null, null);
    }
  };

  const rootPages = childrenMap.get(null) ?? [];
  const favorites = useMemo(
    () =>
      pages
        .filter((page) => page.favorite)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [pages],
  );
  const menuPage = menu ? pages.find((page) => page.id === menu.id) ?? null : null;
  const menuLabel =
    menuPage === null ? undefined : menuPage.title.trim().length === 0 ? BRAND.empty.untitled : menuPage.title;
  const moveTargets = useMemo(() => {
    if (!menu) {
      return [];
    }
    const needle = moveQuery.trim().toLowerCase();
    return pages
      .filter((page) => page.id !== menu.id && !isDescendant(pages, menu.id, page.id))
      .filter((page) => {
        if (needle.length === 0) {
          return true;
        }
        const label = page.title.trim().length === 0 ? BRAND.empty.untitled : page.title;
        return label.toLowerCase().includes(needle);
      });
  }, [menu, moveQuery, pages]);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__workspace-card">
          <div className="sidebar__workspace-avatar">N</div>
          <div className="sidebar__workspace-details">
            <span className="sidebar__workspace-title">{BRAND.name}</span>
            <span className="sidebar__workspace-sub">Local Workspace</span>
          </div>
        </div>
      </div>

      <div className="sidebar__quick-nav">
        {onOpenSearch ? (
          <button
            type="button"
            className="sidebar__nav-item"
            onClick={onOpenSearch}
            title="Quick Find (Ctrl+P / Ctrl+K)"
          >
            <span className="sidebar__nav-icon">🔍</span>
            <span className="sidebar__nav-label">Search</span>
            <span className="sidebar__nav-shortcut">Ctrl+P</span>
          </button>
        ) : null}
        {onToggleAi ? (
          <button
            type="button"
            className="sidebar__nav-item"
            onClick={onToggleAi}
            title="Ask PageFlow AI (Ctrl+Shift+J)"
          >
            <span className="sidebar__nav-icon" style={{ color: "#a855f7" }}>✦</span>
            <span className="sidebar__nav-label">PageFlow AI</span>
            <span className="sidebar__nav-shortcut">Ctrl+Shift+J</span>
          </button>
        ) : null}
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={() => onCreate(null)}
          title="New Page (Ctrl+N)"
        >
          <span className="sidebar__nav-icon">➕</span>
          <span className="sidebar__nav-label">New page</span>
          <span className="sidebar__nav-shortcut">Ctrl+N</span>
        </button>
      </div>

      <div className="sidebar__divider" />

      <div className="sidebar__search">
        <input
          type="search"
          placeholder="Filter tree..."
          aria-label="Filter tree"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
            }
          }}
          spellCheck={false}
        />
      </div>

      {hits !== null ? (
        <div className="sidebar__scroll">
          {hits.length === 0 ? (
            <p className="search-empty">{searchNoResults(query.trim())}</p>
          ) : (
            <ul className="search-list">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="search-hit"
                    onClick={() => {
                      onSelect(hit.id);
                      setQuery("");
                    }}
                  >
                    <span className="search-hit__title">
                      {hit.title.length > 0 ? hit.title : BRAND.empty.untitled}
                    </span>
                    <span className="search-hit__path">{hit.path.join(" / ")}</span>
                    {hit.snippet.length > 0 ? (
                      <span className="search-hit__snippet">{hit.snippet}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="sidebar__new">
            <button type="button" className="ghost-btn" onClick={() => onCreate(null)}>
              <span className="ghost-btn__plus" aria-hidden="true">
                +
              </span>
              New page
            </button>
          </div>
          <div className="sidebar__scroll">
            {favorites.length > 0 ? (
              <section className="sidebar__favorites" aria-label="Favorites">
                <button
                  type="button"
                  className="section-toggle"
                  aria-expanded={favoritesOpen}
                  onClick={() => setFavoritesOpen((open) => !open)}
                >
                  Favorites
                </button>
                {favoritesOpen ? (
                  <ul className="favorite-list">
                    {favorites.map((page) => (
                      <li key={page.id}>
                        <button
                          type="button"
                          className={
                            page.id === activeId ? "favorite-row favorite-row--active" : "favorite-row"
                          }
                          onClick={() => onSelect(page.id)}
                        >
                          {page.icon ? (
                            <span className="tree-row__icon" aria-hidden="true">
                              {page.icon}
                            </span>
                          ) : (
                            <span className="favorite-row__star" aria-hidden="true">
                              ★
                            </span>
                          )}
                          <span className="favorite-row__label">
                            {page.title.length > 0 ? page.title : BRAND.empty.untitled}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
            {visibleNodes.length > 0 ? (
              <ul className="tree">
                {visibleNodes.map(({ page, depth }) => (
                  <TreeRow
                    key={page.id}
                    page={page}
                    depth={depth}
                    childrenMap={childrenMap}
                    activeId={activeId}
                    expanded={expanded}
                    editingId={editingId}
                    dragId={dragId}
                    dropHint={dropHint}
                    dragging={dragId !== null}
                    onToggleExpanded={onToggleExpanded}
                    onSelect={onSelect}
                    onStartRename={setEditingId}
                    onCommitRename={(id, title) => {
                      setEditingId(null);
                      onRename(id, title);
                    }}
                    onCancelRename={() => setEditingId(null)}
                    onCreateChild={(parentId) => onCreate(parentId)}
                    onOpenMenu={openMenu}
                    onDragStartRow={handleDragStartRow}
                    onDragEndRow={clearDrag}
                    onDragOverRow={handleDragOverRow}
                    onDropRow={handleDropRow}
                  />
                ))}
              </ul>
            ) : null}
            {dragId !== null ? (
              <div
                className={rootHint ? "tree-dropzone tree-dropzone--active" : "tree-dropzone"}
                data-drop-root="true"
                onDragOver={handleDragOverRoot}
                onDrop={handleDropRoot}
              >
                Move to top level
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="sidebar__trash">
        <button
          type="button"
          className="trash-toggle"
          aria-expanded={trashOpen}
          onClick={() => setTrashOpen((open) => !open)}
        >
          Trash{trash.length > 0 ? ` (${trash.length})` : ""}
        </button>
        {trashOpen ? (
          trash.length === 0 ? (
            <p className="trash-empty">{BRAND.empty.trash}</p>
          ) : (
            <ul className="trash-list">
              {trash.map((page) => (
                <li key={page.id} className="trash-row">
                  <span className="trash-row__title">
                    {page.title.length > 0 ? page.title : BRAND.empty.untitled}
                  </span>
                  <button type="button" className="ghost-btn ghost-btn--small" onClick={() => onRestore(page.id)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      <div className="sidebar__session">
        <SessionPanel />
      </div>

      <div className="sidebar__footer" title={workspaceDir ?? undefined}>
        {workspaceDir ?? "Workspace"}
      </div>

      {menu ? (
        <div
          className="menu-popover"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {moveMode ? (
            <>
              <div className="menu-popover__header">
                <button
                  type="button"
                  className="menu-popover__back"
                  aria-label="Back"
                  onClick={() => {
                    setMoveMode(false);
                    setMoveQuery("");
                  }}
                >
                  ←
                </button>
                <span>Move to</span>
              </div>
              <input
                className="menu-popover__search"
                type="text"
                placeholder="Find a page"
                aria-label="Move to page"
                value={moveQuery}
                autoFocus
                spellCheck={false}
                onChange={(event) => setMoveQuery(event.target.value)}
              />
              <div className="menu-popover__list">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    onMove(menu.id, null, null);
                  }}
                >
                  Top level
                </button>
                {moveTargets.length === 0 ? (
                  <p className="menu-popover__empty">{searchNoResults(moveQuery.trim())}</p>
                ) : (
                  moveTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(null);
                        onMove(menu.id, target.id, null);
                      }}
                    >
                      {target.icon ? <span aria-hidden="true">{target.icon} </span> : null}
                      {target.title.length > 0 ? target.title : BRAND.empty.untitled}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  setEditingId(menu.id);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onDuplicate(menu.id);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onFavorite(menu.id, !(menuPage?.favorite ?? false));
                }}
              >
                {menuPage?.favorite ? "Remove from Favorites" : "Add to Favorites"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setMoveMode(true)}
              >
                Move to…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onCreate(menu.id);
                }}
              >
                New subpage
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-popover__danger"
                onClick={() => {
                  setMenu(null);
                  onTrash(menu.id);
                }}
              >
                Move to trash
              </button>
              <div className="menu-popover__meta">{menuLabel}</div>
            </>
          )}
        </div>
      ) : null}
    </aside>
  );
}
