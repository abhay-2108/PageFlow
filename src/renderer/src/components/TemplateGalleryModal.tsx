import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TEMPLATE_CATEGORIES,
  getAllTemplates,
  type PageTemplate,
  type TemplateCategory,
} from "../../../shared/templates";
import { useFocusTrap } from "../lib/a11y";

interface TemplateGalleryModalProps {
  onSelect: (template: PageTemplate) => void;
  onClose: () => void;
}

export function TemplateGalleryModal({ onSelect, onClose }: TemplateGalleryModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(modalRef, true, onClose);

  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(() => {
    return getAllTemplates()[0] ?? null;
  });

  const templates = getAllTemplates();

  const filtered = templates.filter((tpl) => {
    const matchesCategory = activeCategory === "all" || tpl.category === activeCategory;
    const matchesSearch =
      tpl.name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return createPortal(
    <div className="pg-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="pg-template-gallery"
        role="dialog"
        aria-modal="true"
        aria-label="Template Gallery"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pg-template-gallery__header">
          <div className="pg-template-gallery__title-row">
            <h2>Templates</h2>
            <button
              type="button"
              className="pg-modal-close"
              onClick={onClose}
              aria-label="Close template gallery"
            >
              ✕
            </button>
          </div>
          <p className="pg-template-gallery__subtitle">
            Choose a starting point or load your saved custom page layouts.
          </p>
        </div>

        <div className="pg-template-gallery__body">
          {/* Sidebar categories */}
          <div className="pg-template-gallery__sidebar">
            <input
              type="search"
              className="pg-template-gallery__search"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <ul className="pg-template-gallery__nav">
              <li>
                <button
                  type="button"
                  className={activeCategory === "all" ? "pg-nav-item pg-nav-item--active" : "pg-nav-item"}
                  onClick={() => setActiveCategory("all")}
                >
                  <span className="pg-nav-item__icon">🗂️</span>
                  <span>All Templates</span>
                </button>
              </li>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    className={
                      activeCategory === cat.id ? "pg-nav-item pg-nav-item--active" : "pg-nav-item"
                    }
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className="pg-nav-item__icon">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Cards listing */}
          <div className="pg-template-gallery__grid">
            {filtered.map((item) => {
              const isSelected = selectedTemplate?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    isSelected
                      ? "pg-template-card pg-template-card--selected"
                      : "pg-template-card"
                  }
                  onClick={() => setSelectedTemplate(item)}
                >
                  <div className="pg-template-card__icon">{item.icon}</div>
                  <div className="pg-template-card__info">
                    <h4 className="pg-template-card__name">{item.name}</h4>
                    <p className="pg-template-card__desc">{item.description}</p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="pg-template-gallery__empty">No templates match your search.</div>
            ) : null}
          </div>

          {/* Preview & Action Drawer */}
          {selectedTemplate ? (
            <div className="pg-template-gallery__preview">
              <div className="pg-template-preview__header">
                <span className="pg-template-preview__icon">{selectedTemplate.icon}</span>
                <h3>{selectedTemplate.name}</h3>
              </div>
              <p className="pg-template-preview__desc">{selectedTemplate.description}</p>

              <div className="pg-template-preview__doc-summary">
                <strong>Blocks included:</strong>
                <ul>
                  {selectedTemplate.doc.content?.map((node, i) => (
                    <li key={i}>
                      <code>{node.type}</code> {node.attrs?.level ? `(Level ${node.attrs.level})` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pg-template-preview__actions">
                <button
                  type="button"
                  className="pg-btn pg-btn--primary"
                  onClick={() => {
                    onSelect(selectedTemplate);
                    onClose();
                  }}
                >
                  Use this template
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
