import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  deleteOpenGame,
  findFinalizedGamePublicRoute,
  findGameWithGroupByPublicCode,
  insertGame,
  listGamesForGroupByPublicCode,
  updateLocalRules,
  updateOpenGameConfiguration,
  updateOpenGameIdentity,
  updateOpenGameTitle,
} from "@server/repositories/game-repository.server";

describe("game repository navigation lookups", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("公開コードと開催IDからゲーム・グループを1クエリで返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          bb_rate: "5",
          bomb_pot_rule_enabled: true,
          cost_shares: ["0", "500", "1000"],
          first_place_cost: "0",
          group_id: "group-1",
          group_line_open_chat_url: "https://example.com/openchat",
          group_name: "River Check",
          group_paypay_link_registered_at: new Date("2026-09-20T00:00:00.000Z"),
          group_paypay_recipient_link: "https://example.com/paypay",
          group_public_code: "river-check",
          id: "game-1",
          initial_chips: "20000",
          small_blind_chips: "200",
          big_blind_chips: "400",
          big_blind_ante_chips: "400",
          initial_stack_bb: 50,
          chip_distribution: [
            { denomination: 100, count: 10 },
            { denomination: 500, count: 8 },
            { denomination: 1000, count: 5 },
            { denomination: 5000, count: 2 },
          ],
          played_at: new Date("2026-09-21T03:00:00.000Z"),
          preview_participant_count: 8,
          rebuy_chips: "20000",
          second_place_cost: "500",
          settlement_plan_published_at: new Date("2026-09-20T01:00:00.000Z"),
          seven_deuce_rule_enabled: true,
          status: "open",
          third_place_cost: "1000",
          title: "9月の会",
          venue_cost: "12000",
        },
      ],
    });

    await expect(
      findGameWithGroupByPublicCode("river-check", "game-1"),
    ).resolves.toEqual({
      group: {
        id: "group-1",
        lineOpenChatUrl: "https://example.com/openchat",
        name: "River Check",
        payPayLinkRegisteredAt: "2026-09-20T00:00:00.000Z",
        payPayRecipientLink: "https://example.com/paypay",
        publicCode: "river-check",
      },
      game: expect.objectContaining({
        bbRate: 5,
        costShares: [0, 500, 1000],
        groupId: "group-1",
        id: "game-1",
        initialChips: 20000,
        smallBlindChips: 200,
        bigBlindChips: 400,
        bigBlindAnteChips: 400,
        initialStackBb: 50,
        chipDistribution: [
          { denomination: 100, count: 10 },
          { denomination: 500, count: 8 },
          { denomination: 1000, count: 5 },
          { denomination: 5000, count: 2 },
        ],
        playedAt: "2026-09-21T03:00:00.000Z",
        status: "open",
        title: "9月の会",
        venueCost: 12000,
      }),
    });

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("INNER JOIN groups AS game_group");
    expect(sql).toContain("game_group.public_code = $2");
    expect(mocked.queryDatabase).toHaveBeenCalledOnce();
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "river-check",
    ]);
  });

  it("未backfillの旧行は従来値から安全なブラインド表示へフォールバックする", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          bb_rate: "0",
          bomb_pot_rule_enabled: false,
          cost_shares: null,
          first_place_cost: "0",
          group_id: "group-1",
          group_line_open_chat_url: null,
          group_name: "River Check",
          group_paypay_link_registered_at: null,
          group_paypay_recipient_link: null,
          group_public_code: "river-check",
          id: "legacy-game",
          initial_chips: "20000",
          small_blind_chips: null,
          big_blind_chips: null,
          big_blind_ante_chips: null,
          initial_stack_bb: 100,
          played_at: new Date("2026-09-01T00:00:00.000Z"),
          preview_participant_count: 8,
          rebuy_chips: "20000",
          second_place_cost: "500",
          settlement_plan_published_at: null,
          seven_deuce_rule_enabled: false,
          status: "finalized",
          third_place_cost: "1000",
          title: "旧開催",
          venue_cost: "11300",
        },
      ],
    });

    await expect(
      findGameWithGroupByPublicCode("river-check", "legacy-game"),
    ).resolves.toMatchObject({
      game: {
        initialStackBb: 100,
        smallBlindChips: 100,
        bigBlindChips: 200,
        bigBlindAnteChips: 200,
      },
    });
  });

  it("公開コードを使って開催一覧を直接取得する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          id: "game-1",
          participant_count: 4,
          played_at: new Date("2026-09-21T03:00:00.000Z"),
          status: "open",
          title: "9月の会",
          winner_name: null,
        },
      ],
    });

    await expect(listGamesForGroupByPublicCode("river-check")).resolves.toEqual(
      [
        {
          id: "game-1",
          participantCount: 4,
          playedAt: "2026-09-21T03:00:00.000Z",
          status: "open",
          title: "9月の会",
          winnerName: null,
        },
      ],
    );

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game_group.public_code = $1");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "river-check",
    ]);
  });
});

describe("game repository public result route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("確定済み開催のIDとグループ公開コードだけを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ id: "game-1", public_code: "river-check" }],
    });

    await expect(findFinalizedGamePublicRoute("game-1")).resolves.toEqual({
      gameId: "game-1",
      groupPublicCode: "river-check",
    });
    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game.status = 'finalized'");
    expect(sql).toContain("INNER JOIN groups");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
    ]);
  });

  it("対象がなければnullを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [] });

    await expect(
      findFinalizedGamePublicRoute("missing-game"),
    ).resolves.toBeNull();
  });
});

describe("game repository local rules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("受付中の開催だけ72oとボムポットを更新する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateLocalRules("group-1", "game-1", {
        sevenDeuceRuleEnabled: true,
        bombPotRuleEnabled: false,
      }),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("seven_deuce_rule_enabled = $3");
    expect(sql).toContain("bomb_pot_rule_enabled = $4");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      true,
      false,
    ]);
  });

  it("確定済みなど更新対象がなければ失敗を返す", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(
      updateLocalRules("group-1", "game-1", {
        sevenDeuceRuleEnabled: false,
        bombPotRuleEnabled: false,
      }),
    ).resolves.toBe(false);
  });
});

describe("game repository open game management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("新規開催で明示ブラインドと派生開始BBを正しい列順に保存する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [{ id: "game-1" }] });

    await expect(
      insertGame("group-1", {
        title: "9月の会",
        playedAt: "2026-09-23T00:00:00.000Z",
        initialChips: 20_000,
        smallBlindChips: 100,
        bigBlindChips: 200,
        bigBlindAnteChips: 200,
        initialStackBb: 100,
        rebuyChips: 20_000,
        chipDistribution: null,
        venueCost: 11_300,
        firstPlaceCost: 0,
        secondPlaceCost: 500,
        thirdPlaceCost: 1_000,
        previewParticipantCount: 8,
        costShares: [0, 500, 1_000, 1_400, 1_800, 2_000, 2_200, 2_400],
        bbRate: 10,
        sevenDeuceRuleEnabled: true,
        bombPotRuleEnabled: true,
      }, "creator-1"),
    ).resolves.toBe("game-1");

    const [sql, params] = mocked.queryDatabase.mock.calls[0]!;
    expect(String(sql)).toContain("$8, $9, $10::JSONB, $11, 100");
    expect(String(sql)).toContain("game_group.paypay_recipient_link");
    expect(params).toEqual([
      "group-1",
      "9月の会",
      "2026-09-23T00:00:00.000Z",
      20_000,
      100,
      200,
      200,
      100,
      20_000,
      null,
      11_300,
      0,
      500,
      1_000,
      8,
      [0, 500, 1_000, 1_400, 1_800, 2_000, 2_200, 2_400],
      10,
      true,
      true,
      "creator-1",
    ]);
  });

  it("同じグループの受付中開催だけ開催名を変更する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateOpenGameTitle("group-1", "game-1", "9月のポーカー会"),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("SET title = $3");
    expect(sql).toContain("group_id = $2");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      "9月のポーカー会",
    ]);
  });

  it("受付中開催の基本情報として開催名と日付だけを変更する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateOpenGameIdentity("group-1", "game-1", {
        title: "9月のポーカー会",
        playedAt: "2026-09-23T00:00:00.000Z",
      }),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).not.toContain("initial_stack_bb");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      "9月のポーカー会",
      "2026-09-23T00:00:00.000Z",
    ]);
  });

  it("初期チップ・明示ブラインド・派生開始BBを揃えて更新する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ status: "updated" }],
    });

    await expect(
      updateOpenGameConfiguration(
        "group-1",
        "game-1",
        {
          initialChips: 10_000,
          smallBlindChips: 100,
          bigBlindChips: 200,
          bigBlindAnteChips: 200,
          initialStackBb: 50,
          chipDistribution: null,
        },
        false,
      ),
    ).resolves.toBe("updated");

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("initial_chips = $3");
    expect(sql).toContain("rebuy_chips = $3");
    expect(sql).toContain("small_blind_chips = $4");
    expect(sql).toContain("big_blind_chips = $5");
    expect(sql).toContain("big_blind_ante_chips = $6");
    expect(sql).toContain("initial_stack_bb = $7");
    expect(sql).toContain("game_rebuy_events");
    expect(sql).toContain("participant.submitted_at IS NOT NULL");
    expect(sql).toContain("AS has_result_affecting_change");
    const confirmationComparison = sql.slice(
      sql.indexOf("-- BBA is a live-table rule"),
      sql.indexOf("AS has_result_affecting_change"),
    );
    expect(confirmationComparison).not.toContain(
      "game.big_blind_ante_chips IS DISTINCT FROM $6",
    );
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      10_000,
      100,
      200,
      200,
      50,
      null,
      false,
    ]);
  });

  it("記録済みならゲーム設定変更の確認を要求する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ status: "confirmation-required" }],
    });

    await expect(
      updateOpenGameConfiguration(
        "group-1",
        "game-1",
        {
          initialChips: 10_000,
          smallBlindChips: 100,
          bigBlindChips: 200,
          bigBlindAnteChips: 200,
          initialStackBb: 50,
          chipDistribution: null,
        },
        false,
      ),
    ).resolves.toBe("confirmation-required");
  });

  it("同じグループの受付中開催だけ削除する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(deleteOpenGame("group-1", "game-1")).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("DELETE FROM games");
    expect(sql).toContain("group_id = $2");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });

  it("確定済みなど対象外の開催は変更・削除できない", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(
      updateOpenGameTitle("group-1", "game-1", "変更後"),
    ).resolves.toBe(false);
    await expect(deleteOpenGame("group-1", "game-1")).resolves.toBe(false);
  });
});
