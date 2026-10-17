import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { makeWorkspace, projectRoot, removeWorkspace } from "./helpers";

const packagedExe = join(projectRoot, "release", "win-unpacked", "Pagegrove.exe");

test("packaged app launches, edits, and persists across relaunch", async () => {
  test.skip(!existsSync(packagedExe), "release/win-unpacked/Pagegrove.exe not built; run pnpm dist:dir");
  const dir = makeWorkspace();

  const launch = () =>
    electron.launch({
      executablePath: packagedExe,
      args: [`--user-data-dir=${join(dir, ".userdata")}`],
      env: {
        ...process.env,
        PAGEGROVE_WORKSPACE: dir,
        ELECTRON_RENDERER_URL: "",
      },
    });

  try {
    const app = await launch();
    const page = await app.firstWindow();
    await page.waitForSelector(".shell", { timeout: 30_000 });

    await page.getByRole("button", { name: "Create a page" }).click();
    await page.getByLabel("Page title").fill("Packaged");
    await page.waitForTimeout(700);
    await page.locator(".pg-editor").click();
    await page.keyboard.type("packaged body", { delay: 20 });
    await page.waitForTimeout(800);
    await app.close();

    const relaunched = await launch();
    const page2 = await relaunched.firstWindow();
    await page2.waitForSelector(".shell", { timeout: 30_000 });
    await page2.locator(".tree-row__title", { hasText: "Packaged" }).click();
    await expect(page2.locator(".pg-editor")).toContainText("packaged body", { timeout: 15_000 });
    await relaunched.close();
  } finally {
    removeWorkspace(dir);
  }
});
