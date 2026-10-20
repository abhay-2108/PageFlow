import { useMemo, useState } from "react";
import { BRAND } from "../../../shared/brand";
import type { PropertyDef } from "../../../shared/database";
import type { PageMeta } from "../../../shared/types";

interface TimelineViewProps {
  pages: PageMeta[];
  properties: PropertyDef[];
  onOpenPage: (id: string) => void;
  onCreatePage?: (dateString?: string) => void;
}

export function TimelineView({ pages, properties, onOpenPage, onCreatePage }: TimelineViewProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const dateProp = useMemo(() => {
    return properties.find((p) => p.type === "date") ?? null;
  }, [properties]);

  // Generate 28 consecutive days
  const timelineDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 28; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      days.push(cur);
    }
    return days;
  }, [startDate]);

  const shiftDays = (count: number) => {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + count);
      return next;
    });
  };

  const today = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setStartDate(d);
  };

  return (
    <div className="pg-timeline-view" aria-label="Database timeline view">
      <div className="pg-calendar-header">
        <div className="pg-calendar-title">
          <h3>Timeline / Roadmap</h3>
          {dateProp ? (
            <span className="pg-calendar-date-prop">Tracking: {dateProp.name}</span>
          ) : (
            <span className="pg-calendar-date-prop">Tracking: Created Date</span>
          )}
        </div>
        <div className="pg-calendar-nav">
          <button type="button" className="pg-btn pg-btn--secondary" onClick={today}>
            Today
          </button>
          <button type="button" className="pg-btn pg-btn--secondary" onClick={() => shiftDays(-7)}>
            ‹ Previous Week
          </button>
          <button type="button" className="pg-btn pg-btn--secondary" onClick={() => shiftDays(7)}>
            Next Week ›
          </button>
        </div>
      </div>

      <div className="pg-timeline-container">
        <div className="pg-timeline-table">
          <div className="pg-timeline-row pg-timeline-header-row">
            <div className="pg-timeline-item-col">Item</div>
            <div className="pg-timeline-days-col">
              {timelineDays.map((d, i) => {
                const isCurrent =
                  d.getDate() === new Date().getDate() &&
                  d.getMonth() === new Date().getMonth() &&
                  d.getFullYear() === new Date().getFullYear();
                return (
                  <div
                    key={i}
                    className={
                      isCurrent
                        ? "pg-timeline-day-header pg-timeline-day-header--today"
                        : "pg-timeline-day-header"
                    }
                  >
                    <span className="pg-timeline-day-name">
                      {d.toLocaleString("default", { weekday: "narrow" })}
                    </span>
                    <span className="pg-timeline-day-num">{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pg-timeline-body">
            {pages.map((page) => {
              let targetDate: Date | null = null;
              if (dateProp && page.fields[dateProp.id]) {
                const parsed = new Date(String(page.fields[dateProp.id]));
                if (!isNaN(parsed.getTime())) targetDate = parsed;
              } else if (page.createdAt) {
                targetDate = new Date(page.createdAt);
              }

              // Calculate start offset day index
              let startDayIdx = -1;
              if (targetDate) {
                const diffMs = targetDate.getTime() - startDate.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays < 28) {
                  startDayIdx = diffDays;
                }
              }

              return (
                <div key={page.id} className="pg-timeline-row">
                  <button
                    type="button"
                    className="pg-timeline-item-col"
                    onClick={() => onOpenPage(page.id)}
                  >
                    {page.icon ? <span className="pg-timeline-icon">{page.icon} </span> : null}
                    <span className="pg-timeline-title">
                      {page.title.trim().length > 0 ? page.title : BRAND.empty.untitled}
                    </span>
                  </button>
                  <div className="pg-timeline-days-col pg-timeline-grid-track">
                    {timelineDays.map((_, i) => (
                      <div key={i} className="pg-timeline-grid-cell" />
                    ))}
                    {startDayIdx >= 0 ? (
                      <button
                        type="button"
                        className="pg-timeline-bar"
                        style={{
                          left: `calc(${(startDayIdx / 28) * 100}% + 2px)`,
                          width: "calc(10% - 4px)",
                        }}
                        onClick={() => onOpenPage(page.id)}
                      >
                        {page.title.trim().length > 0 ? page.title : BRAND.empty.untitled}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {pages.length === 0 ? (
              <div className="pg-timeline-empty">No items yet in this database.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
