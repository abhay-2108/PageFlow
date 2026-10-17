import { useEffect, useState } from "react";
import { BRAND } from "../../shared/brand";
import { Editor } from "./editor/Editor";

export default function App() {
  const [title, setTitle] = useState("");

  useEffect(() => {
    const trimmed = title.trim();
    document.title = trimmed ? `${trimmed} — ${BRAND.name}` : BRAND.name;
  }, [title]);

  return (
    <div className="app">
      <div className="app__scroll">
        <main className="page">
          <input
            className="page__title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled"
            aria-label="Page title"
            spellCheck={false}
            autoComplete="off"
          />
          <Editor />
        </main>
      </div>
    </div>
  );
}
