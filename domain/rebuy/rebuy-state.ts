import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface RebuyState {
  totalRebuyCount: number;
  outstandingRebuyCount: number;
}

export type RebuyTransition = "rebuy" | "repayment";

export function transitionRebuyState(
  state: RebuyState,
  transition: RebuyTransition,
): RebuyState {
  validateRebuyState(state);
  if (transition === "repayment" && state.outstandingRebuyCount === 0) {
    throw new RangeError("there is no outstanding rebuy to repay");
  }
  return applyRebuyDelta(state, {
    totalDelta: transition === "rebuy" ? 1 : 0,
    outstandingDelta: transition === "rebuy" ? 1 : -1,
  });
}

export function applyRebuyDelta(
  state: RebuyState,
  delta: { totalDelta: number; outstandingDelta: number },
): RebuyState {
  validateRebuyState(state);
  if (
    !Number.isSafeInteger(delta.totalDelta) ||
    !Number.isSafeInteger(delta.outstandingDelta)
  ) {
    throw new RangeError("rebuy delta must be a safe integer");
  }
  const next = {
    totalRebuyCount: state.totalRebuyCount + delta.totalDelta,
    outstandingRebuyCount:
      state.outstandingRebuyCount + delta.outstandingDelta,
  };
  validateRebuyState(next);
  return next;
}

export function validateRebuyState(state: RebuyState): void {
  assertNonNegativeSafeInteger(state.totalRebuyCount, "totalRebuyCount");
  assertNonNegativeSafeInteger(
    state.outstandingRebuyCount,
    "outstandingRebuyCount",
  );
  if (state.outstandingRebuyCount > state.totalRebuyCount) {
    throw new RangeError("outstanding rebuy count exceeds total rebuy count");
  }
}
