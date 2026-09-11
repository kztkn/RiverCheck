# プレイヤー称号・実績機能

- ステータス: 実装済み・拡張済み
- 最終更新: 2026-09-12
- 対象: グループ内の確定済み戦績、テーブルイベント、TABLE STORIES、リアクション

## 目的

戦績の強さだけでなく、卓で起きた出来事やコミュニティでの遊び方もコレクションへ残す。月1回程度の開催でも1〜2開催ごとに何か狙える密度を意識し、強いプレイヤーだけが称号を集める設計にしない。

称号は「一度達成したらコレクションへ永久に残る実績」とする。本人が獲得済みから1件だけ装備でき、未装備も選べる。

## 既存システムを踏襲した構成

- 実績マスタ: `achievements`
- 獲得履歴: `player_achievements`
- 装備中: `group_players.equipped_achievement_id`
- 個人ページ: 獲得済み・未獲得のコレクション
- プロフィール編集: 獲得済み称号から1件を装備
- アイコン: 絵文字ではなくTabler Iconsを`icon_key`から対応付ける
- hidden実績は未獲得時だけ名称と条件を伏せる

新規機能を別の称号基盤として作らず、既存の`AchievementService` / `AchievementRepository` / evaluatorへ統合する。

## 2026-09-12 拡張

既存条件と重複しない次の12件を追加する。

| code | 称号 | 条件 | アイコン系統 |
| --- | --- | --- | --- |
| `seven-deuce-first` | 72oデビュー | 72oを通算1回成立 | Cards |
| `seven-deuce-three` | 72o職人 | 72oを通算3回成立 | Cards |
| `seven-deuce-five` | 72oマスター | 72oを通算5回成立 | Cards |
| `all-in-five-wins` | 勝負師 | ALL INで通算5回勝利 | Bolt |
| `all-in-five-losses` | 散り際まで美しく | ALL INで通算5回敗北 | Bolt |
| `rebuy-ten` | 10回目の正直 | 通算10回リバイ | Refresh |
| `rebuy-triple` | 何度でも蘇る | 1開催で3回以上リバイ | Refresh |
| `story-first` | 記録係 | TABLE STORIESへ通算1回投稿 | Notes |
| `story-three` | 語り部 | TABLE STORIESへ通算3回投稿 | Notes |
| `story-five` | 思い出職人 | TABLE STORIESへ通算5回投稿 | Notes |
| `love-giver` | 愛を配る者 | 5件の異なるTABLE STORIES投稿へリアクション | Heart |
| `rollercoaster` | ジェットコースター | +200BB以上と-200BB以下を両方経験 | ArrowsUpDown |

`愛を配る者`はリアクション種類の合計ではなく`COUNT(DISTINCT story_post_id)`相当で数える。同じ投稿へ複数種類を付けても1件とする。

既存の「初戴冠」「またお前か」「不死鳥」「生還者」等と条件が重なる称号は追加しない。

## 判定データ

称号判定の正本は正式な確定済みデータとする。

- 順位・損益BB: `game_results`
- リバイ回数: `game_results.total_rebuy_count`。移行前データでNULLの場合は精算時記録を互換値として扱う
- 72o: 取消されていない`game_table_events.event_type = seven_deuce`の対象者
- ALL IN: 取消されていない`all_in`イベントの参加者と`is_winner`
- TABLE STORIES: 削除されていない投稿
- リアクション: 現在有効な投稿リアクションを投稿単位で数える

テーブルイベントのチップ額やカード内容は称号のためにも追加保存しない。

## 判定処理とレスポンス速度

金額・順位の確定を称号判定から分離する。

```text
結果確定
  → game_results保存 + game.finalized をtransactionでcommit
  → HTTPレスポンスを待たせずCloudflare waitUntilへ称号再評価を登録
  → 確定履歴 + テーブルイベント + STORIESを1回の集約queryで取得
  → リアクション集約を1回取得
  → pure evaluatorで全称号を判定
  → 新規獲得だけを1回のbatch INSERT
```

称号が増えるたびにSQLを1本ずつ追加する方式にはしない。判定対象の種類が増えてもDB往復回数をほぼ固定し、6〜8人程度の友人卓で結果確定の体感速度へ影響させない。

Cloudflare Queueは現時点では導入しない。称号判定は小さく30秒以内に終わる想定で、`waitUntil`の方が構成が単純だからである。将来、称号判定や外部連携が重くなった場合はQueueへ切り替えられる。

TABLE STORIES投稿とリアクション追加でも、本人分の称号再評価を`waitUntil`へ登録する。これにより「記録係」「愛を配る者」は次の開催確定を待たずに獲得できる。

## 永久コレクション

- 同じ称号は`group_player`ごとに1件だけ保持する
- 新規取得は`ON CONFLICT DO NOTHING`で追加する
- 再評価で既存称号をDELETEしない
- 結果訂正・確定取り消しで後から条件が成立しなくなっても取得済み称号は残す
- 訂正で新しく条件を満たした場合は追加取得できる

これは「取得した実績は思い出として残る」という当初方針を優先する。

## 獲得通知

`player_achievements.notified_at`でアプリ内通知の既読状態を持つ。

- 既存実績はmigration時に既読扱いにし、過去の称号を一斉再生しない
- 今回追加した称号は過去データもバックフィルし、該当者には未読として残す
- 本人が次回RiverCheckを開いたとき、画面下部に`NEW TITLE`トーストを表示する
- 複数件ある場合は順番に表示する
- トーストにはTabler icon、称号名、条件説明を表示し、絵文字は使わない
- Push通知は送らない
- 通知確認APIは本人の`group_player`に属する未読レコードだけを既読化できる

## バックフィル

migrationで既存の確定結果、テーブルイベント、TABLE STORIES、リアクションを再集計し、新規12件のうち既に条件を満たしている称号を追加する。閾値を初めて超えた開催を`source_game_id`として保存する。

## アイコン

既存5種に次を追加する。

- Cards: 72o
- Bolt: ALL IN
- Refresh: リバイ
- Notes: TABLE STORIES
- Heart: リアクション
- ArrowsUpDown: 振れ幅系

RiverCheck内の他UIと同じTabler Iconsを使い、称号だけ絵文字テイストにはしない。

## 今後の候補

初回拡張では増やしすぎず、実際の解除ペースを見て追加する。候補としてはBOMB POT参加回数、テーブルイベント3種コンプリート、コミュニティ投票型MVPなどがある。ただし既存条件と同義の称号は追加しない。
