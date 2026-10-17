import type { PageRecord, TipTapDocument } from "../../shared/types";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";

export interface PageViewProps {
  record: PageRecord;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
}

export function PageView({ record, onDocChange, onTitleChange, autoFocusEditor }: PageViewProps) {
  const displayTitle = record.meta.title.length > 0 ? record.meta.title : BRAND.empty.untitled;

  return (
    <main className="page">
      <input
        className="page__title"
        value={record.meta.title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={BRAND.empty.untitled}
        aria-label="Page title"
        spellCheck={false}
        autoComplete="off"
        data-page-title={displayTitle}
      />
      <Editor
        key={record.meta.id}
        document={record.doc}
        onDocChange={onDocChange}
        autoFocus={autoFocusEditor}
      />
    </main>
  );
}
