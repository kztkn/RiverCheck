import {
  findGameHighlightRecord,
  saveGameHighlightRecord,
  type GameHighlightRecord,
} from "@server/repositories/game-highlight-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  getGamePhoto,
  putGamePhoto,
  type StoredGamePhoto,
} from "@server/storage/game-photo-storage.server";
import {
  validateGamePhotoBytes,
  validateHighlightText,
  type GamePhotoContentType,
} from "@domain/highlight/validate-game-highlight";
import type { GameHighlight } from "@shared-types/highlight";

export interface SaveGameHighlightInput {
  photo: File | null;
  removePhoto: boolean;
  text: string;
}

export type SaveGameHighlightResult =
  | { ok: true }
  | { ok: false; error: string };

export async function getGameHighlight(
  groupId: string,
  gameId: string,
): Promise<GameHighlight | null> {
  const record = await findGameHighlightRecord(groupId, gameId);
  return record ? toHighlight(record) : null;
}

export function buildGamePhotoUrl(input: {
  gameId: string;
  groupCode: string;
  highlight: GameHighlight | null;
}): string | null {
  const uploadedAt = input.highlight?.photo?.uploadedAt;
  return uploadedAt
    ? `/g/${input.groupCode}/games/${input.gameId}/photo?v=${encodeURIComponent(uploadedAt)}`
    : null;
}

export async function saveGameHighlight(
  groupId: string,
  gameId: string,
  input: SaveGameHighlightInput,
): Promise<SaveGameHighlightResult> {
  const textValidation = validateHighlightText(input.text);
  if (!textValidation.ok) return textValidation;

  const current = await findGameHighlightRecord(groupId, gameId);
  if (!current) return { ok: false, error: "開催が見つかりません。" };
  if (current.gameStatus !== "finalized") {
    return { ok: false, error: "確定後の開催だけハイライトを編集できます。" };
  }

  let uploadedPhoto: StoredGamePhoto | null = null;
  if (input.photo) {
    const bytes = await input.photo.arrayBuffer();
    const photoValidation = validateGamePhotoBytes({
      bytes: new Uint8Array(bytes),
      contentType: input.photo.type,
      size: input.photo.size,
    });
    if (!photoValidation.ok) return photoValidation;

    const objectKey = buildPhotoObjectKey(
      groupId,
      gameId,
      photoValidation.contentType,
    );
    try {
      uploadedPhoto = await putGamePhoto({
        bytes,
        contentType: photoValidation.contentType,
        gameId,
        groupId,
        objectKey,
      });
    } catch (error) {
      console.error("Failed to upload game photo", error);
      return {
        ok: false,
        error: "写真を保存できませんでした。R2設定を確認して再度お試しください。",
      };
    }
  }

  const removeCurrentPhoto = input.removePhoto || uploadedPhoto !== null;
  const nextPhoto = uploadedPhoto ?? (removeCurrentPhoto ? null : currentPhoto(current));
  const saved = await saveGameHighlightRecord(groupId, gameId, {
    text: textValidation.text,
    photoObjectKey: nextPhoto?.objectKey ?? null,
    photoContentType: nextPhoto?.contentType ?? null,
    photoByteSize: nextPhoto?.byteSize ?? null,
    photoUploadedAt: nextPhoto?.uploadedAt ?? null,
    expectedPhotoObjectKey: current.photoObjectKey,
  });

  if (!saved) {
    return {
      ok: false,
      error: "別の画面で写真が更新されました。画面を更新してもう一度お試しください。",
    };
  }

  return { ok: true };
}

export async function getGamePhotoForDelivery(
  groupCode: string,
  gameId: string,
): Promise<{ object: R2ObjectBody; contentType: string } | null> {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) return null;
  const record = await findGameHighlightRecord(group.id, gameId);
  if (!record?.photoObjectKey || !record.photoContentType) return null;
  const object = await getGamePhoto(record.photoObjectKey);
  return object ? { object, contentType: record.photoContentType } : null;
}

function toHighlight(record: GameHighlightRecord): GameHighlight {
  const photo =
    record.photoContentType &&
    record.photoByteSize !== null &&
    record.photoUploadedAt
      ? {
          byteSize: record.photoByteSize,
          contentType: record.photoContentType,
          uploadedAt: record.photoUploadedAt,
        }
      : null;
  return {
    text: record.text,
    photo,
    updatedAt: record.updatedAt,
  };
}

function currentPhoto(record: GameHighlightRecord): StoredGamePhoto | null {
  if (
    !record.photoObjectKey ||
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

function buildPhotoObjectKey(
  groupId: string,
  gameId: string,
  contentType: GamePhotoContentType,
): string {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `groups/${groupId}/games/${gameId}/${crypto.randomUUID()}.${extension}`;
}
