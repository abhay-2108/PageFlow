import type { TipTapDocument } from "./types";
import { EMPTY_DOC } from "./types";

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  doc: TipTapDocument;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start with an empty page",
    icon: "📄",
    doc: EMPTY_DOC,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, notes, and action items",
    icon: "📝",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Meeting: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Date: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Attendees: " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph" }] },
          { type: "listItem", content: [{ type: "paragraph" }] },
        ] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        { type: "taskList", content: [
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        ] },
      ],
    },
  },
  {
    id: "todo-list",
    name: "To-Do List",
    description: "Track tasks with checkboxes",
    icon: "✅",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tasks" }] },
        { type: "taskList", content: [
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "First task" }] }] },
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Second task" }] }] },
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Third task" }] }] },
        ] },
      ],
    },
  },
  {
    id: "weekly-review",
    name: "Weekly Review",
    description: "Reflect on the week",
    icon: "📋",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Weekly Review" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Wins" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph" }] },
        ] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Challenges" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph" }] },
        ] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Next Week" }] },
        { type: "taskList", content: [
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        ] },
      ],
    },
  },
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Outline a new project",
    icon: "📐",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Project: " }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Overview" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Goals" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph" }] },
        ] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Timeline" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Tasks" }] },
        { type: "taskList", content: [
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        ] },
      ],
    },
  },
];

export function getTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}
