import { app, shell } from "electron";
import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

class Logger {
  private logDir: string = "";
  private logPath: string = "";
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    try {
      this.logDir = join(app.getPath("userData"), "logs");
      mkdirSync(this.logDir, { recursive: true });
      this.logPath = join(this.logDir, "app.log");
      this.initialized = true;

      this.info("--------------------------------------------------");
      this.info(`NotionFlow starting: v${app.getVersion()}`);
      this.info(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
      this.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}, Chrome: ${process.versions.chrome}`);
      this.info(`User Data Path: ${app.getPath("userData")}`);
      this.info("--------------------------------------------------");

      process.on("uncaughtException", (error) => {
        this.error("Uncaught exception in main process:", error);
      });

      process.on("unhandledRejection", (reason) => {
        this.error("Unhandled promise rejection in main process:", reason);
      });
    } catch (e) {
      console.error("Failed to initialize logger:", e);
    }
  }

  public getLogPath(): string {
    return this.logPath;
  }

  public openLogFolder(): void {
    if (this.logPath && existsSync(this.logPath)) {
      shell.showItemInFolder(this.logPath);
    } else if (this.logDir && existsSync(this.logDir)) {
      void shell.openPath(this.logDir);
    }
  }

  private write(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? " " + args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") : "";
    const line = `[${timestamp}] [${level}] ${message}${formattedArgs}\n`;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[${level}] ${message}${formattedArgs}`);
    }

    if (!this.initialized || !this.logPath) return;

    try {
      if (existsSync(this.logPath) && statSync(this.logPath).size > MAX_LOG_SIZE_BYTES) {
        // Simple rotation
        const backup = join(this.logDir, "app.old.log");
        try {
          appendFileSync(backup, line, "utf8");
        } catch {
          // ignore rotation error
        }
      }
      appendFileSync(this.logPath, line, "utf8");
    } catch {
      // Never let logging crashes crash the app
    }
  }

  public info(message: string, ...args: unknown[]): void {
    this.write("INFO", message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.write("WARN", message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.write("ERROR", message, ...args);
  }
}

export const logger = new Logger();
