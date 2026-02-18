import { getAllForemen } from "@/actions/user";
import { requireServerAuth } from "@/lib/auth-server";
import { ForemanContent } from "./ForemanContent";

export const revalidate = 300;

export default async function ForemanPage() {
  const auth = await requireServerAuth();

  // Optionally: restrict access to only admins or supervisors
  // if (!["ADMIN", "SUPERVISOR"].includes(auth.user.role)) {
  //   return <div className="p-6 text-red-600">Access denied</div>;
  // }

  const foremen = await getAllForemen();

  // Format dates on server to avoid hydration errors
  const formattedForemen = foremen.map((foreman) => ({
    ...foreman,
    name: foreman.name ?? "",
    createdAt: new Date(foreman.createdAt).toLocaleDateString(),
    foreman: foreman.foreman
      ? {
          id: foreman.foreman.id,
          defaultDayRate: foreman.foreman.defaultDayRate?.toString() ?? null,
          createdAt: new Date(foreman.foreman.createdAt).toLocaleDateString(),
        }
      : null,
    // Check if this foreman is actually an assistant (promoted employee with assistantLinks)
    isAssistant: (foreman.employee?.assistantLinks?.length ?? 0) > 0,
  }));

  return <ForemanContent foremen={formattedForemen} />;
}
