import { useMemo } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BRAND } from "../../../shared/brand";
import { KeyboardShortcuts } from "./extensions/KeyboardShortcuts";
import { Toggle } from "./extensions/Toggle";
import { SlashCommand } from "./slash/extension";
import { SlashMenu } from "./slash/SlashMenu";

export function Editor() {
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
    content: { type: "doc", content: [{ type: "paragraph" }] },
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "pg-editor",
        spellcheck: "true",
      },
    },
  });

  return (
    <div className="editor-shell">
      <EditorContent editor={editor} />
      <SlashMenu />
    </div>
  );
}
