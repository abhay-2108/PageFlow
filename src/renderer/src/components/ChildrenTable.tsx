import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  PROPERTY_TYPE_LABELS,
  normalizeValue,
  valueToText,
} from "../../../shared/database";
import type { PropertyDef, PropertyType } from "../../../shared/database";
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
  refreshKey: number;
  onOpenPage: (id: string) => void;
}

interface CellMenuState {
  pageId: string;
  propId: string;
}

export function ChildrenTable({ parentId, refreshKey, onOpenPage }: ChildrenTableProps) {
  const api = getApi();
  const [rows, setRows] = useState<PageMeta[]>([]);
  const [hub, setHub] = useState<PageMeta | null>(null);
  const [cellMenu, setCellMenu] = useState<CellMenuState | null>(null);
  const [cellQuery, setCellQuery] = useState("");
  const [propMenu, setPropMenu] = useState<string | null>(null);
  const [renamingProp, setRenamingProp] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.pages
      .list()
      .then((pages) => {
        if (!cancelled) {
          setHub(pages.find((page) => page.id === parentId) ?? null);
          setRows(childrenOf(pages, parentId));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, parentId, refreshKey]);

  const properties = useMemo(() => hub?.properties ?? [], [hub]);

  useEffect(() => {
    if (!cellMenu && !propMenu && !addMenuOpen) {
      return;
    }
    const close = () => {
      setCellMenu(null);
      setPropMenu(null);
      setAddMenuOpen(false);
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
  }, [addMenuOpen, cellMenu, propMenu]);

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
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitem"
                      onClick={() => toggleSelect(page, def, option)}
                    >
                      {option}
                    </button>
                  ))}
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
          onClick={() => setPropMenu(propMenu === def.id ? null : def.id)}
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

  if (rows.length === 0 && properties.length === 0) {
    return <p className="pg-children-table__empty">No pages inside yet.</p>;
  }

  return (
    <div className="pg-children-table-wrap">
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
          {rows.map((page) => (
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
                <td key={def.id} className="pg-db-cell">
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
