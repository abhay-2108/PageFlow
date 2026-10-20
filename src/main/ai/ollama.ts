import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  type AiGenerateInput,
  type AiGenerateResult,
  type AiModelInfo,
  type AiStatus,
  type AiStreamChunk,
  buildActionPrompt,
  buildSystemPrompt,
  parseThinkingAndContent,
} from "../../shared/ai";

const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";

function getOllamaHost(): string {
  const envHost = process.env["OLLAMA_HOST"];
  if (envHost && envHost.trim().length > 0) {
    return envHost.replace(/\/+$/, "");
  }
  return DEFAULT_OLLAMA_HOST;
}

export class OllamaService {
  private lastSelectedModel = "";
  private cachedStatus: AiStatus | null = null;
  private lastCheckTime = 0;
  private activeAbortController: AbortController | null = null;
  private activeHttpRequest: http.ClientRequest | null = null;

  public async getStatus(force = false): Promise<AiStatus> {
    const now = Date.now();
    if (!force && this.cachedStatus && now - this.lastCheckTime < 10_000) {
      return this.cachedStatus;
    }

    const host = getOllamaHost();
    try {
      const res = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const status: AiStatus = {
          available: false,
          models: [],
          selectedModel: "",
          error: `Ollama service returned HTTP ${res.status}. Ensure Ollama is running.`,
        };
        this.cachedStatus = status;
        this.lastCheckTime = now;
        return status;
      }

      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          size: number;
          modified_at?: string;
          details?: { parameter_size?: string };
        }>;
      };

      const models: AiModelInfo[] = (data.models ?? []).map((m) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        parameterSize: m.details?.parameter_size,
      }));

      if (models.length === 0) {
        const status: AiStatus = {
          available: true,
          models: [],
          selectedModel: "",
          error: "No models installed in Ollama. Run `ollama pull qwen3.5:9b` to download a model.",
        };
        this.cachedStatus = status;
        this.lastCheckTime = now;
        return status;
      }

      let selectedModel = this.lastSelectedModel;
      const modelNames = models.map((m) => m.name);
      if (!modelNames.includes(selectedModel)) {
        const preferred = models.find((m) => m.name.includes("qwen3.5") || m.name.includes("llama3"));
        selectedModel = preferred ? preferred.name : (models[0]?.name ?? "");
        this.lastSelectedModel = selectedModel;
      }

      const status: AiStatus = {
        available: true,
        models,
        selectedModel,
        error: undefined,
      };
      this.cachedStatus = status;
      this.lastCheckTime = now;
      return status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isOffline =
        msg.includes("ECONNREFUSED") ||
        msg.includes("fetch failed") ||
        msg.includes("aborted") ||
        msg.includes("timeout") ||
        msg.includes("ENOTFOUND");

      const status: AiStatus = {
        available: false,
        models: [],
        selectedModel: "",
        error: isOffline
          ? "Local AI service (Ollama) is not running at http://127.0.0.1:11434. Start Ollama to enable AI assistance."
          : `Ollama connection error: ${msg}`,
      };
      this.cachedStatus = status;
      this.lastCheckTime = now;
      return status;
    }
  }

  public stopGeneration(): void {
    if (this.activeHttpRequest) {
      this.activeHttpRequest.destroy();
      this.activeHttpRequest = null;
    }
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  public async generate(
    input: AiGenerateInput,
    onChunk?: (chunk: AiStreamChunk) => void,
  ): Promise<AiGenerateResult> {
    const requestId = randomUUID();
    const host = getOllamaHost();

    const status = await this.getStatus();
    if (!status.available) {
      throw new Error(
        status.error ||
          "Local AI service (Ollama) is not running at http://127.0.0.1:11434. Please launch the Ollama desktop application.",
      );
    }

    let modelToUse = input.model || this.lastSelectedModel || status.selectedModel;
    if (!modelToUse && status.models.length > 0) {
      modelToUse = status.models[0]?.name ?? "";
    }

    if (!modelToUse) {
      throw new Error("No Ollama models installed. Run `ollama pull qwen3.5:9b` to download a model.");
    }

    const systemPrompt = input.systemPrompt || buildSystemPrompt();
    const userPrompt = buildActionPrompt(input.action, input.prompt, input.context, input.targetLanguage);

    const body = {
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: {
        num_ctx: 4096,
      },
      stream: true,
    };

    this.stopGeneration();

    const currentAbort = new AbortController();
    this.activeAbortController = currentAbort;

    const parsedUrl = new URL(`${host}/api/chat`);

    return new Promise<AiGenerateResult>((resolve, reject) => {
      let settled = false;
      let rawAccumulated = "";
      let lineBuffer = "";

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 11434,
          path: parsedUrl.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 0, // No socket timeout during heavy weights load
        },
        (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            let errBody = "";
            res.on("data", (c) => (errBody += c.toString()));
            res.on("end", () => {
              if (!settled) {
                settled = true;
                reject(new Error(`Ollama chat failed with status ${res.statusCode}: ${errBody}`));
              }
            });
            return;
          }

          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            lineBuffer += chunk;
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line) as {
                  message?: { content?: string };
                  done?: boolean;
                };

                const token = parsed.message?.content ?? "";
                rawAccumulated += token;

                const { thinking, content, isThinking } = parseThinkingAndContent(rawAccumulated);

                if (onChunk) {
                  onChunk({
                    requestId,
                    chunk: token,
                    full: content,
                    thinking: thinking || undefined,
                    isThinking,
                    done: Boolean(parsed.done),
                  });
                }
              } catch {
                // ignore malformed or partial line
              }
            }
          });

          res.on("end", () => {
            if (settled) return;
            settled = true;
            this.activeHttpRequest = null;
            this.activeAbortController = null;

            const { thinking, content } = parseThinkingAndContent(rawAccumulated);
            if (onChunk) {
              onChunk({
                requestId,
                chunk: "",
                full: content,
                thinking: thinking || undefined,
                isThinking: false,
                done: true,
              });
            }
            resolve({
              text: content,
              thinking: thinking || undefined,
              model: modelToUse,
              done: true,
            });
          });

          res.on("error", (err) => {
            if (settled) return;
            settled = true;
            this.activeHttpRequest = null;
            this.activeAbortController = null;
            reject(err);
          });
        },
      );

      this.activeHttpRequest = req;

      req.on("error", (err) => {
        if (settled) return;
        settled = true;
        this.activeHttpRequest = null;
        this.activeAbortController = null;

        const msg = err.message;
        if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
          reject(
            new Error(
              "Local AI service (Ollama) is not running at http://127.0.0.1:11434. Please launch the Ollama desktop application or run 'ollama serve'.",
            ),
          );
        } else {
          reject(new Error(`Ollama connection error: ${msg}`));
        }
      });

      const onAbort = () => {
        req.destroy();
        if (!settled) {
          settled = true;
          this.activeHttpRequest = null;
          this.activeAbortController = null;
          resolve({
            text: "",
            model: modelToUse,
            done: true,
          });
        }
      };
      currentAbort.signal.addEventListener("abort", onAbort, { once: true });

      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export const ollama = new OllamaService();
