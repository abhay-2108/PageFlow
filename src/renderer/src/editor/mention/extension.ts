import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps } from "@tiptap/suggestion";
import { BRAND } from "../../../../shared/brand";
import { getApi } from "../../lib/api";
import { mention, type MentionItem } from "./controller";

const mentionPluginKey = new PluginKey("pagegroveMentionSuggestion");

export interface MentionCommandOptions {
  currentPageId: string | null;
}

export const MentionCommand = Extension.create<MentionCommandOptions>({
  name: "pagegroveMention",

  addOptions() {
    return { currentPageId: null };
  },

  addProseMirrorPlugins() {
    const currentPageId = this.options.currentPageId;

    return [
      Suggestion<MentionItem>({
        pluginKey: mentionPluginKey,
        editor: this.editor,
        char: "@",
        allowSpaces: false,
        allowedPrefixes: null,
        items: async ({ query }) => {
          const pages = await getApi().pages.list();
          const q = query.trim().toLowerCase();
          return pages
            .filter((page) => page.id !== currentPageId)
            .map((page) => ({
              id: page.id,
              title: page.title.trim().length > 0 ? page.title : BRAND.empty.untitled,
              icon: page.icon,
            }))
            .filter((item) => q.length === 0 || item.title.toLowerCase().includes(q))
            .slice(0, 12);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "pageMention", attrs: { pageId: props.id, label: props.title } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let current: SuggestionProps<MentionItem> | null = null;

          const rectFor = (): DOMRect | null => current?.clientRect?.() ?? null;

          return {
            onStart: (props) => {
              current = props;
              mention.setSelectHandler((index) => {
                const item = mention.getState().items[index];
                if (!item || !current) {
                  return false;
                }
                current.command(item);
                return true;
              });
              mention.open(props.items, rectFor());
            },
            onUpdate: (props) => {
              current = props;
              mention.update(props.items, rectFor());
            },
            onKeyDown: ({ event }) => {
              if (!mention.isOpen()) {
                return false;
              }
              if (event.key === "ArrowDown") {
                mention.move(1);
                return true;
              }
              if (event.key === "ArrowUp") {
                mention.move(-1);
                return true;
              }
              if (event.key === "Enter") {
                return mention.select();
              }
              if (event.key === "Escape") {
                mention.dismiss();
                return true;
              }
              return false;
            },
            onExit: () => {
              current = null;
              mention.setSelectHandler(null);
              mention.close();
            },
          };
        },
      }),
    ];
  },
});
