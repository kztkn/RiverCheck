import { env } from "cloudflare:workers";
import type { GamePhotoContentType } from "@domain/highlight/validate-game-highlight";

interface PlayerAvatarStorageEnv {
  GAME_PHOTOS?: R2Bucket;
}

export interface StoredPlayerAvatar {
  byteSize: number;
  contentType: GamePhotoContentType;
  objectKey: string;
  uploadedAt: string;
}

export async function putPlayerAvatar(input: {
  bytes: ArrayBuffer;
  contentType: GamePhotoContentType;
  objectKey: string;
  playerId: string;
}): Promise<StoredPlayerAvatar> {
  const object = await requireMediaBucket().put(input.objectKey, input.bytes, {
    httpMetadata: {
      cacheControl: "public, max-age=31536000, immutable",
      contentType: input.contentType,
    },
    customMetadata: { playerId: input.playerId },
  });
  if (!object) throw new Error("R2 did not return the uploaded avatar object");
  return {
    byteSize: object.size,
    contentType: input.contentType,
    objectKey: object.key,
    uploadedAt: object.uploaded.toISOString(),
  };
}

export async function getPlayerAvatar(
  objectKey: string,
): Promise<R2ObjectBody | null> {
  return requireMediaBucket().get(objectKey);
}

function requireMediaBucket(): R2Bucket {
  const bucket = (env as PlayerAvatarStorageEnv).GAME_PHOTOS;
  if (!bucket) throw new Error("GAME_PHOTOS R2 binding is required");
  return bucket;
}
