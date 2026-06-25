import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OpsRankingPost,
  OpsSocialSource,
  SocialPlatform,
  SocialPostMetrics,
} from "../types";
import { mapPublicPostRow, type SocialPostRow } from "./post-row";

export async function getOpsData({ supabase }: { supabase: SupabaseClient | null }) {
  if (!supabase) {
    return {
      counts: emptyCounts(),
      ranking: [] as OpsRankingPost[],
      runs: [] as ScanRunRow[],
      sources: [] as OpsSocialSource[],
    };
  }

  const [sources, promoted, tracking, archived, runs, ranking] =
    await Promise.all([
      getOpsSources(supabase),
      countPosts(supabase, "promoted"),
      countPosts(supabase, "tracking"),
      countPosts(supabase, "archived"),
      getRecentRuns(supabase),
      getOpsRanking(supabase),
    ]);

  return {
    counts: {
      archived,
      promoted,
      sources: sources.length,
      tracking,
    },
    ranking,
    runs,
    sources,
  };
}

async function getOpsSources(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("social_sources")
    .select(
      [
        "platform",
        "source_key",
        "username",
        "display_name",
        "enabled",
        "is_following",
        "is_protected",
        "follower_count",
        "last_scanned_at",
        "last_error",
      ].join(","),
    )
    .order("last_scanned_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as OpsSocialSource[];
}

async function countPosts(supabase: SupabaseClient, status: string) {
  const { count, error } = await supabase
    .from("social_posts")
    .select("*", { count: "exact", head: true })
    .eq("visibility_status", status);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

type ScanRunRow = {
  error_message: string | null;
  finished_at: string | null;
  id: string;
  metrics_refreshed: number;
  platform: SocialPlatform;
  posts_promoted: number;
  posts_seen: number;
  posts_written: number;
  run_type: string;
  source_count: number;
  started_at: string;
  status: string;
};

async function getRecentRuns(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("social_scan_runs")
    .select(
      [
        "id",
        "platform",
        "run_type",
        "status",
        "started_at",
        "finished_at",
        "source_count",
        "posts_seen",
        "posts_written",
        "posts_promoted",
        "metrics_refreshed",
        "error_message",
      ].join(","),
    )
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as ScanRunRow[];
}

async function getOpsRanking(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("social_post_metrics")
    .select(
      [
        "like_count",
        "repost_count",
        "reply_count",
        "quote_count",
        "impression_count",
        "score",
        "social_posts!inner(id,platform,platform_post_id,author_username,author_name,source_url,text_snapshot,posted_at,post_type,parent_context,attachments,links,promoted_at,visibility_status)",
      ].join(","),
    )
    .eq("social_posts.visibility_status", "promoted")
    .order("score", { ascending: false })
    .order("like_count", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OpsMetricRow[]).map((row) => ({
    ...mapPublicPostRow(row.social_posts),
    metrics: {
      impression_count: row.impression_count ?? undefined,
      like_count: row.like_count,
      quote_count: row.quote_count,
      reply_count: row.reply_count,
      repost_count: row.repost_count,
      score: Number(row.score),
    },
  }));
}

type OpsMetricRow = SocialPostMetrics & {
  social_posts: SocialPostRow;
};

function emptyCounts() {
  return {
    archived: 0,
    promoted: 0,
    sources: 0,
    tracking: 0,
  };
}
