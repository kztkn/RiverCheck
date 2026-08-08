import { env } from "cloudflare:workers";
import { redirect } from "react-router";

const COOKIE_NAME = "rc_organizer_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

interface OrganizerAuthEnv {
  ORGANIZER_PIN?: string;
  ORGANIZER_SESSION_SECRET?: string;
}

interface OrganizerSessionPayload {
  expiresAt: number;
  version: 1;
}

export function isOrganizerAuthConfigured(): boolean {
  return getConfig() !== null;
}

export async function verifyOrganizerPin(pin: string): Promise<boolean> {
  const config = getConfig();
  if (!config || !pin) return false;
  return constantTimeTextEqual(pin, config.pin);
}

export async function isOrganizerAuthenticated(
  request: Request,
): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [encodedPayload, encodedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !encodedSignature || rest.length > 0) return false;

  const expectedSignature = await sign(encodedPayload, config.sessionSecret);
  if (!constantTimeBytesEqual(
    decodeBase64Url(encodedSignature),
    decodeBase64Url(expectedSignature),
  )) {
    return false;
  }

  try {
    const payloadBytes = decodeBase64Url(encodedPayload);
    if (!payloadBytes) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as OrganizerSessionPayload;
    return (
      payload.version === 1 &&
      Number.isSafeInteger(payload.expiresAt) &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export async function requireOrganizer(
  request: Request,
  groupCode: string,
): Promise<void> {
  if (await isOrganizerAuthenticated(request)) return;

  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  throw redirect(
    `/g/${groupCode}/organizer-login?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function createOrganizerSessionCookie(
  request: Request,
): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error("Organizer authentication is not configured");

  const payload: OrganizerSessionPayload = {
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1_000,
    version: 1,
  };
  const encodedPayload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await sign(encodedPayload, config.sessionSecret);

  return serializeCookie(
    request,
    `${encodedPayload}.${signature}`,
    SESSION_MAX_AGE_SECONDS,
  );
}

export function clearOrganizerSessionCookie(request: Request): string {
  return serializeCookie(request, "", 0);
}

export function safeOrganizerReturnTo(
  value: string | null,
  groupCode: string,
): string {
  const fallback = `/g/${groupCode}/manage`;
  if (!value || !value.startsWith(`/g/${groupCode}/`) || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

function getConfig(): { pin: string; sessionSecret: string } | null {
  const runtimeEnv = env as OrganizerAuthEnv;
  const pin = runtimeEnv.ORGANIZER_PIN?.trim();
  const sessionSecret = runtimeEnv.ORGANIZER_SESSION_SECRET?.trim();
  if (!pin || !sessionSecret || sessionSecret.length < 32) return null;
  return { pin, sessionSecret };
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

async function constantTimeTextEqual(
  left: string,
  right: string,
): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  return constantTimeBytesEqual(
    new Uint8Array(leftHash),
    new Uint8Array(rightHash),
  );
}

function constantTimeBytesEqual(
  left: Uint8Array | null,
  right: Uint8Array | null,
): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return null;
}

function serializeCookie(
  request: Request,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/g/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
