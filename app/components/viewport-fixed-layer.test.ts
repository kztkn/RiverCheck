import { describe, expect, it } from "vitest";
import {
  positionViewportLayer,
  readViewportLayerMetrics,
} from "./viewport-fixed-layer";

describe("viewport fixed layer", () => {
  it("uses visual viewport document coordinates while scrolling", () => {
    const metrics = readViewportLayerMetrics({
      innerHeight: 844,
      innerWidth: 390,
      scrollX: 0,
      scrollY: 620,
      visualViewport: {
        height: 760,
        pageLeft: 0,
        pageTop: 664,
        width: 390,
      },
    } as unknown as Window);

    expect(metrics).toEqual({
      height: 760,
      pageLeft: 0,
      pageTop: 664,
      width: 390,
    });
  });

  it("falls back to the window viewport when VisualViewport is unavailable", () => {
    const metrics = readViewportLayerMetrics({
      innerHeight: 844,
      innerWidth: 390,
      scrollX: 12,
      scrollY: 620,
      visualViewport: null,
    } as unknown as Window);

    expect(metrics).toEqual({
      height: 844,
      pageLeft: 12,
      pageTop: 620,
      width: 390,
    });
  });

  it("positions the layer over the currently visible document area", () => {
    const style = {} as CSSStyleDeclaration;
    positionViewportLayer(
      { style } as HTMLElement,
      { height: 760, pageLeft: 4, pageTop: 664, width: 390 },
    );

    expect(style.width).toBe("390px");
    expect(style.height).toBe("760px");
    expect(style.transform).toBe("translate3d(4px, 664px, 0)");
  });
});
