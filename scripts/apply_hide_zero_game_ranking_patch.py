from pathlib import Path

repo_path = Path("server/repositories/player-stats-repository.server.ts")
repo = repo_path.read_text(encoding="utf-8")
old_join = """        LEFT JOIN finalized_results AS finalized_result\n          ON finalized_result.group_player_id = group_player.id\n"""
new_join = """        INNER JOIN finalized_results AS finalized_result\n          ON finalized_result.group_player_id = group_player.id\n"""
if old_join not in repo:
    raise SystemExit("ranking finalized_results join not found")
repo_path.write_text(repo.replace(old_join, new_join, 1), encoding="utf-8")

requirements_path = Path("docs/requirements.md")
requirements = requirements_path.read_text(encoding="utf-8")
needle = "- ランキングは累計損益、平均損益、最大勝ちBB、最大負けBB、直近3参加の平均損益BB、TOP3回数、平均順位率を切り替えられ、カードには選択中の指標だけを表示する\n"
addition = needle + "- ランキング一覧は確定済み開催への参加が1回以上あるプレイヤーだけを表示し、参加0回のグループメンバーは表示しない\n"
if needle not in requirements:
    raise SystemExit("requirements ranking bullet not found")
requirements_path.write_text(requirements.replace(needle, addition, 1), encoding="utf-8")

stats_doc_path = Path("docs/player-stats.md")
stats_doc = stats_doc_path.read_text(encoding="utf-8")
old_doc = "- 参加0回の登録メンバーも0戦としてランキングへ表示する\n"
new_doc = "- ランキングは確定済み開催への参加が1回以上あるメンバーだけを対象とし、参加0回の登録メンバーは表示しない\n"
if old_doc not in stats_doc:
    raise SystemExit("player stats zero-game rule not found")
stats_doc_path.write_text(stats_doc.replace(old_doc, new_doc, 1), encoding="utf-8")

test_path = Path("app/routes/player-stats-ranking-repository.test.ts")
test_path.write_text('''import { beforeEach, describe, expect, it, vi } from "vitest";\n\nconst mocked = vi.hoisted(() => ({\n  queryDatabase: vi.fn(),\n}));\n\nvi.mock("@server/db/client.server", () => ({\n  queryDatabase: mocked.queryDatabase,\n}));\n\nimport { listPlayerStatsRanking } from "@server/repositories/player-stats-repository.server";\n\ndescribe("player stats ranking repository", () => {\n  beforeEach(() => vi.resetAllMocks());\n\n  it("確定済み開催へ1回以上参加したプレイヤーだけをランキング対象にする", async () => {\n    mocked.queryDatabase.mockResolvedValue({\n      rows: [\n        {\n          leaderboard_rank: "1",\n          group_player_id: "player-1",\n          display_name: "Alice",\n          games_played: 1,\n          wins: 1,\n          top_three_finishes: 1,\n          total_net_bb: "25",\n          average_net_bb: "25",\n          max_win_bb: "25",\n          max_loss_bb: "0",\n          recent_average_net_bb: "25",\n          recent_game_count: 1,\n          average_rank_rate: "12.5",\n          invalid_initial_chips_count: 0,\n          avatar_uploaded_at: null,\n          achievement_id: null,\n          achievement_code: null,\n          achievement_name: null,\n          achievement_description: null,\n          achievement_icon_key: null,\n          achievement_category: null,\n        },\n      ],\n    });\n\n    await expect(listPlayerStatsRanking("group-1", "total")).resolves.toMatchObject([\n      { groupPlayerId: "player-1", gamesPlayed: 1, rank: 1 },\n    ]);\n\n    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);\n    expect(sql).toContain("INNER JOIN finalized_results AS finalized_result");\n    expect(sql).not.toContain("LEFT JOIN finalized_results AS finalized_result");\n    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), ["group-1"]);\n  });\n});\n''', encoding="utf-8")
