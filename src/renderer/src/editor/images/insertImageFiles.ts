import type { EditorView } from "@tiptap/pm/view";
import { getApi } from "../../lib/api";

export async function insertImageFiles(view: EditorView, files: File[], pos: number): Promise<void> {
  const api = getApi();
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await api.assets.importImage({ name: file.name || "image.png", bytes });
      if (!result.ok || !result.src) {
        continue;
      }
      const imageType = view.state.schema.nodes.pgImage;
      if (!imageType) {
        continue;
      }
      const node = imageType.create({ src: result.src, alt: result.alt ?? "" });
      view.dispatch(view.state.tr.insert(pos, node));
    } catch {
      // Ignore individual file failures; the rest of the batch still imports.
    }
  }
}
