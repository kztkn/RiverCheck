import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChipBlindTool, chipCountAssessment } from "./chip-blind-tool";

describe("ChipBlindTool", () => {
  it("保存しない独立ツールとして人数と額面・総枚数を入力できる", () => {
    const markup = renderToStaticMarkup(createElement(ChipBlindTool));

    expect(markup).toContain("チップ・ブラインド計算");
    expect(markup).toContain("保存なし");
    expect(markup).toContain('aria-label="参加人数"');
    expect(markup).toContain('value="8"');
    expect(markup).toContain('aria-label="チップ額面1"');
    expect(markup).toContain('value="5000"');
    expect(markup).toContain('aria-label="チップ枚数1"');
    expect(markup).toContain("おすすめを計算");
    expect(markup).toContain("ブラウザにも保存しません");
  });

  it("1人あたりの枚数を実用域として段階表示する", () => {
    expect(chipCountAssessment(25)).toBe("扱いやすい枚数");
    expect(chipCountAssessment(33)).toBe("やや多め・両替しやすさ優先");
    expect(chipCountAssessment(38)).toBe("多め・在庫制約を優先");
  });
});
