export function readStringEnv(key: string, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

export function readRequiredStringEnv(key: string, message?: string) {
  const value = readStringEnv(key);

  if (!value) {
    throw new Error(message ?? `${key} is not configured.`);
  }

  return value;
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

export function readJsonRecordEnv(key: string) {
  return parseJsonRecord(process.env[key]);
}

function parseJsonRecord(value?: string) {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
