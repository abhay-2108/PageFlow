export interface CommentBubbleRect {
  left: number;
  top: number;
  bottom: number;
}

export interface CommentBubbleState {
  open: boolean;
  rect: CommentBubbleRect | null;
}

export interface CommentSelectionRange {
  from: number;
  to: number;
  quote: string;
}

type Listener = () => void;
type ThreadApplier = (range: { from: number; to: number }, threadId: string) => boolean;
type MarkSanitizer = (knownThreadIds: string[]) => void;

const CLOSED: CommentBubbleState = { open: false, rect: null };

class CommentToolsController {
  private bubble: CommentBubbleState = CLOSED;
  private listeners = new Set<Listener>();
  private pendingRange: CommentSelectionRange | null = null;
  private applier: ThreadApplier | null = null;
  private sanitizer: MarkSanitizer | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): CommentBubbleState => this.bubble;

  showBubble(rect: CommentBubbleRect, pending: CommentSelectionRange): void {
    this.pendingRange = pending;
    this.patch({ open: true, rect });
  }

  hideBubble(): void {
    if (!this.bubble.open) {
      return;
    }
    this.patch(CLOSED);
  }

  pendingQuote(): string | null {
    return this.pendingRange?.quote ?? null;
  }

  setApplier(applier: ThreadApplier | null): void {
    this.applier = applier;
  }

  setSanitizer(sanitizer: MarkSanitizer | null): void {
    this.sanitizer = sanitizer;
  }

  applyThread(threadId: string): boolean {
    const range = this.pendingRange;
    if (!range || !this.applier) {
      return false;
    }
    const applied = this.applier({ from: range.from, to: range.to }, threadId);
    if (applied) {
      this.pendingRange = null;
      this.patch(CLOSED);
    }
    return applied;
  }

  sanitize(knownThreadIds: string[]): void {
    this.sanitizer?.(knownThreadIds);
  }

  reset(): void {
    this.pendingRange = null;
    this.applier = null;
    this.sanitizer = null;
    this.patch(CLOSED);
  }

  private patch(partial: CommentBubbleState): void {
    this.bubble = { ...this.bubble, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const commentTools = new CommentToolsController();
