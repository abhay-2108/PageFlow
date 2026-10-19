import type { Editor, Range } from "@tiptap/core";
import type { AiAction } from "../../../../shared/ai";
import { getApi } from "../../lib/api";
import { aiModelStore, formatAiError, isOllamaOfflineError } from "../../lib/aiModels";
import { ollamaModal } from "../../components/ollamaModalController";

import { renderMarkdownToHtml } from "../../components/AiMarkdownView";

export interface InlineAiState {
  open: boolean;
  rect: DOMRect | null;
  editor: Editor | null;
  range: Range | null;
  selectedText: string;
  query: string;
  action: AiAction | null;
  loading: boolean;
  result: string;
  thinking: string;
  isThinking: boolean;
  error: string | null;
  done: boolean;
  selectedIndex: number;
}

const INITIAL_STATE: InlineAiState = {
  open: false,
  rect: null,
  editor: null,
  range: null,
  selectedText: "",
  query: "",
  action: null,
  loading: false,
  result: "",
  thinking: "",
  isThinking: false,
  error: null,
  done: false,
  selectedIndex: 0,
};

type Listener = () => void;

class InlineAiController {
  private state: InlineAiState = { ...INITIAL_STATE };
  private listeners = new Set<Listener>();
  private unsubscribeStream: (() => void) | null = null;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getState = (): InlineAiState => this.state;

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public openWithSelection(editor: Editor, range: Range, selectedText: string, rect?: DOMRect): void {
    this.cleanupStream();
    const targetRect =
      rect ?? editor.view.coordsAtPos(range.from)
        ? new DOMRect(
            editor.view.coordsAtPos(range.from).left,
            editor.view.coordsAtPos(range.from).top,
            0,
            24,
          )
        : null;

    this.state = {
      ...INITIAL_STATE,
      open: true,
      editor,
      range,
      selectedText,
      rect: targetRect,
    };
    this.emit();
  }

  public openAtCursor(editor: Editor, range?: Range): void {
    this.cleanupStream();
    const from = range ? range.from : editor.state.selection.from;
    const to = range ? range.to : editor.state.selection.to;
    const coords = editor.view.coordsAtPos(from);
    const rect = coords ? new DOMRect(coords.left, coords.top, 0, 24) : null;

    this.state = {
      ...INITIAL_STATE,
      open: true,
      editor,
      range: { from, to },
      selectedText: editor.state.doc.textBetween(from, to, " "),
      rect,
    };
    this.emit();
  }

  public close(): void {
    this.cleanupStream();
    const prevEditor = this.state.editor;
    this.state = { ...INITIAL_STATE };
    this.emit();
    if (prevEditor && !prevEditor.isDestroyed) {
      prevEditor.commands.focus();
    }
  }

  public setQuery(query: string): void {
    this.state = { ...this.state, query, selectedIndex: 0 };
    this.emit();
  }

  public setIndex(selectedIndex: number): void {
    this.state = { ...this.state, selectedIndex };
    this.emit();
  }

  public async generate(action: AiAction = "custom", customPrompt?: string): Promise<void> {
    const api = getApi();
    const prompt = customPrompt ?? this.state.query;
    const modelToUse = aiModelStore.getModelToUse();

    this.state = {
      ...this.state,
      action,
      loading: true,
      error: null,
      result: "",
      thinking: "",
      isThinking: false,
      done: false,
    };
    this.emit();

    this.cleanupStream();
    this.unsubscribeStream = api.ai.onStream((chunk) => {
      this.state = {
        ...this.state,
        result: chunk.full,
        thinking: chunk.thinking ?? this.state.thinking,
        isThinking: Boolean(chunk.isThinking),
        done: chunk.done,
      };
      this.emit();
    });

    try {
      const res = await api.ai.generate({
        prompt,
        action,
        context: this.state.selectedText || this.state.editor?.getText() || "",
        model: modelToUse,
      });

      this.state = {
        ...this.state,
        loading: false,
        isThinking: false,
        result: res.text,
        thinking: res.thinking ?? this.state.thinking,
        done: true,
      };
      this.emit();
    } catch (err) {
      const msg = formatAiError(err);
      if (isOllamaOfflineError(err)) {
        ollamaModal.open(msg);
      }
      this.state = {
        ...this.state,
        loading: false,
        isThinking: false,
        error: msg,
        done: true,
      };
      this.emit();
    } finally {
      this.cleanupStream();
    }
  }

  public async stop(): Promise<void> {
    try {
      const api = getApi();
      await api.ai.stop();
    } catch {
      // ignore
    }
    this.state = {
      ...this.state,
      loading: false,
      isThinking: false,
      done: true,
    };
    this.emit();
  }

  public accept(mode: "replace" | "insert_below" = "insert_below"): void {
    const { editor, range, result } = this.state;
    if (!editor || !result) {
      this.close();
      return;
    }

    const htmlContent = renderMarkdownToHtml(result);

    if (mode === "replace" && range && range.from < range.to) {
      editor.chain().focus().deleteRange(range).insertContent(htmlContent).run();
    } else {
      const insertPos = range ? range.to : editor.state.selection.to;
      editor.chain().focus().setTextSelection(insertPos).insertContent(htmlContent).run();
    }

    this.close();
  }

  private cleanupStream(): void {
    if (this.unsubscribeStream) {
      this.unsubscribeStream();
      this.unsubscribeStream = null;
    }
  }
}

export const inlineAi = new InlineAiController();
