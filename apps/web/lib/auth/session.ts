import type { UserRole } from "@/lib/types";

/** In-memory auth state shared by the fetch helpers (client-side only).
 * SSO session wins; otherwise the dev role switcher identity is sent via
 * X-OTS-User-* headers so audit events attribute correctly. */

export interface AuthSession {
  accessToken: string;
  idToken?: string;
  expiresAt: number; // epoch ms
  sub: string;
  name: string;
  role: UserRole;
}

const STORAGE_KEY = "ots.oidc.session";

let currentSession: AuthSession | null = null;
let demoIdentity: { id: string; name: string; role: UserRole } = {
  id: "user-consultant-1",
  name: "Alex Morgan",
  role: "consultant",
};

export function setAuthSession(session: AuthSession | null): void {
  currentSession = session;
  if (typeof window === "undefined") {
    return;
  }
  if (session) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getAuthSession(): AuthSession | null {
  if (currentSession && currentSession.expiresAt > Date.now()) {
    return currentSession;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    currentSession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function setDemoIdentity(identity: {
  id: string;
  name: string;
  role: UserRole;
}): void {
  demoIdentity = identity;
}

/** Headers for every API call: Bearer token when signed in, demo headers
 * otherwise (API AUTH_MODE=optional accepts both). */
export function authHeaders(): Record<string, string> {
  const session = getAuthSession();
  if (session) {
    return { Authorization: `Bearer ${session.accessToken}` };
  }
  return {
    "X-OTS-User-Id": demoIdentity.id,
    "X-OTS-User-Name": demoIdentity.name,
    "X-OTS-User-Role": demoIdentity.role,
  };
}
