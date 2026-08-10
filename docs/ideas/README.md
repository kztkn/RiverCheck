# RiverCheck アイデア管理

このフォルダは、今後実装したい機能やUI案を会話だけに残さず、次回以降のCodexタスクへ引き継ぐための置き場です。

ここにある文書は未実装のアイデア・設計メモです。現在動作している仕様の正本は `docs/requirements.md` とし、アイデアを実装するときに必要な内容を正本・技術設計へ反映します。

## 進め方

1. アイデアごとに英小文字のkebab-caseでMarkdownを1ファイル作る
2. 文書冒頭へステータスと最終更新日を書く
3. 合意済み事項と未決事項を分ける
4. 実装前に未決事項だけユーザーへ確認する
5. 実装後はテスト結果と主要ファイルを追記し、ステータスを「実装済み」にする

次回以降は、例えば次のように依頼できます。

```text
docs/ideas/player-achievements.md を読んで、未決事項を確認してから実装してください。
```

## ステータス

- アイデア: 方向性を検討中
- 方針合意・未実装: 基本思想は合意済み。未決事項を確認後に実装可能
- 実装中: 現在作業中
- 実装済み: コード・文書・検証まで完了
- 保留: 当面実装しない

## アイデア一覧

| ファイル | 内容 | ステータス |
| --- | --- | --- |
| [player-achievements.md](./player-achievements.md) | 戦績条件で永久取得し、本人が1つ装備する称号機能 | 実装済み |
| [daily-hand-bonus.md](./daily-hand-bonus.md) | 参加時の本日のハンド、一致写真、結果への+300BBボーナス | アイデア・要件確認待ち |
| [game-likes-and-yearly-highlights.md](./game-likes-and-yearly-highlights.md) | 過去開催の赤いハート、送受信集計、称号・年間表彰への活用 | アイデア・要件確認待ち |
| [settlement-collection-management.md](./settlement-collection-management.md) | 主催者限定の会費回収チェック、未回収開催の色表示 | 方針合意・未実装 |
| [ai-integration.md](./ai-integration.md) | Gemini等による開催振り返り、共有文、年間・個人ハイライト生成 | アイデア・用途検討中 |
