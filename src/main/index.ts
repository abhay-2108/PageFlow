import { BrowserWindow, Menu, app, session } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND } from "../shared/brand";
import { registerIpc } from "./ipc";
import { stopSession } from "./session/server";
import { WorkspaceDb } from "./workspace/db";

const currentDir = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

let workspace: WorkspaceDb | null = null;

function resolveWorkspaceDir(): string {
  const override = process.env["PAGEGROVE_WORKSPACE"];
  if (override && override.trim().length > 0) {
    return override;
  }
  return join(app.getPath("documents"), BRAND.name);
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

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void window.loadFile(join(currentDir, "../renderer/index.html"));
  }
}

app.setAppUserModelId("com.pagegrove.app");

app.whenReady().then(() => {
  workspace = new WorkspaceDb(resolveWorkspaceDir());
  registerIpc(workspace);

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
