export interface FormatRect {
  left: number;
  top: number;
  bottom: number;
}

export interface FormatState {
  open: boolean;
  rect: FormatRect | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  textColor: string | null;
  bgColor: string | null;
}

export type FormatAction =
  | { type: "toggle-bold" }
  | { type: "toggle-italic" }
  | { type: "toggle-underline" }
  | { type: "toggle-strike" }
  | { type: "toggle-code" }
  | { type: "text-color"; name: string | null }
  | { type: "bg-color"; name: string | null };

type Listener = () => void;
type FormatRunner = (action: FormatAction) => boolean;

const CLOSED: FormatState = {
  open: false,
  rect: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  textColor: null,
  bgColor: null,
};

function sameRect(a: FormatRect | null, b: FormatRect | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.left === b.left && a.top === b.top && a.bottom === b.bottom;
}

function sameState(a: FormatState, b: FormatState): boolean {
  return (
    a.open === b.open &&
    sameRect(a.rect, b.rect) &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike &&
    a.code === b.code &&
    a.textColor === b.textColor &&
    a.bgColor === b.bgColor
  );
}

class FormatToolsController {
  private state: FormatState = CLOSED;
  private listeners = new Set<Listener>();
  private runner: FormatRunner | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): FormatState => this.state;

  setRunner(runner: FormatRunner | null): void {
    this.runner = runner;
  }

  run(action: FormatAction): boolean {
    return this.runner?.(action) ?? false;
  }

  sync(next: FormatState): void {
    if (sameState(this.state, next)) {
      return;
    }
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  hide(): void {
    if (!this.state.open) {
      return;
    }
    this.sync(CLOSED);
  }

  reset(): void {
    this.runner = null;
    this.sync(CLOSED);
  }
}

export const formatTools = new FormatToolsController();
