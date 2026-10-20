import { useEffect, useRef, useState } from "react";
import { COVER_IDS, isCoverId } from "../../../shared/covers";
import { getApi } from "../lib/api";
import { assetUrl } from "../lib/assetUrl";

export interface CoverPickerProps {
  current: string | null;
  onPick: (cover: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function CoverPicker({ current, onPick, onRemove, onClose }: CoverPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    setUploading(true);
    try {
      const result = await getApi().assets.pickImage();
      if (result.ok && result.src) {
        onPick(result.src);
      }
    } finally {
      setUploading(false);
    }
  };

  const customCover = current !== null && !isCoverId(current) ? current : null;

  return (
    <div className="cover-picker" ref={ref} role="dialog" aria-label="Page cover">
      <div className="cover-picker__grid">
        {COVER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={
              id === current
                ? `cover-picker__swatch cover--${id} cover-picker__swatch--active`
                : `cover-picker__swatch cover--${id}`
            }
            aria-label={`Cover ${id}`}
            onClick={() => onPick(id)}
          />
        ))}
        {customCover ? (
          <button
            type="button"
            className="cover-picker__swatch cover-picker__swatch--custom cover-picker__swatch--active"
            aria-label="Cover uploaded"
            aria-pressed="true"
            onClick={() => onPick(customCover)}
          >
            <img src={assetUrl(customCover)} alt="" draggable={false} />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="cover-picker__upload"
        disabled={uploading}
        onClick={() => void upload()}
      >
        {uploading ? "Uploading image…" : "Upload image"}
      </button>
      {current ? (
        <button type="button" className="cover-picker__remove" onClick={onRemove}>
          Remove cover
        </button>
      ) : null}
    </div>
  );
}
