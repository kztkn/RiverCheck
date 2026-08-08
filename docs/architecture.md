# アーキテクチャ

## 全体構成

```text
Browser
  ↓ HTTP
React Router route (loader / action + React component)
  ↓
server/services       認可、入力検証、ユースケースの組み立て
  ↓
server/repositories   パラメータ化 SQL、DB 行と型の変換
  ↓
server/db             pg Client、PostgreSQL

domain                DB や HTTP に依存しない純粋な業務計算
```

React Router が UI と HTTP 境界を担当する。MVP では別 REST API を作らず、画面の loader/action が service を呼び出す。route とコンポーネントへ SQL または複雑な計算を書かない。

## ディレクトリ

- `app/routes`: URL ごとの loader/action と画面
- `app/components`, `app/features`: 再利用 UI と機能単位の UI（必要になった時点で追加）
- `domain`: 点数、順位、チップ検算、会場費精算、共有文生成などの純粋関数
- `server/services`: アプリケーションユースケース、入力検証、認可
- `server/repositories`: PostgreSQL クエリ
- `server/db`: 接続、migration runner、seed
- `migrations`: 適用順に並ぶ SQL migration
- `types`: route / domain / DB 境界で共有する型
- `workers`: Cloudflare Worker entry point
- `docs`: 要件、構成、業務ルール、TODO

## Cloudflare Workers と PostgreSQL

ローカルでは `.dev.vars` の `DATABASE_URL` を `cloudflare:workers` の `env` から取得する。本番は同じ名前の secret、または Cloudflare Hyperdrive の `HYPERDRIVE.connectionString` を利用できる。Hyperdrive がある場合はそちらを優先する。

`wrangler.jsonc` は `nodejs_compat` を有効にし、`pg` が必要とする Node.js 互換 API を Workers 上で利用する。Worker は Smart Placement を有効にし、外部 PostgreSQL に近い場所で実行できる構成とする。

Workers はリクエストをまたいだネットワーク I/O の再利用を許可しないため、DB 問い合わせごとに新しい pg Client を作成して同じ処理内で閉じる。本番で Hyperdrive を利用する場合、PostgreSQL への接続プールは Hyperdrive が管理する。SQL は repository 内でプレースホルダーを使って実行する。

## DB 設計上の判断

- ID は外部公開や複数グループ対応を考慮して UUID とする
- 金額、チップ、点数は整数だけを扱い PostgreSQL `BIGINT` とする
- 状態値は変更しやすい `TEXT + CHECK` とし、PostgreSQL enum へ固定しない
- `game_participants` は編集中の現在値、`game_results` は確定履歴として分離する
- `game_results` は開催内でプレイヤーと順位を一意にし、確定スナップショットの重複を防ぐ
- 同名プレイヤーは許可し、表示名ではなく UUID で識別する
- トークンは 64 文字の SHA-256 hex として保存する
- `games.rounding_unit` は既存スキーマとの互換用に残すが、DB制約とrepositoryで100固定にする

## 参加者のブラウザ識別

参加時に32バイトの暗号学的乱数からtokenを生成し、DBにはSHA-256ハッシュだけを保存する。平文tokenは開催URL配下だけへ送信される `HttpOnly`、`SameSite=Lax` のCookieに保持し、HTML、URL、ログ、DBには出さない。Cookie名はgame UUIDごとに分け、同じブラウザが複数開催へ参加できるようにする。本番HTTPSでは `Secure` も付与する。

既存のgame participantにtokenハッシュがある場合、別ブラウザからの再取得を拒否する。本人Cookieを利用できなくなった場合は、主催者が参加取消を行い、本人が参加し直す。参加取消ではその開催の入力済みremaining_chipsとrebuy_countも削除する。

## 主催者導線

MVPの主催者ホームは `/g/:groupCode/manage` とする。身内利用に限定するため認証処理、token query parameter、主催者Cookieは設けない。主催者ホームから開催作成、メンバー管理、各開催の管理画面へ移動する。参加者向け画面からも主催者画面へ戻れるようにする。

## 新規開催作成

1. route action が `FormData` を service 用の値へ変換する
2. service が必須値、非負整数、100円単位、順位別負担額の成立条件を検証する
3. repository がパラメータ化 INSERT を実行する
4. `open` の開催を作成し、開催の管理画面へ移動する

## finalize

service が `pg` の client を取得して `BEGIN` し、gameと参加者行をロックする。全員の入力と4人以上の参加を確認し、domain関数で検算、点数、順位、負担額を計算する。差分がある場合は主催者の確認を必須にする。game_resultsへのINSERTとgameのfinalized更新を同一transactionで実行し、途中失敗時はrollbackする。

## 確定結果とLINE共有

finalizedの開催ではgame_resultsを順位順に取得し、参加者用URLと主催者画面の共通コンポーネントで表示する。LINE用テキストはdomainの純粋関数で生成する。コピーはHTTPSまたはlocalhostではClipboard APIを優先し、同一LANのHTTPなど利用できない環境ではtextarea選択とcopy commandへフォールバックする。自動コピーが拒否された場合は選択状態にして手動コピーを案内する。
