import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  deleteGamePhoto: vi.fn(),
  findEditableGameStoryPost: vi.fn(),
  putGamePhoto: vi.fn(),
  saveFinalizedGameStoryRecord: vi.fn(),
  softDeleteGameStoryPost: vi.fn(),
  validateGamePhotoBytes: vi.fn(),
}));

vi.mock("@server/repositories/game-story-repository.server", () => ({
  findAccessibleGameStoryPhotoObjectKey: vi.fn(),
  findEditableGameStoryPost: mocked.findEditableGameStoryPost,
  findOwnGameStoryPost: vi.fn(),
  listPublishedGameStoryPosts: vi.fn(),
  saveFinalizedGameStoryRecord: mocked.saveFinalizedGameStoryRecord,
  softDeleteGameStoryPost: mocked.softDeleteGameStoryPost,
}));
vi.mock("@server/storage/game-photo-storage.server", () => ({
  deleteGamePhoto: mocked.deleteGamePhoto,
  getGamePhoto: vi.fn(),
  putGamePhoto: mocked.putGamePhoto,
}));
vi.mock("@domain/highlight/validate-game-highlight", () => ({
  validateGamePhotoBytes: mocked.validateGamePhotoBytes,
}));

import {
  deleteGameStoryPostAsOrganizer,
  saveFinalizedGameStory,
} from "@server/services/game-story-service.server";

const groupId = "11111111-1111-4111-8111-111111111111";
const gameId = "22222222-2222-4222-8222-222222222222";
const target = {
  kind: "group-player-id" as const,
  value: "33333333-3333-4333-8333-333333333333",
};
const current = {
  body: "前の投稿",
  id: "44444444-4444-4444-8444-444444444444",
  participantId: "55555555-5555-4555-8555-555555555555",
  photoByteSize: 1_024,
  photoContentType: "image/webp" as const,
  photoObjectKey: "groups/group/games/game/stories/old.webp",
  photoUploadedAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.findEditableGameStoryPost.mockResolvedValue(current);
  mocked.saveFinalizedGameStoryRecord.mockResolvedValue(true);
  mocked.validateGamePhotoBytes.mockReturnValue({
    contentType: "image/webp",
    ok: true,
  });
});

describe("game story service", () => {
  it("主催者削除ではDBを非公開化してから写真を削除する", async () => {
    mocked.softDeleteGameStoryPost.mockResolvedValue({
      deleted: true,
      photoObjectKey: current.photoObjectKey,
    });

    const deleted = await deleteGameStoryPostAsOrganizer(
      groupId,
      gameId,
      current.id,
    );

    expect(deleted).toBe(true);
    expect(mocked.softDeleteGameStoryPost).toHaveBeenCalledWith(
      groupId,
      gameId,
      current.id,
    );
    expect(mocked.deleteGamePhoto).toHaveBeenCalledWith(
      current.photoObjectKey,
    );
  });

  it("確定後の投稿はfinalized参加者だけを対象にして結果を変更しない", async () => {
    const result = await saveFinalizedGameStory(groupId, gameId, {
      body: "あとから投稿",
      photo: null,
      removePhoto: false,
      target,
    });

    expect(result).toEqual({ ok: true });
    expect(mocked.findEditableGameStoryPost).toHaveBeenCalledWith(
      groupId,
      gameId,
      target,
    );
    expect(mocked.saveFinalizedGameStoryRecord).toHaveBeenCalledWith(
      groupId,
      gameId,
      expect.objectContaining({ body: "あとから投稿", target }),
    );
  });
});
