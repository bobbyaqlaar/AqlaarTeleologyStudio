import type { UserRole } from "@/lib/types";
import { setAuthSession, type AuthSession } from "@/lib/auth/session";

/** Minimal OIDC Authorization Code + PKCE flow against the dev Keycloak
 * realm (infra/keycloak/ots-realm.json, public client "ots-web"). No client
 * secret — PKCE S256 only. */

const ISSUER =
  process.env.NEXT_PUBLIC_OTS_OIDC_ISSUER ??
  "http://localhost:8081/realms/ots";
const CLIENT_ID = process.env.NEXT_PUBLIC_OTS_OIDC_CLIENT_ID ?? "ots-web";

const PKCE_KEY = "ots.oidc.pkce";

interface PkceState {
  verifier: string;
  state: string;
  returnTo: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(normalized)) as Record<string, unknown>;
}

export async function beginLogin(returnTo: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await challengeFromVerifier(verifier);

  const pkce: PkceState = { verifier, state, returnTo };
  window.sessionStorage.setItem(PKCE_KEY, JSON.stringify(pkce));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "openid profile",
    redirect_uri: redirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(
    `${ISSUER}/protocol/openid-connect/auth?${params.toString()}`,
  );
}

export async function completeLogin(): Promise<string> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = window.sessionStorage.getItem(PKCE_KEY);
  window.sessionStorage.removeItem(PKCE_KEY);

  if (!code || !state || !raw) {
    throw new Error("Missing authorization code or PKCE state");
  }
  const pkce = JSON.parse(raw) as PkceState;
  if (pkce.state !== state) {
    throw new Error("OIDC state mismatch");
  }

  const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri(),
      code_verifier: pkce.verifier,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  const tokens = (await response.json()) as {
    access_token: string;
    id_token?: string;
    expires_in: number;
  };
  const claims = decodeJwtPayload(tokens.access_token);
  const realmRoles =
    ((claims.realm_access as { roles?: string[] } | undefined)?.roles ?? []);
  const role: UserRole = realmRoles.includes("stakeholder")
    ? "stakeholder"
    : "consultant";

  const session: AuthSession = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + (tokens.expires_in - 30) * 1000,
    sub: (claims.sub as string) ?? "unknown",
    name:
      (claims.name as string) ??
      (claims.preferred_username as string) ??
      "Signed-in user",
    role,
  };
  setAuthSession(session);
  return pkce.returnTo || "/engagements";
}

export function logout(session: AuthSession | null): void {
  setAuthSession(null);
  if (session?.idToken) {
    const params = new URLSearchParams({
      id_token_hint: session.idToken,
      post_logout_redirect_uri: window.location.origin,
    });
    window.location.assign(
      `${ISSUER}/protocol/openid-connect/logout?${params.toString()}`,
    );
  }
}
