import { defineConfig } from "vitest/config";

class LocalStorageMock {
  private store = new Map<string, string>();
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  get length(): number { return this.store.size; }
}

export default defineConfig({
  test: {
    include: ["src/shared/**/*.test.ts", "src/renderer/**/*.test.ts"],
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
  },
});
