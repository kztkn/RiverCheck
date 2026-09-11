from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


replace(
    "app/routes/game-participant.test.ts",
    'vi.mock("@server/services/organizer-auth.server", () => ({\n  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,\n  requireOrganizer: mocked.requireOrganizer,\n}));\n',
    'vi.mock("@server/services/organizer-auth.server", () => ({\n  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,\n  requireOrganizer: mocked.requireOrganizer,\n}));\nvi.mock("@server/services/achievement-service.server", () => ({\n  refreshAchievementsForPlayers: vi.fn().mockResolvedValue(undefined),\n}));\n',
)

replace(
    "app/routes/game-finalized-notification.test.ts",
    '  notifyGameFinalized: vi.fn(),\n  saveCostSettings: vi.fn(),\n',
    '  notifyGameFinalized: vi.fn(),\n  refreshAchievements: vi.fn(),\n  saveCostSettings: vi.fn(),\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    'vi.mock("@server/services/achievement-service.server", () => ({\n  awardAchievementsForPlayers: vi.fn(),\n}));\n',
    'vi.mock("@server/services/achievement-service.server", () => ({\n  awardAchievementsForPlayers: vi.fn(),\n  refreshAchievementsForPlayers: mocked.refreshAchievements,\n}));\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    '    mocked.markFinalized.mockResolvedValue(true);\n    mocked.notifyGameFinalized.mockImplementation(async () => {\n',
    '    mocked.markFinalized.mockResolvedValue(true);\n    mocked.refreshAchievements.mockImplementation(async () => {\n      mocked.events.push("achievements");\n    });\n    mocked.notifyGameFinalized.mockImplementation(async () => {\n',
)
replace(
    "app/routes/game-finalized-notification.test.ts",
    '    expect(mocked.events).toEqual(["committed", "notified"]);\n',
    '    expect(mocked.events).toEqual(["committed", "achievements", "notified"]);\n',
)
