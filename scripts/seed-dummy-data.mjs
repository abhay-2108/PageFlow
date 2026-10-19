import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

const userProfile = process.env.USERPROFILE || "";
let docsDir = join(userProfile, "Documents");
if (existsSync(join(userProfile, "OneDrive", "Documents"))) {
  docsDir = join(userProfile, "OneDrive", "Documents");
}

const defaultDir = existsSync(join(docsDir, "PageFlow"))
  ? join(docsDir, "PageFlow")
  : existsSync(join(docsDir, "NotionFlow"))
  ? join(docsDir, "NotionFlow")
  : existsSync(join(docsDir, "Pagegrove"))
  ? join(docsDir, "Pagegrove")
  : join(docsDir, "PageFlow");
const workspaceDir =
  process.env.PAGEFLOW_WORKSPACE ||
  process.env.NOTIONFLOW_WORKSPACE ||
  process.env.PAGEGROVE_WORKSPACE ||
  defaultDir;
mkdirSync(workspaceDir, { recursive: true });
const dbPath = join(workspaceDir, "workspace.db");

console.log("Connecting to database at:", dbPath);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const now = Date.now();

// 1. Ensure migrations up to v8 are applied if fresh
const version = db.pragma("user_version", { simple: true });
if (version < 1) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      rank REAL NOT NULL,
      doc TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_pages_parent_rank ON pages(parent_id, rank);
    CREATE INDEX IF NOT EXISTS idx_pages_deleted ON pages(deleted_at);
  `);
  db.pragma("user_version = 1");
}
if (version < 2) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yupdates (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL,
      bytes BLOB NOT NULL
    );
  `);
  db.pragma("user_version = 2");
}
if (version < 3) {
  db.exec(`
    ALTER TABLE pages ADD COLUMN icon TEXT;
    ALTER TABLE pages ADD COLUMN cover TEXT;
  `);
  db.pragma("user_version = 3");
}
if (version < 4) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_threads (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      quote TEXT NOT NULL DEFAULT '',
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comment_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.pragma("user_version = 4");
}
if (version < 5) {
  db.exec(`ALTER TABLE pages ADD COLUMN view TEXT NOT NULL DEFAULT 'doc';`);
  db.pragma("user_version = 5");
}
if (version < 6) {
  db.exec(`ALTER TABLE pages ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;`);
  db.pragma("user_version = 6");
}
if (version < 7) {
  db.exec(`
    ALTER TABLE pages ADD COLUMN properties TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE pages ADD COLUMN fields TEXT NOT NULL DEFAULT '{}';
  `);
  db.pragma("user_version = 7");
}
if (version < 8) {
  db.exec(`ALTER TABLE pages ADD COLUMN db_config TEXT;`);
  db.pragma("user_version = 8");
}

// 1.5 Clean up any old test records
db.exec(`
  DELETE FROM pages WHERE id NOT LIKE '%-%-%-%-%' 
    OR id LIKE 'welcome-%' 
    OR id LIKE 'product-%' 
    OR id LIKE 'subtasks-%' 
    OR id LIKE 'card-%' 
    OR id LIKE 'subtask-%';
`);

// 2. Prepare Insert Statement
const insertPage = db.prepare(`
  INSERT OR REPLACE INTO pages (
    id, parent_id, title, rank, icon, cover, view, favorite,
    properties, fields, db_config, doc, text, created_at, updated_at
  ) VALUES (
    @id, @parent_id, @title, @rank, @icon, @cover, @view, @favorite,
    @properties, @fields, @db_config, @doc, @text, @created_at, @updated_at
  )
`);

function makeDoc(paragraphs = []) {
  const content = paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
  return JSON.stringify({ type: "doc", content });
}

// RFC 4122 v4 compliant UUID constants
const WELCOME_ID = "00000000-0000-4000-8000-000000000001";
const ROADMAP_ID = "00000000-0000-4000-8000-000000000002";
const SUBTASKS_ID = "00000000-0000-4000-8000-000000000003";

const CARD_1_ID = "00000000-0000-4000-8000-000000000011";
const CARD_2_ID = "00000000-0000-4000-8000-000000000012";
const CARD_3_ID = "00000000-0000-4000-8000-000000000013";
const CARD_4_ID = "00000000-0000-4000-8000-000000000014";
const CARD_5_ID = "00000000-0000-4000-8000-000000000015";

const TASK_1_ID = "00000000-0000-4000-8000-000000000021";
const TASK_2_ID = "00000000-0000-4000-8000-000000000022";
const TASK_3_ID = "00000000-0000-4000-8000-000000000023";
const TASK_4_ID = "00000000-0000-4000-8000-000000000024";

// --- SUBTASKS DATABASE ---
const subtaskProperties = [
  {
    id: "prop_sub_status",
    name: "Status",
    type: "select",
    options: ["Pending", "In Review", "Completed"],
    optionColors: { Pending: "yellow", "In Review": "blue", Completed: "green" },
  },
  { id: "price", name: "Budget ($)", type: "number", options: [] },
];

insertPage.run({
  id: SUBTASKS_ID,
  parent_id: null,
  title: "Technical Deliverables and Subsystem Breakdown",
  rank: 3.0,
  icon: null,
  cover: "slate",
  view: "table",
  favorite: 0,
  properties: JSON.stringify(subtaskProperties),
  fields: "{}",
  db_config: JSON.stringify({
    views: [{ id: "v1", name: "All Deliverables", layout: "table", sorts: [], filters: [] }],
    activeViewId: "v1",
  }),
  doc: makeDoc([
    "Granular execution units mapped to parent initiatives via bidirectional relations.",
    "Cost rollups dynamically summarize resource allocations across work streams.",
  ]),
  text: "Technical Deliverables and Subsystem Breakdown granular execution units",
  created_at: now - 3600000 * 20,
  updated_at: now - 3600000 * 5,
});

insertPage.run({
  id: TASK_1_ID,
  parent_id: SUBTASKS_ID,
  title: "AST Lexer and Grammar Tokenizer",
  rank: 1.0,
  icon: null,
  cover: null,
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({ prop_sub_status: "Completed", price: 500 }),
  db_config: null,
  doc: makeDoc([
    "Deterministic state machine for formula expression lexing.",
    "Validates identifier references and literal constants prior to syntactic parsing.",
  ]),
  text: "AST Lexer and Grammar Tokenizer deterministic state machine",
  created_at: now - 3600000 * 18,
  updated_at: now - 3600000 * 4,
});

insertPage.run({
  id: TASK_2_ID,
  parent_id: SUBTASKS_ID,
  title: "Recursive Expression Parser and Tree Evaluator",
  rank: 2.0,
  icon: null,
  cover: null,
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({ prop_sub_status: "Completed", price: 750 }),
  db_config: null,
  doc: makeDoc([
    "Recursive descent operator-precedence parsing.",
    "Evaluates arithmetic, comparison, and ternary conditional operators in linear time.",
  ]),
  text: "Recursive Expression Parser and Tree Evaluator operator precedence",
  created_at: now - 3600000 * 16,
  updated_at: now - 3600000 * 3,
});

insertPage.run({
  id: TASK_3_ID,
  parent_id: SUBTASKS_ID,
  title: "Formula Syntax Analysis and Rule Validation",
  rank: 3.0,
  icon: null,
  cover: null,
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({ prop_sub_status: "Completed", price: 400 }),
  db_config: null,
  doc: makeDoc([
    "Pre-compile diagnostic passes detecting circular dependency cycles across rollup chains.",
  ]),
  text: "Formula Syntax Analysis and Rule Validation diagnostic checks",
  created_at: now - 3600000 * 14,
  updated_at: now - 3600000 * 2,
});

insertPage.run({
  id: TASK_4_ID,
  parent_id: SUBTASKS_ID,
  title: "Multi-Column Layout Matrix and Virtual Scrolling",
  rank: 4.0,
  icon: null,
  cover: null,
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({ prop_sub_status: "Pending", price: 600 }),
  db_config: null,
  doc: makeDoc([
    "Hardware-accelerated column rendering with fixed row-height virtualization.",
    "Ensures constant 60fps interaction under dense dataset volume.",
  ]),
  text: "Multi-Column Layout Matrix and Virtual Scrolling hardware accelerated",
  created_at: now - 3600000 * 12,
  updated_at: now - 3600000 * 1,
});

// --- ROADMAP DATABASE ---
const roadmapProperties = [
  {
    id: "prop_status",
    name: "Status",
    type: "status",
    options: ["Not started", "In progress", "Done"],
    optionColors: { "Not started": "gray", "In progress": "blue", Done: "green" },
    statusGroups: { "Not started": "todo", "In progress": "in_progress", Done: "complete" },
  },
  {
    id: "prop_priority",
    name: "Priority",
    type: "select",
    options: ["P0 - Critical", "P1 - High", "P2 - Normal"],
    optionColors: { "P0 - Critical": "red", "P1 - High": "orange", "P2 - Normal": "yellow" },
  },
  {
    id: "prop_est",
    name: "Allocated Hours",
    type: "number",
    options: [],
  },
  {
    id: "prop_rate",
    name: "Billing Rate ($/hr)",
    type: "number",
    options: [],
  },
  {
    id: "prop_cost",
    name: "Total Expenditure",
    type: "formula",
    options: [],
    formula: 'prop("Allocated Hours") * prop("Billing Rate ($/hr)")',
  },
  {
    id: "prop_owner",
    name: "Lead Engineer",
    type: "text",
    options: [],
  },
  {
    id: "prop_date",
    name: "Milestone Deadline",
    type: "date",
    options: [],
  },
  {
    id: "prop_url",
    name: "Technical Specification",
    type: "url",
    options: [],
  },
  {
    id: "prop_email",
    name: "Contact Email",
    type: "email",
    options: [],
  },
  {
    id: "prop_phone",
    name: "Pager Extension",
    type: "phone",
    options: [],
  },
  {
    id: "prop_tasks",
    name: "Associated Deliverables",
    type: "relation",
    options: [],
    relationHubId: SUBTASKS_ID,
  },
  {
    id: "prop_subtotal",
    name: "Subsystem Rollup Cost",
    type: "rollup",
    options: [],
    relationPropId: "prop_tasks",
    rollupPropId: "price",
    rollupOp: "sum",
  },
  {
    id: "prop_verified",
    name: "Architecture Verified",
    type: "checkbox",
    options: [],
  },
];

const roadmapViews = [
  { id: "view_board", name: "Kanban Board", layout: "board", groupByPropId: "prop_status", sorts: [], filters: [] },
  { id: "view_table", name: "Table Matrix", layout: "table", sorts: [], filters: [] },
  { id: "view_gallery", name: "Specification Cards", layout: "gallery", sorts: [], filters: [] },
];

insertPage.run({
  id: ROADMAP_ID,
  parent_id: null,
  title: "Core Infrastructure and Platform Engineering Roadmap",
  rank: 2.0,
  icon: null,
  cover: "slate",
  view: "table",
  favorite: 1,
  properties: JSON.stringify(roadmapProperties),
  fields: "{}",
  db_config: JSON.stringify({
    views: roadmapViews,
    activeViewId: "view_board",
  }),
  doc: makeDoc([
    "Primary tracking register for systems engineering and architectural milestones.",
    "Formulas monitor expenditure against engineering hours while rollups aggregate sub-task budgets.",
  ]),
  text: "Core Infrastructure and Platform Engineering Roadmap primary tracking register",
  created_at: now - 3600000 * 24,
  updated_at: now - 3600000 * 2,
});

// Roadmap Cards with high-entropy, realistic enterprise details
insertPage.run({
  id: CARD_1_ID,
  parent_id: ROADMAP_ID,
  title: "Distributed Query Execution and Index Pruning",
  rank: 1.0,
  icon: null,
  cover: "slate",
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({
    prop_status: "In progress",
    prop_priority: "P0 - Critical",
    prop_est: 32,
    prop_rate: 150,
    prop_owner: "Elena Rostova",
    prop_date: "2026-10-25",
    prop_url: "https://specs.internal/query-engine",
    prop_email: "elena.rostova@internal.net",
    prop_phone: "+1 415-555-0142",
    prop_tasks: [TASK_1_ID, TASK_2_ID],
    prop_verified: false,
  }),
  db_config: null,
  doc: makeDoc([
    "Production query workloads require deterministic execution boundaries under high concurrency.",
    "We construct push-down predicates during AST traversal before secondary index scans, cutting disk I/O amplification on analytical queries.",
  ]),
  text: "Distributed Query Execution and Index Pruning push-down predicates",
  created_at: now - 3600000 * 22,
  updated_at: now - 3600000 * 2,
});

insertPage.run({
  id: CARD_2_ID,
  parent_id: ROADMAP_ID,
  title: "Local-First Conflict-Free Document Replication",
  rank: 2.0,
  icon: null,
  cover: "sand",
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({
    prop_status: "Done",
    prop_priority: "P0 - Critical",
    prop_est: 40,
    prop_rate: 160,
    prop_owner: "Marcus Vance",
    prop_date: "2026-10-18",
    prop_url: "https://specs.internal/crdt-sync",
    prop_email: "marcus.vance@internal.net",
    prop_phone: "+1 650-555-0188",
    prop_tasks: [TASK_3_ID],
    prop_verified: true,
  }),
  db_config: null,
  doc: makeDoc([
    "Multi-peer state convergence relies on state-based CRDT delta propagation with Lamport timestamps.",
    "Transactions append to local SQLite write-ahead log tables prior to WebRTC peer replication.",
  ]),
  text: "Local-First Conflict-Free Document Replication state-based CRDT",
  created_at: now - 3600000 * 20,
  updated_at: now - 3600000 * 3,
});

insertPage.run({
  id: CARD_3_ID,
  parent_id: ROADMAP_ID,
  title: "Interface Rendering and Typography Pipeline",
  rank: 3.0,
  icon: null,
  cover: "sage",
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({
    prop_status: "In progress",
    prop_priority: "P1 - High",
    prop_est: 20,
    prop_rate: 120,
    prop_owner: "Kavita Rao",
    prop_date: "2026-10-30",
    prop_url: "https://specs.internal/render-pipeline",
    prop_email: "kavita.rao@internal.net",
    prop_phone: "+1 206-555-0177",
    prop_tasks: [TASK_4_ID],
    prop_verified: false,
  }),
  db_config: null,
  doc: makeDoc([
    "Sub-pixel font rendering with strict layout containment boundaries.",
    "Applies CSS layout isolation (`contain: paint layout`) to eliminate full-tree reflow penalties during document updates.",
  ]),
  text: "Interface Rendering and Typography Pipeline layout containment",
  created_at: now - 3600000 * 18,
  updated_at: now - 3600000 * 1,
});

insertPage.run({
  id: CARD_4_ID,
  parent_id: ROADMAP_ID,
  title: "Offline Storage Architecture and State Management",
  rank: 4.0,
  icon: null,
  cover: "slate",
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({
    prop_status: "Not started",
    prop_priority: "P2 - Normal",
    prop_est: 60,
    prop_rate: 110,
    prop_owner: "Devin Chen",
    prop_date: "2026-11-15",
    prop_url: "https://specs.internal/offline-storage",
    prop_email: "devin.chen@internal.net",
    prop_phone: "+1 408-555-0166",
    prop_tasks: [],
    prop_verified: false,
  }),
  db_config: null,
  doc: makeDoc([
    "Zero-dependency client persistence boundary using memory-mapped paging.",
    "Thread affinity guarantees serialized disk writes without deadlocks during heavy background synchronizations.",
  ]),
  text: "Offline Storage Architecture and State Management memory-mapped paging",
  created_at: now - 3600000 * 15,
  updated_at: now - 3600000 * 5,
});

insertPage.run({
  id: CARD_5_ID,
  parent_id: ROADMAP_ID,
  title: "Analytical Data Store and Star Schema Pipeline",
  rank: 5.0,
  icon: null,
  cover: "sand",
  view: "doc",
  favorite: 0,
  properties: "[]",
  fields: JSON.stringify({
    prop_status: "Done",
    prop_priority: "P1 - High",
    prop_est: 28,
    prop_rate: 140,
    prop_owner: "Siddharth Nair",
    prop_date: "2026-10-14",
    prop_url: "https://specs.internal/data-warehouse",
    prop_email: "siddharth.nair@internal.net",
    prop_phone: "+1 212-555-0155",
    prop_tasks: [],
    prop_verified: true,
  }),
  db_config: null,
  doc: makeDoc([
    "Columnar compression and vectorized batch evaluation.",
    "Incremental rollup materialization reduces analytical scan overhead across complex aggregation queries.",
  ]),
  text: "Analytical Data Store and Star Schema Pipeline columnar compression",
  created_at: now - 3600000 * 12,
  updated_at: now - 3600000 * 6,
});

// --- WELCOME & PLAYGROUND PAGE ---
const welcomeDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Pagegrove Architecture and Operating Manual" },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Pagegrove is a local-first engineering document platform backed by SQLite write-ahead logging and conflict-free replication. System operations and keyboard commands are documented below." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Window and Tab Management" },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "code" }], text: "Ctrl + T" },
        { type: "text", text: " spawns an isolated workspace tab. " },
        { type: "text", marks: [{ type: "code" }], text: "Ctrl + W" },
        { type: "text", text: " terminates the current tab session." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Local Ollama AI Integration" },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "code" }], text: "Ctrl + J" },
        { type: "text", text: " opens the contextual inline editing palette. Highlight text to refine clarity, condense wording, or extract structural checklists." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "code" }], text: "Ctrl + Shift + J" },
        { type: "text", text: " toggles the persistent document assistant drawer with full-page context awareness." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Markdown Input Shortcuts" },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "• Type " },
        { type: "text", marks: [{ type: "code" }], text: "> + Space" },
        { type: "text", text: " to initialize a collapsible section." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "• Type " },
        { type: "text", marks: [{ type: "code" }], text: "[] + Space" },
        { type: "text", text: " to generate a task checkbox." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "• Type " },
        { type: "text", marks: [{ type: "code" }], text: "---" },
        { type: "text", text: " to insert a visual horizontal divider." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "• Type " },
        { type: "text", marks: [{ type: "code" }], text: '" + Space' },
        { type: "text", text: " to format a blockquote citation." },
      ],
    },
  ],
};

insertPage.run({
  id: WELCOME_ID,
  parent_id: null,
  title: "Workspace Overview and Platform Guide",
  rank: 1.0,
  icon: null,
  cover: "slate",
  view: "doc",
  favorite: 1,
  properties: "[]",
  fields: "{}",
  db_config: null,
  doc: JSON.stringify(welcomeDoc),
  text: "Workspace Overview and Platform Guide local-first engineering document platform",
  created_at: now - 3600000 * 25,
  updated_at: now,
});

console.log("Successfully seeded professional humanized data into Pagegrove database.");
db.close();
