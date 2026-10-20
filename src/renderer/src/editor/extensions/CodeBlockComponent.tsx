import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
  { value: "bash", label: "Bash / Shell" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "c", label: "C / C++" },
];

export function CodeBlockComponent({ node, updateAttributes, extension }: NodeViewProps) {
  const currentLang = (node.attrs.language as string) || "javascript";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = node.textContent;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NodeViewWrapper className="pg-code-block-wrapper">
      <div className="pg-code-block-header" contentEditable={false}>
        <select
          className="pg-code-lang-select"
          value={currentLang}
          onChange={(e) => updateAttributes({ language: e.target.value })}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="pg-code-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? "Copied! ✓" : "Copy"}
        </button>
      </div>
      <pre className={`pg-code-pre language-${currentLang}`}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
