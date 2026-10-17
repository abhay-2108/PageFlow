import { readFileSync } from "node:fs";

const p = process.argv[2] ?? "docs/rea/evidence.json";
const raw = readFileSync(p, "utf8");
console.log("bytes:", raw.length);
const doc = JSON.parse(raw);

const describe = (v) => {
  if (Array.isArray(v)) return `array(${v.length})`;
  if (v === null) return "null";
  if (typeof v === "object") return `object(${Object.keys(v).length} keys)`;
  return typeof v;
};

console.log("== top-level " + Object.keys(doc).join(", "));

const stack = [[doc, ""]];
let visited = 0;
while (stack.length && visited < 400) {
  const [obj, prefix] = stack.shift();
  if (!obj || typeof obj !== "object") continue;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    visited++;
    const path = prefix ? `${prefix}.${k}` : k;
    const d = describe(v);
    if (d.startsWith("object") || d.startsWith("array")) {
      console.log(`${path}: ${d}`);
      if (d === "object(0 keys)") continue;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
        console.log(`   [0] keys: ${Object.keys(v[0]).join(", ")}`);
      }
      if (stack.length < 300) stack.push([v, path]);
    }
  }
}
