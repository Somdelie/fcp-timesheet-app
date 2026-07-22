import type { TdsCoverageProfile, TdsRateUnit } from "@/types/tds-types";

const UNIT_LABELS: Record<TdsRateUnit, string> = {
  M2_PER_L: "m\u00b2/L",
  M2_PER_KG: "m\u00b2/kg",
  L_PER_M2: "L/m\u00b2",
  KG_PER_M2: "kg/m\u00b2",
  M2_PER_CONTAINER: "m\u00b2/container",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function getRateDisplay(profile: TdsCoverageProfile): {
  label: string;
  description: string;
  value: string;
} {
  const labels: Record<TdsRateUnit, { label: string; description: string }> = {
    M2_PER_L: {
      label: "Coverage rate",
      description: "Area covered by one litre.",
    },
    M2_PER_KG: {
      label: "Coverage rate",
      description: "Area covered by one kilogram.",
    },
    KG_PER_M2: {
      label: "Material consumption",
      description: "Kilograms needed to cover one square metre.",
    },
    L_PER_M2: {
      label: "System consumption",
      description: "Litres required to cover one square metre.",
    },
    M2_PER_CONTAINER: {
      label: "Container coverage",
      description: "Area covered by one full container.",
    },
  };

  if (
    profile.rateUnit === null ||
    profile.rateMin === null ||
    profile.rateMax === null
  ) {
    return {
      label: "Application rate",
      description: "The detected product application rate.",
      value: "Rate not detected",
    };
  }

  const display = labels[profile.rateUnit];
  const range =
    profile.rateMin === profile.rateMax
      ? formatNumber(profile.rateMin)
      : `${formatNumber(profile.rateMin)}\u2013${formatNumber(profile.rateMax)}`;

  return {
    ...display,
    value: `${range} ${UNIT_LABELS[profile.rateUnit]}`,
  };
}
