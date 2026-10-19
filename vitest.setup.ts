class LocalStorageMock {
  private store = new Map<string, string>();
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  get length(): number { return this.store.size; }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageMock(),
  writable: true,
});

class KeyboardEventMock extends Event {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  constructor(type: string, init: KeyboardEventInit = {}) {
    super(type);
    this.key = init.key ?? "";
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.altKey = init.altKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
  }
}

Object.defineProperty(globalThis, "KeyboardEvent", {
  value: KeyboardEventMock,
  writable: true,
});

class ElementMock {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly childNodes: Array<ElementMock | TextNodeMock> = [];
  private readonly attrs = new Map<string, string>();

  constructor(tagName: string, attrString = "") {
    this.tagName = tagName.toUpperCase();
    const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(attrString)) !== null) {
      const name = match[1]?.toLowerCase();
      if (name && name !== tagName.toLowerCase()) {
        this.attrs.set(name, match[2] ?? "");
      }
    }
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name.toLowerCase()) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name.toLowerCase());
  }

  get textContent(): string {
    return this.childNodes.map((c) => c.textContent ?? "").join("");
  }
}

class TextNodeMock {
  readonly nodeType = 3;
  textContent: string;
  constructor(text: string) {
    this.textContent = text;
  }
}

class DOMParserMock {
  parseFromString(html: string): Document {
    const doc = {
      body: {
        childNodes: this.parseHtml(html),
      },
    };
    return doc as unknown as Document;
  }

  private parseHtml(html: string): Array<ElementMock | TextNodeMock> {
    const rootNodes: Array<ElementMock | TextNodeMock> = [];
    const tagRegex = /<\/?([a-z0-9]+)([^>]*)>/gi;
    const voidTags = new Set(["hr", "br", "img", "input", "meta", "link"]);
    const stack: Array<{ tag: string; node: ElementMock }> = [
      { tag: "#root", node: { childNodes: rootNodes } as unknown as ElementMock },
    ];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        const text = html.slice(lastIndex, match.index);
        if (text.length > 0) {
          stack[stack.length - 1]?.node.childNodes.push(new TextNodeMock(text));
        }
      }

      const fullMatch = match[0];
      const tagName = match[1]?.toLowerCase() ?? "";
      const isClosing = fullMatch.startsWith("</");

      if (isClosing) {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i]?.tag === tagName) {
            stack.length = i;
            break;
          }
        }
      } else if (!voidTags.has(tagName)) {
        const el = new ElementMock(tagName, match[2]);
        stack[stack.length - 1]?.node.childNodes.push(el);
        stack.push({ tag: tagName, node: el });
      } else {
        const el = new ElementMock(tagName, match[2]);
        stack[stack.length - 1]?.node.childNodes.push(el);
      }

      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < html.length) {
      const text = html.slice(lastIndex);
      if (text.length > 0) {
        stack[0]?.node.childNodes.push(new TextNodeMock(text));
      }
    }

    return rootNodes;
  }
}

Object.defineProperty(globalThis, "DOMParser", {
  value: DOMParserMock,
  writable: true,
});

class NodeMock {
  static readonly TEXT_NODE = 3;
  static readonly ELEMENT_NODE = 1;
  nodeType = 1;
}

Object.defineProperty(globalThis, "Node", {
  value: NodeMock,
  writable: true,
});
