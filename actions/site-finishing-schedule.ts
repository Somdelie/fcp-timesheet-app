// actions/site-finishing-schedule.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import type { FinishingZone } from "@/generated/prisma/client";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

// ========================
// READ
// ========================

/**
 * Get a single finishing schedule with all areas + items
 */
export async function getFinishingSchedule(scheduleId: string) {
  await requireServerAuth();
  const id = clean(scheduleId);
  if (!id) return { ok: false as const, error: "Schedule ID is required." };

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id },
    include: {
      areas: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!schedule) return { ok: false as const, error: "Schedule not found." };

  return { ok: true as const, schedule };
}

/**
 * List all finishing schedules for a site
 */
export async function listFinishingSchedules(siteId: string) {
  await requireServerAuth();
  const id = clean(siteId);
  if (!id) return { ok: false as const, error: "Site ID is required." };

  const schedules = await prisma.siteFinishingSchedule.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "desc" },
    include: {
      areas: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return { ok: true as const, schedules };
}

// ========================
// CREATE
// ========================

export type CreateScheduleInput = {
  siteId: string;
  contractNo?: string | null;
  contractManager?: string | null;
  siteForeman?: string | null;
  client?: string | null;
  startDate?: string | null;
  completionDate?: string | null;
  drawingDetails?: string | null;
  contactInfo?: string | null;
  areas?: CreateAreaInput[];
};

export type CreateAreaInput = {
  name: string;
  label?: string | null;
  sortOrder?: number;
  items?: CreateItemInput[];
};

export type CreateItemInput = {
  zone: FinishingZone;
  position: string;
  product?: string | null;
  colorCode?: string | null;
  supplier?: string | null;
  sortOrder?: number;
  note?: string | null;
};

/**
 * Create a full finishing schedule with areas and items
 */
export async function createFinishingSchedule(input: CreateScheduleInput) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true },
  });
  if (!site) return { ok: false as const, error: "Site not found." };

  const schedule = await prisma.siteFinishingSchedule.create({
    data: {
      site: { connect: { id: siteId } },
      contractNo: input.contractNo ? clean(input.contractNo) : null,
      contractManager: input.contractManager
        ? clean(input.contractManager)
        : null,
      siteForeman: input.siteForeman ? clean(input.siteForeman) : null,
      client: input.client ? clean(input.client) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      completionDate: input.completionDate
        ? new Date(input.completionDate)
        : null,
      drawingDetails: input.drawingDetails ? clean(input.drawingDetails) : null,
      contactInfo: input.contactInfo ? clean(input.contactInfo) : null,
      areas: input.areas?.length
        ? {
            create: input.areas.map((area, ai) => ({
              name: clean(area.name),
              label: area.label ? clean(area.label) : null,
              sortOrder: area.sortOrder ?? ai,
              items: area.items?.length
                ? {
                    create: area.items.map((item, ii) => ({
                      zone: item.zone,
                      position: clean(item.position),
                      product: item.product ? clean(item.product) : null,
                      colorCode: item.colorCode ? clean(item.colorCode) : null,
                      supplier: item.supplier ? clean(item.supplier) : null,
                      sortOrder: item.sortOrder ?? ii,
                      note: item.note ? clean(item.note) : null,
                    })),
                  }
                : undefined,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidatePath(`/sites/${siteId}`);
  return { ok: true as const, id: schedule.id };
}

// ========================
// UPDATE SCHEDULE HEADER
// ========================

export async function updateFinishingSchedule(input: {
  id: string;
  contractNo?: string | null;
  contractManager?: string | null;
  siteForeman?: string | null;
  client?: string | null;
  startDate?: string | null;
  completionDate?: string | null;
  drawingDetails?: string | null;
  contactInfo?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(input.id);
  if (!id) return { ok: false as const, error: "Schedule ID is required." };

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id },
    select: { siteId: true },
  });
  if (!schedule) return { ok: false as const, error: "Schedule not found." };

  await prisma.siteFinishingSchedule.update({
    where: { id },
    data: {
      ...(input.contractNo !== undefined
        ? { contractNo: input.contractNo ? clean(input.contractNo) : null }
        : {}),
      ...(input.contractManager !== undefined
        ? {
            contractManager: input.contractManager
              ? clean(input.contractManager)
              : null,
          }
        : {}),
      ...(input.siteForeman !== undefined
        ? { siteForeman: input.siteForeman ? clean(input.siteForeman) : null }
        : {}),
      ...(input.client !== undefined
        ? { client: input.client ? clean(input.client) : null }
        : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.completionDate !== undefined
        ? {
            completionDate: input.completionDate
              ? new Date(input.completionDate)
              : null,
          }
        : {}),
      ...(input.drawingDetails !== undefined
        ? {
            drawingDetails: input.drawingDetails
              ? clean(input.drawingDetails)
              : null,
          }
        : {}),
      ...(input.contactInfo !== undefined
        ? { contactInfo: input.contactInfo ? clean(input.contactInfo) : null }
        : {}),
    },
  });

  revalidatePath(`/sites/${schedule.siteId}`);
  return { ok: true as const };
}

// ========================
// DELETE SCHEDULE
// ========================

export async function deleteFinishingSchedule(scheduleId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(scheduleId);
  if (!id) return { ok: false as const, error: "Schedule ID is required." };

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id },
    select: { siteId: true },
  });
  if (!schedule) return { ok: false as const, error: "Schedule not found." };

  await prisma.siteFinishingSchedule.delete({ where: { id } });

  revalidatePath(`/sites/${schedule.siteId}`);
  return { ok: true as const };
}

// ========================
// AREA CRUD
// ========================

export async function addFinishingArea(input: {
  scheduleId: string;
  name: string;
  label?: string | null;
  sortOrder?: number;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const scheduleId = clean(input.scheduleId);
  if (!scheduleId)
    return { ok: false as const, error: "Schedule ID is required." };

  const name = clean(input.name);
  if (!name) return { ok: false as const, error: "Area name is required." };

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id: scheduleId },
    select: { siteId: true },
  });
  if (!schedule) return { ok: false as const, error: "Schedule not found." };

  const area = await prisma.siteFinishingScheduleArea.create({
    data: {
      schedule: { connect: { id: scheduleId } },
      name,
      label: input.label ? clean(input.label) : null,
      sortOrder: input.sortOrder ?? 0,
    },
    select: { id: true },
  });

  revalidatePath(`/sites/${schedule.siteId}`);
  return { ok: true as const, id: area.id };
}

export async function updateFinishingArea(input: {
  id: string;
  name?: string;
  label?: string | null;
  sortOrder?: number;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(input.id);
  if (!id) return { ok: false as const, error: "Area ID is required." };

  const area = await prisma.siteFinishingScheduleArea.findUnique({
    where: { id },
    select: { schedule: { select: { siteId: true } } },
  });
  if (!area) return { ok: false as const, error: "Area not found." };

  await prisma.siteFinishingScheduleArea.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: clean(input.name) } : {}),
      ...(input.label !== undefined
        ? { label: input.label ? clean(input.label) : null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const };
}

export async function deleteFinishingArea(areaId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(areaId);
  if (!id) return { ok: false as const, error: "Area ID is required." };

  const area = await prisma.siteFinishingScheduleArea.findUnique({
    where: { id },
    select: { schedule: { select: { siteId: true } } },
  });
  if (!area) return { ok: false as const, error: "Area not found." };

  await prisma.siteFinishingScheduleArea.delete({ where: { id } });

  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const };
}

// ========================
// ITEM CRUD
// ========================

export async function addFinishingItem(input: {
  areaId: string;
  zone: FinishingZone;
  position: string;
  product?: string | null;
  colorCode?: string | null;
  supplier?: string | null;
  sortOrder?: number;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const areaId = clean(input.areaId);
  if (!areaId) return { ok: false as const, error: "Area ID is required." };

  const position = clean(input.position);
  if (!position) return { ok: false as const, error: "Position is required." };

  const area = await prisma.siteFinishingScheduleArea.findUnique({
    where: { id: areaId },
    select: { schedule: { select: { siteId: true } } },
  });
  if (!area) return { ok: false as const, error: "Area not found." };

  const item = await prisma.siteFinishingScheduleItem.create({
    data: {
      area: { connect: { id: areaId } },
      zone: input.zone,
      position,
      product: input.product ? clean(input.product) : null,
      colorCode: input.colorCode ? clean(input.colorCode) : null,
      supplier: input.supplier ? clean(input.supplier) : null,
      sortOrder: input.sortOrder ?? 0,
      note: input.note ? clean(input.note) : null,
    },
    select: { id: true },
  });

  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const, id: item.id };
}

export async function updateFinishingItem(input: {
  id: string;
  zone?: FinishingZone;
  position?: string;
  product?: string | null;
  colorCode?: string | null;
  supplier?: string | null;
  sortOrder?: number;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(input.id);
  if (!id) return { ok: false as const, error: "Item ID is required." };

  const item = await prisma.siteFinishingScheduleItem.findUnique({
    where: { id },
    select: { area: { select: { schedule: { select: { siteId: true } } } } },
  });
  if (!item) return { ok: false as const, error: "Item not found." };

  await prisma.siteFinishingScheduleItem.update({
    where: { id },
    data: {
      ...(input.zone !== undefined ? { zone: input.zone } : {}),
      ...(input.position !== undefined
        ? { position: clean(input.position) }
        : {}),
      ...(input.product !== undefined
        ? { product: input.product ? clean(input.product) : null }
        : {}),
      ...(input.colorCode !== undefined
        ? { colorCode: input.colorCode ? clean(input.colorCode) : null }
        : {}),
      ...(input.supplier !== undefined
        ? { supplier: input.supplier ? clean(input.supplier) : null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.note !== undefined
        ? { note: input.note ? clean(input.note) : null }
        : {}),
    },
  });

  revalidatePath(`/sites/${item.area.schedule.siteId}`);
  return { ok: true as const };
}

export async function deleteFinishingItem(itemId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(itemId);
  if (!id) return { ok: false as const, error: "Item ID is required." };

  const item = await prisma.siteFinishingScheduleItem.findUnique({
    where: { id },
    select: { area: { select: { schedule: { select: { siteId: true } } } } },
  });
  if (!item) return { ok: false as const, error: "Item not found." };

  await prisma.siteFinishingScheduleItem.delete({ where: { id } });

  revalidatePath(`/sites/${item.area.schedule.siteId}`);
  return { ok: true as const };
}

// ========================
// BULK: Add multiple items to an area at once
// ========================

export async function addFinishingItemsBulk(input: {
  areaId: string;
  items: CreateItemInput[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const areaId = clean(input.areaId);
  if (!areaId) return { ok: false as const, error: "Area ID is required." };
  if (!input.items?.length)
    return { ok: false as const, error: "No items provided." };

  const area = await prisma.siteFinishingScheduleArea.findUnique({
    where: { id: areaId },
    select: { schedule: { select: { siteId: true } } },
  });
  if (!area) return { ok: false as const, error: "Area not found." };

  await prisma.siteFinishingScheduleItem.createMany({
    data: input.items.map((item, i) => ({
      areaId,
      zone: item.zone,
      position: clean(item.position),
      product: item.product ? clean(item.product) : null,
      colorCode: item.colorCode ? clean(item.colorCode) : null,
      supplier: item.supplier ? clean(item.supplier) : null,
      sortOrder: item.sortOrder ?? i,
      note: item.note ? clean(item.note) : null,
    })),
  });

  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const, added: input.items.length };
}
