import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

test("format bubble styles text, callout survives export and reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const markdownPath = join(dir, "format-export.md");
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Formatting");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("Colored words");
    await page.waitForTimeout(400);

    await page.keyboard.press("Control+a");
    const bar = page.getByRole("toolbar", { name: "Formatting" });
    await expect(bar).toBeVisible();

    const bold = bar.getByRole("button", { name: "Bold" });
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".pg-editor strong")).toHaveText("Colored words");

    await bar.getByRole("button", { name: "Text color" }).click();
    await bar.getByRole("button", { name: "Text color Blue" }).click();
    await expect(page.locator('.pg-editor span[data-text-color="blue"]')).toHaveCount(1);

    await bar.getByRole("button", { name: "Background color" }).click();
    await bar.getByRole("button", { name: "Background color Yellow" }).click();
    await expect(page.locator('.pg-editor span[data-bg-color="yellow"]')).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Background color Yellow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await bar.getByRole("button", { name: "Text color" }).click();
    const blue = bar.getByRole("button", { name: "Text color Blue" });
    await expect(blue).toHaveAttribute("aria-pressed", "true");
    await blue.click();
    await expect(page.locator('.pg-editor span[data-text-color="blue"]')).toHaveCount(0);
    await blue.click();
    await expect(page.locator('.pg-editor span[data-text-color="blue"]')).toHaveCount(1);

    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/callout");
    const slashMenu = page.getByRole("listbox", { name: "Blocks" });
    await expect(slashMenu).toBeVisible();
    await slashMenu.getByRole("option", { name: "Callout" }).click();

    const callout = page.locator(".pg-callout");
    await expect(callout).toHaveCount(1);
    await page.keyboard.type("Remember this");
    await expect(page.locator(".pg-callout__content")).toContainText("Remember this");

    await page.getByRole("button", { name: "Callout icon" }).click();
    await page
      .getByRole("dialog", { name: "Callout icon" })
      .getByRole("button", { name: "Icon 🎯" })
      .click();
    await expect(page.getByRole("button", { name: "Callout icon" })).toHaveText("🎯");

    await page.waitForTimeout(700);
    await app.evaluate(
      ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      markdownPath,
    );
    await page.keyboard.press("Control+k");
    await page.keyboard.type("export page as markdown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Exported/)).toBeVisible({ timeout: 15_000 });

    const markdown = readFileSync(markdownPath, "utf8");
    expect(markdown).toContain("**Colored words**");
    expect(markdown).toContain('<div data-callout="🎯">');
    expect(markdown).toContain("Remember this");
    expect(markdown).not.toContain("data-text-color");
    expect(markdown).not.toContain("data-bg-color");

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator('.pg-editor span[data-text-color="blue"]')).toHaveCount(1);
    await expect(page.locator('.pg-editor span[data-bg-color="yellow"]')).toHaveCount(1);
    await expect(page.locator(".pg-callout")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Callout icon" })).toHaveText("🎯");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
