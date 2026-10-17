export interface MentionItem {
  id: string;
  title: string;
  icon: string | null;
}

export interface MentionRect {
  left: number;
  top: number;
  bottom: number;
}

export interface MentionState {
  open: boolean;
  items: MentionItem[];
  index: number;
  rect: MentionRect | null;
}

type Listener = () => void;

function toRect(rect: DOMRect | null): MentionRect | null {
  if (!rect) {
    return null;
  }
  return { left: rect.left, top: rect.top, bottom: rect.bottom };
}

const CLOSED: MentionState = { open: false, items: [], index: 0, rect: null };

class MentionController {
  private state: MentionState = CLOSED;
  private dismissed = false;
  private listeners = new Set<Listener>();
  private selectHandler: ((index: number) => boolean) | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): MentionState => this.state;

  setSelectHandler(handler: ((index: number) => boolean) | null): void {
    this.selectHandler = handler;
  }

  isOpen(): boolean {
    return this.state.open;
  }

  open(items: MentionItem[], rect: DOMRect | null): void {
    this.dismissed = false;
    this.patch({ open: true, items, index: 0, rect: toRect(rect) });
  }

  update(items: MentionItem[], rect: DOMRect | null): void {
    if (this.dismissed) {
      return;
    }
    this.patch({
      open: items.length > 0,
      items,
      index: Math.min(this.state.index, Math.max(items.length - 1, 0)),
      rect: toRect(rect),
    });
  }

  dismiss(): void {
    this.dismissed = true;
    this.patch({ open: false });
  }

  close(): void {
    this.dismissed = false;
    this.patch(CLOSED);
  }

  move(delta: 1 | -1): void {
    const count = this.state.items.length;
    if (!this.state.open || count === 0) {
      return;
    }
    this.patch({ index: (this.state.index + delta + count) % count });
  }

  setIndex(index: number): void {
    if (!this.state.open || index === this.state.index) {
      return;
    }
    this.patch({ index });
  }

  select(index = this.state.index): boolean {
    if (!this.state.open || !this.selectHandler) {
      return false;
    }
    return this.selectHandler(index);
  }

  private patch(partial: Partial<MentionState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const mention = new MentionController();
