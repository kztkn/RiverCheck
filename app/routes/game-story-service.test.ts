import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  deleteGamePhoto: vi.fn(),
  findEditableGameStoryPost: vi.fn(),
  putGamePhoto: vi.fn(),
  saveFinalizedGameStoryRecord: vi.fn(),
  saveParticipantCompletionRecord: vi.fn(),
  softDeleteGameStoryPost: vi.fn(),
  validateGamePhotoBytes: vi.fn(),
}));

vi.mock("@server/repositories/game-story-repository.server", () => ({
  findAccessibleGameStoryPhotoObjectKey: vi.fn(),
  findEditableGameStoryPost: mocked.findEditableGameStoryPost,
  findOwnGameStoryPost: vi.fn(),
  listPublishedGameStoryPosts: vi.fn(),
  saveParticipantCompletionRecord: mocked.saveParticipantCompletionRecord,
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
  saveParticipantCompletion,
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
  mocked.saveParticipantCompletionRecord.mockResolvedValue(true);
  mocked.validateGamePhotoBytes.mockReturnValue({
    contentType: "image/webp",
    ok: true,
  });
});

describe("game story service", () => {
  it("本文を整形し、既存写真を維持して終了時入力と一緒に保存する", async () => {
    const result = await saveParticipantCompletion(groupId, gameId, {
      body: "  今日のひとこと  ",
      photo: null,
      removePhoto: false,
      remainingChips: 25_000,
      settlementRebuyCount: 1,
      target,
    });

    expect(result).toEqual({ ok: true });
    expect(mocked.saveParticipantCompletionRecord).toHaveBeenCalledWith(
      groupId,
      gameId,
      expect.objectContaining({
        body: "今日のひとこと",
        expectedPhotoObjectKey: current.photoObjectKey,
        photoObjectKey: current.photoObjectKey,
        remainingChips: 25_000,
        settlementRebuyCount: 1,
        target,
      }),
    );
    expect(mocked.deleteGamePhoto).not.toHaveBeenCalled();
  });

  it("DB競合時は先に保存した未参照写真を削除する", async () => {
    const uploaded = {
      byteSize: 2_048,
      contentType: "image/webp" as const,
      etag: "etag",
      objectKey: "groups/group/games/game/stories/new.webp",
      uploadedAt: "2026-08-23T00:00:00.000Z",
    };
    mocked.putGamePhoto.mockResolvedValue(uploaded);
    mocked.saveParticipantCompletionRecord.mockResolvedValue(false);

    const result = await saveParticipantCompletion(groupId, gameId, {
      body: "写真を更新",
      photo: new File([new Uint8Array([1, 2, 3])], "story.webp", {
        type: "image/webp",
      }),
      removePhoto: false,
      remainingChips: 25_000,
      settlementRebuyCount: 1,
      target,
    });

    expect(result.ok).toBe(false);
    expect(mocked.deleteGamePhoto).toHaveBeenCalledWith(uploaded.objectKey);
    expect(mocked.deleteGamePhoto).not.toHaveBeenCalledWith(
      current.photoObjectKey,
    );
  });

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
      "finalized",
    );
    expect(mocked.saveFinalizedGameStoryRecord).toHaveBeenCalledWith(
      groupId,
      gameId,
      expect.objectContaining({ body: "あとから投稿", target }),
    );
    expect(mocked.saveParticipantCompletionRecord).not.toHaveBeenCalled();
  });
});
