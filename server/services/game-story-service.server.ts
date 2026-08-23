import {
  findAccessibleGameStoryPhotoObjectKey,
  findEditableGameStoryPost,
  findOwnGameStoryPost,
  listPublishedGameStoryPosts,
  saveFinalizedGameStoryRecord,
  saveParticipantCompletionRecord,
  softDeleteGameStoryPost,
  type GameStoryParticipantTarget,
} from "@server/repositories/game-story-repository.server";
import {
  deleteGamePhoto,
  getGamePhoto,
  putGamePhoto,
  type StoredGamePhoto,
} from "@server/storage/game-photo-storage.server";
import {
  validateGamePhotoBytes,
  type GamePhotoContentType,
} from "@domain/highlight/validate-game-highlight";
import { validateGameStoryBody } from "@domain/story/validate-game-story";
import type {
  OwnGameStoryPost,
  PublishedGameStoryPost,
} from "@shared-types/game-story";

export interface SaveParticipantCompletionInput {
  body: string;
  photo: File | null;
  removePhoto: boolean;
  remainingChips: number;
  settlementRebuyCount: number;
  target: GameStoryParticipantTarget;
}

export type SaveFinalizedGameStoryInput = Omit<
  SaveParticipantCompletionInput,
  "remainingChips" | "settlementRebuyCount"
>;

export type SaveParticipantCompletionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function getOwnGameStoryPost(
  groupId: string,
  gameId: string,
  participantId: string,
): Promise<OwnGameStoryPost | null> {
  return findOwnGameStoryPost(groupId, gameId, participantId);
}

export async function getPublishedGameStoryPosts(
  groupId: string,
  gameId: string,
): Promise<PublishedGameStoryPost[]> {
  return listPublishedGameStoryPosts(groupId, gameId);
}

export function buildGameStoryPhotoUrl(input: {
  gameId: string;
  groupCode: string;
  post: OwnGameStoryPost;
}): string | null {
  return input.post.photo
    ? `/g/${input.groupCode}/games/${input.gameId}/stories/${input.post.id}/photo?v=${encodeURIComponent(input.post.photo.uploadedAt)}`
    : null;
}

export async function saveParticipantCompletion(
  groupId: string,
  gameId: string,
  input: SaveParticipantCompletionInput,
): Promise<SaveParticipantCompletionResult> {
  return saveGameStoryWithPhoto(groupId, gameId, input, "open", (story) =>
    saveParticipantCompletionRecord(groupId, gameId, {
      ...story,
      remainingChips: input.remainingChips,
      settlementRebuyCount: input.settlementRebuyCount,
      target: input.target,
    }),
  );
}

export async function saveFinalizedGameStory(
  groupId: string,
  gameId: string,
  input: SaveFinalizedGameStoryInput,
): Promise<SaveParticipantCompletionResult> {
  return saveGameStoryWithPhoto(
    groupId,
    gameId,
    input,
    "finalized",
    (story) =>
      saveFinalizedGameStoryRecord(groupId, gameId, {
        ...story,
        target: input.target,
      }),
  );
}

async function saveGameStoryWithPhoto(
  groupId: string,
  gameId: string,
  input: SaveFinalizedGameStoryInput,
  gameStatus: "open" | "finalized",
  saveRecord: (story: {
    body: string | null;
    expectedPhotoObjectKey: string | null;
    photoByteSize: number | null;
    photoContentType: GamePhotoContentType | null;
    photoObjectKey: string | null;
    photoUploadedAt: string | null;
  }) => Promise<boolean>,
): Promise<SaveParticipantCompletionResult> {
  const bodyValidation = validateGameStoryBody(input.body);
  if (!bodyValidation.ok) return bodyValidation;

  const current = await findEditableGameStoryPost(
    groupId,
    gameId,
    input.target,
    gameStatus,
  );
  if (!current) {
    return { ok: false, error: "参加状態を確認できませんでした。" };
  }

  let uploadedPhoto: StoredGamePhoto | null = null;
  if (input.photo) {
    const bytes = await input.photo.arrayBuffer();
    const validation = validateGamePhotoBytes({
      bytes: new Uint8Array(bytes),
      contentType: input.photo.type,
      size: input.photo.size,
    });
    if (!validation.ok) return validation;
    try {
      uploadedPhoto = await putGamePhoto({
        bytes,
        contentType: validation.contentType,
        gameId,
        groupId,
        objectKey: buildStoryPhotoObjectKey(
          groupId,
          gameId,
          validation.contentType,
        ),
      });
    } catch (error) {
      console.error("Failed to upload game story photo", error);
      return {
        ok: false,
        error: "写真を保存できませんでした。時間をおいて再度お試しください。",
      };
    }
  }

  const replaceCurrentPhoto = input.removePhoto || uploadedPhoto !== null;
  const nextPhoto = uploadedPhoto ??
    (replaceCurrentPhoto ? null : currentPhoto(current));
  const saved = await saveRecord({
    body: bodyValidation.body,
    expectedPhotoObjectKey: current.photoObjectKey,
    photoObjectKey: nextPhoto?.objectKey ?? null,
    photoContentType: nextPhoto?.contentType ?? null,
    photoByteSize: nextPhoto?.byteSize ?? null,
    photoUploadedAt: nextPhoto?.uploadedAt ?? null,
  });

  if (!saved) {
    if (uploadedPhoto) await deletePhotoBestEffort(uploadedPhoto.objectKey);
    return {
      ok: false,
      error: "別の画面で入力が更新されました。画面を更新して再度お試しください。",
    };
  }

  if (
    current.photoObjectKey &&
    current.photoObjectKey !== nextPhoto?.objectKey
  ) {
    await deletePhotoBestEffort(current.photoObjectKey);
  }
  return { ok: true };
}

export async function deleteGameStoryPostAsOrganizer(
  groupId: string,
  gameId: string,
  postId: string,
): Promise<boolean> {
  const result = await softDeleteGameStoryPost(groupId, gameId, postId);
  if (!result.deleted) return false;
  if (result.photoObjectKey) {
    await deletePhotoBestEffort(result.photoObjectKey);
  }
  return true;
}

export async function getGameStoryPhotoForDelivery(
  groupId: string,
  gameId: string,
  postId: string,
  access: {
    groupPlayerId: string | null;
    organizer: boolean;
    participantTokenHash: string | null;
  },
): Promise<{ object: R2ObjectBody; contentType: string } | null> {
  const record = await findAccessibleGameStoryPhotoObjectKey(
    groupId,
    gameId,
    postId,
    access,
  );
  if (!record) return null;
  const object = await getGamePhoto(record.objectKey);
  return object ? { object, contentType: record.contentType } : null;
}

function currentPhoto(
  record: Awaited<ReturnType<typeof findEditableGameStoryPost>>,
): StoredGamePhoto | null {
  if (
    !record?.photoObjectKey ||
    !record.photoContentType ||
    record.photoByteSize === null ||
    !record.photoUploadedAt
  ) {
    return null;
  }
  return {
    byteSize: record.photoByteSize,
    contentType: record.photoContentType,
    etag: "",
    objectKey: record.photoObjectKey,
    uploadedAt: record.photoUploadedAt,
  };
}

function buildStoryPhotoObjectKey(
  groupId: string,
  gameId: string,
  contentType: GamePhotoContentType,
): string {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `groups/${groupId}/games/${gameId}/stories/${crypto.randomUUID()}.${extension}`;
}

async function deletePhotoBestEffort(objectKey: string): Promise<void> {
  try {
    await deleteGamePhoto(objectKey);
  } catch (error) {
    console.error("Failed to delete unreferenced game story photo", error);
  }
}
