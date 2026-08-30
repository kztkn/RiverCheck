import fs from "node:fs";

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(search)) {
    if (source.includes(replacement)) return;
    throw new Error(`Anchor not found in ${path}`);
  }
  fs.writeFileSync(path, source.replace(search, replacement));
}

const gamePath = "app/routes/game-participant.tsx";
const earlyGuard = `  const [isOrganizer, profileOverview] = await Promise.all([\n    isOrganizerAuthenticated(request),\n    getAuthenticatedPlayerProfile(request, params.groupCode),\n  ]);\n\n  if (\n    context.game.status !== "open" &&\n    !isOrganizer &&\n    !profileOverview?.profile\n  ) {\n    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });\n  }\n\n  const url = new URL(request.url);`;
const withoutEarlyGuard = `  const [isOrganizer, profileOverview] = await Promise.all([\n    isOrganizerAuthenticated(request),\n    getAuthenticatedPlayerProfile(request, params.groupCode),\n  ]);\n  const url = new URL(request.url);`;
replaceOnce(gamePath, earlyGuard, withoutEarlyGuard);

replaceOnce(
  gamePath,
  `  ]);\n  const groupInvitePlayer =`,
  `  ]);\n\n  if (\n    context.game.status !== "open" &&\n    !isOrganizer &&\n    !profileOverview?.profile &&\n    !participant\n  ) {\n    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });\n  }\n\n  const groupInvitePlayer =`,
);

replaceOnce(
  "docs/requirements.md",
  "- 同じ開催URLはgame statusで役割を分け、open時だけ未所属者の招待入口とする。draft/finalized時は未所属ゲストへ内容を公開しない\n",
  "- 同じ開催URLはgame statusで役割を分け、open時だけ未所属者の招待入口とする。draft/finalized時はグループ所属者・主催者・その開催の既存participant tokenを持つ参加者だけが閲覧でき、新しい名前選択やグループ参加の入口にはしない\n",
);
replaceOnce(
  "docs/architecture.md",
  "- game participant loaderは同一URLをstatusで分岐し、openは未所属者にも参加導線を許可する一方、draft/finalizedはgroup memberまたはorganizerだけへ公開する\n",
  "- game participant loaderは同一URLをstatusで分岐し、openは未所属者にも参加導線を許可する一方、draft/finalizedはgroup member、organizer、またはその開催の有効なparticipant tokenを持つ既存参加者だけへ公開する\n",
);
