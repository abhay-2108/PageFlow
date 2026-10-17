import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

async function createSubpage(page: Page, parentTitle: string, title: string) {
  const row = page.locator(".tree-row", { hasText: parentTitle }).first();
  await row.hover();
  await row.locator('[aria-label="New subpage"]').click();
  await setPageTitle(page, title);
}

async function openRowMenu(page: Page, rowTitle: string): Promise<Locator> {
  const row = page.locator(".tree-row", { hasText: rowTitle }).first();
  await row.hover();
  await row.locator('[aria-label="More options"]').click();
  return page.locator(".menu-popover");
}

test("breadcrumbs, page options, favorites, duplicate, and move-to menu", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const exportPath = join(dir, "gamma-export.md");
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Alpha");
    await createSubpage(page, "Alpha", "Beta");
    await createSubpage(page, "Beta", "Gamma");

    await app.evaluate(
      ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      exportPath,
    );

    const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
    await expect(crumbs.getByRole("button", { name: "Alpha" })).toBeVisible();
    await expect(crumbs.getByRole("button", { name: "Beta" })).toBeVisible();
    await expect(crumbs.locator(".crumb--current")).toHaveText("Gamma");

    await crumbs.getByRole("button", { name: "Alpha" }).click();
    await expect(page.getByLabel("Page title")).toHaveValue("Alpha");

    await page.locator(".tree-row__label", { hasText: "Gamma" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Gamma");

    await page.getByRole("button", { name: "Page options" }).click();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    await expect(page.getByText("Page link copied")).toBeVisible();

    await page.getByRole("button", { name: "Page options" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByText(/Duplicated "Gamma"/)).toBeVisible();
    await expect(page.locator(".tree-row__label", { hasText: "Gamma (copy)" })).toBeVisible();

    await page.getByRole("button", { name: "Page options" }).click();
    await page.getByRole("menuitem", { name: "Export as Markdown" }).click();
    await expect(page.getByText(/Exported "Gamma" as Markdown/)).toBeVisible({ timeout: 15_000 });
    const markdown = readFileSync(exportPath, "utf8");
    expect(markdown).toContain("# Gamma");

    const alphaMenu = await openRowMenu(page, "Alpha");
    await alphaMenu.getByRole("menuitem", { name: "Add to Favorites" }).click();
    const favorites = page.locator(".sidebar__favorites");
    await expect(favorites).toBeVisible();
    await expect(favorites.locator(".favorite-row")).toHaveText([/Alpha/]);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".sidebar__favorites .favorite-row")).toHaveText([/Alpha/]);

    const alphaMenuAfterReload = await openRowMenu(page, "Alpha");
    await alphaMenuAfterReload.getByRole("menuitem", { name: "Remove from Favorites" }).click();
    await expect(page.locator(".sidebar__favorites")).toHaveCount(0);

    await page.locator(".sidebar__new .ghost-btn").click();
    await setPageTitle(page, "Delta");

    const alphaRow = page.locator(".tree-row", { hasText: "Alpha" }).first();
    await alphaRow.locator('[aria-label="Expand subpages"]').click();

    const betaMenu = await openRowMenu(page, "Beta");
    await betaMenu.getByRole("menuitem", { name: "Move to…" }).click();
    const targetSearch = betaMenu.getByLabel("Move to page");
    await targetSearch.click();
    await targetSearch.pressSequentially("Delta", { delay: 15 });
    await expect(betaMenu.getByRole("menuitem", { name: "Delta" })).toBeVisible();
    await betaMenu.getByRole("menuitem", { name: "Delta" }).click();

    const deltaItem = page
      .locator(".tree > .tree-item")
      .filter({ has: page.locator(".tree-row__label", { hasText: "Delta" }) })
      .first();
    await expect(deltaItem.locator(".tree-children .tree-row__label")).toHaveText(["Beta"]);

    await page.locator(".tree-row__label", { hasText: "Beta" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Beta");
    const movedCrumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
    await expect(movedCrumbs.getByRole("button", { name: "Delta" })).toBeVisible();
    await expect(movedCrumbs.locator(".crumb--current")).toHaveText("Beta");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
