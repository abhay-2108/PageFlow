import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

async function createSubpage(page: Page, parentTitle: string, title: string) {
  const row = page.locator(".tree-row", { hasText: parentTitle }).first();
  await row.hover();
  await row.locator('[aria-label="New subpage"]').click();
  await setPageTitle(page, title);
}

async function addProperty(page: Page, type: string) {
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByRole("menuitem", { name: type, exact: true }).click();
}

function taskRow(page: Page): Locator {
  return page.locator(".pg-db-row", { hasText: "Task one" }).first();
}

test("database properties: add columns, edit cells, and persist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Tasks");
    await page.getByRole("button", { name: "Table" }).click();
    await createSubpage(page, "Tasks", "Task one");
    await page.locator(".tree-row__label", { hasText: "Tasks" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Tasks");

    await addProperty(page, "Text");
    await addProperty(page, "Checkbox");
    await addProperty(page, "Select");

    const textCell = taskRow(page).getByLabel("Text");
    await textCell.click();
    await textCell.pressSequentially("hello", { delay: 15 });
    await textCell.press("Enter");

    const checkbox = taskRow(page).getByRole("button", { name: "Toggle Checkbox" });
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-pressed", "true");

    await taskRow(page).getByRole("button", { name: "Select value" }).click();
    const optionSearch = page.getByLabel("Option search");
    await optionSearch.pressSequentially("Todo", { delay: 15 });
    await page.getByRole("menuitem", { name: 'Create "Todo"' }).click();
    await expect(taskRow(page).getByRole("button", { name: "Select value" })).toHaveText("Todo");

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.getByLabel("Page title")).toHaveValue("Tasks");

    await expect(taskRow(page).getByLabel("Text")).toHaveValue("hello");
    await expect(taskRow(page).getByRole("button", { name: "Toggle Checkbox" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(taskRow(page).getByRole("button", { name: "Select value" })).toHaveText("Todo");

    await taskRow(page).locator(".pg-children-table__open").click();
    await setPageTitle(page, "Task one edited");
    await page.locator(".tree-row__label", { hasText: "Tasks" }).first().click();
    await expect(page.locator(".pg-db-row .pg-children-table__title").first()).toHaveText(
      "Task one edited",
    );

    await page.getByRole("button", { name: "Text property options" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const renameInput = page.getByLabel("Property name");
    await renameInput.press("Control+a");
    await renameInput.pressSequentially("Notes", { delay: 15 });
    await renameInput.press("Enter");
    await expect(page.getByRole("button", { name: "Notes property options" })).toBeVisible();

    await page.getByRole("button", { name: "Notes property options" }).click();
    await page.getByRole("menuitem", { name: "Delete property" }).click();
    await expect(page.getByRole("button", { name: "Notes property options" })).toHaveCount(0);

    await page.getByRole("button", { name: "+ New row" }).click();
    await expect(page.locator(".pg-db-row")).toHaveCount(2);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-db-row")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Notes property options" })).toHaveCount(0);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
