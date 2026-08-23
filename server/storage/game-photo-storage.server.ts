import { env } from "cloudflare:workers";
import type { GamePhotoContentType } from "@domain/highlight/validate-game-highlight";

interface GamePhotoStorageEnv {
  GAME_PHOTOS?: R2Bucket;
}

export interface StoredGamePhoto {
  byteSize: number;
  contentType: GamePhotoContentType;
  etag: string;
  objectKey: string;
  uploadedAt: string;
}

export async function putGamePhoto(input: {
  bytes: ArrayBuffer;
  contentType: GamePhotoContentType;
  gameId: string;
  groupId: string;
  objectKey: string;
}): Promise<StoredGamePhoto> {
  const object = await requireGamePhotosBucket().put(
    input.objectKey,
    input.bytes,
    {
      httpMetadata: {
        cacheControl: "public, max-age=31536000, immutable",
        contentType: input.contentType,
      },
      customMetadata: {
        gameId: input.gameId,
        groupId: input.groupId,
      },
    },
  );
  if (!object) throw new Error("R2 did not return the uploaded object");
  return {
    byteSize: object.size,
    contentType: input.contentType,
    etag: object.httpEtag,
    objectKey: object.key,
    uploadedAt: object.uploaded.toISOString(),
  };
}

export async function getGamePhoto(
  objectKey: string,
): Promise<R2ObjectBody | null> {
  return requireGamePhotosBucket().get(objectKey);
}

export async function deleteGamePhoto(objectKey: string): Promise<void> {
  await requireGamePhotosBucket().delete(objectKey);
}

function requireGamePhotosBucket(): R2Bucket {
  const bucket = (env as GamePhotoStorageEnv).GAME_PHOTOS;
  if (!bucket) throw new Error("GAME_PHOTOS R2 binding is required");
  return bucket;
}
