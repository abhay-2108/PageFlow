import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const appData = process.env.APPDATA;
const roots = [
  join(appData, "Notion", "Partitions", "notion", "Cache", "Cache_Data"),
  join(appData, "Notion", "Partitions", "notion", "Network"),
  join(appData, "Notion", "Cache", "Cache_Data"),
  join(appData, "Notion", "Network"),
].filter((root) => existsSync(root));

const outDir = join("docs", "rea", "cache-extract");
mkdirSync(outDir, { recursive: true });

const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const MIN_JS_BYTES = 64 * 1024;

function looksLikeJs(buf) {
  const head = buf.subarray(0, 2048).toString("latin1");
  if (head.includes("<!DOCTYPE") || head.includes("<html")) {
    return false;
  }
  return (
    head.includes("webpackChunk") ||
    head.includes("__webpack") ||
    head.includes("function") ||
    head.includes('"use strict"') ||
    head.includes("'use strict'")
  );
}

function tryGunzip(buf) {
  try {
    const data = gunzipSync(buf);
    return data.length > MIN_JS_BYTES ? data : null;
  } catch {
    return null;
  }
}

function scanGzipMembers(buf, results) {
  const magic = Buffer.from([0x1f, 0x8b]);
  let from = 0;
  while (results.length < 200) {
    const idx = buf.indexOf(magic, from);
    if (idx === -1) {
      break;
    }
    const data = tryGunzip(buf.subarray(idx));
    if (data && looksLikeJs(data)) {
      results.push(data);
      from = idx + 2 + data.length;
    } else {
      from = idx + 2;
    }
  }
}

function scanPlainJs(buf, results) {
  if (buf.length < MIN_JS_BYTES) {
    return;
  }
  if (looksLikeJs(buf)) {
    results.push(buf);
  }
}

let written = 0;
let totalBytes = 0;
let counter = 0;
const seen = new Set();

for (const root of roots) {
  for (const name of readdirSync(root)) {
    const filePath = join(root, name);
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size < MIN_JS_BYTES) {
      continue;
    }
    let buf;
    try {
      buf = readFileSync(filePath);
    } catch {
      continue;
    }

    const results = [];
    scanGzipMembers(buf, results);
    scanPlainJs(buf, results);

    for (const data of results) {
      if (totalBytes + data.length > MAX_TOTAL_BYTES) {
        break;
      }
      const digest = data.subarray(0, 64).toString("base64url");
      if (seen.has(digest + ":" + data.length)) {
        continue;
      }
      seen.add(digest + ":" + data.length);
      counter += 1;
      const outPath = join(outDir, `chunk-${String(counter).padStart(3, "0")}.js`);
      writeFileSync(outPath, data);
      written += 1;
      totalBytes += data.length;
      console.log(`wrote ${outPath} (${(data.length / 1024).toFixed(0)} KiB) from ${filePath}`);
    }
  }
}

console.log(`\nExtracted ${written} JS blobs, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB total -> ${outDir}`);
if (written === 0) {
  console.log("Nothing found. Open Notion normally for a minute or two (browse pages), close it, then re-run this script.");
}
