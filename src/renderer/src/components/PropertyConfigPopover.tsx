import { useEffect, useRef, useState } from "react";
import { PROPERTY_TYPE_LABELS, SELECT_COLORS } from "../../../shared/database";
import type { PropertyDef, RollupOp } from "../../../shared/database";
import { ROLLUP_OP_LABELS } from "../../../shared/database";
import { validateFormula } from "../../../shared/formula";
import { useFocusTrap } from "../lib/a11y";
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
  const popoverRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(popoverRef, true, onClose);

  // Local draft states for debouncing
  const [name, setName] = useState(property.name);
  const [formula, setFormulaDraft] = useState(property.formula ?? "");
  const [aiPrompt, setAiPromptDraft] = useState(property.aiPrompt ?? "");
  const [rollupPropId, setRollupPropIdDraft] = useState(property.rollupPropId ?? "");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const performUpdate = async (updates: Partial<PropertyDef>) => {
    try {
      setErrorMessage(null);
      const page = await api.pages.get(pageId);
      if (!page) return;
      const props = page.meta.properties ?? [];
      const next = props.map((p) => (p.id === property.id ? { ...p, ...updates } : p));
      await api.pages.setProperties(pageId, next);
      onUpdated();
    } catch (err) {
      console.error("[PageFlow] Failed to update property:", err);
      setErrorMessage("Failed to save property changes");
    }
  };

  const scheduleUpdate = (updates: Partial<PropertyDef>) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void performUpdate(updates);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const deleteProperty = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setErrorMessage(null);
      const page = await api.pages.get(pageId);
      if (!page) return;
      const props = page.meta.properties ?? [];
      const next = props.filter((p) => p.id !== property.id);
      await api.pages.setProperties(pageId, next);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("[PageFlow] Failed to delete property:", err);
      setErrorMessage("Failed to delete property");
    }
  };

  const addSelectOption = async () => {
    try {
      const options = property.options ?? [];
      const newOption = `Option ${options.length + 1}`;
      const nextOptions = [...options, newOption];
      const color = SELECT_COLORS[options.length % SELECT_COLORS.length] ?? "#6b7280";
      const nextColors = { ...(property.optionColors ?? {}), [newOption]: color };
      await performUpdate({ options: nextOptions, optionColors: nextColors });
    } catch (err) {
      console.error("[PageFlow] Failed to add option:", err);
    }
  };

  const removeSelectOption = async (index: number) => {
    try {
      const options = (property.options ?? []).filter((_, i) => i !== index);
      await performUpdate({ options });
    } catch (err) {
      console.error("[PageFlow] Failed to remove option:", err);
    }
  };

  const handleRollupOpChange = async (op: RollupOp) => {
    await performUpdate({ rollupOp: op, rollupPropId });
  };

  return (
    <div
      ref={popoverRef}
      className="property-config"
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${property.name}`}
      tabIndex={-1}
    >
      <div className="property-config__header">
        <span className="property-config__icon">
          {PROPERTY_TYPE_LABELS[property.type] ?? "?"}
        </span>
        <span className="property-config__name">{name}</span>
        <button
          type="button"
          className="property-config__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {errorMessage ? (
        <div className="menu-popover__empty" style={{ color: "var(--pg-danger, #ef4444)", padding: "8px 12px" }}>
          {errorMessage}
        </div>
      ) : null}

      <div className="property-config__body">
        <label className="property-config__label">
          Name
          <input
            className="property-config__input"
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              scheduleUpdate({ name: val });
            }}
            onBlur={() => {
              if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              void performUpdate({ name });
            }}
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
                    ✕
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
              value={formula}
              onChange={(e) => {
                const val = e.target.value;
                setFormulaDraft(val);
                scheduleUpdate({ formula: val });
              }}
              onBlur={() => {
                if (debounceTimerRef.current !== null) {
                  window.clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                void performUpdate({ formula });
              }}
              rows={3}
              placeholder='prop("Status") == "Done"'
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
                    const next = formula ? `${formula}\n${fn}` : fn;
                    setFormulaDraft(next);
                    void performUpdate({ formula: next });
                  }}
                >
                  +{fn}
                </button>
              ))}
            </div>
            {formula && !validateFormula(formula) && (
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
                onChange={(e) => void handleRollupOpChange(e.target.value as RollupOp)}
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
                value={rollupPropId}
                onChange={(e) => {
                  const val = e.target.value;
                  setRollupPropIdDraft(val);
                  scheduleUpdate({ rollupPropId: val });
                }}
                onBlur={() => {
                  if (debounceTimerRef.current !== null) {
                    window.clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                  }
                  void performUpdate({ rollupPropId });
                }}
                placeholder="Property ID"
              />
            </label>
          </div>
        )}

        {(property.type === "ai_summary" || property.type === "ai_autofill") && (
          <div className="property-config__section">
            <span className="property-config__label">
              <span style={{ color: "var(--pg-accent-purple, #9333ea)", marginRight: "4px" }}>✦</span>
              AI Prompt Template
            </span>
            <textarea
              className="property-config__textarea"
              value={aiPrompt}
              onChange={(e) => {
                const val = e.target.value;
                setAiPromptDraft(val);
                scheduleUpdate({ aiPrompt: val });
              }}
              onBlur={() => {
                if (debounceTimerRef.current !== null) {
                  window.clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                void performUpdate({ aiPrompt });
              }}
              rows={3}
              placeholder={
                property.type === "ai_summary"
                  ? "Summarize the page content in 1-2 concise sentences."
                  : "Extract key tags, status update, or estimate based on page content."
              }
            />
            <div className="pg-formula-quick-pills" style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
              {[
                "Summarize page in 1 sentence",
                "Extract top 3 key takeaways",
                "Generate 3 comma-separated tags",
                "Extract next concrete action item",
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  className="pg-btn pg-btn--secondary"
                  style={{ fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => {
                    setAiPromptDraft(template);
                    void performUpdate({ aiPrompt: template });
                  }}
                >
                  +{template}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "11px", color: "var(--pg-text-muted)", margin: "6px 0 0" }}>
              PageFlow AI will run this prompt over the row page content to generate or refresh the cell value.
            </p>
          </div>
        )}

        <div className="property-config__danger">
          <button
            type="button"
            className="property-config__delete"
            style={confirmDelete ? { background: "var(--pg-danger, #ef4444)", color: "#fff" } : undefined}
            onClick={() => void deleteProperty()}
          >
            {confirmDelete ? "Click again to confirm delete" : "Delete property"}
          </button>
        </div>
      </div>
    </div>
  );
}
