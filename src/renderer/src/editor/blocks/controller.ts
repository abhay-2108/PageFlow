export type TurnTarget =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bulleted"
  | "numbered"
  | "todo"
  | "toggle"
  | "quote"
  | "code";

export interface HoverState {
  pos: number;
  top: number;
  left: number;
  turnable: boolean;
}

export interface MenuState {
  pos: number;
  top: number;
  left: number;
  turnable: boolean;
}

export interface IndicatorState {
  top: number;
  left: number;
  width: number;
}

export type BlockAction =
  | { type: "delete"; pos: number }
  | { type: "duplicate"; pos: number }
  | { type: "move-up"; pos: number }
  | { type: "move-down"; pos: number }
  | { type: "turn-into"; pos: number; target: TurnTarget }
  | { type: "insert-below"; pos: number }
  | {
      type: "grip-down";
      pos: number;
      grip: { left: number; top: number; right: number };
      pointer: { x: number; y: number };
    };

interface BlocksState {
  hover: HoverState | null;
  menu: MenuState | null;
  indicator: IndicatorState | null;
}

const HIDE_DELAY_MS = 150;

class BlockToolsController {
  private listeners = new Set<() => void>();
  private state: BlocksState = { hover: null, menu: null, indicator: null };
  private runner: ((action: BlockAction) => void) | null = null;
  private hideTimer: number | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): BlocksState => this.state;

  setRunner(runner: ((action: BlockAction) => void) | null): void {
    this.runner = runner;
  }

  run(action: BlockAction): void {
    this.runner?.(action);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private set(next: Partial<BlocksState>): void {
    this.state = { ...this.state, ...next };
    this.emit();
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  setHover(hover: HoverState | null): void {
    this.clearHideTimer();
    const current = this.state.hover;
    if (
      current === hover ||
      (current &&
        hover &&
        current.pos === hover.pos &&
        current.top === hover.top &&
        current.left === hover.left &&
        current.turnable === hover.turnable)
    ) {
      return;
    }
    this.set({ hover });
  }

  hoverEnter(): void {
    this.clearHideTimer();
  }

  hoverLeave(): void {
    if (this.state.menu || this.state.indicator) {
      return;
    }
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      if (!this.state.menu && !this.state.indicator) {
        this.setHover(null);
      }
    }, HIDE_DELAY_MS);
  }

  openMenu(menu: MenuState): void {
    this.clearHideTimer();
    this.set({ menu });
  }

  closeMenu(): void {
    if (this.state.menu) {
      this.set({ menu: null });
    }
  }

  setIndicator(indicator: IndicatorState | null): void {
    const current = this.state.indicator;
    if (
      current === indicator ||
      (current && indicator && current.top === indicator.top && current.left === indicator.left)
    ) {
      return;
    }
    this.set({ indicator });
  }

  hideAll(): void {
    this.clearHideTimer();
    this.set({ hover: null, menu: null, indicator: null });
  }

  reset(): void {
    this.clearHideTimer();
    this.runner = null;
    this.hideAll();
  }
}

export const blockTools = new BlockToolsController();
