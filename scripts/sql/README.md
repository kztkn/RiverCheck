# Manual production SQL

Files in this directory are intentionally not executed by `server/db/migrate.ts`.

## Organizer highlight migration

The legacy `games.highlight_*` data must be copied to the organizer's normal
participant post before migration `0018_drop_legacy_game_highlights.sql` runs.

Production rollout order:

1. Deploy the application version that no longer reads or writes `games.highlight_*`.
2. Run `migrate-organizer-highlights-to-stories.sql` once in the Neon SQL Editor.
3. Confirm the final notice reports the expected number of migrated posts.
4. Run `npm run db:migrate:production` to apply migration 0018 and drop the legacy columns.
5. Open the finalized game pages and confirm the migrated cards show the organizer's player name and avatar.

Before execution, replace the zero UUID in the configuration row with the
organizer's player ID. The SQL runs in one transaction and aborts without
changes if it detects missing participation, an existing post, overlong text,
or a verification mismatch.
