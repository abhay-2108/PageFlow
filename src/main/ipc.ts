import { ipcMain } from "electron";
import type { z } from "zod";
import {
  createPageInputSchema,
  getPageInputSchema,
  movePageInputSchema,
  renamePageInputSchema,
  searchInputSchema,
  updateDocInputSchema,
} from "../shared/schemas";
import type { WorkspaceDb } from "./workspace/db";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function registerIpc(db: WorkspaceDb): void {
  ipcMain.handle("pg:workspace:info", () => ({ dir: db.directory }));

  ipcMain.handle("pg:pages:list", () => db.listPages());
  ipcMain.handle("pg:pages:list-trash", () => db.listTrash());

  ipcMain.handle("pg:pages:get", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    return db.getPage(id);
  });

  ipcMain.handle("pg:pages:create", (_event, raw: unknown) => {
    return db.createPage(parse(createPageInputSchema, raw));
  });

  ipcMain.handle("pg:pages:rename", (_event, raw: unknown) => {
    const { id, title } = parse(renamePageInputSchema, raw);
    return db.renamePage(id, title);
  });

  ipcMain.handle("pg:pages:update-doc", (_event, raw: unknown) => {
    const { id, doc } = parse(updateDocInputSchema, raw);
    return db.updateDoc(id, doc);
  });

  ipcMain.handle("pg:pages:move", (_event, raw: unknown) => {
    return db.movePage(parse(movePageInputSchema, raw));
  });

  ipcMain.handle("pg:pages:trash", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    db.trashPage(id);
    return true;
  });

  ipcMain.handle("pg:pages:restore", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    db.restorePage(id);
    return true;
  });

  ipcMain.handle("pg:search:query", (_event, raw: unknown) => {
    const { query } = parse(searchInputSchema, raw);
    return db.search(query);
  });
}
