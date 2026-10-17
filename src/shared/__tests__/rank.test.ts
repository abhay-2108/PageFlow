import { describe, expect, it } from "vitest";
import { RANK_STEP, needsRebalance, rankAppend, rankBetween, rebalancedRanks } from "../rank";

describe("rankAppend", () => {
  it("starts at one step when list is empty", () => {
    expect(rankAppend(null)).toBe(RANK_STEP);
  });

  it("appends after the last rank", () => {
    expect(rankAppend(RANK_STEP)).toBe(RANK_STEP * 2);
    expect(rankAppend(5)).toBe(5 + RANK_STEP);
  });
});

describe("rankBetween", () => {
  it("returns midpoint between two ranks", () => {
    expect(rankBetween(0, 1024)).toBe(512);
    expect(rankBetween(1024, 2048)).toBe(1536);
  });

  it("handles open ends", () => {
    expect(rankBetween(null, null)).toBe(RANK_STEP);
    expect(rankBetween(null, 2048)).toBe(2048 - RANK_STEP);
    expect(rankBetween(2048, null)).toBe(2048 + RANK_STEP);
  });

  it("keeps ranks healthy for moderate midpoint inserts", () => {
    let lower = 0;
    const upper = RANK_STEP;
    const produced: number[] = [];
    for (let i = 0; i < 15; i += 1) {
      const mid = rankBetween(lower, upper);
      produced.push(mid);
      lower = mid;
    }
    expect(needsRebalance(produced)).toBe(false);
  });

  it("flags collapse after extreme repeated midpoint inserts", () => {
    let lower = 0;
    const upper = RANK_STEP;
    const produced: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const mid = rankBetween(lower, upper);
      produced.push(mid);
      lower = mid;
    }
    expect(needsRebalance(produced)).toBe(true);
  });
});

describe("needsRebalance", () => {
  it("is false for empty, single, and well-spaced ranks", () => {
    expect(needsRebalance([])).toBe(false);
    expect(needsRebalance([5])).toBe(false);
    expect(needsRebalance([1, 2, 3])).toBe(false);
    expect(needsRebalance([1, 1 + 1e-3])).toBe(false);
  });

  it("is true when gaps collapse or order inverts", () => {
    expect(needsRebalance([1, 1 + 1e-9])).toBe(true);
    expect(needsRebalance([2, 2])).toBe(true);
    expect(needsRebalance([2, 1])).toBe(false);
  });
});

describe("rebalancedRanks", () => {
  it("returns evenly spaced ranks", () => {
    expect(rebalancedRanks(3)).toEqual([RANK_STEP, RANK_STEP * 2, RANK_STEP * 3]);
    expect(rebalancedRanks(0)).toEqual([]);
  });
});
