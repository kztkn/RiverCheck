export const INITIAL_STACK_BB = 100;
export const INITIAL_STACK_BB_OPTIONS = [50, 100] as const;

export interface BlindStructure {
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
}

export interface BbScoreInput {
  score: number;
  initialChips: number;
  initialStackBb?: number;
}

export function isSupportedInitialStackBb(value: number): boolean {
  return INITIAL_STACK_BB_OPTIONS.includes(
    value as (typeof INITIAL_STACK_BB_OPTIONS)[number],
  );
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

export function calculateBlindStructure(
  initialChips: number,
  initialStackBb = INITIAL_STACK_BB,
): BlindStructure {
  const bigBlindChips = calculateChipsPerBb(initialChips, initialStackBb);
  return {
    smallBlindChips: bigBlindChips / 2,
    bigBlindChips,
    bigBlindAnteChips: bigBlindChips,
  };
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
