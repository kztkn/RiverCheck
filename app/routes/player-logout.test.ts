import { describe, expect, it } from "vitest";
import { action } from "./player-logout";

describe("player logout action", () => {
  it("bodyを解析せずCookieを削除してグループTOPへ戻す", () => {
    const request = new Request(
      "https://example.com/g/river-check/logout",
      {
        body: "{broken-json",
        headers: {
          "Content-Type": "application/json",
          Cookie: "rc_player_profile=session-token",
        },
        method: "POST",
      },
    );

    const response = action({
      params: { groupCode: "river-check" },
      request,
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/g/river-check");
    expect(response.headers.get("Set-Cookie")).toContain(
      "rc_player_profile=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    );
  });
});
