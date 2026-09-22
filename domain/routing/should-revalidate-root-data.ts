import { extractGroupCode } from "./extract-group-code";

export function isSuccessfulRebuyActionResult(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  if (!("ok" in result) || result.ok !== true || !("intent" in result)) {
    return false;
  }
  return result.intent === "record-rebuy" ||
    result.intent === "record-repayment" ||
    result.intent === "undo-rebuy";
}

export function shouldRevalidateRootData(input: {
  actionResult?: unknown;
  currentPathname: string;
  defaultShouldRevalidate: boolean;
  formMethod?: string;
  nextPathname: string;
}): boolean {
  if (
    input.currentPathname === input.nextPathname &&
    isSuccessfulRebuyActionResult(input.actionResult)
  ) return false;
  if (input.formMethod && input.formMethod.toUpperCase() !== "GET") {
    return input.defaultShouldRevalidate;
  }

  const currentGroupCode = extractGroupCode(input.currentPathname);
  const nextGroupCode = extractGroupCode(input.nextPathname);
  if (currentGroupCode && currentGroupCode === nextGroupCode) {
    return false;
  }

  return input.defaultShouldRevalidate;
}
