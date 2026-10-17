import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tokenizer } from "acorn";

const srcDir = join("docs", "rea", "cache-extract");
const outPath = join("docs", "rea", "facts-editor.json");

const groups = {
  shortcuts: [],
  icons: [],
  drag: [],
  mentions: [],
  comments: [],
  database: [],
};

const matchers = [
  {
    group: "shortcuts",
    test: (s) => /^(mod|ctrl|cmd|meta|alt|shift|option|cmdorctrl)[+/-]/i.test(s) || /^(tab|enter|escape)$/i.test(s),
  },
  {
    group: "icons",
    test: (s) =>
      /(page[-_ ]?icon|icon[-_ ]?picker|change[-_ ]?icon|cover[-_ ]?picker|page[-_ ]?cover|remove[-_ ]?cover|random[-_ ]?icon|emoji)/i.test(s) &&
      s.length <= 96,
  },
  {
    group: "drag",
    test: (s) =>
      /(drag|drop[-_ ]?(zone|indicator)|reorder|move[-_ ]?(block|page|to)|droppable|dragHandle|placement)/i.test(s) &&
      s.length <= 96,
  },
  {
    group: "mentions",
    test: (s) => /(backlink|mention|linked[-_ ]?(page|to)|link[-_ ]?to[-_ ]?page)/i.test(s) && s.length <= 96,
  },
  {
    group: "comments",
    test: (s) => /(comment|discussion|thread|repl(y|ies)|resolve[-_ ]?(comment|thread))/i.test(s) && s.length <= 96,
  },
  {
    group: "database",
    test: (s) =>
      /(database|board[-_ ]?view|gallery[-_ ]?view|calendar[-_ ]?view|timeline[-_ ]?view|table[-_ ]?view|view[-_ ]?type|filter[-_ ]?(group|and|or)|sort[-_ ]?by)/i.test(
        s,
      ) && s.length <= 96,
  },
];

const MAX_PER_GROUP = 600;
const seen = new Set();

function interesting(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 160) {
    return null;
  }
  const printable = trimmed.replace(/[^\x20-\x7e]/g, "");
  if (printable.length !== trimmed.length) {
    return null;
  }
  return trimmed;
}

const stats = { files: 0, strings: 0, matches: 0 };

for (const name of readdirSync(srcDir)) {
  if (!name.endsWith(".js")) {
    continue;
  }
  const filePath = join(srcDir, name);
  stats.files += 1;
  const source = readFileSync(filePath, "utf8");
  const tokens = tokenizer(source, { ecmaVersion: "latest" });
  for (const token of tokens) {
    const label = token.type.label;
    if (label !== "string" && label !== "template") {
      continue;
    }
    const value = interesting(token.value);
    if (!value) {
      continue;
    }
    stats.strings += 1;
    const dedupeKey = value.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    for (const matcher of matchers) {
      if (groups[matcher.group].length >= MAX_PER_GROUP) {
        continue;
      }
      if (matcher.test(value)) {
        seen.add(dedupeKey);
        groups[matcher.group].push({ value, chunk: name });
        stats.matches += 1;
        break;
      }
    }
  }
  console.log(`scanned ${name} (${(statSync(filePath).size / 1024).toFixed(0)} KiB), matches so far: ${stats.matches}`);
}

groups.shortcuts = groups.shortcuts.sort((a, b) => a.value.localeCompare(b.value));

writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedFrom: "docs/rea/cache-extract (Notion web app chunks recovered from local Chromium cache)",
      method: "acorn tokenizer string-literal extraction, keyword-grouped",
      stats,
      groups,
    },
    null,
    2,
  ),
);

console.log(`\n${JSON.stringify(stats)}`);
for (const [group, items] of Object.entries(groups)) {
  console.log(`\n=== ${group} (${items.length}) ===`);
  for (const item of items.slice(0, 25)) {
    console.log(`  ${item.value}`);
  }
}
