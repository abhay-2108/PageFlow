import { BrowserWindow, Menu, app, net, protocol, session } from "electron";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BRAND } from "../shared/brand";
import { registerIpc } from "./ipc";
import { logger } from "./logger";
import { stopSession } from "./session/server";
import { WorkspaceDb } from "./workspace/db";

const currentDir = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: pgfile:",
  "font-src 'self'",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pgfile",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let workspace: WorkspaceDb | null = null;

function registerAssetProtocol(workspaceDir: string): void {
  const assetsRoot = resolve(workspaceDir, "assets");
  protocol.handle("pgfile", async (request) => {
    try {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const target = resolve(assetsRoot, relative);
      if (target !== assetsRoot && !target.startsWith(assetsRoot + sep)) {
        return new Response("Forbidden", { status: 403 });
      }
      return await net.fetch(pathToFileURL(target).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

import { existsSync } from "node:fs";

function resolveWorkspaceDir(): string {
  const override = process.env["NOTIONFLOW_WORKSPACE"] || process.env["PAGEGROVE_WORKSPACE"];
  if (override && override.trim().length > 0) {
    return override;
  }
  const defaultDir = join(app.getPath("documents"), BRAND.name);
  const legacyDir = join(app.getPath("documents"), "Pagegrove");
  if (!existsSync(defaultDir) && existsSync(legacyDir)) {
    return legacyDir;
  }
  return defaultDir;
}

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [PROD_CSP],
      },
    });
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: BRAND.name,
    backgroundColor: "#191817",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(currentDir, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Log level=${level}] ${message} (${sourceId}:${line})`);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Load Failed] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Renderer Process Gone]", details);
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === "i")) {
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools();
      } else {
        window.webContents.openDevTools({ mode: "detach" });
      }
      event.preventDefault();
    }
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void window.loadFile(join(currentDir, "../renderer/index.html"));
  }
}

app.setAppUserModelId("com.notionflow.app");

app.whenReady().then(() => {
  logger.init();
  const workspaceDir = resolveWorkspaceDir();
  logger.info(`Resolved workspace directory: ${workspaceDir}`);
  workspace = new WorkspaceDb(workspaceDir);
  registerIpc(workspace);
  registerAssetProtocol(workspaceDir);

  if (!isDev) {
    Menu.setApplicationMenu(null);
    applyCsp();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  workspace?.close();
  workspace = null;
  void stopSession();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
});
