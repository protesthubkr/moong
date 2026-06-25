import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION } from "../character-gate";
import { getPublicFeedSourceKeys } from "../public-feed-policy";
import type {
  PublicMoongFeedItem,
  PublicMoongPost,
  SocialPostContext,
} from "../types";
import {
  getPublicPostGroupRankingScore,
  getPublicPostGroupScore,
  getPublicPostGroupSincerityScore,
  isPublicFeedRankedPostRow,
  mapPublicPostRow,
  mergeRankedPublicPostRow,
  passesPublicFeedPolicy,
  readFiniteNumber,
  type PublicFeedRankedPostRpcRow,
  type SocialPostRow,
} from "./post-row";
import { getDisabledXSourceIdentities } from "./sources";

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
  "conversation_id",
  "reply_to_platform_post_id",
  "parent_context",
  "quote_context",
  "quoted_platform_post_id",
  "attachments",
  "links",
  "promoted_at",
].join(",");

const PUBLIC_POST_SOURCE_SELECT =
  "social_sources!inner(is_following,enabled,is_protected,display_name,profile_image_url,source_key,username)";

const PUBLIC_POST_CHARACTER_SELECT =
  "social_post_character_decisions!inner(classifier_version,primary_character,secondary_characters)";

const PUBLIC_POST_METRIC_SELECT = "social_post_metrics(score,like_count)";

const PUBLIC_POST_SELECT_WITH_SOURCE =
  `${PUBLIC_POST_COLUMNS},${PUBLIC_POST_METRIC_SELECT},${PUBLIC_POST_SOURCE_SELECT},${PUBLIC_POST_CHARACTER_SELECT}`;

const PUBLIC_POST_SELECT_WITH_SOURCE_ONLY =
  `${PUBLIC_POST_COLUMNS},${PUBLIC_POST_METRIC_SELECT},${PUBLIC_POST_SOURCE_SELECT}`;

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

  const publicSourceKeys = getPublicFeedSourceKeys();

  if (publicSourceKeys.length === 0) {
    return [];
  }

  const feedWindowLimit = Math.min(Math.max(limit * 8, limit), 1000);
  const rankedPostRows = await getPublicFeedRankedPostRows({
    limit: feedWindowLimit,
    sourceKeys: publicSourceKeys,
    supabase,
  });
  const rankedPostIds = rankedPostRows.map((row) => row.post_id);

  if (rankedPostIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(PUBLIC_POST_SELECT_WITH_SOURCE)
    .in("id", rankedPostIds)
    .eq("visibility_status", "promoted")
    .in("source_key", publicSourceKeys)
    .eq("social_sources.is_protected", false)
    .eq(
      "social_post_character_decisions.classifier_version",
      SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    );

  if (error) {
    throw new Error(error.message);
  }

  const rowsById = new Map(
    ((data ?? []) as unknown as SocialPostRow[]).map((row) => [row.id, row]),
  );
  const promotedRows = rankedPostRows
    .map((rankedRow) =>
      mergeRankedPublicPostRow(rowsById.get(rankedRow.post_id), rankedRow),
    )
    .filter((row): row is SocialPostRow => Boolean(row))
    .filter(passesPublicFeedPolicy);
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
    sourceKeys: publicSourceKeys,
    supabase,
  });
  const threadRows = await getThreadSiblingRows({
    conversationIds: Array.from(
      new Set(
        promotedRows
          .map((row) => row.conversation_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
    sourceKeys: publicSourceKeys,
    supabase,
  });
  const disabledSources = await getDisabledXSourceIdentities({ supabase });
  const disabledSourceKeys = new Set(disabledSources.sourceKeys);

  for (const sourceKey of publicSourceKeys) {
    disabledSourceKeys.delete(sourceKey);
  }

  return buildPublicFeedItems({
    disabledSourceKeys,
    promotedRows,
    quoteRows,
    threadRows,
  })
    .sort(comparePublicFeedItemScore)
    .slice(-limit);
}

async function getPublicFeedRankedPostRows({
  limit,
  sourceKeys,
  supabase,
}: {
  limit: number;
  sourceKeys: string[];
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase.rpc("get_public_moong_ranked_post_ids", {
    p_classifier_version: SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    p_limit: limit,
    p_source_keys: sourceKeys,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PublicFeedRankedPostRpcRow[]).filter(
    isPublicFeedRankedPostRow,
  );
}

async function getQuoteSiblingRows({
  quotedPlatformPostIds,
  sourceKeys,
  supabase,
}: {
  quotedPlatformPostIds: string[];
  sourceKeys: string[];
  supabase: SupabaseClient;
}) {
  if (quotedPlatformPostIds.length === 0 || sourceKeys.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(PUBLIC_POST_SELECT_WITH_SOURCE)
    .eq("platform", "x")
    .eq("post_type", "quote")
    .neq("visibility_status", "skipped")
    .in("source_key", sourceKeys)
    .eq("social_sources.is_protected", false)
    .eq(
      "social_post_character_decisions.classifier_version",
      SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    )
    .in("quoted_platform_post_id", quotedPlatformPostIds)
    .order("posted_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as SocialPostRow[]).filter(
    passesPublicFeedPolicy,
  );
}

async function getThreadSiblingRows({
  conversationIds,
  sourceKeys,
  supabase,
}: {
  conversationIds: string[];
  sourceKeys: string[];
  supabase: SupabaseClient;
}) {
  if (conversationIds.length === 0 || sourceKeys.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(PUBLIC_POST_SELECT_WITH_SOURCE_ONLY)
    .eq("platform", "x")
    .neq("visibility_status", "skipped")
    .in("source_key", sourceKeys)
    .eq("social_sources.is_protected", false)
    .in("conversation_id", conversationIds)
    .order("posted_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as SocialPostRow[];
}

function buildPublicFeedItems({
  disabledSourceKeys,
  promotedRows,
  quoteRows,
  threadRows,
}: {
  disabledSourceKeys: Set<string>;
  promotedRows: SocialPostRow[];
  quoteRows: SocialPostRow[];
  threadRows: SocialPostRow[];
}): PublicMoongFeedItem[] {
  const quotePostsByOriginalId = new Map<string, PublicMoongPost[]>();
  const threadPostsByKey = getThreadPostsByKey([...threadRows, ...promotedRows]);

  for (const row of quoteRows) {
    if (!row.quoted_platform_post_id) {
      continue;
    }

    const posts = quotePostsByOriginalId.get(row.quoted_platform_post_id) ?? [];
    posts.push(mapPublicPostRow(row));
    quotePostsByOriginalId.set(row.quoted_platform_post_id, posts);
  }

  const seenQuotedOriginalIds = new Set<string>();
  const seenThreadKeys = new Set<string>();
  const seenThreadPostIds = new Set<string>();
  const items: PublicMoongFeedItem[] = [];

  for (const row of promotedRows) {
    const post = mapPublicPostRow(row);
    const threadKey = getThreadKey(row);
    const threadPosts = threadKey ? threadPostsByKey.get(threadKey) : null;

    if (
      threadKey &&
      threadPosts &&
      threadPosts.length > 1 &&
      threadPosts.some((threadPost) => threadPost.id === post.id)
    ) {
      if (!seenThreadKeys.has(threadKey)) {
        seenThreadKeys.add(threadKey);
        threadPosts.forEach((threadPost) => seenThreadPostIds.add(threadPost.id));
        items.push({
          id: `thread:${threadKey}`,
          kind: "thread",
          posts: threadPosts,
          promotedAt: getLatestPromotedAt(threadPosts),
          rankingScore: getPublicPostGroupRankingScore(threadPosts),
          score: getPublicPostGroupScore(threadPosts),
          sincerityScore: getPublicPostGroupSincerityScore(threadPosts),
        });
      }

      continue;
    }

    if (seenThreadPostIds.has(post.id)) {
      continue;
    }

    if (post.postType !== "quote" || !post.quotedPlatformPostId) {
      items.push({
        id: post.id,
        kind: "post",
        post,
        promotedAt: post.promotedAt,
        rankingScore: post.rankingScore,
        score: post.score,
        sincerityScore: post.sincerityScore,
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
    const original = getQuoteGroupOriginal({
      posts,
      quotedPlatformPostId: post.quotedPlatformPostId,
    });

    if (isDisabledSourceContext(original, disabledSourceKeys)) {
      continue;
    }

    items.push({
      id: `quote:${post.quotedPlatformPostId}`,
      kind: "quote_group",
      original,
      posts,
      promotedAt: post.promotedAt,
      quotedPlatformPostId: post.quotedPlatformPostId,
      rankingScore: getPublicPostGroupRankingScore(posts),
      score: getPublicPostGroupScore(posts),
      sincerityScore: getPublicPostGroupSincerityScore(posts),
    });
  }

  return items;
}

function getThreadPostsByKey(rows: SocialPostRow[]) {
  const rowsByKey = new Map<string, Map<string, SocialPostRow>>();

  for (const row of rows) {
    const key = getThreadKey(row);

    if (!key) {
      continue;
    }

    const posts = rowsByKey.get(key) ?? new Map<string, SocialPostRow>();
    const existing = posts.get(row.platform_post_id);

    if (
      !existing ||
      readFiniteNumber(row.ranking_score, 0) >
        readFiniteNumber(existing.ranking_score, 0)
    ) {
      posts.set(row.platform_post_id, row);
    }

    rowsByKey.set(key, posts);
  }

  const postsByKey = new Map<string, PublicMoongPost[]>();

  for (const [key, groupedRows] of rowsByKey.entries()) {
    const posts = getSelfThreadRows(Array.from(groupedRows.values())).map(
      mapPublicPostRow,
    );

    if (posts.length > 1) {
      postsByKey.set(key, posts);
    }
  }

  return postsByKey;
}

function getSelfThreadRows(rows: SocialPostRow[]) {
  const sortedRows = [...rows].sort(compareSocialPostRowTime);
  const rowsByPlatformPostId = new Map(
    sortedRows.map((row) => [row.platform_post_id, row]),
  );
  const conversationId = sortedRows[0]?.conversation_id;
  const root = conversationId ? rowsByPlatformPostId.get(conversationId) : null;

  if (!root) {
    return [];
  }

  const includedIds = new Set([root.platform_post_id]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const row of sortedRows) {
      if (includedIds.has(row.platform_post_id)) {
        continue;
      }

      if (
        row.reply_to_platform_post_id &&
        includedIds.has(row.reply_to_platform_post_id)
      ) {
        includedIds.add(row.platform_post_id);
        changed = true;
      }
    }
  }

  return sortedRows.filter((row) => includedIds.has(row.platform_post_id));
}

function getThreadKey(
  row: Pick<SocialPostRow, "author_username" | "conversation_id">,
) {
  if (!row.conversation_id) {
    return null;
  }

  return `${row.conversation_id}:${row.author_username.replace(/^@/, "").toLowerCase()}`;
}

function compareSocialPostRowTime(a: SocialPostRow, b: SocialPostRow) {
  const aTime = a.posted_at ? Date.parse(a.posted_at) : Number.POSITIVE_INFINITY;
  const bTime = b.posted_at ? Date.parse(b.posted_at) : Number.POSITIVE_INFINITY;

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  const platformPostIdComparison = comparePlatformPostIds(
    a.platform_post_id,
    b.platform_post_id,
  );

  if (platformPostIdComparison !== 0) {
    return platformPostIdComparison;
  }

  return a.id.localeCompare(b.id);
}

function getLatestPromotedAt(posts: PublicMoongPost[]) {
  const promotedTimes = posts
    .map((post) => post.promotedAt)
    .filter((time): time is string => Boolean(time))
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  return promotedTimes[0] ?? null;
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

  const platformPostIdComparison = comparePlatformPostIds(
    a.platformPostId,
    b.platformPostId,
  );

  if (platformPostIdComparison !== 0) {
    return platformPostIdComparison;
  }

  return a.id.localeCompare(b.id);
}

function comparePlatformPostIds(a: string, b: string) {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const aValue = BigInt(a);
    const bValue = BigInt(b);

    if (aValue < bValue) {
      return -1;
    }

    if (aValue > bValue) {
      return 1;
    }

    return 0;
  }

  return a.localeCompare(b);
}

function comparePublicFeedItemTime(a: PublicMoongFeedItem, b: PublicMoongFeedItem) {
  const aTime = getPublicFeedItemTime(a);
  const bTime = getPublicFeedItemTime(b);

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return a.id.localeCompare(b.id);
}

function comparePublicFeedItemScore(a: PublicMoongFeedItem, b: PublicMoongFeedItem) {
  const rankingScoreDifference = a.rankingScore - b.rankingScore;

  if (rankingScoreDifference !== 0) {
    return rankingScoreDifference;
  }

  const scoreDifference = a.score - b.score;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return comparePublicFeedItemTime(a, b);
}

function getPublicFeedItemTime(item: PublicMoongFeedItem) {
  if (item.kind === "post") {
    return parseFeedTime(item.post.postedAt ?? item.promotedAt);
  }

  if (item.kind === "thread") {
    const postTimes = item.posts.map((post) => parseFeedTime(post.postedAt));
    const latestPostTime = Math.max(...postTimes);

    return Number.isFinite(latestPostTime)
      ? latestPostTime
      : parseFeedTime(item.promotedAt);
  }

  const postTimes = item.posts.map((post) => parseFeedTime(post.postedAt));
  const latestPostTime = Math.max(...postTimes);

  return Number.isFinite(latestPostTime)
    ? latestPostTime
    : parseFeedTime(item.promotedAt);
}

function parseFeedTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function isDisabledSourceContext(
  context: SocialPostContext | null,
  disabledSourceKeys: Set<string>,
) {
  if (!context) {
    return false;
  }

  const keys = [context.authorUsername, getXUsernameFromUrl(context.sourceUrl)]
    .map((key) => key?.replace(/^@/, "").toLowerCase())
    .filter((key): key is string => Boolean(key) && key !== "i");

  return keys.some((key) => disabledSourceKeys.has(key));
}

function getXUsernameFromUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host !== "x.com" && host !== "twitter.com") {
      return null;
    }

    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}
