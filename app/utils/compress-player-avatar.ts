import {
  ALLOWED_GAME_PHOTO_TYPES,
  isAllowedGamePhotoType,
} from "@domain/highlight/validate-game-highlight";
import {
  PLAYER_AVATAR_MAX_BYTES,
  PLAYER_AVATAR_SIZE,
} from "@domain/player-profile/validate-player-profile";
import { encodeCanvasImage } from "./canvas-image-encoding";

const RAW_AVATAR_MAX_BYTES = 15 * 1024 * 1024;
const WEBP_QUALITIES = [0.84, 0.74, 0.64] as const;

export async function compressPlayerAvatar(file: File): Promise<File> {
  if (!isAllowedGamePhotoType(file.type)) {
    throw new Error("JPEG・PNG・WebPの画像を選択してください。");
  }
  if (file.size < 1 || file.size > RAW_AVATAR_MAX_BYTES) {
    throw new Error("元の画像は15MB以内にしてください。");
  }

  const image = await loadImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = PLAYER_AVATAR_SIZE;
    canvas.height = PLAYER_AVATAR_SIZE;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("アイコンを縮小できませんでした。");
    context.fillStyle = "#10271f";
    context.fillRect(0, 0, PLAYER_AVATAR_SIZE, PLAYER_AVATAR_SIZE);

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;
    context.drawImage(
      image.source,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      PLAYER_AVATAR_SIZE,
      PLAYER_AVATAR_SIZE,
    );

    for (const quality of WEBP_QUALITIES) {
      const blob = await encodeCanvasImage(canvas, quality);
      if (blob.size <= PLAYER_AVATAR_MAX_BYTES) {
        return new File(
          [blob],
          blob.type === "image/webp" ? "player-avatar.webp" : "player-avatar.jpg",
          { lastModified: Date.now(), type: blob.type },
        );
      }
    }
  } finally {
    image.dispose();
  }
  throw new Error("1MB以内に圧縮できませんでした。別の画像を選択してください。");
}

export function canCompressPlayerAvatarType(type: string): boolean {
  return (ALLOWED_GAME_PHOTO_TYPES as readonly string[]).includes(type);
}

async function loadImage(file: File): Promise<{
  dispose: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        dispose: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
      };
    } catch {
      // Fall back for Safari versions with partial createImageBitmap support.
    }
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("画像を読み込めませんでした。");
  }
  return {
    dispose: () => URL.revokeObjectURL(objectUrl),
    height: image.naturalHeight,
    source: image,
    width: image.naturalWidth,
  };
}
