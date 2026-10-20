import type { TipTapDocument } from "./types";
import { EMPTY_DOC } from "./types";

export type TemplateCategory = "general" | "meetings" | "planning" | "engineering" | "personal";

export interface PageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  icon: string;
  doc: TipTapDocument;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "meetings", label: "Meetings" },
  { id: "planning", label: "Planning" },
  { id: "engineering", label: "Engineering & Tech" },
  { id: "personal", label: "Personal" },
];

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank",
    name: "Blank Page",
    category: "general",
    description: "Start clean with an empty page",
    icon: "📄",
    doc: EMPTY_DOC,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    category: "meetings",
    description: "Structure agenda, discussions, attendees, and action items",
    icon: "📝",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Team Meeting" }] },
        { type: "paragraph", content: [{ type: "text", text: "📅 Date: " }] },
        { type: "paragraph", content: [{ type: "text", text: "👥 Attendees: " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sprint review & blockers" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Product roadmap update" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Discussion Notes" }] },
        { type: "paragraph", content: [{ type: "text", text: "Key decisions and takeaways..." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Follow up with design team" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Update architecture doc" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "todo-list",
    name: "To-Do List",
    category: "personal",
    description: "Prioritized tasks and everyday checklists",
    icon: "✅",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Daily Tasks" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "High Priority" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Finish core deliverables" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Later" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Clean up inbox" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Review open PRs" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "weekly-review",
    name: "Weekly Review",
    category: "planning",
    description: "Reflect on wins, challenges, and plan your upcoming week",
    icon: "📋",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Weekly Review" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🏆 Wins & Highlights" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped the new feature set" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "⚠️ Challenges & Blockers" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Need clearer specifications on API endpoints" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🎯 Priorities for Next Week" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Draft sprint RFC" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "project-brief",
    name: "Project Brief",
    category: "planning",
    description: "Comprehensive spec outlining goals, scope, and timeline",
    icon: "📐",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Project Brief" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Problem Statement" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why does this project matter?" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Success Metrics" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Metric 1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Metric 2" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "3. Scope & Timeline" }] },
        { type: "paragraph", content: [{ type: "text", text: "Key milestones and deliverable dates." }] },
      ],
    },
  },
  {
    id: "engineering-rfc",
    name: "Engineering RFC",
    category: "engineering",
    description: "Request for Comments technical design document",
    icon: "⚙️",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "RFC: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Status: Proposed | Authors: | Date: " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Context & Background" }] },
        { type: "paragraph", content: [{ type: "text", text: "Explain the current architecture and why change is necessary." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Proposed Design" }] },
        { type: "paragraph", content: [{ type: "text", text: "Detailed technical architecture and trade-offs." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Security & Observability" }] },
        { type: "paragraph", content: [{ type: "text", text: "Telemetry, error handling, and authorization rules." }] },
      ],
    },
  },
];

const CUSTOM_TEMPLATES_KEY = "pg_custom_templates";

export function getCustomTemplates(): PageTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as PageTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: PageTemplate): void {
  try {
    const existing = getCustomTemplates().filter((t) => t.id !== template.id);
    existing.push(template);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function getAllTemplates(): PageTemplate[] {
  return [...PAGE_TEMPLATES, ...getCustomTemplates()];
}

export function getTemplate(id: string): PageTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}
