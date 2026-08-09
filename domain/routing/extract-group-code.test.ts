import { describe, expect, it } from "vitest";
import { extractGroupCode } from "./extract-group-code";

describe("extractGroupCode", () => {
  it("通常のグループURLからコードを取得する", () => {
    expect(extractGroupCode("/g/river-check")).toBe("river-check");
    expect(extractGroupCode("/g/river-check/stats")).toBe("river-check");
  });

  it("React Routerの.dataリクエストを正規化する", () => {
    expect(extractGroupCode("/g/river-check.data")).toBe("river-check");
    expect(extractGroupCode("/g/river-check/games/abc.data")).toBe(
      "river-check",
    );
  });

  it("グループ外と不正なエンコードを拒否する", () => {
    expect(extractGroupCode("/")).toBeNull();
    expect(extractGroupCode("/g/%E0%A4%A")).toBeNull();
  });
});
