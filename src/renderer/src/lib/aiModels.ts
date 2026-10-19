import { type AiStatus } from "../../../shared/ai";
import { getApi } from "./api";
import { ollamaModal } from "../components/ollamaModalController";

const DEFAULT_MODEL_STORAGE_KEY = "pg_default_ai_model";
const ACTIVE_MODEL_STORAGE_KEY = "pg_active_ai_model";

type Listener = () => void;

export interface AiModelSnapshot {
  status: AiStatus;
  models: AiStatus["models"];
  available: boolean;
  defaultModel: string;
  activeModel: string;
}

class AiModelStore {
  private status: AiStatus = {
    available: false,
    models: [],
    selectedModel: "",
  };
  private defaultModel: string = "";
  private activeModel: string = "";
  private listeners = new Set<Listener>();
  private fetching = false;
  private snapshot: AiModelSnapshot;
  private heartbeatTimer: number | null = null;

  constructor() {
    this.defaultModel = localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY) ?? "";
    this.activeModel = sessionStorage.getItem(ACTIVE_MODEL_STORAGE_KEY) ?? this.defaultModel;
    this.snapshot = this.computeSnapshot();
    if (typeof window !== "undefined") {
      this.startHeartbeat();
    }
  }

  public startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return;

    void this.refreshStatus();

    const scheduleNext = () => {
      const interval = this.status.available ? 25000 : 3500;
      this.heartbeatTimer = window.setTimeout(async () => {
        const wasOffline = !this.status.available;
        const next = await this.refreshStatus();
        if (wasOffline && next.available) {
          ollamaModal.close();
        }
        scheduleNext();
      }, interval);
    };

    scheduleNext();

    window.addEventListener("focus", () => {
      void this.refreshStatus();
    });
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private computeSnapshot(): AiModelSnapshot {
    return {
      status: this.status,
      models: this.status.models,
      available: this.status.available,
      defaultModel: this.defaultModel,
      activeModel: this.activeModel || this.status.selectedModel || this.defaultModel,
    };
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getState = (): AiModelSnapshot => this.snapshot;

  private emit(): void {
    this.snapshot = this.computeSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public async refreshStatus(_force = false): Promise<AiStatus> {
    if (this.fetching) return this.status;
    this.fetching = true;
    try {
      const api = getApi();
      const st = await api.ai.status();
      this.status = st;

      const modelNames = st.models.map((m) => m.name);

      // Verify or initialize default model
      if (!this.defaultModel || !modelNames.includes(this.defaultModel)) {
        if (st.selectedModel && modelNames.includes(st.selectedModel)) {
          this.setDefaultModel(st.selectedModel);
        } else if (modelNames.length > 0) {
          const preferred =
            modelNames.find((n) => n.includes("qwen3.5") || n.includes("llama3")) ??
            modelNames[0] ??
            "";
          if (preferred) {
            this.setDefaultModel(preferred);
          }
        }
      }

      // Verify active model
      if (!this.activeModel || !modelNames.includes(this.activeModel)) {
        this.activeModel = this.defaultModel || st.selectedModel || (modelNames[0] ?? "");
        sessionStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, this.activeModel);
      }

      this.emit();
      return st;
    } catch {
      this.status = {
        available: false,
        models: [],
        selectedModel: "",
        error: "Local AI service (Ollama) is unreachable at http://127.0.0.1:11434.",
      };
      this.emit();
      return this.status;
    } finally {
      this.fetching = false;
    }
  }

  public setActiveModel(model: string): void {
    this.activeModel = model;
    sessionStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, model);
    this.emit();
  }

  public setDefaultModel(model: string): void {
    this.defaultModel = model;
    localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, model);
    if (!this.activeModel) {
      this.setActiveModel(model);
    }
    this.emit();
  }

  public getModelToUse(): string {
    return this.activeModel || this.defaultModel || this.status.selectedModel || "";
  }
}

export const aiModelStore = new AiModelStore();

export function formatAiError(err: unknown): string {
  if (!err) return "An unexpected error occurred during AI generation.";
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^Error invoking remote method '[^']+':\s*/i, "").trim();
}

export function isOllamaOfflineError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("not running") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("unreachable") ||
    msg.includes("service is currently unavailable") ||
    msg.includes("cannot connect to ollama")
  );
}
