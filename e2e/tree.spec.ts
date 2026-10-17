import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace } from "./helpers";

test("subpages, inline rename, trash cascade, restore, and search", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await page.getByLabel("Page title").fill("Parent");
    await page.waitForTimeout(700);

    const parentRow = page.locator(".tree-row", { hasText: "Parent" }).first();
    await parentRow.hover();
    await parentRow.locator('[aria-label="New subpage"]').click();

    const titleInput = page.getByLabel("Page title");
    await expect(titleInput).toHaveAttribute("data-page-title", "Untitled");
    await titleInput.fill("Child");
    await page.locator(".pg-editor").click();
    await page.keyboard.type("child body text");
    await page.waitForTimeout(700);

    await expect(page.locator(".tree-row", { hasText: "Child" })).toHaveCount(1);

    const renameTarget = page.locator(".tree-row", { hasText: "Parent" }).first();
    await renameTarget.locator(".tree-row__title").dblclick();
    const renameInput = page.getByLabel("Page name");
    await renameInput.fill("Parent Renamed");
    await renameInput.press("Enter");
    await expect(page.locator(".tree-row", { hasText: "Parent Renamed" })).toHaveCount(1);
    await page.waitForTimeout(700);

    const renamedRow = page.locator(".tree-row", { hasText: "Parent Renamed" }).first();
    await renamedRow.hover();
    await renamedRow.locator('[aria-label="More options"]').click();
    await page.locator(".menu-popover").getByRole("menuitem", { name: "Move to trash" }).click();

    const toast = page.locator(".toast");
    await expect(toast).toContainText('Moved "Parent Renamed" to Trash');
    await expect(page.locator(".tree-row", { hasText: "Parent Renamed" })).toHaveCount(0);
    await expect(page.locator(".tree-row", { hasText: "Child" })).toHaveCount(0);

    await page.locator(".trash-toggle").click();
    const trashRow = page.locator(".trash-row", { hasText: "Parent Renamed" });
    await expect(trashRow).toHaveCount(1);
    await trashRow.getByRole("button", { name: "Restore" }).click();

    await expect(page.locator(".tree-row", { hasText: "Parent Renamed" })).toHaveCount(1);
    await expect(page.locator(".tree-row", { hasText: "Child" })).toHaveCount(1);

    await page.getByLabel("Search pages").fill("child body");
    await expect(page.locator(".search-hit").first()).toContainText("Child");
    await page.locator(".search-hit").first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Child");
    await expect(page.locator(".pg-editor")).toContainText("child body text");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
