import { expect, test } from "@playwright/test";
import type { ElectronApplication } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeWorkspace, openApp, removeWorkspace } from "./helpers";

test("sync bundle export and import moves a full workspace", async () => {
  const dirA = makeWorkspace();
  const dirB = makeWorkspace();
  const bundlePath = join(dirB, "snapshot.sync");
  let appA: ElectronApplication | null = null;
  let appB: ElectronApplication | null = null;

  try {
    const a = await openApp(dirA);
    appA = a.app;
    const pageA = a.page;

    await pageA.getByRole("button", { name: "Create a page" }).click();
    await pageA.getByLabel("Page title").fill("Bundled");
    await pageA.waitForTimeout(700);
    await pageA.locator(".pg-editor").click();
    await pageA.keyboard.type("bundle body", { delay: 20 });
    await pageA.waitForTimeout(700);

    await appA.evaluate(
      ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      bundlePath,
    );

    await pageA.getByRole("button", { name: "Live" }).click();
    await pageA.getByRole("button", { name: "Export .sync" }).click();
    await expect(pageA.getByText("Bundle exported")).toBeVisible({ timeout: 15_000 });
    expect(existsSync(bundlePath)).toBe(true);

    const parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as {
      version: number;
      entries: unknown[];
      updates: unknown[];
    };
    expect(parsed.version).toBe(1);
    expect(parsed.entries.length).toBe(1);
    expect(parsed.updates.length).toBeGreaterThan(0);

    await appA.close();
    appA = null;

    const b = await openApp(dirB);
    appB = b.app;
    const pageB = b.page;

    await appB.evaluate(
      ({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
      },
      bundlePath,
    );

    await pageB.getByRole("button", { name: "Live" }).click();
    await pageB.getByRole("button", { name: "Import .sync" }).click();
    await expect(pageB.getByText(/Merged/)).toBeVisible({ timeout: 15_000 });

    const row = pageB.locator(".tree-row__title", { hasText: "Bundled" });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(pageB.locator(".pg-editor")).toContainText("bundle body", { timeout: 15_000 });
  } finally {
    if (appB) {
      await appB.close().catch(() => undefined);
    }
    if (appA) {
      await appA.close().catch(() => undefined);
    }
    removeWorkspace(dirA);
    removeWorkspace(dirB);
  }
});
