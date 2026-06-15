// app/admin/job-program/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

type ProgrammeItemInput = {
  id?: string;
  title: string;
  trade?: string;
  description?: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  actualStartDate?: string | null;
  actualFinishDate?: string | null;
  sortOrder: number;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function serialize(row: unknown) {
  return JSON.parse(
    JSON.stringify(row, (_key, value) =>
      value instanceof Date ? value.toISOString() : value,
    ),
  );
}

function getItemStatus(item: ProgrammeItemInput) {
  if (item.actualFinishDate) {
    const actualFinish = new Date(item.actualFinishDate);
    const plannedFinish = new Date(item.plannedFinishDate);

    if (actualFinish > plannedFinish) return "OVERSTAYED";
    return "COMPLETED";
  }

  const today = new Date();
  const start = new Date(item.plannedStartDate);
  const finish = new Date(item.plannedFinishDate);

  if (today > finish) return "OVERSTAYED";
  if (today >= start) return "IN_PROGRESS";

  return "PLANNED";
}

export async function getSiteProgramme(siteId: string) {
  await requireServerAuth();

  const programme = await prisma.siteProgramme.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          code: true,
          client: true,
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return serialize(programme);
}

export async function listSitesForProgrammePlanner() {
  await requireServerAuth();

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      client: true,
      siteProgrammes: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          plannedStartDate: true,
          plannedFinishDate: true,
          updatedAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  return serialize(
    sites.map((site) => {
      const programme = site.siteProgrammes[0] ?? null;

      return {
        id: site.id,
        name: site.name,
        code: site.code,
        client: site.client,
        latestProgramme: programme
          ? {
              id: programme.id,
              title: programme.title,
              plannedStartDate: programme.plannedStartDate,
              plannedFinishDate: programme.plannedFinishDate,
              updatedAt: programme.updatedAt,
              itemCount: programme._count.items,
            }
          : null,
      };
    }),
  );
}

export async function createSiteProgramme(input: {
  siteId: string;
  title: string;
  description?: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  items: ProgrammeItemInput[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const siteId = clean(input.siteId);
  const title = clean(input.title);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!title) return { ok: false as const, error: "Programme title is required." };
  if (!input.items.length) {
    return { ok: false as const, error: "Add at least one programme activity." };
  }

  const programme = await prisma.siteProgramme.create({
    data: {
      siteId,
      title,
      description: clean(input.description) || null,
      plannedStartDate: new Date(input.plannedStartDate),
      plannedFinishDate: new Date(input.plannedFinishDate),
      status: "ACTIVE",
      createdByUserId: auth.userId,
      items: {
        create: input.items.map((item, index) => ({
          title: clean(item.title),
          trade: clean(item.trade) || null,
          description: clean(item.description) || null,
          plannedStartDate: new Date(item.plannedStartDate),
          plannedFinishDate: new Date(item.plannedFinishDate),
          actualStartDate: item.actualStartDate
            ? new Date(item.actualStartDate)
            : null,
          actualFinishDate: item.actualFinishDate
            ? new Date(item.actualFinishDate)
            : null,
          status: getItemStatus(item),
          sortOrder: item.sortOrder ?? index,
        })),
      },
    },
  });

  revalidatePath("/admin/site-program");
  revalidatePath("/admin/sites-operations");
  return { ok: true as const, programme: serialize(programme) };
}

export async function updateSiteProgramme(input: {
  programmeId: string;
  title: string;
  description?: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  items: ProgrammeItemInput[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const programmeId = clean(input.programmeId);
  const title = clean(input.title);
  if (!programmeId) {
    return { ok: false as const, error: "Programme ID is required." };
  }
  if (!title) return { ok: false as const, error: "Programme title is required." };
  if (!input.items.length) {
    return { ok: false as const, error: "Add at least one programme activity." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteProgramme.update({
      where: { id: programmeId },
      data: {
        title,
        description: clean(input.description) || null,
        plannedStartDate: new Date(input.plannedStartDate),
        plannedFinishDate: new Date(input.plannedFinishDate),
      },
    });

    await tx.siteProgrammeItem.deleteMany({
      where: { programmeId },
    });

    await tx.siteProgrammeItem.createMany({
      data: input.items.map((item, index) => ({
        programmeId,
        title: clean(item.title),
        trade: clean(item.trade) || null,
        description: clean(item.description) || null,
        plannedStartDate: new Date(item.plannedStartDate),
        plannedFinishDate: new Date(item.plannedFinishDate),
        actualStartDate: item.actualStartDate
          ? new Date(item.actualStartDate)
          : null,
        actualFinishDate: item.actualFinishDate
          ? new Date(item.actualFinishDate)
          : null,
        status: getItemStatus(item),
        sortOrder: item.sortOrder ?? index,
      })),
    });
  });

  revalidatePath("/admin/site-program");
  revalidatePath("/admin/sites-operations");
  return { ok: true as const };
}

export async function markProgrammeItemFinished(input: {
  itemId: string;
  actualFinishDate: string;
}) {
  await requireServerAuth();

  const item = await prisma.siteProgrammeItem.findUniqueOrThrow({
    where: { id: input.itemId },
  });

  const actualFinish = new Date(input.actualFinishDate);
  const plannedFinish = item.plannedFinishDate;

  await prisma.siteProgrammeItem.update({
    where: { id: input.itemId },
    data: {
      actualFinishDate: actualFinish,
      status: actualFinish > plannedFinish ? "OVERSTAYED" : "COMPLETED",
    },
  });

  revalidatePath("/admin/site-program");
  revalidatePath("/admin/sites-operations");
  return { ok: true as const };
}

export async function deleteSiteProgramme(programmeId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  await prisma.siteProgramme.delete({
    where: { id: programmeId },
  });

  revalidatePath("/admin/site-program");
  revalidatePath("/admin/sites-operations");
  return { ok: true as const };
}
