const FRACTION_LABELS: Record<string, string> = {
  "0": '0"',
  "0.125": '1/8"',
  "0.25": '1/4"',
  "0.375": '3/8"',
  "0.5": '1/2"',
  "0.625": '5/8"',
  "0.75": '3/4"',
  "0.875": '7/8"',
};

export const FRACTION_OPTIONS = [
  { value: "0", label: '0"' },
  { value: "0.125", label: '1/8"' },
  { value: "0.25", label: '1/4"' },
  { value: "0.375", label: '3/8"' },
  { value: "0.5", label: '1/2"' },
  { value: "0.625", label: '5/8"' },
  { value: "0.75", label: '3/4"' },
  { value: "0.875", label: '7/8"' },
] as const;

export type FractionValue = (typeof FRACTION_OPTIONS)[number]["value"];

export function fractionLabel(value: string | number | null | undefined) {
  if (value == null) {
    return FRACTION_LABELS["0"];
  }

  const key = typeof value === "number" ? String(value) : value;
  return FRACTION_LABELS[key] ?? key;
}

export function fractionToNumber(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

export function formatMeasurement(
  whole: string | number | null | undefined,
  fraction: string | number | null | undefined,
) {
  const wholePart = Number(whole ?? 0);
  const fractionPart = fractionToNumber(fraction);

  if (fractionPart <= 0) {
    return `${wholePart}"`;
  }

  const label = fractionLabel(fractionPart).replace(/"$/, "");
  return `${wholePart} ${label}"`;
}

export function normalizeJobNumber(value: string) {
  return value.replace(/^PO(\d{2})(\d{2})-/, "PO$2-");
}
