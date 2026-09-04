from pathlib import Path

path = Path("docs/requirements.md")
text = path.read_text()
start = text.index("## GAME TIMELINE（確定後の振り返り）")
end = text.index("## 結果確定の取り消し", start)
replacement = """## GAME TIMELINE（確定後の振り返り）

finalized の開催結果画面では、リバイ・100BB返済とゲーム中に任意記録した卓イベントを、`recorded_at` の古い順に1本の `GAME TIMELINE` として表示する。見出しは「今日の卓の記録」とする。

リバイ・返済は精算・検算に関係する正式記録として `game_rebuy_events` を正本のまま維持し、卓イベントは精算へ一切影響しない振り返り用の `game_table_events` として分離する。`undo` は取り消し対象の元リバイイベントごとタイムラインから除外し、救済修正用の `adjustment` も表示しない。取消済み卓イベントも表示しない。表示対象が0件の場合はセクション自体を表示しない。

第一弾の卓イベントは次の3種類とする。

- 72o成立: 開催の72oルールがONの場合だけ記録でき、達成した参加者1人を選択する
- BOMB POT: 開催のBOMB POTルールがONの場合だけ、追加入力なしで記録する
- ALL IN: 参加者を2人以上選択し、その中から勝者を1人以上選択する。スプリットを考慮して複数勝者を許可する

卓イベントはopen開催の参加者または主催者が記録できる。選択対象はその時点で開催へ参加中のプレイヤーだけとし、サーバー側でも開催状態・参加者・ローカルルール設定を再検証する。卓イベントは編集せず、誤記録は取消して再登録する。通常参加者は自分が登録した卓イベントだけ、主催者は全卓イベントを取り消せる。取消は物理削除せず取消日時と取消主体を保持する。

開催中の参加者画面には「卓イベント」入口を表示し、72o、BOMB POT、ALL INを少ないタップ数で登録できる。最近の卓イベントを同じUI内に最大5件表示して取消導線を提供する。ポット額、スタック、ホールカード、ボード、ベット履歴、自由コメントは入力しない。

確定後の表示ではリバイ・返済をコンパクトな運営記録、72o・BOMB POT・ALL INを視覚的に強いハイライトとして同じ縦ライン上へ配置する。ALL INの敗者に対するリバイが記録時刻の前後3分以内に存在する場合は、DB上の関連付けを作らず表示上だけALL INの続きとしてまとめる。卓イベントの有無や記録失敗は結果入力、検算、finalize、精算をブロックしない。

TABLE STORIESは確定後に参加者本人が残す投稿、今日のひとことはopen開催中の現在状態、GAME TIMELINEは卓で起きた出来事として役割を分離する。今日のひとこと変更はGAME TIMELINEへ流さない。

"""
text = text[:start] + replacement + text[end:]
marker = "- game_story_posts: 参加者ごとの任意投稿、写真のR2メタデータ、主催者削除監査\n"
if marker not in text:
    raise RuntimeError("data model marker not found")
text = text.replace(
    marker,
    marker + "- game_table_events / game_table_event_players: 72o・BOMB POT・ALL INの卓イベント、関係者・勝者、記録主体、取消監査\n",
    1,
)
path.write_text(text)

component_path = Path("app/components/game-timeline.tsx")
component = component_path.read_text()
old = '''      ) : (\n        <div className="game-timeline-highlight">\n          <strong>ALL IN</strong>'''
new = '''      ) : event.type === "all_in" ? (\n        <div className="game-timeline-highlight">\n          <strong>ALL IN</strong>'''
if old not in component:
    raise RuntimeError("timeline all-in branch marker not found")
component = component.replace(old, new, 1)
old_end = '''          ) : null}\n        </div>\n      )}\n    </li>'''
new_end = '''          ) : null}\n        </div>\n      ) : null}\n    </li>'''
if old_end not in component:
    raise RuntimeError("timeline all-in branch end marker not found")
component = component.replace(old_end, new_end, 1)
component_path.write_text(component)
