from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace(
    "server/services/finalization-service.server.ts",
    'import {\n  awardAchievementsForPlayers,\n  refreshAchievementsForPlayers,\n} from "@server/services/achievement-service.server";\n',
    'import {\n  awardAchievementsForPlayers,\n  scheduleAchievementRefresh,\n} from "@server/services/achievement-service.server";\n',
)
replace(
    "server/services/finalization-service.server.ts",
    '''  try {\n    await refreshAchievementsForPlayers(\n      group.id,\n      finalized.achievementPlayerIds,\n    );\n  } catch (error) {\n    console.error("Failed to refresh achievements after finalization", {\n      errorType: error instanceof Error ? error.name : "unknown",\n      gameId,\n    });\n  }\n\n''',
    '''  scheduleAchievementRefresh(group.id, finalized.achievementPlayerIds, {\n    reason: "finalization",\n    gameId,\n  });\n\n''',
)

replace(
    "app/routes/game-participant.tsx",
    'import { refreshAchievementsForPlayers } from "@server/services/achievement-service.server";\n',
    'import { scheduleAchievementRefresh } from "@server/services/achievement-service.server";\n',
)
replace(
    "app/routes/game-participant.tsx",
    '''    if (groupPlayerId && !isDeletingOwnStory) {\n      try {\n        await refreshAchievementsForPlayers(context.group.id, [groupPlayerId]);\n      } catch (error) {\n        console.error("Failed to refresh achievements after story post", {\n          errorType: error instanceof Error ? error.name : "unknown",\n          gameId: params.gameId,\n          groupPlayerId,\n        });\n      }\n    }\n''',
    '''    if (groupPlayerId && !isDeletingOwnStory) {\n      scheduleAchievementRefresh(context.group.id, [groupPlayerId], {\n        reason: "story-post",\n        gameId: params.gameId,\n      });\n    }\n''',
)

replace(
    "app/routes/game-participant.test.ts",
    'vi.mock("@server/services/achievement-service.server", () => ({\n  refreshAchievementsForPlayers: vi.fn().mockResolvedValue(undefined),\n}));\n',
    'vi.mock("@server/services/achievement-service.server", () => ({\n  scheduleAchievementRefresh: vi.fn(),\n}));\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    '  refreshAchievements: vi.fn(),\n',
    '  scheduleAchievements: vi.fn(),\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    '  refreshAchievementsForPlayers: mocked.refreshAchievements,\n',
    '  scheduleAchievementRefresh: mocked.scheduleAchievements,\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    '''    mocked.refreshAchievements.mockImplementation(async () => {\n      mocked.events.push("achievements");\n    });\n''',
    '''    mocked.scheduleAchievements.mockImplementation(() => {\n      mocked.events.push("achievements");\n    });\n''',
)
