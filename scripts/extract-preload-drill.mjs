import { readFileSync, writeFileSync } from "node:fs";

const doc = JSON.parse(readFileSync("docs/rea/evidence.json", "utf8"));
const nodes = doc.normalized_result.graph.nodes;

let budget = 400000;
function findPaths(obj, pred, path = "", out = [], depth = 0) {
  if (depth > 40 || budget <= 0 || out.length > 2000) return out;
  budget--;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length && out.length <= 2000; i++) {
      findPaths(obj[i], pred, `${path}[${i}]`, out, depth + 1);
    }
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (budget <= 0 || out.length > 2000) break;
      const p = path ? `${path}.${k}` : k;
      if (pred(k, v)) out.push({ path: p, key: k, value: v });
      findPaths(v, pred, p, out, depth + 1);
    }
  }
  return out;
}

const KEYS = new Set([
  "api_key",
  "context_bridge_apis",
  "exposed_api_members",
  "call_paths",
  "members",
  "unknown_members",
  "ipc",
  "sender_validation",
]);

const target = nodes.filter((n) => {
  const s = JSON.stringify(n.observations?.[0]?.evidence?.location?.value ?? {});
  return n.kind === "javascript-asset" && s.includes("tab_browser_view/preload.js");
});
console.log("matched asset nodes:", target.length);

const findings = [];
for (const n of target) {
  for (const o of n.observations) {
    budget = 400000;
    const hits = findPaths(o.properties ?? {}, (k) => KEYS.has(k));
    for (const h of hits) findings.push({ node_id: n.node_id, obsPath: h.path, key: h.key, value: h.value });
  }
}
console.log("findings:", findings.length);

const memberLists = findings.filter((f) => ["exposed_api_members", "members"].includes(f.key));
const bridges = findings.filter((f) => f.key === "context_bridge_apis");
const callPaths = findings.filter((f) => f.key === "call_paths");

for (const b of bridges) {
  const arr = Array.isArray(b.value) ? b.value : [];
  console.log(`\n=== context_bridge_apis @ ${b.obsPath} (${arr.length}) ===`);
  for (const api of arr.slice(0, 40)) {
    const memberCount = api.members?.length ?? api.exposed_api_members?.length ?? null;
    console.log(`  api_key=${api.api_key} world=${api.world} status=${api.api_status} members=${memberCount}`);
  }
}

const allMembers = new Set();
for (const m of memberLists) {
  const arr = Array.isArray(m.value) ? m.value : [];
  for (const x of arr) allMembers.add(typeof x === "string" ? x : JSON.stringify(x).slice(0, 100));
}
console.log(`\n=== member lists found: ${memberLists.length}, unique members: ${allMembers.size} ===`);
console.log([...allMembers].sort().join(", ").slice(0, 6000));

const cpFlat = [];
for (const c of callPaths) {
  const arr = Array.isArray(c.value) ? c.value : [];
  for (const row of arr) {
    cpFlat.push({
      entry: row.entry_path ? row.entry_path.join(".") : row.entry,
      channel: row.channel,
      terminal: row.terminal,
      resolution: row.resolution,
      stepCount: Array.isArray(row.steps) ? row.steps.length : 0,
    });
  }
}
console.log(`\n=== call paths: ${cpFlat.length} ===`);
const seen = new Set();
for (const r of cpFlat) {
  const k = `${r.entry}|${r.channel}|${r.terminal}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`  ${r.entry} -> ${r.channel} -> ${r.terminal} [${r.resolution}]`);
}
writeFileSync("docs/rea/facts-electronapi.json", JSON.stringify({ uniqueMembers: [...allMembers].sort(), callPaths: [...seen].map((s) => { const [entry, channel, terminal] = s.split("|"); return { entry, channel, terminal }; }) }, null, 2));
console.log("\nwritten docs/rea/facts-electronapi.json");
