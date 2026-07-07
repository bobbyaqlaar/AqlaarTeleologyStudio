"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FunctionalUnit, UserRole } from "@/lib/types";

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  functionUnits: FunctionalUnit[];
  setFunctionUnits: (units: FunctionalUnit[]) => void;
  canEdit: boolean;
  canApprove: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }): ReactNode {
  const [role, setRole] = useState<UserRole>("consultant");
  const [functionUnits, setFunctionUnits] = useState<FunctionalUnit[]>([
    "finance",
    "operations",
  ]);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      functionUnits,
      setFunctionUnits,
      canEdit: role === "consultant",
      canApprove: role === "stakeholder",
    }),
    [role, functionUnits],
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
