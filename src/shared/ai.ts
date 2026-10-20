export interface AiModelInfo {
  name: string;
  size: number;
  modifiedAt?: string;
  parameterSize?: string;
}

export interface AiStatus {
  available: boolean;
  models: AiModelInfo[];
  selectedModel: string;
  error?: string;
}

export type AiAction =
  | "continue"
  | "summarize"
  | "improve"
  | "fix_spelling"
  | "shorter"
  | "longer"
  | "action_items"
  | "brainstorm"
  | "explain"
  | "translate"
  | "create_page"
  | "custom";

export interface TranslationLanguage {
  code: string;
  name: string;
  native: string;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "zh-cn", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-tw", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "ar", name: "Arabic", native: "العربية" },
];

export interface AiGenerateInput {
  prompt: string;
  action?: AiAction;
  context?: string;
  pageTitle?: string;
  targetLanguage?: string;
  model?: string;
  systemPrompt?: string;
}

export interface AiGenerateResult {
  text: string;
  thinking?: string;
  model: string;
  done: boolean;
}

export interface AiStreamChunk {
  requestId: string;
  chunk: string;
  full: string;
  thinking?: string;
  isThinking?: boolean;
  done: boolean;
}

export const AI_ACTION_LABELS: Record<AiAction, { title: string; hint: string; icon: string }> = {
  continue: { title: "Continue writing", hint: "Draft next paragraphs from context", icon: "¶" },
  summarize: { title: "Summarize", hint: "Create a concise executive summary", icon: "≡" },
  improve: { title: "Improve writing", hint: "Enhance clarity, flow, and polish", icon: "✦" },
  fix_spelling: { title: "Fix spelling & grammar", hint: "Correct typos and grammatical errors", icon: "✓" },
  shorter: { title: "Make shorter", hint: "Trim fluff while keeping core facts", icon: "–" },
  longer: { title: "Make longer", hint: "Elaborate with details and examples", icon: "+" },
  action_items: { title: "Find action items", hint: "Extract checklist of to-dos", icon: "☑" },
  brainstorm: { title: "Brainstorm ideas", hint: "Generate creative angles and options", icon: "◇" },
  explain: { title: "Explain this", hint: "Break down complex concepts simply", icon: "?" },
  translate: { title: "Translate", hint: "Translate into 14+ languages", icon: "🌐" },
  create_page: { title: "Create page", hint: "Generate a structured new page", icon: "📄" },
  custom: { title: "Custom prompt", hint: "Ask anything about this document", icon: "›" },
};

export function parseThinkingAndContent(raw: string): { thinking: string; content: string; isThinking: boolean } {
  if (/<think>/i.test(raw)) {
    if (/<\/think>/i.test(raw)) {
      const parts = raw.split(/<\/think>/i);
      const thinking = (parts[0] ?? "").replace(/^[\s\S]*?<think>/i, "").trim();
      const content = parts.slice(1).join("</think>").trimStart();
      return { thinking, content, isThinking: false };
    } else {
      const thinking = raw.replace(/^[\s\S]*?<think>/i, "").trimStart();
      return { thinking, content: "", isThinking: true };
    }
  }
  return { thinking: "", content: raw.trimStart(), isThinking: false };
}

export function buildSystemPrompt(): string {
  return [
    "You are PageFlow AI, an inline writing and workspace engineering assistant.",
    "Formatting & Layout Rules:",
    "- Respond directly with the requested content. Never include conversational filler like 'Sure!', 'Here is the summary:', 'Certainly!'.",
    "- Output compact, elegant Markdown without excessive blank lines between headings, paragraphs, and list items.",
    "- When asked to create, draft, or add a new page (e.g., 'Create a page for...', 'Add a page called...'), ALWAYS start with `# [Page Title]` on the first line, followed by rich structured Markdown content (sections with ## headings, task checklists `- [ ]`, callouts, or tables).",
    "- When asked to create tabular data, comparisons, project tracking, or metrics, ALWAYS output a clean GitHub-flavored Markdown table with headers and data rows (| Col 1 | Col 2 |).",
    "- When asked for tasks or action items, ALWAYS use markdown task checklists: `- [ ] Action item`.",
    "- When asked for gallery, board, or showcase items, structure each item with bold titles, metadata bullets, and concise descriptions.",
    "- Preserve professional engineering tone. Do NOT use emojis unless explicitly requested.",
  ].join("\n");
}

export function buildActionPrompt(
  action: AiAction | undefined,
  prompt: string,
  context?: string,
  targetLanguage?: string,
): string {
  const trimmedContext = context?.trim() ?? "";
  const trimmedPrompt = prompt.trim();

  switch (action) {
    case "continue":
      return `Continue writing seamlessly from where the document leaves off. Match the existing structure, tone, and depth.\n\nContext:\n${trimmedContext}`;
    case "summarize":
      return `Summarize the following text with a brief overview followed by high-impact bullet points:\n\n${trimmedContext || trimmedPrompt}`;
    case "improve":
      return `Improve the following text for clarity, conciseness, vocabulary, and readability, maintaining the original meaning:\n\n${trimmedContext || trimmedPrompt}`;
    case "fix_spelling":
      return `Correct all spelling, punctuation, and grammatical errors in the following text, preserving the author's structure and voice:\n\n${trimmedContext || trimmedPrompt}`;
    case "shorter":
      return `Condense the following text into a significantly more concise version, eliminating unnecessary words while keeping key facts intact:\n\n${trimmedContext || trimmedPrompt}`;
    case "longer":
      return `Expand the following text with insightful elaboration, concrete explanations, and thorough details:\n\n${trimmedContext || trimmedPrompt}`;
    case "action_items":
      return `Extract all concrete, actionable next steps and to-dos from the following content as a Markdown task list (- [ ] task):\n\n${trimmedContext || trimmedPrompt}`;
    case "brainstorm":
      return `Brainstorm 5 to 7 high-impact, creative ideas, angles, or considerations based on:\n${trimmedPrompt}\n\nContext:\n${trimmedContext}`;
    case "explain":
      return `Explain the core concepts of the following content in plain, accessible language with an intuitive real-world analogy:\n\n${trimmedContext || trimmedPrompt}`;
    case "translate": {
      const lang = targetLanguage || trimmedPrompt || "English";
      return `Translate the following text accurately, fluently, and idiomatically into ${lang}. Maintain all Markdown structure, headings, bold/italic markup, lists, and code blocks untouched:\n\n${trimmedContext || trimmedPrompt}`;
    }
    case "create_page":
      return `Generate a complete, structured new document based on the following instruction:\n\n${trimmedPrompt}\n\nFormat your response starting with:\n# [Page Title]\n\nFollowed by complete rich markdown content with headings, paragraphs, bullet points, checklists, or tables as appropriate.`;
    case "custom":
    default:
      if (trimmedContext && trimmedPrompt) {
        return `${trimmedPrompt}\n\nReference Content:\n${trimmedContext}`;
      }
      return trimmedPrompt || trimmedContext;
  }
}

