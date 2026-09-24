const STARTING_STACK_BB = 100;
const MIN_TOTAL_CHIPS = 20;
const MAX_TOTAL_CHIPS = 30;
const IDEAL_TOTAL_CHIPS = 25;
const MIN_SMALL_CHIPS = 6;
const MAX_SMALL_CHIPS = 16;

export interface ChipAllocation {
  denomination: number;
  count: number;
}

export interface ChipDistributionRecommendation {
  initialChips: number;
  initialStackBb: 100;
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
  allocations: ChipAllocation[];
  totalChipCount: number;
  unusedDenominations: number[];
  explanation: string;
}

export type ChipDistributionResult =
  | { ok: true; recommendation: ChipDistributionRecommendation }
  | {
      ok: false;
      code:
        | "invalid-denomination"
        | "duplicate-denomination"
        | "no-practical-configuration";
      error: string;
    };

interface ScoredAllocation {
  denominations: number[];
  counts: number[];
  score: number;
  smallBlindChips: number;
  bigBlindChips: number;
  initialChips: number;
}

export function recommendChipDistribution(
  inputDenominations: number[],
): ChipDistributionResult {
  if (
    inputDenominations.some(
      (denomination) =>
        !Number.isSafeInteger(denomination) || denomination <= 0,
    )
  ) {
    return {
      ok: false,
      code: "invalid-denomination",
      error: "チップ額面は1以上の整数で入力してください。",
    };
  }

  const denominations = [...inputDenominations].sort(
    (left, right) => left - right,
  );
  if (new Set(denominations).size !== denominations.length) {
    return {
      ok: false,
      code: "duplicate-denomination",
      error: "同じチップ額面が重複しています。1つにまとめてください。",
    };
  }
  if (denominations.length < 3) {
    return noPracticalConfiguration();
  }

  let best: ScoredAllocation | null = null;
  for (const smallBlindChips of denominations) {
    const bigBlindChips = smallBlindChips * 2;
    const initialChips = bigBlindChips * STARTING_STACK_BB;
    if (
      !Number.isSafeInteger(bigBlindChips) ||
      !Number.isSafeInteger(initialChips)
    ) {
      continue;
    }

    const larger = denominations.filter(
      (denomination) =>
        denomination > smallBlindChips && denomination <= initialChips,
    );
    for (const typeCount of [4, 3]) {
      for (const selectedLarger of combinations(larger, typeCount - 1)) {
        const selected = [smallBlindChips, ...selectedLarger];
        if (initialChips % greatestCommonDivisor(selected) !== 0) continue;
        const candidate = findBestExactAllocation(
          selected,
          initialChips,
          bigBlindChips,
        );
        if (candidate && isBetterAllocation(candidate, best)) best = candidate;
      }
    }
  }

  if (!best) return noPracticalConfiguration();

  const allocations = best.denominations.map((denomination, index) => ({
    denomination,
    count: best.counts[index]!,
  }));
  const unusedDenominations = denominations.filter(
    (denomination) => !best.denominations.includes(denomination),
  );
  const smallChipCount = best.counts[0]!;
  return {
    ok: true,
    recommendation: {
      initialChips: best.initialChips,
      initialStackBb: STARTING_STACK_BB,
      smallBlindChips: best.smallBlindChips,
      bigBlindChips: best.bigBlindChips,
      bigBlindAnteChips: best.bigBlindChips,
      allocations,
      totalChipCount: best.counts.reduce((total, count) => total + count, 0),
      unusedDenominations,
      explanation:
        `${best.smallBlindChips.toLocaleString("ja-JP")}チップを${smallChipCount}枚確保し、` +
        "ブラインドを払いながら両替しやすい枚数と額面のつながりを優先しました。" +
        (unusedDenominations.length > 0
          ? "未使用の額面は、総枚数・高額チップ比率・額面間隔の評価で選外にしています。"
          : "すべての額面を実用的な枚数で使えます。"),
    },
  };
}

function findBestExactAllocation(
  denominations: number[],
  initialChips: number,
  bigBlindChips: number,
): ScoredAllocation | null {
  let best: ScoredAllocation | null = null;
  for (
    let totalCount = MIN_TOTAL_CHIPS;
    totalCount <= MAX_TOTAL_CHIPS;
    totalCount += 1
  ) {
    if (denominations.length === 3) {
      for (let firstCount = 1; firstCount <= totalCount - 2; firstCount += 1) {
        const counts = solveLastTwoCounts(
          denominations,
          [firstCount],
          totalCount,
          initialChips,
        );
        best = scoreIfPractical(
          denominations,
          counts,
          initialChips,
          bigBlindChips,
          best,
        );
      }
      continue;
    }

    for (let firstCount = 1; firstCount <= totalCount - 3; firstCount += 1) {
      for (
        let secondCount = 1;
        secondCount <= totalCount - firstCount - 2;
        secondCount += 1
      ) {
        const counts = solveLastTwoCounts(
          denominations,
          [firstCount, secondCount],
          totalCount,
          initialChips,
        );
        best = scoreIfPractical(
          denominations,
          counts,
          initialChips,
          bigBlindChips,
          best,
        );
      }
    }
  }
  return best;
}

function solveLastTwoCounts(
  denominations: number[],
  leadingCounts: number[],
  totalCount: number,
  targetValue: number,
): number[] | null {
  const leadingCountTotal = leadingCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const leadingValue = leadingCounts.reduce(
    (total, count, index) => total + count * denominations[index]!,
    0,
  );
  const remainingCount = totalCount - leadingCountTotal;
  const remainingValue = targetValue - leadingValue;
  const lower = denominations[leadingCounts.length]!;
  const upper = denominations[leadingCounts.length + 1]!;
  const numerator = remainingValue - lower * remainingCount;
  const denominator = upper - lower;
  if (numerator <= 0 || numerator % denominator !== 0) return null;
  const upperCount = numerator / denominator;
  const lowerCount = remainingCount - upperCount;
  if (lowerCount <= 0 || upperCount <= 0) return null;
  return [...leadingCounts, lowerCount, upperCount];
}

function scoreIfPractical(
  denominations: number[],
  counts: number[] | null,
  initialChips: number,
  bigBlindChips: number,
  currentBest: ScoredAllocation | null,
): ScoredAllocation | null {
  if (!counts) return currentBest;
  const smallCount = counts[0]!;
  if (smallCount < MIN_SMALL_CHIPS || smallCount > MAX_SMALL_CHIPS) {
    return currentBest;
  }
  const candidate: ScoredAllocation = {
    denominations,
    counts,
    score: calculateUsabilityScore(
      denominations,
      counts,
      initialChips,
      bigBlindChips,
    ),
    smallBlindChips: denominations[0]!,
    bigBlindChips,
    initialChips,
  };
  return isBetterAllocation(candidate, currentBest) ? candidate : currentBest;
}

function calculateUsabilityScore(
  denominations: number[],
  counts: number[],
  initialChips: number,
  bigBlindChips: number,
): number {
  const totalCount = counts.reduce((total, count) => total + count, 0);
  const idealCounts = denominations.length === 4 ? [10, 8, 5, 2] : [10, 8, 5];
  let score = denominations.length === 4 ? 0 : 2_500;
  score += Math.abs(totalCount - IDEAL_TOTAL_CHIPS) * 250;
  score += Math.abs(counts[0]! - 10) * 350;
  if (counts[0]! < 8 || counts[0]! > 12) score += 1_000;

  counts.forEach((count, index) => {
    score += Math.abs(count - idealCounts[index]!) * 50;
    const denominationBb = denominations[index]! / bigBlindChips;
    if (denominationBb > 25) score += (denominationBb - 25) * 80;
    if (denominationBb >= 10 && count === 1) score += 800;
    const share = (denominations[index]! * count) / initialChips;
    if (share > 0.6) score += (share - 0.6) * 2_000;
  });

  for (let index = 1; index < denominations.length; index += 1) {
    const gap = denominations[index]! / denominations[index - 1]!;
    if (gap > 5) score += (gap - 5) * 200;
  }
  return score;
}

function isBetterAllocation(
  candidate: ScoredAllocation,
  current: ScoredAllocation | null,
): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score < current.score;
  const candidateMaxBb =
    candidate.denominations.at(-1)! / candidate.bigBlindChips;
  const currentMaxBb = current.denominations.at(-1)! / current.bigBlindChips;
  if (candidateMaxBb !== currentMaxBb) return candidateMaxBb < currentMaxBb;
  if (candidate.smallBlindChips !== current.smallBlindChips) {
    return candidate.smallBlindChips < current.smallBlindChips;
  }
  return candidate.denominations.join(",") < current.denominations.join(",");
}

function* combinations(values: number[], count: number): Generator<number[]> {
  function* visit(start: number, selected: number[]): Generator<number[]> {
    if (selected.length === count) {
      yield selected;
      return;
    }
    const remaining = count - selected.length;
    for (let index = start; index <= values.length - remaining; index += 1) {
      yield* visit(index + 1, [...selected, values[index]!]);
    }
  }
  yield* visit(0, []);
}

function greatestCommonDivisor(values: number[]): number {
  return values.reduce((result, value) => {
    let left = result;
    let right = value;
    while (right !== 0) [left, right] = [right, left % right];
    return left;
  });
}

function noPracticalConfiguration(): ChipDistributionResult {
  return {
    ok: false,
    code: "no-practical-configuration",
    error:
      "この額面では扱いやすい100BB構成を作れません。SB付近で使える小さい額面を追加してください。",
  };
}
