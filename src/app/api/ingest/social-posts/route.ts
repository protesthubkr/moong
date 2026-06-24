import { NextRequest, NextResponse } from "next/server";
import {
  isCronRunAuthorized,
  isManualRunAuthorized,
  readJsonBody,
  unauthorized,
} from "@/lib/route-auth";
import { runSocialPostIngest } from "@/lib/social/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 600;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronRunAuthorized(request)) {
    return unauthorized();
  }

  return runIngest({});
}

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  const body = await readJsonBody(request);

  return runIngest({
    dryRun: parseBoolean(body.dryRun),
    maxPages: parseInteger(body.maxPages),
    sourceKey: parseString(body.sourceKey ?? body.source),
    sourceLimit: parseInteger(body.sourceLimit),
    startDate: parseString(body.startDate),
  });
}

async function runIngest(options: {
  dryRun?: boolean;
  maxPages?: number;
  sourceKey?: string;
  sourceLimit?: number;
  startDate?: string;
}) {
  try {
    return NextResponse.json(await runSocialPostIngest(options));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Post ingest failed"
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
