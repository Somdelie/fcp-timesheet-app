import type { FinishingZone } from "@/generated/prisma/client";
import type { FinishingScheduleWithRelations } from "./getFinishingSchedulePdfData";

/* ------------------------------------------------------------------
 *  DTO shapes
 * ------------------------------------------------------------------ */

export type FinishingSchedulePdfItemDto = {
  id: string;
  zone: FinishingZone;
  position: string;
  product: string;
  colorCode: string;
  supplier: string;
  note: string;
};

export type FinishingSchedulePdfAreaDto = {
  id: string;
  name: string;
  label: string | null;
  displayName: string;
  items: FinishingSchedulePdfItemDto[];
};

export type FinishingSchedulePdfDto = {
  id: string;
  title: string;
  siteName: string;
  siteCode: string;
  siteAddress: string;
  contractNo: string;
  contractManager: string;
  siteForeman: string;
  client: string;
  startDate: string;
  completionDate: string;
  drawingDetails: string;
  contactInfo: string;
  fcpQs: string;
  areas: FinishingSchedulePdfAreaDto[];
  hasItems: boolean;
};

/* ------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------ */

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function show(value: string | null | undefined): string {
  const v = clean(value);
  return v || "\u2014"; // em dash
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function zoneRank(zone: FinishingZone): number {
  return zone === "INTERNAL" ? 0 : 1;
}

/* ------------------------------------------------------------------
 *  Mapper
 * ------------------------------------------------------------------ */

export function mapFinishingScheduleToPdfDto(
  schedule: FinishingScheduleWithRelations,
): FinishingSchedulePdfDto {
  const areas: FinishingSchedulePdfAreaDto[] = schedule.areas.map((area) => {
    const items = [...area.items]
      .sort((a, b) => {
        const zoneDiff = zoneRank(a.zone) - zoneRank(b.zone);
        if (zoneDiff !== 0) return zoneDiff;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.position || "").localeCompare(b.position || "");
      })
      .map((item) => ({
        id: item.id,
        zone: item.zone,
        position: show(item.position),
        product: show(item.product),
        colorCode: show(item.colorCode),
        supplier: show(item.supplier),
        note: clean(item.note),
      }));

    const name = clean(area.name);
    const label = clean(area.label) || null;

    return {
      id: area.id,
      name,
      label,
      displayName: label ? `${name} - ${label}` : name,
      items,
    };
  });

  return {
    id: schedule.id,
    title: "FINISHING SCHEDULE",
    siteName: show(schedule.site?.name),
    siteCode: show(schedule.site?.code),
    siteAddress: show(schedule.siteAddress || schedule.site?.address || schedule.site?.location),
    contractNo: show(schedule.contractNo || schedule.site?.code),
    contractManager: show(schedule.contractManager),
    siteForeman: show(schedule.siteForeman),
    client: show(schedule.client || schedule.site?.client),
    startDate: formatDate(schedule.startDate),
    completionDate: formatDate(schedule.completionDate),
    drawingDetails: show(schedule.drawingDetails),
    contactInfo: show(schedule.contactInfo),
    fcpQs: show(schedule.fcpQs),
    areas,
    hasItems: areas.some((a) => a.items.length > 0),
  };
}
