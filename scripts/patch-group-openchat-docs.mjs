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
  "- 主催者はグループ設定からグループ名を変更できる。名称変更では`groups.name`だけを更新し、共有済みURLを壊さないため`public_code`は変更しない\n- 最後に正常表示したgroupCodeを端末localStorageへ保持し、アプリルート`/`からの次回起動時はそのグループへ復帰する。未記録・不正値・localStorage利用不可時は既定グループ`river-check`へ戻す",
  "- 主催者はグループ設定からグループ名を変更できる。名称変更では`groups.name`だけを更新し、共有済みURLを壊さないため`public_code`は変更しない\n- LINEオープンチャットの招待URLはグループ単位の任意設定とする。URLが設定されているグループだけ「このアプリについて」に参加導線を表示し、空欄で保存したグループには表示しない。既存の`river-check`だけは移行時に現在の招待URLを引き継ぎ、新規グループは未設定で開始する\n- 最後に正常表示したgroupCodeを端末localStorageへ保持し、アプリルート`/`からの次回起動時はそのグループへ復帰する。未記録・不正値・localStorage利用不可時は既定グループ`river-check`へ戻す",
);

await replaceOnce(
  "docs/requirements.md",
  "グループ設定では開催をまたいで共通利用する設定を扱う。現在はグループ名の変更とPayPay受取リンクの登録・更新をここで行い、今後の共通設定も開催ごとの管理画面へ混在させず、この画面へ集約する。",
  "グループ設定では開催をまたいで共通利用する設定を扱う。現在はグループ名の変更、LINEオープンチャット招待URL、PayPay受取リンクの登録・更新をここで行い、今後の共通設定も開催ごとの管理画面へ混在させず、この画面へ集約する。",
);

await replaceOnce(
  "docs/architecture.md",
  "主催者ホームは `/g/:groupCode/manage` とする。ホーム上部はメンバー管理とグループ設定への導線に絞り、開催作成は開催管理セクション内の操作として配置する。`/g/:groupCode/settings` はPayPay受取リンクなど開催をまたぐ共通設定を扱い、設定が増えても各開催管理へ混在させない。",
  "主催者ホームは `/g/:groupCode/manage` とする。ホーム上部はメンバー管理とグループ設定への導線に絞り、開催作成は開催管理セクション内の操作として配置する。`/g/:groupCode/settings` はグループ名、LINEオープンチャット招待URL、PayPay受取リンクなど開催をまたぐ共通設定を扱い、設定が増えても各開催管理へ混在させない。LINEオープンチャットURLは`groups.line_open_chat_url`へnullableで保持し、About routeは値がある場合だけコミュニティ導線を描画する。既存`river-check`は移行で現在のURLを引き継ぎ、新規groupはNULLで開始する。",
);
