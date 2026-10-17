export interface JoinCodePayload {
  host: string;
  port: number;
  room: string;
  password: string;
}

const PREFIX = "PG1.";
const MIN_PASSWORD_LENGTH = 8;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeJoinCode(payload: JoinCodePayload): string {
  const json = JSON.stringify({
    h: payload.host,
    p: payload.port,
    r: payload.room,
    w: payload.password,
  });
  return PREFIX + bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeJoinCode(code: string): JoinCodePayload | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) {
    return null;
  }
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(trimmed.slice(PREFIX.length)));
    const parsed = JSON.parse(json) as { h?: unknown; p?: unknown; r?: unknown; w?: unknown };
    if (
      typeof parsed.h !== "string" ||
      parsed.h.length === 0 ||
      typeof parsed.p !== "number" ||
      !Number.isInteger(parsed.p) ||
      parsed.p <= 0 ||
      parsed.p > 65535 ||
      typeof parsed.r !== "string" ||
      parsed.r.length === 0 ||
      parsed.r.length > 128 ||
      typeof parsed.w !== "string" ||
      parsed.w.length < MIN_PASSWORD_LENGTH
    ) {
      return null;
    }
    return { host: parsed.h, port: parsed.p, room: parsed.r, password: parsed.w };
  } catch {
    return null;
  }
}
