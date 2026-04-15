import { getAllForemen, getAllSupervisors } from "@/actions/user";
import { requireServerAuth } from "@/lib/auth-server";
import { ForemanContent } from "./ForemanContent";

export const revalidate = 300;

export default async function ForemanPage() {
  const auth = await requireServerAuth();

  const [foremen, supervisors] = await Promise.all([
    getAllForemen(),
    getAllSupervisors(),
  ]);

  // Format dates on server to avoid hydration errors
  const formattedForemen = foremen.map((foreman) => ({
    ...foreman,
    name: foreman.name ?? "",
    createdAt: new Date(foreman.createdAt).toLocaleDateString(),
    foreman: foreman.foreman
      ? {
          id: foreman.foreman.id,
          defaultDayRate: foreman.foreman.defaultDayRate?.toString() ?? null,
          defaultTeam: foreman.foreman.defaultTeam ?? "PAINTERS",
          createdAt: new Date(foreman.foreman.createdAt).toLocaleDateString(),
          supervisorId:
            foreman.foreman.supervisorLinks[0]?.supervisor.id ?? null,
          supervisorName:
            foreman.foreman.supervisorLinks[0]?.supervisor.user.name ?? null,
        }
      : null,
    isAssistant: (foreman.employee?.assistantLinks?.length ?? 0) > 0,
  }));

  const formattedSupervisors = supervisors.map((s) => ({
    id: s.supervisor?.id ?? s.id,
    name: s.name ?? s.email,
  }));

  return (
    <ForemanContent
      foremen={formattedForemen}
      supervisors={formattedSupervisors}
    />
  );
}
