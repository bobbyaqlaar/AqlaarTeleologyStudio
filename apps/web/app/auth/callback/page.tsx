"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLogin } from "@/lib/auth/oidc";

/** OIDC redirect target: exchanges the authorization code (PKCE) for tokens,
 * stores the session, and returns to where login started. */
export default function AuthCallbackPage(): React.ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeLogin()
      .then((returnTo) => {
        // Full navigation so the RoleProvider re-reads the session on mount.
        window.location.replace(returnTo);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Login failed");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {error ? (
        <div className="max-w-md space-y-2 rounded-lg border border-destructive/40 bg-card p-6 text-center">
          <p className="font-medium">Sign-in failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      )}
    </div>
  );
}
