import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("group membership editing", () => {
  it("所属解除はis_activeをfalseにして履歴を保持する", () => {
    const repository = readFileSync("server/repositories/player-repository.server.ts", "utf8");
    expect(repository).toContain("SET is_active = FALSE");
    expect(repository).toContain("ON CONFLICT (group_id, player_id) DO UPDATE");
    expect(repository).toContain("SET is_active = TRUE");
  });

  it("メンバー管理に所属解除導線を表示する", () => {
    const route = readFileSync("app/routes/players.tsx", "utf8");
    expect(route).toContain("このグループから外す");
    expect(route).toContain("過去の開催・順位・戦績は残ります");
    expect(route).toContain('intent === "remove-player"');
  });
});
