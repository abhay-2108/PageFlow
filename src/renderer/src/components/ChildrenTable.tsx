import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  PROPERTY_TYPE_LABELS,
  SELECT_COLORS,
  normalizeValue,
  valueToText,
} from "../../../shared/database";
import type { PropertyDef, PropertyType } from "../../../shared/database";
import {
  applyDatabaseView,
  defaultDatabaseConfig,
} from "../../../shared/database-view";
import type {
  DatabaseConfig,
  DatabaseView,
  FilterOperator,
} from "../../../shared/database-view";
import { BRAND } from "../../../shared/brand";
import { childrenOf } from "../../../shared/tree";
import type { PageMeta } from "../../../shared/types";
import { getApi } from "../lib/api";

const PROPERTY_TYPE_ORDER: PropertyType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
];

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export interface ChildrenTableProps {
  parentId: string;
  pages: PageMeta[];
  refreshKey: number;
  onOpenPage: (id: string) => void;
}

interface CellMenuState {
  pageId: string;
  propId: string;
}

export function ChildrenTable({ parentId, pages, refreshKey, onOpenPage }: ChildrenTableProps) {
  const api = getApi();
  const [rows, setRows] = useState<PageMeta[]>([]);
  const [hub, setHub] = useState<PageMeta | null>(null);
  const [cellMenu, setCellMenu] = useState<CellMenuState | null>(null);
  const [cellQuery, setCellQuery] = useState("");
  const [propMenu, setPropMenu] = useState<string | null>(null);
  const [renamingProp, setRenamingProp] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [typeMenuFor, setTypeMenuFor] = useState<string | null>(null);
  const [colorMenuFor, setColorMenuFor] = useState<string | null>(null);
  const [colorOptionFor, setColorOptionFor] = useState<string | null>(null);
  const [toolMenu, setToolMenu] = useState<"sort" | "filter" | null>(null);
  const [filterProp, setFilterProp] = useState("");
  const [filterOp, setFilterOp] = useState<FilterOperator>("contains");
  const [filterValue, setFilterValue] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [renamingView, setRenamingView] = useState(false);
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void api.pages
      .list()
      .then((listed) => {
        if (!cancelled) {
          setHub(listed.find((page) => page.id === parentId) ?? null);
          setRows(childrenOf(listed, parentId));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, parentId, refreshKey, pages]);

  const properties = useMemo(() => hub?.properties ?? [], [hub]);

  const activeConfig = useMemo(() => hub?.dbConfig ?? defaultDatabaseConfig(), [hub]);
  const fallbackView: DatabaseView = { id: "default", name: "Table", sorts: [], filters: [] };
  const matchedView = activeConfig.views.find((view) => view.id === activeConfig.activeViewId);
  const activeView: DatabaseView = matchedView ?? activeConfig.views[0] ?? fallbackView;
  const visibleRows = useMemo(
    () => applyDatabaseView(rows, properties, activeView),
    [rows, properties, activeView],
  );

  const updateView = (view: DatabaseView) => {
    if (!hub) {
      return;
    }
    const next: DatabaseConfig = {
      ...activeConfig,
      views: activeConfig.views.map((entry) => (entry.id === view.id ? view : entry)),
    };
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const switchView = (id: string) => {
    if (!hub || id === activeView.id) {
      return;
    }
    const next: DatabaseConfig = { ...activeConfig, activeViewId: id };
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const addView = () => {
    if (!hub) {
      return;
    }
    const id = crypto.randomUUID();
    const name = `View ${activeConfig.views.length + 1}`;
    const next: DatabaseConfig = {
      views: [...activeConfig.views, { id, name, sorts: [], filters: [] }],
      activeViewId: id,
    };
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const commitViewName = () => {
    const trimmed = viewName.trim();
    setRenamingView(false);
    if (!hub || trimmed.length === 0 || trimmed === activeView.name) {
      return;
    }
    updateView({ ...activeView, name: trimmed });
  };

  const deleteView = () => {
    if (!hub || activeConfig.views.length <= 1) {
      return;
    }
    const remaining = activeConfig.views.filter((view) => view.id !== activeView.id);
    const next: DatabaseConfig = {
      views: remaining,
      activeViewId: remaining[0]?.id ?? activeView.id,
    };
    setViewMenuOpen(false);
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const toggleSort = (propId: string) => {
    const existing = activeView.sorts.find((sort) => sort.propId === propId);
    let sorts: DatabaseView["sorts"];
    if (!existing) {
      sorts = [...activeView.sorts, { propId, dir: "asc" }];
    } else if (existing.dir === "asc") {
      sorts = activeView.sorts.map((sort) =>
        sort.propId === propId ? { ...sort, dir: "desc" } : sort,
      );
    } else {
      sorts = activeView.sorts.filter((sort) => sort.propId !== propId);
    }
    updateView({ ...activeView, sorts });
  };

  const addFilter = () => {
    if (!filterProp) {
      return;
    }
    const filter = { propId: filterProp, op: filterOp, value: filterValue };
    if (
      activeView.filters.some(
        (entry) =>
          entry.propId === filter.propId && entry.op === filter.op && entry.value === filter.value,
      )
    ) {
      return;
    }
    updateView({ ...activeView, filters: [...activeView.filters, filter] });
    setFilterValue("");
  };

  const removeFilter = (index: number) => {
    updateView({
      ...activeView,
      filters: activeView.filters.filter((_filter, i) => i !== index),
    });
  };

  useEffect(() => {
    if (
      !cellMenu &&
      !propMenu &&
      !addMenuOpen &&
      !typeMenuFor &&
      !colorMenuFor &&
      !toolMenu &&
      !viewMenuOpen
    ) {
      return;
    }
    const close = () => {
      setCellMenu(null);
      setPropMenu(null);
      setAddMenuOpen(false);
      setTypeMenuFor(null);
      setColorMenuFor(null);
      setColorOptionFor(null);
      setToolMenu(null);
      setViewMenuOpen(false);
      setRenamingView(false);
      setFilterProp("");
      setFilterOp("contains");
      setFilterValue("");
      setCellQuery("");
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
  }, [addMenuOpen, cellMenu, colorMenuFor, propMenu, toolMenu, typeMenuFor, viewMenuOpen]);

  const rowLabel = (page: PageMeta) =>
    page.title.trim().length > 0 ? page.title : BRAND.empty.untitled;

  const setRowMeta = (meta: PageMeta) => {
    setRows((prev) => prev.map((page) => (page.id === meta.id ? meta : page)));
  };

  const commitField = async (pageId: string, def: PropertyDef, raw: unknown) => {
    const value = normalizeValue(def.type, raw);
    try {
      const meta = await api.pages.setField(pageId, def.id, value);
      setRowMeta(meta);
    } catch {
      // Field edits are best effort; the cell keeps its text for a retry.
    }
  };

  const commitProperties = async (next: PropertyDef[]) => {
    if (!hub) {
      return;
    }
    try {
      const meta = await api.pages.setProperties(hub.id, next);
      setHub(meta);
    } catch {
      // Keep the previous schema on failure.
    }
  };

  const setOptionColor = (def: PropertyDef, option: string, color: string | null) => {
    const next = { ...(def.optionColors ?? {}) };
    if (color === null) {
      delete next[option];
    } else {
      next[option] = color;
    }
    void commitProperties(
      properties.map((entry) => (entry.id === def.id ? { ...entry, optionColors: next } : entry)),
    );
  };

  const createRow = async () => {
    try {
      await api.pages.create({ parentId });
      const pages = await api.pages.list();
      setHub(pages.find((page) => page.id === parentId) ?? null);
      setRows(childrenOf(pages, parentId));
    } catch {
      // Row creation is retriable from the footer button.
    }
  };

  const stop = (event: ReactMouseEvent) => event.stopPropagation();

  const toggleSelect = (page: PageMeta, def: PropertyDef, option: string) => {
    if (def.type === "select") {
      const current = normalizeValue("select", page.fields[def.id] ?? null);
      void commitField(page.id, def, current === option ? "" : option);
      setCellMenu(null);
      return;
    }
    const current = normalizeValue("multi_select", page.fields[def.id] ?? null) as string[];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    void commitField(page.id, def, next);
    setCellMenu(null);
  };

  const createOption = (page: PageMeta, def: PropertyDef, option: string) => {
    const trimmed = option.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (!def.options.includes(trimmed)) {
      void commitProperties(
        properties.map((entry) =>
          entry.id === def.id ? { ...entry, options: [...entry.options, trimmed] } : entry,
        ),
      );
    }
    toggleSelect(page, def, trimmed);
  };

  const cellEditor = (page: PageMeta, def: PropertyDef) => {
    const value = page.fields[def.id] ?? null;
    if (def.type === "checkbox") {
      return (
        <button
          type="button"
          className={value === true ? "pg-db-check pg-db-check--on" : "pg-db-check"}
          aria-pressed={value === true}
          aria-label={`Toggle ${def.name}`}
          onMouseDown={stop}
          onClick={() => void commitField(page.id, def, value !== true)}
        >
          {value === true ? "✓" : ""}
        </button>
      );
    }
    if (def.type === "select" || def.type === "multi_select") {
      const text =
        def.type === "select"
          ? valueToText("select", normalizeValue("select", value))
          : (normalizeValue("multi_select", value) as string[]).join(", ");
      const selected = normalizeValue(def.type, value);
      const selectedOption =
        typeof selected === "string"
          ? selected
          : Array.isArray(selected) && typeof selected[0] === "string"
            ? selected[0]
            : undefined;
      const dotColor = selectedOption ? def.optionColors?.[selectedOption] : undefined;
      const options =
        cellMenu && cellMenu.pageId === page.id && cellMenu.propId === def.id
          ? def.options
          : null;
      return (
        <span className="pg-db-chip-wrap" onMouseDown={stop}>
          <button
            type="button"
            className={text.length > 0 ? "pg-db-chip" : "pg-db-chip pg-db-chip--empty"}
            aria-label={`${def.name} value`}
            onClick={() => {
              setCellQuery("");
              setCellMenu(
                cellMenu && cellMenu.pageId === page.id && cellMenu.propId === def.id
                  ? null
                  : { pageId: page.id, propId: def.id },
              );
            }}
          >
            {dotColor ? <span className={`pg-db-dot pg-db-dot--${dotColor}`} /> : null}
            {text.length > 0 ? text : "Empty"}
          </button>
          {options ? (
            <div className="menu-popover pg-db-menu" role="menu">
              <input
                className="menu-popover__search"
                type="text"
                placeholder="Find or create option"
                aria-label="Option search"
                autoFocus
                spellCheck={false}
                value={cellQuery}
                onChange={(event) => setCellQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && cellQuery.trim().length > 0) {
                    createOption(page, def, cellQuery);
                    setCellQuery("");
                  }
                }}
              />
              <div className="menu-popover__list">
                {def.options
                  .filter((option) =>
                    option.toLowerCase().includes(cellQuery.trim().toLowerCase()),
                  )
                  .map((option) => {
                    const optionColor = def.optionColors?.[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        role="menuitem"
                        onClick={() => toggleSelect(page, def, option)}
                      >
                        {optionColor ? (
                          <span className={`pg-db-dot pg-db-dot--${optionColor}`} />
                        ) : null}
                        {option}
                      </button>
                    );
                  })}
                {cellQuery.trim().length > 0 &&
                !def.options.some(
                  (option) => option.toLowerCase() === cellQuery.trim().toLowerCase(),
                ) ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      createOption(page, def, cellQuery);
                      setCellQuery("");
                    }}
                  >
                    {`Create "${cellQuery.trim()}"`}
                  </button>
                ) : null}
                {def.options.length === 0 && cellQuery.trim().length === 0 ? (
                  <p className="menu-popover__empty">Type to create an option</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </span>
      );
    }
    if (def.type === "date") {
      const current = normalizeValue("date", value);
      return (
        <input
          type="date"
          className="pg-db-date"
          aria-label={def.name}
          defaultValue={typeof current === "string" ? current : ""}
          onBlur={(event) => void commitField(page.id, def, event.target.value)}
        />
      );
    }
    const text = valueToText(def.type, value);
    return (
      <input
        type="text"
        className="pg-db-input"
        aria-label={def.name}
        inputMode={def.type === "number" ? "decimal" : undefined}
        defaultValue={text}
        onBlur={(event) => void commitField(page.id, def, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  };

  const headerMenu = (def: PropertyDef) => {
    if (renamingProp === def.id) {
      return (
        <input
          className="pg-db-rename"
          value={renameValue}
          autoFocus
          aria-label="Property name"
          onMouseDown={stop}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={() => {
            setRenamingProp(null);
            const trimmed = renameValue.trim();
            if (trimmed.length > 0 && trimmed !== def.name) {
              void commitProperties(
                properties.map((entry) => (entry.id === def.id ? { ...entry, name: trimmed } : entry)),
              );
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
      );
    }
    return (
      <span className="pg-db-header-wrap" onMouseDown={stop}>
        <button
          type="button"
          className="pg-db-header-btn"
          aria-label={`${def.name} property options`}
          onClick={() => {
            setPropMenu(propMenu === def.id ? null : def.id);
            setTypeMenuFor(null);
            setColorMenuFor(null);
            setColorOptionFor(null);
          }}
        >
          {def.name}
        </button>
        {propMenu === def.id ? (
          <div className="menu-popover pg-db-header-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPropMenu(null);
                setRenameValue(def.name);
                setRenamingProp(def.id);
              }}
            >
              Rename
            </button>
            {typeMenuFor === def.id ? (
              <div className="pg-db-submenu" role="menu">
                {PROPERTY_TYPE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    disabled={type === def.type}
                    onClick={() => {
                      setTypeMenuFor(null);
                      setPropMenu(null);
                      void commitProperties(
                        properties.map((entry) => (entry.id === def.id ? { ...entry, type } : entry)),
                      );
                    }}
                  >
                    {PROPERTY_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setTypeMenuFor(def.id);
                  setColorMenuFor(null);
                  setColorOptionFor(null);
                }}
              >
                Change type
              </button>
            )}
            {def.type === "select" || def.type === "multi_select" ? (
              colorMenuFor === def.id ? (
                <div className="pg-db-submenu" role="menu">
                  {def.options.length === 0 ? (
                    <p className="menu-popover__empty">Add options in a cell first</p>
                  ) : null}
                  {def.options.map((option) => {
                    const optionColor = def.optionColors?.[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        role="menuitem"
                        onClick={() => setColorOptionFor(colorOptionFor === option ? null : option)}
                      >
                        <span
                          className={
                            optionColor
                              ? `pg-db-dot pg-db-dot--${optionColor}`
                              : "pg-db-dot pg-db-dot--none"
                          }
                        />
                        {option}
                      </button>
                    );
                  })}
                  {colorOptionFor ? (
                    <div className="pg-db-colors" role="menu">
                      {SELECT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="menuitem"
                          aria-label={color}
                          className={`pg-db-swatch pg-db-swatch--${color}`}
                          onClick={() => setOptionColor(def, colorOptionFor, color)}
                        />
                      ))}
                      <button
                        type="button"
                        role="menuitem"
                        aria-label="Clear color"
                        className="pg-db-swatch pg-db-swatch--none"
                        onClick={() => setOptionColor(def, colorOptionFor, null)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setColorMenuFor(def.id);
                    setTypeMenuFor(null);
                    setColorOptionFor(null);
                  }}
                >
                  Option colors
                </button>
              )
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="menu-popover__danger"
              onClick={() => {
                setPropMenu(null);
                void commitProperties(properties.filter((entry) => entry.id !== def.id));
              }}
            >
              Delete property
            </button>
          </div>
        ) : null}
      </span>
    );
  };

  const addProperty = (type: PropertyType) => {
    if (!hub) {
      return;
    }
    const def: PropertyDef = {
      id: crypto.randomUUID(),
      name: PROPERTY_TYPE_LABELS[type],
      type,
      options: [],
    };
    void commitProperties([...properties, def]);
  };

  return (
    <div className="pg-children-table-wrap">
      <div className="pg-db-toolbar">
        {renamingView ? (
          <input
            className="pg-db-rename"
            aria-label="View name"
            value={viewName}
            autoFocus
            onMouseDown={stop}
            onChange={(event) => setViewName(event.target.value)}
            onBlur={commitViewName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setRenamingView(false);
              }
            }}
          />
        ) : (
          <>
            <select
              className="pg-db-select pg-db-view-select"
              aria-label="Database view"
              value={activeView.id}
              onMouseDown={stop}
              onChange={(event) => switchView(event.target.value)}
            >
              {activeConfig.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pg-db-tool"
              aria-label="Add view"
              onMouseDown={stop}
              onClick={addView}
            >
              + View
            </button>
            <button
              type="button"
              className="pg-db-tool"
              aria-label="View options"
              aria-expanded={viewMenuOpen}
              onMouseDown={stop}
              onClick={() => setViewMenuOpen((open) => !open)}
            >
              …
            </button>
            {viewMenuOpen ? (
              <div className="menu-popover pg-db-tool-menu" role="menu" onMouseDown={stop}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setViewMenuOpen(false);
                    setViewName(activeView.name);
                    setRenamingView(true);
                  }}
                >
                  Rename view
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-popover__danger"
                  disabled={activeConfig.views.length <= 1}
                  onClick={deleteView}
                >
                  Delete view
                </button>
              </div>
            ) : null}
          </>
        )}
        <button
          type="button"
          className="pg-db-tool"
          aria-expanded={toolMenu === "sort"}
          onMouseDown={stop}
          onClick={() => setToolMenu(toolMenu === "sort" ? null : "sort")}
        >
          Sort{activeView.sorts.length > 0 ? ` (${activeView.sorts.length})` : ""}
        </button>
        <button
          type="button"
          className="pg-db-tool"
          aria-expanded={toolMenu === "filter"}
          onMouseDown={stop}
          onClick={() => setToolMenu(toolMenu === "filter" ? null : "filter")}
        >
          Filter{activeView.filters.length > 0 ? ` (${activeView.filters.length})` : ""}
        </button>
        {toolMenu === "sort" ? (
          <div className="menu-popover pg-db-tool-menu" role="menu" onMouseDown={stop}>
            {properties.length === 0 ? (
              <p className="menu-popover__empty">Add a property to sort by</p>
            ) : null}
            {properties.map((def) => {
              const sort = activeView.sorts.find((entry) => entry.propId === def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  role="menuitem"
                  onClick={() => toggleSort(def.id)}
                >
                  {def.name}
                  {sort ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              );
            })}
            {activeView.sorts.length > 0 ? (
              <button
                type="button"
                role="menuitem"
                className="menu-popover__danger"
                onClick={() => updateView({ ...activeView, sorts: [] })}
              >
                Clear sort
              </button>
            ) : null}
          </div>
        ) : null}
        {toolMenu === "filter" ? (
          <div className="menu-popover pg-db-tool-menu" role="menu" onMouseDown={stop}>
            {properties.length === 0 ? (
              <p className="menu-popover__empty">Add a property to filter by</p>
            ) : (
              <>
                <select
                  className="pg-db-select"
                  aria-label="Filter property"
                  value={filterProp}
                  onChange={(event) => setFilterProp(event.target.value)}
                >
                  <option value="">Property…</option>
                  {properties.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name}
                    </option>
                  ))}
                </select>
                <select
                  className="pg-db-select"
                  aria-label="Filter operator"
                  value={filterOp}
                  onChange={(event) => setFilterOp(event.target.value as FilterOperator)}
                >
                  <option value="contains">Contains</option>
                  <option value="not_contains">Does not contain</option>
                  <option value="is">Is</option>
                  <option value="is_not">Is not</option>
                  <option value="is_empty">Is empty</option>
                  <option value="is_not_empty">Is not empty</option>
                </select>
                <input
                  className="pg-db-input"
                  aria-label="Filter value"
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addFilter();
                    }
                  }}
                />
                <button type="button" role="menuitem" onClick={addFilter}>
                  Add filter
                </button>
              </>
            )}
            {activeView.filters.map((filter, index) => {
              const def = properties.find((entry) => entry.id === filter.propId);
              return (
                <button
                  key={`${filter.propId}-${filter.op}-${filter.value}-${index}`}
                  type="button"
                  role="menuitem"
                  className="menu-popover__danger"
                  onClick={() => removeFilter(index)}
                >
                  {`${def?.name ?? filter.propId} ${filter.op}${
                    filter.value ? ` "${filter.value}"` : ""
                  } ✕`}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <table className="pg-children-table" aria-label="Subpages">
        <thead>
          <tr>
            <th>Name</th>
            {properties.map((def) => (
              <th key={def.id} className="pg-db-th">
                {headerMenu(def)}
              </th>
            ))}
            <th>Updated</th>
            <th className="pg-db-th pg-db-th--add">
              <span className="pg-db-header-wrap" onMouseDown={stop}>
                <button
                  type="button"
                  className="pg-db-add-btn"
                  aria-label="Add property"
                  onClick={() => setAddMenuOpen((open) => !open)}
                >
                  +
                </button>
                {addMenuOpen ? (
                  <div className="menu-popover pg-db-header-menu" role="menu">
                    {PROPERTY_TYPE_ORDER.map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAddMenuOpen(false);
                          addProperty(type);
                        }}
                      >
                        {PROPERTY_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="pg-db-hint">
              <td colSpan={properties.length + 3}>No pages inside yet.</td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr className="pg-db-hint">
              <td colSpan={properties.length + 3}>No pages match the current filter.</td>
            </tr>
          ) : null}
          {visibleRows.map((page) => (
            <tr key={page.id} data-page-id={page.id} className="pg-db-row">
              <td>
                <button
                  type="button"
                  className="pg-children-table__open"
                  onClick={() => onOpenPage(page.id)}
                >
                  {page.icon ? <span className="pg-children-table__icon">{page.icon}</span> : null}
                  <span className="pg-children-table__title">{rowLabel(page)}</span>
                </button>
              </td>
              {properties.map((def) => (
                <td key={def.id} className="pg-db-cell" data-type={def.type}>
                  {cellEditor(page, def)}
                </td>
              ))}
              <td className="pg-children-table__updated">{timeAgo(page.updatedAt)}</td>
              <td />
            </tr>
          ))}
          <tr className="pg-db-newrow">
            <td colSpan={properties.length + 3}>
              <button type="button" className="pg-db-newrow-btn" onClick={() => void createRow()}>
                + New row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
