import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TableManagement, TableManagementBoard } from "./table-management";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { TableManagementPanel } from "@shared-types/table-management";

const panel: TableManagementPanel = {
  startedAt: "2026-10-01T11:00:00Z", serverNow: "2026-10-01T12:00:00Z", canManage: true,
  participants: [
    { groupPlayerId: "a", displayName: "かずと", table: "MAIN", subEnteredAt: null },
    { groupPlayerId: "c", displayName: "ひろ", table: "SUB", subEnteredAt: "2026-10-01T11:29:00Z" },
    { groupPlayerId: "b", displayName: "岩田", table: "SUB", subEnteredAt: "2026-10-01T11:18:00Z" },
  ], moves: [{ id: "move", displayName: "岩田", fromTable: "MAIN", toTable: "SUB", recordedAt: "2026-10-01T11:18:00Z" }],
};
function render(canManage: boolean, disabled = false) {
  return renderToStaticMarkup(createElement(TableManagementBoard, { panel: { ...panel, canManage }, now: Date.parse(panel.serverNow), disabled, highlightId: null, onMove: () => {} }));
}
describe("卓管理UI", () => {
  it("候補と滞在順、履歴、明示的な移動操作を表示する", () => {
    const markup = render(true);
    expect(markup).toContain("次のメイン候補");
    expect(markup).toContain("サブ滞在 42分");
    expect(markup).toContain("メインへ移動");
    expect(markup).toContain('aria-label="かずとをサブへ移動"');
    expect(markup).toContain('aria-label="岩田をメインへ移動"');
    expect(markup.indexOf('aria-label="岩田をメインへ移動"')).toBeLessThan(markup.indexOf('aria-label="ひろをメインへ移動"'));
    expect(markup).toContain("20:18");
    expect(markup).toContain("MAIN → SUB");
    expect(render(true, true)).toContain('disabled=""');
  });
  it("閲覧専用では移動ボタンを一切表示しない", () => {
    const markup = render(false);
    expect(markup).toContain("岩田");
    expect(markup).toContain("42分");
    expect(markup).not.toContain("<button");
  });
  it("OFF開催の一般参加者には入口もシートも出さない", () => {
    const router = createMemoryRouter([{ path: "/", element: createElement(TableManagement, { manager: false, started: false, resourcePath: "/tables" }) }]);
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    expect(markup).not.toContain("卓管理");
  });
});
