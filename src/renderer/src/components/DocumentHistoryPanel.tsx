import { useRef, useState } from "react";
import { getVersionsForDoc, deleteVersion, restoreVersion } from "../../../shared/history";
import type { DocVersion } from "../../../shared/history";
import { useFocusTrap } from "../lib/a11y";
import type * as Y from "yjs";

interface DocumentHistoryPanelProps {
  pageId: string;
  doc: Y.Doc | null;
  onRestored: () => void;
  onClose: () => void;
}

export function DocumentHistoryPanel({
  pageId,
  doc,
  onRestored,
  onClose,
}: DocumentHistoryPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(panelRef, true, onClose);

  const [versions, setVersions] = useState<DocVersion[]>(() => getVersionsForDoc(pageId));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const handleRestore = (version: DocVersion) => {
    if (!doc) return;
    if (confirmRestore !== version.id) {
      setConfirmRestore(version.id);
      return;
    }
    restoreVersion(version, doc);
    onRestored();
    onClose();
  };

  const handleDelete = (versionId: string) => {
    deleteVersion(versionId);
    setVersions(getVersionsForDoc(pageId));
    setConfirmDelete(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      ref={panelRef}
      className="history-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Document version history"
      tabIndex={-1}
    >
      <div className="history-panel__header">
        <h2 className="history-panel__title">Version History</h2>
        <button
          type="button"
          className="history-panel__close"
          onClick={onClose}
          aria-label="Close version history"
        >
          ✕
        </button>
      </div>
      <div className="history-panel__list">
        {versions.length === 0 ? (
          <p className="history-panel__empty">No versions saved yet.</p>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="history-panel__item">
              <div className="history-panel__info">
                <span className="history-panel__label">{version.label}</span>
                <span className="history-panel__time">{formatTime(version.timestamp)}</span>
              </div>
              <div className="history-panel__actions">
                <button
                  type="button"
                  className="history-panel__restore"
                  onClick={() => handleRestore(version)}
                >
                  {confirmRestore === version.id ? "Confirm restore?" : "Restore"}
                </button>
                {confirmDelete === version.id ? (
                  <>
                    <button
                      type="button"
                      className="history-panel__confirm"
                      onClick={() => handleDelete(version.id)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="history-panel__cancel"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="history-panel__delete"
                    onClick={() => {
                      setConfirmDelete(version.id);
                      setConfirmRestore(null);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
