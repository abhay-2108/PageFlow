import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { extractDocText } from "../../../shared/doc-text";
import { getApi } from "../lib/api";
import { aiModelStore, formatAiError, isOllamaOfflineError } from "../lib/aiModels";
import { ollamaModal } from "./ollamaModalController";
import { AiMarkdownView } from "./AiMarkdownView";

export interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  pageTitle: string;
  pageId: string;
  onInsertContent?: (markdownText: string) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp: number;
}

interface PromptCard {
  id: string;
  icon: string;
  title: string;
  desc: string;
  prompt: string;
  action?: "summarize" | "action_items" | "brainstorm" | "explain";
}

const PROMPT_CARDS: PromptCard[] = [
  {
    id: "summarize",
    icon: "📋",
    title: "Summarize page",
    desc: "Key findings, architecture & executive takeaway",
    prompt: "Summarize this page into key takeaways and an executive overview.",
    action: "summarize",
  },
  {
    id: "action_items",
    icon: "☑",
    title: "Extract to-dos",
    desc: "Actionable engineering checklist with checkboxes",
    prompt: "Extract all concrete action items and next steps as a task checklist.",
    action: "action_items",
  },
  {
    id: "brainstorm",
    icon: "💡",
    title: "Brainstorm ideas",
    desc: "Architectural trade-offs, edge cases & failure modes",
    prompt: "Analyze technical trade-offs, potential failure modes, and areas for improvement.",
    action: "brainstorm",
  },
  {
    id: "explain",
    icon: "✦",
    title: "Explain concepts",
    desc: "Break down complex topics into clear, concise points",
    prompt: "Explain the core concepts and architecture of this document in clear, concise points.",
    action: "explain",
  },
];

export function AiAssistantDrawer({
  open,
  onClose,
  pageTitle,
  pageId,
  onInsertContent,
}: AiAssistantDrawerProps) {
  const modelState = useSyncExternalStore(aiModelStore.subscribe, aiModelStore.getState, aiModelStore.getState);
  const [includeContext, setIncludeContext] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      void aiModelStore.refreshStatus();
      setTimeout(() => textareaRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  };

  const handleSend = async (
    customPrompt?: string,
    action?: "summarize" | "action_items" | "brainstorm" | "explain",
  ) => {
    const promptToSend = customPrompt ?? input;
    if (!promptToSend.trim() || loading) return;

    if (!modelState.available) {
      ollamaModal.open();
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: promptToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
    setLoading(true);

    const api = getApi();
    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    const unsubscribe = api.ai.onStream((chunk) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: chunk.full, thinking: chunk.thinking ?? msg.thinking }
            : msg,
        ),
      );
    });

    try {
      let docContext = "";
      if (includeContext && pageId) {
        const page = await api.pages.get(pageId);
        if (page?.doc) {
          docContext = extractDocText(page.doc);
        }
      }

      const res = await api.ai.generate({
        prompt: promptToSend,
        action: action ?? "custom",
        context: docContext,
        pageTitle,
        model: aiModelStore.getModelToUse(),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: res.text, thinking: res.thinking }
            : msg,
        ),
      );
    } catch (err) {
      const msg = formatAiError(err);
      if (isOllamaOfflineError(err)) {
        ollamaModal.open(msg);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: msg }
            : m,
        ),
      );
    } finally {
      unsubscribe();
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      const api = getApi();
      await api.ai.stop();
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (id: string, text: string) => {
    if (onInsertContent) {
      onInsertContent(text);
      setInsertedId(id);
      setTimeout(() => setInsertedId(null), 2500);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleRetryLast = (assistantId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx > 0) {
      const lastUserMsg = messages[idx - 1];
      if (lastUserMsg && lastUserMsg.role === "user") {
        void handleSend(lastUserMsg.content);
      }
    }
  };

  if (!open) return null;

  const activeModel = modelState.activeModel || modelState.defaultModel || "Ollama";
  const isDefaultModel = activeModel === modelState.defaultModel;

  return (
    <aside className="pg-ai-drawer" role="complementary" aria-label="NotionFlow AI Assistant">
      {/* Header Bar */}
      <div className="pg-ai-drawer__header">
        <div className="pg-ai-drawer__title-wrap">
          <div className="pg-ai-drawer__icon-badge">
            <span className="pg-ai-drawer__icon">✦</span>
          </div>
          <div className="pg-ai-drawer__title-text">
            <span className="pg-ai-drawer__title">NotionFlow AI</span>
            <span className="pg-ai-drawer__badge">Local</span>
          </div>
        </div>

        <div className="pg-ai-drawer__actions-wrap">
          <div
            className={`pg-ai-drawer__status-pill ${
              modelState.available ? "pg-ai-drawer__status-pill--online" : "pg-ai-drawer__status-pill--offline"
            }`}
            title={modelState.available ? "Ollama service connected" : "Ollama service offline"}
          >
            <span
              className={`pg-ai-drawer__dot ${
                modelState.available ? "pg-ai-drawer__dot--online" : "pg-ai-drawer__dot--offline"
              }`}
            />
            <span className="pg-ai-drawer__status-label">
              {modelState.available ? "Online" : "Offline"}
            </span>
          </div>

          {messages.length > 0 ? (
            <button
              type="button"
              className="pg-ai-drawer__icon-btn"
              onClick={handleClearChat}
              title="Start new conversation (Clear chat)"
              aria-label="Clear chat"
            >
              ⌫
            </button>
          ) : null}

          <button
            type="button"
            className="pg-ai-drawer__icon-btn"
            onClick={() => void aiModelStore.refreshStatus(true)}
            title="Refresh Ollama status"
            aria-label="Refresh status"
          >
            ↻
          </button>

          <button
            type="button"
            className="pg-ai-drawer__icon-btn pg-ai-drawer__icon-btn--close"
            onClick={onClose}
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Model & Context Sub-bar */}
      <div className="pg-ai-drawer__subbar">
        <div className="pg-ai-drawer__model-pill-selector">
          <span className="pg-ai-drawer__subbar-label">Model:</span>
          {modelState.models.length > 0 ? (
            <div className="pg-ai-drawer__select-wrapper">
              <select
                className="pg-ai-drawer__model-select"
                value={activeModel}
                onChange={(e) => aiModelStore.setActiveModel(e.target.value)}
                title="Select Ollama model"
              >
                {modelState.models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} {m.name === modelState.defaultModel ? "★" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="pg-ai-drawer__no-models">
              {modelState.available ? "No models" : "Offline"}
            </span>
          )}

          {modelState.models.length > 0 && !isDefaultModel && activeModel ? (
            <button
              type="button"
              className="pg-ai-drawer__set-default-btn"
              onClick={() => aiModelStore.setDefaultModel(activeModel)}
              title="Set as default model across sessions"
            >
              Make default
            </button>
          ) : isDefaultModel ? (
            <span className="pg-ai-drawer__default-badge" title="Configured as default model">
              Default
            </span>
          ) : null}
        </div>

        <label
          className={`pg-ai-drawer__context-toggle ${includeContext ? "pg-ai-drawer__context-toggle--active" : ""}`}
          title={includeContext ? "Document content is sent to AI" : "Document context disabled"}
        >
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
          />
          <span className="pg-ai-drawer__context-icon">📄</span>
          <span className="pg-ai-drawer__context-text" title={pageTitle || "Untitled"}>
            {pageTitle ? (pageTitle.length > 18 ? `${pageTitle.slice(0, 18)}…` : pageTitle) : "Page"}
          </span>
        </label>
      </div>

      {/* Offline Alert Banner */}
      {!modelState.available ? (
        <div className="pg-ai-drawer__offline-card">
          <div className="pg-ai-drawer__offline-header">
            <span className="pg-ai-drawer__offline-icon">⚠️</span>
            <strong>Local AI Service Offline</strong>
          </div>
          <p className="pg-ai-drawer__offline-text">
            Ollama is not reachable at <code>127.0.0.1:11434</code>. Start Ollama to enable on-device document intelligence.
          </p>
          <div className="pg-ai-drawer__offline-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => ollamaModal.open()}
            >
              Launch Setup Guide
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void aiModelStore.refreshStatus(true)}
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : null}

      {/* Messages Thread */}
      <div className="pg-ai-drawer__messages">
        {messages.length === 0 ? (
          <div className="pg-ai-drawer__empty">
            <div className="pg-ai-drawer__empty-hero">
              <div className="pg-ai-drawer__empty-sparkle">✦</div>
              <h3 className="pg-ai-drawer__empty-title">How can I help you?</h3>
              <p className="pg-ai-drawer__empty-desc">
                Ask questions, summarize documents, or generate checklists using local Ollama models with total privacy.
              </p>
            </div>

            <div className="pg-ai-drawer__prompt-grid">
              {PROMPT_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="pg-ai-drawer__prompt-card"
                  onClick={() => void handleSend(card.prompt, card.action)}
                >
                  <span className="pg-ai-drawer__card-icon">{card.icon}</span>
                  <div className="pg-ai-drawer__card-content">
                    <span className="pg-ai-drawer__card-title">{card.title}</span>
                    <span className="pg-ai-drawer__card-desc">{card.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`pg-ai-drawer__msg pg-ai-drawer__msg--${msg.role}`}
          >
            <div className="pg-ai-drawer__msg-header">
              <span className="pg-ai-drawer__msg-role">
                {msg.role === "user" ? "You" : "NotionFlow AI"}
              </span>
              {msg.role === "assistant" && (
                <span className="pg-ai-drawer__msg-model-tag">{activeModel}</span>
              )}
            </div>

            {msg.thinking ? (
              <div className="pg-ai-drawer__thinking-box">
                <button
                  type="button"
                  className="pg-ai-drawer__thinking-btn"
                  onClick={() =>
                    setExpandedThinking((prev) => ({
                      ...prev,
                      [msg.id]: !prev[msg.id],
                    }))
                  }
                >
                  <span className="pg-inline-ai__thinking-pulse" />
                  <span>Reasoning process</span>
                  <span className="pg-ai-drawer__thinking-arrow">
                    {expandedThinking[msg.id] ? "▲" : "▼"}
                  </span>
                </button>
                {expandedThinking[msg.id] ? (
                  <div className="pg-ai-drawer__thinking-text">{msg.thinking}</div>
                ) : null}
              </div>
            ) : null}

            <div className="pg-ai-drawer__msg-body">
              {msg.content ? (
                <AiMarkdownView
                  content={msg.content}
                  isStreaming={loading && msg.id === messages[messages.length - 1]?.id}
                />
              ) : loading && msg.role === "assistant" ? (
                <span className="pg-ai-drawer__typing">
                  <span className="pg-inline-ai__thinking-pulse" />
                  Generating response from {activeModel}...
                </span>
              ) : null}
            </div>

            {msg.role === "assistant" && msg.content ? (
              <div className="pg-ai-drawer__msg-actions">
                {onInsertContent ? (
                  <button
                    type="button"
                    className="pg-ai-drawer__action-btn pg-ai-drawer__action-btn--primary"
                    onClick={() => handleInsert(msg.id, msg.content)}
                    title="Insert content into the active document"
                  >
                    {insertedId === msg.id ? "✓ Inserted into Page" : "+ Insert into Page"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="pg-ai-drawer__action-btn"
                  onClick={() => handleCopy(msg.id, msg.content)}
                  title="Copy markdown to clipboard"
                >
                  {copiedId === msg.id ? "✓ Copied" : "📋 Copy"}
                </button>

                <button
                  type="button"
                  className="pg-ai-drawer__action-btn"
                  onClick={() => handleRetryLast(msg.id)}
                  title="Regenerate this response"
                >
                  ↻ Retry
                </button>
              </div>
            ) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Docked Input Footer */}
      <div className="pg-ai-drawer__footer">
        <div className="pg-ai-drawer__input-box">
          <textarea
            ref={textareaRef}
            className="pg-ai-drawer__textarea"
            placeholder="Ask AI anything about this page... (Enter to send, Shift+Enter for newline)"
            rows={2}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <div className="pg-ai-drawer__input-bar">
            <div className="pg-ai-drawer__input-meta">
              <span className="pg-ai-drawer__input-hint">↵ Send</span>
              <span className="pg-ai-drawer__input-dot">•</span>
              <span className="pg-ai-drawer__input-model">{activeModel}</span>
            </div>

            <div className="pg-ai-drawer__input-buttons">
              {loading ? (
                <button
                  type="button"
                  className="pg-ai-drawer__stop-btn"
                  onClick={() => void handleStop()}
                  title="Stop generating response (Esc)"
                >
                  ■ Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="pg-ai-drawer__send-btn"
                  disabled={!input.trim()}
                  onClick={() => void handleSend()}
                  title="Send message"
                  aria-label="Send message"
                >
                  ↑
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pg-ai-drawer__footer-caption">
          NotionFlow AI runs locally on your device via Ollama • Zero cloud telemetry
        </div>
      </div>
    </aside>
  );
}
