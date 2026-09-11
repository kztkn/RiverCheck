from pathlib import Path

p = Path("server/services/finalization-service.server.ts")
text = p.read_text()
old = '''    const affectedGroupPlayerIds = results.map((result) => result.groupPlayerId);\n    await deleteFinalResultsForReopen(transaction, gameId);\n    if (!(await markGameOpenAfterFinalization(transaction, groupId, gameId))) {\n      throw new Error("game status changed during finalization reopen");\n    }\n    await awardAchievementsForPlayers(\n      transaction,\n      groupId,\n      affectedGroupPlayerIds,\n    );\n    return { ok: true };\n'''
new = '''    await deleteFinalResultsForReopen(transaction, gameId);\n    if (!(await markGameOpenAfterFinalization(transaction, groupId, gameId))) {\n      throw new Error("game status changed during finalization reopen");\n    }\n    return { ok: true };\n'''
if old not in text:
    raise SystemExit("reopen achievement refresh block not found")
p.write_text(text.replace(old, new, 1))
