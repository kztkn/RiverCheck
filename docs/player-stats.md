# 個人戦績

## 公開画面

- `/g/:groupCode/stats`: グループ内ランキング。標準は累計損益BB順で、平均損益BB順へ切り替えられる
- `/g/:groupCode/stats/:groupPlayerId`: KPI、累計損益BB推移、開催別結果を表示する
- どちらも参加者へ公開し、主催者認証は要求しない
- グループトップに横幅いっぱいの「個人戦績を見る」導線を置く

## 集計元

現在有効な確定結果である`game_results`だけを正とする。`games.status = 'finalized'`の開催に限定し、開催途中の`game_participants`は含めない。

訂正時は`game_results`が現在結果へ置換され、過去スナップショットは`game_result_revisions`へ保存される。戦績SQLは訂正履歴をJOINしないため、同じ開催を二重集計しない。

## 損益BB

初期チップを100BBとして、開催ごとに次で計算する。

```text
score        = remaining_chips - rebuy_count × rebuy_chips
profit_chips = score - initial_chips
net_bb       = profit_chips ÷ (initial_chips ÷ 100)
             = (score - initial_chips) × 100 ÷ initial_chips
```

確定結果画面のBBスコアは現在点を正規化した値、個人戦績の損益BBはそこから最初の100BBを差し引いた値であり、用途を分ける。`initial_chips`は開催作成時に正の整数として検証する。万一0以下の確定済みデータが存在した場合は黙って除外せず、集計エラーとして検出する。

PostgreSQLでは途中の整数除算を避けるため`NUMERIC`へ変換してから計算する。画面表示は最大小数第2位とし、正数には`+`を付ける。

## 集計構成

```text
stats route loader
  → PlayerStatsService
    → PlayerStatsRepository
      → PostgreSQL
```

- ランキングの参加回数、優勝回数、累計、平均、順位はSQLで集約する
- 個人詳細は確定結果を時系列で取得し、serviceから純粋関数を呼んでKPIと累積値を作る
- 参加0回の登録メンバーも0戦としてランキングへ表示する
- Rechartsの`ResponsiveContainer`と`LineChart`で固定横幅を持たない累計損益BB推移を表示する

## 今回の範囲

- ランキング（累計・平均の切り替え）
- 参加回数、優勝回数、優勝率、平均順位、累計・平均損益BB、最大勝ち・最大負けBB
- 累計損益BB推移と開催情報Tooltip
- 新しい順の開催別結果と確定結果への導線

順位推移グラフ、年別フィルター、直近5戦、リバイ率、シーズン集計、連勝・連続入賞、自動ハイライトは次の拡張候補とする。
