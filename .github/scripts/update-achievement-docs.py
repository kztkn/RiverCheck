from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing text in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_section(path: str, start: str, end: str, body: str) -> None:
    p = Path(path)
    text = p.read_text()
    start_at = text.find(start)
    end_at = text.find(end, start_at + len(start))
    if start_at < 0 or end_at < 0:
        raise SystemExit(f"missing section in {path}: {start!r} -> {end!r}")
    p.write_text(text[:start_at] + body.rstrip() + "\n\n" + text[end_at:])


replace_once(
    "docs/requirements.md",
    "- 実績は本人の確定済み参加履歴だけから判定し、参加・優勝・損益BBに加えて、リバイ後の結果、返済完了、連続ノーリバイ、前回からの順位変化、4位・2位の累計、連続優勝を条件とする。個別条件は`docs/domain-rules.md`を正本とする\n- 1開催で複数実績を獲得できるが、同じ実績はグループ内プレイヤーごとに1件だけ保持する\n- 確定結果の訂正後は正式な確定履歴全体から実績を再評価し、成立しなくなった実績を解除する。解除対象を装備中の場合は未装備へ戻す\n",
    "- 実績は正式な確定済みデータから判定し、順位・損益BB・リバイに加えて、取消されていない72o/ALL INテーブルイベント、TABLE STORIES投稿、投稿へのリアクションも条件に利用する。個別条件は`docs/domain-rules.md`を正本とする\n- 1開催で複数実績を獲得できるが、同じ実績はグループ内プレイヤーごとに1件だけ保持する。一度取得した実績は思い出として永久保持し、結果訂正や確定取り消しで後から条件を満たさなくなっても削除しない\n- 結果確定ではgame_results保存とgameのfinalized化を先にtransactionでcommitし、称号再評価はCloudflare `waitUntil`へ登録してレスポンスを待たせない。判定は称号ごとにSQLを増やさず、確定履歴・テーブルイベント・STORIESをまとめた集約query、リアクション集約query、batch INSERTで行う\n- TABLE STORIES投稿とリアクション追加でも本人分の称号再評価を`waitUntil`へ登録し、次の開催確定を待たずに交流系称号を取得できる\n- 新しく取得した未通知の称号は、本人が次回RiverCheckを開いた際に画面下部の`NEW TITLE`トーストで順番に知らせる。称号通知にPushは使わず、既存UIと同じTabler Iconsを使う\n",
)

achievement_section = r'''## プレイヤー実績

実績は`group_player`単位で獲得し、一度取得したら永久にコレクションへ残す。同じ実績はプレイヤーごとに1件だけ保持し、結果訂正・確定取り消しで後から条件が成立しなくなっても削除しない。訂正や再確定で新しく条件を満たした場合は追加取得できる。プロフィールへ装備できるのは本人が同じ`group_player`で取得済みの実績1件だけで、未装備へ戻すこともできる。

順位・損益系は正式な確定済み`game_results`を基準とする。連続条件は本人が参加した確定済み開催だけを開催日時順に並べ、本人が不参加の開催は連続性へ影響させない。損益条件は個人戦績と同じ`(score - initial_chips) / initial_chips * 100`の損益BBを使う。

テーブル上の出来事と交流も実績条件に使う。

- 72oは取消されていない`game_table_events.event_type = 'seven_deuce'`の`subject_group_player_id`を数える
- ALL INは取消されていない`all_in`イベントに参加したプレイヤーを数え、`is_winner = TRUE`を勝利、それ以外を敗北とする。複数勝者にも対応する
- リバイは`game_results.total_rebuy_count`を使い、移行前データでNULLの場合だけ`settlement_rebuy_count`を互換値として扱う
- TABLE STORIESは削除されていない本人投稿を数える。投稿保存時にも本人分を再評価する
- 投稿リアクションは種類数ではなく、リアクションした異なる投稿数を数える。同じ投稿へ複数リアクションを付けても1件とする

実績は次の28件とする。

### 既存16件

- 初戴冠: 初めて1位を獲得
- またお前か: 通算3回優勝
- いつメン: 5開催に参加
- テーブルの主: 10開催に参加
- 一撃必殺: 1開催で+300BB以上
- ダイヤの原石: 累計損益が+100BB以上へ到達
- はじめの一歩: 初参加開催を確定
- 不死鳥: リバイした開催で1位
- 生還者: リバイした開催をプラス収支で終了
- 完済: リバイ済みかつ終了時の未返済が0
- ノーダメージ: 3参加開催連続でリバイ0
- 三日天下: 1位の次の参加開催で最下位
- 下剋上: 最下位の次の参加開催で1位
- 4位のプロ: 参加者4人以上の開催で通算3回4位
- 銀メダル収集家: 通算3回2位
- 王座防衛: 本人の参加開催で2開催連続1位

### テーブルイベント・交流・ネタ系12件

- 72oデビュー: 72oを通算1回成立
- 72o職人: 72oを通算3回成立
- 72oマスター: 72oを通算5回成立
- 勝負師: ALL INで通算5回勝利
- 散り際まで美しく: ALL INで通算5回敗北
- 10回目の正直: 通算10回リバイ
- 何度でも蘇る: 1開催で3回以上リバイ
- 記録係: TABLE STORIESへ通算1回投稿
- 語り部: TABLE STORIESへ通算3回投稿
- 思い出職人: TABLE STORIESへ通算5回投稿
- 愛を配る者: 5件の異なるTABLE STORIES投稿へリアクション
- ジェットコースター: +200BB以上と-200BB以下を両方経験

条件を満たした最初の開催を`source_game_id`として記録する。リアクション系は閾値へ到達した5件目の投稿が属する開催を契機とする。1開催で複数条件を満たした場合はすべて取得する。

結果確定の金額・順位保存transactionには称号集計を含めない。game_results保存とgameのfinalized化をcommitした後、Cloudflare `waitUntil`へ称号再評価を登録する。確定履歴・テーブルイベント・STORIESは1回の集約query、リアクションは1回の集約queryで取得し、pure evaluatorで全条件を判定した後、新規取得分を1回のbatch INSERTで保存する。称号件数が増えても称号ごとにDB往復を増やさない。

`player_achievements.notified_at IS NULL`を未通知の新規取得として扱う。本人がRiverCheckを開いたときに画面下部の`NEW TITLE`トーストへTabler icon・称号名・条件を表示し、複数件は順番に表示する。既存称号はmigration時に通知済み扱いとし、新規追加した称号の過去データバックフィルだけは未通知として知らせる。Push通知は使わない。
'''
replace_section(
    "docs/domain-rules.md",
    "## プレイヤー実績",
    "## ランキング指標",
    achievement_section,
)
replace_once(
    "docs/domain-rules.md",
    "主催者は、誤操作で確定した開催に限り、参加者・リバイ履歴・終了時入力を保持したまま確定結果を削除して受付中へ戻せる。取り消し時は対象開催の`game_results`を削除し、`games.status`を`open`、`finalized_at`をNULLへ戻したうえで、対象参加者の実績を残存する確定開催から再計算する。確定時に保存した会費設定は保持する。",
    "主催者は、誤操作で確定した開催に限り、参加者・リバイ履歴・終了時入力を保持したまま確定結果を削除して受付中へ戻せる。取り消し時は対象開催の`game_results`を削除し、`games.status`を`open`、`finalized_at`をNULLへ戻す。取得済み実績は思い出として永久保持するため、確定取り消しでは削除・再計算しない。確定時に保存した会費設定は保持する。",
)
