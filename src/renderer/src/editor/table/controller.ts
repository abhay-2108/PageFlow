export interface TableBarRect {
  left: number;
  top: number;
}

export interface TableBarState {
  open: boolean;
  rect: TableBarRect | null;
}

export type TableAction =
  | "add-row"
  | "add-column"
  | "delete-row"
  | "delete-column"
  | "delete-table";

type Listener = () => void;
type TableRunner = (action: TableAction) => boolean;

const CLOSED: TableBarState = { open: false, rect: null };

class TableToolsController {
  private bar: TableBarState = CLOSED;
  private listeners = new Set<Listener>();
  private runner: TableRunner | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): TableBarState => this.bar;

  show(rect: TableBarRect): void {
    this.patch({ open: true, rect });
  }

  hide(): void {
    if (!this.bar.open) {
      return;
    }
    this.patch(CLOSED);
  }

  setRunner(runner: TableRunner | null): void {
    this.runner = runner;
  }

  run(action: TableAction): boolean {
    return this.runner?.(action) ?? false;
  }

  reset(): void {
    this.runner = null;
    this.patch(CLOSED);
  }

  private patch(partial: TableBarState): void {
    this.bar = { ...this.bar, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const tableTools = new TableToolsController();
