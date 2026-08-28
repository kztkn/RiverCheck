import { describe, expect, it, vi } from "vitest";
import {
  acquireMigrationLock,
  MIGRATION_ADVISORY_LOCK_ID,
} from "./migration-lock.js";

describe("acquireMigrationLock", () => {
  it("acquires the RiverCheck session-level advisory lock", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await acquireMigrationLock({ query });

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("SELECT pg_advisory_lock($1)", [
      MIGRATION_ADVISORY_LOCK_ID,
    ]);
  });
});
