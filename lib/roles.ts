export const USER_ROLES = ["ADMIN", "OFFICE", "SUPERVISOR", "FOREMAN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(v: string): v is UserRole {
  return (USER_ROLES as readonly string[]).includes(v);
}
