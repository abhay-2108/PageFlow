import { useMemo } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BRAND } from "../../../shared/brand";
import type { TipTapDocument } from "../../../shared/types";
import { KeyboardShortcuts } from "./extensions/KeyboardShortcuts";
import { Toggle } from "./extensions/Toggle";
import { SlashCommand } from "./slash/extension";
import { SlashMenu } from "./slash/SlashMenu";

export interface EditorProps {
  document: TipTapDocument;
  onDocChange: (doc: TipTapDocument) => void;
  autoFocus?: boolean;
}

export function Editor({ document: initialDocument, onDocChange, autoFocus = false }: EditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { spellcheck: "false" } },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Toggle,
      Placeholder.configure({ placeholder: BRAND.empty.editorPlaceholder }),
      KeyboardShortcuts,
      SlashCommand,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialDocument,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "pg-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onDocChange(instance.getJSON() as TipTapDocument);
    },
  });

  return (
    <div className="editor-shell">
      <EditorContent editor={editor} />
      <SlashMenu />
    </div>
  );
}
