import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const participantSource = readFileSync(
  new URL("./game-participant.tsx", import.meta.url),
  "utf8",
);
const adminSource = readFileSync(
  new URL("./game-admin.tsx", import.meta.url),
  "utf8",
);

describe("game screen navigation performance", () => {
  it("uses SPA navigation between organizer and participant screens", () => {
    const participantLink = participantSource.match(
      /className=\{\(\{ isPending \}\)[\s\S]*?participant-admin-link[\s\S]*?<\/NavLink>/u,
    )?.[0];
    const adminLink = adminSource.match(
      /className=\{\(\{ isPending \}\)[\s\S]*?admin-own-play-link[\s\S]*?<\/NavLink>/u,
    )?.[0];

    expect(participantLink).toContain('prefetch="viewport"');
    expect(participantLink).not.toContain("reloadDocument");
    expect(adminLink).toContain('prefetch="viewport"');
    expect(adminLink).not.toContain("reloadDocument");
    expect(adminLink).not.toContain("loaderData.participantUrl");
  });

  it("starts independent participant-loader prerequisites in one Promise.all", () => {
    expect(participantSource).toContain(
      "const [context, isOrganizer, profileOverview, participantTokenHash] =",
    );
    expect(participantSource).toContain(
      "requireGame(params.groupCode, params.gameId)",
    );
    expect(participantSource).toContain(
      "getAuthenticatedPlayerProfile(request, params.groupCode)",
    );
    expect(participantSource).toContain("participantTokenHashPromise");
  });

  it("uses a single joined lookup for game and group context", () => {
    expect(participantSource).toContain(
      "findGameWithGroupByPublicCode(groupCode, gameId)",
    );
    expect(adminSource).toContain(
      "findGameWithGroupByPublicCode(groupCode, gameId)",
    );
  });
});
