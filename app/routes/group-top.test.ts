import { describe, expect, it, vi } from "vitest";
import type { GameListItem } from "@shared-types/game";

vi.mock("@server/services/group-service.server", () => ({
  getGroupOverview: vi.fn(),
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));

import { buildGameUrl, getCreateGameUrl } from "./group-top";

const game = {
  id: "22222222-2222-4222-8222-222222222222",
} as GameListItem;

describe("group top navigation", () => {
  it("受付中が0件の管理者にだけ開催作成URLを返す", () => {
    expect(getCreateGameUrl(0, true, false)).toBe("games/new");
    expect(getCreateGameUrl(1, true, false)).toBeNull();
    expect(getCreateGameUrl(0, false, false)).toBeNull();
    expect(getCreateGameUrl(0, true, true)).toBeNull();
  });

  it("管理者の受付中カードだけ管理画面へ進める", () => {
    expect(buildGameUrl(game, true, false)).toBe(
      `games/${game.id}/admin`,
    );
    expect(buildGameUrl(game, false, false)).toBe(`games/${game.id}`);
    expect(buildGameUrl(game, true, true)).toBe(`games/${game.id}`);
  });
});
