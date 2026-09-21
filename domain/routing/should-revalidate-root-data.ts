import { extractGroupCode } from "./extract-group-code";

export function shouldRevalidateRootData(input: {
  currentPathname: string;
  defaultShouldRevalidate: boolean;
  formMethod?: string;
  nextPathname: string;
}): boolean {
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
