const STARTING_STACK_BB = 100;
const MIN_TOTAL_CHIPS = 20;
const PREFERRED_MAX_TOTAL_CHIPS = 35;
const MAX_TOTAL_CHIPS = 40;
const IDEAL_TOTAL_CHIPS = 25;
const MIN_SMALL_CHIPS = 6;
const MAX_SMALL_CHIPS = 16;

export interface ChipInventoryItem {
  denomination: number;
  count: number;
}

export interface BlindStructureAllocation {
  denomination: number;
  count: number;
}

export interface BlindStructureInventoryUsage {
  denomination: number;
  availableCount: number;
  perPlayerCount: number;
  requiredCount: number;
  remainingCount: number;
}

export interface BlindStructureRecommendation {
  participantCount: number;
  initialChips: number;
  initialStackBb: 100;
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
  allocations: BlindStructureAllocation[];
  totalChipCount: number;
  totalRequiredChipCount: number;
  inventoryUsage: BlindStructureInventoryUsage[];
  explanation: string;
}

export type BlindStructureResult =
  | { ok: true; recommendation: BlindStructureRecommendation }
  | {
      ok: false;
      code:
        | "invalid-participant-count"
        | "invalid-denomination"
        | "duplicate-denomination"
        | "invalid-chip-count"
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

export function recommendBlindStructureFromInventory(
  inputInventory: ChipInventoryItem[],
  participantCount: number,
): BlindStructureResult {
  if (
    !Number.isSafeInteger(participantCount) ||
    participantCount < 2 ||
    participantCount > 20
  ) {
    return {
      ok: false,
      code: "invalid-participant-count",
      error: "参加人数は2〜20人で入力してください。",
    };
  }

  if (
    inputInventory.some(
      ({ denomination }) =>
        !Number.isSafeInteger(denomination) || denomination <= 0,
    )
  ) {
    return {
      ok: false,
      code: "invalid-denomination",
      error: "チップ額面は1以上の整数で入力してください。",
    };
  }
  if (
    inputInventory.some(
      ({ count }) => !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    return {
      ok: false,
      code: "invalid-chip-count",
      error: "チップ枚数は0以上の整数で入力してください。",
    };
  }

  const inventory = [...inputInventory].sort(
    (left, right) => left.denomination - right.denomination,
  );
  const denominations = inventory.map(({ denomination }) => denomination);
  if (new Set(denominations).size !== denominations.length) {
    return {
      ok: false,
      code: "duplicate-denomination",
      error: "同じチップ額面が重複しています。1行にまとめてください。",
    };
  }

  const perPlayerCapacity = new Map(
    inventory.map(({ denomination, count }) => [
      denomination,
      Math.floor(count / participantCount),
    ]),
  );
  const availableDenominations = inventory
    .filter(
      ({ denomination, count }) =>
        count > 0 && (perPlayerCapacity.get(denomination) ?? 0) > 0,
    )
    .map(({ denomination }) => denomination);
  if (availableDenominations.length < 3) {
    return noPracticalConfiguration();
  }

  let best: ScoredAllocation | null = null;
  for (const smallBlindChips of availableDenominations) {
    if (
      (perPlayerCapacity.get(smallBlindChips) ?? 0) < MIN_SMALL_CHIPS
    ) {
      continue;
    }
    const bigBlindChips = smallBlindChips * 2;
    const initialChips = bigBlindChips * STARTING_STACK_BB;
    if (
      !Number.isSafeInteger(bigBlindChips) ||
      !Number.isSafeInteger(initialChips)
    ) {
      continue;
    }

    const larger = availableDenominations.filter(
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
          perPlayerCapacity,
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
  const perPlayerByDenomination = new Map(
    allocations.map(({ denomination, count }) => [denomination, count]),
  );
  const inventoryUsage = inventory.map(({ denomination, count }) => {
    const perPlayerCount = perPlayerByDenomination.get(denomination) ?? 0;
    const requiredCount = perPlayerCount * participantCount;
    return {
      denomination,
      availableCount: count,
      perPlayerCount,
      requiredCount,
      remainingCount: count - requiredCount,
    };
  });
  const totalChipCount = best.counts.reduce(
    (total, count) => total + count,
    0,
  );

  return {
    ok: true,
    recommendation: {
      participantCount,
      initialChips: best.initialChips,
      initialStackBb: STARTING_STACK_BB,
      smallBlindChips: best.smallBlindChips,
      bigBlindChips: best.bigBlindChips,
      bigBlindAnteChips: best.bigBlindChips,
      allocations,
      totalChipCount,
      totalRequiredChipCount: totalChipCount * participantCount,
      inventoryUsage,
      explanation:
        `1人${totalChipCount}枚で100BBを作り、` +
        `${best.smallBlindChips.toLocaleString("ja-JP")}チップを${best.counts[0]!.toLocaleString("ja-JP")}枚ずつ確保しました。` +
        "25枚は固定値ではなく、20〜35枚前後を実用域として、小額チップの厚み・両替しやすさ・全員へ同じ構成を配れる在庫量を優先しています。",
    },
  };
}

function findBestExactAllocation(
  denominations: number[],
  initialChips: number,
  bigBlindChips: number,
  perPlayerCapacity: Map<number, number>,
): ScoredAllocation | null {
  let best: ScoredAllocation | null = null;
  for (
    let totalCount = MIN_TOTAL_CHIPS;
    totalCount <= MAX_TOTAL_CHIPS;
    totalCount += 1
  ) {
    const firstCapacity = perPlayerCapacity.get(denominations[0]!) ?? 0;
    const maxFirstCount = Math.min(
      MAX_SMALL_CHIPS,
      firstCapacity,
      totalCount - (denominations.length - 1),
    );
    for (
      let firstCount = 1;
      firstCount <= maxFirstCount;
      firstCount += 1
    ) {
      if (denominations.length === 3) {
        const counts = solveLastTwoCounts(
          denominations,
          [firstCount],
          totalCount,
          initialChips,
          perPlayerCapacity,
        );
        best = scoreIfPractical(
          denominations,
          counts,
          initialChips,
          bigBlindChips,
          perPlayerCapacity,
          best,
        );
        continue;
      }

      const secondCapacity =
        perPlayerCapacity.get(denominations[1]!) ?? 0;
      const maxSecondCount = Math.min(
        secondCapacity,
        totalCount - firstCount - 2,
      );
      for (
        let secondCount = 1;
        secondCount <= maxSecondCount;
        secondCount += 1
      ) {
        const counts = solveLastTwoCounts(
          denominations,
          [firstCount, secondCount],
          totalCount,
          initialChips,
          perPlayerCapacity,
        );
        best = scoreIfPractical(
          denominations,
          counts,
          initialChips,
          bigBlindChips,
          perPlayerCapacity,
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
  perPlayerCapacity: Map<number, number>,
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

  const counts = [...leadingCounts, lowerCount, upperCount];
  const exceedsCapacity = counts.some(
    (count, index) =>
      count > (perPlayerCapacity.get(denominations[index]!) ?? 0),
  );
  return exceedsCapacity ? null : counts;
}

function scoreIfPractical(
  denominations: number[],
  counts: number[] | null,
  initialChips: number,
  bigBlindChips: number,
  perPlayerCapacity: Map<number, number>,
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
      perPlayerCapacity,
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
  perPlayerCapacity: Map<number, number>,
): number {
  const totalCount = counts.reduce((total, count) => total + count, 0);
  const idealCounts =
    denominations.length === 4 ? [10, 9, 6, 3] : [10, 9, 4];
  let score = denominations.length === 4 ? 0 : 2_500;
  score += Math.abs(totalCount - IDEAL_TOTAL_CHIPS) * 45;
  if (totalCount > PREFERRED_MAX_TOTAL_CHIPS) {
    score += (totalCount - PREFERRED_MAX_TOTAL_CHIPS) * 500;
  }
  score += Math.abs(counts[0]! - 10) * 350;
  if (counts[0]! < 8 || counts[0]! > 12) score += 1_000;

  const secondCount = counts[1]!;
  score += Math.abs(secondCount - 9) * 140;
  if (secondCount < 8) score += (8 - secondCount) * 650;
  if (secondCount > 14) score += (secondCount - 14) * 180;

  counts.forEach((count, index) => {
    score += Math.abs(count - idealCounts[index]!) * 35;
    const denomination = denominations[index]!;
    const denominationBb = denomination / bigBlindChips;
    if (denominationBb > 25) score += (denominationBb - 25) * 80;
    if (denominationBb >= 10 && count === 1) score += 800;
    const share = (denomination * count) / initialChips;
    if (share > 0.55) score += (share - 0.55) * 8_000;

    const capacity = perPlayerCapacity.get(denomination) ?? count;
    if (capacity > 0) {
      const usageRatio = count / capacity;
      if (usageRatio > 0.9) score += (usageRatio - 0.9) * 1_000;
    }
  });

  const highestCount = counts.at(-1)!;
  const highestShare =
    (denominations.at(-1)! * highestCount) / initialChips;
  if (highestCount === 1) score += 1_200;
  if (highestCount > 4) score += (highestCount - 4) * 700;
  if (highestCount > 4 && highestShare > 0.4) {
    score += (highestShare - 0.4) * 12_000;
  }

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
  const currentMaxBb =
    current.denominations.at(-1)! / current.bigBlindChips;
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

function noPracticalConfiguration(): BlindStructureResult {
  return {
    ok: false,
    code: "no-practical-configuration",
    error:
      "この在庫と人数では、全員へ同じ構成を配れる扱いやすい100BB設定を作れません。小さい額面の枚数を増やすか、人数を見直してください。",
  };
}
