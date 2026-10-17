import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PageMeta, TipTapDocument } from "../../shared/types";

export interface SnapshotPayload {
  version: 1;
  savedAt: number;
  meta: PageMeta;
  doc: TipTapDocument;
}

export function writeSnapshot(directory: string, payload: SnapshotPayload): void {
  const target = join(directory, "pages", `${payload.meta.id}.snapshot.json`);
  const temp = `${target}.tmp`;
  writeFileSync(temp, JSON.stringify(payload, null, 2), "utf8");
  renameSync(temp, target);
}
