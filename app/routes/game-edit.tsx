import { redirect, useNavigation } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { GameHighlightEditor } from "~/components/game-highlight-editor";
import { GameIdentityEditor } from "~/components/game-identity-editor";
import { ResultCorrectionPanel } from "~/components/result-correction-panel";
import { findGameForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { listFinalResults } from "@server/repositories/finalization-repository.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import {
  readGameIdentityForm,
  validateGameIdentityForm,
} from "@server/services/game-service.server";
import {
  updateFinalizedGame,
  type ResultCorrectionInput,
} from "@server/services/finalization-service.server";
import {
  buildGamePhotoUrl,
  getGameHighlight,
  saveGameHighlight,
} from "@server/services/game-highlight-service.server";
import type { Route } from "./+types/game-edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const context = await requireGame(params.groupCode, params.gameId);
  if (context.game.status !== "finalized") {
    return redirect(`/g/${params.groupCode}/games/${params.gameId}/admin`);
  }

  const [results, highlight] = await Promise.all([
    listFinalResults(context.group.id, params.gameId),
    getGameHighlight(context.group.id, params.gameId),
  ]);
  return {
    group: { name: context.group.name, publicCode: context.group.publicCode },
    game: context.game,
    results,
    highlight,
    highlightPhotoUrl: buildGamePhotoUrl({
      gameId: params.gameId,
      groupCode: params.groupCode,
      highlight,
    }),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const context = await requireGame(params.groupCode, params.gameId);
  if (context.game.status !== "finalized") {
    throw new Response("Only finalized games can be edited", { status: 409 });
  }

  const formData = await request.formData();
  const intent = readString(formData, "intent");
  const resultUrl = `/g/${params.groupCode}/games/${params.gameId}`;

  if (intent === "save-game-identity") {
    const identityValues = readGameIdentityForm(formData);
    const identityValidation = validateGameIdentityForm(identityValues);
    if (!identityValidation.ok) {
      return {
        ok: false as const,
        intent: "save-game-identity" as const,
        error: "開催情報を確認してください。",
        identityErrors: identityValidation.errors,
        identityValues,
      };
    }

    const currentResults = await listFinalResults(context.group.id, params.gameId);
    const corrections = currentResults.map((result) => ({
      groupPlayerId: result.groupPlayerId,
      remainingChips: result.remainingChips,
      totalRebuyCount:
        result.totalRebuyCount ?? result.settlementRebuyCount,
      settlementRebuyCount: result.settlementRebuyCount,
    }));
    try {
      const result = await updateFinalizedGame(
        context.group.id,
        params.gameId,
        corrections,
        identityValidation.input,
        false,
      );
      if (!result.ok) {
        return {
          ...result,
          intent: "save-game-identity" as const,
          identityErrors: {},
          identityValues,
        };
      }
    } catch (error) {
      console.error("Failed to update game identity", error);
      return {
        ok: false as const,
        intent: "save-game-identity" as const,
        error:
          "開催情報を保存できませんでした。画面を更新してもう一度お試しください。",
        identityErrors: {},
        identityValues,
      };
    }
    return redirect(`${resultUrl}?notice=corrected`, { status: 303 });
  }

  if (intent === "save-highlight") {
    const photoEntry = formData.get("photo");
    const photo =
      photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
    const result = await saveGameHighlight(context.group.id, params.gameId, {
      photo,
      removePhoto: readString(formData, "removePhoto") === "yes",
      text: readString(formData, "highlightText"),
    });
    if (!result.ok) {
      return { ...result, intent: "save-highlight" as const };
    }
    return redirect(`${resultUrl}?notice=highlight-saved`);
  }

  if (intent !== "correct-results") {
    throw new Response("Unknown action", { status: 400 });
  }

  const identityValues = readGameIdentityForm(formData);
  const identityValidation = validateGameIdentityForm(identityValues);
  if (!identityValidation.ok) {
    return {
      ok: false as const,
      intent: "correct-results" as const,
      error: "開催情報を確認してください。",
      identityErrors: identityValidation.errors,
      identityValues,
    };
  }

  const corrections = readResultCorrections(formData);
  if (!corrections) {
    return {
      ok: false as const,
      intent: "correct-results" as const,
      error: "残りチップ、累計リバイ、終了時リバイ証は0以上の整数で入力してください。",
      identityErrors: {},
      identityValues,
    };
  }

  let result: Awaited<ReturnType<typeof updateFinalizedGame>>;
  try {
    result = await updateFinalizedGame(
      context.group.id,
      params.gameId,
      corrections,
      identityValidation.input,
      readString(formData, "confirmDifference") === "yes",
    );
  } catch (error) {
    console.error("Failed to update finalized game", error);
    return {
      ok: false as const,
      intent: "correct-results" as const,
      error:
        "開催情報を保存できませんでした。画面を更新してもう一度お試しください。",
      identityErrors: {},
      identityValues,
    };
  }
  if (!result.ok) {
    return {
      ...result,
      intent: "correct-results" as const,
      identityErrors: {},
      identityValues,
    };
  }
  return redirect(`${resultUrl}?notice=corrected`);
}

export default function GameEdit({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const correctionAction =
    actionData?.ok === false && actionData.intent === "correct-results"
      ? actionData
      : null;
  const highlightError =
    actionData?.ok === false && actionData.intent === "save-highlight"
      ? actionData.error
      : null;
  const identityAction =
    actionData?.ok === false && actionData.intent === "save-game-identity"
      ? actionData
      : null;
  const resultUrl = `/g/${loaderData.group.publicCode}/games/${loaderData.game.id}`;
  const editUrl = `${resultUrl}/admin/edit`;

  return (
    <main className="page-shell form-page edit-game-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro edit-game-intro">
        <p className="eyebrow">EDIT GAME</p>
        <h1>{loaderData.game.title}</h1>
        <p>確定状態を保ったまま、開催情報と結果を修正できます。</p>
      </section>

      <GameHighlightEditor
        actionUrl={editUrl}
        cancelUrl={resultUrl}
        key={loaderData.highlight?.updatedAt ?? "empty"}
        error={highlightError}
        highlight={loaderData.highlight}
        isSubmitting={isSubmitting}
        photoUrl={loaderData.highlightPhotoUrl}
      />

      <GameIdentityEditor
        actionUrl={editUrl}
        cancelUrl={resultUrl}
        error={identityAction?.error ?? null}
        errors={identityAction?.identityErrors ?? {}}
        isSubmitting={isSubmitting}
        values={
          identityAction?.identityValues ?? {
            title: loaderData.game.title,
            playedAt: toDateInputValue(loaderData.game.playedAt),
          }
        }
      />

      <ResultCorrectionPanel
        actionUrl={editUrl}
        cancelUrl={resultUrl}
        error={correctionAction?.error ?? null}
        game={loaderData.game}
        isSubmitting={isSubmitting}
        results={loaderData.results}
      />
    </main>
  );
}

async function requireGame(groupCode: string, gameId: string) {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) throw new Response("Game not found", { status: 404 });
  const game = await findGameForGroup(group.id, gameId);
  if (!game) throw new Response("Game not found", { status: 404 });
  return { group, game };
}

function readResultCorrections(
  formData: FormData,
): ResultCorrectionInput[] | null {
  const groupPlayerIds = formData.getAll("groupPlayerId");
  const remainingChipsValues = formData.getAll("remainingChips");
  const totalRebuyCountValues = formData.getAll("totalRebuyCount");
  const settlementRebuyCountValues = formData.getAll("settlementRebuyCount");
  if (
    groupPlayerIds.length === 0 ||
    groupPlayerIds.length !== remainingChipsValues.length ||
    groupPlayerIds.length !== totalRebuyCountValues.length ||
    groupPlayerIds.length !== settlementRebuyCountValues.length
  ) {
    return null;
  }

  const corrections: ResultCorrectionInput[] = [];
  for (let index = 0; index < groupPlayerIds.length; index += 1) {
    const groupPlayerId = groupPlayerIds[index];
    const remainingChips = parseNonNegativeInteger(remainingChipsValues[index]);
    const totalRebuyCount = parseNonNegativeInteger(
      totalRebuyCountValues[index],
    );
    const settlementRebuyCount = parseNonNegativeInteger(
      settlementRebuyCountValues[index],
    );
    if (
      typeof groupPlayerId !== "string" ||
      !isUuid(groupPlayerId) ||
      remainingChips === null ||
      totalRebuyCount === null ||
      settlementRebuyCount === null ||
      settlementRebuyCount > totalRebuyCount
    ) {
      return null;
    }
    corrections.push({
      groupPlayerId,
      remainingChips,
      totalRebuyCount,
      settlementRebuyCount,
    });
  }
  return corrections;
}

function parseNonNegativeInteger(
  value: FormDataEntryValue | undefined,
): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toDateInputValue(playedAt: string): string {
  return new Date(new Date(playedAt).getTime() + 9 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}
