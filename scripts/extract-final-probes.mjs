import { readFileSync } from "node:fs";

const raw = readFileSync("docs/rea/evidence.json", "utf8");
const doc = JSON.parse(raw);
const nr = doc.normalized_result;

console.log("=== graph coverage ===");
console.log(JSON.stringify(nr.graph.coverage, null, 2).slice(0, 1200));
console.log("\n=== semantic coverage ===");
console.log(JSON.stringify(nr.semantic_graph.coverage, null, 2).slice(0, 1200));

console.log("\n=== limitations grouped ===");
const lims = [...(doc.limitations ?? []), ...(nr.limitations ?? [])];
const byCode = {};
for (const l of lims) {
  const code = typeof l === "string" ? l.slice(0, 60) : (l.code ?? l.kind ?? JSON.stringify(l).slice(0, 60));
  byCode[code] = (byCode[code] ?? 0) + 1;
}
console.log(JSON.stringify(byCode, null, 2).slice(0, 2500));
const samples = [...new Set(lims.map((l) => JSON.stringify(l).slice(0, 220)))].slice(0, 12);
console.log("distinct samples:");
for (const s of samples) console.log("  - " + s);

console.log("\n=== projection failure reason (tab_browser_view preload) ===");
const nodes = nr.graph.nodes;
for (const n of nodes) {
  for (const o of n.observations) {
    const src = o.evidence?.location?.value?.source ?? "";
    if (!src.includes("tab_browser_view/preload")) continue;
    const pf = o.properties?.application_projection_failure;
    if (pf) console.log(JSON.stringify(pf).slice(0, 800));
  }
}

const probe = (s, label) => {
  console.log(`\n--- probe: ${label ?? s} ---`);
  let idx = 0;
  let count = 0;
  const samples = [];
  while (true) {
    idx = raw.indexOf(s, idx);
    if (idx === -1) break;
    count++;
    if (samples.length < 2) {
      const sm = raw.slice(Math.max(0, idx - 150), idx + s.length + 220).replace(/\s+/g, " ");
      if (!samples.some((x) => x.slice(30, 120) === sm.slice(30, 120))) samples.push(sm);
    }
    idx += s.length;
  }
  console.log(`count=${count}`);
  for (const sm of samples) console.log("   ..." + sm.slice(0, 330));
};

probe("toggle-compose-menu");
probe("performShortcut");
probe('"notion:copy"');
probe('"notion:paste"');
probe("set-theme");
probe("isNotionWebContents");
probe("Ctrl+");
probe("CmdOrCtrl");
probe("quick-search-open-cmd-k", "maybe cmd-k quick search channel variant");
