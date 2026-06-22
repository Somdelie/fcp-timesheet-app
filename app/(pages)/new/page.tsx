import CreateSiteForm from "@/components/sites/CreateSiteForm";
import { prisma } from "@/lib/prisma";

export default async function NewSitePage() {
  const [supervisors, admins] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPERVISOR" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OFFICE"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const supervisorOptions = supervisors.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "Unknown",
    email: u.email ?? "",
  }));

  const adminOptions = admins.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "Unknown",
    email: u.email ?? "",
  }));

  return (
    <div className="max-w-5xl mx-auto border p-6">
      <h1 className="text-xl font-semibold">Create site</h1>
      <div className="mt-4">
        <CreateSiteForm
          supervisorOptions={supervisorOptions}
          adminOptions={adminOptions}
        />
      </div>
    </div>
  );
}
