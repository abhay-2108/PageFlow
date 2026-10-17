import { useEffect, useState } from "react";
import type { BacklinkHit, PageRecord, TipTapDocument } from "../../shared/types";
import type { CoverId } from "../../shared/covers";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";
import { CoverPicker } from "./components/CoverPicker";
import { EmojiPicker } from "./components/EmojiPicker";
import { getApi } from "./lib/api";

export interface PageViewProps {
  record: PageRecord;
  editorEpoch: number;
  onDocChange: (doc: TipTapDocument) => void;
  onTitleChange: (title: string) => void;
  autoFocusEditor: boolean;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: CoverId | null) => void;
  onOpenPage: (id: string) => void;
}

export function PageView({
  record,
  editorEpoch,
  onDocChange,
  onTitleChange,
  autoFocusEditor,
  onIconChange,
  onCoverChange,
  onOpenPage,
}: PageViewProps) {
  const api = getApi();
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkHit[]>([]);
  const displayTitle = record.meta.title.length > 0 ? record.meta.title : BRAND.empty.untitled;
  const icon = record.meta.icon;
  const cover = (record.meta.cover ?? null) as CoverId | null;

  useEffect(() => {
    let cancelled = false;
    void api.pages
      .backlinks(record.meta.id)
      .then((hits) => {
        if (!cancelled) {
          setBacklinks(hits);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, record.meta.id, editorEpoch]);

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
        onOpenPage={onOpenPage}
      />
      {backlinks.length > 0 ? (
        <section className="page__backlinks" aria-label="Linked from">
          <h2 className="page__backlinks-title">Linked from</h2>
          <ul className="page__backlinks-list">
            {backlinks.map((hit) => {
              const parentPath = hit.path.slice(0, -1);
              return (
                <li key={hit.id}>
                  <button type="button" className="page__backlink" onClick={() => onOpenPage(hit.id)}>
                    <span className="page__backlink-title">
                      {hit.title.length > 0 ? hit.title : BRAND.empty.untitled}
                    </span>
                    {parentPath.length > 0 ? (
                      <span className="page__backlink-path">{parentPath.join(" / ")}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
