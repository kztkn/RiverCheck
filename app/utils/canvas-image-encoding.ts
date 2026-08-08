export type CanvasEncodedImageType = "image/webp" | "image/jpeg";

export async function encodeCanvasImage(
  canvas: Pick<HTMLCanvasElement, "toBlob">,
  quality: number,
): Promise<Blob> {
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") return webp;

  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg?.type === "image/jpeg") return jpeg;

  throw new Error(
    "このブラウザでは画像を圧縮できません。別の画像を選択してください。",
  );
}

function canvasToBlob(
  canvas: Pick<HTMLCanvasElement, "toBlob">,
  type: CanvasEncodedImageType,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
