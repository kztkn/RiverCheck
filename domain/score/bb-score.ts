export const INITIAL_STACK_BB = 100;
export const MAX_INITIAL_STACK_BB = 32_767;

export interface BbScoreInput {
  score: number;
  initialChips: number;
  initialStackBb?: number;
}

export function isSupportedInitialStackBb(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_INITIAL_STACK_BB
  );
}

export function calculateInitialStackBb(
  initialChips: number,
  bigBlindChips: number,
): number {
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertPositiveSafeInteger(bigBlindChips, "bigBlindChips");
  if (initialChips % bigBlindChips !== 0) {
    throw new RangeError("initialChips must be divisible by bigBlindChips");
  }
  const initialStackBb = initialChips / bigBlindChips;
  assertSupportedInitialStackBb(initialStackBb);
  return initialStackBb;
}

export function calculateNetBb({
  score,
  initialChips,
  initialStackBb = INITIAL_STACK_BB,
}: BbScoreInput): number {
  assertBbScoreInput(score, initialChips, initialStackBb);
  return ((score - initialChips) / initialChips) * initialStackBb;
}

export function calculateChipsPerBb(
  initialChips: number,
  initialStackBb = INITIAL_STACK_BB,
): number {
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertSupportedInitialStackBb(initialStackBb);
  return initialChips / initialStackBb;
}

export function formatNetBb(input: BbScoreInput): string {
  return formatSignedBbValue(calculateNetBb(input));
}

export function formatChipsPerBb(
  initialChips: number,
  initialStackBb = INITIAL_STACK_BB,
): string {
  return formatChipNumber(calculateChipsPerBb(initialChips, initialStackBb));
}

export function formatChipValue(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError("chip value must be finite");
  }
  return formatChipNumber(value);
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

function formatChipNumber(value: number): string {
  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: 2,
  });
}

function assertBbScoreInput(
  score: number,
  initialChips: number,
  initialStackBb: number,
): void {
  if (!Number.isSafeInteger(score)) {
    throw new RangeError("score must be a safe integer");
  }
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertSupportedInitialStackBb(initialStackBb);
}

function assertSupportedInitialStackBb(value: number): void {
  if (!isSupportedInitialStackBb(value)) {
    throw new RangeError("initialStackBb is not supported");
  }
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
