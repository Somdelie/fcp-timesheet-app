// @ts-nocheck
import { requireAuth } from "@/lib/auth";

export default async function AdminLayout({ children }) {
  // Require ADMIN role for all admin routes
  const session = await requireAuth({ roles: ["ADMIN"] });

  return <>{children}</>;
}
