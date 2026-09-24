import { queryDatabase } from "@server/db/client.server";
import type {
  CreateGameInput,
  GameDetails,
  GameListItem,
  GameStatus,
} from "@shared-types/game";
import type { GroupSummary } from "@shared-types/group";

interface GameSummaryRow {
  id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
  participant_count: number;
  winner_name: string | null;
  created_by_player_id: string | null;
}

interface GameDetailsRow {
  id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
  group_id: string;
  created_by_player_id: string | null;
  initial_chips: string;
  small_blind_chips: string | null;
  big_blind_chips: string | null;
  big_blind_ante_chips: string | null;
  initial_stack_bb: number;
  rebuy_chips: string;
  preview_participant_count: number;
  venue_cost: string;
  first_place_cost: string;
  second_place_cost: string;
  third_place_cost: string;
  cost_shares: string[] | null;
  bb_rate: string;
  settlement_plan_published_at: Date | null;
  seven_deuce_rule_enabled: boolean;
  bomb_pot_rule_enabled: boolean;
  paypay_recipient_link: string | null;
  paypay_link_registered_at: Date | null;
  paypay_owner_player_id: string | null;
  paypay_owner_display_name: string | null;
  paypay_owner_group_player_id: string | null;
}

interface FinalizedGamePublicRouteRow {
  id: string;
  public_code: string;
}

interface GameWithGroupRow extends GameDetailsRow {
  group_name: string;
  group_public_code: string;
  group_line_open_chat_url: string | null;
  group_paypay_recipient_link: string | null;
  group_paypay_link_registered_at: Date | null;
  group_paypay_owner_player_id: string | null;
  group_paypay_owner_display_name: string | null;
}

export async function listGamesForGroup(
  groupId: string,
): Promise<GameListItem[]> {
  return listGames("game.group_id = $1", [groupId]);
}

export async function listGamesForGroupByPublicCode(
  publicCode: string,
): Promise<GameListItem[]> {
  return listGames(
    "EXISTS (SELECT 1 FROM groups AS game_group WHERE game_group.id = game.group_id AND game_group.public_code = $1)",
    [publicCode],
  );
}

async function listGames(
  whereSql: string,
  params: unknown[],
): Promise<GameListItem[]> {
  const result = await queryDatabase<GameSummaryRow>(
    `
      SELECT
        game.id,
        game.title,
        game.played_at,
        game.status,
        game.created_by_player_id,
        COALESCE(participant_summary.participant_count, 0)::INTEGER
          AS participant_count,
        result_summary.winner_name
      FROM games AS game
      LEFT JOIN LATERAL (
        SELECT COUNT(participant.id)::INTEGER AS participant_count
        FROM game_participants AS participant
        WHERE participant.game_id = game.id
      ) AS participant_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          MAX(
            CASE WHEN game_result.rank = 1
              THEN player.display_name
            END
          ) AS winner_name
        FROM game_results AS game_result
        INNER JOIN group_players AS group_player
          ON group_player.id = game_result.group_player_id
        INNER JOIN players AS player ON player.id = group_player.player_id
        WHERE game_result.game_id = game.id
      ) AS result_summary ON TRUE
      WHERE ${whereSql}
      ORDER BY game.played_at DESC, game.created_at DESC
      LIMIT 50
    `,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    playedAt: row.played_at.toISOString(),
    status: row.status,
    participantCount: row.participant_count,
    winnerName: row.winner_name,
    createdByPlayerId: row.created_by_player_id,
  }));
}

export async function findGameForGroup(
  groupId: string,
  gameId: string,
): Promise<GameDetails | null> {
  const result = await queryDatabase<GameDetailsRow>(
    `
      SELECT
        id,
        group_id,
        created_by_player_id,
        title,
        played_at,
        status,
        initial_chips,
        small_blind_chips,
        big_blind_chips,
        big_blind_ante_chips,
        initial_stack_bb,
        rebuy_chips,
        preview_participant_count,
        venue_cost,
        first_place_cost,
        second_place_cost,
        third_place_cost,
        cost_shares,
        bb_rate,
        settlement_plan_published_at,
        seven_deuce_rule_enabled,
        bomb_pot_rule_enabled
        ,paypay_recipient_link
        ,paypay_link_registered_at
        ,paypay_owner_player_id
        ,(SELECT display_name FROM players WHERE id = games.paypay_owner_player_id) AS paypay_owner_display_name
        ,(SELECT id FROM group_players WHERE group_id = games.group_id AND player_id = games.paypay_owner_player_id LIMIT 1) AS paypay_owner_group_player_id
      FROM games
      WHERE id = $1 AND group_id = $2
    `,
    [gameId, groupId],
  );
  const row = result.rows[0];
  return row ? mapGameDetails(row) : null;
}

export async function findGameWithGroupByPublicCode(
  publicCode: string,
  gameId: string,
): Promise<{ group: GroupSummary; game: GameDetails } | null> {
  const result = await queryDatabase<GameWithGroupRow>(
    `
      SELECT
        game.id,
        game.group_id,
        game.created_by_player_id,
        game.title,
        game.played_at,
        game.status,
        game.initial_chips,
        game.small_blind_chips,
        game.big_blind_chips,
        game.big_blind_ante_chips,
        game.initial_stack_bb,
        game.rebuy_chips,
        game.preview_participant_count,
        game.venue_cost,
        game.first_place_cost,
        game.second_place_cost,
        game.third_place_cost,
        game.cost_shares,
        game.bb_rate,
        game.settlement_plan_published_at,
        game.seven_deuce_rule_enabled,
        game.bomb_pot_rule_enabled,
        game.paypay_recipient_link,
        game.paypay_link_registered_at,
        game.paypay_owner_player_id,
        paypay_owner.display_name AS paypay_owner_display_name,
        paypay_owner_membership.id AS paypay_owner_group_player_id,
        game_group.name AS group_name,
        game_group.public_code AS group_public_code,
        game_group.line_open_chat_url AS group_line_open_chat_url,
        game_group.paypay_recipient_link AS group_paypay_recipient_link,
        game_group.paypay_link_registered_at AS group_paypay_link_registered_at,
        game_group.paypay_owner_player_id AS group_paypay_owner_player_id,
        group_paypay_owner.display_name AS group_paypay_owner_display_name
      FROM games AS game
      INNER JOIN groups AS game_group ON game_group.id = game.group_id
      LEFT JOIN players AS paypay_owner ON paypay_owner.id = game.paypay_owner_player_id
      LEFT JOIN group_players AS paypay_owner_membership
        ON paypay_owner_membership.group_id = game.group_id
       AND paypay_owner_membership.player_id = game.paypay_owner_player_id
      LEFT JOIN players AS group_paypay_owner
        ON group_paypay_owner.id = game_group.paypay_owner_player_id
      WHERE game.id = $1
        AND game_group.public_code = $2
    `,
    [gameId, publicCode],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    group: {
      id: row.group_id,
      name: row.group_name,
      publicCode: row.group_public_code,
      lineOpenChatUrl: row.group_line_open_chat_url,
      payPayRecipientLink: row.group_paypay_recipient_link,
      payPayLinkRegisteredAt:
        row.group_paypay_link_registered_at?.toISOString() ?? null,
      payPayOwnerPlayerId: row.group_paypay_owner_player_id,
      payPayOwnerDisplayName: row.group_paypay_owner_display_name,
    },
    game: mapGameDetails(row),
  };
}

export async function findFinalizedGamePublicRoute(
  gameId: string,
): Promise<{ gameId: string; groupPublicCode: string } | null> {
  const result = await queryDatabase<FinalizedGamePublicRouteRow>(
    `
      SELECT game.id, game_group.public_code
      FROM games AS game
      INNER JOIN groups AS game_group ON game_group.id = game.group_id
      WHERE game.id = $1 AND game.status = 'finalized'
    `,
    [gameId],
  );
  const row = result.rows[0];
  return row ? { gameId: row.id, groupPublicCode: row.public_code } : null;
}

export async function insertGame(
  groupId: string,
  input: CreateGameInput,
  createdByPlayerId: string | null = null,
): Promise<string> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO games (
        group_id,
        title,
        played_at,
        status,
        initial_chips,
        small_blind_chips,
        big_blind_chips,
        big_blind_ante_chips,
        initial_stack_bb,
        rebuy_chips,
        venue_cost,
        rounding_unit,
        first_place_cost,
        second_place_cost,
        third_place_cost,
        preview_participant_count,
        cost_shares,
        bb_rate,
        seven_deuce_rule_enabled,
        bomb_pot_rule_enabled
        ,created_by_player_id
        ,paypay_recipient_link
        ,paypay_link_registered_at
        ,paypay_owner_player_id
      )
      SELECT $1, $2, $3, 'open', $4, $5, $6, $7, $8, $9, $10, 100,
             $11, $12, $13, $14, $15::BIGINT[], $16, $17, $18, $19,
             game_group.paypay_recipient_link,
             game_group.paypay_link_registered_at,
             game_group.paypay_owner_player_id
      FROM groups AS game_group
      WHERE game_group.id = $1
      RETURNING id
    `,
    [
      groupId,
      input.title,
      input.playedAt,
      input.initialChips,
      input.smallBlindChips,
      input.bigBlindChips,
      input.bigBlindAnteChips,
      input.initialStackBb,
      input.rebuyChips,
      input.venueCost,
      input.firstPlaceCost,
      input.secondPlaceCost,
      input.thirdPlaceCost,
      input.previewParticipantCount,
      input.costShares,
      input.bbRate,
      input.sevenDeuceRuleEnabled,
      input.bombPotRuleEnabled,
      createdByPlayerId,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Game creation did not return an id");
  return id;
}

export async function publishSettlementPlan(
  groupId: string,
  gameId: string,
  input: Pick<
    CreateGameInput,
    | "venueCost"
    | "firstPlaceCost"
    | "secondPlaceCost"
    | "thirdPlaceCost"
    | "previewParticipantCount"
    | "costShares"
    | "bbRate"
  >,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET venue_cost = $3,
          rounding_unit = 100,
          first_place_cost = $4,
          second_place_cost = $5,
          third_place_cost = $6,
          preview_participant_count = $7,
          cost_shares = $8::BIGINT[],
          bb_rate = $9,
          settlement_plan_published_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [
      gameId,
      groupId,
      input.venueCost,
      input.firstPlaceCost,
      input.secondPlaceCost,
      input.thirdPlaceCost,
      input.previewParticipantCount,
      input.costShares,
      input.bbRate,
    ],
  );
  return result.rowCount === 1;
}

export async function updateLocalRules(
  groupId: string,
  gameId: string,
  rules: {
    sevenDeuceRuleEnabled: boolean;
    bombPotRuleEnabled: boolean;
  },
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET seven_deuce_rule_enabled = $3,
          bomb_pot_rule_enabled = $4,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [gameId, groupId, rules.sevenDeuceRuleEnabled, rules.bombPotRuleEnabled],
  );
  return result.rowCount === 1;
}

export async function updateOpenGameTitle(
  groupId: string,
  gameId: string,
  title: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET title = $3,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [gameId, groupId, title],
  );
  return result.rowCount === 1;
}

export async function updateOpenGameIdentity(
  groupId: string,
  gameId: string,
  values: { title: string; playedAt: string },
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET title = $3,
          played_at = $4,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [gameId, groupId, values.title, values.playedAt],
  );
  return result.rowCount === 1;
}

export type OpenGameConfigurationUpdateResult =
  "updated" | "confirmation-required" | "not-found";

export async function updateOpenGameConfiguration(
  groupId: string,
  gameId: string,
  values: {
    initialChips: number;
    smallBlindChips: number;
    bigBlindChips: number;
    bigBlindAnteChips: number;
    initialStackBb: number;
  },
  confirmExistingActivity: boolean,
): Promise<OpenGameConfigurationUpdateResult> {
  const result = await queryDatabase<{
    status: OpenGameConfigurationUpdateResult;
  }>(
    `
      WITH target AS MATERIALIZED (
        SELECT
          game.id,
          EXISTS (
            SELECT 1
            FROM game_participants AS participant
            WHERE participant.game_id = game.id
              AND (
                participant.submitted_at IS NOT NULL OR
                participant.remaining_chips IS NOT NULL OR
                participant.settlement_rebuy_count IS NOT NULL OR
                COALESCE(participant.total_rebuy_count, 0) <> 0 OR
                participant.outstanding_rebuy_count <> 0
              )
          ) OR EXISTS (
            SELECT 1
            FROM game_rebuy_events AS event
            INNER JOIN game_participants AS participant
              ON participant.id = event.game_participant_id
            WHERE participant.game_id = game.id
          ) AS has_activity,
          (
            game.initial_chips <> $3 OR
            game.rebuy_chips <> $3 OR
            game.small_blind_chips IS DISTINCT FROM $4 OR
            game.big_blind_chips IS DISTINCT FROM $5 OR
            game.big_blind_ante_chips IS DISTINCT FROM $6 OR
            game.initial_stack_bb <> $7
          ) AS has_change
        FROM games AS game
        WHERE game.id = $1
          AND game.group_id = $2
          AND game.status = 'open'
      ),
      updated AS (
        UPDATE games AS game
        SET initial_chips = $3,
            rebuy_chips = $3,
            small_blind_chips = $4,
            big_blind_chips = $5,
            big_blind_ante_chips = $6,
            initial_stack_bb = $7,
            updated_at = NOW()
        FROM target
        WHERE game.id = target.id
          AND (
            $8::BOOLEAN OR
            NOT target.has_activity OR
            NOT target.has_change
          )
        RETURNING game.id
      )
      SELECT
        CASE
          WHEN updated.id IS NOT NULL THEN 'updated'
          ELSE 'confirmation-required'
        END AS status
      FROM target
      LEFT JOIN updated ON TRUE
      LIMIT 1
    `,
    [
      gameId,
      groupId,
      values.initialChips,
      values.smallBlindChips,
      values.bigBlindChips,
      values.bigBlindAnteChips,
      values.initialStackBb,
      confirmExistingActivity,
    ],
  );
  return result.rows[0]?.status ?? "not-found";
}

export async function deleteOpenGame(
  groupId: string,
  gameId: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      DELETE FROM games
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [gameId, groupId],
  );
  return result.rowCount === 1;
}

function mapGameDetails(row: GameDetailsRow): GameDetails {
  const initialChips = Number(row.initial_chips);
  const legacyBigBlindChips = initialChips / row.initial_stack_bb;
  return {
    id: row.id,
    groupId: row.group_id,
    createdByPlayerId: row.created_by_player_id,
    title: row.title,
    playedAt: row.played_at.toISOString(),
    status: row.status,
    initialChips,
    smallBlindChips: readBlindChipValue(
      row.small_blind_chips,
      legacyBigBlindChips / 2,
    ),
    bigBlindChips: readBlindChipValue(row.big_blind_chips, legacyBigBlindChips),
    bigBlindAnteChips: readBlindChipValue(
      row.big_blind_ante_chips,
      legacyBigBlindChips,
    ),
    initialStackBb: row.initial_stack_bb,
    rebuyChips: Number(row.rebuy_chips),
    previewParticipantCount: row.preview_participant_count,
    venueCost: Number(row.venue_cost),
    firstPlaceCost: Number(row.first_place_cost),
    secondPlaceCost: Number(row.second_place_cost),
    thirdPlaceCost: Number(row.third_place_cost),
    costShares: mapCostShares(row.cost_shares),
    bbRate: Number(row.bb_rate),
    settlementPlanPublishedAt:
      row.settlement_plan_published_at?.toISOString() ?? null,
    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,
    bombPotRuleEnabled: row.bomb_pot_rule_enabled,
    payPayRecipientLink: row.paypay_recipient_link,
    payPayLinkRegisteredAt: row.paypay_link_registered_at?.toISOString() ?? null,
    payPayOwnerPlayerId: row.paypay_owner_player_id,
    payPayOwnerDisplayName: row.paypay_owner_display_name,
    payPayOwnerGroupPlayerId: row.paypay_owner_group_player_id,
  };
}

function mapCostShares(values: string[] | null): number[] | null {
  return values?.map((value) => Number(value)) ?? null;
}

function readBlindChipValue(
  value: string | null,
  legacyFallback: number,
): number {
  return value === null ? legacyFallback : Number(value);
}
