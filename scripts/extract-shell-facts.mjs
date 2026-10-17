import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("docs/rea/evidence.json", "utf8");
const doc = JSON.parse(raw);
const nodes = doc.normalized_result.graph.nodes;

const KINDS = [
  "ipc-channel",
  "ipc-handler",
  "electron-renderer",
  "context-bridge-api",
  "electron-utility",
  "electron-main",
  "endpoint",
  "worker",
  "storage",
  "native-addon",
];

const pickProps = (p) => {
  if (!p) return {};
  const keys = [
    "side",
    "operation",
    "mode",
    "channel",
    "channel_expression",
    "resolution",
    "handler_kind",
    "event",
    "exposure_mechanism",
    "api_name",
    "api_key",
    "source_path",
    "url",
    "role",
    "member_count",
  ];
  const out = {};
  for (const k of keys) if (k in p) out[k] = p[k];
  const rest = Object.keys(p).filter((k) => !keys.includes(k) && !k.endsWith("_location") && k !== "web_preferences" && k !== "members");
  if (rest.length) out.__other = rest.slice(0, 8);
  return out;
};

const loc = (o) => {
  const l = o?.evidence?.location?.value;
  if (!l) return "n/a";
  if (l.kind === "source-range") return `${l.source}:L${l.start.line}:C${l.start.column}`;
  return JSON.stringify(l).slice(0, 60);
};

const table = [];
for (const n of nodes) {
  if (!KINDS.includes(n.kind)) continue;
  for (const o of n.observations) {
    table.push({
      kind: n.kind,
      node_id: n.node_id.slice(0, 24),
      label: (o.label ?? "").slice(0, 90),
      props: pickProps(o.properties),
      at: loc(o),
      confidence: o.evidence?.confidence,
    });
  }
}
console.log("boundary observations:", table.length);
writeFileSync("docs/rea/facts-shell.json", JSON.stringify(table, null, 2));
for (const t of table.slice(0, 140)) {
  console.log(`${t.kind} | ${t.at} | conf=${t.confidence} | ${JSON.stringify(t.props)}`);
}
if (table.length > 140) console.log(`... ${table.length - 140} more rows written to docs/rea/facts-shell.json`);

const cb = nodes.find((n) => n.kind === "context-bridge-api");
console.log("\ncontext-bridge-api node observations:", cb?.observations?.length);
if (cb) {
  console.log("identity:", JSON.stringify(cb.identity).slice(0, 300));
  for (const o of (cb.observations ?? []).slice(0, 30)) {
    console.log("  member:", (o.label ?? JSON.stringify(o.properties ?? {})).slice(0, 120), "|", loc(o));
  }
  if ((cb.observations?.length ?? 0) > 30) console.log(`  ... +${cb.observations.length - 30} more`);
}

console.log("\n=== raw string probes ===");
const probes = [
  "CommandOrControl+",
  "acce",
  "accelerator",
  "globalShortcut",
  "notion:clipboard",
  "notionvc",
  "isNotionWebContents",
  "text/_notion",
  "slash",
  "menu_template",
  "registerShortcut",
];
for (const s of probes) {
  let idx = 0;
  let count = 0;
  const samples = [];
  while (true) {
    idx = raw.indexOf(s, idx);
    if (idx === -1) break;
    count++;
    if (samples.length < 4 && count > 0) {
      const sm = raw.slice(Math.max(0, idx - 80), idx + s.length + 100).replace(/\s+/g, " ");
      if (!samples.some((x) => x.slice(60, 140) === sm.slice(60, 140))) samples.push(sm);
    }
    idx += s.length;
  }
  console.log(`\n"${s}": ${count} occurrence(s)`);
  for (const sm of samples.slice(0, 4)) console.log("   ..." + sm.slice(0, 190));
}
