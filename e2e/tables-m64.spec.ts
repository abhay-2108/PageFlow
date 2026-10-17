import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

test("insert a table, type with Tab, use the table toolbar, and persist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Grid");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("/table");
    const menu = page.getByRole("listbox", { name: "Blocks" });
    await expect(menu).toBeVisible();
    await menu.getByRole("option", { name: "Table" }).click();

    const table = page.locator(".pg-editor table");
    await expect(table).toHaveCount(1);
    await expect(table.locator("tr")).toHaveCount(3);
    await expect(table.locator("th")).toHaveCount(3);

    await page.keyboard.type("Name");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Owner");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Status");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Alpha");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Abi");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Todo");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Beta");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Gamma");

    await expect(table.locator("tr")).toHaveCount(4);
    await expect(table.locator("th").first()).toHaveText("Name");

    const markdownPath = join(dir, "grid.md");
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
    expect(markdown).toContain("| Name | Owner | Status |");
    expect(markdown).toContain("| --- | --- | --- |");
    expect(markdown).toContain("| Alpha | Abi | Todo |");
    expect(markdown).toContain("Gamma");

    await table.locator("td", { hasText: "Alpha" }).first().click();
    const bar = page.locator(".pg-table-bar");
    await expect(bar).toBeVisible();

    await bar.getByRole("button", { name: "Add row" }).click();
    await expect(table.locator("tr")).toHaveCount(5);

    await bar.getByRole("button", { name: "Delete row" }).click();
    await expect(table.locator("tr")).toHaveCount(4);
    await expect(table.locator("td", { hasText: "Alpha" })).toHaveCount(0);

    await table.locator("th", { hasText: "Owner" }).click();
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: "Add column" }).click();
    await expect(table.locator("th")).toHaveCount(4);

    await bar.getByRole("button", { name: "Delete column" }).click();
    await expect(table.locator("th")).toHaveCount(3);
    await expect(table.locator("th", { hasText: "Owner" })).toHaveCount(0);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-editor table tr")).toHaveCount(4);
    await expect(page.locator(".pg-editor table th").first()).toHaveText("Name");
    await expect(page.locator(".pg-editor td", { hasText: "Gamma" })).toHaveCount(1);

    await page.locator(".pg-editor td", { hasText: "Gamma" }).first().click();
    await expect(page.locator(".pg-table-bar")).toBeVisible();
    await page.locator(".pg-table-bar").getByRole("button", { name: "Delete table" }).click();
    await expect(page.locator(".pg-editor table")).toHaveCount(0);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
