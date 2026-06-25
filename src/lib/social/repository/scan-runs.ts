import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPlatform } from "../types";

export type ScanRunCounters = {
  errorMessage?: string;
  metricsRefreshed?: number;
  postsPromoted?: number;
  postsSeen?: number;
  postsWritten?: number;
  sourceCount?: number;
};

export type SocialScanRunType =
  | "character_gate"
  | "post_ingest"
  | "source_refresh";

export async function createScanRun({
  dryRun,
  options,
  platform,
  runType,
  supabase,
}: {
  dryRun: boolean;
  options: Record<string, unknown>;
  platform: SocialPlatform;
  runType: SocialScanRunType;
  supabase: SupabaseClient;
}) {
  if (dryRun) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_scan_runs")
    .insert({
      dry_run: dryRun,
      options,
      platform,
      run_type: runType,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create scan run.");
  }

  return data.id as string;
}

export async function finishScanRun({
  counters,
  scanRunId,
  status,
  supabase,
}: {
  counters: ScanRunCounters;
  scanRunId: string | null;
  status: "failed" | "succeeded";
  supabase: SupabaseClient;
}) {
  if (!scanRunId) {
    return;
  }

  const { error } = await supabase
    .from("social_scan_runs")
    .update({
      error_message: counters.errorMessage ?? null,
      finished_at: new Date().toISOString(),
      metrics_refreshed: counters.metricsRefreshed ?? 0,
      posts_promoted: counters.postsPromoted ?? 0,
      posts_seen: counters.postsSeen ?? 0,
      posts_written: counters.postsWritten ?? 0,
      source_count: counters.sourceCount ?? 0,
      status,
    })
    .eq("id", scanRunId);

  if (error) {
    throw new Error(error.message);
  }
}
