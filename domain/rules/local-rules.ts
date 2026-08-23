export interface LocalRuleDefinition {
  enabled: boolean;
  key: "rebuy-repayment" | "seven-deuce-bonus";
  note: string | null;
  steps: Array<{ label: string; text: string }>;
  title: string;
}

export function buildLocalRules(
  sevenDeuceRuleEnabled: boolean,
): LocalRuleDefinition[] {
  return [
    {
      enabled: true,
      key: "rebuy-repayment",
      note: "現在のスタックをRiverCheckへ入力する必要はありません。",
      steps: [
        { label: "150BB超", text: "任意で100BBを返済できます" },
        { label: "300BB超", text: "100BBを返済してください" },
        {
          label: "返済後",
          text: "まだ300BBを超える場合は、未返済がある限り繰り返します",
        },
        { label: "記録", text: "ポット精算後に本人が記録します" },
      ],
      title: "100BB返済ルール",
    },
    {
      enabled: sevenDeuceRuleEnabled,
      key: "seven-deuce-bonus",
      note: sevenDeuceRuleEnabled
        ? "7と2は異なるスートの組み合わせが対象です。"
        : "この開催では適用しません。",
      steps: [
        { label: "条件", text: "72oでポットを獲得する" },
        {
          label: "ボーナス",
          text: "ほかの参加者全員から2.5BBずつ受け取ります",
        },
      ],
      title: "72oボーナス",
    },
  ];
}
