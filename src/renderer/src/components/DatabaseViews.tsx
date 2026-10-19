import { useMemo } from "react";
import { PROPERTY_TYPE_LABELS, SELECT_COLORS, valueToText } from "../../../shared/database";
import type { PropertyDef, PropertyValue } from "../../../shared/database";
import { BRAND } from "../../../shared/brand";
import { isCoverId } from "../../../shared/covers";
import { assetUrl } from "../lib/assetUrl";
import type { PageMeta } from "../../../shared/types";

interface DatabaseViewProps {
  parentId: string;
  pages: PageMeta[];
  properties: PropertyDef[];
  onOpenPage: (id: string) => void;
  onPropertyChange?: (pageId: string, propId: string, value: PropertyValue) => void;
}

function getProperty(defs: PropertyDef[], id: string): PropertyDef | undefined {
  return defs.find((d) => d.id === id);
}

function GalleryCard({
  page,
  properties,
  onOpenPage,
}: {
  page: PageMeta;
  properties: PropertyDef[];
  onOpenPage: (id: string) => void;
}) {
  const cover = page.cover ?? null;
  const title = page.title.trim().length > 0 ? page.title : BRAND.empty.untitled;

  return (
    <div className="gallery-card" data-page-id={page.id} onClick={() => onOpenPage(page.id)}>
      {cover ? (
        <div className="gallery-card__cover">
          {isCoverId(cover) ? (
            <div className={`gallery-card__cover-gradient gallery-card__cover-gradient--${cover}`} />
          ) : (
            <img className="gallery-card__cover-img" src={assetUrl(cover)} alt="" />
          )}
        </div>
      ) : null}
      <div className="gallery-card__body">
        <div className="gallery-card__title">
          {page.icon ? <span className="gallery-card__icon">{page.icon} </span> : null}
          {title}
        </div>
        {properties.length > 0 ? (
          <div className="gallery-card__props">
            {properties.slice(0, 3).map((prop) => {
              const val = (page.fields as Record<string, PropertyValue>)[prop.id];
              const display = val != null ? valueToText(prop.type, val) : "";
              return (
                <div key={prop.id} className="gallery-card__prop">
                  <span className="gallery-card__prop-name">{prop.name}</span>
                  {display ? <span className="gallery-card__prop-val">{display}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GalleryView({ parentId, pages, properties, onOpenPage }: DatabaseViewProps) {
  const children = useMemo(
    () =>
      pages
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.rank - b.rank),
    [pages, parentId],
  );

  if (children.length === 0) {
    return <p className="db-empty">No records yet. Add a subpage to get started.</p>;
  }

  return (
    <div className="gallery-grid">
      {children.map((page) => (
        <GalleryCard key={page.id} page={page} properties={properties} onOpenPage={onOpenPage} />
      ))}
    </div>
  );
}

interface BoardGroup {
  key: string;
  label: string;
  color: string;
  pages: PageMeta[];
}

function BoardColumn({
  group,
  properties,
  onOpenPage,
}: {
  group: BoardGroup;
  properties: PropertyDef[];
  onOpenPage: (id: string) => void;
}) {
  return (
    <div className="board-col" data-group-key={group.key}>
      <div className="board-col__header">
        <span className="board-col__dot" style={{ background: group.color }} />
        <span className="board-col__label">{group.label}</span>
        <span className="board-col__count">{group.pages.length}</span>
      </div>
      <div className="board-col__cards">
        {group.pages.map((page) => {
          const title = page.title.trim().length > 0 ? page.title : BRAND.empty.untitled;
          return (
            <div key={page.id} className="board-card" onClick={() => onOpenPage(page.id)}>
              <div className="board-card__title">
                {page.icon ? <span>{page.icon} </span> : null}
                {title}
              </div>
              {properties.length > 0 ? (
                <div className="board-card__props">
                  {properties.slice(0, 2).map((prop) => {
                    const val = (page.fields as Record<string, PropertyValue>)[prop.id];
                    const display = val != null ? valueToText(prop.type, val) : "";
                    return (
                      <div key={prop.id} className="board-card__prop">
                        <span className="board-card__prop-name">{prop.name}</span>
                        {display ? <span className="board-card__prop-val">{display}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BoardView({
  parentId,
  pages,
  properties,
  onOpenPage,
}: DatabaseViewProps) {
  const children = useMemo(
    () => pages.filter((p) => p.parentId === parentId).sort((a, b) => a.rank - b.rank),
    [pages, parentId],
  );

  const statusProp = properties.find((p) => p.type === "status" || p.type === "select");

  const groups = useMemo<BoardGroup[]>(() => {
    if (!statusProp) {
      return [
        { key: "__all", label: "All", color: "#6b7280", pages: children },
      ];
    }
    const options: Array<{ label: string; color?: string }> =
      (statusProp.options ?? []).map((opt) => ({
        label: opt,
        color: statusProp.optionColors?.[opt] ?? SELECT_COLORS[0] ?? "#6b7280",
      }));
    const groupMap = new Map<string, BoardGroup>();
    for (const opt of options) {
      groupMap.set(opt.label, {
        key: opt.label,
        label: opt.label,
        color: opt.color ?? SELECT_COLORS[0] ?? "#6b7280",
        pages: [],
      });
    }
    groupMap.set("__none", {
      key: "__none",
      label: "No status",
      color: "#d1d5db",
      pages: [],
    });
    for (const page of children) {
      const val = (page.fields as Record<string, PropertyValue>)[statusProp.id];
      const key = typeof val === "string" ? val : "";
      const group = groupMap.get(key) ?? groupMap.get("__none")!;
      group.pages.push(page);
    }
    return Array.from(groupMap.values());
  }, [children, statusProp]);

  if (children.length === 0) {
    return <p className="db-empty">No records yet. Add a subpage to get started.</p>;
  }

  return (
    <div className="board-view">
      {groups.map((group) => (
        <BoardColumn key={group.key} group={group} properties={properties} onOpenPage={onOpenPage} />
      ))}
    </div>
  );
}
