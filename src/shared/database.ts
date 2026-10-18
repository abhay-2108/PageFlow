export type PropertyType = "text" | "number" | "select" | "multi_select" | "date" | "checkbox";

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

export interface PropertyDef {
  id: string;
  name: string;
  type: PropertyType;
  options: string[];
  optionColors?: Record<string, string>;
}

export type PropertyValue = string | number | boolean | string[] | null;

export type PropertyFields = Record<string, PropertyValue>;

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
};

export function isPropertyType(value: string): value is PropertyType {
  return value in PROPERTY_TYPE_LABELS;
}

function isPropertyDef(value: unknown): value is PropertyDef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    typeof record.type === "string" &&
    isPropertyType(record.type) &&
    Array.isArray(record.options) &&
    record.options.every((option) => typeof option === "string") &&
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
    }));
  } catch {
    return [];
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
    case "text": {
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
    case "checkbox":
      return value === true;
    case "select": {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case "multi_select": {
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
  }
}

export function valueToText(type: PropertyType, value: PropertyValue): string {
  switch (type) {
    case "text":
    case "date":
      return typeof value === "string" ? value : "";
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "checkbox":
      return value === true ? "Yes" : "";
    case "select":
      return typeof value === "string" ? value : "";
    case "multi_select":
      return Array.isArray(value) ? value.join(", ") : "";
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
    case "number":
    case "date":
      return normalizeValue(to, asText);
    case "checkbox":
      return value === true;
    case "multi_select": {
      const normalized = normalizeValue("text", asText);
      const text = typeof normalized === "string" ? normalized : null;
      return text ? [text] : [];
    }
  }
}
