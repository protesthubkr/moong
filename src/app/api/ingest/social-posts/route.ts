import { NextRequest } from "next/server";
import {
  isCronRunAuthorized,
  isManualRunAuthorized,
  readJsonBody,
  unauthorized,
} from "@/lib/route-auth";
import { runSocialPostIngest } from "@/lib/social/ingest";
import {
  parseBooleanOption,
  parseIntegerOption,
  parseStringOption,
  runJsonJob,
} from "../options";

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
    dryRun: parseBooleanOption(body.dryRun),
    maxPages: parseIntegerOption(body.maxPages),
    sourceKey: parseStringOption(body.sourceKey ?? body.source),
    sourceLimit: parseIntegerOption(body.sourceLimit),
    startDate: parseStringOption(body.startDate),
  });
}

async function runIngest(options: {
  dryRun?: boolean;
  maxPages?: number;
  sourceKey?: string;
  sourceLimit?: number;
  startDate?: string;
}) {
  return runJsonJob(() => runSocialPostIngest(options), "Post ingest failed");
}
