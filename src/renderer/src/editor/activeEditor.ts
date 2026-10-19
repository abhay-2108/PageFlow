import type { Editor } from "@tiptap/core";

class ActiveEditorRegistry {
  private editors = new Map<string, Editor>();
  private currentId: string | null = null;
  private listeners = new Set<() => void>();

  register(pageId: string, editor: Editor): () => void {
    this.editors.set(pageId, editor);
    this.currentId = pageId;
    this.notify();
    return () => {
      if (this.editors.get(pageId) === editor) {
        this.editors.delete(pageId);
        if (this.currentId === pageId) {
          this.currentId = null;
        }
        this.notify();
      }
    };
  }

  set(editor: Editor | null, pageId?: string): void {
    if (editor && pageId) {
      this.editors.set(pageId, editor);
      this.currentId = pageId;
    } else if (!editor && pageId) {
      this.editors.delete(pageId);
      if (this.currentId === pageId) this.currentId = null;
    } else if (editor) {
      this.currentId = "__active";
      this.editors.set("__active", editor);
    } else {
      if (this.currentId) this.editors.delete(this.currentId);
      this.currentId = null;
    }
    this.notify();
  }

  get(pageId?: string): Editor | null {
    if (pageId) {
      const ed = this.editors.get(pageId);
      if (ed && !ed.isDestroyed) return ed;
    }
    if (this.currentId) {
      const ed = this.editors.get(this.currentId);
      if (ed && !ed.isDestroyed) return ed;
    }
    for (const editor of this.editors.values()) {
      if (!editor.isDestroyed) return editor;
    }
    return null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const activeEditor = new ActiveEditorRegistry();
