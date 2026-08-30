import { validateLineOpenChatLink } from "@domain/community/line-open-chat-link";
import { saveGroupLineOpenChatUrlRecord } from "@server/repositories/group-community-repository.server";

export async function saveGroupLineOpenChatUrl(
  groupId: string,
  rawUrl: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; value: string }
> {
  const validated = validateLineOpenChatLink(rawUrl);
  if (!validated.ok) {
    return { ok: false, error: validated.error, value: rawUrl };
  }

  try {
    const saved = await saveGroupLineOpenChatUrlRecord(groupId, validated.value);
    return saved
      ? { ok: true }
      : {
          ok: false,
          error: "オープンチャットURLを保存できませんでした。画面を更新してください。",
          value: rawUrl,
        };
  } catch (error) {
    console.error("Failed to save group LINE OpenChat URL", error);
    return {
      ok: false,
      error: "オープンチャットURLを保存できませんでした。時間をおいて再度お試しください。",
      value: rawUrl,
    };
  }
}
