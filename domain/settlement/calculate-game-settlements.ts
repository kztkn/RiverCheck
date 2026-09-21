import { assertNonNegativeSafeInteger } from "../shared/validation";

export const BB_RATE_OPTIONS = [0, 5, 10, 20] as const;
export const SETTLEMENT_ROUNDING_UNIT = 100;

export interface GameSettlementEntry {
  groupPlayerId: string;
  score: number;
}

export interface RoundedGameSettlement extends GameSettlementEntry {
  gameSettlementAmount: number;
}

export function isSupportedBbRate(value: number): boolean {
  return BB_RATE_OPTIONS.includes(value as (typeof BB_RATE_OPTIONS)[number]);
}

export function calculateRoundedGameSettlements(
  entries: GameSettlementEntry[],
  initialChips: number,
  bbRate: number,
): RoundedGameSettlement[] {
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertNonNegativeSafeInteger(bbRate, "bbRate");
  if (!isSupportedBbRate(bbRate)) {
    throw new RangeError("bbRate is not supported");
  }

  const validated = entries.map((entry) => {
    if (!entry.groupPlayerId) throw new TypeError("groupPlayerId is required");
    if (!Number.isSafeInteger(entry.score)) {
      throw new RangeError("score must be a safe integer");
    }
    return { ...entry };
  });
  if (bbRate === 0) {
    return validated.map((entry) => ({
      ...entry,
      gameSettlementAmount: 0,
    }));
  }

  const initialChipsBigInt = BigInt(initialChips);
  const scoreDifferenceTotal = validated.reduce(
    (total, entry) => total + BigInt(entry.score) - initialChipsBigInt,
    0n,
  );
  if (scoreDifferenceTotal !== 0n) {
    throw new RangeError("game score total must be zero-sum");
  }

  const denominator = initialChipsBigInt;
  const rounded = validated.map((entry) => {
    // game yen / 100 = (score - initialChips) * bbRate / initialChips.
    const numerator =
      (BigInt(entry.score) - initialChipsBigInt) * BigInt(bbRate);
    const roundedUnits = roundRatioHalfAwayFromZero(numerator, denominator);
    return { entry, numerator, roundedUnits };
  });
  const roundedUnitTotal = rounded.reduce(
    (total, item) => total + item.roundedUnits,
    0n,
  );

  if (roundedUnitTotal !== 0n) {
    const direction = roundedUnitTotal > 0n ? -1n : 1n;
    const adjustmentCount = absoluteBigInt(roundedUnitTotal);
    if (adjustmentCount > BigInt(rounded.length)) {
      throw new RangeError("settlement rounding adjustment is too large");
    }
    const candidates = rounded
      .map((item) => {
        const currentError = absoluteBigInt(
          item.roundedUnits * denominator - item.numerator,
        );
        const adjustedError = absoluteBigInt(
          (item.roundedUnits + direction) * denominator - item.numerator,
        );
        return {
          item,
          penalty: adjustedError - currentError,
        };
      })
      .sort(
        (left, right) =>
          compareBigInt(left.penalty, right.penalty) ||
          left.item.entry.groupPlayerId.localeCompare(
            right.item.entry.groupPlayerId,
          ),
      );
    for (let index = 0; index < Number(adjustmentCount); index += 1) {
      candidates[index]!.item.roundedUnits += direction;
    }
  }

  const results = rounded.map(({ entry, roundedUnits }) => {
    const amount = roundedUnits * BigInt(SETTLEMENT_ROUNDING_UNIT);
    const gameSettlementAmount = Number(amount);
    if (!Number.isSafeInteger(gameSettlementAmount)) {
      throw new RangeError("game settlement amount exceeds the safe integer range");
    }
    return { ...entry, gameSettlementAmount };
  });
  if (
    results.reduce((total, result) => total + result.gameSettlementAmount, 0) !==
    0
  ) {
    throw new Error("rounded game settlements must be zero-sum");
  }
  return results;
}

export function calculateSettlementBalance(input: {
  costShare: number;
  gameSettlementAmount: number;
}): number {
  assertNonNegativeSafeInteger(input.costShare, "costShare");
  if (
    !Number.isSafeInteger(input.gameSettlementAmount) ||
    input.gameSettlementAmount % SETTLEMENT_ROUNDING_UNIT !== 0
  ) {
    throw new RangeError(
      "gameSettlementAmount must be a safe integer multiple of 100",
    );
  }
  const balance = Number(
    BigInt(input.gameSettlementAmount) - BigInt(input.costShare),
  );
  if (!Number.isSafeInteger(balance)) {
    throw new RangeError("settlement balance exceeds the safe integer range");
  }
  return balance;
}

function roundRatioHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = absoluteBigInt(numerator);
  const quotient = absoluteNumerator / denominator;
  const remainder = absoluteNumerator % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function compareBigInt(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
