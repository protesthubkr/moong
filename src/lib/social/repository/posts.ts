import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoongConfig } from "../config";
import { mapXMetrics } from "../scoring";
import type { SocialPostMetrics, SocialSource, XPost } from "../types";
import {
  getPostAttachments,
  getPostLinks,
  getReferencedContext,
  getReferenceId,
  getXPostText,
  getXPostType,
  getXPostUrl,
} from "../x-post";

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

  const { fetchPostsByIds } = await import("../x-api");
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
      attachments: getPostAttachments(post),
      links: getPostLinks(post),
      last_metric_checked_at: now,
      last_seen_at: now,
      metrics_frozen_at: shouldPromote ? now : null,
      promoted_at: shouldPromote ? now : null,
      raw_payload: post,
      text_snapshot: getXPostText(post),
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

  return ((data ?? []) as unknown as MetricRefreshCandidate[]).filter((row) =>
    Boolean(row.platform_post_id),
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
