import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { extractDocText } from "../../../shared/doc-text";
import { getApi } from "../lib/api";
import { aiModelStore, formatAiError, isOllamaOfflineError } from "../lib/aiModels";
import { ollamaModal } from "./ollamaModalController";
import { AiMarkdownView } from "./AiMarkdownView";
import { importMarkdown } from "../lib/import";
import type { PageMeta } from "../../../shared/types";

export interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  pageTitle: string;
  pageId: string;
  onInsertContent?: (markdownText: string) => void;
  onOpenPage?: (pageId: string) => void;
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
  action?: "summarize" | "action_items" | "brainstorm" | "explain" | "create_page";
}

const PROMPT_CARDS: PromptCard[] = [
  {
    id: "create_page",
    icon: "📄",
    title: "Create new page",
    desc: "Generate a new subpage with tailored content",
    prompt: "Create a new page titled '<Page Title>' about <topic> with comprehensive structured sections, key details, and next steps.",
    action: "create_page",
  },
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
  {
    id: "workspace_qna",
    icon: "🌐",
    title: "Search workspace",
    desc: "Query facts across all notes and databases",
    prompt: "Search across the entire workspace knowledge base and summarize the main projects, status updates, and open questions.",
  },
  {
    id: "translate",
    icon: "🗺",
    title: "Translate page",
    desc: "Translate this document into another language",
    prompt: "Translate this document into Spanish, preserving all markdown formatting and code blocks.",
  },
];

function extractPageTitle(content: string, userPrompt?: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  if (userPrompt) {
    const promptMatch = userPrompt.match(
      /(?:create|add|make|build)(?:\s+a)?(?:\s+new)?\s+page\s+(?:called|titled|for|about)?\s*["']?([^"'\n.,]+)["']?/i,
    );
    if (promptMatch && promptMatch[1]) {
      return promptMatch[1].trim();
    }
  }
  const firstLine = content.trim().split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/^[#*-\s]+/, "").trim();
  return cleaned.length > 0 ? (cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned) : "New Page";
}

function hasPageIntent(content: string, userPrompt?: string): boolean {
  if (userPrompt && /(?:create|add|make|build)\s+(?:a\s+)?(?:new\s+)?page/i.test(userPrompt)) {
    return true;
  }
  return /^#\s+.+/m.test(content);
}

export function AiAssistantDrawer({
  open,
  onClose,
  pageTitle,
  pageId,
  onInsertContent,
  onOpenPage,
}: AiAssistantDrawerProps) {
  const modelState = useSyncExternalStore(aiModelStore.subscribe, aiModelStore.getState, aiModelStore.getState);
  const [contextScope, setContextScope] = useState<"this_page" | "workspace" | "none">("this_page");
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

  const handleCreatePage = async (text: string, userPrompt?: string) => {
    try {
      setLoading(true);
      const api = getApi();
      const title = extractPageTitle(text, userPrompt);
      const firstHeadingMatch = text.match(/^#\s+(.+)$/m);
      let bodyText = text;
      if (firstHeadingMatch) {
        bodyText = text.replace(/^#\s+.+\n*/m, "").trim();
      }

      const newPageMeta = await api.pages.create({
        parentId: pageId || null,
        title,
      });

      if (bodyText) {
        const doc = importMarkdown(bodyText);
        await api.pages.updateDoc(newPageMeta.id, doc);
      }

      if (onOpenPage) {
        onOpenPage(newPageMeta.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to create page from AI content:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (
    customPrompt?: string,
    action?: "summarize" | "action_items" | "brainstorm" | "explain" | "create_page",
  ) => {
    const promptToSend = customPrompt ?? input;
    if (!promptToSend.trim() || loading) return;

    let resolvedAction = action;
    if (!resolvedAction && /(?:create|add|make|build)\s+(?:a\s+)?(?:new\s+)?page/i.test(promptToSend)) {
      resolvedAction = "create_page";
    }

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
      let customSystemPrompt: string | undefined = undefined;

      if (contextScope === "workspace") {
        const allPages = await api.pages.list();
        const queryTerms = promptToSend.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
        const scoredPages: { page: PageMeta; score: number }[] = [];

        for (const p of allPages) {
          let score = 0;
          const titleLower = p.title.toLowerCase();
          for (const term of queryTerms) {
            if (titleLower.includes(term)) score += 5;
          }
          scoredPages.push({ page: p, score });
        }

        scoredPages.sort((a, b) => b.score - a.score || b.page.updatedAt - a.page.updatedAt);
        const topPages = scoredPages.slice(0, 5);

        const snippets: string[] = [];
        for (const { page: wpPage } of topPages) {
          try {
            const full = await api.pages.get(wpPage.id);
            if (full?.doc) {
              const text = extractDocText(full.doc).slice(0, 1000);
              snippets.push(`### Document: "${wpPage.title || "Untitled"}" (ID: ${wpPage.id})\n${text}`);
            }
          } catch {}
        }

        docContext = snippets.length > 0 ? snippets.join("\n\n---\n\n") : "No workspace pages found.";
        customSystemPrompt = [
          "You are PageFlow AI Universal Workspace Assistant.",
          "You have access to notes and documents from across the user's entire workspace.",
          "Always answer questions thoroughly using facts from the provided workspace documents.",
          "Cite the source document title using bold markdown like **[Document Title]** whenever you state a fact or detail from it.",
          "If the answer is not contained in the provided workspace documents, synthesize an answer clearly and note that it was not directly found in the indexed pages.",
        ].join("\n");
      } else if (contextScope === "this_page" && pageId) {
        const page = await api.pages.get(pageId);
        if (page?.doc) {
          docContext = extractDocText(page.doc);
        }
      }

      const res = await api.ai.generate({
        prompt: promptToSend,
        action: resolvedAction ?? "custom",
        context: docContext,
        pageTitle: contextScope === "this_page" ? pageTitle : "Workspace Knowledge Base",
        systemPrompt: customSystemPrompt,
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
    <aside className="pg-ai-drawer" role="complementary" aria-label="PageFlow AI Assistant">
      {/* Header Bar */}
      <div className="pg-ai-drawer__header">
        <div className="pg-ai-drawer__title-wrap">
          <div className="pg-ai-drawer__icon-badge">
            <span className="pg-ai-drawer__icon">✦</span>
          </div>
          <div className="pg-ai-drawer__title-text">
            <span className="pg-ai-drawer__title">PageFlow AI</span>
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

        <div className="pg-ai-drawer__scope-selector" role="group" aria-label="Context scope">
          <button
            type="button"
            className={
              contextScope === "this_page"
                ? "pg-ai-scope-btn pg-ai-scope-btn--active"
                : "pg-ai-scope-btn"
            }
            onClick={() => setContextScope("this_page")}
            title={`Use active page (${pageTitle || "Untitled"}) as context`}
          >
            📄 Page
          </button>
          <button
            type="button"
            className={
              contextScope === "workspace"
                ? "pg-ai-scope-btn pg-ai-scope-btn--active pg-ai-scope-btn--workspace"
                : "pg-ai-scope-btn"
            }
            onClick={() => setContextScope("workspace")}
            title="Search across all pages in the workspace (Universal Q&A)"
          >
            🌐 Workspace
          </button>
          <button
            type="button"
            className={
              contextScope === "none"
                ? "pg-ai-scope-btn pg-ai-scope-btn--active"
                : "pg-ai-scope-btn"
            }
            onClick={() => setContextScope("none")}
            title="Disable document context"
          >
            ✕ Off
          </button>
        </div>
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
                {msg.role === "user" ? "You" : "PageFlow AI"}
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

            {msg.role === "assistant" && msg.content ? (() => {
              const msgIndex = messages.findIndex((m) => m.id === msg.id);
              const prevUserMsg = msgIndex > 0 ? messages[msgIndex - 1] : undefined;
              const userPrompt = prevUserMsg?.role === "user" ? prevUserMsg.content : undefined;
              const showBanner = hasPageIntent(msg.content, userPrompt);
              const candidateTitle = extractPageTitle(msg.content, userPrompt);

              return (
                <>
                  {showBanner ? (
                    <div className="pg-ai-drawer__page-banner">
                      <div className="pg-ai-drawer__page-banner-info">
                        <span className="pg-ai-drawer__page-banner-icon">📄</span>
                        <div className="pg-ai-drawer__page-banner-text">
                          <strong>Page Ready: {candidateTitle}</strong>
                          <span>Click to create and open this page</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="pg-ai-drawer__page-banner-btn"
                        onClick={() => handleCreatePage(msg.content, userPrompt)}
                      >
                        Create Page →
                      </button>
                    </div>
                  ) : null}

                  <div className="pg-ai-drawer__msg-actions">
                    <button
                      type="button"
                      className="pg-ai-drawer__action-btn pg-ai-drawer__action-btn--primary"
                      onClick={() => handleCreatePage(msg.content, userPrompt)}
                      title="Create a new subpage with this content"
                    >
                      📄 Create as Page
                    </button>

                    {onInsertContent ? (
                      <button
                        type="button"
                        className="pg-ai-drawer__action-btn"
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
                </>
              );
            })() : null}
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
            placeholder={
              contextScope === "workspace"
                ? "Ask anything across all workspace documents... (Universal Q&A)"
                : contextScope === "this_page"
                  ? "Ask AI anything about this page... (Enter to send, Shift+Enter for newline)"
                  : "Ask AI anything... (Enter to send, Shift+Enter for newline)"
            }
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
          PageFlow AI runs locally on your device via Ollama • Zero cloud telemetry
        </div>
      </div>
    </aside>
  );
}
