type Listener = () => void;

interface OllamaModalState {
  open: boolean;
  message?: string;
}

class OllamaModalController {
  private state: OllamaModalState = { open: false };
  private listeners = new Set<Listener>();

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getState = (): OllamaModalState => this.state;

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public open(message?: string): void {
    this.state = { open: true, message };
    this.emit();
  }

  public close(): void {
    this.state = { open: false };
    this.emit();
  }
}

export const ollamaModal = new OllamaModalController();
