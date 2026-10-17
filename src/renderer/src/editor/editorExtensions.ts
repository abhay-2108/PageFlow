import { getSchema, type Extensions } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import type { WebrtcProvider } from "y-webrtc";
import type * as Y from "yjs";
import { BRAND } from "../../../shared/brand";
import { CommentAnchor } from "./comments/CommentAnchor";
import { CommentTools } from "./comments/extension";
import { KeyboardShortcuts } from "./extensions/KeyboardShortcuts";
import { Toggle } from "./extensions/Toggle";
import { MentionCommand } from "./mention/extension";
import { PageMention } from "./mention/PageMention";
import { SlashCommand } from "./slash/extension";

export const EDITOR_FIELD = "default";

export interface CollaborationOptions {
  document: Y.Doc;
  provider: WebrtcProvider | null;
  user: { name: string; color: string };
}

export interface BuildExtensionsOptions {
  currentPageId?: string | null;
}

export function buildExtensions(
  collaboration: CollaborationOptions | null,
  options: BuildExtensionsOptions = {},
): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: { HTMLAttributes: { spellcheck: "false" } },
      history: false,
    }),
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Toggle,
    PageMention,
    Placeholder.configure({ placeholder: BRAND.empty.editorPlaceholder }),
    KeyboardShortcuts,
    SlashCommand,
    MentionCommand.configure({ currentPageId: options.currentPageId ?? null }),
    CommentAnchor,
    CommentTools,
  ];
  if (collaboration) {
    extensions.push(Collaboration.configure({ document: collaboration.document }));
    if (collaboration.provider) {
      extensions.push(
        CollaborationCursor.configure({
          provider: collaboration.provider,
          user: collaboration.user,
        }),
      );
    }
  }
  return extensions;
}

export const editorSchema = getSchema(buildExtensions(null));
