import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AI_ACTION_LABELS, SUPPORTED_TRANSLATION_LANGUAGES, type AiAction } from "../../../../shared/ai";
import { aiModelStore } from "../../lib/aiModels";
import { ollamaModal } from "../../components/ollamaModalController";
import { AiMarkdownView } from "../../components/AiMarkdownView";
import { inlineAi } from "./controller";

const MENU_WIDTH = 560;
const GAP = 8;
const VIEWPORT_MARGIN = 16;

const SELECTION_ACTIONS: AiAction[] = ["improve", "fix_spelling", "translate", "shorter", "longer", "action_items", "explain"];
const GENERAL_ACTIONS: AiAction[] = ["continue", "summarize", "action_items", "brainstorm", "translate"];

export function InlineAiMenu() {
  const state = useSyncExternalStore(inlineAi.subscribe, inlineAi.getState, inlineAi.getState);
  const modelState = useSyncExternalStore(aiModelStore.subscribe, aiModelStore.getState, aiModelStore.getState);
  const [showThinking, setShowThinking] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const availableActions = state.selectedText.trim().length > 0 ? SELECTION_ACTIONS : GENERAL_ACTIONS;
  const filteredActions = state.query.trim()
    ? availableActions.filter((a) =>
        AI_ACTION_LABELS[a].title.toLowerCase().includes(state.query.toLowerCase()),
      )
    : availableActions;

  useEffect(() => {
    if (state.open) {
      inputRef.current?.focus();
      void aiModelStore.refreshStatus();
    }
  }, [state.open]);

  useEffect(() => {
    if (!state.open) {
      setShowThinking(false);
    }
  }, [state.open]);

  if (!state.open) {
    return null;
  }

  const left = state.rect
    ? Math.max(VIEWPORT_MARGIN, Math.min(state.rect.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN))
    : window.innerWidth / 2 - MENU_WIDTH / 2;

  const top = state.rect
    ? Math.min(state.rect.bottom + GAP, window.innerHeight - 380)
    : 160;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (state.loading) {
        void inlineAi.stop();
      } else {
        inlineAi.close();
      }
      return;
    }

    if (state.result && !state.loading) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (state.selectedText && e.ctrlKey) {
          inlineAi.accept("replace");
        } else {
          inlineAi.accept("insert_below");
        }
        return;
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (state.selectedIndex + 1) % (filteredActions.length || 1);
      inlineAi.setIndex(next);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (state.selectedIndex - 1 + (filteredActions.length || 1)) % (filteredActions.length || 1);
      inlineAi.setIndex(prev);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const currentAction = filteredActions[state.selectedIndex];
      if (currentAction === "translate" && !showLanguagePicker) {
        setShowLanguagePicker(true);
        return;
      }
      if (currentAction && !state.query.trim()) {
        void inlineAi.generate(currentAction);
      } else if (state.query.trim()) {
        void inlineAi.generate("custom", state.query);
      }
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className="pg-inline-ai"
      style={{ left, top, width: MENU_WIDTH }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="PageFlow AI"
    >
      <div className="pg-inline-ai__header">
        <span className="pg-inline-ai__sparkle">✦</span>
        <input
          ref={inputRef}
          className="pg-inline-ai__input"
          value={state.query}
          onChange={(e) => {
            inlineAi.setQuery(e.target.value);
            if (showLanguagePicker) setShowLanguagePicker(false);
          }}
          placeholder={
            showLanguagePicker
              ? "Select a target language below..."
              : state.selectedText
                ? "Ask PageFlow AI to edit selection or give instructions..."
                : "Ask PageFlow AI to write anything, or pick an action..."
          }
          disabled={state.loading}
        />
        {state.loading ? (
          <button
            type="button"
            className="pg-inline-ai__stop-btn"
            onClick={() => void inlineAi.stop()}
            title="Stop generating (Esc)"
          >
            ■ Stop
          </button>
        ) : (
          <button
            type="button"
            className="pg-inline-ai__close-btn"
            onClick={() => {
              if (showLanguagePicker) {
                setShowLanguagePicker(false);
              } else {
                inlineAi.close();
              }
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        )}
      </div>

      {state.error ? (
        <div className="pg-inline-ai__error">
          <span>{state.error}</span>
          <button
            type="button"
            className="pg-inline-ai__btn"
            onClick={() => inlineAi.generate(state.action ?? "custom")}
          >
            Try Again
          </button>
        </div>
      ) : null}

      {state.thinking ? (
        <div className="pg-inline-ai__thinking">
          <button
            type="button"
            className="pg-inline-ai__thinking-toggle"
            onClick={() => setShowThinking(!showThinking)}
          >
            <span className="pg-inline-ai__thinking-pulse" />
            <span>{state.isThinking ? "Thinking..." : "Reasoning process"}</span>
            <span className="pg-inline-ai__thinking-arrow">
              {showThinking || state.isThinking ? "▲" : "▼"}
            </span>
          </button>
          {showThinking || state.isThinking ? (
            <div className="pg-inline-ai__thinking-content">{state.thinking}</div>
          ) : null}
        </div>
      ) : null}

      {state.result || state.loading ? (
        <div className="pg-inline-ai__output">
          <div className="pg-inline-ai__text">
            {state.result ? (
              <AiMarkdownView content={state.result} isStreaming={state.loading} />
            ) : state.loading && !state.thinking ? (
              <div className="pg-inline-ai__waiting">
                <span className="pg-inline-ai__spinner" />
                <span>Waiting for tokens from {modelState.activeModel || "Ollama"}...</span>
              </div>
            ) : null}
          </div>

          {!state.loading && state.result ? (
            <div className="pg-inline-ai__actions">
              <button
                type="button"
                className="pg-inline-ai__btn pg-inline-ai__btn--primary"
                onClick={() => inlineAi.accept("insert_below")}
              >
                Insert Below <kbd>Enter</kbd>
              </button>
              {state.selectedText ? (
                <button
                  type="button"
                  className="pg-inline-ai__btn"
                  onClick={() => inlineAi.accept("replace")}
                >
                  Replace Selection <kbd>Ctrl+Enter</kbd>
                </button>
              ) : null}
              <button
                type="button"
                className="pg-inline-ai__btn"
                onClick={() => inlineAi.generate(state.action ?? "custom", undefined, state.targetLanguage)}
              >
                Try Again
              </button>
              <button
                type="button"
                className="pg-inline-ai__btn pg-inline-ai__btn--ghost"
                onClick={() => inlineAi.close()}
              >
                Discard <kbd>Esc</kbd>
              </button>
            </div>
          ) : null}
        </div>
      ) : showLanguagePicker ? (
        <div className="pg-inline-ai__menu">
          <div className="pg-inline-ai__section-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Translate text into:</span>
            <button
              type="button"
              className="pg-btn pg-btn--secondary"
              style={{ padding: "1px 6px", fontSize: "11px" }}
              onClick={() => setShowLanguagePicker(false)}
            >
              ← Back to Actions
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px", padding: "4px 8px" }}>
            {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className="pg-inline-ai__item"
                style={{ borderRadius: "4px", padding: "6px 10px" }}
                onClick={() => {
                  setShowLanguagePicker(false);
                  void inlineAi.generate("translate", undefined, lang.name);
                }}
              >
                <span className="pg-inline-ai__item-icon">🌐</span>
                <span className="pg-inline-ai__item-title">{lang.name}</span>
                <span className="pg-inline-ai__item-hint" style={{ opacity: 0.65 }}>{lang.native}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pg-inline-ai__menu">
          <div className="pg-inline-ai__section-label">
            {state.selectedText ? "Edit or Review Selection" : "Draft with Local AI"}
          </div>
          {filteredActions.map((action, idx) => {
            const meta = AI_ACTION_LABELS[action];
            const isSelected = idx === state.selectedIndex;
            return (
              <button
                key={action}
                type="button"
                className={`pg-inline-ai__item ${isSelected ? "pg-inline-ai__item--active" : ""}`}
                onMouseEnter={() => inlineAi.setIndex(idx)}
                onClick={() => {
                  if (action === "translate") {
                    setShowLanguagePicker(true);
                  } else {
                    void inlineAi.generate(action);
                  }
                }}
              >
                <span className="pg-inline-ai__item-icon">{meta.icon}</span>
                <span className="pg-inline-ai__item-title">{meta.title}</span>
                <span className="pg-inline-ai__item-hint">{meta.hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {modelState.available && modelState.models.length > 0 ? (
        <div className="pg-inline-ai__footer">
          <div className="pg-inline-ai__model-tag">
            <span>Model:</span>
            <select
              className="pg-inline-ai__model-select"
              value={modelState.activeModel}
              onChange={(e) => aiModelStore.setActiveModel(e.target.value)}
              title="Select Ollama model"
            >
              {modelState.models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} {m.name === modelState.defaultModel ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <span>Local Engine (Offline/Private)</span>
        </div>
      ) : !modelState.available ? (
        <div className="pg-inline-ai__footer" style={{ color: "#ef4444" }}>
          <span>Ollama is offline</span>
          <button
            type="button"
            className="pg-inline-ai__btn"
            style={{ padding: "2px 8px", fontSize: "0.6875rem" }}
            onClick={() => ollamaModal.open()}
          >
            Launch Guide
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
