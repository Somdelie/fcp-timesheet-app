// @ts-nocheck
import { requireAuth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function PagesLayout({ children }) {
  // All routes under (pages) require an authenticated user.
  const session = await requireAuth();

  return <AppShell role={session.user.role}>{children}</AppShell>;
}
