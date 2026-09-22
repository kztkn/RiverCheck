import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ queryDatabase: vi.fn() }));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  findParticipantByGroupPlayerId,
  findParticipantByTokenHash,
} from "@server/repositories/participant-repository.server";

beforeEach(() => vi.resetAllMocks());

describe("saved result review", () => {
  it.each([
    ["group player", () => findParticipantByGroupPlayerId("group", "game", "player")],
    ["participant token", () => findParticipantByTokenHash("group", "game", "token")],
  ])("%s lookup flags rebuy events after result submission", async (_name, lookup) => {
    mocked.queryDatabase.mockResolvedValue({ rows: [{
      id: "participant",
      group_player_id: "player",
      display_name: "Player",
      status: "submitted",
      remaining_chips: "20000",
      total_rebuy_count: 1,
      outstanding_rebuy_count: 1,
      settlement_rebuy_count: 1,
      result_needs_review: true,
      device_locked: false,
      avatar_uploaded_at: null,
    }] });

    const participant = await lookup();

    expect(participant?.resultNeedsReview).toBe(true);
    const [sql] = mocked.queryDatabase.mock.calls[0];
    expect(sql).toContain("event.recorded_at > participant.submitted_at");
    expect(sql).toContain("event.game_participant_id = participant.id");
  });
});
