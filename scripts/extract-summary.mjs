import { readFileSync } from "node:fs";

const doc = JSON.parse(readFileSync("docs/rea/evidence.json", "utf8"));
const nr = doc.normalized_result;

console.log("=== summary ===");
console.log(JSON.stringify(nr.summary, null, 2).slice(0, 6000));
console.log("=== statistics ===");
console.log(JSON.stringify(nr.statistics, null, 2).slice(0, 3000));

const kindCounts = {};
for (const n of nr.graph.nodes) kindCounts[n.kind] = (kindCounts[n.kind] ?? 0) + 1;
console.log("=== node kinds ===");
console.log(JSON.stringify(kindCounts, null, 2));

const relCounts = {};
for (const e of nr.graph.edges) {
  const r = typeof e.relation === "string" ? e.relation : JSON.stringify(e.relation).slice(0, 120);
  relCounts[r] = (relCounts[r] ?? 0) + 1;
}
console.log("=== edge relations ===");
console.log(JSON.stringify(relCounts, null, 2));

for (const kind of Object.keys(kindCounts)) {
  if (/ipc|preload|expos|channel|boundary|window/i.test(kind)) {
    const sample = nr.graph.nodes.find((n) => n.kind === kind);
    console.log(`--- sample kind=${kind} ---`);
    console.log(JSON.stringify(sample, null, 2).slice(0, 1600));
  }
}
