import { describe, expect, it, vi } from "vitest";
import { requestServiceWorkerUpdate } from "../components/pwa-update-notice";

describe("PWA update check", () => {
  it("registrationがあればService Workerの更新確認を行う", async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    await requestServiceWorkerUpdate({ update });

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("更新確認の失敗はアプリへ伝播させない", async () => {
    const update = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(requestServiceWorkerUpdate({ update })).resolves.toBeUndefined();
  });

  it("registration未取得時は何もしない", async () => {
    await expect(requestServiceWorkerUpdate(null)).resolves.toBeUndefined();
  });
});
