import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openApp, removeWorkspace, setPageTitle } from "./helpers";

const PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("image upload, paste, cover upload, export, and reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pagegrove-e2e-"));
  const pixelPath = join(dir, "pixel.png");
  writeFileSync(pixelPath, Buffer.from(PIXEL_PNG_BASE64, "base64"));
  const exportPath = join(dir, "media-export.md");
  const { app, page } = await openApp(dir);

  try {
    await page.getByRole("button", { name: "Create a page" }).click();
    await setPageTitle(page, "Media");

    await app.evaluate(
      ({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      pixelPath,
    );

    await page.locator(".pg-editor").click();
    await page.keyboard.type("/image");
    const slashMenu = page.getByRole("listbox", { name: "Blocks" });
    await expect(slashMenu).toBeVisible();
    await slashMenu.getByRole("option", { name: "Image" }).click();

    const images = page.locator(".pg-image img");
    await expect(images).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Array.from(document.querySelectorAll<HTMLImageElement>(".pg-image img")).map(
              (img) => img.naturalWidth > 0,
            ),
        ),
      )
      .toEqual([true]);
    const src = await images.first().getAttribute("src");
    expect(src?.startsWith("pgfile:///assets/")).toBe(true);

    await page.evaluate((bytes: number[]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "pasted.png", { type: "image/png" }));
      const event = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      document.querySelector(".pg-editor")!.dispatchEvent(event);
    }, Array.from(Buffer.from(PIXEL_PNG_BASE64, "base64")));

    await expect(images).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Array.from(document.querySelectorAll<HTMLImageElement>(".pg-image img")).filter(
              (img) => img.naturalWidth > 0,
            ).length,
        ),
      )
      .toBe(2);

    await page.getByRole("button", { name: "Add cover" }).click();
    const coverDialog = page.getByRole("dialog", { name: "Page cover" });
    await expect(coverDialog).toBeVisible();
    await coverDialog.getByRole("button", { name: "Upload image" }).click();

    const coverImage = page.locator(".page__cover--asset img");
    await expect(coverImage).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const img = document.querySelector<HTMLImageElement>(".page__cover--asset img");
          return img ? img.naturalWidth > 0 : false;
        }),
      )
      .toBe(true);

    const assetFiles = readdirSync(join(dir, "assets"));
    expect(assetFiles.length).toBeGreaterThanOrEqual(3);
    expect(assetFiles.every((name) => name.endsWith(".png"))).toBe(true);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.getByLabel("Page title")).toHaveValue("Media");
    await expect(page.locator(".pg-image img")).toHaveCount(2);
    await expect(page.locator(".page__cover--asset img")).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLImageElement>("img")).every(
            (img) => img.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);

    await app.evaluate(
      ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      },
      exportPath,
    );
    await page.keyboard.press("Control+k");
    await page.keyboard.type("export page as markdown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Exported/)).toBeVisible({ timeout: 15_000 });

    const markdown = readFileSync(exportPath, "utf8");
    expect(markdown).toMatch(/!\[pixel\]\(assets\/[0-9a-f-]+\.png\)/);
    expect(markdown).toMatch(/!\[pasted\]\(assets\/[0-9a-f-]+\.png\)/);

    await page.locator(".pg-image img").first().click();
    await page.getByRole("button", { name: "Delete image" }).click();
    await expect(page.locator(".pg-image img")).toHaveCount(1);

    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page.locator(".pg-image img")).toHaveCount(1);
  } finally {
    await app.close();
    removeWorkspace(dir);
  }
});
