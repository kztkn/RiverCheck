export const INITIAL_STACK_BB = 100;

export interface BbScoreInput {
  score: number;
  initialChips: number;
}

export function calculateNetBb({ score, initialChips }: BbScoreInput): number {
  assertBbScoreInput(score, initialChips);
  return ((score - initialChips) / initialChips) * INITIAL_STACK_BB;
}

export function calculateChipsPerBb(initialChips: number): number {
  assertPositiveSafeInteger(initialChips, "initialChips");
  return initialChips / INITIAL_STACK_BB;
}

export function formatNetBb(input: BbScoreInput): string {
  return formatSignedBbValue(calculateNetBb(input));
}

export function formatChipsPerBb(initialChips: number): string {
  return formatBbNumber(calculateChipsPerBb(initialChips));
}

export function formatSignedBbValue(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError("BB value must be finite");
  }
  return `${value > 0 ? "+" : ""}${formatBbNumber(value)}BB`;
}

function formatBbNumber(value: number): string {
  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: 2,
  });
}

function assertBbScoreInput(score: number, initialChips: number): void {
  if (!Number.isSafeInteger(score)) {
    throw new RangeError("score must be a safe integer");
  }
  assertPositiveSafeInteger(initialChips, "initialChips");
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
