import type { SlashItem } from "./items";

export interface SlashRect {
  left: number;
  top: number;
  bottom: number;
}

export interface SlashState {
  open: boolean;
  items: SlashItem[];
  index: number;
  rect: SlashRect | null;
}

type Listener = () => void;

function toRect(rect: DOMRect | null): SlashRect | null {
  if (!rect) {
    return null;
  }
  return { left: rect.left, top: rect.top, bottom: rect.bottom };
}

const CLOSED: SlashState = { open: false, items: [], index: 0, rect: null };

class SlashController {
  private state: SlashState = CLOSED;
  private dismissed = false;
  private listeners = new Set<Listener>();
  private selectHandler: ((index: number) => boolean) | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): SlashState => this.state;

  setSelectHandler(handler: ((index: number) => boolean) | null): void {
    this.selectHandler = handler;
  }

  isOpen(): boolean {
    return this.state.open;
  }

  getCurrentItem(): SlashItem | null {
    return this.state.items[this.state.index] ?? null;
  }

  open(items: SlashItem[], rect: DOMRect | null): void {
    this.dismissed = false;
    this.patch({ open: true, items, index: 0, rect: toRect(rect) });
  }

  update(items: SlashItem[], rect: DOMRect | null): void {
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

  private patch(partial: Partial<SlashState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const slash = new SlashController();
