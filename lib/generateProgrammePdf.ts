import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { getProgrammeActivityColor } from "@/lib/programmeActivityColors";

export type ProgrammePdfItem = {
  name: string;
  trade?: string;
  startDate: string;
  finishDate: string;
  actualStartDate?: string;
  actualFinishDate?: string;
  colorIndex?: number;
};

export type ProgrammePdfInput = {
  siteLabel: string;
  siteCode?: string | null;
  client?: string | null;
  description?: string | null;
  plannedStartDate: string;
  plannedFinishDate: string;
  items: ProgrammePdfItem[];
};

const colors = {
  white: rgb(1, 1, 1),
  cardBg: rgb(0.996, 0.996, 0.996),
  headerBg: rgb(0.976, 0.976, 0.98),
  border: rgb(0.878, 0.878, 0.878),
  borderStrong: rgb(0.45, 0.5, 0.58),
  textPrimary: rgb(0.09, 0.09, 0.11),
  textSecondary: rgb(0.4, 0.4, 0.45),
  textMuted: rgb(0.6, 0.6, 0.65),
  primary: rgb(0.18, 0.25, 0.36),
  destructiveLight: rgb(0.99, 0.9, 0.9),
  destructiveText: rgb(0.72, 0.12, 0.12),
  overrun: rgb(0.97, 0.78, 0.78),
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

function formatDisplayDate(value: string | Date) {
  const date = dateOnly(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function truncateText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
) {
  let next = text;
  while (next.length > 0 && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
    next = next.slice(0, -1);
  }
  if (next !== text && next.length > 0) {
    next = next.slice(0, Math.max(0, next.length - 1)) + "...";
  }
  return next;
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

export async function generateProgrammePdf(
  input: ProgrammePdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const titleSize = 18;
  const topBlockHeight = 74;
  const tableHeaderHeight = 44;
  const rowHeight = 38;
  const footerHeight = 22;
  const activityWidth = 176;
  const minDayWidth = 13;
  const maxDaysPerPage = Math.max(
    1,
    Math.floor((pageWidth - margin * 2 - activityWidth) / minDayWidth),
  );
  const rowsPerPage = Math.max(
    1,
    Math.floor(
      (pageHeight - margin * 2 - topBlockHeight - tableHeaderHeight - footerHeight) /
        rowHeight,
    ),
  );

  const sortedItems = sortItems(input.items);
  const { start, finish } = getCalendarRange(input);
  const totalDays = diffDays(finish, start) + 1;
  const days = Array.from({ length: totalDays }).map((_, index) =>
    addDays(start, index),
  );
  const today = dateOnly(new Date());

  const dayChunks: Date[][] = [];
  for (let index = 0; index < days.length; index += maxDaysPerPage) {
    dayChunks.push(days.slice(index, index + maxDaysPerPage));
  }

  const itemChunks: ProgrammePdfItem[][] = [];
  for (let index = 0; index < sortedItems.length; index += rowsPerPage) {
    itemChunks.push(sortedItems.slice(index, index + rowsPerPage));
  }

  let pageNumber = 0;
  const totalPages = dayChunks.length * Math.max(itemChunks.length, 1);

  function drawHeader(page: PDFPage, dayChunk: Date[]) {
    const y = pageHeight - margin;
    page.drawText("Programme Calendar", {
      x: margin,
      y: y - titleSize,
      size: titleSize,
      font: fontBold,
      color: colors.textPrimary,
    });

    const subtitleParts = [
      input.siteLabel,
      input.client || "",
      `${formatDisplayDate(input.plannedStartDate)} to ${formatDisplayDate(
        input.plannedFinishDate,
      )}`,
      `${input.items.length} activities`,
    ].filter(Boolean);

    page.drawText(truncateText(subtitleParts.join(" | "), 520, font, 9), {
      x: margin,
      y: y - titleSize - 16,
      size: 9,
      font,
      color: colors.textSecondary,
    });

    page.drawText(
      `Showing ${formatDisplayDate(dayChunk[0])} to ${formatDisplayDate(
        dayChunk[dayChunk.length - 1],
      )}`,
      {
        x: margin,
        y: y - titleSize - 31,
        size: 8,
        font,
        color: colors.textMuted,
      },
    );

    page.drawText(`Generated ${formatDisplayDate(new Date())}`, {
      x: pageWidth - margin - 132,
      y: y - 12,
      size: 8,
      font,
      color: colors.textMuted,
    });
  }

  function drawTableHeader(page: PDFPage, topY: number, dayChunk: Date[]) {
    const dayWidth = (pageWidth - margin * 2 - activityWidth) / dayChunk.length;
    const tableWidth = activityWidth + dayChunk.length * dayWidth;

    page.drawRectangle({
      x: margin,
      y: topY - tableHeaderHeight,
      width: tableWidth,
      height: tableHeaderHeight,
      color: colors.headerBg,
      borderColor: colors.border,
      borderWidth: 1,
    });

    page.drawText("Activity", {
      x: margin + 10,
      y: topY - 17,
      size: 9,
      font: fontBold,
      color: colors.textPrimary,
    });

    page.drawText("Dates", {
      x: margin + 10,
      y: topY - 35,
      size: 8,
      font: fontBold,
      color: colors.textMuted,
    });

    let weekStartIndex = 0;
    while (weekStartIndex < dayChunk.length) {
      const weekEndIndex = Math.min(weekStartIndex + 7, dayChunk.length);
      const x = margin + activityWidth + weekStartIndex * dayWidth;
      const width = (weekEndIndex - weekStartIndex) * dayWidth;

      page.drawRectangle({
        x,
        y: topY - 22,
        width,
        height: 22,
        color: colors.primary,
      });
      page.drawText(`Week ${Math.floor(diffDays(dayChunk[weekStartIndex], start) / 7) + 1}`, {
        x: x + 5,
        y: topY - 14,
        size: 7,
        font: fontBold,
        color: colors.white,
      });

      weekStartIndex = weekEndIndex;
    }

    for (let index = 0; index < dayChunk.length; index += 1) {
      const day = dayChunk[index];
      const x = margin + activityWidth + index * dayWidth;
      const isPast = day.getTime() < today.getTime();
      const isWeekStart = diffDays(day, start) % 7 === 0;

      if (isPast) {
        page.drawRectangle({
          x,
          y: topY - tableHeaderHeight,
          width: dayWidth,
          height: 22,
          color: colors.destructiveLight,
        });
      }

      page.drawLine({
        start: { x, y: topY - tableHeaderHeight },
        end: { x, y: topY },
        thickness: isWeekStart ? 1.2 : 0.35,
        color: isWeekStart ? colors.borderStrong : colors.border,
      });

      page.drawText(String(day.getDate()).padStart(2, "0"), {
        x: x + 2,
        y: topY - 34,
        size: 6,
        font: fontBold,
        color: isPast ? colors.destructiveText : colors.textSecondary,
      });
    }
  }

  function drawFooter(page: PDFPage) {
    page.drawText(`Page ${pageNumber} of ${totalPages}`, {
      x: pageWidth - margin - 70,
      y: margin - 6,
      size: 8,
      font,
      color: colors.textMuted,
    });
  }

  for (const dayChunk of dayChunks) {
    for (const itemChunk of itemChunks.length ? itemChunks : [[]]) {
      pageNumber += 1;
      const page = pdf.addPage([pageWidth, pageHeight]);
      const tableTopY = pageHeight - margin - topBlockHeight;
      const dayWidth = (pageWidth - margin * 2 - activityWidth) / dayChunk.length;
      const tableWidth = activityWidth + dayChunk.length * dayWidth;

      drawHeader(page, dayChunk);
      drawTableHeader(page, tableTopY, dayChunk);

      for (let rowIndex = 0; rowIndex < itemChunk.length; rowIndex += 1) {
        const item = itemChunk[rowIndex];
        const activityColor = getProgrammeActivityColor(
          item.colorIndex ?? rowIndex,
        );
        const rowTopY = tableTopY - tableHeaderHeight - rowIndex * rowHeight;
        const rowBottomY = rowTopY - rowHeight;

        page.drawRectangle({
          x: margin,
          y: rowBottomY,
          width: tableWidth,
          height: rowHeight,
          color: rowIndex % 2 === 0 ? colors.white : colors.cardBg,
          borderColor: colors.border,
          borderWidth: 0.5,
        });

        page.drawText(
          truncateText(`${rowIndex + 1}. ${item.name}`, activityWidth - 18, fontBold, 8),
          {
            x: margin + 8,
            y: rowTopY - 14,
            size: 8,
            font: fontBold,
            color: colors.textPrimary,
          },
        );

        const dateLabel = `${formatIso(dateOnly(item.startDate))} to ${formatIso(
          dateOnly(item.finishDate),
        )}`;
        page.drawText(truncateText(dateLabel, activityWidth - 18, font, 7), {
          x: margin + 8,
          y: rowTopY - 27,
          size: 7,
          font,
          color: colors.textMuted,
        });

        for (let dayIndex = 0; dayIndex < dayChunk.length; dayIndex += 1) {
          const day = dayChunk[dayIndex];
          const x = margin + activityWidth + dayIndex * dayWidth;
          const isPast = day.getTime() < today.getTime();
          const isWeekStart = diffDays(day, start) % 7 === 0;

          if (isPast) {
            page.drawRectangle({
              x,
              y: rowBottomY,
              width: dayWidth,
              height: rowHeight,
              color: colors.destructiveLight,
              opacity: 0.35,
            });
          }

          page.drawLine({
            start: { x, y: rowBottomY },
            end: { x, y: rowTopY },
            thickness: isWeekStart ? 1.1 : 0.25,
            color: isWeekStart ? colors.borderStrong : colors.border,
          });
        }

        const chunkStartOffset = diffDays(dayChunk[0], start);
        const chunkEndOffset = chunkStartOffset + dayChunk.length - 1;
        const itemStartOffset = diffDays(dateOnly(item.startDate), start);
        const itemFinishOffset = diffDays(dateOnly(item.finishDate), start);
        const visibleStart = Math.max(itemStartOffset, chunkStartOffset);
        const visibleFinish = Math.min(itemFinishOffset, chunkEndOffset);

        if (visibleStart <= visibleFinish) {
          const x =
            margin +
            activityWidth +
            (visibleStart - chunkStartOffset) * dayWidth +
            1.5;
          const width = (visibleFinish - visibleStart + 1) * dayWidth - 3;

          page.drawRectangle({
            x,
            y: rowBottomY + 11,
            width: Math.max(2, width),
            height: 15,
            color: rgb(...activityColor.fillRgb),
            borderColor: rgb(
              parseInt(activityColor.borderHex.slice(2, 4), 16) / 255,
              parseInt(activityColor.borderHex.slice(4, 6), 16) / 255,
              parseInt(activityColor.borderHex.slice(6, 8), 16) / 255,
            ),
            borderWidth: 0.8,
          });

          if (width > 26) {
            page.drawText(truncateText(item.name, width - 8, fontBold, 6.5), {
              x: x + 4,
              y: rowBottomY + 16,
              size: 6.5,
              font: fontBold,
              color: colors.textPrimary,
            });
          }
        }

        if (item.actualFinishDate) {
          const actualFinishOffset = diffDays(dateOnly(item.actualFinishDate), start);
          if (actualFinishOffset > itemFinishOffset) {
            const overrunStart = Math.max(itemFinishOffset + 1, chunkStartOffset);
            const overrunFinish = Math.min(actualFinishOffset, chunkEndOffset);

            if (overrunStart <= overrunFinish) {
              page.drawRectangle({
                x:
                  margin +
                  activityWidth +
                  (overrunStart - chunkStartOffset) * dayWidth +
                  1.5,
                y: rowBottomY + 11,
                width: Math.max(2, (overrunFinish - overrunStart + 1) * dayWidth - 3),
                height: 15,
                color: colors.overrun,
                borderColor: colors.destructiveText,
                borderWidth: 0.7,
              });
            }
          }
        }
      }

      drawFooter(page);
    }
  }

  pdf.setTitle(`${input.siteLabel} Programme`);
  pdf.setCreator("Office App");
  pdf.setProducer("pdf-lib");

  return pdf.save();
}
