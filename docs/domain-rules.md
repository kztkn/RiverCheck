# 業務ルール

## 数値の共通ルール

チップ、リバイ回数、金額は JavaScript の safe integer 範囲の整数として扱う。入力値は原則 0 以上とし、小数、`NaN`、無限大、safe integer 範囲外は拒否する。会場費精算の想定参加人数は4人以上とする。

## 点数

```text
score = remaining_chips - rebuy_count × rebuy_chips
```

点数は負になり得る。入力である残チップ、リバイ回数、リバイチップは 0 以上とする。

## 順位

次の順に並べ、1 から連番の順位を付ける。共同順位は作らない。

1. `score` の降順
2. `rebuy_count` の昇順
3. 完全同点は `group_player_id` の Unicode 辞書順（昇順）

3 番目は人の優劣を表すルールではなく、結果を常に再現可能にするための決定的 tie-break である。後から別ルールへ変更できるよう `calculateRanking` 内に閉じ込める。

## チップ総量検算

```text
expected_total = initial_chips × participant_count
               + rebuy_chips × total_rebuy_count

reported_total = sum(remaining_chips)
difference     = expected_total - reported_total
```

`difference = 0` を一致とする。正数はチップ不足、負数は報告過多を意味する。差があっても主催者は警告を確認したうえで finalize できる。

## 会場費精算

### 精算総額

`venue_cost` を固定の100円単位で切り上げる。丸め単位は利用者が変更できる設定にしない。

```text
settlement_total = ceil(venue_cost / 100) × 100
```

1〜3位の設定額は100円単位とし、`1位 <= 2位 <= 3位` でなければならない。

### 4 位以下の傾斜

1〜3位は設定額で固定する。4位以下が3位より安くならないよう、まず3位の負担額を4位以下全員の最低額として確保する。

```text
minimum_required = first_place_cost
                 + second_place_cost
                 + (participant_count - 2) × third_place_cost
```

`minimum_required > settlement_total` の設定は成立しないため拒否する。残額 `settlement_total - minimum_required` を、4位以下の順位ウェイト `1, 2, ..., N-3` で次のように配分する。

1. 4位から最下位の1つ前までは、`third_place_cost + floor_100(残額 × 順位ウェイト / ウェイト合計)` とする
2. 100円未満を切り捨てた差額を含め、最下位は `settlement_total - 最下位以外の合計` とする
3. 全員の負担合計を `settlement_total` と必ず一致させる

この方法では4位は必ず3位以上となり、以降も順位が下がるほど負担が減らない。同額は許可する。これはGoogleスプレッドシート `poker_ranked_cost_sharing` の「精算シート」タブと同じ計算式である。

### 3人以下

順位別傾斜精算は4人以上を前提とするため設定不可とする。

## 日時

開催条件では日付だけを入力し、時刻は扱わない。今回の利用グループを日本国内と仮定し、入力日付の Asia/Tokyo（UTC+09:00）午前0時として `TIMESTAMPTZ` に保存する。複数タイムゾーン対応時はグループへ IANA time zone を追加する。

## チップ設定

`rebuy_chips` は常に `initial_chips` と同じ値にする。画面ではリバイチップを個別設定せず、初期チップの変更をリバイにも反映する。

## 精算プレビュー

開催作成・編集時は、想定参加人数と現在の会場費設定を `calculateCostShares` へ渡し、全順位の負担額を表示する。

- プレビューとfinalizeで別の計算式を持たない
- 想定参加人数は金額確認用であり、参加者を事前登録しない
- 新規作成時の想定人数を保存し、参加人数の増減では自動変更しない
- open中は想定人数を手動変更できる
- 想定参加人数は手動変更でき、ドタ参加・ドタキャン後の金額を試算できる
- venue_costなどを変更した場合は即時再計算する
- 全順位を順位ごとの金額パネルで表示し、同じ内容の文章要約は重複表示しない

### おすすめ配分

精算総額を順位ウェイト `1, 2, ..., N` で按分したなだらかな傾斜を基準とする。上位3人の理論額を100円単位で切り捨てておすすめ値とし、現在の入力値を強制変更せず、利用者がボタンで反映する。

おすすめ反映時の人数は `max(想定人数, 現在の参加人数, 4)` とする。現在の参加人数が想定人数を超えた場合は、想定人数も現在の参加人数へ更新し、その旨を画面に表示する。
