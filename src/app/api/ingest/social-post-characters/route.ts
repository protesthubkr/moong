import { NextRequest } from "next/server";
import {
  isCronRunAuthorized,
  isManualRunAuthorized,
  readJsonBody,
  unauthorized,
} from "@/lib/route-auth";
import { runSocialPostCharacterGate } from "@/lib/social/character-runner";
import {
  parseBooleanOption,
  parseIntegerOption,
  parseStringArrayOption,
  parseStringOption,
  runJsonJob,
} from "../options";

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
    concurrency: parseIntegerOption(body.concurrency),
    dryRun: parseBooleanOption(body.dryRun),
    force: parseBooleanOption(body.force),
    limit: parseIntegerOption(body.limit),
    sourceKey: parseStringOption(body.sourceKey ?? body.source),
    statuses: parseStringArrayOption(body.statuses ?? body.status),
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
  return runJsonJob(
    () => runSocialPostCharacterGate(options),
    "Character gate failed",
  );
}
