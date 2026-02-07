import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireServerAuth();

    // Only admin can view settings
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      // Create default settings if they don't exist
      const created = await prisma.companySettings.create({
        data: { id: "singleton" },
      });
      return NextResponse.json({
        ok: true,
        settings: {
          defaultEmployeeDayRate: Number(created.defaultEmployeeDayRate),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        defaultEmployeeDayRate: Number(settings.defaultEmployeeDayRate),
      },
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireServerAuth();

    // Only admin can update settings
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { defaultEmployeeDayRate } = body;

    if (defaultEmployeeDayRate === undefined) {
      return NextResponse.json(
        { error: "defaultEmployeeDayRate is required" },
        { status: 400 },
      );
    }

    const dayRateNum = Number(defaultEmployeeDayRate);
    if (!Number.isFinite(dayRateNum) || dayRateNum < 0) {
      return NextResponse.json(
        { error: "defaultEmployeeDayRate must be a valid number >= 0" },
        { status: 400 },
      );
    }

    // Upsert settings
    const settings = await prisma.companySettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        defaultEmployeeDayRate: dayRateNum.toFixed(2) as any,
      },
      update: {
        defaultEmployeeDayRate: dayRateNum.toFixed(2) as any,
      },
    });

    return NextResponse.json({
      ok: true,
      settings: {
        defaultEmployeeDayRate: Number(settings.defaultEmployeeDayRate),
      },
    });
  } catch (error) {
    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
