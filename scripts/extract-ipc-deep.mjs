import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("docs/rea/evidence.json", "utf8");
const doc = JSON.parse(raw);
const nr = doc.normalized_result;
const nodes = nr.graph.nodes;
const edges = nr.graph.edges;
const byId = new Map(nodes.map((n) => [n.node_id, n]));

console.log("=== semantic_graph shape ===");
for (const [k, v] of Object.entries(nr.semantic_graph)) {
  const d = Array.isArray(v) ? `array(${v.length})` : typeof v === "object" && v ? `object(${Object.keys(v).length})` : JSON.stringify(v).slice(0, 80);
  console.log(`  ${k}: ${d}`);
}
const sg = nr.semantic_graph;
for (const key of ["nodes", "relations", "edges"]) {
  if (Array.isArray(sg[key]) && sg[key].length) {
    console.log(`  sample ${key}[0]:`, JSON.stringify(sg[key][0]).slice(0, 400));
  }
}

console.log("\n=== edges: exposes / sends / handles / loads ===");
const interesting = edges.filter((e) => ["exposes", "sends", "handles", "loads"].includes(e.relation));
const rows = [];
for (const e of interesting) {
  const s = byId.get(e.source_node_id);
  const t = byId.get(e.target_node_id);
  const props = JSON.stringify(e.properties ?? {}).slice(0, 220);
  const ev = e.evidence?.[0] ?? e.evidence;
  const locv = ev?.location?.value;
  const at = locv?.kind === "source-range" ? `${locv.source}:L${locv.start.line}:C${locv.start.column}` : "n/a";
  rows.push({ relation: e.relation, source: s ? `${s.kind}` : "?", target: t ? `${t.kind}` : "?", props, at });
}
writeFileSync("docs/rea/facts-ipc-edges.json", JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${r.relation} | ${r.source} -> ${r.target} | ${r.at} | ${r.props}`);
console.log(`(all ${rows.length} rows in docs/rea/facts-ipc-edges.json)`);

console.log("\n=== modules with preload/tab_browser sources ===");
let printed = 0;
for (const n of nodes) {
  if (n.kind !== "javascript-module") continue;
  for (const o of n.observations) {
    const src = o.evidence?.location?.value?.source ?? "";
    if (!/preload|tab_browser/i.test(src)) continue;
    const p = o.properties ?? {};
    const ipc = p.ipc ?? p.ipc_channels ?? null;
    console.log(`- ${src} :: exports=${JSON.stringify(p.exports ?? null).slice(0, 160)}`);
    if (ipc) console.log(`    ipc=${JSON.stringify(ipc).slice(0, 300)}`);
    for (const k of ["endpoints", "storage", "requires", "bundler_registrations"]) {
      if (Array.isArray(p[k]) && p[k].length) {
        console.log(`    ${k}(${p[k].length})[0..2]=${JSON.stringify(p[k].slice(0, 3)).slice(0, 260)}`);
      }
    }
    printed++;
    break;
  }
}
console.log(`preload/tab_browser modules printed: ${printed}`);

console.log("\n=== raw probes ===");
for (const s of ["contextBridge", "__electronApi", "clipboard", "ipcRenderer", "WebContentsView", "BrowserView", "nativeTheme", "Menu.buildFromTemplate", "shell.openExternal"]) {
  let idx = 0, count = 0; const samples = [];
  while (true) { idx = raw.indexOf(s, idx); if (idx === -1) break; count++; if (samples.length < 3) { const sm = raw.slice(Math.max(0, idx - 100), idx + s.length + 130).replace(/\s+/g, " "); if (!samples.some((x) => x.slice(70, 150) === sm.slice(70, 150))) samples.push(sm); } idx += s.length; }
  console.log(`\n"${s}": ${count}`);
  for (const sm of samples.slice(0, 3)) console.log("   ..." + sm.slice(0, 220));
}

console.log("\n=== unique notion:* literals ===");
const notionStrs = new Set();
for (const m of raw.matchAll(/"notion:[A-Za-z0-9_.:-]{1,80}"/g)) notionStrs.add(m[0]);
console.log([...notionStrs].join("\n") || "(none)");

console.log("\n=== createKey factories ===");
const keys = new Set();
for (const m of raw.matchAll(/createKey\(\\?"([^"\\]{1,60})\\?"\)/g)) keys.add(m[1]);
console.log([...keys].join(", ") || "(none)");
