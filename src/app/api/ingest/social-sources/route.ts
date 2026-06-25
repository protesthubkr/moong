import { NextRequest } from "next/server";
import {
  isCronRunAuthorized,
  isManualRunAuthorized,
  readJsonBody,
  unauthorized,
} from "@/lib/route-auth";
import { refreshXFollowingSources } from "@/lib/social/ingest";
import {
  parseBooleanOption,
  parseIntegerOption,
  runJsonJob,
} from "../options";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronRunAuthorized(request)) {
    return unauthorized();
  }

  return runRefresh({});
}

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  const body = await readJsonBody(request);

  return runRefresh({
    dryRun: parseBooleanOption(body.dryRun),
    maxAccounts: parseIntegerOption(body.maxAccounts),
  });
}

async function runRefresh(options: { dryRun?: boolean; maxAccounts?: number }) {
  return runJsonJob(
    () => refreshXFollowingSources(options),
    "Source refresh failed",
  );
}
