import { useState } from "react";
import type { PageRecord, TipTapDocument } from "../../shared/types";
import type { CoverId } from "../../shared/covers";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";
import { CoverPicker } from "./components/CoverPicker";
import { EmojiPicker } from "./components/EmojiPicker";

export interface PageViewProps {
  record: PageRecord;
  editorEpoch: number;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: CoverId | null) => void;
}

export function PageView({
  record,
  editorEpoch,
  onDocChange,
  onTitleChange,
  autoFocusEditor,
  onIconChange,
  onCoverChange,
}: PageViewProps) {
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const displayTitle = record.meta.title.length > 0 ? record.meta.title : BRAND.empty.untitled;
  const icon = record.meta.icon;
  const cover = (record.meta.cover ?? null) as CoverId | null;

  return (
    <main className={cover ? "page page--has-cover" : "page"}>
      {cover ? (
        <div className={`page__cover cover--${cover}`} data-page-cover={cover}>
          <div className="page__cover-actions">
            <button
              type="button"
              className="cover-action"
              onClick={() => setPicker(picker === "cover" ? null : "cover")}
            >
              Change cover
            </button>
            <button
              type="button"
              className="cover-action"
              onClick={() => {
                setPicker(null);
                onCoverChange(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
      <div className="page__meta">
        {icon ? (
          <button
            type="button"
            className="page__icon"
            aria-label="Change page icon"
            data-page-icon={icon}
            onClick={() => setPicker(picker === "icon" ? null : "icon")}
          >
            {icon}
          </button>
        ) : null}
        <div className="page__meta-actions">
          <button
            type="button"
            className="page__meta-btn"
            onClick={() => setPicker(picker === "icon" ? null : "icon")}
          >
            {icon ? "Change icon" : "Add icon"}
          </button>
          <button
            type="button"
            className="page__meta-btn"
            onClick={() => setPicker(picker === "cover" ? null : "cover")}
          >
            {cover ? "Change cover" : "Add cover"}
          </button>
        </div>
        {picker === "icon" ? (
          <EmojiPicker
            current={icon}
            onPick={(emoji) => {
              setPicker(null);
              onIconChange(emoji);
            }}
            onRemove={() => {
              setPicker(null);
              onIconChange(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
        {picker === "cover" ? (
          <CoverPicker
            current={cover}
            onPick={(id) => {
              setPicker(null);
              onCoverChange(id);
            }}
            onRemove={() => {
              setPicker(null);
              onCoverChange(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
      </div>
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
