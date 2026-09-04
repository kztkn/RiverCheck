from pathlib import Path

repo = Path("server/repositories/table-event-repository.server.ts")
text = repo.read_text()
replacements = {
    "canceled_by_group_player_id = $4,": "canceled_by_group_player_id = $4::uuid,",
    "canceled_by_type = $5\n": "canceled_by_type = $5::text\n",
    "$5 = 'organizer'": "$5::text = 'organizer'",
    "($4 IS NOT NULL AND event.recorded_by_group_player_id = $4)": "($4::uuid IS NOT NULL AND event.recorded_by_group_player_id = $4::uuid)",
}
for old, new in replacements.items():
    if old not in text:
        raise RuntimeError(f"repository marker not found: {old}")
    text = text.replace(old, new, 1)
repo.write_text(text)

unit = Path("app/routes/table-event-repository.test.ts")
text = unit.read_text()
text = text.replace(
    'expect(String(sql)).toContain("canceled_by_group_player_id = $4");',
    'expect(String(sql)).toContain("canceled_by_group_player_id = $4::uuid");',
)
text = text.replace(
    'expect(String(sql)).toContain("canceled_by_type = $5");',
    'expect(String(sql)).toContain("canceled_by_type = $5::text");',
)
text = text.replace(
    'expect(String(sql)).toContain("$5 = \'organizer\'");',
    'expect(String(sql)).toContain("$5::text = \'organizer\'");',
)
unit.write_text(text)

real = Path("scripts/verify-table-event-cancel-db.mjs")
text = real.read_text()
text = text.replace("canceled_by_group_player_id = $4,", "canceled_by_group_player_id = $4::uuid,")
text = text.replace("canceled_by_type = $5\n", "canceled_by_type = $5::text\n")
text = text.replace("$5 = 'organizer'", "$5::text = 'organizer'")
text = text.replace(
    "($4 IS NOT NULL AND event.recorded_by_group_player_id = $4)",
    "($4::uuid IS NOT NULL AND event.recorded_by_group_player_id = $4::uuid)",
)
real.write_text(text)
