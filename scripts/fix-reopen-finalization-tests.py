from pathlib import Path

path = Path("app/routes/finalization-reopen-repository.test.ts")
text = path.read_text()
needle = 'import { describe, expect, it, vi } from "vitest";\n'
replacement = '''import { describe, expect, it, vi } from "vitest";\n\nvi.mock("@server/db/client.server", () => ({\n  queryDatabase: vi.fn(),\n}));\n'''
if 'vi.mock("@server/db/client.server"' not in text:
    if needle not in text:
        raise RuntimeError("vitest import marker not found")
    text = text.replace(needle, replacement, 1)
path.write_text(text.rstrip() + "\n")
