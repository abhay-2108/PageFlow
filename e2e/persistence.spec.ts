import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, waitForExit } from "./helpers";

test("kill -9: content saved before the crash survives relaunch", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  await page.getByRole("button", { name: "Create a page" }).click();
  const title = page.getByLabel("Page title");
  await expect(title).toBeVisible();
  await title.fill("Crash Test");

  await page.locator(".pg-editor").click();
  await page.keyboard.type("Hello crash safety");
  await expect(page.locator(".pg-editor")).toContainText("Hello crash safety");

  await page.waitForTimeout(900);
  app.process().kill("SIGKILL");
  await waitForExit(app);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const second = await openApp(dir);
  try {
    const win = second.page;
    await expect(win.getByLabel("Page title")).toHaveValue("Crash Test");
    await expect(win.locator(".pg-editor")).toContainText("Hello crash safety");

    await win.getByLabel("Search pages").fill("crash");
    await expect(win.locator(".search-hit").first()).toContainText("Crash Test");
  } finally {
    await second.app.close();
    removeWorkspace(dir);
  }
});
