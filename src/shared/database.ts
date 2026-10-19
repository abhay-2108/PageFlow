export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "formula"
  | "relation"
  | "rollup"
  | "created_time"
  | "last_edited_time";

export const SELECT_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export type SelectColor = (typeof SELECT_COLORS)[number];

export function isSelectColor(value: string): value is SelectColor {
  return (SELECT_COLORS as readonly string[]).includes(value);
}

export type StatusGroup = "todo" | "in_progress" | "complete";

export interface StatusOption {
  id: string;
  name: string;
  color?: SelectColor;
  group: StatusGroup;
}

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  todo: "To-do",
  in_progress: "In progress",
  complete: "Complete",
};

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { id: "not_started", name: "Not started", color: "gray", group: "todo" },
  { id: "in_progress", name: "In progress", color: "blue", group: "in_progress" },
  { id: "done", name: "Done", color: "green", group: "complete" },
];

export type RollupOp = "count" | "sum" | "avg" | "min" | "max" | "show_original";

export const ROLLUP_OP_LABELS: Record<RollupOp, string> = {
  count: "Count all",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  show_original: "Show original",
};

export interface PropertyDef {
  id: string;
  name: string;
  type: PropertyType;
  options: string[];
  optionColors?: Record<string, string>;
  formula?: string;
  statusGroups?: Record<string, StatusGroup>;
  relationHubId?: string;
  relationPropId?: string;
  rollupPropId?: string;
  rollupOp?: RollupOp;
}

export type PropertyValue = string | number | boolean | string[] | null;

export type PropertyFields = Record<string, PropertyValue>;

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  status: "Status",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  email: "Email",
  phone: "Phone",
  formula: "Formula",
  relation: "Relation",
  rollup: "Rollup",
  created_time: "Created time",
  last_edited_time: "Last edited time",
};

export function isPropertyType(value: string): value is PropertyType {
  return value in PROPERTY_TYPE_LABELS;
}

function isPropertyDef(value: unknown): value is PropertyDef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const validStatusGroups =
    record.statusGroups === undefined ||
    (typeof record.statusGroups === "object" &&
      record.statusGroups !== null &&
      !Array.isArray(record.statusGroups) &&
      Object.values(record.statusGroups as Record<string, unknown>).every(
        (group) => group === "todo" || group === "in_progress" || group === "complete",
      ));

  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    typeof record.type === "string" &&
    isPropertyType(record.type) &&
    Array.isArray(record.options) &&
    record.options.every((option) => typeof option === "string") &&
    (record.formula === undefined || typeof record.formula === "string") &&
    (record.relationHubId === undefined || typeof record.relationHubId === "string") &&
    (record.relationPropId === undefined || typeof record.relationPropId === "string") &&
    (record.rollupPropId === undefined || typeof record.rollupPropId === "string") &&
    (record.rollupOp === undefined || typeof record.rollupOp === "string") &&
    validStatusGroups &&
    (record.optionColors === undefined ||
      (typeof record.optionColors === "object" &&
        record.optionColors !== null &&
        !Array.isArray(record.optionColors) &&
        Object.values(record.optionColors as Record<string, unknown>).every(
          (color) => typeof color === "string" && isSelectColor(color),
        )))
  );
}

export function parseProperties(raw: string): PropertyDef[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isPropertyDef).map((def) => ({
      id: def.id,
      name: def.name,
      type: def.type,
      options: [...def.options],
      ...(def.optionColors ? { optionColors: { ...def.optionColors } } : {}),
      ...(typeof def.formula === "string" ? { formula: def.formula } : {}),
      ...(def.statusGroups ? { statusGroups: { ...def.statusGroups } } : {}),
      ...(typeof def.relationHubId === "string" ? { relationHubId: def.relationHubId } : {}),
      ...(typeof def.relationPropId === "string" ? { relationPropId: def.relationPropId } : {}),
      ...(typeof def.rollupPropId === "string" ? { rollupPropId: def.rollupPropId } : {}),
      ...(def.rollupOp ? { rollupOp: def.rollupOp } : {}),
    }));
  } catch {
    return [];
  }
}

export function evaluateRollup(
  def: PropertyDef,
  page: { fields: Record<string, PropertyValue> },
  properties: PropertyDef[],
  allPages: Array<{ id: string; fields: Record<string, PropertyValue> }>,
): PropertyValue {
  if (def.type !== "rollup" || !def.relationPropId || !def.rollupPropId) {
    return null;
  }
  const relProp = properties.find((p) => p.id === def.relationPropId);
  if (!relProp) {
    return null;
  }
  const relVal = page.fields[relProp.id];
  const linkedIds: string[] = Array.isArray(relVal) ? (relVal as string[]) : [];

  const op: RollupOp = def.rollupOp ?? "count";
  if (op === "count") {
    return linkedIds.length;
  }

  const linkedPages = linkedIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter((p): p is { id: string; fields: Record<string, PropertyValue> } => Boolean(p));

  const rawValues = linkedPages
    .map((p) => p.fields[def.rollupPropId!])
    .filter((v) => v !== null && v !== undefined);

  if (op === "show_original") {
    const texts = rawValues
      .map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
      .filter((s) => s.length > 0);
    return texts.length > 0 ? texts.join(", ") : null;
  }

  const numericValues = rawValues
    .map((v) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN))
    .filter((n) => Number.isFinite(n));

  if (numericValues.length === 0) {
    return null;
  }

  switch (op) {
    case "sum":
      return numericValues.reduce((a, b) => a + b, 0);
    case "avg":
      return Math.round((numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 100) / 100;
    case "min":
      return Math.min(...numericValues);
    case "max":
      return Math.max(...numericValues);
    default:
      return null;
  }
}

export function parseFields(raw: string): PropertyFields {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as PropertyFields;
  } catch {
    return {};
  }
}

export function normalizeValue(type: PropertyType, value: unknown): PropertyValue {
  switch (type) {
    case "text":
    case "url":
    case "email":
    case "phone":
    case "status": {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }
    case "created_time":
    case "last_edited_time": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? null : time;
      }
      return null;
    }
    case "checkbox":
      return value === true;
    case "select": {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case "multi_select":
    case "relation": {
      if (!Array.isArray(value)) {
        return [];
      }
      return value.filter((item): item is string => typeof item === "string");
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
      }
      return value;
    }
    case "formula":
    case "rollup":
      return null;
  }
}

export function valueToText(type: PropertyType, value: PropertyValue): string {
  switch (type) {
    case "text":
    case "date":
    case "url":
    case "email":
    case "phone":
    case "status":
      return typeof value === "string" ? value : "";
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "checkbox":
      return value === true ? "Yes" : "";
    case "select":
      return typeof value === "string" ? value : "";
    case "multi_select":
    case "relation":
      return Array.isArray(value) ? value.join(", ") : "";
    case "created_time":
    case "last_edited_time":
      return typeof value === "number" ? new Date(value).toLocaleDateString() : "";
    case "formula":
    case "rollup":
      return value === null ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  }
}

export function coerceValue(
  from: PropertyType,
  to: PropertyType,
  value: PropertyValue,
): PropertyValue {
  if (from === to) {
    return value;
  }
  const asText = valueToText(from, value);
  switch (to) {
    case "text":
    case "select":
    case "status":
    case "url":
    case "email":
    case "phone":
    case "number":
    case "date":
      return normalizeValue(to, asText);
    case "checkbox":
      return value === true;
    case "multi_select":
    case "relation": {
      const normalized = normalizeValue("text", asText);
      const text = typeof normalized === "string" ? normalized : null;
      return text ? [text] : [];
    }
    case "created_time":
    case "last_edited_time":
    case "formula":
    case "rollup":
      return null;
  }
}
