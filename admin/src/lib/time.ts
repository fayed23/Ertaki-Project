const TIME_STEP = 5;
const DAY_MIN = 24 * 60 - TIME_STEP;

export function clampMin(m: number) {
  const snapped = Math.round(m / TIME_STEP) * TIME_STEP;
  return Math.max(0, Math.min(DAY_MIN, snapped));
}

export function parseHhMm(raw: string | null | undefined, fallback = 0) {
  if (!raw) return clampMin(fallback);
  const [h, m] = raw.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return clampMin(fallback);
  return clampMin(h * 60 + m);
}

export function formatHhMm(minutes: number) {
  const m = clampMin(minutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
