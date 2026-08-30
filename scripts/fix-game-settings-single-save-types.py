from pathlib import Path

path = Path("server/services/game-service.server.ts")
text = path.read_text()
text = text.replace(
    '| { ok: false; errors: GameIdentityFormErrors; error?: string }',
    '| { ok: false; errors: GameIdentityFormErrors; error: string }',
    1,
)
text = text.replace(
    '    return { ok: false, errors: validation.errors };',
    '''    return {
      ok: false,
      errors: validation.errors,
      error:
        validation.errors.title ??
        validation.errors.playedAt ??
        "開催設定を確認してください。",
    };''',
    1,
)
path.write_text(text.rstrip() + "\n")
