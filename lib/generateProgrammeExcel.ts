import type ExcelJS from "exceljs";
import type { ProgrammePdfInput, ProgrammePdfItem } from "@/lib/generateProgrammePdf";
import { getProgrammeActivityColor } from "@/lib/programmeActivityColors";

const dayColumnWidth = 4.2;
const activityColumnWidth = 26;

const colors = {
  white: "FFFFFFFF",
  cardBg: "FFFAFAFA",
  headerBg: "FFF9FAFB",
  border: "FFDADDE3",
  borderStrong: "FF64748B",
  textPrimary: "FF111827",
  textMuted: "FF667085",
  primary: "FF2F3B59",
  destructiveLight: "FFFCE7E7",
  destructiveText: "FFB91C1C",
  overrun: "FFF4B6B6",
};

function dateOnly(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(left: Date, right: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateOnly(left).getTime() - dateOnly(right).getTime()) / msPerDay);
}

function formatIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortItems(items: ProgrammePdfItem[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const startDiff =
        dateOnly(a.item.startDate).getTime() - dateOnly(b.item.startDate).getTime();
      if (startDiff !== 0) return startDiff;

      const finishDiff =
        dateOnly(a.item.finishDate).getTime() -
        dateOnly(b.item.finishDate).getTime();
      if (finishDiff !== 0) return finishDiff;

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function getCalendarRange(input: ProgrammePdfInput) {
  const values = [
    input.plannedStartDate,
    input.plannedFinishDate,
    ...input.items.flatMap((item) => [
      item.startDate,
      item.finishDate,
      item.actualFinishDate || item.finishDate,
    ]),
  ].filter(Boolean);

  const dates = values.map((value) => dateOnly(value));
  const start = dates.reduce((earliest, date) =>
    date.getTime() < earliest.getTime() ? date : earliest,
  );
  const finish = dates.reduce((latest, date) =>
    date.getTime() > latest.getTime() ? date : latest,
  );

  return { start, finish };
}

function fill(argb: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

function border(color = colors.border): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

export async function generateProgrammeExcel(input: ProgrammePdfInput) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FCP";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Programme Calendar", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [
      {
        state: "frozen",
        xSplit: 1,
        ySplit: 4,
        showGridLines: false,
      },
    ],
  });

  const sortedItems = sortItems(input.items);
  const { start, finish } = getCalendarRange(input);
  const totalDays = diffDays(finish, start) + 1;
  const days = Array.from({ length: totalDays }).map((_, index) =>
    addDays(start, index),
  );
  const today = dateOnly(new Date());
  const firstDayCol = 2;

  sheet.getColumn(1).width = activityColumnWidth;
  for (let index = 0; index < days.length; index += 1) {
    sheet.getColumn(firstDayCol + index).width = dayColumnWidth;
  }

  sheet.mergeCells(1, 1, 1, Math.max(firstDayCol + days.length - 1, 6));
  const title = sheet.getCell(1, 1);
  title.value = "Programme Calendar";
  title.font = { bold: true, size: 18, color: { argb: colors.textPrimary } };
  title.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells(2, 1, 2, Math.max(firstDayCol + days.length - 1, 6));
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = [
    input.siteLabel,
    input.client || "",
    `${formatIso(dateOnly(input.plannedStartDate))} to ${formatIso(
      dateOnly(input.plannedFinishDate),
    )}`,
    `${input.items.length} activities`,
  ]
    .filter(Boolean)
    .join(" | ");
  subtitle.font = { bold: true, size: 10, color: { argb: colors.textMuted } };

  const weekRow = sheet.getRow(3);
  const dateRow = sheet.getRow(4);
  weekRow.height = 22;
  dateRow.height = 28;

  const activityHeader = sheet.getCell(3, 1);
  sheet.mergeCells(3, 1, 4, 1);
  activityHeader.value = "Activity";
  activityHeader.font = { bold: true, color: { argb: colors.textPrimary } };
  activityHeader.fill = fill(colors.headerBg);
  activityHeader.alignment = { vertical: "middle", horizontal: "left" };
  activityHeader.border = border();

  let weekStartIndex = 0;
  while (weekStartIndex < days.length) {
    const weekEndIndex = Math.min(weekStartIndex + 7, days.length);
    const startCol = firstDayCol + weekStartIndex;
    const endCol = firstDayCol + weekEndIndex - 1;
    sheet.mergeCells(3, startCol, 3, endCol);
    const cell = sheet.getCell(3, startCol);
    cell.value = `Week ${Math.floor(weekStartIndex / 7) + 1}`;
    cell.font = { bold: true, color: { argb: colors.white }, size: 9 };
    cell.fill = fill(colors.primary);
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = border(colors.primary);
    weekStartIndex = weekEndIndex;
  }

  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    const col = firstDayCol + index;
    const cell = sheet.getCell(4, col);
    const isPast = day.getTime() < today.getTime();
    cell.value = `${String(day.getDate()).padStart(2, "0")}\n${day.toLocaleDateString(
      undefined,
      { month: "short" },
    )}`;
    cell.font = {
      bold: true,
      size: 8,
      color: { argb: isPast ? colors.destructiveText : colors.textMuted },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.fill = fill(isPast ? colors.destructiveLight : colors.headerBg);
    cell.border = {
      ...border(),
      left:
        index % 7 === 0
          ? { style: "medium", color: { argb: colors.borderStrong } }
          : { style: "thin", color: { argb: colors.border } },
    };
  }

  sortedItems.forEach((item, itemIndex) => {
    const activityColor = getProgrammeActivityColor(
      item.colorIndex ?? itemIndex,
    );
    const rowNumber = 5 + itemIndex;
    const row = sheet.getRow(rowNumber);
    row.height = 28;

    const activityCell = sheet.getCell(rowNumber, 1);
    activityCell.value = `${itemIndex + 1}. ${item.name}\n${formatIso(
      dateOnly(item.startDate),
    )} to ${formatIso(dateOnly(item.finishDate))}`;
    activityCell.font = { bold: true, size: 9, color: { argb: colors.textPrimary } };
    activityCell.alignment = { vertical: "middle", wrapText: true };
    activityCell.fill = fill(itemIndex % 2 === 0 ? colors.white : colors.cardBg);
    activityCell.border = border();

    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex];
      const cell = sheet.getCell(rowNumber, firstDayCol + dayIndex);
      const isPast = day.getTime() < today.getTime();
      cell.fill = fill(isPast ? colors.destructiveLight : colors.white);
      cell.border = {
        ...border(),
        left:
          dayIndex % 7 === 0
            ? { style: "medium", color: { argb: colors.borderStrong } }
            : { style: "thin", color: { argb: colors.border } },
      };
    }

    const startOffset = diffDays(dateOnly(item.startDate), start);
    const finishOffset = diffDays(dateOnly(item.finishDate), start);
    for (let dayIndex = Math.max(0, startOffset); dayIndex <= finishOffset; dayIndex += 1) {
      const cell = sheet.getCell(rowNumber, firstDayCol + dayIndex);
      cell.fill = fill(activityColor.fillHex);
      cell.border = {
        ...cell.border,
        top: { style: "medium", color: { argb: activityColor.borderHex } },
        bottom: { style: "medium", color: { argb: activityColor.borderHex } },
        left:
          dayIndex === startOffset
            ? { style: "medium", color: { argb: activityColor.borderHex } }
            : cell.border?.left,
        right:
          dayIndex === finishOffset
            ? { style: "medium", color: { argb: activityColor.borderHex } }
            : cell.border?.right,
      };
      if (dayIndex === startOffset) {
        cell.value = item.name;
        cell.font = { bold: true, size: 8, color: { argb: activityColor.textHex } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }

    if (item.actualFinishDate) {
      const actualFinishOffset = diffDays(dateOnly(item.actualFinishDate), start);
      if (actualFinishOffset > finishOffset) {
        for (
          let dayIndex = Math.max(0, finishOffset + 1);
          dayIndex <= actualFinishOffset;
          dayIndex += 1
        ) {
          const cell = sheet.getCell(rowNumber, firstDayCol + dayIndex);
          cell.fill = fill(colors.overrun);
          cell.border = {
            ...cell.border,
            top: { style: "medium", color: { argb: colors.destructiveText } },
            bottom: { style: "medium", color: { argb: colors.destructiveText } },
          };
        }
      }
    }
  });

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: Math.max(firstDayCol + days.length - 1, 1) },
  };

  return workbook.xlsx.writeBuffer();
}

export function downloadExcelBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
