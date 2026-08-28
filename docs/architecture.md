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

## 共通ページフレーム

全routeの`main.page-shell`はモバイル左右16px、640px以上では左右32px、最大900pxの共通外枠を使用する。ヘッダーは外枠からはみ出さず幅100%とし、ロゴ・メニューと本文の左右端がページ切替時に移動しないようにする。route固有の外枠幅は持たせず、各画面内で必要な読みやすさは文章やフォームなど内側の要素の最大幅で調整する。

ヘッダーは本文より上のstacking contextに置き、メニューパネルは不透明な背景で表示する。transformを使った外枠からのはみ出しは、メニューと本文の重なり順を分断するため使用しない。

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

## PWAとクライアントキャッシュ

Web App Manifestは`id`、`start_url`、`scope`を`/`で固定し、通常・maskable・Apple用アイコンを提供する。production build後にNode.jsスクリプトがクライアントJS/CSSの内容からversionを生成し、Service Workerテンプレートへ注入する。新しいrouteやchunkはversionへ自動反映し、機能追加ごとのキャッシュ一覧更新を不要にする。

Service Workerはオフライン案内、manifest、PWAアイコンを事前キャッシュし、`/assets/`のハッシュ付き静的ファイルは利用時だけCache Firstで保存する。React RouterのSSR HTML、`.data`、R2配信画像、認証・参加・結果・精算・プロフィールresponse、POSTは傍受・保存しない。navigationはNetwork Onlyとし、通信失敗時だけ静的なオフライン案内を返す。これにより別利用者の情報や古い参加・精算状態を端末キャッシュから表示しない。

Service Workerの新versionはwaiting状態で通知し、利用者が更新操作を選んだ場合だけ`skipWaiting`して再読込する。結果入力中の自動更新は行わない。開発時はService Workerを登録せず、production buildまたは本番HTTPSで検証する。

Service WorkerはWeb Pushの`push`イベントで通知を表示し、`notificationclick`ではpayload内の同一origin相対URLだけを開く。通知許可と`PushManager.subscribe()`は本人が個人ページの開催通知をONにした操作からだけ実行する。ブラウザが発行したendpoint・`p256dh`・`auth`は本人プロフィールCookieで認証したactionから保存し、HTMLへendpointそのものは返さずSHA-256だけで現在端末との一致を確認する。

`player_push_subscriptions`は`player_id`を主キーとして1人1件だけ保持する。別端末からの登録は既存行を上書きし、同じendpointでプロフィールを切り替えた場合は新しいplayerへ付け替える。開催作成のINSERT成功後、同じgroupの有効メンバーの購読先へ少人数分を並列送信する。結果確定通知は確定トランザクションのコミット後、`game_participants`と購読テーブルの両方に存在するplayerだけへ送る。送信処理は完了を待つが、個別失敗や通知設定不足で開催作成・結果確定を失敗させない。404・410は上書き競合を避けるためplayerとendpointが現在も一致する場合だけ削除する。Queues、送信履歴、複数端末管理は導入しない。

VAPID公開鍵・秘密JWK・連絡先subjectはCloudflare Secretから取得する。秘密JWKをクライアント、HTML、Git、ログへ出さない。endpointはHTTPSかつApple・Google・Mozilla・Microsoftの既知Pushサービスhostだけを受け入れ、外部POST先として任意URLを登録できないようにする。Web Pushリクエストの暗号化とVAPID署名はWeb Crypto互換の`@pushforge/builder`へ閉じ込める。

## Cloudflare Workers と PostgreSQL

ローカルでは `.dev.vars` の `DATABASE_URL` を `cloudflare:workers` の `env` から取得する。本番は同じ名前の secret、または Cloudflare Hyperdrive の `HYPERDRIVE.connectionString` を利用できる。Hyperdrive がある場合はそちらを優先する。

`npm run dev` のHyperdrive bindingは `wrangler.jsonc` の `localConnectionString` でDocker PostgreSQLへ接続する。migrationとseedは無指定コマンドをローカルDB専用とし、Neonへ適用する場合だけ `:production` コマンドと `.env` を明示的に使用する。

Cloudflare Workers Buildsでは`release:build`をBuild commandとして、型検査、テスト、production buildがすべて成功した後に本番migrationを適用し、別のDeploy commandでWorkerを公開する。Build環境の`DATABASE_URL`にはHyperdriveではなく本番PostgreSQLの直接接続URLをSecretとして設定する。migration runnerは`schema_migrations`によるファイル単位の冪等性に加え、全migrationを通してsession-level PostgreSQL advisory lockを保持し、再実行や並行buildを直列化する。接続終了時にlockは自動解放される。

buildとdeployの間は旧Workerが新schemaへ接続し得るため、自動適用するmigrationは追加的かつ後方互換なものに限定する。カラムや制約の削除、rename、既存値と非互換な型変更は、旧コードからの利用を先に停止するexpand-contractの複数リリースで行う。

`wrangler.jsonc` は `nodejs_compat` を有効にし、`pg` が必要とする Node.js 互換 API を Workers 上で利用する。Worker は Smart Placement を有効にし、外部 PostgreSQL に近い場所で実行できる構成とする。

Workers はリクエストをまたいだネットワーク I/O の再利用を許可しないため、DB 問い合わせごとに新しい pg Client を作成して同じ処理内で閉じる。本番で Hyperdrive を利用する場合、PostgreSQL への接続プールは Hyperdrive が管理する。SQL は repository 内でプレースホルダーを使って実行する。

## TABLE STORIESとCloudflare R2

TABLE STORIESは主催者を含む全投稿を`game_story_posts`へ保存し、`game_participant_id`の一意制約で1参加者1件にする。固定の主催者名義は作らず、投稿者のプレイヤー名、アイコン、開催結果を共通表示する。本文、写真メタデータ、作成・更新時刻に加え、主催者削除の`deleted_at`と`deleted_by_type`を保持する。画像本体はPostgreSQLへ保存しない。

参加者の終了時入力actionは`game_participants`の残りチップ・リバイ証・提出状態だけを更新し、投稿を扱わない。TABLE STORIESの投稿専用actionは`finalized`の参加者だけを対象に、本人のprofile sessionまたはparticipant tokenを再確認して`game_story_posts`だけを更新し、確定結果には触れない。写真object keyの楽観ロックで別画面からの同時更新を検出する。公開一覧は全参加者投稿を作成時刻の古い順に並べる。

画像は専用resource routeからWorker経由で配信し、R2 bucket自体は公開しない。参加者投稿写真は`open`中は本人・主催者だけ、`finalized`後は開催詳細の閲覧者へ配信する。soft delete済みまたはDB参照が外れたobjectは配信しない。

ブラウザはアップロード前にCanvasで長辺1,800px以内へ縮小し、WebPを優先して圧縮する。WebP canvas変換が利用できないブラウザはJPEGへ自動フォールバックする。Worker側もcontent type、ファイルシグネチャ、3MB上限を検証する。object keyはgame単位のprefixとランダムUUIDで衝突を避ける。

R2とPostgreSQLをまたぐ分散トランザクションは作らない。参加者投稿はR2へ新画像を保存してからDB参照を更新し、DB更新失敗時の新画像と更新成功後の旧画像をbest effortで削除する。主催者削除ではDBを先にsoft deleteして即座に非公開化し、その後でR2 objectをbest effortで削除する。R2削除失敗時も表示は復活させず、DB参照を正とする。

## Worker入口のRate Limiting

POSTリクエストはReact Routerへ渡す前にパスを分類し、Workers Rate Limiting bindingで同一IP単位の回数を確認する。主催者PIN入力、主催者変更操作、参加者の参加・入力操作でnamespaceと上限を分け、超過時はDB接続やmultipart解析前に429を返す。GETは通常の閲覧を妨げないため対象外とする。

Rate Limiting APIは拠点単位かつ結果整合性が緩やかな防御であり、正確な利用回数の記録には使わない。強い主催者PIN、署名済みCookie、入力検証と組み合わせる多層防御として扱う。

## エラー画面とログアウト

React Router内で発生した画面表示エラーはrootのErrorBoundaryで共通エラー画面にする。加えて、ブラウザの通常遷移に対してWorker入口やフレームワークがHTMLではない400以上のresponseを返した場合は、DBに依存しない`/error` routeを内部描画し、元のHTTP statusを保ったHTML responseへ置き換える。resource responseとデータ通信は変換しない。共通画面の描画にも失敗した場合はWorker内の最小HTMLを最後のフォールバックとする。

プレイヤーと主催者のログアウトはそれぞれ専用のPOST routeでCookie削除と303 redirectだけを行う。プロフィールroute、ログインroute、DB照会、FormData解析、書き込み用Rate Limitingから切り離し、一時的なDB障害や操作集中時にもログアウトできる構成とする。

## DB 設計上の判断

- ID は外部公開や複数グループ対応を考慮して UUID とする
- 金額、チップ、点数は整数だけを扱い PostgreSQL `BIGINT` とする
- 状態値は変更しやすい `TEXT + CHECK` とし、PostgreSQL enum へ固定しない
- `game_participants` はライブの累計・未返済と終了時入力、`game_rebuy_events`は操作履歴、`game_results`は確定スナップショット、`game_result_revisions`は訂正前後の履歴として分離する
- リバイ操作はrouteからserviceを経由し、participant行のロック、状態遷移、イベント追加を1つのPostgreSQLトランザクションで行う。イベントの`command_id`一意制約で同じPOSTの再送を冪等化する
- リバイ履歴は専用テーブルに限定し、今回の段階では汎用的なgame event sourcingへ拡張しない
- `game_results` は開催内でプレイヤーと順位を一意にし、確定スナップショットの重複を防ぐ
- 同名プレイヤーは許可し、表示名ではなく UUID で識別する
- トークンは 64 文字の SHA-256 hex として保存する
- `games.rounding_unit` は既存スキーマとの互換用に残すが、DB制約とrepositoryで100固定にする
- `games.cost_shares` は検証済みの全順位負担額を`BIGINT[]`で保存する。移行前のNULLだけは1〜3位設定から従来計算する
- `games.seven_deuce_rule_enabled` は72oボーナスの開催単位スナップショットとする。新規開催の既定値はONだが、導入前データは移行時にOFFとして過去開催へ遡及させない
- `games.bomb_pot_rule_enabled` はボムポットの開催単位スナップショットとする。新規開催の既定値はONだが、導入前データは移行時にOFFとして過去開催へ遡及させない
- ローカルルールの文言は`domain/rules/local-rules.ts`へ集約し、受付中の参加者画面は100BB返済ルール、72o設定、ボムポット設定を同じ参照用ボトムシートへ描画する。確定結果では表示せず、各ルールの成立や支払いはDBイベント化しない
- TABLE STORIESは投稿者の役割にかかわらず`game_story_posts`へ保存し、`game_participant_id`で一意にする
- チップ終了入力とTABLE STORIES投稿を別ユースケースにし、投稿repositoryは`finalized`の参加者だけを更新対象にする

## 参加者のブラウザ識別

参加時に32バイトの暗号学的乱数からtokenを生成し、DBにはSHA-256ハッシュだけを保存する。平文tokenは開催URL配下だけへ送信される `HttpOnly`、`SameSite=Lax` のCookieに保持し、HTML、URL、ログ、DBには出さない。Cookie名はgame UUIDごとに分け、同じブラウザが複数開催へ参加できるようにする。本番HTTPSでは `Secure` も付与する。

参加者routeのloaderは開催、プロフィール、参加状態などの参照だけを行い、参加登録を含むDB更新を行わない。プロフィール認証済みの本人参加は`intent=join-self`のPOST actionからserviceを呼び、serviceがプロフィールsessionとgroup playerをサーバー側で再検証してから参加登録する。登録はgameとgroup playerの有効性・受付中状態をSQLでも確認し、`game_participants(game_id, group_player_id)`の一意制約と競合時の既存行確認によって二重送信を冪等に扱う。成功後は参加者URLへ303 redirectする。

既存のgame participantにtokenハッシュがある場合、別ブラウザからの再取得を拒否する。本人Cookieを利用できなくなった場合は、主催者が参加取消を行い、本人が参加し直す。参加取消ではその開催の入力済みremaining_chips、リバイ状態、game_rebuy_eventsも削除する。

## プレイヤープロフィールと本人端末

プロフィールは`players`へ1件だけ持ち、`group_players`はグループ所属を表す。ユーザーネームの変更は過去結果やランキングを含む全所属先へ反映する。アイコン本体は開催写真と同じ非公開R2 bucketへ`players/{playerId}/{uuid}.{ext}`で保存し、DBには現在参照するobject keyとメタデータだけを保存する。配信routeはgroupPlayerIdが指定グループに所属することを確認してからR2 objectを返す。

本人端末tokenは32バイトの暗号学的乱数とし、DBの`player_profile_sessions`にはSHA-256ハッシュだけを保存する。平文tokenはPath=/のHttpOnly、SameSite=Lax、1年有効のCookieへ保持し、本番HTTPSではSecureを付ける。新規playerは参加と同時にsessionを作成する。

事前登録済みplayerは主催者が発行する本人用リンクで初回claimする。URLの平文tokenは24時間有効で、GET表示では消費せず、本人の確認POSTをトランザクションでロックして1回だけ消費する。再発行時は未使用の旧claimを無効化する。既存sessionは別端末追加を妨げないため維持する。

アイコンはブラウザで中央を512px正方形へ縮小し、WebP優先・非対応時JPEGで1MB以内へ圧縮する。Workerでもシグネチャと上限を再検証する。R2とDBの分散トランザクションは作らず、置換後の旧objectは運用削除する。

実績マスタは`achievements`、現在の正式な確定履歴から成立している獲得状態は`player_achievements`、装備中の1件は`group_players.equipped_achievement_id`へ分離する。プロフィール編集routeはCookie認証済みの`groupPlayerId`だけをserviceへ渡し、serviceとrepositoryの両方で同じ所属の獲得済み実績かを検証する。プロフィール本体と装備実績は1つのPostgreSQLトランザクションで保存する。未獲得hidden実績の名称・説明はserviceで伏せてloaderデータへ含めない。

ランキング取得では`group_players.equipped_achievement_id`を直接公開せず、同じ`group_player`の`player_achievements`を経由して実績マスタを結合する。装備中かつ獲得済みと確認できた1件だけをランキングrowへ含め、共通のAchievementBadgeをcompact表示で再利用する。

ランキング指標はPlayerStatsRepositoryの確定結果CTEで集約する。開催参加人数は`game_id`単位のwindow count、最近の3参加は`group_player_id`単位のrow numberで求める。sort値はserviceの許可リストと固定のSQL ORDER BY対応表からだけ選び、リクエスト値をSQLへ直接埋め込まない。

## 主催者導線と認証

主催者ホームは `/g/:groupCode/manage` とする。ホーム上部はメンバー管理とグループ設定への導線に絞り、開催作成は開催管理セクション内の操作として配置する。`/g/:groupCode/settings` はPayPay受取リンクなど開催をまたぐ共通設定を扱い、設定が増えても各開催管理へ混在させない。

主催者ホーム、開催作成、メンバー管理、グループ設定、各開催管理のloader/actionは共通のサーバー認証を通し、未認証時は `/g/:groupCode/organizer-login` へ移動する。グループ設定の更新はserviceで入力検証・保存し、Workersの主催者変更用Rate Limiting対象となるPOST actionからだけ実行する。参加者向け画面からもこの認証入口を経由して主催者画面へ戻れる。

PIN・合言葉と32文字以上の署名鍵はCloudflare Secretで受け取る。PIN照合はSHA-256ダイジェストを固定時間比較し、成功時は有効期限を含むpayloadへHMAC-SHA-256署名したセッションCookieを発行する。CookieはHttpOnly、SameSite=Lax、Path=/g/、有効期間180日とし、本番HTTPSではSecureも付与する。PINそのものはCookie、HTML、URL、DBへ保存しない。Secret未設定時はfail closedとし、管理画面を公開しない。

## 新規開催作成

1. route action が `FormData` を service 用の値へ変換する
2. service が必須値、全順位件数、非負整数、100円単位、順位傾斜、精算総額との合計一致を検証する
3. repository がパラメータ化 INSERT を実行する
4. `open` の開催を作成し、開催の管理画面へ移動する
5. 作成済み開催をロールバックせず、通知ONの有効メンバーへWeb Pushを送る

## 受付中開催の管理

開催名変更と開催削除は、主催者認証済みの開催管理actionからserviceを経由して実行する。repositoryの`UPDATE`と`DELETE`にも`group_id`と`status = 'open'`を含め、画面表示後に確定された場合や別グループIDが指定された場合は変更しない。開催名変更はgame IDを維持するため参加者用URLを変えず、作成時のWeb Pushは再送しない。

開催削除は確認ダイアログを通した物理削除とする。`game_participants`はgamesへの`ON DELETE CASCADE`、リバイイベントとTABLE STORIESはparticipantへの`ON DELETE CASCADE`で従属データを削除する。TABLE STORIESはfinalized後だけ投稿でき、finalized開催は削除対象外のため、R2投稿写真を伴う開催削除は発生しない。`game_results`と訂正履歴の`ON DELETE RESTRICT`も、確定履歴を誤って削除しないDB側の防御として維持する。

## finalize

service が `pg` の client を取得して `BEGIN` し、gameと参加者行をロックする。全員の入力と4人以上の参加を確認し、domain関数で検算、点数、順位、負担額を計算する。差分がある場合は主催者の確認を必須にする。game_resultsへのINSERT、gameのfinalized更新、現在の確定済み履歴に基づく実績同期を同一transactionで実行し、途中失敗時はrollbackする。

## 確定後の結果訂正

主催者routeは既存参加者全員の残りチップ・リバイ回数を配列で受け取り、serviceがgame、game_participants、game_resultsをロックする。対象参加者集合が確定時から変わっていないことを検証し、既存のdomain関数で全順位・会費を再計算する。

repositoryは訂正前後のGameResultSummary配列をJSONBとしてgame_result_revisionsへ保存した後、game_participantsを更新し、順位一意制約との衝突を避けるためgame_resultsを同一トランザクション内で置換する。gameはfinalizedのまま、共有URLも維持する。履歴取得は参加者用公開routeでも許可し、入力、順位、BB、会費の差分を共通コンポーネントで表示する。

結果置換後は同じトランザクション内でAchievementServiceが対象プレイヤーの確定済み参加履歴全体を再評価する。成立中の実績は`ON CONFLICT DO UPDATE`で獲得契機を同期し、成立しなくなった管理対象実績は削除する。削除する実績が装備中なら先に装備を解除する。これにより訂正開催より後の連続条件も正式な履歴と一致させる。導入時の既存確定結果はmigrationで同じ条件により再計算・同期し、個人ページのloaderは実績を読み取るだけで書込みを行わない。


## 確定結果とLINE共有

finalizedの開催ではgame_resultsを順位順に取得し、参加者用URLと主催者画面の共通コンポーネントで表示する。順位判定とDB保存は整数scoreのまま維持し、表示時にgames.initial_chipsを100BBとして初期スタック分を差し引いた損益BBへ換算する。共有操作は主催者画面だけに表示する。LINE用テキストはdomainの純粋関数で生成し、計算式は含めない。共有URLはgame UUIDを22文字のBase64URLへ可逆変換した`/r/:resultCode`を使用する。短縮routeは確定済み開催だけを既存の参加者用URLへredirectし、DBへの短縮コード保存や外部短縮サービスは使用しない。コピーはHTTPSまたはlocalhostではClipboard APIを優先し、同一LANのHTTPなど利用できない環境ではtextarea選択とcopy commandへフォールバックする。自動コピーが拒否された場合は選択状態にして手動コピーを案内する。

会費回収確認は`game_cost_share_receipts`へ`game_id`と`group_player_id`の組み合わせ、および受取日時を保持する。公開結果のloaderでは主催者認証済みの場合だけ取得し、更新actionも主催者認証を必須とする。受取状態の更新では対象の確定結果行をロックし、0円または確定結果に存在しない参加者への登録を拒否する。結果訂正では会費負担額が変わった参加者の受取確認を、結果置換と同じトランザクション内で削除する。
