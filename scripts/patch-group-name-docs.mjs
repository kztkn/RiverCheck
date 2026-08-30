import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text not found in ${path}`);
  }
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "docs/requirements.md",
  "- メンバー管理では、他グループに既に存在するplayerを新規作成せず、新グループへ所属追加できる\n- 最後に正常表示したgroupCodeを端末localStorageへ保持し、アプリルート`/`からの次回起動時はそのグループへ復帰する。未記録・不正値・localStorage利用不可時は既定グループ`river-check`へ戻す",
  "- メンバー管理では、他グループに既に存在するplayerを新規作成せず、新グループへ所属追加できる\n- 現在のグループ名は各グループ画面の共通ヘッダー、グループ切替一覧、開催リンクからのグループ招待画面へ表示する\n- 主催者はグループ設定からグループ名を変更できる。名称変更では`groups.name`だけを更新し、共有済みURLを壊さないため`public_code`は変更しない\n- 最後に正常表示したgroupCodeを端末localStorageへ保持し、アプリルート`/`からの次回起動時はそのグループへ復帰する。未記録・不正値・localStorage利用不可時は既定グループ`river-check`へ戻す",
);

await replaceOnce(
  "docs/requirements.md",
  "グループ設定では開催をまたいで共通利用する設定を扱う。現在はPayPay受取リンクをここで登録・更新し、今後の共通設定も開催ごとの管理画面へ混在させず、この画面へ集約する。",
  "グループ設定では開催をまたいで共通利用する設定を扱う。現在はグループ名の変更とPayPay受取リンクの登録・更新をここで行い、今後の共通設定も開催ごとの管理画面へ混在させず、この画面へ集約する。",
);

await replaceOnce(
  "docs/architecture.md",
  "グループ作成は既存の`groups`と`group_players`を利用する。主催者端末がplayerとして認証済みの場合は新group作成transaction内でそのplayerのgroup_playerも作成する。メンバー管理から他groupの既存playerを追加する場合もplayersを複製せずgroup_playersだけを追加する。",
  "グループ作成は既存の`groups`と`group_players`を利用する。主催者端末がplayerとして認証済みの場合は新group作成transaction内でそのplayerのgroup_playerも作成する。メンバー管理から他groupの既存playerを追加する場合もplayersを複製せずgroup_playersだけを追加する。`groups.name`は変更可能な表示名、`groups.public_code`は共有URLで使う安定した識別子として扱い、名称変更ではpublic_codeを変更しない。現在のグループ名はroot loaderで解決し、共通ヘッダーへ表示する。",
);
