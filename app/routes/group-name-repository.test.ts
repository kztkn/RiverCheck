import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: vi.fn(),
}));

import { updateGroupName } from "@server/repositories/group-repository.server";

describe("group name repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("groups.nameだけを更新しpublic_codeは変更しない", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateGroupName("group-1", "週末ボドゲ会"),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("UPDATE groups");
    expect(sql).toContain("SET name = $2");
    expect(sql).not.toContain("public_code =");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "group-1",
      "週末ボドゲ会",
    ]);
  });
});
