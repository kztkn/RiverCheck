import { describe, expect, it } from "vitest";
import { encodeCanvasImage } from "./canvas-image-encoding";

describe("encodeCanvasImage", () => {
  it("WebP変換に対応していればWebPを使う", async () => {
    const requestedTypes: string[] = [];
    const canvas = fakeCanvas((callback, type) => {
      requestedTypes.push(type);
      callback(new Blob(["webp"], { type: "image/webp" }));
    });

    const result = await encodeCanvasImage(canvas, 0.82);

    expect(result.type).toBe("image/webp");
    expect(requestedTypes).toEqual(["image/webp"]);
  });

  it("Safari等でWebPを返さない場合はJPEGへフォールバックする", async () => {
    const requestedTypes: string[] = [];
    const canvas = fakeCanvas((callback, type) => {
      requestedTypes.push(type);
      callback(
        new Blob([type], {
          type: type === "image/webp" ? "image/png" : "image/jpeg",
        }),
      );
    });

    const result = await encodeCanvasImage(canvas, 0.82);

    expect(result.type).toBe("image/jpeg");
    expect(requestedTypes).toEqual(["image/webp", "image/jpeg"]);
  });

  it("WebPもJPEGも生成できない場合は案内付きで失敗する", async () => {
    const canvas = fakeCanvas((callback) => callback(null));
    await expect(encodeCanvasImage(canvas, 0.82)).rejects.toThrow(
      "このブラウザでは画像を圧縮できません。",
    );
  });
});

function fakeCanvas(
  toBlob: (
    callback: BlobCallback,
    type: string,
    quality?: number,
  ) => void,
): Pick<HTMLCanvasElement, "toBlob"> {
  return { toBlob } as Pick<HTMLCanvasElement, "toBlob">;
}
