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
      site: { select: { id: true, name: true, code: true } },
      areas: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }],
            include: {
              finishingVariant: { select: { id: true, label: true } },
              siteMaterial: {
                select: {
                  id: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      supplier: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
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

  // ✅ NEW
  fcpContractManager?: string | null;
  fcpSiteForeman?: string | null;

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

      // ✅ NEW
      fcpContractManager: input.fcpContractManager
        ? clean(input.fcpContractManager)
        : null,
      fcpSiteForeman: input.fcpSiteForeman ? clean(input.fcpSiteForeman) : null,

      client: input.client ? clean(input.client) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      completionDate: input.completionDate
        ? new Date(input.completionDate)
        : null,
      drawingDetails: input.drawingDetails ? clean(input.drawingDetails) : null,
      contactInfo: input.contactInfo ? clean(input.contactInfo) : null,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  return { ok: true as const, id: schedule.id };
}

// ========================
// UPDATE SCHEDULE HEADER
// ========================

export async function updateFinishingSchedule(input: {
  id: string;
  siteAddress?: string | null;
  contractNo?: string | null;
  contractManager?: string | null;
  siteForeman?: string | null;
  fcpContractManager?: string | null;
  fcpSiteForeman?: string | null;
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
      ...(input.siteAddress !== undefined
        ? { siteAddress: input.siteAddress ? clean(input.siteAddress) : null }
        : {}),

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
        ? {
            siteForeman: input.siteForeman ? clean(input.siteForeman) : null,
          }
        : {}),

      ...(input.fcpContractManager !== undefined
        ? {
            fcpContractManager: input.fcpContractManager
              ? clean(input.fcpContractManager)
              : null,
          }
        : {}),

      ...(input.fcpSiteForeman !== undefined
        ? {
            fcpSiteForeman: input.fcpSiteForeman
              ? clean(input.fcpSiteForeman)
              : null,
          }
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
  revalidatePath(`/finishing-schedules/${id}`);

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

  revalidatePath(`/finishing-schedules`);
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
  siteMaterialId?: string | null;
  product?: string | null;
  supplierId?: string | null;
  colorCode?: string | null;
  note?: string | null;
  sortOrder?: number;
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

  const smId = input.siteMaterialId ? clean(input.siteMaterialId) : null;
  let procProductId: string | null = null;

  // Auto-fill procurementProductId from site material linkage
  if (smId) {
    const sm = await prisma.siteMaterial.findUnique({
      where: { id: smId },
      select: { product: { select: { id: true } } },
    });
    if (sm) procProductId = sm.product.id;
  }

  // Resolve supplier name snapshot from explicit supplierId
  const suppId = input.supplierId ? clean(input.supplierId) : null;
  let supplierSnapshot: string | null = null;
  if (suppId) {
    const sup = await prisma.supplier.findUnique({
      where: { id: suppId },
      select: { name: true },
    });
    if (sup) supplierSnapshot = sup.name;
  }

  const item = await prisma.siteFinishingScheduleItem.create({
    data: {
      areaId,
      zone: input.zone,
      position,
      siteMaterialId: smId ?? undefined,
      product: input.product ? clean(input.product) : null,
      colorCode: input.colorCode ? clean(input.colorCode) : null,
      supplier: supplierSnapshot,
      procurementProductId: procProductId ?? undefined,
      supplierId: suppId ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      note: input.note ? clean(input.note) : null,
    },
    select: { id: true },
  });

  revalidatePath(`/finishing-schedules`);
  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const, id: item.id };
}

export async function updateFinishingItem(input: {
  id: string;
  zone?: FinishingZone;
  position?: string;
  siteMaterialId?: string | null;
  product?: string | null;
  supplierId?: string | null;
  colorCode?: string | null;
  note?: string | null;
  sortOrder?: number;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (input.zone !== undefined) data.zone = input.zone;
  if (input.position !== undefined) data.position = clean(input.position);
  if (input.colorCode !== undefined)
    data.colorCode = input.colorCode ? clean(input.colorCode) : null;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.note !== undefined)
    data.note = input.note ? clean(input.note) : null;

  // Manual product text
  if (input.product !== undefined)
    data.product = input.product ? clean(input.product) : null;

  // Site material linkage (procurement only — no longer drives product/supplier display)
  if (input.siteMaterialId !== undefined) {
    const smId = input.siteMaterialId ? clean(input.siteMaterialId) : null;
    data.siteMaterialId = smId;
    if (smId) {
      const sm = await prisma.siteMaterial.findUnique({
        where: { id: smId },
        select: { product: { select: { id: true } } },
      });
      data.procurementProductId = sm?.product.id ?? null;
    } else {
      data.procurementProductId = null;
    }
  }

  // Explicit supplier selection
  if (input.supplierId !== undefined) {
    const suppId = input.supplierId ? clean(input.supplierId) : null;
    data.supplierId = suppId;
    if (suppId) {
      const sup = await prisma.supplier.findUnique({
        where: { id: suppId },
        select: { name: true },
      });
      data.supplier = sup?.name ?? null;
    } else {
      data.supplier = null;
    }
  }

  await prisma.siteFinishingScheduleItem.update({ where: { id }, data });

  revalidatePath(`/finishing-schedules`);
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

  revalidatePath(`/finishing-schedules`);
  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const, added: input.items.length };
}

// ========================
// REORDER
// ========================

export async function reorderFinishingAreas(input: {
  scheduleId: string;
  areaIds: string[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const scheduleId = clean(input.scheduleId);
  if (!scheduleId)
    return { ok: false as const, error: "Schedule ID is required." };

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id: scheduleId },
    select: { siteId: true },
  });
  if (!schedule) return { ok: false as const, error: "Schedule not found." };

  await prisma.$transaction(
    input.areaIds.map((id, i) =>
      prisma.siteFinishingScheduleArea.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  );

  revalidatePath(`/finishing-schedules`);
  revalidatePath(`/sites/${schedule.siteId}`);
  return { ok: true as const };
}

export async function reorderFinishingItems(input: {
  areaId: string;
  itemIds: string[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const areaId = clean(input.areaId);
  if (!areaId) return { ok: false as const, error: "Area ID is required." };

  const area = await prisma.siteFinishingScheduleArea.findUnique({
    where: { id: areaId },
    select: { schedule: { select: { siteId: true } } },
  });
  if (!area) return { ok: false as const, error: "Area not found." };

  await prisma.$transaction(
    input.itemIds.map((id, i) =>
      prisma.siteFinishingScheduleItem.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  );

  revalidatePath(`/finishing-schedules`);
  revalidatePath(`/sites/${area.schedule.siteId}`);
  return { ok: true as const };
}

// ========================
// LIST SUPPLIERS FOR SCHEDULE BUILDER
// ========================

export async function listSuppliersForSchedule() {
  await requireServerAuth();
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return { ok: true as const, suppliers };
}

// ========================
// LIST SITE MATERIALS FOR SCHEDULE BUILDER
// ========================

export async function listSiteMaterialsForSchedule(siteId: string) {
  await requireServerAuth();
  const id = clean(siteId);
  if (!id) return { ok: false as const, error: "Site ID is required." };

  const materials = await prisma.siteMaterial.findMany({
    where: { siteId: id },
    orderBy: { product: { name: "asc" } },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      usages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true },
      },
    },
  });

  return { ok: true as const, materials };
}

// ========================
// FINISHING VARIANT CRUD
// ========================

export async function listFinishingVariants() {
  await requireServerAuth();
  const variants = await prisma.finishingVariant.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, sortOrder: true },
  });
  return { ok: true as const, variants };
}

export async function createFinishingVariant(input: { label: string }) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const label = clean(input.label);
  if (!label) return { ok: false as const, error: "Label is required." };

  const normalized = label.toLowerCase().replace(/\s+/g, " ");

  // Check for duplicate
  const existing = await prisma.finishingVariant.findFirst({
    where: { normalizedLabel: normalized },
    select: { id: true, label: true, isActive: true },
  });
  if (existing) {
    if (!existing.isActive) {
      // Reactivate
      await prisma.finishingVariant.update({
        where: { id: existing.id },
        data: { isActive: true, label },
      });
      return { ok: true as const, id: existing.id };
    }
    return { ok: false as const, error: `"${existing.label}" already exists.` };
  }

  const variant = await prisma.finishingVariant.create({
    data: { label, normalizedLabel: normalized },
    select: { id: true },
  });

  return { ok: true as const, id: variant.id };
}

export async function updateFinishingVariant(input: {
  id: string;
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(input.id);
  if (!id) return { ok: false as const, error: "Variant ID is required." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (input.label !== undefined) {
    const label = clean(input.label);
    if (!label) return { ok: false as const, error: "Label is required." };
    data.label = label;
    data.normalizedLabel = label.toLowerCase().replace(/\s+/g, " ");
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.finishingVariant.update({ where: { id }, data });

  return { ok: true as const };
}
