import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("docs/rea/evidence.json", "utf8");
const doc = JSON.parse(raw);
const nodes = doc.normalized_result.graph.nodes;

const locOf = (o) => {
  const l = o?.evidence?.location?.value;
  if (!l) return "n/a";
  if (l.kind === "source-range") return `${l.source}:L${l.start.line}:C${l.start.column}`;
  return JSON.stringify(l).slice(0, 60);
};

console.log("=== nodes/observations mentioning __electronApi ===");
const apiNodes = [];
for (const n of nodes) {
  for (const o of n.observations) {
    const js = JSON.stringify(o.properties ?? {});
    if (!js.includes("__electronApi")) continue;
    apiNodes.push({ node_id: n.node_id, kind: n.kind, at: locOf(o), props: o.properties });
  }
}
console.log(`observations: ${apiNodes.length}`);
for (const a of apiNodes) {
  const p = a.props ?? {};
  const memberInfo = p.members ? `members(${p.members.length})` : p.api_members ? `api_members(${p.api_members.length})` : "";
  const cp = p.call_paths ? `call_paths(${p.call_paths.length})` : "";
  console.log(`- ${a.kind} @ ${a.at} ${memberInfo} ${cp}`);
  console.log(`   propKeys: ${Object.keys(p).join(", ").slice(0, 300)}`);
}

const members = new Set();
const callPaths = [];
for (const a of apiNodes) {
  const p = a.props ?? {};
  for (const listKey of ["members", "api_members", "exposed_members"]) {
    for (const m of p[listKey] ?? []) members.add(typeof m === "string" ? m : JSON.stringify(m).slice(0, 80));
  }
  for (const cpRow of p.call_paths ?? []) {
    callPaths.push({
      entry: cpRow.entry ?? cpRow.entry_kind ?? null,
      entry_path: cpRow.entry_path ?? null,
      channel: cpRow.channel ?? null,
      terminal: cpRow.terminal ?? null,
      resolution: cpRow.resolution ?? null,
      steps: Array.isArray(cpRow.steps) ? cpRow.steps.length : 0,
    });
  }
}
console.log(`\n=== exposed members (${members.size}) ===`);
console.log([...members].sort().join(", ").slice(0, 4000));

console.log(`\n=== call paths (${callPaths.length}) ===`);
const seen = new Set();
for (const cp of callPaths) {
  const k = `${cp.entry}|${cp.channel}|${cp.terminal}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`  ${cp.entry} -> ${cp.channel} -> ${cp.terminal} [${cp.resolution}] steps=${cp.steps}`);
}
writeFileSync("docs/rea/facts-electronapi.json", JSON.stringify({ members: [...members].sort(), callPaths }, null, 2));

console.log("\n=== preload-sourced observations ===");
const preloadSeen = new Set();
for (const n of nodes) {
  for (const o of n.observations) {
    const src = o.evidence?.location?.value?.source ?? "";
    if (!/preload/i.test(src)) continue;
    const key = `${n.kind}|${src}`;
    if (preloadSeen.has(key)) continue;
    preloadSeen.add(key);
    const pk = Object.keys(o.properties ?? {});
    console.log(`- ${n.kind} | ${src} | ${locOf(o)} | propKeys: ${pk.join(", ").slice(0, 200)}`);
  }
}
console.log(`preload-sourced distinct: ${preloadSeen.size}`);
