import {
  ALLOWED_GAME_PHOTO_TYPES,
  calculateScaledPhotoSize,
  GAME_PHOTO_MAX_BYTES,
  isAllowedGamePhotoType,
} from "@domain/highlight/validate-game-highlight";

const RAW_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const TARGET_LONG_EDGES = [1800, 1600, 1400] as const;
const WEBP_QUALITIES = [0.82, 0.74, 0.66] as const;

export async function compressGamePhoto(file: File): Promise<File> {
  if (!isAllowedGamePhotoType(file.type)) {
    throw new Error("JPEG・PNG・WebPの写真を選択してください。");
  }
  if (file.size < 1 || file.size > RAW_PHOTO_MAX_BYTES) {
    throw new Error("元の写真は25MB以内にしてください。");
  }

  const image = await loadImage(file);
  try {
    for (const maxLongEdge of TARGET_LONG_EDGES) {
      const dimensions = calculateScaledPhotoSize(
        image.width,
        image.height,
        maxLongEdge,
      );
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("写真を縮小できませんでした。");
      context.drawImage(image.source, 0, 0, dimensions.width, dimensions.height);

      for (const quality of WEBP_QUALITIES) {
        const blob = await canvasToWebp(canvas, quality);
        if (blob.size <= GAME_PHOTO_MAX_BYTES) {
          return new File([blob], buildWebpName(file.name), {
            lastModified: Date.now(),
            type: "image/webp",
          });
        }
      }
    }
  } finally {
    image.dispose();
  }
  throw new Error("3MB以内に圧縮できませんでした。別の写真を選択してください。");
}

export function canCompressGamePhotoType(type: string): boolean {
  return (ALLOWED_GAME_PHOTO_TYPES as readonly string[]).includes(type);
}

async function loadImage(file: File): Promise<{
  dispose: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      dispose: () => bitmap.close(),
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("写真を読み込めませんでした。");
  }
  return {
    dispose: () => URL.revokeObjectURL(objectUrl),
    height: image.naturalHeight,
    source: image,
    width: image.naturalWidth,
  };
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("このブラウザではWebPへ変換できません。"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

function buildWebpName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]*$/u, "").trim();
  return `${baseName || "game-photo"}.webp`;
}
