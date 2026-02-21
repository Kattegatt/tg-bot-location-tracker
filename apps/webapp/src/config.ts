const DEFAULT_POINT_TTL_MINUTES = 5 * 60;

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const ttlMinutes = parsePositiveInt(import.meta.env.VITE_POINT_TTL_MINUTES, DEFAULT_POINT_TTL_MINUTES);

const defaultGreenMinutes = Math.round((2 * ttlMinutes) / 3);
const defaultOrangeMinutes = Math.round(ttlMinutes / 3);

let greenMinutes = parsePositiveInt(import.meta.env.VITE_POINT_GREEN_MINUTES_LEFT, defaultGreenMinutes);
let orangeMinutes = parseNonNegativeInt(import.meta.env.VITE_POINT_ORANGE_MINUTES_LEFT, defaultOrangeMinutes);

greenMinutes = Math.min(greenMinutes, ttlMinutes);
if (orangeMinutes >= greenMinutes) {
  orangeMinutes = Math.max(0, greenMinutes - 1);
}

export const pointColorThresholds = {
  ttlMinutes,
  greenMinutes,
  orangeMinutes,
  greenThresholdMs: greenMinutes * 60_000,
  orangeThresholdMs: orangeMinutes * 60_000
} as const;
