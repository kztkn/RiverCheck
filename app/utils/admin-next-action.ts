export type AdminNextActionTone = "neutral" | "attention" | "ready";

export type AdminNextAction = {
  tone: AdminNextActionTone;
  title: string;
  description: string;
  href: "#admin-share" | "#admin-participants" | "#admin-settlement";
  actionLabel: string;
};

type AdminNextActionInput = {
  participantCount: number;
  submittedCount: number;
  warningCount: number;
  invalidRebuyCount: number;
  settlementParticipantCount: number | null;
  chipDifference: number | null;
};

export function getAdminNextAction({
  participantCount,
  submittedCount,
  warningCount,
  invalidRebuyCount,
  settlementParticipantCount,
  chipDifference,
}: AdminNextActionInput): AdminNextAction {
  if (participantCount < 2) {
    return {
      tone: "neutral",
      title: "参加者を集める",
      description:
        participantCount === 0
          ? "参加者リンクを共有して、今回のテーブルに参加してもらいましょう。"
          : "あと1人参加すると、終了入力をそろえて結果を確定できます。",
      href: "#admin-share",
      actionLabel: "参加者リンクを共有",
    };
  }

  const incompleteCount = Math.max(0, participantCount - submittedCount);
  if (incompleteCount > 0) {
    return {
      tone: "attention",
      title: `未入力の${incompleteCount}人を確認`,
      description: `${submittedCount} / ${participantCount}人が終了入力済みです。全員揃ったら結果を確定できます。`,
      href: "#admin-participants",
      actionLabel: "参加者を確認",
    };
  }

  if (invalidRebuyCount > 0) {
    return {
      tone: "attention",
      title: "リバイ回数を確認",
      description: `${invalidRebuyCount}人で終了時リバイ証が累計リバイを上回っています。参加者の記録を修正してください。`,
      href: "#admin-participants",
      actionLabel: "要確認の参加者を見る",
    };
  }

  if (warningCount > 0) {
    return {
      tone: "attention",
      title: "リバイ記録を確認",
      description: `${warningCount}人で記録上の未返済と終了時リバイ証に差があります。内容を確認してから確定できます。`,
      href: "#admin-participants",
      actionLabel: "要確認の参加者を見る",
    };
  }

  if (settlementParticipantCount !== participantCount) {
    return {
      tone: "attention",
      title: "負担人数を確認",
      description:
        settlementParticipantCount === null
          ? `当日の負担人数を確認してください。現在の参加者は${participantCount}人です。`
          : `負担配分は${settlementParticipantCount}人想定、現在の参加者は${participantCount}人です。人数を揃えてください。`,
      href: "#admin-settlement",
      actionLabel: "当日のまとめを確認",
    };
  }

  if (chipDifference === null || chipDifference !== 0) {
    return {
      tone: "attention",
      title: "チップ差分を確認",
      description:
        chipDifference === null
          ? "チップ検算の状態を確認してから結果を確定してください。"
          : "全員の入力は揃っています。チップ差分を確認してから結果確定へ進めます。",
      href: "#admin-settlement",
      actionLabel: "当日のまとめを確認",
    };
  }

  return {
    tone: "ready",
    title: "結果を確定できます",
    description: `${participantCount} / ${participantCount}人の入力が揃い、リバイ記録とチップ合計も一致しています。`,
    href: "#admin-settlement",
    actionLabel: "結果確定へ",
  };
}
