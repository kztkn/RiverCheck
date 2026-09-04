from pathlib import Path

path = Path("server/repositories/table-event-repository.server.ts")
text = path.read_text()
old = '''      SET canceled_at = NOW(),
          canceled_by_group_player_id = $5,
          canceled_by_type = $6
      FROM games AS game
      WHERE event.game_id = game.id
        AND event.id = $3
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND event.canceled_at IS NULL
        AND (
          $6 = 'organizer'
          OR ($5 IS NOT NULL AND event.recorded_by_group_player_id = $5)
        )
      RETURNING event.id
    `,
    [
      input.gameId,
      input.groupId,
      input.eventId,
      null,
      input.actor.groupPlayerId,
      input.actor.type,
    ],
'''
new = '''      SET canceled_at = NOW(),
          canceled_by_group_player_id = $4,
          canceled_by_type = $5
      FROM games AS game
      WHERE event.game_id = game.id
        AND event.id = $3
        AND game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND event.canceled_at IS NULL
        AND (
          $5 = 'organizer'
          OR ($4 IS NOT NULL AND event.recorded_by_group_player_id = $4)
        )
      RETURNING event.id
    `,
    [
      input.gameId,
      input.groupId,
      input.eventId,
      input.actor.groupPlayerId,
      input.actor.type,
    ],
'''
if old not in text:
    raise RuntimeError("cancel query pattern not found")
path.write_text(text.replace(old, new, 1))
