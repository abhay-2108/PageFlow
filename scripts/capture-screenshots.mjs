import { _electron as electron } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const assetsDir = join(projectRoot, "assets");
mkdirSync(assetsDir, { recursive: true });

async function run() {
  console.log("[capture] Launching PageFlow via Playwright...");
  const app = await electron.launch({
    args: [projectRoot],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: "",
    },
  });

  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForSelector(".shell", { timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log("[capture] Capturing editor preview...");
  await page.screenshot({
    path: join(assetsDir, "editor-preview.png"),
    animations: "disabled",
  });
  console.log("[capture] Saved assets/editor-preview.png");

  // Navigate to database page if available
  const roadmapItem = page.locator(".tree-row", { hasText: /roadmap|database|product/i }).first();
  if (await roadmapItem.isVisible()) {
    console.log("[capture] Clicking Roadmap page...");
    await roadmapItem.click();
    await page.waitForTimeout(1500);

    // Switch to board view if tab or button exists
    const boardTab = page.locator("button, .pg-db-view-tab", { hasText: /board|kanban/i }).first();
    if (await boardTab.isVisible()) {
      await boardTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: join(assetsDir, "database-board.png"),
      animations: "disabled",
    });
    console.log("[capture] Saved assets/database-board.png");
  }

  // Open AI Assistant drawer
  console.log("[capture] Opening PageFlow AI Assistant drawer...");
  const aiBtn = page.locator("button.sidebar__nav-item", { hasText: /PageFlow AI|NotionFlow AI/i }).first();
  if (await aiBtn.isVisible()) {
    await aiBtn.click();
  } else {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("pageflow:toggle-ai")));
  }
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: join(assetsDir, "ai-assistant.png"),
    animations: "disabled",
  });
  console.log("[capture] Saved assets/ai-assistant.png");

  console.log("[capture] Done! Closing application...");
  await app.close();
}

run().catch((err) => {
  console.error("[capture] Failed:", err);
  process.exit(1);
});
