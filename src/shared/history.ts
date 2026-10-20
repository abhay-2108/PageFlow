import * as Y from "yjs";

export interface DocVersion {
  id: string;
  docId: string;
  timestamp: number;
  label: string;
  snapshot: Uint8Array;
}

const VERSIONS_KEY = "pageflow_doc_versions";
const MAX_VERSIONS_PER_DOC = 20;

function getAllVersions(): DocVersion[] {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DocVersion[];
  } catch {
    return [];
  }
}

function saveAllVersions(versions: DocVersion[]): void {
  try {
    const serializable = versions.map((v) => ({
      ...v,
      snapshot: Array.from(v.snapshot),
    }));
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(serializable));
  } catch {
  // localStorage full or unavailable
  }
}

export function saveVersion(docId: string, doc: Y.Doc, label: string): DocVersion {
  const snapshot = Y.encodeStateAsUpdate(doc);
  const version: DocVersion = {
    id: crypto.randomUUID(),
    docId,
    timestamp: Date.now(),
    label,
    snapshot,
  };

  const all = getAllVersions();
  const docVersions = all.filter((v) => v.docId === docId);
  if (docVersions.length >= MAX_VERSIONS_PER_DOC) {
    docVersions.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = docVersions.slice(0, docVersions.length - MAX_VERSIONS_PER_DOC + 1);
    const removeIds = new Set(toRemove.map((v) => v.id));
    const remaining = all.filter((v) => !removeIds.has(v.id));
    remaining.push(version);
    saveAllVersions(remaining);
  } else {
    all.push(version);
    saveAllVersions(all);
  }

  return version;
}

export function getVersionsForDoc(docId: string): DocVersion[] {
  return getAllVersions()
    .filter((v) => v.docId === docId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function restoreVersion(version: DocVersion, targetDoc: Y.Doc): void {
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, version.snapshot);
  const fullUpdate = Y.encodeStateAsUpdate(tempDoc);
  targetDoc.transact(() => {
    Y.applyUpdate(targetDoc, fullUpdate);
  });
  tempDoc.destroy();
}

export function deleteVersion(versionId: string): void {
  const all = getAllVersions();
  const remaining = all.filter((v) => v.id !== versionId);
  saveAllVersions(remaining);
}

export function clearAllVersions(): void {
  localStorage.removeItem(VERSIONS_KEY);
}

export function createSnapshot(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function restoreSnapshot(doc: Y.Doc, snapshot: Uint8Array): void {
  Y.applyUpdate(doc, snapshot);
}

export function mergeSnapshot(doc: Y.Doc, snapshot: Uint8Array): void {
  Y.applyUpdate(doc, snapshot);
}
