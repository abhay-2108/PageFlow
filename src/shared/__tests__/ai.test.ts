import { describe, expect, it } from "vitest";
import {
  buildActionPrompt,
  buildSystemPrompt,
  parseThinkingAndContent,
  AI_ACTION_LABELS,
} from "../ai";

describe("AI Shared Helpers", () => {
  it("parses thinking and content from reasoning models", () => {
    const raw = "<think>Analyzing user request and selecting best tone.</think>Here is the refined output.";
    const result = parseThinkingAndContent(raw);
    expect(result.thinking).toBe("Analyzing user request and selecting best tone.");
    expect(result.content).toBe("Here is the refined output.");
    expect(result.isThinking).toBe(false);
  });

  it("identifies in-progress reasoning stream before think tag closes", () => {
    const raw = "<think>Analyzing the paragraph structure...";
    const result = parseThinkingAndContent(raw);
    expect(result.thinking).toBe("Analyzing the paragraph structure...");
    expect(result.content).toBe("");
    expect(result.isThinking).toBe(true);
  });

  it("handles raw text without thinking tags", () => {
    const raw = "Direct response without reasoning.";
    const result = parseThinkingAndContent(raw);
    expect(result.thinking).toBe("");
    expect(result.content).toBe("Direct response without reasoning.");
    expect(result.isThinking).toBe(false);
  });

  it("builds action prompts for standard Notion actions", () => {
    const summarize = buildActionPrompt("summarize", "", "Quarterly financial report details.");
    expect(summarize).toContain("Summarize the following text");
    expect(summarize).toContain("Quarterly financial report details.");

    const actionItems = buildActionPrompt("action_items", "", "Need to update tests and deploy to staging.");
    expect(actionItems).toContain("Markdown task list (- [ ] task)");
    expect(actionItems).toContain("Need to update tests and deploy to staging.");

    const custom = buildActionPrompt("custom", "Translate to French", "Hello world");
    expect(custom).toContain("Translate to French");
    expect(custom).toContain("Reference Content:\nHello world");
  });

  it("includes all action labels with titles and icons", () => {
    expect(AI_ACTION_LABELS.continue.icon).toBe("¶");
    expect(AI_ACTION_LABELS.summarize.icon).toBe("≡");
    expect(AI_ACTION_LABELS.action_items.icon).toBe("☑");
    expect(AI_ACTION_LABELS.improve.icon).toBe("✦");
  });

  it("builds system prompt prohibiting conversational fluff", () => {
    const system = buildSystemPrompt();
    expect(system).toContain("NotionFlow AI");
    expect(system).toContain("Markdown");
  });
});
