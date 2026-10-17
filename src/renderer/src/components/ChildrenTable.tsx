import { useEffect, useState } from "react";
import { BRAND } from "../../../shared/brand";
import { childrenOf } from "../../../shared/tree";
import type { PageMeta } from "../../../shared/types";
import { getApi } from "../lib/api";

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export interface ChildrenTableProps {
  parentId: string;
  refreshKey: number;
  onOpenPage: (id: string) => void;
}

export function ChildrenTable({ parentId, refreshKey, onOpenPage }: ChildrenTableProps) {
  const api = getApi();
  const [rows, setRows] = useState<PageMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.pages
      .list()
      .then((pages) => {
        if (!cancelled) {
          setRows(childrenOf(pages, parentId));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, parentId, refreshKey]);

  if (rows.length === 0) {
    return <p className="pg-children-table__empty">No pages inside yet.</p>;
  }

  return (
    <div className="pg-children-table-wrap">
      <table className="pg-children-table" aria-label="Subpages">
        <thead>
          <tr>
            <th>Name</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((page) => (
            <tr key={page.id} data-page-id={page.id}>
              <td>
                <button
                  type="button"
                  className="pg-children-table__open"
                  onClick={() => onOpenPage(page.id)}
                >
                  {page.icon ? <span className="pg-children-table__icon">{page.icon}</span> : null}
                  <span className="pg-children-table__title">
                    {page.title.length > 0 ? page.title : BRAND.empty.untitled}
                  </span>
                </button>
              </td>
              <td className="pg-children-table__updated">{timeAgo(page.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
