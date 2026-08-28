import { describe, expect, it } from "vitest";
import { classifyRateLimitedRequest } from "./classify-rate-limited-request";

describe("classifyRateLimitedRequest", () => {
  it("主催者ログインのPOSTだけをログイン制限へ分類する", () => {
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/organizer-login",
      ),
    ).toBe("organizer-login");
    expect(
      classifyRateLimitedRequest("GET", "/g/river-check/organizer-login"),
    ).toBeNull();
  });

  it("管理者の変更系routeを管理者制限へ分類する", () => {
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/games/new"),
    ).toBe("admin-write");
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/players"),
    ).toBe("admin-write");
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/settings"),
    ).toBe("admin-write");
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/games/1b233730-eecd-449a-b28b-c93b0a395815/admin",
      ),
    ).toBe("admin-write");
  });

  it("参加・チップ入力のPOSTを参加者制限へ分類する", () => {
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/games/1b233730-eecd-449a-b28b-c93b0a395815",
      ),
    ).toBe("participant-write");
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/profile"),
    ).toBe("participant-write");
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/profile/claim/0123456789abcdef",
      ),
    ).toBe("participant-write");
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/stats/1b233730-eecd-449a-b28b-c93b0a395815",
      ),
    ).toBe("participant-write");
  });

  it("対象外routeや紛らわしいパスは分類しない", () => {
    expect(classifyRateLimitedRequest("POST", "/g/river-check/stats")).toBeNull();
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/river-check/games/id/admin/extra",
      ),
    ).toBeNull();
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/logout"),
    ).toBeNull();
    expect(
      classifyRateLimitedRequest("POST", "/g/river-check/organizer-logout"),
    ).toBeNull();
  });
});
