import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { aiModelStore } from "../lib/aiModels";
import { ollamaModal } from "./ollamaModalController";

export function OllamaOfflineModal() {
  const modalState = useSyncExternalStore(ollamaModal.subscribe, ollamaModal.getState, ollamaModal.getState);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!modalState.open) {
      setFeedback(null);
      setChecking(false);
    }
  }, [modalState.open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState.open) {
        ollamaModal.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState.open]);

  if (!modalState.open) return null;

  const handleRetry = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const status = await aiModelStore.refreshStatus(true);
      if (status.available) {
        setFeedback(`Connected to Ollama (${status.models.length} model${status.models.length === 1 ? "" : "s"} ready).`);
        setTimeout(() => {
          ollamaModal.close();
        }, 1200);
      } else {
        setFeedback(status.error || "Ollama service is still offline. Please verify the process is active.");
      }
    } catch {
      setFeedback("Connection failed. Ensure Ollama is running at http://127.0.0.1:11434.");
    } finally {
      setChecking(false);
    }
  };

  return createPortal(
    <div
      className="pg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-ollama-modal-title"
      onClick={() => ollamaModal.close()}
    >
      <div
        className="pg-ollama-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pg-ollama-modal__header">
          <div className="pg-ollama-modal__title-group">
            <span className="pg-ollama-modal__badge">OFFLINE</span>
            <h3 id="pg-ollama-modal-title" className="pg-ollama-modal__title">
              Local AI Service Not Found
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => ollamaModal.close()}
            aria-label="Close dialog"
            title="Dismiss (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="pg-ollama-modal__body">
          <p className="pg-ollama-modal__desc">
            PageFlow could not connect to the local Ollama instance at <code>http://127.0.0.1:11434</code>.
            Local models run completely on-device for total privacy and zero data leakage.
          </p>

          <div className="pg-ollama-modal__steps">
            <div className="pg-ollama-modal__step">
              <span className="pg-ollama-modal__step-num">1</span>
              <div className="pg-ollama-modal__step-content">
                <strong>Start the Ollama daemon</strong>
                <p>Launch the Ollama desktop app or open PowerShell/Terminal and run:</p>
                <pre><code>ollama serve</code></pre>
              </div>
            </div>

            <div className="pg-ollama-modal__step">
              <span className="pg-ollama-modal__step-num">2</span>
              <div className="pg-ollama-modal__step-content">
                <strong>Ensure at least one model is downloaded</strong>
                <p>For high-performance document editing and summarization:</p>
                <pre><code>ollama pull qwen3.5:9b</code></pre>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`pg-ollama-modal__feedback ${
                feedback.startsWith("Connected")
                  ? "pg-ollama-modal__feedback--success"
                  : "pg-ollama-modal__feedback--error"
              }`}
            >
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="pg-ollama-modal__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => ollamaModal.close()}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleRetry()}
            disabled={checking}
          >
            {checking ? "Checking connection..." : "Retry Connection"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
