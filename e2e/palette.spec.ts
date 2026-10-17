import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeWorkspace, openApp, removeWorkspace } from "./helpers";

test("command palette creates pages and exports markdown", async () => {
  const dir = makeWorkspace();
  const markdownPath = join(dir, "exported-page.md");
  const { app, page } = await openApp(dir);

  try {
    await page.keyboard.press("Control+k");
    await expect(page.locator(".palette__content")).toBeVisible();

    await page.keyboard.type("new page");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Page title")).toBeVisible();

    await page.getByLabel("Page title").fill("Palette Page");
    await page.waitForTimeout(700);
    await page.locator(".pg-editor").click();
    await page.keyboard.type("palette export body", { delay: 20 });
    await page.waitForTimeout(700);

    await app.evaluate(
      ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      markdownPath,
    );

    await page.keyboard.press("Control+k");
    await expect(page.locator(".palette__content")).toBeVisible();
    await page.keyboard.type("export page as markdown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Exported/)).toBeVisible({ timeout: 15_000 });

    const markdown = readFileSync(markdownPath, "utf8");
    expect(markdown).toContain("# Palette Page");
    expect(markdown).toContain("palette export body");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
