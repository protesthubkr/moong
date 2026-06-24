import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoongConfig } from "./config";
import { mapXMetrics } from "./scoring";
import type {
  OpsRankingPost,
  OpsSocialSource,
  PublicMoongFeedItem,
  PublicMoongPost,
  SocialPostMetrics,
  SocialPlatform,
  SocialPostContext,
  SocialSource,
  XPost,
  XUser,
} from "./types";
import {
  getPostAttachments,
  getPostLinks,
  getReferencedContext,
  getReferenceId,
  getXPostText,
  getXPostType,
  getXPostUrl,
} from "./x-post";

type ScanRunCounters = {
  errorMessage?: string;
  metricsRefreshed?: number;
  postsPromoted?: number;
  postsSeen?: number;
  postsWritten?: number;
  sourceCount?: number;
};

type ExistingPostRow = {
  id: string;
  metrics_frozen_at: string | null;
  posted_at: string | null;
  promoted_at: string | null;
  visibility_status: string;
};

type MetricRefreshCandidate = {
  id: string;
  platform_post_id: string;
  posted_at: string | null;
};

const PUBLIC_POST_COLUMNS = [
  "id",
  "platform",
  "platform_post_id",
  "author_username",
  "author_name",
  "source_url",
  "text_snapshot",
  "posted_at",
  "post_type",
  "parent_context",
  "quote_context",
  "quoted_platform_post_id",
  "attachments",
  "links",
  "promoted_at",
].join(",");

const PUBLIC_POST_SELECT_WITH_SOURCE =
  `${PUBLIC_POST_COLUMNS},social_sources!inner(is_following,enabled,is_protected)`;

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
  runType: "post_ingest" | "source_refresh";
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

export async function upsertXSource({
  supabase,
  user,
}: {
  supabase: SupabaseClient;
  user: XUser;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("social_sources").upsert(
    {
      description: user.description ?? null,
      display_name: user.name,
      follower_count: user.public_metrics?.followers_count ?? null,
      following_count: user.public_metrics?.following_count ?? null,
      is_following: true,
      is_protected: Boolean(user.protected),
      last_seen_at: now,
      last_synced_at: now,
      listed_count: user.public_metrics?.listed_count ?? null,
      platform: "x",
      platform_user_id: user.id,
      post_count: user.public_metrics?.tweet_count ?? null,
      profile_image_url: user.profile_image_url ?? null,
      raw_payload: user,
      source_key: user.username.toLowerCase(),
      source_url: `https://x.com/${user.username}`,
      username: user.username,
    },
    {
      onConflict: "platform,platform_user_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function markUnfollowedXSources({
  currentPlatformUserIds,
  supabase,
}: {
  currentPlatformUserIds: string[];
  supabase: SupabaseClient;
}) {
  if (currentPlatformUserIds.length === 0) {
    return;
  }

  const escapedIds = currentPlatformUserIds
    .map((id) => `"${id.replaceAll('"', '""')}"`)
    .join(",");
  const { error } = await supabase
    .from("social_sources")
    .update({
      is_following: false,
      updated_at: new Date().toISOString(),
    })
    .eq("platform", "x")
    .eq("is_following", true)
    .not("platform_user_id", "in", `(${escapedIds})`);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getEnabledXSourcesForIngest({
  limit,
  sourceKey,
  supabase,
}: {
  limit: number;
  sourceKey?: string;
  supabase: SupabaseClient;
}) {
  let query = supabase
    .from("social_sources")
    .select(
      [
        "id",
        "platform",
        "source_key",
        "platform_user_id",
        "username",
        "display_name",
        "source_url",
        "profile_image_url",
        "enabled",
        "is_following",
        "is_protected",
        "last_scanned_post_id",
        "last_scanned_post_at",
      ].join(","),
    )
    .eq("platform", "x")
    .eq("enabled", true)
    .eq("is_following", true)
    .eq("is_protected", false)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (sourceKey) {
    query = query.eq("source_key", sourceKey.replace(/^@/, "").toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as SocialSource[]).filter(
    (source) => source.platform === "x",
  );
}

export async function markXSourceScanned({
  latestPost,
  source,
  supabase,
}: {
  latestPost: XPost | undefined;
  source: SocialSource;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("social_sources")
    .update({
      last_error: null,
      last_scanned_at: new Date().toISOString(),
      last_scanned_post_at: latestPost?.created_at ?? source.last_scanned_post_at,
      last_scanned_post_id: latestPost?.id ?? source.last_scanned_post_id,
    })
    .eq("id", source.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markXSourceFailed({
  errorMessage,
  source,
  supabase,
}: {
  errorMessage: string;
  source: SocialSource;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("social_sources")
    .update({
      last_error: errorMessage,
      last_scanned_at: new Date().toISOString(),
    })
    .eq("id", source.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertXPost({
  config,
  post,
  source,
  supabase,
}: {
  config: MoongConfig;
  post: XPost;
  source: SocialSource;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const existing = await getExistingPost({
    platformPostId: post.id,
    supabase,
  });
  const textSnapshot = getXPostText(post);
  const metrics = mapXMetrics(post.public_metrics, config.scoreWeights);
  const postType = getXPostType(post);
  const postedAt = post.created_at ?? null;
  const nextStatus = getNextVisibilityStatus({
    config,
    existing,
    metrics,
    now,
    postedAt,
    postType,
  });
  const basePayload = {
    attachments: getPostAttachments(post),
    author_name: source.display_name,
    author_platform_user_id: post.author_id ?? source.platform_user_id,
    author_username: source.username,
    conversation_id: post.conversation_id ?? null,
    links: getPostLinks(post),
    parent_context: getReferencedContext({
      fallbackSource: source,
      post,
      type: "replied_to",
    }),
    platform: "x",
    platform_post_id: post.id,
    post_type: postType,
    posted_at: postedAt,
    promoted_at: nextStatus.promotedAt,
    quote_context: getReferencedContext({
      fallbackSource: source,
      post,
      type: "quoted",
    }),
    quoted_platform_post_id: getReferenceId(post, "quoted") ?? null,
    raw_payload: post,
    reply_to_platform_post_id: getReferenceId(post, "replied_to") ?? null,
    reposted_platform_post_id: getReferenceId(post, "retweeted") ?? null,
    skip_reason: nextStatus.skipReason,
    source_id: source.id,
    source_key: source.source_key,
    source_url: getXPostUrl(source.username, post.id),
    text_snapshot: textSnapshot,
    visibility_status: nextStatus.visibilityStatus,
  };

  const postId = existing?.id
    ? await updateSocialPost({
        existingId: existing.id,
        payload: {
          ...basePayload,
          last_metric_checked_at: now,
          last_seen_at: now,
          metrics_frozen_at: nextStatus.metricsFrozenAt,
        },
        supabase,
      })
    : await insertSocialPost({
        payload: {
          ...basePayload,
          first_seen_at: now,
          last_metric_checked_at: now,
          last_seen_at: now,
          metrics_frozen_at: nextStatus.metricsFrozenAt,
        },
        supabase,
      });

  if (!existing?.metrics_frozen_at) {
    await upsertPostMetrics({
      metrics,
      postId,
      rawMetrics: post.public_metrics ?? {},
      supabase,
    });
  }

  return {
    archived: nextStatus.visibilityStatus === "archived",
    promoted: Boolean(nextStatus.promotedNow),
    skipped: nextStatus.visibilityStatus === "skipped",
    written: true,
  };
}

export async function refreshTrackedXPostMetrics({
  bearerToken,
  config,
  supabase,
}: {
  bearerToken: string;
  config: MoongConfig;
  supabase: SupabaseClient;
}) {
  const candidates = await getMetricRefreshCandidates({ config, supabase });

  if (candidates.length === 0) {
    return {
      metricsRefreshed: 0,
      postsPromoted: 0,
    };
  }

  const { fetchPostsByIds } = await import("./x-api");
  const response = await fetchPostsByIds({
    bearerToken,
    postIds: candidates.map((candidate) => candidate.platform_post_id),
  });
  const postById = new Map((response.data ?? []).map((post) => [post.id, post]));
  let metricsRefreshed = 0;
  let postsPromoted = 0;

  for (const candidate of candidates) {
    const post = postById.get(candidate.platform_post_id);

    if (!post) {
      continue;
    }

    const outcome = await updateExistingPostMetrics({
      config,
      post,
      postId: candidate.id,
      postedAt: candidate.posted_at,
      supabase,
    });

    metricsRefreshed += outcome.metricsRefreshed ? 1 : 0;
    postsPromoted += outcome.promoted ? 1 : 0;
  }

  return { metricsRefreshed, postsPromoted };
}

export async function getPublicMoongFeed({
  limit = 200,
  supabase,
}: {
  limit?: number;
  supabase: SupabaseClient | null;
}): Promise<PublicMoongFeedItem[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(PUBLIC_POST_SELECT_WITH_SOURCE)
    .eq("visibility_status", "promoted")
    .eq("social_sources.is_following", true)
    .eq("social_sources.enabled", true)
    .eq("social_sources.is_protected", false)
    .order("promoted_at", { ascending: true, nullsFirst: false })
    .order("posted_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const promotedRows = (data ?? []) as unknown as SocialPostRow[];
  const quotedPlatformPostIds = Array.from(
    new Set(
      promotedRows
        .filter((row) => row.post_type === "quote")
        .map((row) => row.quoted_platform_post_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const quoteRows = await getQuoteSiblingRows({
    quotedPlatformPostIds,
    supabase,
  });

  return buildPublicFeedItems({ promotedRows, quoteRows });
}

async function getQuoteSiblingRows({
  quotedPlatformPostIds,
  supabase,
}: {
  quotedPlatformPostIds: string[];
  supabase: SupabaseClient;
}) {
  if (quotedPlatformPostIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(PUBLIC_POST_SELECT_WITH_SOURCE)
    .eq("platform", "x")
    .eq("post_type", "quote")
    .neq("visibility_status", "skipped")
    .eq("social_sources.is_following", true)
    .eq("social_sources.enabled", true)
    .eq("social_sources.is_protected", false)
    .in("quoted_platform_post_id", quotedPlatformPostIds)
    .order("posted_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as SocialPostRow[];
}

function buildPublicFeedItems({
  promotedRows,
  quoteRows,
}: {
  promotedRows: SocialPostRow[];
  quoteRows: SocialPostRow[];
}): PublicMoongFeedItem[] {
  const quotePostsByOriginalId = new Map<string, PublicMoongPost[]>();

  for (const row of quoteRows) {
    if (!row.quoted_platform_post_id) {
      continue;
    }

    const posts = quotePostsByOriginalId.get(row.quoted_platform_post_id) ?? [];
    posts.push(mapPublicPostRow(row));
    quotePostsByOriginalId.set(row.quoted_platform_post_id, posts);
  }

  const seenQuotedOriginalIds = new Set<string>();
  const items: PublicMoongFeedItem[] = [];

  for (const row of promotedRows) {
    const post = mapPublicPostRow(row);

    if (post.postType !== "quote" || !post.quotedPlatformPostId) {
      items.push({
        id: post.id,
        kind: "post",
        post,
        promotedAt: post.promotedAt,
      });
      continue;
    }

    if (seenQuotedOriginalIds.has(post.quotedPlatformPostId)) {
      continue;
    }

    seenQuotedOriginalIds.add(post.quotedPlatformPostId);

    const postsById = new Map(
      (quotePostsByOriginalId.get(post.quotedPlatformPostId) ?? []).map(
        (quotePost) => [quotePost.id, quotePost],
      ),
    );
    postsById.set(post.id, post);

    const posts = Array.from(postsById.values()).sort(comparePublicPostTime);

    items.push({
      id: `quote:${post.quotedPlatformPostId}`,
      kind: "quote_group",
      original: getQuoteGroupOriginal({
        posts,
        quotedPlatformPostId: post.quotedPlatformPostId,
      }),
      posts,
      promotedAt: post.promotedAt,
      quotedPlatformPostId: post.quotedPlatformPostId,
    });
  }

  return items;
}

function getQuoteGroupOriginal({
  posts,
  quotedPlatformPostId,
}: {
  posts: PublicMoongPost[];
  quotedPlatformPostId: string;
}): SocialPostContext {
  const contextWithText = posts.find((post) => post.quoteContext?.text)?.quoteContext;
  const anyContext = posts.find((post) => post.quoteContext)?.quoteContext;

  return (
    contextWithText ??
    anyContext ?? {
      platformPostId: quotedPlatformPostId,
      sourceUrl: `https://x.com/i/web/status/${quotedPlatformPostId}`,
    }
  );
}

function comparePublicPostTime(a: PublicMoongPost, b: PublicMoongPost) {
  const aTime = a.postedAt ? Date.parse(a.postedAt) : Number.POSITIVE_INFINITY;
  const bTime = b.postedAt ? Date.parse(b.postedAt) : Number.POSITIVE_INFINITY;

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return a.id.localeCompare(b.id);
}

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

async function getExistingPost({
  platformPostId,
  supabase,
}: {
  platformPostId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("social_posts")
    .select("id,promoted_at,metrics_frozen_at,visibility_status,posted_at")
    .eq("platform", "x")
    .eq("platform_post_id", platformPostId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ExistingPostRow | null) ?? null;
}

async function insertSocialPost({
  payload,
  supabase,
}: {
  payload: Record<string, unknown>;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("social_posts")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to insert social post.");
  }

  return data.id as string;
}

async function updateSocialPost({
  existingId,
  payload,
  supabase,
}: {
  existingId: string;
  payload: Record<string, unknown>;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("social_posts")
    .update(payload)
    .eq("id", existingId)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to update social post.");
  }

  return data.id as string;
}

async function upsertPostMetrics({
  metrics,
  postId,
  rawMetrics,
  supabase,
}: {
  metrics: SocialPostMetrics;
  postId: string;
  rawMetrics: Record<string, unknown>;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("social_post_metrics").upsert(
    {
      captured_at: new Date().toISOString(),
      impression_count: metrics.impression_count ?? null,
      like_count: metrics.like_count,
      post_id: postId,
      quote_count: metrics.quote_count,
      raw_metrics: rawMetrics,
      reply_count: metrics.reply_count,
      repost_count: metrics.repost_count,
      score: metrics.score,
    },
    { onConflict: "post_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function updateExistingPostMetrics({
  config,
  post,
  postedAt,
  postId,
  supabase,
}: {
  config: MoongConfig;
  post: XPost;
  postedAt: string | null;
  postId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const metrics = mapXMetrics(post.public_metrics, config.scoreWeights);
  const shouldPromote = metrics.like_count >= config.likeThreshold;
  const shouldArchive = !shouldPromote && isOutsideRefreshWindow({
    config,
    now,
    postedAt,
  });
  const { error } = await supabase
    .from("social_posts")
    .update({
      last_metric_checked_at: now,
      metrics_frozen_at: shouldPromote ? now : null,
      promoted_at: shouldPromote ? now : null,
      visibility_status: shouldPromote
        ? "promoted"
        : shouldArchive
          ? "archived"
          : "tracking",
    })
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  await upsertPostMetrics({
    metrics,
    postId,
    rawMetrics: post.public_metrics ?? {},
    supabase,
  });

  return {
    metricsRefreshed: true,
    promoted: shouldPromote,
  };
}

async function getMetricRefreshCandidates({
  config,
  supabase,
}: {
  config: MoongConfig;
  supabase: SupabaseClient;
}) {
  const cutoffIso = new Date(
    Date.now() - config.metricRefreshWindowHours * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("social_posts")
    .select("id,platform_post_id,posted_at")
    .eq("platform", "x")
    .eq("visibility_status", "tracking")
    .is("metrics_frozen_at", null)
    .gte("posted_at", cutoffIso)
    .order("last_metric_checked_at", { ascending: true, nullsFirst: true })
    .limit(config.metricRefreshLimit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MetricRefreshCandidate[]).filter(
    (row) => Boolean(row.platform_post_id),
  );
}

function getNextVisibilityStatus({
  config,
  existing,
  metrics,
  now,
  postedAt,
  postType,
}: {
  config: MoongConfig;
  existing: ExistingPostRow | null;
  metrics: SocialPostMetrics;
  now: string;
  postedAt: string | null;
  postType: "original" | "quote" | "reply" | "repost";
}) {
  if (postType === "repost") {
    return {
      metricsFrozenAt: existing?.metrics_frozen_at ?? null,
      promotedAt: existing?.promoted_at ?? null,
      promotedNow: false,
      skipReason: "retweet_wrapper_excluded",
      visibilityStatus: "skipped",
    };
  }

  if (existing?.promoted_at) {
    return {
      metricsFrozenAt: existing.metrics_frozen_at ?? now,
      promotedAt: existing.promoted_at,
      promotedNow: false,
      skipReason: null,
      visibilityStatus: "promoted",
    };
  }

  if (metrics.like_count >= config.likeThreshold) {
    return {
      metricsFrozenAt: now,
      promotedAt: now,
      promotedNow: true,
      skipReason: null,
      visibilityStatus: "promoted",
    };
  }

  if (isOutsideRefreshWindow({ config, now, postedAt })) {
    return {
      metricsFrozenAt: null,
      promotedAt: null,
      promotedNow: false,
      skipReason: null,
      visibilityStatus: "archived",
    };
  }

  return {
    metricsFrozenAt: null,
    promotedAt: null,
    promotedNow: false,
    skipReason: null,
    visibilityStatus: "tracking",
  };
}

function isOutsideRefreshWindow({
  config,
  now,
  postedAt,
}: {
  config: MoongConfig;
  now: string;
  postedAt: string | null;
}) {
  if (!postedAt) {
    return false;
  }

  return (
    Date.parse(now) - Date.parse(postedAt) >
    config.metricRefreshWindowHours * 60 * 60 * 1000
  );
}

type SocialPostRow = {
  attachments: unknown;
  author_name: string;
  author_username: string;
  id: string;
  links: unknown;
  parent_context: unknown;
  platform: SocialPlatform;
  platform_post_id: string;
  post_type: string;
  posted_at: string | null;
  promoted_at: string | null;
  quote_context?: unknown;
  quoted_platform_post_id?: string | null;
  source_url: string;
  text_snapshot: string;
};

function mapPublicPostRow(row: SocialPostRow): PublicMoongPost {
  return {
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    authorName: row.author_name,
    authorUsername: row.author_username,
    id: row.id,
    links: Array.isArray(row.links) ? row.links : [],
    parentContext: isObject(row.parent_context)
      ? row.parent_context
      : null,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    postType: row.post_type,
    postedAt: row.posted_at,
    promotedAt: row.promoted_at,
    quotedPlatformPostId: row.quoted_platform_post_id ?? null,
    quoteContext: isObject(row.quote_context) ? row.quote_context : null,
    sourceUrl: row.source_url,
    text: row.text_snapshot,
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

function isObject(value: unknown): value is PublicMoongPost["parentContext"] {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
