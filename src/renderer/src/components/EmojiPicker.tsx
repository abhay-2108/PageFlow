import { useEffect, useRef } from "react";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Faces",
    emojis: [
      "😀",
      "😄",
      "😁",
      "😆",
      "😂",
      "🙂",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😋",
      "😜",
      "🤪",
      "🤔",
      "🤨",
      "😎",
      "🥳",
      "😴",
      "🤯",
      "😅",
      "🙃",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "✌️", "🤞", "👌", "🤙", "✋", "👋", "🫡", "🤟", "👀"],
  },
  {
    label: "Nature",
    emojis: ["🌱", "🌿", "🍀", "🌵", "🌴", "🌸", "🌷", "🌻", "🌙", "⭐", "🌈", "☁️", "🌊", "🔥", "❄️", "☀️"],
  },
  {
    label: "Objects",
    emojis: [
      "💡",
      "📌",
      "📎",
      "📖",
      "📚",
      "✏️",
      "🖊️",
      "📝",
      "📅",
      "⏰",
      "🔒",
      "🔑",
      "🔍",
      "🎯",
      "🎨",
      "🎵",
      "🎬",
      "📷",
      "💻",
      "🧭",
      "🧪",
      "📦",
      "🧰",
      "🛠️",
    ],
  },
  {
    label: "Food",
    emojis: ["☕", "🍵", "🥤", "🍕", "🍔", "🍟", "🍎", "🍊", "🍋", "🍇", "🍓", "🥕", "🍞", "🧀", "🍩", "🍪"],
  },
  {
    label: "Symbols",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "⚡", "✨", "🎉", "🎊", "🏆", "🥇", "🔔", "📣", "💬", "✅", "❌", "⚠️", "❓", "❗", "🧠", "🚀", "🌟", "🖤"],
  },
];

export interface EmojiPickerProps {
  current: string | null;
  onPick: (emoji: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function EmojiPicker({ current, onPick, onRemove, onClose }: EmojiPickerProps) {
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

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Page icon">
      <div className="emoji-picker__scroll">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="emoji-picker__group">
            <div className="emoji-picker__label">{group.label}</div>
            <div className="emoji-picker__grid">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={emoji === current ? "emoji-picker__item emoji-picker__item--active" : "emoji-picker__item"}
                  aria-label={`Icon ${emoji}`}
                  onClick={() => onPick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {current ? (
        <button type="button" className="emoji-picker__remove" onClick={onRemove}>
          Remove icon
        </button>
      ) : null}
    </div>
  );
}
