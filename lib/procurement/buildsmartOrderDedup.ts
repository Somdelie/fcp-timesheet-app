import { prisma } from "@/lib/prisma";

/** Normalise a BuildSmart PO / order reference for lookup. */
export function normalizeOrderReference(reference: string): string {
  return reference.trim();
}

/** Load all existing SiteProductOrder references (PDF Orders + Historical Materials). */
export async function loadExistingOrderReferences(): Promise<Set<string>> {
  const orders = await prisma.siteProductOrder.findMany({
    where: { reference: { not: null } },
    select: { reference: true },
  });
  return new Set(
    orders
      .map((o) => o.reference)
      .filter((r): r is string => Boolean(r))
      .map(normalizeOrderReference),
  );
}

export function isOrderReferenceTaken(
  existingRefs: Set<string>,
  reference: string,
): boolean {
  return existingRefs.has(normalizeOrderReference(reference));
}

export function trackOrderReference(
  existingRefs: Set<string>,
  reference: string,
): void {
  existingRefs.add(normalizeOrderReference(reference));
}
