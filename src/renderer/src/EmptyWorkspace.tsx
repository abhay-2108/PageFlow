import { BRAND } from "../../shared/brand";

export function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-workspace">
      <h2>{BRAND.empty.workspace}</h2>
      <button type="button" className="btn-primary" onClick={onCreate}>
        {BRAND.empty.workspaceAction}
      </button>
    </div>
  );
}
