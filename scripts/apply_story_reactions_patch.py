from __future__ import annotations

from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f"Patch marker not found: {path}: {old[:80]!r}")
    write(path, content.replace(old, new, 1))


# Route registration
replace_once(
    "app/routes.ts",
    '  route("g/:groupCode/games/:gameId/timeline", "routes/game-timeline.ts"),\n',
    '  route(\n'
    '    "g/:groupCode/games/:gameId/story-reactions",\n'
    '    "routes/game-story-reactions.ts",\n'
    '  ),\n'
    '  route("g/:groupCode/games/:gameId/timeline", "routes/game-timeline.ts"),\n',
)

# TABLE STORIES UI integration
replace_once(
    "app/components/game-stories.tsx",
    'import { GameTimeline } from "./game-timeline";\n',
    'import { GameTimeline } from "./game-timeline";\n'
    'import {\n'
    '  GameStoryReactionBar,\n'
    '  GameStoryReactionProvider,\n'
    '} from "./game-story-reactions";\n',
)
replace_once(
    "app/components/game-stories.tsx",
    '        <section className="game-stories-panel" aria-labelledby="game-stories-heading">\n'
    '          <header className="game-stories-heading">\n',
    '        <section className="game-stories-panel" aria-labelledby="game-stories-heading">\n'
    '          <GameStoryReactionProvider>\n'
    '          <header className="game-stories-heading">\n',
)
replace_once(
    "app/components/game-stories.tsx",
    '                      {result && entry.createdAt ? (\n'
    '                        <time dateTime={entry.createdAt}>\n'
    '                          {formatStoryTimestamp(entry.createdAt)}\n'
    '                        </time>\n'
    '                      ) : null}\n'
    '                    </div>\n',
    '                      {result && entry.createdAt ? (\n'
    '                        <time dateTime={entry.createdAt}>\n'
    '                          {formatStoryTimestamp(entry.createdAt)}\n'
    '                        </time>\n'
    '                      ) : null}\n'
    '                      <GameStoryReactionBar postId={entry.id} />\n'
    '                    </div>\n',
)
replace_once(
    "app/components/game-stories.tsx",
    '          {canPost && isEditorOpen ? (\n'
    '            <StoryEditorDialog\n'
    '              isOpen={isEditorOpen}\n'
    '              onClose={() => setIsEditorOpen(false)}\n'
    '              photoUrl={ownPhotoUrl}\n'
    '              post={ownPost}\n'
    '            />\n'
    '          ) : null}\n'
    '        </section>\n',
    '          {canPost && isEditorOpen ? (\n'
    '            <StoryEditorDialog\n'
    '              isOpen={isEditorOpen}\n'
    '              onClose={() => setIsEditorOpen(false)}\n'
    '              photoUrl={ownPhotoUrl}\n'
    '              post={ownPost}\n'
    '            />\n'
    '          ) : null}\n'
    '          </GameStoryReactionProvider>\n'
    '        </section>\n',
)

# Participant write rate limit also covers the dedicated reaction resource route.
replace_once(
    "domain/rate-limiting/classify-rate-limited-request.ts",
    'String.raw`^${GROUP_PATH}/(?:games/[^/]+|profile(?:/claim/[^/]+)?|stats/[^/]+)/?$`,',
    'String.raw`^${GROUP_PATH}/(?:games/[^/]+(?:/story-reactions)?|profile(?:/claim/[^/]+)?|stats/[^/]+)/?$`,',
)

# Styles
reaction_css = r'''
.game-story-reactions {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.game-story-reaction-row,
.game-story-reaction-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.game-story-reaction-chip,
.game-story-reaction-add,
.game-story-reaction-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.025);
  color: var(--muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.game-story-reaction-chip {
  min-height: 34px;
  gap: 5px;
  border-radius: 999px;
  padding: 4px 9px 4px 7px;
  font-size: 0.7rem;
  font-weight: 800;
}

.game-story-reaction-chip.is-selected,
.game-story-reaction-option.is-selected {
  border-color: rgba(57, 222, 141, 0.5);
  background: rgba(57, 222, 141, 0.11);
  color: var(--green);
}

.game-story-reaction-chip:hover,
.game-story-reaction-chip:focus-visible,
.game-story-reaction-add:hover,
.game-story-reaction-add:focus-visible,
.game-story-reaction-option:hover,
.game-story-reaction-option:focus-visible {
  border-color: rgba(57, 222, 141, 0.45);
  background: rgba(57, 222, 141, 0.08);
}

.game-story-reaction-chip:active,
.game-story-reaction-option:active {
  transform: scale(0.9);
}

.game-story-reaction-chip:disabled,
.game-story-reaction-option:disabled {
  cursor: default;
}

.game-story-reaction-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.game-story-reaction-add {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  padding: 0;
}

.game-story-reaction-add svg {
  width: 16px;
  height: 16px;
}

.game-story-reaction-picker {
  width: fit-content;
  max-width: 100%;
  border: 1px solid rgba(233, 186, 90, 0.2);
  border-radius: 14px;
  background: rgba(5, 16, 12, 0.94);
  padding: 7px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

.game-story-reaction-option {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  padding: 0;
}

.game-story-reaction-option .game-story-reaction-icon {
  width: 27px;
  height: 27px;
}
'''
replace_once(
    "app/styles/highlight.css",
    "@media (max-width: 639px) {\n",
    reaction_css + "\n@media (max-width: 639px) {\n",
)

# Canonical docs
requirements_reactions = '''- TABLE STORIESの各投稿にはリアクションを付けられる。第一弾は Fluent Emoji Flat の5種類（爆笑・熱い・えぐい・ナイス・GG/リスペクト）で固定し、表示素材はアプリ内に同梱する\n- 同じプレイヤーは1投稿へ複数種類のリアクションを付けられるが、同一種類は1回までとする。再度押すと解除でき、自分の投稿にも付けられる\n- リアクションはその開催への参加有無を問わず、同じグループでプロフィール認証済みのプレイヤーが付けられる。ゲスト閲覧者は件数だけを参照でき、リアクション操作はできない\n- 投稿カードには付いている種類だけをアイコンと件数で表示し、プロフィール認証済みプレイヤーには追加ボタンから5種類の選択肢を表示する。自分が付けている種類は選択状態を明示する\n- リアクション操作はOptimistic UIで即時反映し、保存失敗時だけ直前状態へ戻す。同じ種類の保存中は重複送信を抑止するが、別種類は並行して操作できる\n- 将来の年間集計で「リアクションした量」を評価する場合、押したスタンプ総数ではなく `COUNT(DISTINCT story_post_id)` 相当の「リアクションした投稿数」を主指標とし、1投稿へ複数種類を付けても1投稿として数える\n'''
replace_once(
    "docs/requirements.md",
    '- 画像更新ではR2とPostgreSQLの分散トランザクションを作らない。DB保存に失敗した新画像、置換・削除後の旧画像はbest effortで削除し、削除失敗時もDB参照を復元しない\n',
    '- 画像更新ではR2とPostgreSQLの分散トランザクションを作らない。DB保存に失敗した新画像、置換・削除後の旧画像はbest effortで削除し、削除失敗時もDB参照を復元しない\n' + requirements_reactions,
)

domain_reactions = '''- TABLE STORIESのリアクション種別は `laugh` / `fire` / `shock` / `nice` / `respect` の5種類とする\n- 1プレイヤー・1投稿・1種別につき最大1件とし、異なる種別は同じ投稿へ複数付与できる。自分の投稿への付与も許可する\n- リアクション操作主体は `group_player_id` で保持し、開催参加者であることは要件にしない。プロフィール認証済みの同一グループメンバーだけが追加・解除でき、participant tokenだけのゲストは操作できない\n- 追加・解除APIはtoggle命令ではなく `active=true/false` の最終状態指定として扱い、同じ要求の再送で状態が反転しないよう冪等にする\n- 将来のリアクション送信者表彰では、同一投稿に複数種別を付けても1件として数え、対象期間内の `DISTINCT game_story_post_id` を主指標にする\n'''
replace_once(
    "docs/domain-rules.md",
    '- 終了時入力では残りチップとリバイ証だけを保存し、TABLE STORIESの入力は表示しない\n',
    '- 終了時入力では残りチップとリバイ証だけを保存し、TABLE STORIESの入力は表示しない\n' + domain_reactions,
)

architecture_reactions = '''\nTABLE STORIESのリアクションは`game_story_reactions`へ分離し、投稿、リアクションした`group_player`、固定のreaction typeを保持する。同一投稿・同一プレイヤー・同一種別を一意制約にし、1投稿への複数種別を許可する。開催参加者ではなくプロフィール認証済みのグループメンバーを操作主体とするため、`game_participant_id`ではなく`group_player_id`を参照する。\n\nリアクション一覧と更新は専用resource routeを使用し、TABLE STORIES本体のloaderを再実行しない。クライアントはタップ時に件数と選択状態を先に更新するOptimistic UIとし、種別ごとに独立してPOSTする。サーバーは`active`の最終状態を受け取り、INSERTは`ON CONFLICT DO NOTHING`、解除はDELETEとして冪等に保存する。保存後はその種別の最新件数を返し、失敗時だけクライアントが直前状態へ戻す。\n'''
replace_once(
    "docs/architecture.md",
    'R2とPostgreSQLをまたぐ分散トランザクションは作らない。参加者投稿はR2へ新画像を保存してからDB参照を更新し、DB更新失敗時の新画像と更新成功後の旧画像をbest effortで削除する。主催者削除ではDBを先にsoft deleteして即座に非公開化し、その後でR2 objectをbest effortで削除する。R2削除失敗時も表示は復活させず、DB参照を正とする。\n',
    'R2とPostgreSQLをまたぐ分散トランザクションは作らない。参加者投稿はR2へ新画像を保存してからDB参照を更新し、DB更新失敗時の新画像と更新成功後の旧画像をbest effortで削除する。主催者削除ではDBを先にsoft deleteして即座に非公開化し、その後でR2 objectをbest effortで削除する。R2削除失敗時も表示は復活させず、DB参照を正とする。\n' + architecture_reactions,
)

# Shared types + pure validation
write(
    "types/game-story-reaction.ts",
    '''export type GameStoryReactionType =\n  | "laugh"\n  | "fire"\n  | "shock"\n  | "nice"\n  | "respect";\n\nexport interface GameStoryReactionSummary {\n  postId: string;\n  type: GameStoryReactionType;\n  count: number;\n  reactedByCurrentPlayer: boolean;\n}\n''',
)

write(
    "domain/story/game-story-reaction.ts",
    '''import type { GameStoryReactionType } from "@shared-types/game-story-reaction";\n\nexport const GAME_STORY_REACTION_TYPES = [\n  "laugh",\n  "fire",\n  "shock",\n  "nice",\n  "respect",\n] as const satisfies readonly GameStoryReactionType[];\n\nexport function isGameStoryReactionType(\n  value: string,\n): value is GameStoryReactionType {\n  return GAME_STORY_REACTION_TYPES.some((type) => type === value);\n}\n''',
)

# Database migration
write(
    "migrations/0022_add_game_story_reactions.sql",
    '''CREATE TABLE game_story_reactions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  game_story_post_id UUID NOT NULL\n    REFERENCES game_story_posts(id) ON DELETE CASCADE,\n  group_player_id UUID NOT NULL\n    REFERENCES group_players(id) ON DELETE CASCADE,\n  reaction_type TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  CONSTRAINT game_story_reactions_type_valid CHECK (\n    reaction_type IN ('laugh', 'fire', 'shock', 'nice', 'respect')\n  ),\n  UNIQUE (game_story_post_id, group_player_id, reaction_type)\n);\n\nCREATE INDEX game_story_reactions_post_type_idx\nON game_story_reactions (game_story_post_id, reaction_type);\n\nCREATE INDEX game_story_reactions_player_post_idx\nON game_story_reactions (group_player_id, game_story_post_id);\n''',
)

# Repository
write(
    "server/repositories/game-story-reaction-repository.server.ts",
    '''import {\n  queryDatabase,\n  withTransaction,\n} from "@server/db/client.server";\nimport type {\n  GameStoryReactionSummary,\n  GameStoryReactionType,\n} from "@shared-types/game-story-reaction";\n\ninterface ReactionSummaryRow {\n  post_id: string;\n  reaction_type: GameStoryReactionType;\n  reaction_count: number;\n  reacted_by_current_player: boolean;\n}\n\nexport async function listGameStoryReactionSummaries(\n  groupId: string,\n  gameId: string,\n  currentGroupPlayerId: string | null,\n): Promise<GameStoryReactionSummary[]> {\n  const result = await queryDatabase<ReactionSummaryRow>(\n    `\n      SELECT\n        post.id AS post_id,\n        reaction.reaction_type,\n        COUNT(*)::INTEGER AS reaction_count,\n        COALESCE(\n          BOOL_OR(reaction.group_player_id = $3::UUID),\n          FALSE\n        ) AS reacted_by_current_player\n      FROM game_story_reactions AS reaction\n      INNER JOIN game_story_posts AS post\n        ON post.id = reaction.game_story_post_id\n      INNER JOIN game_participants AS participant\n        ON participant.id = post.game_participant_id\n      INNER JOIN games AS game ON game.id = participant.game_id\n      WHERE game.id = $1\n        AND game.group_id = $2\n        AND game.status = 'finalized'\n        AND post.deleted_at IS NULL\n      GROUP BY post.id, reaction.reaction_type\n      ORDER BY post.created_at ASC, post.id ASC, reaction.reaction_type ASC\n    `,\n    [gameId, groupId, currentGroupPlayerId],\n  );\n  return result.rows.map((row) => ({\n    postId: row.post_id,\n    type: row.reaction_type,\n    count: row.reaction_count,\n    reactedByCurrentPlayer: row.reacted_by_current_player,\n  }));\n}\n\nexport async function setGameStoryReactionState(\n  groupId: string,\n  gameId: string,\n  postId: string,\n  groupPlayerId: string,\n  reactionType: GameStoryReactionType,\n  active: boolean,\n): Promise<{ active: boolean; count: number } | null> {\n  return withTransaction(async (transaction) => {\n    const target = await transaction.query<{ id: string }>(\n      `\n        SELECT post.id\n        FROM game_story_posts AS post\n        INNER JOIN game_participants AS participant\n          ON participant.id = post.game_participant_id\n        INNER JOIN games AS game ON game.id = participant.game_id\n        INNER JOIN group_players AS actor\n          ON actor.id = $4\n         AND actor.group_id = game.group_id\n         AND actor.is_active = TRUE\n        WHERE game.id = $1\n          AND game.group_id = $2\n          AND game.status = 'finalized'\n          AND post.id = $3\n          AND post.deleted_at IS NULL\n        LIMIT 1\n      `,\n      [gameId, groupId, postId, groupPlayerId],\n    );\n    if (!target.rows[0]) return null;\n\n    if (active) {\n      await transaction.query(\n        `\n          INSERT INTO game_story_reactions (\n            game_story_post_id,\n            group_player_id,\n            reaction_type\n          )\n          VALUES ($1, $2, $3)\n          ON CONFLICT (game_story_post_id, group_player_id, reaction_type)\n          DO NOTHING\n        `,\n        [postId, groupPlayerId, reactionType],\n      );\n    } else {\n      await transaction.query(\n        `\n          DELETE FROM game_story_reactions\n          WHERE game_story_post_id = $1\n            AND group_player_id = $2\n            AND reaction_type = $3\n        `,\n        [postId, groupPlayerId, reactionType],\n      );\n    }\n\n    const count = await transaction.query<{ reaction_count: number }>(\n      `\n        SELECT COUNT(*)::INTEGER AS reaction_count\n        FROM game_story_reactions\n        WHERE game_story_post_id = $1\n          AND reaction_type = $2\n      `,\n      [postId, reactionType],\n    );\n    return {\n      active,\n      count: count.rows[0]?.reaction_count ?? 0,\n    };\n  });\n}\n''',
)

# Service
write(
    "server/services/game-story-reaction-service.server.ts",
    '''import { findGameForGroup } from "@server/repositories/game-repository.server";\nimport { findGroupByPublicCode } from "@server/repositories/group-repository.server";\nimport {\n  listGameStoryReactionSummaries,\n  setGameStoryReactionState,\n} from "@server/repositories/game-story-reaction-repository.server";\nimport { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";\nimport { isGameStoryReactionType } from "@domain/story/game-story-reaction";\nimport type { GameStoryReactionSummary } from "@shared-types/game-story-reaction";\n\nexport interface GameStoryReactionOverview {\n  canReact: boolean;\n  reactions: GameStoryReactionSummary[];\n}\n\nexport async function getGameStoryReactionOverview(\n  request: Request,\n  groupCode: string,\n  gameId: string,\n): Promise<GameStoryReactionOverview | null> {\n  const group = await findGroupByPublicCode(groupCode);\n  if (!group) return null;\n  const game = await findGameForGroup(group.id, gameId);\n  if (!game || game.status !== "finalized") return null;\n  const profileOverview = await getAuthenticatedPlayerProfile(request, groupCode);\n  const groupPlayerId = profileOverview?.profile?.groupPlayerId ?? null;\n  return {\n    canReact: groupPlayerId !== null,\n    reactions: await listGameStoryReactionSummaries(\n      group.id,\n      gameId,\n      groupPlayerId,\n    ),\n  };\n}\n\nexport async function saveGameStoryReaction(\n  request: Request,\n  input: {\n    active: boolean;\n    gameId: string;\n    groupCode: string;\n    postId: string;\n    reactionType: string;\n  },\n): Promise<\n  | { ok: true; active: boolean; count: number }\n  | { ok: false; status: 400 | 403 | 404; error: string }\n> {\n  if (!isGameStoryReactionType(input.reactionType)) {\n    return { ok: false, status: 400, error: "リアクションの種類が不正です。" };\n  }\n  const group = await findGroupByPublicCode(input.groupCode);\n  if (!group) return { ok: false, status: 404, error: "グループが見つかりません。" };\n  const game = await findGameForGroup(group.id, input.gameId);\n  if (!game || game.status !== "finalized") {\n    return { ok: false, status: 404, error: "確定済みの開催が見つかりません。" };\n  }\n  const profileOverview = await getAuthenticatedPlayerProfile(\n    request,\n    input.groupCode,\n  );\n  const groupPlayerId = profileOverview?.profile?.groupPlayerId ?? null;\n  if (!groupPlayerId) {\n    return {\n      ok: false,\n      status: 403,\n      error: "プロフィール認証済みのメンバーだけリアクションできます。",\n    };\n  }\n  const saved = await setGameStoryReactionState(\n    group.id,\n    input.gameId,\n    input.postId,\n    groupPlayerId,\n    input.reactionType,\n    input.active,\n  );\n  return saved\n    ? { ok: true, ...saved }\n    : { ok: false, status: 404, error: "投稿を確認できませんでした。" };\n}\n''',
)

# Resource route
write(
    "app/routes/game-story-reactions.ts",
    '''import {\n  getGameStoryReactionOverview,\n  saveGameStoryReaction,\n} from "@server/services/game-story-reaction-service.server";\nimport type { Route } from "./+types/game-story-reactions";\n\nconst UUID_PATTERN =\n  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;\n\nexport async function loader({ request, params }: Route.LoaderArgs) {\n  const overview = await getGameStoryReactionOverview(\n    request,\n    params.groupCode,\n    params.gameId,\n  );\n  if (!overview) throw new Response("Not Found", { status: 404 });\n  return Response.json(overview, {\n    headers: { "Cache-Control": "no-store" },\n  });\n}\n\nexport async function action({ request, params }: Route.ActionArgs) {\n  const formData = await request.formData();\n  const postId = readString(formData, "postId");\n  const reactionType = readString(formData, "reactionType");\n  const activeValue = readString(formData, "active");\n  if (!UUID_PATTERN.test(postId) || !["yes", "no"].includes(activeValue)) {\n    return Response.json(\n      { ok: false, error: "入力内容を確認してください。" },\n      { status: 400 },\n    );\n  }\n  const result = await saveGameStoryReaction(request, {\n    active: activeValue === "yes",\n    gameId: params.gameId,\n    groupCode: params.groupCode,\n    postId,\n    reactionType,\n  });\n  return Response.json(\n    result.ok\n      ? {\n          ...result,\n          postId,\n          reactionType,\n        }\n      : result,\n    {\n      status: result.ok ? 200 : result.status,\n      headers: { "Cache-Control": "no-store" },\n    },\n  );\n}\n\nfunction readString(formData: FormData, name: string): string {\n  const value = formData.get(name);\n  return typeof value === "string" ? value : "";\n}\n''',
)

# Client component
write(
    "app/components/game-story-reactions.tsx",
    '''import { IconPlus } from "@tabler/icons-react";\nimport {\n  createContext,\n  useContext,\n  useEffect,\n  useMemo,\n  useState,\n  type ReactNode,\n} from "react";\nimport { GAME_STORY_REACTION_TYPES } from "@domain/story/game-story-reaction";\nimport type {\n  GameStoryReactionSummary,\n  GameStoryReactionType,\n} from "@shared-types/game-story-reaction";\n\nconst REACTION_VISUALS: ReadonlyArray<{\n  label: string;\n  src: string;\n  type: GameStoryReactionType;\n}> = [\n  { type: "laugh", label: "爆笑", src: "/reactions/fluent-laugh.svg" },\n  { type: "fire", label: "熱い", src: "/reactions/fluent-fire.svg" },\n  { type: "shock", label: "えぐい", src: "/reactions/fluent-shock.svg" },\n  { type: "nice", label: "ナイス", src: "/reactions/fluent-nice.svg" },\n  { type: "respect", label: "GG・リスペクト", src: "/reactions/fluent-respect.svg" },\n];\n\ntype ReactionState = { active: boolean; count: number };\ntype ReactionStore = Record<\n  string,\n  Partial<Record<GameStoryReactionType, ReactionState>>\n>;\n\ninterface ReactionContextValue {\n  canReact: boolean;\n  loaded: boolean;\n  pending: ReadonlySet<string>;\n  store: ReactionStore;\n  toggle: (postId: string, type: GameStoryReactionType) => void;\n}\n\nconst ReactionContext = createContext<ReactionContextValue | null>(null);\n\nexport function GameStoryReactionProvider({ children }: { children: ReactNode }) {\n  const pathname = typeof window === "undefined" ? "" : window.location.pathname;\n  const endpoint = buildGameStoryReactionPath(pathname);\n  const [loaded, setLoaded] = useState(false);\n  const [canReact, setCanReact] = useState(false);\n  const [store, setStore] = useState<ReactionStore>({});\n  const [pending, setPending] = useState<Set<string>>(() => new Set());\n\n  useEffect(() => {\n    if (!endpoint) {\n      setLoaded(true);\n      setCanReact(false);\n      setStore({});\n      return;\n    }\n    const controller = new AbortController();\n    setLoaded(false);\n    setStore({});\n    void fetch(endpoint, {\n      headers: { Accept: "application/json" },\n      signal: controller.signal,\n    })\n      .then(async (response) => {\n        if (!response.ok) throw new Error(`Reaction load failed: ${response.status}`);\n        return response.json() as Promise<{\n          canReact: boolean;\n          reactions: GameStoryReactionSummary[];\n        }>;\n      })\n      .then((overview) => {\n        if (controller.signal.aborted) return;\n        setCanReact(overview.canReact);\n        setStore(buildReactionStore(overview.reactions));\n        setLoaded(true);\n      })\n      .catch((error) => {\n        if (controller.signal.aborted) return;\n        console.error("Failed to load game story reactions", error);\n        setCanReact(false);\n        setStore({});\n        setLoaded(true);\n      });\n    return () => controller.abort();\n  }, [endpoint]);\n\n  function toggle(postId: string, type: GameStoryReactionType) {\n    if (!endpoint || !canReact) return;\n    const key = reactionKey(postId, type);\n    if (pending.has(key)) return;\n    const previous = getReactionState(store, postId, type);\n    const desired = !previous.active;\n\n    setStore((current) =>\n      setReactionState(current, postId, type, {\n        active: desired,\n        count: Math.max(0, previous.count + (desired ? 1 : -1)),\n      }),\n    );\n    setPending((current) => new Set(current).add(key));\n\n    const formData = new FormData();\n    formData.set("postId", postId);\n    formData.set("reactionType", type);\n    formData.set("active", desired ? "yes" : "no");\n    void fetch(endpoint, {\n      method: "POST",\n      body: formData,\n      headers: { Accept: "application/json" },\n    })\n      .then(async (response) => {\n        const data = await response.json() as {\n          ok: boolean;\n          active?: boolean;\n          count?: number;\n          error?: string;\n        };\n        if (!response.ok || !data.ok || typeof data.count !== "number") {\n          throw new Error(data.error ?? `Reaction save failed: ${response.status}`);\n        }\n        setStore((current) =>\n          setReactionState(current, postId, type, {\n            active: Boolean(data.active),\n            count: data.count ?? 0,\n          }),\n        );\n      })\n      .catch((error) => {\n        console.error("Failed to save game story reaction", error);\n        setStore((current) =>\n          setReactionState(current, postId, type, previous),\n        );\n      })\n      .finally(() => {\n        setPending((current) => {\n          const next = new Set(current);\n          next.delete(key);\n          return next;\n        });\n      });\n  }\n\n  const value = useMemo(\n    () => ({ canReact, loaded, pending, store, toggle }),\n    [canReact, loaded, pending, store],\n  );\n  return (\n    <ReactionContext.Provider value={value}>\n      {children}\n    </ReactionContext.Provider>\n  );\n}\n\nexport function GameStoryReactionBar({ postId }: { postId: string }) {\n  const context = useContext(ReactionContext);\n  const [pickerOpen, setPickerOpen] = useState(false);\n  if (!context?.loaded) return null;\n\n  const visible = REACTION_VISUALS.filter(\n    ({ type }) => getReactionState(context.store, postId, type).count > 0,\n  );\n  if (!context.canReact && visible.length === 0) return null;\n\n  return (\n    <div className="game-story-reactions">\n      <div className="game-story-reaction-row">\n        {visible.map((reaction) => {\n          const state = getReactionState(context.store, postId, reaction.type);\n          const isPending = context.pending.has(reactionKey(postId, reaction.type));\n          return context.canReact ? (\n            <button\n              aria-pressed={state.active}\n              className={`game-story-reaction-chip${state.active ? " is-selected" : ""}`}\n              disabled={isPending}\n              key={reaction.type}\n              onClick={() => context.toggle(postId, reaction.type)}\n              title={reaction.label}\n              type="button"\n            >\n              <ReactionImage reaction={reaction} />\n              <span>{state.count}</span>\n            </button>\n          ) : (\n            <span className="game-story-reaction-chip" key={reaction.type}>\n              <ReactionImage reaction={reaction} />\n              <span>{state.count}</span>\n            </span>\n          );\n        })}\n        {context.canReact ? (\n          <button\n            aria-expanded={pickerOpen}\n            aria-label="リアクションを追加"\n            className="game-story-reaction-add"\n            onClick={() => setPickerOpen((current) => !current)}\n            type="button"\n          >\n            <IconPlus aria-hidden="true" stroke={2} />\n          </button>\n        ) : null}\n      </div>\n      {context.canReact && pickerOpen ? (\n        <div className="game-story-reaction-picker" aria-label="リアクションを選択">\n          {REACTION_VISUALS.map((reaction) => {\n            const state = getReactionState(context.store, postId, reaction.type);\n            const isPending = context.pending.has(reactionKey(postId, reaction.type));\n            return (\n              <button\n                aria-label={`${reaction.label}${state.active ? "を取り消す" : "を付ける"}`}\n                aria-pressed={state.active}\n                className={`game-story-reaction-option${state.active ? " is-selected" : ""}`}\n                disabled={isPending}\n                key={reaction.type}\n                onClick={() => context.toggle(postId, reaction.type)}\n                title={reaction.label}\n                type="button"\n              >\n                <ReactionImage reaction={reaction} />\n              </button>\n            );\n          })}\n        </div>\n      ) : null}\n    </div>\n  );\n}\n\nfunction ReactionImage({ reaction }: { reaction: (typeof REACTION_VISUALS)[number] }) {\n  return (\n    <img\n      alt=""\n      aria-hidden="true"\n      className="game-story-reaction-icon"\n      draggable={false}\n      src={reaction.src}\n    />\n  );\n}\n\nexport function buildGameStoryReactionPath(pathname: string): string | null {\n  const normalized = pathname.replace(/\\/$/u, "");\n  return /^\\/g\\/[^/]+\\/games\\/[^/]+$/u.test(normalized)\n    ? `${normalized}/story-reactions`\n    : null;\n}\n\nexport function buildReactionStore(\n  summaries: GameStoryReactionSummary[],\n): ReactionStore {\n  let store: ReactionStore = {};\n  for (const summary of summaries) {\n    if (!GAME_STORY_REACTION_TYPES.includes(summary.type)) continue;\n    store = setReactionState(store, summary.postId, summary.type, {\n      active: summary.reactedByCurrentPlayer,\n      count: summary.count,\n    });\n  }\n  return store;\n}\n\nfunction getReactionState(\n  store: ReactionStore,\n  postId: string,\n  type: GameStoryReactionType,\n): ReactionState {\n  return store[postId]?.[type] ?? { active: false, count: 0 };\n}\n\nfunction setReactionState(\n  store: ReactionStore,\n  postId: string,\n  type: GameStoryReactionType,\n  value: ReactionState,\n): ReactionStore {\n  return {\n    ...store,\n    [postId]: {\n      ...store[postId],\n      [type]: value,\n    },\n  };\n}\n\nfunction reactionKey(postId: string, type: GameStoryReactionType): string {\n  return `${postId}:${type}`;\n}\n''',
)

# Tests
write(
    "app/routes/game-story-reaction-domain.test.ts",
    '''import { describe, expect, it } from "vitest";\nimport {\n  GAME_STORY_REACTION_TYPES,\n  isGameStoryReactionType,\n} from "@domain/story/game-story-reaction";\nimport { buildGameStoryReactionPath } from "~/components/game-story-reactions";\nimport { classifyRateLimitedRequest } from "@domain/rate-limiting/classify-rate-limited-request";\n\ndescribe("game story reactions", () => {\n  it("第一弾の5種類だけを受け付ける", () => {\n    expect(GAME_STORY_REACTION_TYPES).toEqual([\n      "laugh",\n      "fire",\n      "shock",\n      "nice",\n      "respect",\n    ]);\n    expect(isGameStoryReactionType("laugh")).toBe(true);\n    expect(isGameStoryReactionType("custom")).toBe(false);\n  });\n\n  it("開催結果画面から専用resource routeを組み立てる", () => {\n    expect(buildGameStoryReactionPath("/g/home/games/game-1")).toBe(\n      "/g/home/games/game-1/story-reactions",\n    );\n    expect(buildGameStoryReactionPath("/g/home/games/game-1/")).toBe(\n      "/g/home/games/game-1/story-reactions",\n    );\n    expect(buildGameStoryReactionPath("/g/home/games/game-1/admin")).toBeNull();\n  });\n\n  it("リアクションPOSTをparticipant writeとしてrate limitする", () => {\n    expect(\n      classifyRateLimitedRequest(\n        "POST",\n        "/g/home/games/00000000-0000-4000-8000-000000000001/story-reactions",\n      ),\n    ).toBe("participant-write");\n  });\n});\n''',
)

write(
    "app/routes/game-story-reaction-repository.test.ts",
    '''import { beforeEach, describe, expect, it, vi } from "vitest";\n\nconst mocked = vi.hoisted(() => ({\n  queryDatabase: vi.fn(),\n  withTransaction: vi.fn(),\n}));\n\nvi.mock("@server/db/client.server", () => ({\n  queryDatabase: mocked.queryDatabase,\n  withTransaction: mocked.withTransaction,\n}));\n\nimport {\n  listGameStoryReactionSummaries,\n  setGameStoryReactionState,\n} from "@server/repositories/game-story-reaction-repository.server";\n\ndescribe("game story reaction repository", () => {\n  beforeEach(() => vi.resetAllMocks());\n\n  it("確定済みで削除されていない投稿の件数と自分の選択だけを返す", async () => {\n    mocked.queryDatabase.mockResolvedValue({\n      rows: [\n        {\n          post_id: "post-1",\n          reaction_type: "fire",\n          reaction_count: 3,\n          reacted_by_current_player: true,\n        },\n      ],\n    });\n    await expect(\n      listGameStoryReactionSummaries("group-1", "game-1", null),\n    ).resolves.toEqual([\n      { postId: "post-1", type: "fire", count: 3, reactedByCurrentPlayer: true },\n    ]);\n    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);\n    expect(sql).toContain("game.status = 'finalized'");\n    expect(sql).toContain("post.deleted_at IS NULL");\n    expect(sql).toContain("BOOL_OR");\n  });\n\n  it("active=trueを冪等INSERTし、保存後の件数を返す", async () => {\n    const transaction = { query: vi.fn() };\n    mocked.withTransaction.mockImplementation(async (callback) => callback(transaction));\n    transaction.query\n      .mockResolvedValueOnce({ rows: [{ id: "post-1" }] })\n      .mockResolvedValueOnce({ rows: [], rowCount: 1 })\n      .mockResolvedValueOnce({ rows: [{ reaction_count: 4 }] });\n\n    await expect(\n      setGameStoryReactionState(\n        "group-1",\n        "game-1",\n        "post-1",\n        "player-1",\n        "laugh",\n        true,\n      ),\n    ).resolves.toEqual({ active: true, count: 4 });\n    expect(String(transaction.query.mock.calls[1]?.[0])).toContain(\n      "ON CONFLICT (game_story_post_id, group_player_id, reaction_type)",\n    );\n    expect(String(transaction.query.mock.calls[0]?.[0])).toContain(\n      "actor.is_active = TRUE",\n    );\n  });\n});\n''',
)

# Fluent Emoji Flat assets, copied from Microsoft's MIT-licensed repository.
assets = {
    "fluent-laugh.svg": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Rolling%20on%20the%20floor%20laughing/Flat/rolling_on_the_floor_laughing_flat.svg",
    "fluent-fire.svg": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Fire/Flat/fire_flat.svg",
    "fluent-shock.svg": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Face%20screaming%20in%20fear/Flat/face_screaming_in_fear_flat.svg",
    "fluent-nice.svg": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Clapping%20hands/Default/Flat/clapping_hands_flat_default.svg",
    "fluent-respect.svg": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Handshake/Flat/handshake_flat.svg",
}
for filename, url in assets.items():
    target = ROOT / "public" / "reactions" / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        with urlopen(url, timeout=30) as response:
            target.write_bytes(response.read())

write(
    "public/reactions/FLUENT-EMOJI-LICENSE.txt",
    '''Fluent Emoji assets\nCopyright (c) Microsoft Corporation\nSource: https://github.com/microsoft/fluentui-emoji\n\nMIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n''',
)

print("Story reaction patch applied")
