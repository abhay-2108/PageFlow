import { contextBridge, ipcRenderer } from "electron";
import type { PagegroveApi } from "../shared/api";
import type { MovePageInput, NewPageInput, PageMeta, PageRecord, SearchHit, TipTapDocument } from "../shared/types";

const api: PagegroveApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  workspace: {
    info: () => ipcRenderer.invoke("pg:workspace:info") as Promise<{ dir: string }>,
  },
  pages: {
    list: () => ipcRenderer.invoke("pg:pages:list") as Promise<PageMeta[]>,
    listTrash: () => ipcRenderer.invoke("pg:pages:list-trash") as Promise<PageMeta[]>,
    get: (id: string) => ipcRenderer.invoke("pg:pages:get", { id }) as Promise<PageRecord | null>,
    create: (input: NewPageInput) => ipcRenderer.invoke("pg:pages:create", input) as Promise<PageMeta>,
    rename: (id: string, title: string) =>
      ipcRenderer.invoke("pg:pages:rename", { id, title }) as Promise<PageMeta>,
    updateDoc: (id: string, doc: TipTapDocument) =>
      ipcRenderer.invoke("pg:pages:update-doc", { id, doc }) as Promise<PageMeta>,
    move: (input: MovePageInput) => ipcRenderer.invoke("pg:pages:move", input) as Promise<PageMeta>,
    trash: (id: string) => ipcRenderer.invoke("pg:pages:trash", { id }) as Promise<boolean>,
    restore: (id: string) => ipcRenderer.invoke("pg:pages:restore", { id }) as Promise<boolean>,
  },
  search: {
    query: (query: string) => ipcRenderer.invoke("pg:search:query", { query }) as Promise<SearchHit[]>,
  },
};

contextBridge.exposeInMainWorld("pagegrove", api);
