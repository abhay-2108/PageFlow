import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

function blockTexts(page: Page) {
  return page.locator(".pg-editor > *").allTextContents();
}

test("block gutter: duplicate, turn into, drag move, delete, insert below", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Blocks");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("First");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Third");
    await page.waitForTimeout(400);

    const gutter = page.locator(".pg-block-gutter");
    const grip = page.locator(".pg-block-gutter__btn--grip");
    const menu = page.getByRole("menu", { name: "Block menu" });

    await page.locator(".pg-editor p", { hasText: "Second" }).hover();
    await expect(gutter).toBeVisible();
    await grip.click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.locator(".pg-editor p", { hasText: "Second" })).toHaveCount(2);
    await expect.poll(() => blockTexts(page)).toEqual(["First", "Second", "Second", "Third"]);

    await page.locator(".pg-editor p", { hasText: "Third" }).hover();
    await expect(gutter).toBeVisible();
    await grip.click();
    await menu.getByRole("menuitem", { name: "Heading 1" }).click();
    await expect(page.locator(".pg-editor h1")).toHaveText("Third");

    await page.locator(".pg-editor p", { hasText: "First" }).hover();
    await expect(gutter).toBeVisible();
    const gripBox = await grip.boundingBox();
    const headingBox = await page.locator(".pg-editor h1").boundingBox();
    if (!gripBox || !headingBox) {
      throw new Error("Missing bounding box for drag");
    }
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(headingBox.x + 120, headingBox.y + headingBox.height * 0.75, { steps: 12 });
    await expect(page.locator(".pg-block-drop")).toBeVisible();
    await page.mouse.up();
    await expect.poll(() => blockTexts(page)).toEqual(["Second", "Second", "Third", "First"]);

    await page.locator(".pg-editor p", { hasText: "First" }).click();
    await page.keyboard.press("Control+Shift+ArrowUp");
    await expect.poll(() => blockTexts(page)).toEqual(["Second", "Second", "First", "Third"]);

    await page.locator(".pg-editor p", { hasText: "Second" }).first().hover();
    await expect(gutter).toBeVisible();
    await grip.click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Delete" }).click();
    await expect.poll(() => blockTexts(page)).toEqual(["Second", "First", "Third"]);

    await page.locator(".pg-editor h1").hover();
    await expect(gutter).toBeVisible();
    await page.getByRole("button", { name: "Insert block below" }).click();
    await page.keyboard.type("Added");
    await expect.poll(() => blockTexts(page)).toEqual(["Second", "First", "Third", "Added"]);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect.poll(() => blockTexts(page)).toEqual(["Second", "First", "Third", "Added"]);
    await expect(page.locator(".pg-editor h1")).toHaveText("Third");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
