import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

test("table view lists subpages, opens rows, and persists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Hub");

    const hubRow = () => page.locator(".tree-row", { hasText: "Hub" }).first();

    await hubRow().hover();
    await hubRow().locator('[aria-label="New subpage"]').click();
    await setPageTitle(page, "Notes");

    await hubRow().hover();
    await hubRow().locator('[aria-label="New subpage"]').click();
    await setPageTitle(page, "Ideas");

    await hubRow().locator(".tree-row__title").click();
    await expect(page.getByLabel("Page title")).toHaveValue("Hub");

    const viewToggle = page.getByRole("group", { name: "Page view" });
    await viewToggle.getByRole("button", { name: "Table" }).click();

    const table = page.locator(".pg-children-table");
    await expect(table).toBeVisible();
    await expect(page.locator(".pg-editor")).toHaveCount(0);
    await expect(table.locator(".pg-db-row")).toHaveCount(2);
    await expect(table.locator(".pg-children-table__title")).toHaveText(["Notes", "Ideas"]);

    await table.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByLabel("Page title")).toHaveValue("Notes");
    await expect(page.locator(".pg-editor")).toHaveCount(1);

    await hubRow().locator(".tree-row__title").click();
    await expect(table).toBeVisible();

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.getByLabel("Page title")).toHaveValue("Hub");
    await expect(page.locator(".pg-children-table")).toBeVisible();
    await expect(page.locator(".pg-children-table .pg-db-row")).toHaveCount(2);

    await page
      .getByRole("group", { name: "Page view" })
      .getByRole("button", { name: "Document" })
      .click();
    await expect(page.locator(".pg-editor")).toHaveCount(1);
    await expect(page.locator(".pg-children-table")).toHaveCount(0);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
