import { NextResponse, type NextRequest } from "next/server";
import { readStringEnv } from "@/lib/env";

export function isCronRunAuthorized(request: NextRequest) {
  return isBearerAuthorized(request, readStringEnv("CRON_SECRET"));
}

export function isManualRunAuthorized(request: NextRequest) {
  return isBearerAuthorized(request, readStringEnv("OPS_RUN_SECRET"));
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: NextRequest,
) {
  const payload = await request.json().catch(() => ({}));

  return isPlainObject(payload) ? (payload as T) : ({} as T);
}

function isBearerAuthorized(request: NextRequest, expectedToken: string) {
  if (!expectedToken) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  return token.length > 0 && token === expectedToken;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
