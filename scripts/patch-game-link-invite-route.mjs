import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text not found in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.replace(before, after));
}

await writeFile(
  "app/components/group-invite-join-panel.tsx",
  `import { Form } from "react-router";\n\nexport function GroupInviteJoinPanel({\n  displayName,\n  groupName,\n  isSubmitting,\n}: {\n  displayName: string;\n  groupName: string;\n  isSubmitting: boolean;\n}) {\n  return (\n    <section className="participant-panel">\n      <div className="section-heading compact-heading">\n        <div>\n          <p className="eyebrow">GROUP INVITE</p>\n          <h2>{groupName}に参加</h2>\n        </div>\n      </div>\n      <p className="muted-copy">\n        RiverCheckで「{displayName}」として利用中です。このプロフィールのままグループへ参加し、今回の開催にも登録できます。\n      </p>\n      <Form method="post" reloadDocument>\n        <input\n          name="intent"\n          type="hidden"\n          value="join-current-profile-to-group"\n        />\n        <button\n          className="button button-primary"\n          disabled={isSubmitting}\n          type="submit"\n        >\n          {isSubmitting ? "参加中…" : displayName + "として参加"}\n        </button>\n      </Form>\n      <p className="field-hint">\n        名前やアイコンは共通のまま、戦績・ランキング・実績はこのグループで新しく始まります。\n      </p>\n    </section>\n  );\n}\n`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  createNewPlayerProfileSessionCredentials,\n  getAuthenticatedPlayerProfile,\n  selectPlayerProfile,`,
  `  createNewPlayerProfileSessionCredentials,\n  getAuthenticatedPlayerIdentity,\n  getAuthenticatedPlayerProfile,\n  selectPlayerProfile,`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `import { joinSelfParticipant } from "@server/services/participant-service.server";`,
  `import {\n  joinCurrentProfileToGroupGame,\n  joinSelfParticipant,\n} from "@server/services/participant-service.server";`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `import { GroupSiteHeader } from "~/components/site-menu";`,
  `import { GroupSiteHeader } from "~/components/site-menu";\nimport { GroupInviteJoinPanel } from "~/components/group-invite-join-panel";`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  const players =\n    context.game.status === "open" && !participant\n      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)\n      : [];`,
  `  const groupInvitePlayer =\n    context.game.status === "open" &&\n    !participant &&\n    !profileOverview?.profile\n      ? await getAuthenticatedPlayerIdentity(request)\n      : null;\n  const players =\n    context.game.status === "open" && !participant && !groupInvitePlayer\n      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)\n      : [];`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `    authenticatedPlayer: profileOverview?.profile\n      ? {`,
  `    groupInvitePlayer: groupInvitePlayer\n      ? { displayName: groupInvitePlayer.displayName }\n      : null,\n    authenticatedPlayer: profileOverview?.profile\n      ? {`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  if (intent === "join-self") {`,
  `  if (intent === "join-current-profile-to-group") {\n    if (context.game.status !== "open") {\n      return { error: "現在は参加を受け付けていません。" };\n    }\n    const joined = await joinCurrentProfileToGroupGame(request, {\n      gameId: params.gameId,\n      groupId: context.group.id,\n    });\n    if (!joined.ok) return { error: joined.error };\n    return redirect(participantUrl + "?notice=group-joined", { status: 303 });\n  }\n\n  if (intent === "join-self") {`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `            loaderData.authenticatedPlayer ? "join-grid" : "player-selection"`,
  `            loaderData.authenticatedPlayer || loaderData.groupInvitePlayer\n              ? "join-grid"\n              : "player-selection"`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `              </Form>\n            </section>\n          ) : (\n            <>\n              <section className="player-selection-primary">`,
  `              </Form>\n            </section>\n          ) : loaderData.groupInvitePlayer ? (\n            <GroupInviteJoinPanel\n              displayName={loaderData.groupInvitePlayer.displayName}\n              groupName={loaderData.group.name}\n              isSubmitting={isSubmitting}\n            />\n          ) : (\n            <>\n              <section className="player-selection-primary">`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `    joined: "参加しました。ゲーム中の操作を開始できます。",`,
  `    joined: "参加しました。ゲーム中の操作を開始できます。",\n    "group-joined": "グループに参加し、この開催へ登録しました。",`,
);
