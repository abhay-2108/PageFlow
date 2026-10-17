import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

test("@mention inserts a page chip and backlinks appear on the mentioned page", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Target");

    await page.locator(".sidebar__new .ghost-btn").click();
    await setPageTitle(page, "Source");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("See @Tar");
    const menu = page.getByRole("listbox", { name: "Pages" });
    await expect(menu).toBeVisible();
    await menu.getByRole("option", { name: "Target" }).click();

    const chip = page.locator(".pg-mention");
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText("@Target");
    await page.waitForTimeout(700);

    await page.locator(".tree-row", { hasText: "Target" }).locator(".tree-row__title").click();
    await expect(page.getByLabel("Page title")).toHaveValue("Target");

    const backlinks = page.locator(".page__backlinks");
    await expect(backlinks).toBeVisible();
    await expect(backlinks.locator(".page__backlink-title")).toHaveText(["Source"]);

    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".page__backlinks .page__backlink-title")).toHaveText(["Source"]);

    await page.locator(".page__backlinks .page__backlink").click();
    await expect(page.getByLabel("Page title")).toHaveValue("Source");
    await expect(page.locator(".pg-mention")).toHaveText("@Target");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});

test("clicking a mention chip opens the mentioned page", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Notes");

    await page.locator(".sidebar__new .ghost-btn").click();
    await setPageTitle(page, "Linking");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("Ref @Notes");
    const menu = page.getByRole("listbox", { name: "Pages" });
    await expect(menu).toBeVisible();
    await menu.getByRole("option", { name: "Notes" }).click();
    await page.waitForTimeout(700);

    await page.locator(".pg-mention").click();
    await expect(page.getByLabel("Page title")).toHaveValue("Notes");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
