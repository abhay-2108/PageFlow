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

test("database property types: change type with coercion and color options", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Types");
    await page.getByRole("button", { name: "Table" }).click();
    await createSubpage(page, "Types", "Row one");
    await page.locator(".tree-row__label", { hasText: "Types" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Types");

    await addProperty(page, "Text");
    await addProperty(page, "Select");

    const row = page.locator(".pg-db-row").first();
    const textCell = row.getByLabel("Text");
    await textCell.click();
    await textCell.pressSequentially("5", { delay: 15 });
    await textCell.press("Enter");

    await row.getByRole("button", { name: "Select value" }).click();
    const optionSearch = page.getByLabel("Option search");
    await optionSearch.pressSequentially("Todo", { delay: 15 });
    await page.getByRole("menuitem", { name: 'Create "Todo"' }).click();
    await expect(row.getByRole("button", { name: "Select value" })).toHaveText("Todo");

    await page.getByRole("button", { name: "Select property options" }).click();
    await page.getByRole("menuitem", { name: "Option colors" }).click();
    await page.getByRole("menuitem", { name: "Todo", exact: true }).click();
    await page.getByRole("menuitem", { name: "red" }).click();
    await expect(row.locator(".pg-db-dot--red")).toBeVisible();

    await page.getByRole("button", { name: "Text property options" }).click();
    await page.getByRole("menuitem", { name: "Change type" }).click();
    await page.getByRole("menuitem", { name: "Number", exact: true }).click();
    await expect(row.getByLabel("Text")).toHaveValue("5");

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-db-row").first().getByLabel("Text")).toHaveValue("5");
    await expect(page.locator(".pg-db-row").first().locator(".pg-db-dot--red")).toBeVisible();
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});

test("database views: sort and filter rows", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Board");
    await page.getByRole("button", { name: "Table" }).click();
    await createSubpage(page, "Board", "Charlie");
    await createSubpage(page, "Board", "Alpha");
    await createSubpage(page, "Board", "Bravo");
    await page.locator(".tree-row__label", { hasText: "Board" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Board");

    const titles = page.locator(".pg-db-row .pg-children-table__title");
    await expect(titles).toHaveText(["Charlie", "Alpha", "Bravo"]);

    await addProperty(page, "Number");
    const setNumber = async (rowTitle: string, value: string) => {
      const cell = page.locator(".pg-db-row", { hasText: rowTitle }).first().getByLabel("Number");
      await cell.click();
      await cell.fill(value);
      await cell.press("Enter");
    };
    await setNumber("Charlie", "30");
    await setNumber("Alpha", "10");
    await setNumber("Bravo", "20");

    await page.getByRole("button", { name: /^Sort/ }).click();
    await page.getByRole("menuitem", { name: "Number", exact: true }).click();
    await expect(titles).toHaveText(["Alpha", "Bravo", "Charlie"]);

    await page.getByRole("menuitem", { name: "Number ↑", exact: true }).click();
    await expect(titles).toHaveText(["Charlie", "Bravo", "Alpha"]);

    await addProperty(page, "Select");
    const setStatus = async (rowTitle: string, option: string) => {
      const row = page.locator(".pg-db-row", { hasText: rowTitle }).first();
      await row.getByRole("button", { name: "Select value" }).click();
      const search = page.getByLabel("Option search");
      await search.fill(option);
      const existing = page.getByRole("menuitem", { name: option, exact: true });
      if ((await existing.count()) > 0) {
        await existing.first().click();
      } else {
        await page.getByRole("menuitem", { name: `Create "${option}"` }).click();
      }
    };
    await setStatus("Charlie", "Todo");
    await setStatus("Alpha", "Done");
    await setStatus("Bravo", "Todo");

    await page.getByRole("button", { name: /^Filter/ }).click();
    await page.getByLabel("Filter property").selectOption({ label: "Select" });
    await page.getByLabel("Filter operator").selectOption("contains");
    await page.getByLabel("Filter value").fill("Todo");
    await page.getByRole("menuitem", { name: "Add filter" }).click();
    await expect(titles).toHaveText(["Charlie", "Bravo"]);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-db-row .pg-children-table__title")).toHaveText([
      "Charlie",
      "Bravo",
    ]);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});

test("database views: add, rename, and switch views", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Views");
    await page.getByRole("button", { name: "Table" }).click();
    await createSubpage(page, "Views", "Row one");
    await page.locator(".tree-row__label", { hasText: "Views" }).first().click();
    await expect(page.getByLabel("Page title")).toHaveValue("Views");

    const viewSelect = page.getByLabel("Database view");
    await expect(viewSelect.locator("option")).toHaveCount(1);
    await expect(viewSelect).toHaveValue("default");

    await page.getByRole("button", { name: "Add view" }).click();
    await expect(viewSelect.locator("option")).toHaveCount(2);
    const newViewId = await viewSelect.inputValue();
    expect(newViewId).not.toBe("default");

    await page.getByRole("button", { name: "View options" }).click();
    await page.getByRole("menuitem", { name: "Rename view" }).click();
    const nameInput = page.getByLabel("View name");
    await nameInput.press("Control+a");
    await nameInput.pressSequentially("Active", { delay: 15 });
    await nameInput.press("Enter");
    await expect(viewSelect.locator("option", { hasText: "Active" })).toHaveCount(1);
    await expect(viewSelect).toHaveValue(newViewId);

    await viewSelect.selectOption({ label: "Table" });
    await expect(viewSelect).toHaveValue("default");

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(viewSelect).toHaveValue("default");
    await expect(viewSelect.locator("option", { hasText: "Active" })).toHaveCount(1);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
