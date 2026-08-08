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
- `domain`: 点数、順位、チップ検算、会費精算、共有文生成などの純粋関数
- `server/services`: アプリケーションユースケース、入力検証、認可
- `server/repositories`: PostgreSQL クエリ
- `server/db`: 接続、migration runner、seed
- `migrations`: 適用順に並ぶ SQL migration
- `types`: route / domain / DB 境界で共有する型
- `workers`: Cloudflare Worker entry point
- `docs`: 要件、構成、業務ルール、TODO

## Cloudflare Workers と PostgreSQL

ローカルでは `.dev.vars` の `DATABASE_URL` を `cloudflare:workers` の `env` から取得する。本番は同じ名前の secret、または Cloudflare Hyperdrive の `HYPERDRIVE.connectionString` を利用できる。Hyperdrive がある場合はそちらを優先する。

`npm run dev` のHyperdrive bindingは `wrangler.jsonc` の `localConnectionString` でDocker PostgreSQLへ接続する。migrationとseedは無指定コマンドをローカルDB専用とし、Neonへ適用する場合だけ `:production` コマンドと `.env` を明示的に使用する。

`wrangler.jsonc` は `nodejs_compat` を有効にし、`pg` が必要とする Node.js 互換 API を Workers 上で利用する。Worker は Smart Placement を有効にし、外部 PostgreSQL に近い場所で実行できる構成とする。

Workers はリクエストをまたいだネットワーク I/O の再利用を許可しないため、DB 問い合わせごとに新しい pg Client を作成して同じ処理内で閉じる。本番で Hyperdrive を利用する場合、PostgreSQL への接続プールは Hyperdrive が管理する。SQL は repository 内でプレースホルダーを使って実行する。

## 開催ハイライトとCloudflare R2

確定後の主催者画面のmultipart actionが `GameHighlightService` を呼び、文章を検証して写真をR2へ保存した後、`GameHighlightRepository` が `games` の文章と写真メタデータを更新する。画像本体はPostgreSQLへ保存しない。参加者向け結果画面はloaderで公開用メタデータを取得し、画像は専用resource routeからWorker経由で配信する。R2 bucket自体は公開しない。

ブラウザはアップロード前にCanvasで長辺1,800px以内へ縮小し、WebPを優先して圧縮する。WebP canvas変換が利用できないブラウザはJPEGへ自動フォールバックする。Worker側もcontent type、ファイルシグネチャ、3MB上限を検証する。object keyはgame単位のprefixとランダムUUIDで衝突を避ける。

R2とPostgreSQLをまたぐ分散トランザクションは作らない。写真の置換・参照解除ではgamesの参照だけを更新し、旧objectやDB更新失敗時の未参照objectは残す。未参照objectはR2上で運用削除する。これにより、DB更新後に旧画像削除が失敗して表示まで壊れる経路を持たせない。

## Worker入口のRate Limiting

POSTリクエストはReact Routerへ渡す前にパスを分類し、Workers Rate Limiting bindingで同一IP単位の回数を確認する。主催者PIN入力、主催者変更操作、参加者の参加・入力操作でnamespaceと上限を分け、超過時はDB接続やmultipart解析前に429を返す。GETは通常の閲覧を妨げないため対象外とする。

Rate Limiting APIは拠点単位かつ結果整合性が緩やかな防御であり、正確な利用回数の記録には使わない。強い主催者PIN、署名済みCookie、入力検証と組み合わせる多層防御として扱う。

## DB 設計上の判断

- ID は外部公開や複数グループ対応を考慮して UUID とする
- 金額、チップ、点数は整数だけを扱い PostgreSQL `BIGINT` とする
- 状態値は変更しやすい `TEXT + CHECK` とし、PostgreSQL enum へ固定しない
- `game_participants` は参加者入力の現在値、`game_results` は現在公開する確定結果、`game_result_revisions` は訂正前後の履歴として分離する
- `game_results` は開催内でプレイヤーと順位を一意にし、確定スナップショットの重複を防ぐ
- 同名プレイヤーは許可し、表示名ではなく UUID で識別する
- トークンは 64 文字の SHA-256 hex として保存する
- `games.rounding_unit` は既存スキーマとの互換用に残すが、DB制約とrepositoryで100固定にする
- MVPのハイライトは1開催につき文章1件・写真1枚のためgamesへ直接持たせ、複数写真が必要になった時点で別テーブルへ移行する

## 参加者のブラウザ識別

参加時に32バイトの暗号学的乱数からtokenを生成し、DBにはSHA-256ハッシュだけを保存する。平文tokenは開催URL配下だけへ送信される `HttpOnly`、`SameSite=Lax` のCookieに保持し、HTML、URL、ログ、DBには出さない。Cookie名はgame UUIDごとに分け、同じブラウザが複数開催へ参加できるようにする。本番HTTPSでは `Secure` も付与する。

既存のgame participantにtokenハッシュがある場合、別ブラウザからの再取得を拒否する。本人Cookieを利用できなくなった場合は、主催者が参加取消を行い、本人が参加し直す。参加取消ではその開催の入力済みremaining_chipsとrebuy_countも削除する。

## プレイヤープロフィールと本人端末

プロフィールは`players`へ1件だけ持ち、`group_players`はグループ所属を表す。ユーザーネームの変更は過去結果や個人戦績を含む全所属先へ反映する。アイコン本体は開催写真と同じ非公開R2 bucketへ`players/{playerId}/{uuid}.{ext}`で保存し、DBには現在参照するobject keyとメタデータだけを保存する。配信routeはgroupPlayerIdが指定グループに所属することを確認してからR2 objectを返す。

本人端末tokenは32バイトの暗号学的乱数とし、DBの`player_profile_sessions`にはSHA-256ハッシュだけを保存する。平文tokenはPath=/のHttpOnly、SameSite=Lax、1年有効のCookieへ保持し、本番HTTPSではSecureを付ける。新規playerは参加と同時にsessionを作成する。

事前登録済みplayerは主催者が発行する本人用リンクで初回claimする。URLの平文tokenは24時間有効で、GET表示では消費せず、本人の確認POSTをトランザクションでロックして1回だけ消費する。再発行時は未使用の旧claimを無効化する。既存sessionは別端末追加を妨げないため維持する。

アイコンはブラウザで中央を512px正方形へ縮小し、WebP優先・非対応時JPEGで1MB以内へ圧縮する。Workerでもシグネチャと上限を再検証する。R2とDBの分散トランザクションは作らず、置換後の旧objectは運用削除する。

## 主催者導線と認証

主催者ホームは `/g/:groupCode/manage` とする。主催者ホーム、開催作成、メンバー管理、各開催管理のloader/actionは共通のサーバー認証を通し、未認証時は `/g/:groupCode/organizer-login` へ移動する。参加者向け画面からもこの認証入口を経由して主催者画面へ戻れる。

PIN・合言葉と32文字以上の署名鍵はCloudflare Secretで受け取る。PIN照合はSHA-256ダイジェストを固定時間比較し、成功時は有効期限を含むpayloadへHMAC-SHA-256署名したセッションCookieを発行する。CookieはHttpOnly、SameSite=Lax、Path=/g/、有効期間180日とし、本番HTTPSではSecureも付与する。PINそのものはCookie、HTML、URL、DBへ保存しない。Secret未設定時はfail closedとし、管理画面を公開しない。

## 新規開催作成

1. route action が `FormData` を service 用の値へ変換する
2. service が必須値、非負整数、100円単位、順位別負担額の成立条件を検証する
3. repository がパラメータ化 INSERT を実行する
4. `open` の開催を作成し、開催の管理画面へ移動する

## finalize

service が `pg` の client を取得して `BEGIN` し、gameと参加者行をロックする。全員の入力と4人以上の参加を確認し、domain関数で検算、点数、順位、負担額を計算する。差分がある場合は主催者の確認を必須にする。game_resultsへのINSERTとgameのfinalized更新を同一transactionで実行し、途中失敗時はrollbackする。

## 確定後の結果訂正

主催者routeは既存参加者全員の残りチップ・リバイ回数を配列で受け取り、serviceがgame、game_participants、game_resultsをロックする。対象参加者集合が確定時から変わっていないことを検証し、既存のdomain関数で全順位・会費を再計算する。

repositoryは訂正前後のGameResultSummary配列をJSONBとしてgame_result_revisionsへ保存した後、game_participantsを更新し、順位一意制約との衝突を避けるためgame_resultsを同一トランザクション内で置換する。gameはfinalizedのまま、共有URLも維持する。履歴取得は参加者用公開routeでも許可し、入力、順位、BB、会費の差分を共通コンポーネントで表示する。


## 確定結果とLINE共有

finalizedの開催ではgame_resultsを順位順に取得し、参加者用URLと主催者画面の共通コンポーネントで表示する。順位判定とDB保存は整数scoreのまま維持し、表示時にgames.initial_chipsを100BBとしてBBスコアへ換算する。共有操作は主催者画面だけに表示する。LINE用テキストはdomainの純粋関数で生成する。コピーはHTTPSまたはlocalhostではClipboard APIを優先し、同一LANのHTTPなど利用できない環境ではtextarea選択とcopy commandへフォールバックする。自動コピーが拒否された場合は選択状態にして手動コピーを案内する。
