import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

async function selectLastWord(page: Page, length: number) {
  await page.keyboard.press("End");
  for (let index = 0; index < length; index++) {
    await page.keyboard.press("Shift+ArrowLeft");
  }
}

async function createThread(page: Page, body: string) {
  const bubble = page.getByRole("button", { name: "Comment", exact: true });
  await expect(bubble).toBeVisible();
  await bubble.click();
  const panel = page.getByRole("complementary", { name: "Comments" });
  await expect(panel).toBeVisible();
  const input = panel.getByLabel("Comment text");
  await input.click();
  await input.pressSequentially(body, { delay: 15 });
  await panel.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator(".comments-panel .comment-thread")).toHaveCount(1);
}

test("comment on a selection, reply, and persist across reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Commented");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("Hello world");
    await selectLastWord(page, 5);
    await createThread(page, "Looks good");

    const thread = page.locator(".comments-panel .comment-thread").first();
    await expect(thread.locator(".comment-thread__quote")).toHaveText("world");
    await expect(thread.locator(".comment-thread__body")).toHaveText(["Looks good"]);
    await expect(page.locator(".pg-comment-mark")).toHaveText("world");

    const replyInput = thread.getByLabel("Reply text");
    await replyInput.click();
    await replyInput.pressSequentially("Thanks", { delay: 15 });
    await thread.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(thread.locator(".comment-thread__body")).toHaveText(["Looks good", "Thanks"]);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-comment-mark")).toHaveText("world");

    await page.getByRole("button", { name: "Comments", exact: true }).click();
    const reloadedThread = page.locator(".comments-panel .comment-thread").first();
    await expect(reloadedThread.locator(".comment-thread__body")).toHaveText(["Looks good", "Thanks"]);

    await page.locator(".pg-comment-mark").click();
    await expect(reloadedThread).toHaveAttribute("data-active", "true");
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});

test("resolve, reopen, and delete a comment thread", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Threads");

    await page.locator(".pg-editor").click();
    await page.keyboard.type("Alpha beta");
    await selectLastWord(page, 4);
    await createThread(page, "Draft notes");

    const thread = page.locator(".comments-panel .comment-thread").first();
    await thread.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.locator(".comments-panel .comment-thread")).toHaveCount(0);

    const resolvedToggle = page.getByRole("button", { name: /Show resolved/ });
    await expect(resolvedToggle).toBeVisible();
    await resolvedToggle.click();
    const resolvedThread = page.locator(".comment-thread--resolved");
    await expect(resolvedThread).toHaveCount(1);
    await resolvedThread.getByRole("button", { name: "Reopen", exact: true }).click();

    await expect(page.locator(".comments-panel .comment-thread")).toHaveCount(1);
    await expect(page.locator(".comment-thread--resolved")).toHaveCount(0);

    await page
      .locator(".comments-panel .comment-thread")
      .first()
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.locator(".comments-panel .comment-thread")).toHaveCount(0);
    await expect(page.locator(".pg-comment-mark")).toHaveCount(0);
    await expect(page.getByText("Select text in the page")).toBeVisible();
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
