import { useEffect, useMemo, useState } from "react";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  DEFAULT_STATUS_OPTIONS,
  PROPERTY_TYPE_LABELS,
  ROLLUP_OP_LABELS,
  SELECT_COLORS,
  STATUS_GROUP_LABELS,
  evaluateRollup,
  normalizeValue,
  valueToText,
} from "../../../shared/database";
import type { PropertyDef, PropertyType, PropertyValue, RollupOp, StatusGroup } from "../../../shared/database";
import {
  applyDatabaseView,
  defaultDatabaseConfig,
} from "../../../shared/database-view";
import type {
  DatabaseConfig,
  DatabaseView,
  FilterOperator,
  ViewLayout,
} from "../../../shared/database-view";
import { evaluateFormula, validateFormula } from "../../../shared/formula";
import { BRAND } from "../../../shared/brand";
import { isCoverId } from "../../../shared/covers";
import { childrenOf } from "../../../shared/tree";
import type { PageMeta } from "../../../shared/types";
import { getApi } from "../lib/api";
import { assetUrl } from "../lib/assetUrl";

const PROPERTY_TYPE_ORDER: PropertyType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "formula",
  "relation",
  "rollup",
  "created_time",
  "last_edited_time",
];

export type CalcOp =
  | "none"
  | "count_all"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "checked"
  | "unchecked"
  | "percent_checked";

export const CALC_LABELS: Record<CalcOp, string> = {
  none: "None",
  count_all: "Count all",
  count_values: "Count values",
  count_unique: "Count unique",
  count_empty: "Count empty",
  count_not_empty: "Count not empty",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  checked: "Checked",
  unchecked: "Unchecked",
  percent_checked: "Percent checked",
};

export function getAvailableCalculations(type: PropertyType): CalcOp[] {
  if (type === "checkbox") {
    return ["none", "count_all", "checked", "unchecked", "percent_checked"];
  }
  if (type === "number" || type === "formula") {
    return ["none", "count_all", "count_values", "count_empty", "sum", "avg", "min", "max"];
  }
  return ["none", "count_all", "count_values", "count_unique", "count_empty", "count_not_empty"];
}

export function computeColumnCalculation(op: CalcOp, def: PropertyDef, rows: PageMeta[]): string {
  if (op === "none") return "";
  const total = rows.length;
  if (op === "count_all") return `${total}`;

  const values = rows
    .map((r) => r.fields[def.id])
    .filter((v) => v !== null && v !== undefined && v !== "");
  const emptyCount = total - values.length;

  if (op === "count_values" || op === "count_not_empty") return `${values.length}`;
  if (op === "count_empty") return `${emptyCount}`;
  if (op === "count_unique") return `${new Set(values.map(String)).size}`;

  if (def.type === "checkbox") {
    const checkedCount = rows.filter((r) => Boolean(r.fields[def.id])).length;
    if (op === "checked") return `${checkedCount}`;
    if (op === "unchecked") return `${total - checkedCount}`;
    if (op === "percent_checked") return `${total === 0 ? 0 : Math.round((checkedCount / total) * 100)}%`;
  }

  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (op === "sum") {
    const sum = nums.reduce((acc, curr) => acc + curr, 0);
    return `${Math.round(sum * 100) / 100}`;
  }
  if (op === "avg") {
    if (nums.length === 0) return "0";
    const avg = nums.reduce((acc, curr) => acc + curr, 0) / nums.length;
    return `${Math.round(avg * 100) / 100}`;
  }
  if (op === "min") {
    return nums.length > 0 ? `${Math.min(...nums)}` : "-";
  }
  if (op === "max") {
    return nums.length > 0 ? `${Math.max(...nums)}` : "-";
  }

  return `${values.length}`;
}

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
  const [toolMenu, setToolMenu] = useState<"sort" | "filter" | "group" | null>(null);
  const [filterProp, setFilterProp] = useState("");
  const [filterOp, setFilterOp] = useState<FilterOperator>("contains");
  const [filterValue, setFilterValue] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [renamingView, setRenamingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [editingFormulaFor, setEditingFormulaFor] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState("");
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [editingRollupFor, setEditingRollupFor] = useState<string | null>(null);
  const [editingRelationFor, setEditingRelationFor] = useState<string | null>(null);
  const [columnCalcs, setColumnCalcs] = useState<Record<string, CalcOp>>({});
  const [activeCalcMenu, setActiveCalcMenu] = useState<string | null>(null);

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
  const fallbackView: DatabaseView = { id: "default", name: "Table", layout: "table", sorts: [], filters: [] };
  const matchedView = activeConfig.views.find((view) => view.id === activeConfig.activeViewId);
  const activeView: DatabaseView = matchedView ?? activeConfig.views[0] ?? fallbackView;
  const currentLayout: ViewLayout = activeView.layout ?? "table";

  const visibleRows = useMemo(
    () => applyDatabaseView(rows, properties, activeView),
    [rows, properties, activeView],
  );

  const groupProp = useMemo(() => {
    if (activeView.groupByPropId) {
      const found = properties.find((p) => p.id === activeView.groupByPropId);
      if (found && (found.type === "select" || found.type === "status")) {
        return found;
      }
    }
    return properties.find((p) => p.type === "status" || p.type === "select") ?? null;
  }, [activeView.groupByPropId, properties]);

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

  const addView = (layout: ViewLayout = "table") => {
    if (!hub) {
      return;
    }
    const id = crypto.randomUUID();
    const layoutLabel = layout === "gallery" ? "Gallery" : layout === "board" ? "Board" : "Table";
    const name = `${layoutLabel} ${activeConfig.views.length + 1}`;
    const next: DatabaseConfig = {
      views: [...activeConfig.views, { id, name, layout, sorts: [], filters: [] }],
      activeViewId: id,
    };
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const deleteView = () => {
    if (!hub || activeConfig.views.length <= 1) {
      return;
    }
    const remaining = activeConfig.views.filter((view) => view.id !== activeView.id);
    const nextActive = remaining[0]?.id ?? "";
    const next: DatabaseConfig = { views: remaining, activeViewId: nextActive };
    setViewMenuOpen(false);
    void api.pages
      .setDbConfig(hub.id, next)
      .then((meta) => setHub(meta))
      .catch(() => undefined);
  };

  const commitViewName = () => {
    setRenamingView(false);
    const trimmed = viewName.trim();
    if (trimmed.length === 0 || trimmed === activeView.name) {
      return;
    }
    updateView({ ...activeView, name: trimmed });
  };

  const toggleLayout = (layout: ViewLayout) => {
    updateView({ ...activeView, layout });
  };

  const toggleSort = (propId: string) => {
    const existing = activeView.sorts.find((sort) => sort.propId === propId);
    let nextSorts = activeView.sorts.filter((sort) => sort.propId !== propId);
    if (!existing) {
      nextSorts = [...nextSorts, { propId, dir: "asc" }];
    } else if (existing.dir === "asc") {
      nextSorts = [...nextSorts, { propId, dir: "desc" }];
    }
    updateView({ ...activeView, sorts: nextSorts });
  };

  const addFilter = () => {
    if (!filterProp) {
      return;
    }
    const filter = { propId: filterProp, op: filterOp, value: filterValue.trim() };
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
      // Field edits are best effort; cell keeps state for retry
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
      // Keep previous schema on failure
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

  const createRow = async (initialFields?: Record<string, PropertyValue>) => {
    try {
      const created = await api.pages.create({ parentId });
      if (initialFields) {
        for (const [propId, val] of Object.entries(initialFields)) {
          const propDef = properties.find((p) => p.id === propId);
          if (propDef) {
            await api.pages.setField(created.id, propId, val);
          }
        }
      }
      const listed = await api.pages.list();
      setHub(listed.find((page) => page.id === parentId) ?? null);
      setRows(childrenOf(listed, parentId));
    } catch {
      // Row creation retriable
    }
  };

  const stop = (event: ReactMouseEvent) => event.stopPropagation();

  const toggleSelect = (page: PageMeta, def: PropertyDef, option: string) => {
    if (def.type === "select" || def.type === "status") {
      const current = normalizeValue(def.type, page.fields[def.id] ?? null);
      void commitField(page.id, def, current === option ? "" : option);
      setCellMenu(null);
      return;
    }
    const current = (normalizeValue("multi_select", page.fields[def.id] ?? null) as string[]) ?? [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    void commitField(page.id, def, next);
    setCellMenu(null);
  };

  const createOption = (page: PageMeta, def: PropertyDef, option: string, group?: StatusGroup) => {
    const trimmed = option.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (!def.options.includes(trimmed)) {
      const nextStatusGroups = def.statusGroups ? { ...def.statusGroups, [trimmed]: group ?? "todo" } : undefined;
      void commitProperties(
        properties.map((entry) =>
          entry.id === def.id
            ? {
                ...entry,
                options: [...entry.options, trimmed],
                ...(nextStatusGroups ? { statusGroups: nextStatusGroups } : {}),
              }
            : entry,
        ),
      );
    }
    toggleSelect(page, def, trimmed);
  };

  const saveFormula = () => {
    if (!editingFormulaFor) {
      return;
    }
    const def = properties.find((p) => p.id === editingFormulaFor);
    if (!def) {
      return;
    }
    const trimmed = formulaDraft.trim();
    void commitProperties(
      properties.map((entry) => (entry.id === def.id ? { ...entry, formula: trimmed } : entry)),
    );
    setEditingFormulaFor(null);
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

    if (def.type === "formula") {
      let computed: PropertyValue = null;
      let error: string | null = null;
      if (def.formula) {
        try {
          computed = evaluateFormula(def.formula, page, properties);
        } catch (err) {
          error = err instanceof Error ? err.message : "Error";
        }
      }
      return (
        <span
          className={def.formula ? "pg-db-formula-val" : "pg-db-formula-empty"}
          title={def.formula ?? "Click to set formula"}
          onMouseDown={stop}
          onClick={() => {
            setEditingFormulaFor(def.id);
            setFormulaDraft(def.formula ?? "");
            setFormulaError(null);
          }}
        >
          {error ? (
            <span className="pg-formula-modal__error">#ERR!</span>
          ) : def.formula ? (
            valueToText("formula", computed)
          ) : (
            "f(x) Empty"
          )}
        </span>
      );
    }

    if (def.type === "rollup") {
      const computed = evaluateRollup(def, page, properties, pages);
      const isConfigured = Boolean(def.relationPropId && def.rollupPropId);
      return (
        <span
          className={isConfigured ? "pg-db-formula-val" : "pg-db-formula-empty"}
          title={
            isConfigured
              ? `${def.rollupOp ?? "count"} of ${def.rollupPropId}`
              : "Click to configure rollup"
          }
          onMouseDown={stop}
          onClick={() => setEditingRollupFor(def.id)}
        >
          {isConfigured ? (
            <span>
              <span style={{ opacity: 0.65, marginRight: "4px" }}>∑</span>
              {valueToText("rollup", computed)}
            </span>
          ) : (
            "∑ Empty"
          )}
        </span>
      );
    }

    if (def.type === "relation") {
      const linkedIds = (normalizeValue("relation", value) as string[]) ?? [];
      const isOpen = cellMenu && cellMenu.pageId === page.id && cellMenu.propId === def.id;
      const targetCandidates = def.relationHubId
        ? pages.filter((p) => p.parentId === def.relationHubId && p.id !== page.id)
        : pages.filter((p) => p.id !== page.id);

      return (
        <span className="pg-db-chip-wrap" onMouseDown={stop}>
          <div className="pg-relation-cell">
            {linkedIds.map((id) => {
              const target = pages.find((p) => p.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  className="pg-relation-chip"
                  title="Open page"
                  onClick={(e) => {
                    stop(e);
                    onOpenPage(id);
                  }}
                >
                  {target?.icon ? <span className="pg-relation-chip__icon">{target.icon}</span> : null}
                  <span className="pg-relation-chip__title">
                    {target?.title || BRAND.empty.untitled}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="pg-relation-add-btn"
              aria-label={`Link page in ${def.name}`}
              onClick={() => {
                setCellQuery("");
                setCellMenu(isOpen ? null : { pageId: page.id, propId: def.id });
              }}
            >
              +
            </button>
          </div>
          {isOpen ? (
            <div className="menu-popover pg-db-menu" role="menu">
              <input
                className="menu-popover__search"
                type="text"
                placeholder="Search pages to link…"
                aria-label="Link page search"
                autoFocus
                spellCheck={false}
                value={cellQuery}
                onChange={(event) => setCellQuery(event.target.value)}
              />
              <div className="menu-popover__list">
                {targetCandidates
                  .filter((p) =>
                    (p.title || BRAND.empty.untitled)
                      .toLowerCase()
                      .includes(cellQuery.trim().toLowerCase()),
                  )
                  .map((candidate) => {
                    const isLinked = linkedIds.includes(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        role="menuitem"
                        className={isLinked ? "menu-popover__item--selected" : ""}
                        onClick={() => {
                          const next = isLinked
                            ? linkedIds.filter((id) => id !== candidate.id)
                            : [...linkedIds, candidate.id];
                          void commitField(page.id, def, next);
                        }}
                      >
                        {candidate.icon ? <span>{candidate.icon} </span> : null}
                        <span>{candidate.title || BRAND.empty.untitled}</span>
                        {isLinked ? <span className="pg-check-mark"> ✓</span> : null}
                      </button>
                    );
                  })}
                {targetCandidates.length === 0 ? (
                  <p className="menu-popover__empty">No pages available to link</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </span>
      );
    }

    if (def.type === "created_time") {
      return <span className="pg-db-timestamp">{new Date(page.createdAt).toLocaleDateString()}</span>;
    }

    if (def.type === "last_edited_time") {
      return <span className="pg-db-timestamp">{timeAgo(page.updatedAt)}</span>;
    }

    if (def.type === "url") {
      const urlText = (normalizeValue("url", value) as string) ?? "";
      return (
        <div className="pg-db-link-cell" onMouseDown={stop}>
          <input
            type="url"
            className="pg-db-input"
            placeholder="https://…"
            defaultValue={urlText}
            onBlur={(event) => void commitField(page.id, def, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          {urlText ? (
            <a
              href={urlText.startsWith("http") ? urlText : `https://${urlText}`}
              target="_blank"
              rel="noreferrer"
              className="pg-db-link-action"
              title="Open URL in browser"
              onClick={stop}
            >
              🔗
            </a>
          ) : null}
        </div>
      );
    }

    if (def.type === "email") {
      const emailText = (normalizeValue("email", value) as string) ?? "";
      return (
        <div className="pg-db-link-cell" onMouseDown={stop}>
          <input
            type="email"
            className="pg-db-input"
            placeholder="user@example.com"
            defaultValue={emailText}
            onBlur={(event) => void commitField(page.id, def, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          {emailText ? (
            <a
              href={`mailto:${emailText}`}
              className="pg-db-link-action"
              title="Send email"
              onClick={stop}
            >
              ✉️
            </a>
          ) : null}
        </div>
      );
    }

    if (def.type === "phone") {
      const phoneText = (normalizeValue("phone", value) as string) ?? "";
      return (
        <div className="pg-db-link-cell" onMouseDown={stop}>
          <input
            type="tel"
            className="pg-db-input"
            placeholder="+1 555-0100"
            defaultValue={phoneText}
            onBlur={(event) => void commitField(page.id, def, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          {phoneText ? (
            <a
              href={`tel:${phoneText}`}
              className="pg-db-link-action"
              title="Call phone"
              onClick={stop}
            >
              📞
            </a>
          ) : null}
        </div>
      );
    }

    if (def.type === "select" || def.type === "multi_select" || def.type === "status") {
      const selected = normalizeValue(def.type, value);
      const isMulti = def.type === "multi_select";
      const multiItems = Array.isArray(selected) ? (selected as string[]) : [];
      const singleItem = typeof selected === "string" ? selected : undefined;
      const dotColor = singleItem ? def.optionColors?.[singleItem] : undefined;
      const options =
        cellMenu && cellMenu.pageId === page.id && cellMenu.propId === def.id
          ? def.options
          : null;

      return (
        <span className="pg-db-chip-wrap" onMouseDown={stop}>
          {isMulti && multiItems.length > 0 ? (
            <div
              className="pg-db-chips-list"
              onClick={() => {
                setCellQuery("");
                setCellMenu(
                  cellMenu && cellMenu.pageId === page.id && cellMenu.propId === def.id
                    ? null
                    : { pageId: page.id, propId: def.id },
                );
              }}
            >
              {multiItems.map((item) => {
                const color = def.optionColors?.[item];
                return (
                  <span key={item} className="pg-db-chip" data-color={color ?? undefined}>
                    {color ? <span className={`pg-db-dot pg-db-dot--${color}`} /> : null}
                    {item}
                  </span>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              className={
                (singleItem && singleItem.length > 0) || (isMulti && multiItems.length > 0)
                  ? "pg-db-chip"
                  : "pg-db-chip pg-db-chip--empty"
              }
              data-color={dotColor ?? undefined}
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
              {singleItem && singleItem.length > 0 ? singleItem : "Empty"}
            </button>
          )}
          {options ? (
            <div className="menu-popover pg-db-menu" role="menu">
              <input
                className="menu-popover__search"
                type="text"
                placeholder={def.type === "status" ? "Find or create status" : "Find or create option"}
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
                {def.type === "status" ? (
                  (["todo", "in_progress", "complete"] as StatusGroup[]).map((group) => {
                    const groupOptions = def.options.filter(
                      (opt) => (def.statusGroups?.[opt] ?? "todo") === group,
                    );
                    if (groupOptions.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="pg-db-status-header">{STATUS_GROUP_LABELS[group]}</div>
                        {groupOptions
                          .filter((opt) => opt.toLowerCase().includes(cellQuery.trim().toLowerCase()))
                          .map((opt) => {
                            const optColor = def.optionColors?.[opt];
                            return (
                              <button
                                key={opt}
                                type="button"
                                role="menuitem"
                                onClick={() => toggleSelect(page, def, opt)}
                              >
                                {optColor ? <span className={`pg-db-dot pg-db-dot--${optColor}`} /> : null}
                                {opt}
                              </button>
                            );
                          })}
                      </div>
                    );
                  })
                ) : (
                  def.options
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
                    })
                )}
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
            {def.type === "formula" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPropMenu(null);
                  setEditingFormulaFor(def.id);
                  setFormulaDraft(def.formula ?? "");
                  setFormulaError(null);
                }}
              >
                Edit formula
              </button>
            ) : null}
            {def.type === "rollup" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPropMenu(null);
                  setEditingRollupFor(def.id);
                }}
              >
                Configure rollup
              </button>
            ) : null}
            {def.type === "relation" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPropMenu(null);
                  setEditingRelationFor(def.id);
                }}
              >
                Configure relation
              </button>
            ) : null}
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
            {def.type === "select" || def.type === "multi_select" || def.type === "status" ? (
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
    const id = crypto.randomUUID();
    let options: string[] = [];
    let optionColors: Record<string, string> | undefined;
    let statusGroups: Record<string, StatusGroup> | undefined;
    let formula: string | undefined;

    if (type === "status") {
      options = DEFAULT_STATUS_OPTIONS.map((o) => o.name);
      optionColors = {
        "Not started": "gray",
        "In progress": "blue",
        Done: "green",
      };
      statusGroups = {
        "Not started": "todo",
        "In progress": "in_progress",
        Done: "complete",
      };
    } else if (type === "formula") {
      formula = 'prop("Name")';
    }

    const firstRel = properties.find((p) => p.type === "relation");
    const def: PropertyDef = {
      id,
      name: PROPERTY_TYPE_LABELS[type],
      type,
      options,
      ...(optionColors ? { optionColors } : {}),
      ...(statusGroups ? { statusGroups } : {}),
      ...(formula ? { formula } : {}),
      ...(type === "rollup" ? { relationPropId: firstRel?.id, rollupOp: "count" } : {}),
    };
    void commitProperties([...properties, def]);
    if (type === "formula") {
      setEditingFormulaFor(id);
      setFormulaDraft(formula ?? "");
      setFormulaError(null);
    } else if (type === "rollup") {
      setEditingRollupFor(id);
    } else if (type === "relation") {
      setEditingRelationFor(id);
    }
  };

  const handleCardDragStart = (event: ReactDragEvent, pageId: string) => {
    event.dataTransfer.setData("text/plain", pageId);
  };

  const handleColumnDrop = (event: ReactDragEvent, targetValue: string) => {
    event.preventDefault();
    if (!groupProp) {
      return;
    }
    const pageId = event.dataTransfer.getData("text/plain");
    if (pageId) {
      void commitField(pageId, groupProp, targetValue);
    }
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
                  {view.name} (
                  {view.layout === "gallery" ? "Gallery" : view.layout === "board" ? "Board" : "Table"})
                </option>
              ))}
            </select>
            <div className="page__view-toggle" role="group" aria-label="Layout toggle">
              <button
                type="button"
                className={
                  currentLayout === "table"
                    ? "page__view-btn page__view-btn--active"
                    : "page__view-btn"
                }
                aria-pressed={currentLayout === "table"}
                onClick={() => toggleLayout("table")}
              >
                Table
              </button>
              <button
                type="button"
                className={
                  currentLayout === "board"
                    ? "page__view-btn page__view-btn--active"
                    : "page__view-btn"
                }
                aria-pressed={currentLayout === "board"}
                onClick={() => toggleLayout("board")}
              >
                Board
              </button>
              <button
                type="button"
                className={
                  currentLayout === "gallery"
                    ? "page__view-btn page__view-btn--active"
                    : "page__view-btn"
                }
                aria-pressed={currentLayout === "gallery"}
                onClick={() => toggleLayout("gallery")}
              >
                Gallery
              </button>
            </div>
            <button
              type="button"
              className="pg-db-tool"
              aria-label="Add view"
              onMouseDown={stop}
              onClick={() => addView(currentLayout)}
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
        {currentLayout === "board" ? (
          <button
            type="button"
            className="pg-db-tool"
            aria-expanded={toolMenu === "group"}
            onMouseDown={stop}
            onClick={() => setToolMenu(toolMenu === "group" ? null : "group")}
          >
            Group: {groupProp ? groupProp.name : "None"}
          </button>
        ) : null}
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
        {toolMenu === "group" ? (
          <div className="menu-popover pg-db-tool-menu" role="menu" onMouseDown={stop}>
            {properties
              .filter((p) => p.type === "status" || p.type === "select")
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    updateView({ ...activeView, groupByPropId: p.id });
                    setToolMenu(null);
                  }}
                >
                  {p.name} {p.id === groupProp?.id ? "✓" : ""}
                </button>
              ))}
            {properties.filter((p) => p.type === "status" || p.type === "select").length === 0 ? (
              <p className="menu-popover__empty">No Select or Status property available</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {currentLayout === "board" ? (
        groupProp ? (
          <div className="pg-board-container" aria-label="Kanban board">
            {groupProp.options.concat([""]).map((colOption) => {
              const isUnassigned = colOption === "";
              const colLabel = isUnassigned ? "No " + groupProp.name : colOption;
              const colCards = visibleRows.filter((r) => {
                const val = r.fields[groupProp.id];
                if (isUnassigned) {
                  return !val || (Array.isArray(val) && val.length === 0);
                }
                return val === colOption;
              });
              const optionColor = isUnassigned ? undefined : groupProp.optionColors?.[colOption];

              return (
                <div
                  key={colOption || "__empty__"}
                  className="pg-board-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleColumnDrop(event, colOption)}
                >
                  <div className="pg-board-column-header">
                    <span className="pg-board-column-title">
                      {optionColor ? <span className={`pg-db-dot pg-db-dot--${optionColor}`} /> : null}
                      {colLabel}
                    </span>
                    <span className="pg-board-column-count">{colCards.length}</span>
                  </div>
                  <div className="pg-board-cards">
                    {colCards.map((card) => (
                      <div
                        key={card.id}
                        className="pg-board-card"
                        draggable
                        onDragStart={(event) => handleCardDragStart(event, card.id)}
                        onClick={() => onOpenPage(card.id)}
                      >
                        <div className="pg-board-card-title">
                          {card.icon ? <span>{card.icon}</span> : null}
                          <span>{rowLabel(card)}</span>
                        </div>
                        <div className="pg-board-card-props">
                          {properties
                            .filter((p) => p.id !== groupProp.id && card.fields[p.id])
                            .slice(0, 3)
                            .map((p) => (
                              <span key={p.id} className="pg-board-card-prop">
                                {p.name}: {valueToText(p.type, card.fields[p.id] ?? null)}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="pg-board-add-card"
                    onClick={() =>
                      void createRow(isUnassigned ? undefined : { [groupProp.id]: colOption })
                    }
                  >
                    + New card
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pg-db-hint" style={{ padding: "32px 16px", textAlign: "center" }}>
            <p>Board view requires a Status or Select property to group columns.</p>
            <button
              type="button"
              className="pg-btn pg-btn--primary"
              style={{ marginTop: "12px" }}
              onClick={() => addProperty("status")}
            >
              + Add Status Property
            </button>
          </div>
        )
      ) : currentLayout === "gallery" ? (
        <div className="pg-gallery-container" aria-label="Gallery view">
          <div className="pg-gallery-grid">
            {visibleRows.map((card) => {
              const hasCover = Boolean(card.cover);
              return (
                <div
                  key={card.id}
                  className="pg-gallery-card"
                  onClick={() => onOpenPage(card.id)}
                >
                  <div
                    className={
                      hasCover && isCoverId(card.cover!)
                        ? `pg-gallery-card__cover cover--${card.cover}`
                        : "pg-gallery-card__cover"
                    }
                  >
                    {hasCover && !isCoverId(card.cover!) ? (
                      <img
                        className="pg-gallery-card__cover-img"
                        src={assetUrl(card.cover!)}
                        alt=""
                        draggable={false}
                      />
                    ) : !hasCover ? (
                      <div className="pg-gallery-card__cover-placeholder">
                        {card.icon ? (
                          <span className="pg-gallery-card__cover-icon">{card.icon}</span>
                        ) : (
                          "📄"
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="pg-gallery-card__body">
                    <div className="pg-gallery-card__title">
                      {card.icon ? (
                        <span className="pg-gallery-card__icon">{card.icon}</span>
                      ) : null}
                      <span>{rowLabel(card)}</span>
                    </div>
                    <div className="pg-gallery-card__props">
                      {properties
                        .filter(
                          (p) =>
                            card.fields[p.id] !== null &&
                            card.fields[p.id] !== undefined &&
                            card.fields[p.id] !== "",
                        )
                        .slice(0, 3)
                        .map((p) => {
                          const val = card.fields[p.id];
                          return (
                            <div key={p.id} className="pg-gallery-card__prop-row">
                              <span className="pg-gallery-card__prop-name">{p.name}:</span>
                              <span className="pg-gallery-card__prop-val">
                                {p.type === "relation" && Array.isArray(val)
                                  ? val
                                      .map(
                                        (id) =>
                                          pages.find((pg) => pg.id === id)?.title ||
                                          BRAND.empty.untitled,
                                      )
                                      .join(", ")
                                  : p.type === "formula" && p.formula
                                    ? valueToText("formula", evaluateFormula(p.formula, card, properties))
                                    : p.type === "rollup"
                                      ? valueToText("rollup", evaluateRollup(p, card, properties, pages))
                                      : valueToText(p.type, val ?? null)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="pg-gallery-card pg-gallery-card--new"
              onClick={() => void createRow()}
            >
              <span className="pg-gallery-card__new-icon">+</span>
              <span>New card</span>
            </button>
          </div>
        </div>
      ) : (
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
          <tfoot className="pg-db-tfoot">
            <tr className="pg-db-tfoot-row">
              <td className="pg-db-calc-cell">
                <span className="pg-db-calc-label">Count {visibleRows.length}</span>
              </td>
              {properties.map((def) => {
                const currentOp = columnCalcs[def.id] ?? "none";
                const result =
                  currentOp !== "none"
                    ? computeColumnCalculation(currentOp, def, visibleRows)
                    : null;
                const isMenuOpen = activeCalcMenu === def.id;

                return (
                  <td key={def.id} className="pg-db-calc-cell" onMouseDown={stop}>
                    <button
                      type="button"
                      className={
                        currentOp !== "none"
                          ? "pg-db-calc-btn pg-db-calc-btn--active"
                          : "pg-db-calc-btn"
                      }
                      onClick={() => setActiveCalcMenu(isMenuOpen ? null : def.id)}
                    >
                      {currentOp !== "none" ? `${CALC_LABELS[currentOp]}: ${result}` : "Calculate"}
                    </button>
                    {isMenuOpen ? (
                      <div className="menu-popover pg-db-calc-menu" role="menu">
                        {getAvailableCalculations(def.type).map((op) => (
                          <button
                            key={op}
                            type="button"
                            role="menuitem"
                            className={currentOp === op ? "menu-popover__active" : ""}
                            onClick={() => {
                              setColumnCalcs((prev) => ({ ...prev, [def.id]: op }));
                              setActiveCalcMenu(null);
                            }}
                          >
                            {CALC_LABELS[op]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </td>
                );
              })}
              <td className="pg-db-calc-cell" />
              <td className="pg-db-calc-cell" />
            </tr>
          </tfoot>
        </table>
      )}

      {editingFormulaFor ? (
        <div className="pg-modal-backdrop" onMouseDown={() => setEditingFormulaFor(null)}>
          <div className="pg-formula-modal" onMouseDown={stop}>
            <div className="pg-formula-modal__header">
              <h3 className="pg-formula-modal__title">Edit Formula</h3>
              <button
                type="button"
                className="ghost-btn ghost-btn--small"
                onClick={() => setEditingFormulaFor(null)}
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              className="pg-formula-modal__input"
              placeholder='e.g. prop("Price") * prop("Quantity")'
              value={formulaDraft}
              autoFocus
              onChange={(event) => {
                const next = event.target.value;
                setFormulaDraft(next);
                setFormulaError(validateFormula(next));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !formulaError && formulaDraft.trim().length > 0) {
                  saveFormula();
                }
              }}
            />
            {formulaError ? (
              <p className="pg-formula-modal__error">{formulaError}</p>
            ) : (
              <p className="pg-board-column-count" style={{ display: "inline-block" }}>
                ✓ Valid expression
              </p>
            )}
            <div className="pg-formula-modal__chips">
              <span className="pg-db-status-header">Insert Property:</span>
              {properties
                .filter((p) => p.id !== editingFormulaFor)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="pg-formula-modal__chip"
                    onClick={() => {
                      const snippet = `prop("${p.name}")`;
                      const next = formulaDraft ? `${formulaDraft} + ${snippet}` : snippet;
                      setFormulaDraft(next);
                      setFormulaError(validateFormula(next));
                    }}
                  >
                    prop("{p.name}")
                  </button>
                ))}
              <span className="pg-db-status-header" style={{ width: "100%", marginTop: "4px" }}>
                Functions:
              </span>
              {[
                'if(condition, "Yes", "No")',
                'concat("Prefix: ", prop("Name"))',
                "round(val, 2)",
                "sum(1, 2, 3)",
                "avg(a, b)",
                'upper(prop("Name"))',
                'len(prop("Name"))',
              ].map((fn) => (
                <button
                  key={fn}
                  type="button"
                  className="pg-formula-modal__chip"
                  onClick={() => {
                    const next = formulaDraft ? `${formulaDraft} ${fn}` : fn;
                    setFormulaDraft(next);
                    setFormulaError(validateFormula(next));
                  }}
                >
                  {fn.split("(")[0]}()
                </button>
              ))}
            </div>
            <div className="pg-formula-modal__actions">
              <button
                type="button"
                className="ghost-btn ghost-btn--small"
                onClick={() => setEditingFormulaFor(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pg-btn pg-btn--primary"
                disabled={Boolean(formulaError) || formulaDraft.trim().length === 0}
                onClick={saveFormula}
              >
                Save Formula
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingRollupFor ? (
        <div className="pg-modal-backdrop" onMouseDown={() => setEditingRollupFor(null)}>
          <div className="pg-formula-modal" onMouseDown={stop}>
            <div className="pg-formula-modal__header">
              <h3 className="pg-formula-modal__title">Configure Rollup</h3>
              <button
                type="button"
                className="ghost-btn ghost-btn--small"
                onClick={() => setEditingRollupFor(null)}
              >
                ✕
              </button>
            </div>
            {(() => {
              const def = properties.find((p) => p.id === editingRollupFor);
              if (!def) return null;
              const relationProps = properties.filter((p) => p.type === "relation");
              const relProp = properties.find((p) => p.id === def.relationPropId);
              const targetHub = relProp?.relationHubId
                ? pages.find((p) => p.id === relProp.relationHubId)
                : null;
              const availableTargetProps =
                targetHub?.properties ?? properties.filter((p) => p.id !== def.id);

              return (
                <div className="pg-rollup-form">
                  <div className="pg-rollup-field">
                    <div className="pg-db-status-header">1. Relation Property</div>
                    <select
                      className="pg-db-select"
                      style={{ width: "100%", marginTop: "4px" }}
                      value={def.relationPropId ?? ""}
                      onChange={(e) => {
                        const nextRelId = e.target.value;
                        void commitProperties(
                          properties.map((p) =>
                            p.id === def.id ? { ...p, relationPropId: nextRelId } : p,
                          ),
                        );
                      }}
                    >
                      <option value="">Choose a relation…</option>
                      {relationProps.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {relationProps.length === 0 ? (
                      <p className="menu-popover__empty" style={{ marginTop: "4px" }}>
                        Add a Relation property first to use rollups.
                      </p>
                    ) : null}
                  </div>

                  <div className="pg-rollup-field" style={{ marginTop: "12px" }}>
                    <div className="pg-db-status-header">2. Property to Calculate</div>
                    <select
                      className="pg-db-select"
                      style={{ width: "100%", marginTop: "4px" }}
                      value={def.rollupPropId ?? ""}
                      onChange={(e) => {
                        const nextTargetId = e.target.value;
                        void commitProperties(
                          properties.map((p) =>
                            p.id === def.id ? { ...p, rollupPropId: nextTargetId } : p,
                          ),
                        );
                      }}
                    >
                      <option value="">Choose property…</option>
                      <option value="title">Name (Page Title)</option>
                      {availableTargetProps.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {tp.name} ({PROPERTY_TYPE_LABELS[tp.type]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-rollup-field" style={{ marginTop: "12px" }}>
                    <div className="pg-db-status-header">3. Calculation</div>
                    <select
                      className="pg-db-select"
                      style={{ width: "100%", marginTop: "4px" }}
                      value={def.rollupOp ?? "count"}
                      onChange={(e) => {
                        const nextOp = e.target.value as RollupOp;
                        void commitProperties(
                          properties.map((p) => (p.id === def.id ? { ...p, rollupOp: nextOp } : p)),
                        );
                      }}
                    >
                      {Object.entries(ROLLUP_OP_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pg-formula-modal__actions" style={{ marginTop: "18px" }}>
                    <button
                      type="button"
                      className="pg-btn pg-btn--primary"
                      onClick={() => setEditingRollupFor(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {editingRelationFor ? (
        <div className="pg-modal-backdrop" onMouseDown={() => setEditingRelationFor(null)}>
          <div className="pg-formula-modal" onMouseDown={stop}>
            <div className="pg-formula-modal__header">
              <h3 className="pg-formula-modal__title">Configure Relation</h3>
              <button
                type="button"
                className="ghost-btn ghost-btn--small"
                onClick={() => setEditingRelationFor(null)}
              >
                ✕
              </button>
            </div>
            {(() => {
              const def = properties.find((p) => p.id === editingRelationFor);
              if (!def) return null;
              const possibleDatabases = pages.filter(
                (p) => p.view === "table" || (p.properties && p.properties.length > 0),
              );

              return (
                <div className="pg-rollup-form">
                  <div className="pg-rollup-field">
                    <div className="pg-db-status-header">Related Database / Scope</div>
                    <select
                      className="pg-db-select"
                      style={{ width: "100%", marginTop: "4px" }}
                      value={def.relationHubId ?? ""}
                      onChange={(e) => {
                        const nextHub = e.target.value || undefined;
                        void commitProperties(
                          properties.map((p) =>
                            p.id === def.id ? { ...p, relationHubId: nextHub } : p,
                          ),
                        );
                      }}
                    >
                      <option value="">Any page in workspace</option>
                      {possibleDatabases.map((db) => (
                        <option key={db.id} value={db.id}>
                          {db.icon ? `${db.icon} ` : ""}
                          {db.title || BRAND.empty.untitled}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pg-formula-modal__actions" style={{ marginTop: "18px" }}>
                    <button
                      type="button"
                      className="pg-btn pg-btn--primary"
                      onClick={() => setEditingRelationFor(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
