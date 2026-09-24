export const INITIAL_STACK_BB = 100;
export const INITIAL_STACK_BB_OPTIONS = [50, 100] as const;
export const MAX_INITIAL_STACK_BB = 32_767;

export interface BlindStructure {
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
}

export interface BbScoreInput {
  score: number;
  initialChips: number;
  bigBlindChips: number;
}

export function isSupportedInitialStackBb(value: number): boolean {
  return (
    Number.isSafeInteger(value) && value > 0 && value <= MAX_INITIAL_STACK_BB
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

export function calculateInitialChips(
  bigBlindChips: number,
  initialStackBb: number,
): number {
  assertPositiveSafeInteger(bigBlindChips, "bigBlindChips");
  assertSupportedInitialStackBb(initialStackBb);
  const initialChips = bigBlindChips * initialStackBb;
  assertPositiveSafeInteger(initialChips, "initialChips");
  return initialChips;
}

export function calculateNetBb({
  score,
  initialChips,
  bigBlindChips,
}: BbScoreInput): number {
  assertBbScoreInput(score, initialChips, bigBlindChips);
  return (score - initialChips) / bigBlindChips;
}

export function calculateChipsPerBb(bigBlindChips: number): number {
  assertPositiveSafeInteger(bigBlindChips, "bigBlindChips");
  return bigBlindChips;
}

export function formatNetBb(input: BbScoreInput): string {
  return formatSignedBbValue(calculateNetBb(input));
}

export function formatChipsPerBb(bigBlindChips: number): string {
  return formatChipNumber(calculateChipsPerBb(bigBlindChips));
}

export function calculateLegacyBlindStructure(
  initialChips: number,
  initialStackBb = INITIAL_STACK_BB,
): BlindStructure {
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertSupportedInitialStackBb(initialStackBb);
  const bigBlindChips = initialChips / initialStackBb;
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

export function formatBigBlindAnte(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("big blind ante must be a non-negative finite value");
  }
  return value === 0 ? "なし" : formatChipNumber(value);
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
  bigBlindChips: number,
): void {
  if (!Number.isSafeInteger(score)) {
    throw new RangeError("score must be a safe integer");
  }
  assertPositiveSafeInteger(initialChips, "initialChips");
  assertPositiveSafeInteger(bigBlindChips, "bigBlindChips");
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
