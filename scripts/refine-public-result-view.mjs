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

// Hide group navigation for public game viewers and remove the generic player picker from the menu.
const menuPath = "app/components/site-menu.tsx";
replaceOnce(
  menuPath,
  `export function GroupSiteHeader({\n  groupCode,\n  organizer = false,\n  status,\n}: {\n  groupCode: string;\n  organizer?: boolean;\n  status?: ReactNode;\n}) {`,
  `export function GroupSiteHeader({\n  groupCode,\n  hideNavigation = false,\n  organizer = false,\n  status,\n}: {\n  groupCode: string;\n  hideNavigation?: boolean;\n  organizer?: boolean;\n  status?: ReactNode;\n}) {`,
);
replaceOnce(
  menuPath,
  `      <Link className="brand" to={\`/g/\${groupCode}\`}>\n        <span className="brand-mark">RC</span>\n        <span className="brand-copy">\n          <span>RiverCheck</span>\n          {activeGroupName ? <small>{activeGroupName}</small> : null}\n        </span>\n      </Link>`,
  `      {hideNavigation ? (\n        <span className="brand">\n          <span className="brand-mark">RC</span>\n          <span className="brand-copy">\n            <span>RiverCheck</span>\n            {activeGroupName ? <small>{activeGroupName}</small> : null}\n          </span>\n        </span>\n      ) : (\n        <Link className="brand" to={\`/g/\${groupCode}\`}>\n          <span className="brand-mark">RC</span>\n          <span className="brand-copy">\n            <span>RiverCheck</span>\n            {activeGroupName ? <small>{activeGroupName}</small> : null}\n          </span>\n        </Link>\n      )}`,
);
replaceOnce(
  menuPath,
  `        <GroupSiteMenu\n          groupCode={groupCode}\n          hasPlayer={Boolean(authenticatedPlayerName)}\n          groupPlayerId={authenticatedPlayerGroupPlayerId}\n          hasMultipleGroups={hasMultipleGroups}\n          organizer={isOrganizer}\n        />`,
  `        {hideNavigation ? null : (\n          <GroupSiteMenu\n            groupCode={groupCode}\n            hasPlayer={Boolean(authenticatedPlayerName)}\n            groupPlayerId={authenticatedPlayerGroupPlayerId}\n            hasMultipleGroups={hasMultipleGroups}\n            organizer={isOrganizer}\n          />\n        )}`,
);
replaceOnce(
  menuPath,
  `  const items: SiteMenuItem[] = [\n    { icon: "stats", label: "ランキング", to: \`\${basePath}/stats\` },\n    {\n      icon: "profile",\n      label: hasPlayer && groupPlayerId\n        ? "プロフィール"\n        : "プレイヤーを選択",\n      to: hasPlayer && groupPlayerId\n        ? \`\${basePath}/stats/\${groupPlayerId}\`\n        : \`\${basePath}/profile\`,\n    },\n  ];`,
  `  const items: SiteMenuItem[] = [\n    { icon: "stats", label: "ランキング", to: \`\${basePath}/stats\` },\n  ];\n\n  if (hasPlayer && groupPlayerId) {\n    items.push({\n      icon: "profile",\n      label: "プロフィール",\n      to: \`\${basePath}/stats/\${groupPlayerId}\`,\n    });\n  }`,
);

// Result rows become static when opened through a public finalized URL.
const resultsPath = "app/components/final-results.tsx";
replaceOnce(
  resultsPath,
  'import { useState } from "react";',
  'import { useState, type ReactNode } from "react";',
);
replaceOnce(
  resultsPath,
  `  initialChips,\n  playedAt,\n  payPay,`,
  `  initialChips,\n  linkPlayerProfiles = true,\n  playedAt,\n  payPay,`,
);
replaceOnce(
  resultsPath,
  `  initialChips: number;\n  playedAt: string;`,
  `  initialChips: number;\n  linkPlayerProfiles?: boolean;\n  playedAt: string;`,
);
replaceOnce(
  resultsPath,
  `        <Link\n          aria-label={\`\${winner.displayName}の戦績を見る\`}\n          className="result-winner"\n          to={\`/g/\${groupCode}/stats/\${winner.groupPlayerId}\`}\n        >`,
  `        <ResultPlayerContainer\n          ariaLabel={\`\${winner.displayName}の戦績を見る\`}\n          className="result-winner"\n          groupCode={groupCode}\n          groupPlayerId={winner.groupPlayerId}\n          link={linkPlayerProfiles}\n        >`,
);
replaceOnce(resultsPath, `        </Link>\n      ) : null}\n      <div className="result-list">`, `        </ResultPlayerContainer>\n      ) : null}\n      <div className="result-list">`);
replaceOnce(
  resultsPath,
  `          <Link\n            aria-label={\`\${result.displayName}の戦績を見る\`}\n            className={\`result-row result-row-rank-\${result.rank}\${\n              result.rank <= 3 ? " is-top-three" : ""\n            }\`}\n            key={result.groupPlayerId}\n            to={\`/g/\${groupCode}/stats/\${result.groupPlayerId}\`}\n          >`,
  `          <ResultPlayerContainer\n            ariaLabel={\`\${result.displayName}の戦績を見る\`}\n            className={\`result-row result-row-rank-\${result.rank}\${\n              result.rank <= 3 ? " is-top-three" : ""\n            }\`}\n            groupCode={groupCode}\n            groupPlayerId={result.groupPlayerId}\n            key={result.groupPlayerId}\n            link={linkPlayerProfiles}\n          >`,
);
replaceOnce(resultsPath, `          </Link>\n        ))}\n      </div>`, `          </ResultPlayerContainer>\n        ))}\n      </div>`);
appendOnce(
  resultsPath,
  "function ResultPlayerContainer(",
  `function ResultPlayerContainer({\n  ariaLabel,\n  children,\n  className,\n  groupCode,\n  groupPlayerId,\n  link,\n}: {\n  ariaLabel: string;\n  children: ReactNode;\n  className: string;\n  groupCode: string;\n  groupPlayerId: string;\n  link: boolean;\n}) {\n  return link ? (\n    <Link\n      aria-label={ariaLabel}\n      className={className}\n      to={\`/g/\${groupCode}/stats/\${groupPlayerId}\`}\n    >\n      {children}\n    </Link>\n  ) : (\n    <div className={className}>{children}</div>\n  );\n}`,
);

// Public finalized URLs show the result itself, not the rest of the group.
const gamePath = "app/routes/game-participant.tsx";
replaceOnce(
  gamePath,
  `  if (\n    context.game.status !== "open" &&\n    !isOrganizer &&\n    !profileOverview?.profile &&\n    !participant\n  ) {\n    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });\n  }\n\n  const groupInvitePlayer =`,
  `  const canBrowseGroup = Boolean(profileOverview?.profile) || isOrganizer;\n  const isPublicResultViewer =\n    context.game.status === "finalized" && !canBrowseGroup && !participant;\n\n  if (\n    context.game.status === "draft" &&\n    !canBrowseGroup &&\n    !participant\n  ) {\n    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });\n  }\n\n  const groupInvitePlayer =`,
);
replaceOnce(
  gamePath,
  `  const storyPosts =\n    context.game.status === "finalized"\n      ? await getPublishedGameStoryPosts(context.group.id, params.gameId)\n      : [];`,
  `  const storyPosts =\n    context.game.status === "finalized" && !isPublicResultViewer\n      ? await getPublishedGameStoryPosts(context.group.id, params.gameId)\n      : [];`,
);
replaceOnce(
  gamePath,
  `  const finalizedGames =\n    context.game.status === "finalized"\n      ? (await listGamesForGroup(context.group.id)).filter(`,
  `  const finalizedGames =\n    context.game.status === "finalized" && canBrowseGroup\n      ? (await listGamesForGroup(context.group.id)).filter(`,
);
replaceOnce(
  gamePath,
  `  const payPayRecipientLink = isPayPayLinkActive({\n    link: context.group.payPayRecipientLink,\n    registeredAt: context.group.payPayLinkRegisteredAt,\n  })\n    ? context.group.payPayRecipientLink\n    : null;`,
  `  const payPayRecipientLink =\n    canBrowseGroup && isPayPayLinkActive({\n      link: context.group.payPayRecipientLink,\n      registeredAt: context.group.payPayLinkRegisteredAt,\n    })\n      ? context.group.payPayRecipientLink\n      : null;`,
);
replaceOnce(
  gamePath,
  `    game: context.game,\n    isOrganizer,`,
  `    game: context.game,\n    canBrowseGroup,\n    isOrganizer,\n    isPublicResultViewer,`,
);
replaceOnce(
  gamePath,
  `      <GroupSiteHeader\n        groupCode={loaderData.group.publicCode}\n        organizer={loaderData.isOrganizer}\n      />`,
  `      <GroupSiteHeader\n        groupCode={loaderData.group.publicCode}\n        hideNavigation={!loaderData.canBrowseGroup}\n        organizer={loaderData.isOrganizer}\n      />`,
);
replaceOnce(
  gamePath,
  `            initialChips={loaderData.game.initialChips}\n            playedAt={loaderData.game.playedAt}`,
  `            initialChips={loaderData.game.initialChips}\n            linkPlayerProfiles={loaderData.canBrowseGroup}\n            playedAt={loaderData.game.playedAt}`,
);
replaceOnce(
  gamePath,
  `          <GameStories\n            canPost={Boolean(loaderData.participant)}\n            initialChips={loaderData.game.initialChips}\n            isOrganizer={loaderData.isOrganizer}\n            ownPhotoUrl={loaderData.ownStoryPhotoUrl}\n            ownPost={loaderData.ownStoryPost}\n            posts={loaderData.storyPosts}\n            results={loaderData.results}\n          />`,
  `          {loaderData.isPublicResultViewer ? null : (\n            <GameStories\n              canPost={Boolean(loaderData.participant)}\n              initialChips={loaderData.game.initialChips}\n              isOrganizer={loaderData.isOrganizer}\n              ownPhotoUrl={loaderData.ownStoryPhotoUrl}\n              ownPost={loaderData.ownStoryPost}\n              posts={loaderData.storyPosts}\n              results={loaderData.results}\n            />\n          )}`,
);

// Update tests for finalized public read-only access and draft protection.
const gameTestPath = "app/routes/game-participant.test.ts";
replaceOnce(
  gameTestPath,
  `describe("finalized game invite-only access", () => {\n  it("未所属ゲストは確定済み開催を閲覧できない", async () => {\n    vi.resetAllMocks();\n    mocked.findGroupByPublicCode.mockResolvedValue(group);\n    mocked.findGameForGroup.mockResolvedValue({\n      ...openGame,\n      status: "finalized",\n    });\n    mocked.isOrganizerAuthenticated.mockResolvedValue(false);\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile: null,\n    });\n\n    await expect(loader(loaderArgs())).rejects.toMatchObject({ status: 403 });\n  });\n});`,
  `describe("finalized game invite-only access", () => {\n  it("未所属ゲストでもURLを知っていれば確定結果だけ閲覧できる", async () => {\n    vi.resetAllMocks();\n    mocked.findGroupByPublicCode.mockResolvedValue(group);\n    mocked.findGameForGroup.mockResolvedValue({\n      ...openGame,\n      status: "finalized",\n    });\n    mocked.isOrganizerAuthenticated.mockResolvedValue(false);\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile: null,\n    });\n    mocked.findParticipantByTokenHash.mockResolvedValue(null);\n    mocked.listFinalResults.mockResolvedValue([]);\n    mocked.listResultRevisions.mockResolvedValue([]);\n\n    const result = await loader(loaderArgs());\n\n    expect(result.isPublicResultViewer).toBe(true);\n    expect(result.canBrowseGroup).toBe(false);\n    expect(result.pastGameNavigation).toBeNull();\n    expect(result.payPay).toBeNull();\n    expect(result.storyPosts).toEqual([]);\n    expect(mocked.listGamesForGroup).not.toHaveBeenCalled();\n    expect(mocked.getPublishedGameStoryPosts).not.toHaveBeenCalled();\n  });\n\n  it("未所属ゲストはdraft開催を閲覧できない", async () => {\n    vi.resetAllMocks();\n    mocked.findGroupByPublicCode.mockResolvedValue(group);\n    mocked.findGameForGroup.mockResolvedValue({\n      ...openGame,\n      status: "draft",\n    });\n    mocked.isOrganizerAuthenticated.mockResolvedValue(false);\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile: null,\n    });\n    mocked.findParticipantByTokenHash.mockResolvedValue(null);\n\n    await expect(loader(loaderArgs())).rejects.toMatchObject({ status: 403 });\n  });\n});`,
);

// Menu regression: identity selection is only available from an open game invitation.
const menuTestPath = "app/routes/site-menu-access.test.ts";
if (!fs.existsSync(menuTestPath)) {
  fs.writeFileSync(
    menuTestPath,
    `import { createElement } from "react";\nimport { renderToStaticMarkup } from "react-dom/server";\nimport { MemoryRouter } from "react-router";\nimport { describe, expect, it } from "vitest";\nimport { GroupSiteMenu } from "~/components/site-menu";\n\nfunction renderMenu(props = {}) {\n  return renderToStaticMarkup(\n    createElement(\n      MemoryRouter,\n      null,\n      createElement(GroupSiteMenu, { groupCode: "river-check", ...props }),\n    ),\n  );\n}\n\ndescribe("group site menu access", () => {\n  it("未認証状態ではプレイヤー選択導線を表示しない", () => {\n    const html = renderMenu();\n    expect(html).not.toContain("プレイヤーを選択");\n    expect(html).not.toContain("/g/river-check/profile");\n  });\n\n  it("本人認証済みならプロフィール導線を表示する", () => {\n    const html = renderMenu({\n      hasPlayer: true,\n      groupPlayerId: "33333333-3333-4333-8333-333333333333",\n    });\n    expect(html).toContain("プロフィール");\n    expect(html).toContain("/g/river-check/stats/33333333-3333-4333-8333-333333333333");\n  });\n});\n`,
  );
}

// Document the intentionally light capability-URL boundary.
replaceOnce(
  "docs/requirements.md",
  "- 同じ開催URLはgame statusで役割を分け、open時だけ未所属者の招待入口とする。draft/finalized時はグループ所属者・主催者・その開催の既存participant tokenを持つ参加者だけが閲覧でき、新しい名前選択やグループ参加の入口にはしない\n",
  "- 同じ開催URLはgame statusで役割を分ける。open時は未所属者の招待入口として本人選択・新規参加を許可し、finalized時はURL自体を結果閲覧キーとして未所属ゲストにも確定結果だけを読み取り専用で公開する。draftはグループ所属者・主催者・その開催の既存participant tokenを持つ参加者だけが閲覧できる\n- finalized開催を未所属ゲストが開いた場合は、グループTOP・ランキング・他プレイヤー戦績・過去開催ナビ・PayPay・TABLE STORIESへの横移動や追加情報を表示しない。本人認証済みメンバーは従来どおりグループ内を閲覧できる\n- 一般の「プレイヤーを選択」導線はハンバーガーメニューに置かず、本人選択と新規プロフィール作成はopen開催の招待URLから行う\n",
);
replaceOnce(
  "docs/architecture.md",
  "- game participant loaderは同一URLをstatusで分岐し、openは未所属者にも参加導線を許可する一方、draft/finalizedはgroup member、organizer、またはその開催の有効なparticipant tokenを持つ既存参加者だけへ公開する\n- `/r/:resultCode` はfinalized gameのcanonical participant routeへredirectする短縮URLであり、redirect後は同じgroup access guardに従う",
  "- game participant loaderは同一URLをstatusで分岐する。openは未所属者にも参加導線を許可し、finalizedは推測困難なgame URLをcapability URLとして確定結果だけを公開する。draftはgroup member、organizer、またはその開催の有効なparticipant tokenを持つ既存参加者だけへ公開する\n- finalizedの未所属ゲストは `canBrowseGroup=false` とし、ヘッダーメニュー、player statsリンク、過去開催ナビ、PayPay、TABLE STORIESを返却・表示しない。これにより結果URLからグループ内を横断できない\n- `/r/:resultCode` はfinalized gameのcanonical participant routeへredirectする短縮URLであり、redirect後は同じ公開結果ルールに従う",
);
