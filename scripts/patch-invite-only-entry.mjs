import fs from "node:fs";

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(search)) {
    if (source.includes(replacement)) return;
    throw new Error(`Anchor not found in ${path}`);
  }
  fs.writeFileSync(path, source.replace(search, replacement));
}

function appendOnce(path, marker, content) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  fs.writeFileSync(path, `${source.trimEnd()}\n\n${content.trim()}\n`);
}

const gamePath = "app/routes/game-participant.tsx";
replaceOnce(
  gamePath,
  'import { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";\n',
  'import { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";\nimport { INVITE_REQUIRED_RESPONSE_TEXT } from "@domain/routing/public-group-entry";\n',
);
replaceOnce(
  gamePath,
  `  const [isOrganizer, profileOverview] = await Promise.all([\n    isOrganizerAuthenticated(request),\n    getAuthenticatedPlayerProfile(request, params.groupCode),\n  ]);\n  const url = new URL(request.url);`,
  `  const [isOrganizer, profileOverview] = await Promise.all([\n    isOrganizerAuthenticated(request),\n    getAuthenticatedPlayerProfile(request, params.groupCode),\n  ]);\n\n  if (\n    context.game.status !== "open" &&\n    !isOrganizer &&\n    !profileOverview?.profile\n  ) {\n    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });\n  }\n\n  const url = new URL(request.url);`,
);

appendOnce(
  "app/routes/game-participant.test.ts",
  'describe("finalized game invite-only access"',
  `describe("finalized game invite-only access", () => {\n  it("未所属ゲストは確定済み開催を閲覧できない", async () => {\n    vi.resetAllMocks();\n    mocked.findGroupByPublicCode.mockResolvedValue(group);\n    mocked.findGameForGroup.mockResolvedValue({\n      ...openGame,\n      status: "finalized",\n    });\n    mocked.isOrganizerAuthenticated.mockResolvedValue(false);\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile: null,\n    });\n\n    await expect(loader(loaderArgs())).rejects.toMatchObject({ status: 403 });\n  });\n});`,
);

appendOnce(
  "app/styles/app.css",
  ".entry-resolver-page",
  `/* Invite-only entry resolver */\n.entry-resolver-page,\n.entry-gate-page {\n  display: grid;\n  min-height: 100vh;\n  place-items: center;\n  padding-block: 40px;\n}\n\n.entry-resolver-loading,\n.entry-resolver-choice,\n.entry-gate-panel {\n  width: min(100%, 560px);\n}\n\n.entry-resolver-loading {\n  display: grid;\n  justify-items: center;\n  text-align: center;\n}\n\n.entry-resolver-spinner {\n  width: 42px;\n  height: 42px;\n  margin-bottom: 22px;\n  border: 3px solid rgba(223, 236, 227, 0.16);\n  border-top-color: var(--green);\n  border-radius: 50%;\n  animation: entry-resolver-spin 0.8s linear infinite;\n}\n\n.entry-resolver-loading h1,\n.entry-resolver-choice h1,\n.entry-gate-panel h1 {\n  margin: 8px 0 12px;\n  font-size: clamp(2rem, 8vw, 3.8rem);\n  line-height: 1;\n  letter-spacing: -0.055em;\n}\n\n.entry-resolver-loading > p:last-child,\n.entry-resolver-choice > p,\n.entry-gate-panel > p:last-child {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.7;\n}\n\n.entry-resolver-groups {\n  display: grid;\n  gap: 10px;\n  margin-top: 28px;\n}\n\n.entry-resolver-group {\n  display: flex;\n  min-height: 72px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  border-top: 1px solid var(--line);\n  padding: 14px 4px;\n}\n\n.entry-resolver-group:last-child {\n  border-bottom: 1px solid var(--line);\n}\n\n.entry-resolver-group > span:first-child {\n  display: grid;\n  gap: 4px;\n}\n\n.entry-resolver-group strong {\n  font-size: 1rem;\n}\n\n.entry-resolver-group small {\n  color: var(--muted);\n  font-size: 0.7rem;\n}\n\n.entry-resolver-group > span:last-child {\n  color: var(--green);\n  font-size: 1.15rem;\n}\n\n.entry-gate-panel {\n  text-align: center;\n}\n\n.entry-gate-mark {\n  margin: 18px 0 12px;\n  color: var(--green);\n  font-size: 2.1rem;\n}\n\n@keyframes entry-resolver-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}`,
);

replaceOnce(
  "docs/requirements.md",
  "- プロフィール認証済みplayerが未所属グループのopen開催共有URLを開いた場合は、現在のplayerを新しいgroup_playerとして追加し、その開催への参加まで1操作で完了できる。新しいplayers行は作成しない\n",
  "- プロフィール認証済みplayerが未所属グループのopen開催共有URLを開いた場合は、現在のplayerを新しいgroup_playerとして追加し、その開催への参加まで1操作で完了できる。新しいplayers行は作成しない\n- `/` は公開グループへ固定遷移せず、本人が利用可能なグループを解決する入口とする。前回グループが現在も利用可能なら自動遷移し、1グループだけならそこへ自動遷移、複数候補を解決できない場合はグループ選択を表示する\n- 本人が利用可能なグループを解決できない場合は `river-check` へフォールバックせず、主催者から届いた受付中の開催URLから参加するよう案内する\n- 未所属ゲストへ公開する入口はopen開催の参加ページ、主催者ログイン、プロフィールclaim、参加画面で必要なアバター配信に限定する。グループTOP、ランキング、About、管理画面などはグループ所属者または主催者だけが閲覧できる\n- 同じ開催URLはgame statusで役割を分け、open時だけ未所属者の招待入口とする。draft/finalized時は未所属ゲストへ内容を公開しない\n",
);

appendOnce(
  "docs/architecture.md",
  "## 招待制エントリとルートガード",
  `## 招待制エントリとルートガード\n\n- `/` は既定グループを持たない。profile sessionからglobal player identityを解決し、一般プレイヤーはactiveな所属グループ、app-level organizerは管理可能な全グループを候補として返す\n- clientはlocalStorageの最終訪問group codeを候補集合に対して検証し、有効ならreplace navigationする。候補が1件だけなら自動遷移し、複数かつ最終訪問先を解決できなければ選択画面を表示する\n- 候補が0件なら公開グループへフォールバックせず、open開催の招待URLを要求する\n- root loaderは未所属・非主催者のgroup routeを原則403にし、open開催の入口として必要なgame participant route、organizer login、profile claim、avatar routeだけを例外として通す\n- game participant loaderは同一URLをstatusで分岐し、openは未所属者にも参加導線を許可する一方、draft/finalizedはgroup memberまたはorganizerだけへ公開する\n- `/r/:resultCode` はfinalized gameのcanonical participant routeへredirectする短縮URLであり、redirect後は同じgroup access guardに従う`,
);
