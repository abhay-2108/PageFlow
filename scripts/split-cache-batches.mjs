import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const srcDir = join("docs", "rea", "cache-extract");
const batchRoot = join("docs", "rea", "cache-batches");
const batchCount = 3;

rmSync(batchRoot, { recursive: true, force: true });
for (let index = 1; index <= batchCount; index += 1) {
  mkdirSync(join(batchRoot, `batch-${index}`), { recursive: true });
}

const files = readdirSync(srcDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, size: statSync(join(srcDir, name)).size }))
  .sort((a, b) => b.size - a.size);

const bins = Array.from({ length: batchCount }, () => ({ bytes: 0, files: [] }));
for (const file of files) {
  const target = bins.reduce((min, bin) => (bin.bytes < min.bytes ? bin : min), bins[0]);
  target.files.push(file.name);
  target.bytes += file.size;
}

for (let index = 0; index < batchCount; index += 1) {
  const dir = join(batchRoot, `batch-${index + 1}`);
  for (const name of bins[index].files) {
    copyFileSync(join(srcDir, name), join(dir, name));
  }
  console.log(
    `batch-${index + 1}: ${bins[index].files.length} files, ${(bins[index].bytes / 1024 / 1024).toFixed(1)} MiB`,
  );
}
