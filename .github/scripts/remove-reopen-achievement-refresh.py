from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


replace(
    "server/services/finalization-service.server.ts",
    '''    const affectedGroupPlayerIds = results.map((result) => result.groupPlayerId);\n    await deleteFinalResultsForReopen(transaction, gameId);\n    if (!(await markGameOpenAfterFinalization(transaction, groupId, gameId))) {\n      throw new Error("game status changed during finalization reopen");\n    }\n    await awardAchievementsForPlayers(\n      transaction,\n      groupId,\n      affectedGroupPlayerIds,\n    );\n    return { ok: true };\n''',
    '''    await deleteFinalResultsForReopen(transaction, gameId);\n    if (!(await markGameOpenAfterFinalization(transaction, groupId, gameId))) {\n      throw new Error("game status changed during finalization reopen");\n    }\n    return { ok: true };\n''',
)

replace(
    "app/routes/finalization-reopen.test.ts",
    '  it("removes only final results, reopens the game, and recalculates achievements", async () => {\n',
    '  it("removes only final results, reopens the game, and keeps earned achievements", async () => {\n',
)
replace(
    "app/routes/finalization-reopen.test.ts",
    '''    expect(mocked.awardAchievementsForPlayers).toHaveBeenCalledWith(\n      expect.anything(), "group-1", ids,\n    );\n''',
    '''    expect(mocked.awardAchievementsForPlayers).not.toHaveBeenCalled();\n''',
)
