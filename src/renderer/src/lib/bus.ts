type Handler = () => void;

const handlers = new Set<Handler>();

export function onWorkspaceChanged(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function emitWorkspaceChanged(): void {
  for (const handler of handlers) {
    handler();
  }
}
