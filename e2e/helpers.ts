import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const projectRoot = join(here, "..");

export function makeWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
}

export async function launchApp(workspaceDir: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [projectRoot, `--user-data-dir=${join(workspaceDir, ".userdata")}`],
    env: {
      ...process.env,
      PAGEGROVE_WORKSPACE: workspaceDir,
      ELECTRON_RENDERER_URL: "",
    },
  });
}

export async function openApp(workspaceDir: string): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const app = await launchApp(workspaceDir);
  app.process().stderr?.on("data", (chunk: Buffer) => {
    console.error("[main:stderr]", chunk.toString().trim());
  });
  app.on("close", () => {
    console.error("[app:close] electron application closed");
  });
  const page = await app.firstWindow();
  page.on("crash", () => {
    console.error("[renderer:crash] page crashed");
  });
  page.on("pageerror", (error) => {
    console.error("[renderer:pageerror]", error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error("[renderer:console]", message.text());
    }
  });
  await page.waitForSelector(".shell", { timeout: 30_000 });
  return { app, page };
}

export function waitForExit(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  return new Promise((resolve) => {
    proc.once("exit", () => resolve());
  });
}

export function removeWorkspace(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // Helper processes may still hold locks briefly on Windows; the temp dir is disposable.
  }
}
