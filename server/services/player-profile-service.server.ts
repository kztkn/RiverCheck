import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  consumePlayerProfileClaim,
  createPlayerProfileSession,
  findPlayerAvatarRecord,
  findPlayerProfileBySession,
  findValidPlayerProfileClaim,
  issuePlayerProfileClaim,
  savePlayerProfileRecord,
  type PlayerProfileClaimRecord,
  type PlayerProfileRecord,
} from "@server/repositories/player-profile-repository.server";
import {
  generateOpaqueToken,
  hashToken,
} from "@server/services/token.server";
import { readPlayerProfileToken } from "./player-profile-session.server";
import {
  validatePlayerAvatarBytes,
  validatePlayerProfile,
  type PlayerProfileFormValues,
} from "@domain/player-profile/validate-player-profile";
import {
  getPlayerAvatar,
  putPlayerAvatar,
  type StoredPlayerAvatar,
} from "@server/storage/player-avatar-storage.server";
import type { GroupSummary } from "@shared-types/group";

const CLAIM_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1_000;

export interface ProfileClaimOverview {
  group: GroupSummary;
  claim: PlayerProfileClaimRecord | null;
}

export async function issueProfileClaimLink(
  publicCode: string,
  groupPlayerId: string,
): Promise<
  | { ok: true; displayName: string; expiresAt: string; token: string }
  | { ok: false; error: string }
> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return { ok: false, error: "グループが見つかりません。" };
  const token = generateOpaqueToken();
  const claim = await issuePlayerProfileClaim(
    group.id,
    groupPlayerId,
    await hashToken(token),
    new Date(Date.now() + CLAIM_MAX_AGE_MS).toISOString(),
  );
  return claim
    ? {
        ok: true,
        displayName: claim.displayName,
        expiresAt: claim.expiresAt,
        token,
      }
    : { ok: false, error: "メンバーが見つかりません。" };
}

export async function getProfileClaimOverview(
  publicCode: string,
  token: string,
): Promise<ProfileClaimOverview | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;
  const claim = isOpaqueToken(token)
    ? await findValidPlayerProfileClaim(group.id, await hashToken(token))
    : null;
  return { group, claim };
}

export async function claimPlayerProfile(
  publicCode: string,
  claimToken: string,
): Promise<
  | { ok: true; profile: PlayerProfileRecord; sessionToken: string }
  | { ok: false; error: string }
> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group || !isOpaqueToken(claimToken)) {
    return { ok: false, error: "本人用リンクが無効です。" };
  }
  const sessionToken = generateOpaqueToken();
  const profile = await consumePlayerProfileClaim(
    group.id,
    await hashToken(claimToken),
    await hashToken(sessionToken),
    new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
  );
  return profile
    ? { ok: true, profile, sessionToken }
    : {
        ok: false,
        error: "このリンクは使用済み・期限切れ、または再発行済みです。",
      };
}

export async function createNewPlayerProfileSessionCredentials(): Promise<{
  expiresAt: string;
  token: string;
  tokenHash: string;
}> {
  const token = generateOpaqueToken();
  return {
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
    token,
    tokenHash: await hashToken(token),
  };
}

export async function selectPlayerProfile(
  publicCode: string,
  groupPlayerId: string,
): Promise<
  | { ok: true; profile: PlayerProfileRecord; sessionToken: string }
  | { ok: false; error: string }
> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return { ok: false, error: "グループが見つかりません。" };
  const credentials = await createNewPlayerProfileSessionCredentials();
  const profile = await createPlayerProfileSession(
    group.id,
    groupPlayerId,
    credentials.tokenHash,
    credentials.expiresAt,
  );
  return profile
    ? {
        ok: true,
        profile,
        sessionToken: credentials.token,
      }
    : {
        ok: false,
        error: "選択したプレイヤーを確認できません。画面を更新してください。",
      };
}

export async function getAuthenticatedPlayerProfile(
  request: Request,
  publicCode: string,
): Promise<{ group: GroupSummary; profile: PlayerProfileRecord | null } | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;
  const token = readPlayerProfileToken(request);
  const profile = token
    ? await findPlayerProfileBySession(group.id, await hashToken(token))
    : null;
  return { group, profile };
}

export async function savePlayerProfile(
  current: PlayerProfileRecord,
  input: {
    avatar: File | null;
    removeAvatar: boolean;
    values: PlayerProfileFormValues;
  },
): Promise<
  | { ok: true }
  | {
      ok: false;
      error?: string;
      errors?: Partial<Record<keyof PlayerProfileFormValues, string>>;
      values: PlayerProfileFormValues;
    }
> {
  const validated = validatePlayerProfile({
    ...input.values,
    displayName: current.displayName,
  });
  if (!validated.ok) return validated;

  let uploadedAvatar: StoredPlayerAvatar | null = null;
  if (input.avatar) {
    const bytes = await input.avatar.arrayBuffer();
    const avatarValidation = validatePlayerAvatarBytes({
      bytes: new Uint8Array(bytes),
      contentType: input.avatar.type,
      size: input.avatar.size,
    });
    if (!avatarValidation.ok) {
      return { ok: false, error: avatarValidation.error, values: input.values };
    }
    try {
      uploadedAvatar = await putPlayerAvatar({
        bytes,
        contentType: avatarValidation.contentType,
        objectKey: buildAvatarObjectKey(
          current.playerId,
          avatarValidation.contentType,
        ),
        playerId: current.playerId,
      });
    } catch (error) {
      console.error("Failed to upload player avatar", error);
      return {
        ok: false,
        error: "アイコンを保存できませんでした。時間をおいて再度お試しください。",
        values: input.values,
      };
    }
  }

  const clearCurrentAvatar = input.removeAvatar || uploadedAvatar !== null;
  const nextAvatar = uploadedAvatar ??
    (clearCurrentAvatar ? null : currentAvatar(current));
  const saved = await savePlayerProfileRecord(current.playerId, {
    displayName: current.displayName,
    profileMessage: validated.values.profileMessage,
    favoriteCard1: validated.values.favoriteCard1,
    favoriteCard2: validated.values.favoriteCard2,
    avatarObjectKey: nextAvatar?.objectKey ?? null,
    avatarContentType: nextAvatar?.contentType ?? null,
    avatarByteSize: nextAvatar?.byteSize ?? null,
    avatarUploadedAt: nextAvatar?.uploadedAt ?? null,
    expectedAvatarObjectKey: current.avatarObjectKey,
  });
  return saved
    ? { ok: true }
    : {
        ok: false,
        error: "別の画面でプロフィールが更新されました。再読み込みしてください。",
        values: input.values,
      };
}

export async function getPlayerAvatarForDelivery(
  publicCode: string,
  groupPlayerId: string,
): Promise<{ object: R2ObjectBody; contentType: string } | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;
  const record = await findPlayerAvatarRecord(group.id, groupPlayerId);
  if (!record) return null;
  const object = await getPlayerAvatar(record.objectKey);
  return object ? { object, contentType: record.contentType } : null;
}

function currentAvatar(
  profile: PlayerProfileRecord,
): StoredPlayerAvatar | null {
  return profile.avatarObjectKey &&
    profile.avatarContentType &&
    profile.avatarByteSize !== null &&
    profile.avatarUploadedAt
    ? {
        byteSize: profile.avatarByteSize,
        contentType: profile.avatarContentType,
        objectKey: profile.avatarObjectKey,
        uploadedAt: profile.avatarUploadedAt,
      }
    : null;
}

function buildAvatarObjectKey(
  playerId: string,
  contentType: string,
): string {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `players/${playerId}/${crypto.randomUUID()}.${extension}`;
}

function isOpaqueToken(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}
