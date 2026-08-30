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

// Hamburger menu: keep the underlying logout route as an emergency primitive,
// but remove the everyday account logout action from the menu.
replaceOnce(
  "app/components/site-menu.tsx",
  `  return (\n    <SiteMenu\n      items={items}\n      organizerLogoutAction={\n        organizer ? \`\${basePath}/organizer-logout\` : undefined\n      }\n      accountLogoutAction={hasPlayer ? \`\${basePath}/logout\` : undefined}\n    />\n  );`,
  `  return (\n    <SiteMenu\n      items={items}\n      organizerLogoutAction={\n        organizer ? \`\${basePath}/organizer-logout\` : undefined\n      }\n    />\n  );`,
);

// Player choice confirmation can also explain device-player switching without
// changing the existing open-game join wording.
const choicePath = "app/components/player-choice-list.tsx";
replaceOnce(
  choicePath,
  `export function buildPlayerJoinConfirmation(displayName: string) {\n  return {\n    description: \`参加すると、この端末では\${displayName}のプロフィールとしてログイン状態になります。\`,\n    title: \`\${displayName}として参加しますか？\`,\n  };\n}\n`,
  `export function buildPlayerJoinConfirmation(displayName: string) {\n  return {\n    description: \`参加すると、この端末では\${displayName}のプロフィールとしてログイン状態になります。\`,\n    title: \`\${displayName}として参加しますか？\`,\n  };\n}\n\nexport function buildPlayerSwitchConfirmation(displayName: string) {\n  return {\n    description: \`変更すると、この端末では次回から\${displayName}として開きます。現在のプロフィールや戦績は削除されません。\`,\n    title: \`この端末を\${displayName}に変更しますか？\`,\n  };\n}\n`,
);
replaceOnce(
  choicePath,
  `  actionLabel,\n  confirmBeforeSubmit = false,\n  intent,`,
  `  actionLabel,\n  confirmBeforeSubmit = false,\n  confirmationKind = "join",\n  intent,`,
);
replaceOnce(
  choicePath,
  `  actionLabel: string;\n  confirmBeforeSubmit?: boolean;\n  intent: string;`,
  `  actionLabel: string;\n  confirmBeforeSubmit?: boolean;\n  confirmationKind?: "join" | "switch";\n  intent: string;`,
);
replaceOnce(
  choicePath,
  `  const confirmation = selectedPlayer\n    ? buildPlayerJoinConfirmation(selectedPlayer.displayName)\n    : null;`,
  `  const confirmation = selectedPlayer\n    ? confirmationKind === "switch"\n      ? buildPlayerSwitchConfirmation(selectedPlayer.displayName)\n      : buildPlayerJoinConfirmation(selectedPlayer.displayName)\n    : null;`,
);
replaceOnce(
  choicePath,
  `<p className="eyebrow">JOIN THE TABLE</p>`,
  `<p className="eyebrow">\n                      {confirmationKind === "switch" ? "DEVICE PLAYER" : "JOIN THE TABLE"}\n                    </p>`,
);
replaceOnce(
  choicePath,
  `{isSubmitting ? "参加中…" : "参加"}`,
  `{isSubmitting\n                        ? confirmationKind === "switch"\n                          ? "変更中…"\n                          : "参加中…"\n                        : confirmationKind === "switch"\n                          ? "変更する"\n                          : "参加"}`,
);

const statsPath = "app/routes/stats-player.tsx";
replaceOnce(
  statsPath,
  `import { PlayerAvatar } from "~/components/player-avatar";`,
  `import { PlayerAvatar } from "~/components/player-avatar";\nimport { PlayerChoiceList } from "~/components/player-choice-list";`,
);
replaceOnce(
  statsPath,
  `import {\n  getAuthenticatedPlayerProfile,\n  savePlayerProfile,\n} from "@server/services/player-profile-service.server";`,
  `import {\n  getAuthenticatedPlayerProfile,\n  savePlayerProfile,\n  selectPlayerProfile,\n} from "@server/services/player-profile-service.server";\nimport { getPlayerManagement } from "@server/services/player-service.server";\nimport { createPlayerProfileCookie } from "@server/services/player-profile-session.server";`,
);
replaceOnce(
  statsPath,
  `  const profileEditorOpen = url.searchParams.get("editProfile") === "1";\n  return {`,
  `  const profileEditorOpen = url.searchParams.get("editProfile") === "1";\n  const switchPlayerOpen =\n    canEditProfile && url.searchParams.get("switchPlayer") === "1";\n  const switchManagement = switchPlayerOpen\n    ? await getPlayerManagement(params.groupCode)\n    : null;\n  return {`,
);
replaceOnce(
  statsPath,
  `    profileSaved: url.searchParams.has("profileSaved"),\n    profileEditorOpen,\n  };`,
  `    profileSaved: url.searchParams.has("profileSaved"),\n    profileEditorOpen,\n    switchPlayerOpen,\n    switchPlayers: (switchManagement?.players ?? [])\n      .filter(\n        (player) =>\n          player.isActive && player.id !== authenticated?.profile?.groupPlayerId,\n      )\n      .map((player) => ({\n        id: player.id,\n        displayName: player.displayName,\n        avatarUrl: buildPlayerAvatarUrl({\n          avatarUpdatedAt: player.avatarUpdatedAt,\n          groupCode: params.groupCode,\n          groupPlayerId: player.id,\n        }),\n      })),\n  };`,
);
replaceOnce(
  statsPath,
  `  const formData = await request.formData();\n  const intent = readString(formData, "intent");\n  if (intent === "enable-push") {`,
  `  const formData = await request.formData();\n  const intent = readString(formData, "intent");\n  if (intent === "switch-player") {\n    const groupPlayerId = readString(formData, "groupPlayerId");\n    if (!isUuid(groupPlayerId)) {\n      return {\n        ok: false as const,\n        intent: "switch-player" as const,\n        error: "変更先のプレイヤーを選んでください。",\n      };\n    }\n    if (groupPlayerId === authenticated.profile.groupPlayerId) {\n      return {\n        ok: false as const,\n        intent: "switch-player" as const,\n        error: "現在この端末で使っているプレイヤーです。",\n      };\n    }\n    const selected = await selectPlayerProfile(params.groupCode, groupPlayerId);\n    if (!selected.ok) {\n      return {\n        ok: false as const,\n        intent: "switch-player" as const,\n        error: selected.error,\n      };\n    }\n    return redirect(\n      \`/g/\${params.groupCode}/stats/\${selected.profile.groupPlayerId}\`,\n      {\n        status: 303,\n        headers: {\n          "Set-Cookie": createPlayerProfileCookie(request, selected.sessionToken),\n        },\n      },\n    );\n  }\n  if (intent === "enable-push") {`,
);
replaceOnce(
  statsPath,
  `  const profileSaveFailure =\n    actionData?.intent === "save-profile" && actionData.ok === false\n      ? actionData\n      : null;\n  const isSavingProfile =`,
  `  const profileSaveFailure =\n    actionData?.intent === "save-profile" && actionData.ok === false\n      ? actionData\n      : null;\n  const switchPlayerFailure =\n    actionData?.intent === "switch-player" && actionData.ok === false\n      ? actionData\n      : null;\n  const isSwitchingPlayer =\n    navigation.state === "submitting" &&\n    navigation.formData?.get("intent") === "switch-player";\n  const isSavingProfile =`,
);
replaceOnce(
  statsPath,
  `      <PlayerGameHistory\n        games={recentGames}\n        groupCode={group.publicCode}\n      />\n    </main>`,
  `      <PlayerGameHistory\n        games={recentGames}\n        groupCode={group.publicCode}\n      />\n\n      {loaderData.canEditProfile ? (\n        <section className="stats-device-player-switch">\n          <div>\n            <span>この端末で使うプレイヤー</span>\n            <strong>{summary.displayName}</strong>\n          </div>\n          <Link\n            className="stats-device-player-switch-link"\n            to={\`\${profilePath}?switchPlayer=1\`}\n          >\n            この端末のプレイヤーを変更\n          </Link>\n        </section>\n      ) : null}\n\n      {loaderData.canEditProfile ? (\n        <section\n          aria-label="この端末のプレイヤーを変更"\n          aria-modal="true"\n          className={\`profile-edit-modal device-player-switch-modal\${\n            loaderData.switchPlayerOpen || switchPlayerFailure ? " is-open" : ""\n          }\`}\n          role="dialog"\n        >\n          <a\n            aria-label="プレイヤー変更を閉じる"\n            className="profile-edit-modal-backdrop"\n            href={profilePath}\n          />\n          <div className="profile-edit-modal-card device-player-switch-card">\n            <header className="device-player-switch-heading">\n              <div>\n                <p className="eyebrow">DEVICE PLAYER</p>\n                <h2>この端末のプレイヤーを変更</h2>\n              </div>\n              <Link\n                aria-label="プレイヤー変更を閉じる"\n                className="profile-edit-modal-close"\n                to={profilePath}\n              >\n                ×\n              </Link>\n            </header>\n            <p className="muted-copy device-player-switch-description">\n              名前を間違えて選択した場合などの変更用です。変更先を確定するまでは、現在のプレイヤーのままです。\n            </p>\n            {switchPlayerFailure ? (\n              <p className="error-notice" role="alert">\n                {switchPlayerFailure.error}\n              </p>\n            ) : null}\n            {loaderData.switchPlayers.length > 0 ? (\n              <PlayerChoiceList\n                actionLabel="変更"\n                confirmBeforeSubmit\n                confirmationKind="switch"\n                intent="switch-player"\n                isSubmitting={isSwitchingPlayer}\n                players={loaderData.switchPlayers}\n              />\n            ) : (\n              <p className="muted-copy">変更できるほかのプレイヤーがいません。</p>\n            )}\n          </div>\n        </section>\n      ) : null}\n    </main>`,
);
appendOnce(
  statsPath,
  "function isUuid(value: string)",
  `function isUuid(value: string): boolean {\n  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);\n}`,
);

appendOnce(
  "app/styles/profile.css",
  ".stats-device-player-switch {",
  `.stats-player-page .stats-history {\n  padding-bottom: 28px;\n}\n\n.stats-device-player-switch {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 18px;\n  margin: 0 0 56px;\n  border-top: 1px solid rgba(223, 236, 227, 0.08);\n  padding-top: 18px;\n}\n\n.stats-device-player-switch > div {\n  display: grid;\n  min-width: 0;\n  gap: 3px;\n}\n\n.stats-device-player-switch span {\n  color: #72877c;\n  font-size: 0.65rem;\n}\n\n.stats-device-player-switch strong {\n  overflow: hidden;\n  color: #9aaba2;\n  font-size: 0.76rem;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.stats-device-player-switch-link {\n  flex: 0 0 auto;\n  color: #859990;\n  font-size: 0.7rem;\n  font-weight: 750;\n  text-decoration: underline;\n  text-decoration-color: rgba(133, 153, 144, 0.36);\n  text-underline-offset: 4px;\n}\n\n.stats-device-player-switch-link:hover,\n.stats-device-player-switch-link:focus-visible {\n  color: var(--ink);\n}\n\n.device-player-switch-card {\n  max-height: calc(100dvh - 24px);\n  gap: 18px;\n  overflow-x: hidden;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding: var(--profile-modal-padding);\n}\n\n.device-player-switch-heading {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n}\n\n.device-player-switch-heading h2,\n.device-player-switch-heading p,\n.device-player-switch-description {\n  margin: 0;\n}\n\n.device-player-switch-heading h2 {\n  margin-top: 5px;\n  font-size: clamp(1.05rem, 4vw, 1.3rem);\n  letter-spacing: -0.03em;\n}\n\n.device-player-switch-description {\n  line-height: 1.65;\n}\n\n@media (max-width: 520px) {\n  .stats-device-player-switch {\n    align-items: flex-start;\n    flex-direction: column;\n    gap: 10px;\n  }\n}`,
);

// Regression coverage for the menu and the device-switch confirmation copy.
replaceOnce(
  "app/routes/site-menu-access.test.ts",
  `    expect(html).toContain("プロフィール");\n    expect(html).toContain("/g/river-check/stats/33333333-3333-4333-8333-333333333333");`,
  `    expect(html).toContain("プロフィール");\n    expect(html).toContain("/g/river-check/stats/33333333-3333-4333-8333-333333333333");\n    expect(html).not.toContain("/g/river-check/logout");\n    expect(html).not.toContain(">ログアウト<");`,
);

const confirmationTestPath = "app/routes/player-choice-list-confirmation.test.ts";
if (!fs.existsSync(confirmationTestPath)) {
  fs.writeFileSync(
    confirmationTestPath,
    `import { describe, expect, it } from "vitest";\nimport {\n  buildPlayerJoinConfirmation,\n  buildPlayerSwitchConfirmation,\n} from "~/components/player-choice-list";\n\ndescribe("player choice confirmation copy", () => {\n  it("keeps the open-game join confirmation unchanged", () => {\n    expect(buildPlayerJoinConfirmation("Alice")).toEqual({\n      title: "Aliceとして参加しますか？",\n      description: "参加すると、この端末ではAliceのプロフィールとしてログイン状態になります。",\n    });\n  });\n\n  it("explains that a device-player switch preserves profile and stats", () => {\n    expect(buildPlayerSwitchConfirmation("Bob")).toEqual({\n      title: "この端末をBobに変更しますか？",\n      description: "変更すると、この端末では次回からBobとして開きます。現在のプロフィールや戦績は削除されません。",\n    });\n  });\n});\n`,
  );
}

replaceOnce(
  "docs/requirements.md",
  `- プロフィール認証済みplayerは、所属済みの別グループへ切り替えても同じ本人セッションを利用できる\n`,
  `- プロフィール認証済みplayerは、所属済みの別グループへ切り替えても同じ本人セッションを利用できる\n- 日常操作としてプレイヤーのログアウト導線は表示しない。本人選択を間違えた場合は自分のプロフィール最下部にある「この端末のプレイヤーを変更」から同一グループの別プレイヤーへ切り替え、変更先を確定するまでは現在の本人セッションを維持する\n`,
);
