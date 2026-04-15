import { getAllForemen } from "@/actions/user";
import { AdminForemenContent } from "./AdminForemenContent";

export const revalidate = 300;

export default async function AdminForemenPage() {
  const foremen = await getAllForemen();

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
          supervisorId: foreman.foreman.supervisorLinks[0]?.supervisor.id ?? null,
          supervisorName: foreman.foreman.supervisorLinks[0]?.supervisor.user.name ?? null,
        }
      : null,
    isAssistant: (foreman.employee?.assistantLinks?.length ?? 0) > 0,
  }));

  return <AdminForemenContent foremen={formattedForemen} />;
}
