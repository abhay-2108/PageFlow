import { useMemo, useState } from "react";
import { BRAND } from "../../../shared/brand";
import type { PropertyDef, PropertyValue } from "../../../shared/database";
import type { PageMeta } from "../../../shared/types";

interface CalendarViewProps {
  pages: PageMeta[];
  properties: PropertyDef[];
  onOpenPage: (id: string) => void;
  onCreatePage?: (dateString?: string) => void;
}

export function CalendarView({
  pages,
  properties,
  onOpenPage,
  onCreatePage,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const dateProp = useMemo(() => {
    return properties.find((p) => p.type === "date") ?? null;
  }, [properties]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // Group pages by date string: YYYY-MM-DD
  const pagesByDate = useMemo(() => {
    const map = new Map<string, PageMeta[]>();
    for (const page of pages) {
      let dStr = "";
      if (dateProp && page.fields[dateProp.id]) {
        dStr = String(page.fields[dateProp.id]).slice(0, 10);
      } else if (page.createdAt) {
        dStr = new Date(page.createdAt).toISOString().slice(0, 10);
      }
      if (dStr) {
        const list = map.get(dStr) ?? [];
        list.push(page);
        map.set(dStr, list);
      }
    }
    return map;
  }, [pages, dateProp]);

  const calendarDays = [];
  // Leading empty days
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="pg-calendar-view" aria-label="Database calendar view">
      <div className="pg-calendar-header">
        <div className="pg-calendar-title">
          <h3>
            {monthName} {year}
          </h3>
          {dateProp ? (
            <span className="pg-calendar-date-prop">Using: {dateProp.name}</span>
          ) : (
            <span className="pg-calendar-date-prop">Using: Created Date</span>
          )}
        </div>
        <div className="pg-calendar-nav">
          <button type="button" className="pg-btn pg-btn--secondary" onClick={today}>
            Today
          </button>
          <button type="button" className="pg-btn pg-btn--secondary" onClick={prevMonth}>
            ‹
          </button>
          <button type="button" className="pg-btn pg-btn--secondary" onClick={nextMonth}>
            ›
          </button>
        </div>
      </div>

      <div className="pg-calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="pg-calendar-day-header">
            {day}
          </div>
        ))}
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="pg-calendar-cell pg-calendar-cell--empty" />;
          }
          const monthFormatted = String(month + 1).padStart(2, "0");
          const dayFormatted = String(day).padStart(2, "0");
          const dateKey = `${year}-${monthFormatted}-${dayFormatted}`;
          const items = pagesByDate.get(dateKey) ?? [];

          const isToday =
            new Date().getDate() === day &&
            new Date().getMonth() === month &&
            new Date().getFullYear() === year;

          return (
            <div
              key={dateKey}
              className={isToday ? "pg-calendar-cell pg-calendar-cell--today" : "pg-calendar-cell"}
              onClick={() => onCreatePage?.(dateKey)}
            >
              <div className="pg-calendar-date-number">{day}</div>
              <div className="pg-calendar-events">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="pg-calendar-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPage(item.id);
                    }}
                  >
                    {item.icon ? <span className="pg-calendar-item-icon">{item.icon}</span> : null}
                    <span className="pg-calendar-item-title">
                      {item.title.trim().length > 0 ? item.title : BRAND.empty.untitled}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
