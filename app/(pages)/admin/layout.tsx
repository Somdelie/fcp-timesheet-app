// @ts-nocheck
import { requireAuth } from "@/lib/auth";

export default async function AdminLayout({ children }) {
  // Require ADMIN or OFFICE role for admin routes
  const session = await requireAuth({ roles: ["ADMIN", "OFFICE"] });

  return <>{children}</>;
}
