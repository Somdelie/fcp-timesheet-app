"use client";

import React, { createContext, useContext } from "react";
import type { UserRole } from "@/lib/roles";

const UserRoleContext = createContext<UserRole | null>(null);

interface UserRoleProviderProps {
  role: UserRole;
  children: React.ReactNode;
}

export function UserRoleProvider({ role, children }: UserRoleProviderProps) {
  return (
    <UserRoleContext.Provider value={role}>{children}</UserRoleContext.Provider>
  );
}

export function useUserRole(): UserRole {
  const role = useContext(UserRoleContext);
  if (!role) {
    throw new Error("useUserRole must be used within a UserRoleProvider");
  }
  return role;
}
