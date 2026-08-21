import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeResultCode } from "@domain/result-sharing/result-code";

const mocked = vi.hoisted(() => ({
  findFinalizedGamePublicRoute: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  findFinalizedGamePublicRoute: mocked.findFinalizedGamePublicRoute,
}));

import { loader } from "./result-short-link";

const gameId = "22222222-2222-4222-8222-222222222222";

describe("short result link route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("短縮コードを確定結果の既存URLへ転送する", async () => {
    mocked.findFinalizedGamePublicRoute.mockResolvedValue({
      gameId,
      groupPublicCode: "river-check",
    });

    const response = await loader({
      params: { resultCode: encodeResultCode(gameId) },
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${gameId}`,
    );
    expect(mocked.findFinalizedGamePublicRoute).toHaveBeenCalledWith(gameId);
  });

  it("不正な短縮コードはDBへ問い合わせず404にする", async () => {
    await expect(
      loader({ params: { resultCode: "invalid" } } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocked.findFinalizedGamePublicRoute).not.toHaveBeenCalled();
  });

  it("未確定または存在しない開催は404にする", async () => {
    mocked.findFinalizedGamePublicRoute.mockResolvedValue(null);

    await expect(
      loader({
        params: { resultCode: encodeResultCode(gameId) },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });
});
