import { prisma } from "@/lib/prisma";
import { parseWorkDate } from "@/lib/workdate";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

function normalizeE164(phone?: string | null) {
  // DB might store "082..." or "+27...".
  // For South Africa: convert leading 0 to +27
  if (!phone) return null;
  const raw = phone.trim();
  if (!raw) return null;

  // already +...
  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  // If starts with 0 and length 10 => assume ZA
  if (digits.startsWith("0") && digits.length === 10) {
    return `+27${digits.slice(1)}`;
  }

  // If starts with 27 and length 11 => assume ZA without +
  if (digits.startsWith("27") && digits.length === 11) {
    return `+${digits}`;
  }

  // fallback: if it looks like international already
  if (digits.length >= 10) return `+${digits}`;

  return null;
}

export async function notifyForemenSiteDayPhotoRequested(input: {
  siteId: string;
  dateISO: string; // YYYY-MM-DD
  note?: string | null;
}) {
  const workDate = parseWorkDate(input.dateISO);
  if (!workDate) throw new Error("Invalid dateISO. Use format YYYY-MM-DD.");

  const assignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId: input.siteId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: {
      foreman: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      site: { select: { name: true, code: true } },
    },
    orderBy: [{ startsOn: "desc" }],
  });

  if (assignments.length === 0) return { ok: true, sent: 0, skipped: 0 };

  const site = assignments[0]?.site;
  const siteLabel = site?.code ? `${site.code} - ${site.name}` : site?.name;

  const baseUrl = (process.env.APP_BASE_URL || "").trim();
  const deepLink = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/foreman?siteId=${encodeURIComponent(input.siteId)}&dateISO=${encodeURIComponent(input.dateISO)}`
    : "";

  let sent = 0;
  let skipped = 0;

  for (const a of assignments) {
    const phone = a.foreman?.user?.phone ?? null;
    const toE164 = normalizeE164(phone);

    if (!toE164) {
      skipped++;
      continue;
    }

    const name = a.foreman?.user?.name ?? a.foreman?.user?.email ?? "Foreman";
    const note = (input.note ?? "").trim();

    const msg =
      `Hi ${name},\n\n` +
      `A site-day photo is required.\n` +
      `Site: ${siteLabel ?? "(unknown)"}\n` +
      `Date: ${input.dateISO}\n` +
      (note ? `Note: ${note}\n` : "") +
      (deepLink ? `\nOpen: ${deepLink}\n` : "") +
      `\nPlease upload the photo in the Office App.`;

    try {
      await sendWhatsAppTextMessage({ toE164, body: msg });
      sent++;
    } catch (e) {
      // Don’t crash the main request if WhatsApp fails
      console.error("WhatsApp send failed:", { toE164, error: String(e) });
      skipped++;
    }
  }

  return { ok: true, sent, skipped };
}
