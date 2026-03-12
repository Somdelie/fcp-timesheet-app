// @ts-nocheck

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import { EmployeeDetailContent } from "./EmployeeDetailContent";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }) {
  const { id } = await params;

  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const employee = await prisma.employee.findFirst({
    where: { id, ...whereScope },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: {
        select: {
          role: true,
          isSheRep: true,
          foreman: { select: { id: true } },
        },
      },
      createdByUser: {
        select: {
          role: true,
        },
      },
      foremanLinks: {
        select: {
          foremanId: true,
          reason: true,
          foreman: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return <div className="p-6">Employee not found</div>;
  }

  const isForeman = !!(
    employee.user?.role === "FOREMAN" && employee.user?.foreman
  );
  const isSheRep = !!employee.user?.isSheRep;

  return (
    <EmployeeDetailContent
      employee={{
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        qrCodeValue: employee.qrCodeValue,
        defaultDayRate: employee.defaultDayRate.toString(),
        faceImageUrl: employee.faceImageUrl,
        isActive: employee.isActive,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
        createdByRole: employee.createdByUser?.role,
        foremanLinks: employee.foremanLinks,
        userId: employee.userId,
        isForeman,
        isSheRep,
      }}
    />
  );
}
