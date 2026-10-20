import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
  pos: number;
}

export function TableOfContentsView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    const updateHeadings = () => {
      if (!editor || editor.isDestroyed) return;
      const items: HeadingItem[] = [];
      const doc = editor.state.doc;

      doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          const level = node.attrs.level as number;
          const text = node.textContent.trim();
          if (text) {
            items.push({
              id: `heading-${pos}`,
              text,
              level,
              pos,
            });
          }
        }
      });
      setHeadings(items);
    };

    updateHeadings();
    editor.on("update", updateHeadings);
    return () => {
      editor.off("update", updateHeadings);
    };
  }, [editor]);

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).run();
    const domNode = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (domNode) {
      domNode.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <NodeViewWrapper className="pg-toc-container" contentEditable={false}>
      <div className="pg-toc-header">
        <span className="pg-toc-icon">📑</span>
        <span className="pg-toc-title">Table of Contents</span>
      </div>
      {headings.length === 0 ? (
        <div className="pg-toc-empty">Add headings (H1, H2, H3) to populate the table of contents.</div>
      ) : (
        <ul className="pg-toc-list">
          {headings.map((item) => (
            <li
              key={item.id}
              className={`pg-toc-item pg-toc-item--level-${item.level}`}
              onClick={() => scrollToHeading(item.pos)}
            >
              <span className="pg-toc-item-link">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}
