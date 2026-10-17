import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps } from "@tiptap/suggestion";
import { slash } from "./controller";
import { filterSlashItems, type SlashItem } from "./items";

export const SlashCommand = Extension.create({
  name: "pagegroveSlashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        startOfLine: true,
        allowSpaces: false,
        allowedPrefixes: null,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          props.run(editor, range);
        },
        render: () => {
          let current: SuggestionProps<SlashItem> | null = null;

          const rectFor = (): DOMRect | null => current?.clientRect?.() ?? null;

          return {
            onStart: (props) => {
              current = props;
              slash.setSelectHandler((index) => {
                const item = slash.getState().items[index];
                if (!item || !current) {
                  return false;
                }
                current.command(item);
                return true;
              });
              slash.open(props.items, rectFor());
            },
            onUpdate: (props) => {
              current = props;
              slash.update(props.items, rectFor());
            },
            onKeyDown: ({ event }) => {
              if (!slash.isOpen()) {
                return false;
              }
              if (event.key === "ArrowDown") {
                slash.move(1);
                return true;
              }
              if (event.key === "ArrowUp") {
                slash.move(-1);
                return true;
              }
              if (event.key === "Enter") {
                return slash.select();
              }
              if (event.key === "Escape") {
                slash.dismiss();
                return true;
              }
              return false;
            },
            onExit: () => {
              current = null;
              slash.setSelectHandler(null);
              slash.close();
            },
          };
        },
      }),
    ];
  },
});
