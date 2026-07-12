const INDIVIDUAL_FOREMAN_EMPLOYEE_IDS = new Set(["cmql0e76t000p09l2bhri3kdl"]);

const INDIVIDUAL_FOREMAN_USER_IDS = new Set(["cmql0e74k000n09l2qxz429ld"]);

const INDIVIDUAL_FOREMAN_NAMES = new Set([
  "sphiwe ngomani",
  "thandazani ndlovu",
]);

function normalizeName(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function shouldTreatForemanScanAsIndividual(input: {
  employeeId?: string | null;
  userId?: string | null;
  fullName?: string | null;
}) {
  if (
    input.employeeId &&
    INDIVIDUAL_FOREMAN_EMPLOYEE_IDS.has(input.employeeId)
  ) {
    return true;
  }

  if (input.userId && INDIVIDUAL_FOREMAN_USER_IDS.has(input.userId)) {
    return true;
  }

  return INDIVIDUAL_FOREMAN_NAMES.has(normalizeName(input.fullName));
}
