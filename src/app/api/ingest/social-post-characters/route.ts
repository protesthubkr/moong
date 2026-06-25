import { NextRequest, NextResponse } from "next/server";
import {
  isCronRunAuthorized,
  isManualRunAuthorized,
  readJsonBody,
  unauthorized,
} from "@/lib/route-auth";
import { runSocialPostCharacterGate } from "@/lib/social/character-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronRunAuthorized(request)) {
    return unauthorized();
  }

  return runCharacterGate({});
}

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  const body = await readJsonBody(request);

  return runCharacterGate({
    concurrency: parseInteger(body.concurrency),
    dryRun: parseBoolean(body.dryRun),
    force: parseBoolean(body.force),
    limit: parseInteger(body.limit),
    sourceKey: parseString(body.sourceKey ?? body.source),
    statuses: parseStringArray(body.statuses ?? body.status),
  });
}

async function runCharacterGate(options: {
  concurrency?: number;
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  sourceKey?: string;
  statuses?: string[];
}) {
  try {
    return NextResponse.json(await runSocialPostCharacterGate(options));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Character gate failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

function parseBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function parseInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseStringArray(value: unknown) {
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
