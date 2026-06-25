import { NextResponse } from "next/server";

export async function runJsonJob<T>(
  job: () => Promise<T>,
  productionErrorMessage: string,
) {
  try {
    return NextResponse.json(await job());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? productionErrorMessage
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

export function parseBooleanOption(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function parseIntegerOption(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseStringOption(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseStringArrayOption(value: unknown) {
  if (Array.isArray(value)) {
    const strings = value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );

    return strings.length > 0 ? strings : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}
