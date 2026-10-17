import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { encodeJoinCode } from "../../shared/join-code";
import { SignalingServer } from "./signaling";

export function pickLanAddress(): string {
  const candidates: string[] = [];
  const interfaces = networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const entry of list ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }
      candidates.push(entry.address);
    }
  }
  const preferred = candidates.find(
    (address) =>
      address.startsWith("192.168.") ||
      address.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address),
  );
  return preferred ?? candidates[0] ?? "127.0.0.1";
}

interface ActiveSession {
  port: number;
  room: string;
  code: string;
  server: SignalingServer;
}

let active: ActiveSession | null = null;

export async function startSession(): Promise<{ port: number; code: string }> {
  if (active) {
    return { port: active.port, code: active.code };
  }
  const server = new SignalingServer();
  try {
    const port = await server.start(0);
    const room = `pg-${randomBytes(9).toString("base64url")}`;
    const password = randomBytes(18).toString("base64url");
    const host = pickLanAddress();
    const code = encodeJoinCode({ host, port, room, password });
    active = { port, room, code, server };
    return { port, code };
  } catch (error) {
    await server.stop().catch(() => undefined);
    throw error;
  }
}

export async function stopSession(): Promise<void> {
  const current = active;
  active = null;
  if (current) {
    await current.server.stop().catch(() => undefined);
  }
}

export function isSessionRunning(): boolean {
  return active !== null;
}
