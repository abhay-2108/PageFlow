export const RANK_STEP = 1024;

const MIN_GAP = 1e-6;

export function rankAppend(last: number | null): number {
  return last === null ? RANK_STEP : last + RANK_STEP;
}

export function rankBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) {
    return RANK_STEP;
  }
  if (prev === null) {
    return (next as number) - RANK_STEP;
  }
  if (next === null) {
    return prev + RANK_STEP;
  }
  return (prev + next) / 2;
}

export function needsRebalance(ranks: readonly number[]): boolean {
  if (ranks.length < 2) {
    return false;
  }
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1] as number;
    const next = sorted[i] as number;
    if (!(next > prev) || next - prev < MIN_GAP) {
      return true;
    }
  }
  return false;
}

export function rebalancedRanks(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * RANK_STEP);
}
