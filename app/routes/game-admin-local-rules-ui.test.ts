import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("game admin local rules UI", () => {
  const source = readFileSync("app/routes/game-admin.tsx", "utf8");
  const css = readFileSync("app/styles/app.css", "utf8");

  it("saves local rules with a fetcher so the current screen stays in place", () => {
    expect(source).toContain("const localRulesFetcher = useFetcher<LocalRulesActionData>();");
    expect(source).toContain("<localRulesFetcher.Form");
    expect(source).toContain('disabled={localRulesFetcher.state !== "idle"}');
    expect(source).toContain('"ローカルルールを保存しました。"');
  });

  it("tightens players-to-rules spacing and separates rules from settlement", () => {
    expect(css).toContain(`.admin-page .admin-participants {
  margin: 0 0 18px;
}`);
    expect(css).toContain(`.admin-local-rules {
  display: grid;
  gap: 16px;
  margin: 0 0 34px;
`);
  });
});
