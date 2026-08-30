import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text not found in ${path}: ${before.slice(0, 100)}`);
  }
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "docs/requirements.md",
  `最初の MVP は、1つのグループで実際のポーカー会を最初から最後まで運用できる状態を目標とする。\n\n将来は次へ拡張する。\n\n- 複数グループ\n- 過去開催履歴\n- 個人戦績\n- ランキング\n- 個人ダッシュボード\n- グループダッシュボード\n- 他ユーザーによるグループ作成・利用\n\n将来拡張を妨げないデータ設計とするが、MVPで不要な機能や抽象化は先行実装しない。`,
  `当初の MVP は、1つのグループで実際のポーカー会を最初から最後まで運用できる状態を目標とした。現在は同じRiverCheck内で複数グループを作成・切替でき、同一プレイヤーを複数グループへ所属させられる。\n\n今後は次へ拡張する。\n\n- 個人ダッシュボード\n- グループダッシュボード\n- グループごとに独立した主催者・権限管理\n- 他ユーザーによるグループ作成・利用\n\n将来拡張を妨げないデータ設計とするが、不要な機能や抽象化は先行実装しない。`,
);

await replaceOnce(
  "docs/requirements.md",
  `- 確定結果の見出し内にも開催日を表示し、参加者画面と主催者画面で共通化する\n\n## 4. URL`,
  `- 確定結果の見出し内にも開催日を表示し、参加者画面と主催者画面で共通化する\n\n### 3.6 グループを作成・切り替える\n\n- RiverCheckのプレイヤー本人を表す\`players\`はグループをまたいで共通とし、\`group_players\`を各グループへの所属として扱う\n- 同一playerは複数groupへ所属できるが、同じgroupへ重複所属させない\n- 表示名、プロフィール文、アイコン、MY HANDはplayer単位で共通とし、別グループでも同じプロフィールを使用する\n- 開催、結果、ランキング、参加回数、獲得実績、装備中実績はgroupまたはgroup_player単位で分離する\n- プロフィール認証済みplayerは、所属済みの別グループへ切り替えても同じ本人セッションを利用できる\n- 主催者はグループ切替画面から新しいグループを作成できる。作成時に主催者端末がplayerとしても認証済みなら、そのplayerを新グループへ自動所属させる\n- メンバー管理では、他グループに既に存在するplayerを新規作成せず、新グループへ所属追加できる\n- 最後に正常表示したgroupCodeを端末localStorageへ保持し、アプリルート\`/\`からの次回起動時はそのグループへ復帰する。未記録・不正値・localStorage利用不可時は既定グループ\`river-check\`へ戻す\n- 主催者認証はRiverCheck全体で共通のPIN・主催者セッションを使用し、グループごとの独立権限は将来拡張とする\n\n## 4. URL`,
);

await replaceOnce(
  "docs/requirements.md",
  `### 主催者用\n\nMVPの主催者ホームはグループ単位の専用URLとする。`,
  `### グループ切替\n\n\`\`\`text\n/g/:groupCode/groups\n\`\`\`\n\n本人プロフィールで認証済みの場合は所属中グループ、主催者認証済みの場合は全グループを一覧表示する。主催者は同画面から新しいグループを作成できる。\n\n### 主催者用\n\n主催者ホームはグループ単位の専用URLとする。`,
);

await replaceOnce(
  "docs/requirements.md",
  `- 開催作成後、通知をONにした有効なメンバーへ開催名・開催日をWeb Pushで通知し、タップ時は該当開催の参加画面を開く\n- Web Pushの個別失敗は開催作成を失敗させず、無効になった通知先はPushサービスの404または410応答時に削除する`,
  `- Web Pushの購読情報はplayer単位で端末を共有し、通知ON/OFFはgroup_player単位で保持する\n- 開催作成後、そのグループで通知をONにした有効なメンバーへ開催名・開催日をWeb Pushで通知し、タップ時は該当開催の参加画面を開く\n- 結果確定通知も、その開催の参加者かつ該当グループで通知ONのplayerだけへ送る\n- 新しいグループへ所属しただけでは通知を自動ONにせず、既存購読者の既存所属についてのみ移行時にONへ引き継ぐ\n- Web Pushの個別失敗は開催作成や結果確定を失敗させず、無効になった通知先はPushサービスの404または410応答時に削除する`,
);

await replaceOnce(
  "docs/requirements.md",
  `- ユーザーアカウントとログイン\n- 複数グループ管理UI\n- 過去開催履歴\n- 個人・グループダッシュボード\n- 他ユーザーによるグループ作成\n- 高度な監査、権限管理、レート制限`,
  `- ユーザーアカウントとログイン\n- グループごとに独立した主催者認証・権限管理\n- 過去開催履歴\n- 個人・グループダッシュボード\n- 他ユーザーによるグループ作成\n- 高度な監査、権限管理、レート制限`,
);

await replaceOnce(
  "docs/architecture.md",
  `- \`docs\`: 要件、構成、業務ルール、TODO\n- \`workers\`: Cloudflare Worker entry point\n\n## PWAとクライアントキャッシュ`,
  `- \`docs\`: 要件、構成、業務ルール、TODO\n- \`workers\`: Cloudflare Worker entry point\n\n## 複数グループとプレイヤーID\n\n\`players\`はRiverCheck全体で共通の人物・プロフィールを表し、\`group_players\`はそのplayerが各groupへ所属している状態を表す。\`UNIQUE(group_id, player_id)\`により同じplayerの同一groupへの重複所属を防ぎ、同じplayer_idを複数groupへ紐づけることでプロフィールを再利用する。\n\n表示名、プロフィール文、アイコン、MY HAND、プロフィールセッションはplayer単位とする。一方、開催参加、game_results、ランキング集計、player_achievements、\`group_players.equipped_achievement_id\`はgroup_player単位とし、戦績・実績・装備称号をグループ間で混在させない。プロフィールセッションから本人を解決するときは、セッションのplayer_idに加えて現在URLのgroup_idに所属するgroup_playerをJOINする。\n\nグループ作成は既存の\`groups\`と\`group_players\`を利用する。主催者端末がplayerとして認証済みの場合は新group作成transaction内でそのplayerのgroup_playerも作成する。メンバー管理から他groupの既存playerを追加する場合もplayersを複製せずgroup_playersだけを追加する。\n\n主催者認証は現時点ではgroup_idを持たないアプリ全体の署名済みセッションであり、同じ主催者PINで全groupを管理する。グループごとに別主催者を持たせる場合は、今後主催者membershipまたはgroup-scoped sessionへ拡張する。\n\n\`player_push_subscriptions\`はplayer_id単位で端末のPush購読を保持し、\`group_players.push_notifications_enabled\`でグループ別の通知ON/OFFを保持する。開催通知・結果確定通知の送信対象はgroup membership / game_participantsに加えてこのフラグで絞り込む。グループごとにOFFへしてもPush購読自体は削除せず、全所属グループでOFFになった場合でも再ONを容易にするため購読は保持する。\n\n最後に正常表示したgroupCodeはブラウザlocalStorageへUI状態として保存する。\`/\`はクライアントで保存値を読み、妥当なコードなら\`/g/:groupCode\`へ置き換え遷移し、利用できない場合は\`river-check\`へフォールバックする。DB上の所属・権限の正本には使用しない。\n\n## PWAとクライアントキャッシュ`,
);

await replaceOnce(
  "docs/TODO.md",
  `- 複数グループ作成・管理 UI\n- ユーザーアカウントと安全なグループ管理\n`,
  `- グループごとに独立した主催者権限・作成権限\n- ユーザーアカウントと安全なグループ管理\n`,
);
