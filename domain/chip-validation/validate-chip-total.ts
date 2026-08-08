import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface ChipReport {
  remainingChips: number;
  rebuyCount: number;
}

export interface ChipValidationInput {
  initialChips: number;
  rebuyChips: number;
  reports: ChipReport[];
}

export interface ChipValidationResult {
  expectedTotal: number;
  reportedTotal: number;
  difference: number;
  isValid: boolean;
}

export function validateChipTotal({
  initialChips,
  rebuyChips,
  reports,
}: ChipValidationInput): ChipValidationResult {
  assertNonNegativeSafeInteger(initialChips, "initialChips");
  assertNonNegativeSafeInteger(rebuyChips, "rebuyChips");

  let totalRebuyCount = 0;
  let reportedTotal = 0;
  for (const report of reports) {
    assertNonNegativeSafeInteger(report.remainingChips, "remainingChips");
    assertNonNegativeSafeInteger(report.rebuyCount, "rebuyCount");
    totalRebuyCount += report.rebuyCount;
    reportedTotal += report.remainingChips;
  }

  const expectedTotal =
    initialChips * reports.length + rebuyChips * totalRebuyCount;
  const difference = expectedTotal - reportedTotal;

  if (
    !Number.isSafeInteger(expectedTotal) ||
    !Number.isSafeInteger(reportedTotal) ||
    !Number.isSafeInteger(difference)
  ) {
    throw new RangeError("chip total exceeds the safe integer range");
  }

  return {
    expectedTotal,
    reportedTotal,
    difference,
    isValid: difference === 0,
  };
}
