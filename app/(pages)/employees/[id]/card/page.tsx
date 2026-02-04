// @ts-nocheck

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import QRCode from "qrcode";
import PrintCardButton from "@/components/employees/PrintCardButton";

export const dynamic = "force-dynamic";

export default async function EmployeeCardPage({ params }) {
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
    },
  });

  if (!employee) {
    return <div className="p-6">Not found</div>;
  }

  const qrDataUrl = await QRCode.toDataURL(employee.qrCodeValue, {
    margin: 0,
    width: 512,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="p-6">
      <PrintCardButton employeeId={employee.id} />
      {/* …your card UI… */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR" />
    </div>
  );
}
