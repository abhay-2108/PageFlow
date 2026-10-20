import { normalizeValue, valueToText } from "./database";
import type { PropertyDef, PropertyValue } from "./database";
import type { PageMeta } from "./types";

export interface DatabaseSort {
  propId: string;
  dir: "asc" | "desc";
}

export type FilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty";

export interface DatabaseFilter {
  propId: string;
  op: FilterOperator;
  value: string;
}

export type ViewLayout = "table" | "board" | "gallery" | "calendar";

export interface DatabaseView {
  id: string;
  name: string;
  layout?: ViewLayout;
  groupByPropId?: string;
  sorts: DatabaseSort[];
  filters: DatabaseFilter[];
}

export interface DatabaseConfig {
  views: DatabaseView[];
  activeViewId: string;
}

export function defaultDatabaseConfig(): DatabaseConfig {
  return {
    views: [{ id: "default", name: "Table", layout: "table", sorts: [], filters: [] }],
    activeViewId: "default",
  };
}

const FILTER_OPERATORS: readonly FilterOperator[] = [
  "is",
  "is_not",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
];

function isSort(value: unknown): value is DatabaseSort {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.propId === "string" &&
    record.propId.length > 0 &&
    (record.dir === "asc" || record.dir === "desc")
  );
}

function isFilter(value: unknown): value is DatabaseFilter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.propId === "string" &&
    record.propId.length > 0 &&
    typeof record.op === "string" &&
    (FILTER_OPERATORS as readonly string[]).includes(record.op) &&
    typeof record.value === "string"
  );
}

function isView(value: unknown): value is DatabaseView {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const validLayout =
    record.layout === undefined ||
    record.layout === "table" ||
    record.layout === "board" ||
    record.layout === "gallery" ||
    record.layout === "calendar";
  const validGroupBy =
    record.groupByPropId === undefined || typeof record.groupByPropId === "string";

  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    validLayout &&
    validGroupBy &&
    Array.isArray(record.sorts) &&
    record.sorts.every(isSort) &&
    Array.isArray(record.filters) &&
    record.filters.every(isFilter)
  );
}

export function parseDatabaseConfig(
  raw: string | null | undefined,
): DatabaseConfig | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { views?: unknown }).views)
    ) {
      return undefined;
    }
    const views = (parsed as { views: unknown[] }).views.filter(isView).map((view) => ({
      id: view.id,
      name: view.name,
      layout: view.layout ?? "table",
      ...(view.groupByPropId ? { groupByPropId: view.groupByPropId } : {}),
      sorts: view.sorts.map((sort) => ({ propId: sort.propId, dir: sort.dir })),
      filters: view.filters.map((filter) => ({
        propId: filter.propId,
        op: filter.op,
        value: filter.value,
      })),
    }));
    if (views.length === 0) {
      return undefined;
    }
    const requested = (parsed as { activeViewId?: unknown }).activeViewId;
    const first = views[0];
    const activeViewId =
      typeof requested === "string" && views.some((view) => view.id === requested)
        ? requested
        : first
          ? first.id
          : "";
    return { views, activeViewId };
  } catch {
    return undefined;
  }
}

function getRawValue(def: PropertyDef | undefined, row: PageMeta, propId: string): PropertyValue {
  if (!def) {
    return null;
  }
  if (def.type === "created_time") {
    return row.createdAt;
  }
  if (def.type === "last_edited_time") {
    return row.updatedAt;
  }
  return normalizeValue(def.type, row.fields[propId] ?? null);
}

function cellIsEmpty(def: PropertyDef | undefined, row: PageMeta, propId: string): boolean {
  if (!def) {
    return true;
  }
  const value = getRawValue(def, row, propId);
  if (value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}

function cellText(def: PropertyDef | undefined, row: PageMeta, propId: string): string {
  if (!def) {
    return "";
  }
  return valueToText(def.type, getRawValue(def, row, propId));
}

function matchesFilter(
  row: PageMeta,
  def: PropertyDef | undefined,
  filter: DatabaseFilter,
): boolean {
  const text = cellText(def, row, filter.propId).toLowerCase();
  const wanted = filter.value.toLowerCase();
  switch (filter.op) {
    case "is":
      return text === wanted;
    case "is_not":
      return text !== wanted;
    case "contains":
      return text.includes(wanted);
    case "not_contains":
      return !text.includes(wanted);
    case "is_empty":
      return cellIsEmpty(def, row, filter.propId);
    case "is_not_empty":
      return !cellIsEmpty(def, row, filter.propId);
  }
}

function compareValues(
  def: PropertyDef | undefined,
  a: PageMeta,
  b: PageMeta,
  propId: string,
): number {
  const av = def ? getRawValue(def, a, propId) : null;
  const bv = def ? getRawValue(def, b, propId) : null;
  if (typeof av === "number" && typeof bv === "number") {
    return av - bv;
  }
  if (typeof av === "boolean" && typeof bv === "boolean") {
    return (av ? 1 : 0) - (bv ? 1 : 0);
  }
  return String(av ?? "").localeCompare(String(bv ?? ""));
}

export function applyDatabaseView(
  rows: PageMeta[],
  properties: PropertyDef[],
  view: DatabaseView,
): PageMeta[] {
  const defs = new Map(properties.map((def) => [def.id, def]));
  const filtered = rows.filter((row) =>
    view.filters.every((filter) => matchesFilter(row, defs.get(filter.propId), filter)),
  );
  return [...filtered].sort((a, b) => {
    for (const sort of view.sorts) {
      const def = defs.get(sort.propId);
      const aEmpty = cellIsEmpty(def, a, sort.propId);
      const bEmpty = cellIsEmpty(def, b, sort.propId);
      if (aEmpty !== bEmpty) {
        return aEmpty ? 1 : -1;
      }
      const cmp = compareValues(def, a, b, sort.propId);
      if (cmp !== 0) {
        return sort.dir === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });
}
