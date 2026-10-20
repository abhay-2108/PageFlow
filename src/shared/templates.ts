import type { TipTapDocument } from "./types";
import { EMPTY_DOC } from "./types";

export type TemplateCategory =
  | "work"
  | "engineering"
  | "product"
  | "meetings"
  | "planning"
  | "personal";

export interface PageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  icon: string;
  doc: TipTapDocument;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: "work", label: "Work & Projects", icon: "💼" },
  { id: "engineering", label: "Engineering & Tech", icon: "⚙️" },
  { id: "product", label: "Product & Design", icon: "🎨" },
  { id: "meetings", label: "Meetings & 1-on-1s", icon: "👥" },
  { id: "planning", label: "Planning & Goals", icon: "🎯" },
  { id: "personal", label: "Personal & Life", icon: "🌱" },
];

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ---------------------------------------------------------------------------
  // Work & Projects
  // ---------------------------------------------------------------------------
  {
    id: "blank",
    name: "Blank Page",
    category: "work",
    description: "Start clean with an empty page",
    icon: "📄",
    doc: EMPTY_DOC,
  },
  {
    id: "company-wiki",
    name: "Company Wiki & Hub",
    category: "work",
    description: "Central home for mission, team directory, culture, and key company links",
    icon: "🏢",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Acme Corp Team Wiki" }] },
        {
          type: "callout",
          attrs: { emoji: "🚀" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Welcome to Acme Corp! This hub holds our shared mission, onboarding guides, operating cadences, and directories." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our Core Mission" }] },
        { type: "paragraph", content: [{ type: "text", text: "Empower every knowledge worker with fast, private, and delightful software." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Quick Navigation" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Engineering Standards & Tech Stack" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Product Roadmap & Quarterly Goals" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Team Directory & Working Hours" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Benefits, Travel & Expenses" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Operating Cadence" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Monday 10:00 AM — All-hands alignment sync" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Wednesday 2:00 PM — Engineering demo hour" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Friday 4:30 PM — Retro and weekly reflections" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "project-tracker",
    name: "Projects & Tasks",
    category: "work",
    description: "Track project deliverables, owners, target release dates, and statuses",
    icon: "📌",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Projects & Deliverables" }] },
        {
          type: "callout",
          attrs: { emoji: "🎯" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Central hub for tracking active quarterly cross-functional initiatives." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Active Initiatives" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Project" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Owner" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Status" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Due Date" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Mobile App Refresh" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Design Lead" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "In Progress" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Nov 15" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Search Index v2" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Backend Team" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Oct 28" }] }] },
              ],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Immediate Launch Checklist" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Run automated regression tests" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Publish documentation and user release notes" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "docs-library",
    name: "Documentation Library",
    category: "work",
    description: "Repository of company manuals, operational guides, and architectural standards",
    icon: "📚",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Documentation Library" }] },
        {
          type: "callout",
          attrs: { emoji: "📖" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Reference manuals and guides for all internal products and team workflows." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Categories" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Platform Architecture & Database Schemas" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "API Contract Specs & Swagger References" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Security Standards & Compliance Audits" }] }] },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Engineering & Tech
  // ---------------------------------------------------------------------------
  {
    id: "engineering-wiki",
    name: "Engineering Wiki",
    category: "engineering",
    description: "Architecture principles, tech stack overview, onboarding, and deploy pipelines",
    icon: "💻",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Engineering Wiki & Guide" }] },
        {
          type: "callout",
          attrs: { emoji: "⚡" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Everything engineers need to set up their local environments, author pull requests, and deploy code." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Technology Stack" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Frontend: React, TypeScript, TipTap rich text engine" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "App Shell: Electron with multi-process IPC security" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Local Intelligence: Ollama via HTTP streaming APIs" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Persistence: SQLite3 with WAL mode for conflict-free writes" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Developer Quickstart" }] },
        {
          type: "codeBlock",
          attrs: { language: "bash" },
          content: [{ type: "text", text: "git clone https://github.com/org/repo.git\npnpm install\npnpm dev" }],
        },
      ],
    },
  },
  {
    id: "sprint-backlog",
    name: "Sprint Planning & Backlog",
    category: "engineering",
    description: "Sprints tracker with user stories, story points, epics, and retrospectives",
    icon: "⚡",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Sprint 24 Planning & Backlog" }] },
        {
          type: "callout",
          attrs: { emoji: "🎯" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Goal: Ship native Notion-like database views, formula editor, and side peek drawer." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sprint Epics & Stories" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Implement Kanban Board column drag-and-drop" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Add vertical divider grid lines and hover peek actions" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Add Timeline Gantt and Calendar layouts" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Write 100% passing test coverage" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "bug-tracker",
    name: "Bug Tracker",
    category: "engineering",
    description: "Structured bug reports, reproduction steps, severity levels, and patch status",
    icon: "🐛",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Issue & Bug Tracker" }] },
        {
          type: "callout",
          attrs: { emoji: "🔍" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Use this log to triage incoming software regressions and isolate minimal reproduction cases." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Active Bugs" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Defect" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Severity" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Component" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "State" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Popover clipped on small window" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "P2 - Low" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "UI / Modal" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Open" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Formula rollup division by zero" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "P1 - High" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Formula Engine" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Resolved" }] }] },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "incident-postmortem",
    name: "Incident Post-Mortem",
    category: "engineering",
    description: "Outage timeline, 5 Whys root cause analysis, and preventative action items",
    icon: "🚨",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Incident Post-Mortem: [INC-001]" }] },
        {
          type: "callout",
          attrs: { emoji: "🛡️" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Blameless analysis conducted to identify systemic improvements and prevent future recurrence." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Summary & Impact" }] },
        { type: "paragraph", content: [{ type: "text", text: "Duration: 22 minutes | Affected Services: Realtime Sync Gateway | Total Impact: 0.4% error rate." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Root Cause (5 Whys)" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Why 1: WebSocket connection pool exhausted." }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Why 2: Heartbeat timeout was set to 600s instead of 30s." }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Why 3: Configuration flag was missed in deployment validation." }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Corrective Action Items" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Lower idle connection TTL to 30 seconds" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Add Prometheus alert for pool saturation > 80%" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "engineering-rfc",
    name: "Design Doc / RFC",
    category: "engineering",
    description: "Architectural RFC with problem context, proposed implementation, and trade-offs",
    icon: "⚙️",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "RFC-101: Conflict-Free Storage Engine" }] },
        { type: "paragraph", content: [{ type: "text", text: "Status: Proposed | Authors: Architecture Team | Date: Oct 2026" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Context & Motivation" }] },
        { type: "paragraph", content: [{ type: "text", text: "As workspaces scale to thousands of nested documents, synchronous disk I/O introduces render latency." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Proposed Architecture" }] },
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "// Storage Tiering Interface\ninterface StorageAdapter {\n  read(pageId: string): Promise<Uint8Array>;\n  write(pageId: string, bytes: Uint8Array): Promise<void>;\n}",
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Security & Observability" }] },
        { type: "paragraph", content: [{ type: "text", text: "All documents remain encrypted on local device storage with zero remote telemetry." }] },
      ],
    },
  },
  {
    id: "feature-playground",
    name: "Feature Showcase & Playground",
    category: "engineering",
    description: "Interactive demo of Callouts, Code Blocks, Toggle Lists, and Database Tasks",
    icon: "🚀",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "PageFlow Feature Playground" }] },
        {
          type: "callout",
          attrs: { emoji: "💡" },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Welcome to PageFlow! Use " },
                { type: "text", text: "/", marks: [{ type: "code" }] },
                { type: "text", text: " anywhere to quickly insert tables, callouts, code blocks, or toggle lists." },
              ],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Interactive Task Checklist" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Explore multi-layout databases (Table, Board, Gallery, Calendar, Timeline)" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Test side peek drawer and column formulas" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Run local Ollama AI assistant from the top bar" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Collapsible Toggle Section" }] },
        {
          type: "toggle",
          attrs: { collapsed: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Click the arrow to expand or collapse this section. It keeps dense reference notes tidy." }],
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Product & Design
  // ---------------------------------------------------------------------------
  {
    id: "product-roadmap",
    name: "Product Roadmap",
    category: "product",
    description: "Quarterly initiatives, strategic themes, feature timeline, and delivery status",
    icon: "🗺️",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "2026 Product Roadmap" }] },
        {
          type: "callout",
          attrs: { emoji: "🌟" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Strategic focus: Local-first performance, offline AI intelligence, and rich relational databases." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Q1 Initiatives" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Full Notion desktop table and grid replication" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Offline Ollama LLM integration with reasoning traces" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Cross-page bi-directional backlink references" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Q2 Initiatives" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Interactive Timeline & Gantt chart dependencies" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "End-to-end encrypted peer synchronization" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "feature-spec",
    name: "Product Spec / PRD",
    category: "product",
    description: "Problem statement, user personas, functional requirements, and launch checklist",
    icon: "📐",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "PRD: Inline Database Views" }] },
        {
          type: "callout",
          attrs: { emoji: "🎯" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Target Release: v2.4 | PM: Product Team | Eng Lead: Architecture" }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Problem Statement" }] },
        { type: "paragraph", content: [{ type: "text", text: "Users need to switch between Table, Board, Gallery, and Timeline views without losing filter states." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Success Metrics" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sub-16ms layout switch latency with zero UI stutter" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "100% data fidelity when switching views" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "3. Non-Goals" }] },
        { type: "paragraph", content: [{ type: "text", text: "Cloud sync infrastructure is out of scope for this milestone." }] },
      ],
    },
  },
  {
    id: "design-system",
    name: "Design System Hub",
    category: "product",
    description: "Design tokens, color palette, typography scale, component specs, and UI patterns",
    icon: "🎨",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Design System Guidelines" }] },
        {
          type: "callout",
          attrs: { emoji: "✨" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Our design tokens prioritize legibility, subtle contrast, and calm dark mode palettes." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Color Palette Principles" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Neutral Base: #191817 in dark mode, #ffffff in light mode" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Accent: Subtle sage green and iris purple for AI accents" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Pastel Badges: Translucent fills (28% opacity) in dark mode" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "user-research",
    name: "User Research Repository",
    category: "product",
    description: "User interview transcripts, customer feedback cohorts, and synthesized insights",
    icon: "🔍",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "User Research Synthesis" }] },
        {
          type: "callout",
          attrs: { emoji: "💡" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Key findings from 18 interviews across engineering leads and product managers." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Primary User Pain Points" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Cloud tools lag when documents exceed 100 pages" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Engineering teams require absolute offline privacy for proprietary code" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "User Quotes" }] },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "“If an app is fast, I think faster. Speed is the number one feature.”" }] },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Meetings & 1-on-1s
  // ---------------------------------------------------------------------------
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    category: "meetings",
    description: "Structure agenda, discussions, attendees, and action items",
    icon: "📝",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Team Sync & Meeting Notes" }] },
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
    id: "1-on-1",
    name: "1-on-1 Meeting Log",
    category: "meetings",
    description: "Check-in log, talking points, career growth goals, and blocker resolution",
    icon: "🤝",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "1-on-1: [Manager] & [Teammate]" }] },
        {
          type: "callout",
          attrs: { emoji: "💬" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "This recurring space is for career growth, open feedback, and solving blockers." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Talking Points" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "How has your energy and focus been this sprint?" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Any organizational or technical blockers I can help clear?" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Commitments" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Schedule technical spike for Q2 architecture" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "weekly-sync",
    name: "Weekly Team Sync",
    category: "meetings",
    description: "Round-robin updates, sprint highlights, announcements, and blockers",
    icon: "👥",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Weekly Team Sync" }] },
        {
          type: "callout",
          attrs: { emoji: "📢" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Keep updates brief: What shipped last week, what's shipping this week, and where you're blocked." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🏆 Highlights & Wins" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped fast fuzzy search across 10,000 subpages" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "⚠️ Blockers" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "None currently flagged" }] }] },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Planning & Goals
  // ---------------------------------------------------------------------------
  {
    id: "okrs-goals",
    name: "OKRs & Quarterly Goals",
    category: "planning",
    description: "Company and team objectives with measurable key results and progress tracking",
    icon: "🎯",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Quarterly OKRs" }] },
        {
          type: "callout",
          attrs: { emoji: "🎯" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Objective 1: Make PageFlow the fastest local-first workspace for power users." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key Results" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "KR1: Reduce editor cold-boot time below 200ms" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "KR2: Support 100% offline AI intelligence without network dependency" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "KR3: Attain 0 open P0/P1 bugs in regression suite" }] }] },
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
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped database grid border improvements" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "⚠️ Challenges & Blockers" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Need clearer specifications on complex formula AST" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🎯 Priorities for Next Week" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Polish template gallery category icons" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "project-brief",
    name: "Project Brief",
    category: "planning",
    description: "Comprehensive spec outlining goals, scope, and deliverable timeline",
    icon: "📊",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Project Brief: Database Views" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. Problem Statement" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why does this project matter to our users?" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "2. Success Metrics" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "All 5 views operational on the same page" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Smooth 60fps scrolling on large databases" }] }] },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Personal & Life
  // ---------------------------------------------------------------------------
  {
    id: "todo-list",
    name: "To-Do List & Task Manager",
    category: "personal",
    description: "Prioritized tasks, everyday checklists, and quick capture inbox",
    icon: "✅",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Daily Tasks & Planner" }] },
        {
          type: "callout",
          attrs: { emoji: "☀️" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Pick your top 3 needle-moving tasks before checking incoming messages." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "High Priority (Must Ship Today)" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Finalize AI template creation pipeline" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Later This Week" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Clean up workspace inbox" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Review open pull requests" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "habit-tracker",
    name: "Habit & Routine Tracker",
    category: "personal",
    description: "Daily streak checklist, morning and evening routines, and weekly habit score",
    icon: "🌱",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Habit & Routine Tracker" }] },
        {
          type: "callout",
          attrs: { emoji: "🌱" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Small consistent habits compound into extraordinary lifelong outcomes." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Morning Routine" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Hydrate: 500ml water" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "20 min morning sunlight & walk" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "90 min uninterrupted deep work block" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Evening Routine" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Plan tomorrow's top 3 outcomes" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Read 20 pages of a physical book" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "reading-list",
    name: "Reading List & Book Tracker",
    category: "personal",
    description: "Books in progress, key takeaways, ratings, reading queue, and quote highlights",
    icon: "📖",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Reading List & Book Shelf" }] },
        {
          type: "callout",
          attrs: { emoji: "📚" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Capture books, synthesis notes, and core takeaways worth remembering." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Currently Reading" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Book Title" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Author" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Genre" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Status" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Designing Data-Intensive Applications" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Martin Kleppmann" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Systems" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Reading" }] }] },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "personal-journal",
    name: "Daily Journal & Reflection",
    category: "personal",
    description: "Morning intentions, gratitude, daily accomplishments, and evening reflection",
    icon: "✍️",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Daily Journal" }] },
        {
          type: "callout",
          attrs: { emoji: "✍️" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Clear your mind, celebrate small wins, and reflect on personal growth." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🙏 What I'm Grateful For Today" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "1. " }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "2. " }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "3. " }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "💡 Key Insights & Takeaways" }] },
        { type: "paragraph", content: [{ type: "text", text: "What went exceptionally well today, and what could be improved tomorrow?" }] },
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
