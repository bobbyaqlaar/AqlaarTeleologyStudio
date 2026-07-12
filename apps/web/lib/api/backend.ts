/** Shared fetch helper for the FastAPI backend (isomorphic: server
 * components and client components both use it). Callers catch failures
 * and fall back to the in-memory mock stores so UI-only mode still works.
 * Client-side calls carry the SSO Bearer token when signed in, otherwise
 * X-OTS-User-* demo identity headers. */

import { authHeaders } from "@/lib/auth/session";

export const API_BASE =
  process.env.NEXT_PUBLIC_OTS_API_URL ?? "http://localhost:8000";

export class BackendApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new BackendApiError(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
