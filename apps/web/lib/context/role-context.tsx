"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { beginLogin, logout } from "@/lib/auth/oidc";
import {
  getAuthSession,
  setDemoIdentity,
  type AuthSession,
} from "@/lib/auth/session";
import type { FunctionalUnit, UserRole } from "@/lib/types";

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  functionUnits: FunctionalUnit[];
  setFunctionUnits: (units: FunctionalUnit[]) => void;
  canEdit: boolean;
  canApprove: boolean;
  /** SSO session when signed in via Keycloak; null in dev-switcher mode. */
  session: AuthSession | null;
  signIn: () => void;
  signOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }): ReactNode {
  const [role, setRole] = useState<UserRole>("consultant");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [functionUnits, setFunctionUnits] = useState<FunctionalUnit[]>([
    "finance",
    "operations",
  ]);

  // Adopt an SSO session (created by /auth/callback) after mount.
  useEffect(() => {
    const existing = getAuthSession();
    if (existing) {
      setSession(existing);
      setRole(existing.role);
    }
  }, []);

  // Keep the demo identity headers in sync with the dev switcher.
  useEffect(() => {
    if (session) {
      return;
    }
    setDemoIdentity(
      role === "stakeholder"
        ? { id: "user-stakeholder-1", name: "Jordan Lee", role }
        : { id: "user-consultant-1", name: "Alex Morgan", role },
    );
  }, [role, session]);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      functionUnits,
      setFunctionUnits,
      canEdit: role === "consultant",
      canApprove: role === "stakeholder",
      session,
      signIn: () => {
        void beginLogin(window.location.pathname + window.location.search);
      },
      signOut: () => {
        logout(session);
        setSession(null);
      },
    }),
    [role, functionUnits, session],
  );

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
}
