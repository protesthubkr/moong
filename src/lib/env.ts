export function readStringEnv(key: string, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

export function readIntegerEnv(
  key: string,
  {
    defaultValue,
    max,
    min,
  }: {
    defaultValue: number;
    max?: number;
    min?: number;
  },
) {
  const raw = process.env[key]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  let value = Number.isFinite(parsed) ? parsed : defaultValue;

  if (min !== undefined) {
    value = Math.max(value, min);
  }

  if (max !== undefined) {
    value = Math.min(value, max);
  }

  return value;
}

export function readNumberEnv(
  key: string,
  {
    defaultValue,
    max,
    min,
  }: {
    defaultValue: number;
    max?: number;
    min?: number;
  },
) {
  const raw = process.env[key]?.trim();
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  let value = Number.isFinite(parsed) ? parsed : defaultValue;

  if (min !== undefined) {
    value = Math.max(value, min);
  }

  if (max !== undefined) {
    value = Math.min(value, max);
  }

  return value;
}
