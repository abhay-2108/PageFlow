import type { PageRecord, TipTapDocument } from "../../shared/types";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";

export interface PageViewProps {
  record: PageRecord;
  editorEpoch: number;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
}

export function PageView({ record, editorEpoch, onDocChange, onTitleChange, autoFocusEditor }: PageViewProps) {
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
        key={`${record.meta.id}:${editorEpoch}`}
        pageId={record.meta.id}
        onDocChange={onDocChange}
        autoFocus={autoFocusEditor}
      />
    </main>
  );
}
