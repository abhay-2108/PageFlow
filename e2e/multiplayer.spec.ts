import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { userInfo } from "node:os";
import { makeWorkspace, openApp, removeWorkspace } from "./helpers";

test.describe.configure({ mode: "serial" });

const CONVERGE_TIMEOUT = 30_000;
const userName = userInfo().username;

async function typeInEditor(page: Page, text: string): Promise<void> {
  await page.locator(".pg-editor").click();
  await page.keyboard.type(text, { delay: 20 });
}

test("two instances converge on tree and content over a live session", async () => {
  const workspaceA = makeWorkspace();
  const workspaceB = makeWorkspace();
  let appA: ElectronApplication | null = null;
  let appB: ElectronApplication | null = null;

  try {
    const a = await openApp(workspaceA);
    appA = a.app;
    const pageA = a.page;

    await pageA.getByRole("button", { name: "New page" }).click();
    const titleA = pageA.locator(".page__title");
    await expect(titleA).toHaveValue("", { timeout: 10_000 });
    await titleA.fill("Shared Notes");
    await titleA.press("Enter");

    await pageA.locator(".pg-editor").click();
    await pageA.keyboard.type("hello from A", { delay: 20 });
    await expect(pageA.locator(".tree-row__title", { hasText: "Shared Notes" })).toBeVisible();

    await pageA.getByRole("button", { name: "Live" }).click();
    await pageA.getByRole("button", { name: "Start a session" }).click();
    const codeNode = pageA.getByTestId("session-code");
    await expect(codeNode).toBeVisible({ timeout: 15_000 });
    const joinCode = (await codeNode.textContent())?.trim() ?? "";
    expect(joinCode.startsWith("PG1.")).toBe(true);

    const b = await openApp(workspaceB);
    appB = b.app;
    const pageB = b.page;

    await pageB.getByRole("button", { name: "Live" }).click();
    await pageB.getByLabel("Join code").fill(joinCode);
    await pageB.getByRole("button", { name: "Join" }).click();
    await expect(pageB.getByRole("button", { name: "Leave session" })).toBeVisible({
      timeout: 15_000,
    });

    const rowOnB = pageB.locator(".tree-row__title", { hasText: "Shared Notes" });
    await expect(rowOnB).toBeVisible({ timeout: CONVERGE_TIMEOUT });

    await rowOnB.click();
    const editorB = pageB.locator(".pg-editor");
    await expect(editorB).toContainText("hello from A", { timeout: CONVERGE_TIMEOUT });

    await typeInEditor(pageB, " and hello from B");
    await expect(pageA.locator(".pg-editor")).toContainText("and hello from B", {
      timeout: CONVERGE_TIMEOUT,
    });

    await pageA.getByRole("button", { name: "New page" }).click();
    await expect(pageA.locator(".page__title")).toHaveValue("", { timeout: 10_000 });
    await pageA.locator(".page__title").fill("Second Page");
    await pageA.locator(".page__title").press("Enter");
    await expect(pageB.locator(".tree-row__title", { hasText: "Second Page" })).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });

    await expect(pageA.getByText(userName, { exact: true }).first()).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(pageB.getByText(userName, { exact: true }).first()).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });

    await pageB.getByRole("button", { name: "Leave session" }).click();
    await expect(pageB.getByRole("button", { name: "Live" })).toBeVisible();
    await pageA.getByRole("button", { name: "Stop session" }).click();
    await expect(pageA.getByRole("button", { name: "Live" })).toBeVisible();
  } finally {
    if (appB) {
      await appB.close().catch(() => undefined);
    }
    if (appA) {
      await appA.close().catch(() => undefined);
    }
    removeWorkspace(workspaceA);
    removeWorkspace(workspaceB);
  }
});

test("shared changes survive a solo reload after the session stops", async () => {
  const workspaceA = makeWorkspace();
  const workspaceB = makeWorkspace();
  let appA: ElectronApplication | null = null;
  let appB: ElectronApplication | null = null;

  try {
    const a = await openApp(workspaceA);
    appA = a.app;
    const pageA = a.page;

    await pageA.getByRole("button", { name: "New page" }).click();
    await expect(pageA.locator(".page__title")).toHaveValue("", { timeout: 10_000 });
    await pageA.locator(".page__title").fill("Persist Me");
    await pageA.locator(".page__title").press("Enter");
    await typeInEditor(pageA, "before session");

    await pageA.getByRole("button", { name: "New page" }).click();
    await expect(pageA.locator(".page__title")).toHaveValue("", { timeout: 10_000 });
    await pageA.locator(".page__title").fill("Only on A");
    await pageA.locator(".page__title").press("Enter");

    await pageA.getByRole("button", { name: "Live" }).click();
    await pageA.getByRole("button", { name: "Start a session" }).click();
    const codeNode = pageA.getByTestId("session-code");
    await expect(codeNode).toBeVisible({ timeout: 15_000 });
    const joinCode = (await codeNode.textContent())?.trim() ?? "";

    const b = await openApp(workspaceB);
    appB = b.app;
    const pageB = b.page;
    await pageB.getByRole("button", { name: "Live" }).click();
    await pageB.getByLabel("Join code").fill(joinCode);
    await pageB.getByRole("button", { name: "Join" }).click();
    await expect(pageB.getByRole("button", { name: "Leave session" })).toBeVisible({
      timeout: 15_000,
    });

    const rowOnB = pageB.locator(".tree-row__title", { hasText: "Persist Me" });
    await expect(rowOnB).toBeVisible({ timeout: CONVERGE_TIMEOUT });
    await rowOnB.click();
    const editorB = pageB.locator(".pg-editor");
    await expect(editorB).toContainText("before session", { timeout: CONVERGE_TIMEOUT });
    await typeInEditor(pageB, " plus after session");
    await pageA.locator(".tree-row__title", { hasText: "Persist Me" }).click();
    await expect(pageA.locator(".pg-editor")).toContainText("plus after session", {
      timeout: CONVERGE_TIMEOUT,
    });

    await pageB.getByRole("button", { name: "Leave session" }).click();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await appB.close();
    appB = null;

    await pageA.getByRole("button", { name: "Stop session" }).click();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await appA.close();
    appA = null;

    const reopened = await openApp(workspaceB);
    appB = reopened.app;
    const pageBR = reopened.page;
    const rowOnBR = pageBR.locator(".tree-row__title", { hasText: "Persist Me" });
    await expect(rowOnBR).toBeVisible({ timeout: 15_000 });
    await rowOnBR.click();
    await expect(pageBR.locator(".pg-editor")).toContainText("plus after session", {
      timeout: 15_000,
    });
  } finally {
    if (appB) {
      await appB.close().catch(() => undefined);
    }
    if (appA) {
      await appA.close().catch(() => undefined);
    }
    removeWorkspace(workspaceA);
    removeWorkspace(workspaceB);
  }
});
