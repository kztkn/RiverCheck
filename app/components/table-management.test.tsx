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
function render(canManage: boolean, disabled = false, profiles = false) {
  return renderToStaticMarkup(createElement(TableManagementBoard, { panel: { ...panel, canManage }, now: Date.parse(panel.serverNow), disabled, highlightId: null, onMove: () => {}, onPlayerClick: profiles ? () => {} : undefined }));
}
describe("卓管理UI", () => {
  it("候補と滞在順、履歴、明示的な移動操作を表示する", () => {
    const markup = render(true);
    expect(markup).toContain("次のメイン候補");
    expect(markup).toContain("42分");
    expect(markup).toContain('class="is-next-candidate" aria-label="次のメイン候補"');
    expect(markup).not.toContain("table-next-candidate");
    expect(markup.match(/is-next-candidate/g)).toHaveLength(1);
    expect(markup).toContain("メインへ移動");
    expect(markup).toContain('aria-label="かずとをサブへ移動"');
    expect(markup).toContain('aria-label="岩田をメインへ移動"');
    expect(markup).toContain('class="table-seat-section is-main-table"');
    expect(markup).toContain('class="table-seat-section is-sub-table"');
    expect(markup.indexOf('aria-label="岩田をメインへ移動"')).toBeLessThan(markup.indexOf('aria-label="ひろをメインへ移動"'));
    expect(markup).toContain("20:18");
    expect(markup).toContain("メイン → サブ");
    expect(markup).toContain("移動の履歴");
    expect(markup).not.toContain("メイン卓");
    expect(markup).not.toContain("サブ卓");
    expect(markup).not.toContain("MAIN → SUB");
    expect(markup).not.toContain("サブへ</small>");
    expect(render(true, true)).toContain('disabled=""');
  });
  it("閲覧専用では移動ボタンを一切表示しない", () => {
    const markup = render(false);
    expect(markup).toContain("岩田");
    expect(markup).toContain("42分");
    expect(markup).not.toContain("<button");
  });
  it("候補がメインへ移ると残るサブの先頭だけを強調し、サブ0人なら候補を残さない", () => {
    const participants = panel.participants.map((seat) => seat.groupPlayerId === "b" ? { ...seat, table: "MAIN" as const, subEnteredAt: null } : seat);
    const board = (seats: typeof participants) => renderToStaticMarkup(createElement(TableManagementBoard, { panel: { ...panel, participants: seats }, now: Date.parse(panel.serverNow), disabled: false, highlightId: null, onMove: () => {} }));
    const markup = board(participants);
    expect(markup).toContain('aria-label="次のメイン候補"><div class="table-seat-row"><strong>ひろ</strong>');
    expect(markup.match(/is-next-candidate/g)).toHaveLength(1);
    expect(board(participants.map((seat) => ({ ...seat, table: "MAIN", subEnteredAt: null })))).not.toContain("次のメイン候補");
  });
  it("一般参加者もプロフィールを開けるが卓移動操作は出さない", () => {
    const markup = render(false, false, true);
    expect(markup).toContain('aria-label="岩田のプロフィールを見る"');
    expect(markup).not.toContain("岩田をメインへ移動");
    expect(markup).not.toContain("メインへ移動</button>");
    const manager = render(true, false, true);
    expect(manager).toContain('aria-label="岩田のプロフィールを見る"');
    expect(manager).toContain('aria-label="岩田をメインへ移動"');
    expect(manager).toContain("table-seat-move");
  });
  it("OFF開催の一般参加者には入口もシートも出さない", () => {
    const router = createMemoryRouter([{ path: "/", element: createElement(TableManagement, { manager: false, started: false, resourcePath: "/tables" }) }]);
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    expect(markup).not.toContain("テーブル管理");
  });
});
