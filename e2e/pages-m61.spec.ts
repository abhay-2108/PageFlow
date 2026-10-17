import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

async function dragRow(page: Page, from: Locator, to: Locator, position: { x: number; y: number }) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) {
    throw new Error("Missing bounding box for drag");
  }
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(fromBox.x + fromBox.width / 2 + 6, fromBox.y + fromBox.height / 2 + 6, { steps: 4 });
  await page.mouse.move(toBox.x + position.x, toBox.y + position.y, { steps: 10 });
  await page.mouse.up();
}

function rootLabels(page: Page): Locator {
  return page.locator(".tree > .tree-item > .tree-row .tree-row__label");
}

test("drag reorder, nest into a page, and move back to top level", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Alpha");

    await page.locator(".sidebar__new .ghost-btn").click();
    await setPageTitle(page, "Beta");

    await expect(rootLabels(page)).toHaveText(["Alpha", "Beta"]);

    const alphaRow = page.locator(".tree-row", { hasText: "Alpha" }).first();
    const betaRow = page.locator(".tree-row", { hasText: "Beta" }).first();

    await dragRow(page, betaRow, alphaRow, { x: 80, y: 2 });
    await expect.poll(async () => rootLabels(page).allTextContents()).toEqual(["Beta", "Alpha"]);

    await dragRow(page, page.locator(".tree-row", { hasText: "Alpha" }).first(), betaRow, { x: 80, y: 14 });

    const betaItem = page
      .locator(".tree > .tree-item")
      .filter({ has: page.locator(".tree-row__label", { hasText: "Beta" }) })
      .first();
    await expect(betaItem.locator(".tree-children .tree-row__label")).toHaveText(["Alpha"]);
    await expect(rootLabels(page)).toHaveText(["Beta"]);

    await page.reload();
    await page.waitForSelector(".shell");

    const betaItemAfterReload = page
      .locator(".tree > .tree-item")
      .filter({ has: page.locator(".tree-row__label", { hasText: "Beta" }) })
      .first();
    await betaItemAfterReload.locator(".tree-row__chevron").click();
    await expect(betaItemAfterReload.locator(".tree-children .tree-row__label")).toHaveText(["Alpha"]);

    const alphaChildRow = betaItemAfterReload.locator(".tree-children .tree-row").first();
    const alphaBox = await alphaChildRow.boundingBox();
    if (!alphaBox) {
      throw new Error("Missing bounding box for nested row");
    }
    await page.mouse.move(alphaBox.x + alphaBox.width / 2, alphaBox.y + alphaBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(alphaBox.x + alphaBox.width / 2 + 6, alphaBox.y + alphaBox.height / 2 + 6, { steps: 4 });

    const dropzone = page.locator("[data-drop-root]");
    await expect(dropzone).toBeVisible();
    const zoneBox = await dropzone.boundingBox();
    if (!zoneBox) {
      throw new Error("Missing bounding box for dropzone");
    }
    await page.mouse.move(zoneBox.x + zoneBox.width / 2, zoneBox.y + zoneBox.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => rootLabels(page).allTextContents()).toEqual(["Beta", "Alpha"]);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});

test("page icon and cover persist across reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Styled");

    await page.locator(".page").hover();
    await page.getByRole("button", { name: "Add icon" }).click();
    await page.getByRole("button", { name: "Icon 🌱" }).click();

    const icon = page.locator(".page__icon");
    await expect(icon).toHaveAttribute("data-page-icon", "🌱");
    await expect(page.locator(".tree-row__icon").first()).toHaveText("🌱");

    await page.locator(".page").hover();
    await page.getByRole("button", { name: "Add cover" }).click();
    await page.getByRole("button", { name: "Cover sunrise" }).click();
    await expect(page.locator('[data-page-cover="sunrise"]')).toBeVisible();

    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".page__icon")).toHaveAttribute("data-page-icon", "🌱");
    await expect(page.locator('[data-page-cover="sunrise"]')).toBeVisible();
    await expect(page.locator(".tree-row__icon").first()).toHaveText("🌱");

    await page.locator(".page__cover").hover();
    await page.locator(".page__cover-actions").getByRole("button", { name: "Remove" }).click();
    await expect(page.locator('[data-page-cover="sunrise"]')).toHaveCount(0);

    await page.locator(".page__icon").click();
    await page.getByRole("button", { name: "Remove icon" }).click();
    await expect(page.locator(".page__icon")).toHaveCount(0);
    await expect(page.locator(".tree-row__icon")).toHaveCount(0);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
