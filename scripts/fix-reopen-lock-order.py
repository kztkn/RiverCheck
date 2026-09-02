from pathlib import Path

service = Path("server/services/finalization-service.server.ts")
text = service.read_text()
old = '''    const participants = await lockParticipantsForFinalization(transaction, gameId);\n    const blockers = await getFinalizationReopenBlockers(transaction, gameId);\n    const blockerLabels = [\n'''
new = '''    const participants = await lockParticipantsForFinalization(transaction, gameId);\n    // Lock result rows before checking post-finalization side effects.\n    // Cost-share receipt writes also lock these rows, so this ordering closes the\n    // race where a receipt could be inserted after the blocker check.\n    const results = await lockFinalResults(transaction, gameId);\n    const blockers = await getFinalizationReopenBlockers(transaction, gameId);\n    const blockerLabels = [\n'''
if old not in text:
    raise RuntimeError("reopen lock-order anchor not found")
text = text.replace(old, new, 1)
old2 = '''\n    const results = await lockFinalResults(transaction, gameId);\n    const participantIds = new Set(\n'''
new2 = '''\n    const participantIds = new Set(\n'''
if old2 not in text:
    raise RuntimeError("duplicate results lock anchor not found")
text = text.replace(old2, new2, 1)
service.write_text(text.rstrip() + "\n")

test = Path("app/routes/finalization-reopen.test.ts")
text = test.read_text()
marker = '''  it.each([\n'''
addition = '''  it("locks final results before checking blockers", async () => {\n    const callOrder: string[] = [];\n    mocked.lockFinalResults.mockImplementationOnce(async () => {\n      callOrder.push("results");\n      return ids.map((id, index) => ({ groupPlayerId: id, rank: index + 1 }));\n    });\n    mocked.getFinalizationReopenBlockers.mockImplementationOnce(async () => {\n      callOrder.push("blockers");\n      return {\n        hasResultRevisions: false,\n        hasCostShareReceipts: false,\n        hasStoryPosts: false,\n      };\n    });\n\n    await reopenFinalizedGame("group-1", "game-1");\n    expect(callOrder).toEqual(["results", "blockers"]);\n  });\n\n'''
if addition not in text:
    if marker not in text:
        raise RuntimeError("test insertion marker not found")
    text = text.replace(marker, addition + marker, 1)
test.write_text(text.rstrip() + "\n")
