import { prisma } from "../lib/prisma";

// Manual/WhatsApp attendance notes for the previous fortnight (2026-07-04 .. 2026-07-17),
// transcribed from the user's message. One-off reconciliation, read-only.

type RosterRow = {
  siteLabel: string;
  date: string; // ISO yyyy-mm-dd
  foremanName: string; // which foreman's SiteDay this should be scanned under
  workers: string[]; // full names, or first-name-only (resolved within the foreman's crew)
};

const roster: RosterRow[] = [
  { siteLabel: "Babcock", date: "2026-07-06", foremanName: "Ndodana Sibanda", workers: ["Brendon Ndlovu", "Busani Ndlovu"] },
  { siteLabel: "Babcock", date: "2026-07-07", foremanName: "Ndodana Sibanda", workers: ["Brendon Ndlovu"] },
  { siteLabel: "Babcock", date: "2026-07-08", foremanName: "Ndodana Sibanda", workers: ["Brendon Ndlovu"] },
  { siteLabel: "Babcock", date: "2026-07-09", foremanName: "Ndodana Sibanda", workers: ["Michael Sibanda", "Brendon Ndlovu"] },
  { siteLabel: "Babcock", date: "2026-07-10", foremanName: "Ndodana Sibanda", workers: ["Michael Sibanda", "Coster Ncube", "Brendon Ndlovu"] },
  { siteLabel: "Babcock", date: "2026-07-11", foremanName: "Ndodana Sibanda", workers: ["Michael Sibanda", "Coster Ncube"] },
  { siteLabel: "Babcock", date: "2026-07-12", foremanName: "Ndodana Sibanda", workers: ["Calvin"] },

  { siteLabel: "Long lake", date: "2026-07-17", foremanName: "Ndodana Sibanda", workers: ["Coster Ncube"] },

  { siteLabel: "Chamberlain eastrand", date: "2026-07-04", foremanName: "Claitos Dube", workers: ["Claitos Dube", "Bernard Ncube", "Bazibi Moyo", "Mxolisi Nyoni"] },
  { siteLabel: "Witfontein x102", date: "2026-07-06", foremanName: "Claitos Dube", workers: ["Claitos Dube", "Bernard Ncube", "Bazibi Moyo"] },
  { siteLabel: "Witfontein x102", date: "2026-07-07", foremanName: "Claitos Dube", workers: ["Claitos Dube", "Bernard Ncube", "Bazibi Moyo"] },
  { siteLabel: "Bredel spec", date: "2026-07-07", foremanName: "Claitos Dube", workers: ["Thamani Zulu"] },
  { siteLabel: "Bayer witfontein", date: "2026-07-15", foremanName: "Claitos Dube", workers: ["Hloniphani Moyo"] },
];

// Confirmed by direct DB lookup (fuzzy name search alone was ambiguous or missed newer sites).
const SITE_CODE_BY_LABEL: Record<string, string> = {
  Babcock: "6782", // BABCOCK BARTLETT
  "Long lake": "6821", // LONGLAKES ERF 137 — has SiteDay under Ndodana Sibanda on 2026-07-17
  "Chamberlain eastrand": "6658", // CHAMBERLAIN EASTRAND
  "Witfontein x102": "6801", // ERF 1940,WITFONTEIN X102
  "Bredel spec": "6605", // BREDELL SPEC WAREHOUSE
  "Bayer witfontein": "6848", // BAYER WITFONTEIN
};

function normalizeName(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

type ResolvedForeman = { id: string; name: string; userId: string };

async function resolveForemen(names: string[]): Promise<Map<string, ResolvedForeman | null>> {
  const foremen = await prisma.foreman.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  const result = new Map<string, ResolvedForeman | null>();
  for (const raw of names) {
    const target = normalizeName(raw);
    const matches = foremen.filter((f) => normalizeName(f.user.name ?? "") === target);
    if (matches.length === 1) {
      const m = matches[0]!;
      result.set(raw, { id: m.id, name: m.user.name ?? "", userId: m.userId });
    } else if (matches.length === 0) {
      const close = foremen.filter((f) => normalizeName(f.user.name ?? "").includes(target.split(" ")[0] ?? target));
      console.log(`UNRESOLVED FOREMAN "${raw}" — 0 exact matches. Close candidates: ${close.map((c) => c.user.name).join(", ") || "none"}`);
      result.set(raw, null);
    } else {
      console.log(`UNRESOLVED FOREMAN "${raw}" — ${matches.length} exact matches: ${matches.map((m) => m.user.name).join(", ")}`);
      result.set(raw, null);
    }
  }
  return result;
}

type ResolvedSite = { id: string; name: string; code: string | null };

async function resolveSites(
  labels: string[],
): Promise<Map<string, ResolvedSite | null>> {
  const result = new Map<string, ResolvedSite | null>();

  for (const label of labels) {
    const code = SITE_CODE_BY_LABEL[label];
    const site = code ? await prisma.site.findFirst({ where: { code }, select: { id: true, name: true, code: true } }) : null;
    if (!site) {
      console.log(`UNRESOLVED SITE "${label}" — no site code mapping or site not found.`);
      result.set(label, null);
    } else {
      result.set(label, site);
      console.log(`Resolved site "${label}" -> ${site.name} [${site.code}]`);
    }
  }
  return result;
}

type ResolvedEmployee = { id: string; firstName: string; lastName: string; inCrew: boolean };

async function resolveWorker(
  rawName: string,
  foreman: ResolvedForeman,
): Promise<ResolvedEmployee | { unresolved: true; candidates: string[] }> {
  const crewLinks = await prisma.foremanEmployee.findMany({
    where: { foremanId: foreman.id },
    include: { employee: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
  });
  const crew = crewLinks.map((l) => l.employee).filter((e) => e.isActive);

  const target = normalizeName(rawName);
  const isFirstNameOnly = !target.includes(" ");

  if (isFirstNameOnly) {
    const matches = crew.filter((e) => normalizeName(e.firstName) === target);
    if (matches.length === 1) {
      const m = matches[0]!;
      return { id: m.id, firstName: m.firstName, lastName: m.lastName, inCrew: true };
    }
    return { unresolved: true, candidates: matches.map((m) => `${m.firstName} ${m.lastName}`) };
  }

  const crewMatch = crew.find((e) => normalizeName(`${e.firstName} ${e.lastName}`) === target);
  if (crewMatch) {
    return { id: crewMatch.id, firstName: crewMatch.firstName, lastName: crewMatch.lastName, inCrew: true };
  }

  // Fallback: search all active employees by full name (not restricted to this foreman's crew).
  const globalMatches = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  const fallback = globalMatches.filter((e) => normalizeName(`${e.firstName} ${e.lastName}`) === target);
  if (fallback.length === 1) {
    const m = fallback[0]!;
    return { id: m.id, firstName: m.firstName, lastName: m.lastName, inCrew: false };
  }

  return { unresolved: true, candidates: fallback.map((m) => `${m.firstName} ${m.lastName}`) };
}

async function main() {
  const foremanNames = Array.from(new Set(roster.map((r) => r.foremanName)));
  const siteLabels = Array.from(new Set(roster.map((r) => r.siteLabel)));

  const foremenMap = await resolveForemen(foremanNames);
  const sitesMap = await resolveSites(siteLabels);

  console.log("\n=== RECONCILIATION ===\n");

  const missing: string[] = [];
  const unresolved: string[] = [];
  const wrongSiteOrForeman: string[] = [];
  let matchedCount = 0;

  for (const row of roster) {
    const site = sitesMap.get(row.siteLabel) ?? null;
    const primaryForeman = foremenMap.get(row.foremanName) ?? null;

    console.log(`--- ${row.siteLabel} | ${row.date} | foreman: ${row.foremanName} ---`);

    if (!site) {
      for (const w of row.workers) {
        const line = `UNRESOLVED_SITE | ${row.siteLabel} | ${row.date} | ${w}`;
        console.log(line);
        unresolved.push(line);
      }
      continue;
    }

    for (const workerName of row.workers) {
      if (!primaryForeman) {
        const line = `UNRESOLVED_FOREMAN | ${row.siteLabel} | ${row.date} | ${row.foremanName} | ${workerName}`;
        console.log(line);
        unresolved.push(line);
        continue;
      }

      const resolved = await resolveWorker(workerName, primaryForeman);
      if ("unresolved" in resolved) {
        const line = `UNRESOLVED_NAME | ${row.siteLabel} | ${row.date} | "${workerName}" | candidates: ${resolved.candidates.join(", ") || "none"}`;
        console.log(line);
        unresolved.push(line);
        continue;
      }

      const scan = await prisma.attendanceScan.findUnique({
        where: { employeeId_workDate: { employeeId: resolved.id, workDate: dateUTC(row.date) } },
        include: { siteDay: { select: { foremanId: true } }, site: { select: { name: true } } },
      });

      const crewNote = resolved.inCrew ? "" : " [not in foreman's ForemanEmployee crew]";
      const fullName = `${resolved.firstName} ${resolved.lastName}`;

      if (!scan) {
        const line = `MISSING | ${row.siteLabel} | ${row.date} | ${fullName}${crewNote}`;
        console.log(line);
        missing.push(line);
        continue;
      }

      const scanForemanMatchesPrimary = scan.siteDay.foremanId === primaryForeman.id;

      if (scanForemanMatchesPrimary) {
        matchedCount += 1;
        console.log(`MATCHED | ${row.siteLabel} | ${row.date} | ${fullName}${crewNote}`);
      } else {
        const line = `WRONG_SITE_OR_FOREMAN | ${row.siteLabel} | ${row.date} | ${fullName} | scan was under site="${scan.site.name}" foremanId=${scan.siteDay.foremanId}`;
        console.log(line);
        wrongSiteOrForeman.push(line);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Matched: ${matchedCount}`);
  console.log(`Missing (no scan at all): ${missing.length}`);
  console.log(`Wrong site/foreman: ${wrongSiteOrForeman.length}`);
  console.log(`Unresolved (couldn't map to DB records): ${unresolved.length}`);

  if (missing.length) {
    console.log("\n--- MISSING ---");
    missing.forEach((l) => console.log(l));
  }
  if (wrongSiteOrForeman.length) {
    console.log("\n--- WRONG SITE/FOREMAN ---");
    wrongSiteOrForeman.forEach((l) => console.log(l));
  }
  if (unresolved.length) {
    console.log("\n--- UNRESOLVED ---");
    unresolved.forEach((l) => console.log(l));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
