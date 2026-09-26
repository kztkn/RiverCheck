import type { GameChipAllocation } from "../../types/game";

export type GameChipDistributionValidationResult =
  | { ok: true; value: GameChipAllocation[] }
  | { ok: false; error: string };

export function validateGameChipDistribution(
  input: unknown,
  initialChips: number,
): GameChipDistributionValidationResult {
  if (!Array.isArray(input) || input.length === 0 || input.length > 12) {
    return { ok: false, error: "チップ構成は1〜12種類の額面で指定してください。" };
  }

  const seen = new Set<number>();
  const allocations: GameChipAllocation[] = [];
  let total = 0;

  for (const item of input) {
    if (!item || typeof item !== "object") return invalidAllocation();
    const denomination = Reflect.get(item, "denomination");
    const count = Reflect.get(item, "count");
    if (
      !Number.isSafeInteger(denomination) ||
      denomination <= 0 ||
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      return invalidAllocation();
    }
    if (seen.has(denomination)) {
      return { ok: false, error: "同じチップ額面が重複しています。" };
    }
    seen.add(denomination);
    const value = denomination * count;
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(total + value)) {
      return invalidAllocation();
    }
    total += value;
    allocations.push({ denomination, count });
  }

  if (total !== initialChips) {
    return {
      ok: false,
      error: `チップ構成の合計を初期チップ（${initialChips.toLocaleString("ja-JP")}）に合わせてください。`,
    };
  }

  return {
    ok: true,
    value: allocations.sort(
      (left, right) => left.denomination - right.denomination,
    ),
  };
}

export function serializeGameChipDistribution(
  allocations: GameChipAllocation[] | null,
): string {
  return allocations ? JSON.stringify(allocations) : "";
}

function invalidAllocation(): GameChipDistributionValidationResult {
  return {
    ok: false,
    error: "チップ額面と枚数は1以上の整数で指定してください。",
  };
}
