import { it, expect, vi } from "vitest";
import {
  StoryReactionController,
  type ReactionState,
  type ReactionStore,
} from "./story-reaction-controller";
function setup() {
  const requests: Array<{
    active: boolean;
    resolve: (s: ReactionState) => void;
    reject: () => void;
  }> = [];
  let store: ReactionStore = {};
  let pending = new Set<string>();
  const save = vi.fn(
    (_post: string, _type: string, active: boolean) =>
      new Promise<ReactionState>((resolve, reject) =>
        requests.push({
          active,
          resolve,
          reject: () => reject(new Error("offline")),
        }),
      ),
  );
  const error = vi.fn();
  const change = vi.fn((next: ReactionStore, keys: Set<string>) => {
    store = next;
    pending = keys;
  });
  const controller = new StoryReactionController({}, save, change, error);
  return {
    controller,
    requests,
    save,
    error,
    change,
    state: () => store,
    pending: () => pending,
  };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
it("遅い通信中も選択・解除が即時に反映され、同じスタンプは順番に保存する", async () => {
  const t = setup();
  t.controller.toggle("p", "nice");
  expect(t.state().p.nice).toEqual({ active: true, count: 1 });
  t.controller.toggle("p", "nice");
  expect(t.state().p.nice).toEqual({ active: false, count: 0 });
  expect(t.save).toHaveBeenCalledTimes(1);
  t.requests[0].resolve({ active: true, count: 4 });
  await flush();
  expect(t.state().p.nice?.active).toBe(false);
  expect(t.requests[1].active).toBe(false);
  t.requests[1].resolve({ active: false, count: 3 });
  await flush();
  expect(t.state().p.nice).toEqual({ active: false, count: 3 });
  expect(t.pending().size).toBe(0);
});
it("短時間の3回タップは最後の選択へまとめ、二重加算しない", async () => {
  const t = setup();
  for (let i = 0; i < 3; i++) t.controller.toggle("p", "fire");
  expect(t.state().p.fire).toEqual({ active: true, count: 1 });
  t.requests[0].resolve({ active: true, count: 1 });
  await flush();
  expect(t.save).toHaveBeenCalledTimes(1);
});
it("違うスタンプと投稿は並行して保存し、お互いの表示を上書きしない", async () => {
  const t = setup();
  t.controller.toggle("p", "fire");
  t.controller.toggle("p", "nice");
  t.controller.toggle("q", "fire");
  expect(t.save).toHaveBeenCalledTimes(3);
  t.requests[1].resolve({ active: true, count: 5 });
  await flush();
  expect(t.state().p.fire?.active).toBe(true);
  expect(t.state().q.fire?.active).toBe(true);
  expect(t.pending().size).toBe(2);
});
it("保存失敗時は最後に保存できた状態へ戻し、再試行できる", async () => {
  const t = setup();
  t.controller.toggle("p", "nice");
  t.controller.toggle("p", "nice");
  t.requests[0].resolve({ active: true, count: 2 });
  await flush();
  t.requests[1].reject();
  await flush();
  expect(t.state().p.nice).toEqual({ active: true, count: 2 });
  expect(t.error).toHaveBeenCalledWith("p");
  expect(t.pending().size).toBe(0);
  t.controller.toggle("p", "nice");
  expect(t.requests[2].active).toBe(false);
});
it("画面を離れた後の遅延応答は表示もエラーも更新しない", async () => {
  const t = setup();
  t.controller.toggle("p", "nice");
  t.controller.dispose();
  const count = t.change.mock.calls.length;
  t.requests[0].reject();
  await flush();
  expect(t.change).toHaveBeenCalledTimes(count);
  expect(t.error).not.toHaveBeenCalled();
});
