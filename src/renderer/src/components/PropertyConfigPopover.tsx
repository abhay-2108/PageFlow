import { PROPERTY_TYPE_LABELS, SELECT_COLORS } from "../../../shared/database";
import type { PropertyDef, RollupOp } from "../../../shared/database";
import { ROLLUP_OP_LABELS } from "../../../shared/database";
import { validateFormula } from "../../../shared/formula";
import { getApi } from "../lib/api";

interface PropertyConfigPopoverProps {
  pageId: string;
  property: PropertyDef;
  onUpdated: () => void;
  onClose: () => void;
}

export function PropertyConfigPopover({
  pageId,
  property,
  onUpdated,
  onClose,
}: PropertyConfigPopoverProps) {
  const api = getApi();

  const update = async (updates: Partial<PropertyDef>) => {
    try {
      const page = await api.pages.get(pageId);
      if (!page) return;
      const props = page.meta.properties ?? [];
      const next = props.map((p) => (p.id === property.id ? { ...p, ...updates } : p));
      await api.pages.setProperties(pageId, next);
      onUpdated();
    } catch (err) {
      console.error("[PageFlow] Failed to update property:", err);
    }
  };

  const deleteProperty = async () => {
    try {
      const page = await api.pages.get(pageId);
      if (!page) return;
      const props = page.meta.properties ?? [];
      const next = props.filter((p) => p.id !== property.id);
      await api.pages.setProperties(pageId, next);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("[PageFlow] Failed to delete property:", err);
    }
  };

  const addSelectOption = async () => {
    try {
      const options = property.options ?? [];
      const newOption = `Option ${options.length + 1}`;
      const nextOptions = [...options, newOption];
      const color = SELECT_COLORS[options.length % SELECT_COLORS.length] ?? "#6b7280";
      const nextColors = { ...(property.optionColors ?? {}), [newOption]: color };
      await update({ options: nextOptions, optionColors: nextColors });
    } catch (err) {
      console.error("[PageFlow] Failed to add option:", err);
    }
  };

  const removeSelectOption = async (index: number) => {
    try {
      const options = (property.options ?? []).filter((_, i) => i !== index);
      await update({ options });
    } catch (err) {
      console.error("[PageFlow] Failed to remove option:", err);
    }
  };

  const setFormula = async (formula: string) => {
    try {
      await update({ formula });
    } catch (err) {
      console.error("[PageFlow] Failed to set formula:", err);
    }
  };

  const setRollup = async (rollupOp: RollupOp, rollupPropId: string) => {
    try {
      await update({ rollupOp, rollupPropId });
    } catch (err) {
      console.error("[PageFlow] Failed to set rollup:", err);
    }
  };

  return (
    <div className="property-config" role="dialog" aria-label={`Configure ${property.name}`}>
      <div className="property-config__header">
        <span className="property-config__icon">
          {PROPERTY_TYPE_LABELS[property.type] ?? "?"}
        </span>
        <span className="property-config__name">{property.name}</span>
        <button type="button" className="property-config__close" onClick={onClose} aria-label="Close">
          x
        </button>
      </div>

      <div className="property-config__body">
        <label className="property-config__label">
          Name
          <input
            className="property-config__input"
            value={property.name}
            onChange={(e) => void update({ name: e.target.value })}
          />
        </label>

        {(property.type === "select" || property.type === "multi_select" || property.type === "status") && (
          <div className="property-config__section">
            <span className="property-config__label">Options</span>
            <div className="property-config__options">
              {(property.options ?? []).map((opt, i) => (
                <div key={i} className="property-config__option">
                  <span
                    className="property-config__option-dot"
                    style={{ background: property.optionColors?.[opt] ?? SELECT_COLORS[0] }}
                  />
                  <span className="property-config__option-label">{opt}</span>
                  <button
                    type="button"
                    className="property-config__option-remove"
                    onClick={() => void removeSelectOption(i)}
                    aria-label={`Remove ${opt}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="property-config__add" onClick={() => void addSelectOption()}>
              + Add option
            </button>
          </div>
        )}

        {property.type === "formula" && (
          <div className="property-config__section">
            <span className="property-config__label">Formula</span>
            <textarea
              className="property-config__textarea"
              value={property.formula ?? ""}
              onChange={(e) => void setFormula(e.target.value)}
              rows={3}
              placeholder="prop(&quot;Status&quot;) == &quot;Done&quot;"
            />
            <div className="pg-formula-quick-pills" style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
              {[
                'prop("Name")',
                'if(condition, "yes", "no")',
                'concat("Prefix: ", prop("Name"))',
                'format(123)',
                'toNumber("42")',
                'round(10.5)',
              ].map((fn) => (
                <button
                  key={fn}
                  type="button"
                  className="pg-btn pg-btn--secondary"
                  style={{ fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => {
                    const current = property.formula ?? "";
                    void setFormula(current ? `${current}\n${fn}` : fn);
                  }}
                >
                  +{fn}
                </button>
              ))}
            </div>
            {property.formula && !validateFormula(property.formula) && (
              <span className="property-config__error" style={{ display: "block", marginTop: "4px" }}>
                Invalid formula syntax
              </span>
            )}
          </div>
        )}

        {property.type === "rollup" && (
          <div className="property-config__section">
            <span className="property-config__label">Rollup</span>
            <label className="property-config__label">
              Operation
              <select
                className="property-config__select"
                value={property.rollupOp ?? "count"}
                onChange={(e) => void setRollup(e.target.value as RollupOp, property.rollupPropId ?? "")}
              >
                {Object.entries(ROLLUP_OP_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="property-config__label">
              Property
              <input
                className="property-config__input"
                value={property.rollupPropId ?? ""}
                onChange={(e) => void setRollup(property.rollupOp ?? "count", e.target.value)}
                placeholder="Property ID"
              />
            </label>
          </div>
        )}

        <div className="property-config__danger">
          <button type="button" className="property-config__delete" onClick={() => void deleteProperty()}>
            Delete property
          </button>
        </div>
      </div>
    </div>
  );
}
