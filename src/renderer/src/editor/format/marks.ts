import { Mark, mergeAttributes } from "@tiptap/core";

export const COLOR_PALETTE = [
  { name: "gray", label: "Gray" },
  { name: "brown", label: "Brown" },
  { name: "orange", label: "Orange" },
  { name: "yellow", label: "Yellow" },
  { name: "green", label: "Green" },
  { name: "blue", label: "Blue" },
  { name: "purple", label: "Purple" },
  { name: "pink", label: "Pink" },
  { name: "red", label: "Red" },
] as const;

export type ColorName = (typeof COLOR_PALETTE)[number]["name"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pgTextColor: {
      setTextColor: (name: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    pgBgColor: {
      setBgColor: (name: string) => ReturnType;
      unsetBgColor: () => ReturnType;
    };
  }
}

export const TextColor = Mark.create({
  name: "textColor",

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-text-color"),
        renderHTML: (attributes) =>
          attributes.name ? { "data-text-color": String(attributes.name) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-text-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (name: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { name }).run(),
      unsetTextColor:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },
});

export const BgColor = Mark.create({
  name: "bgColor",

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bg-color"),
        renderHTML: (attributes) =>
          attributes.name ? { "data-bg-color": String(attributes.name) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-bg-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setBgColor:
        (name: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { name }).run(),
      unsetBgColor:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },
});
