from pathlib import Path

path = Path("app/routes/game-admin-management.test.ts")
text = path.read_text()
old = '''    expect(response.headers.get("Location")).toBe(\n      "/g/river-check/manage?notice=game-deleted",\n    );\n'''
new = '''    expect(response.headers.get("Location")).toBe(\n      `/g/river-check/manage?notice=game-deleted&deletedGameId=${game.id}`,\n    );\n'''
if text.count(old) != 1:
    raise RuntimeError("delete redirect assertion did not match exactly once")
path.write_text(text.replace(old, new, 1))
print("Updated delete redirect assertion")
