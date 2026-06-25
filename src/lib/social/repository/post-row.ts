import "server-only";

import { readJsonRecordEnv } from "@/lib/env";
import {
  shouldExposeByPublicFeedCharacterPolicy,
  type PublicFeedCharacterDecisionRow,
} from "../public-feed-policy";
import { getSocialSourcePartyInfo } from "../source-colors";
import type { PublicMoongPost, SocialPlatform } from "../types";

export type SocialPostRow = {
  attachments: unknown;
  author_name: string;
  author_username: string;
  conversation_id: string | null;
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
  ranking_score?: number | string | null;
  reply_to_platform_post_id: string | null;
  sincerity_score?: number | string | null;
  source_url: string;
  social_post_character_decisions?:
    | PublicFeedCharacterDecisionRow
    | PublicFeedCharacterDecisionRow[]
    | null;
  social_post_metrics?: JoinedSocialPostMetricRow | JoinedSocialPostMetricRow[] | null;
  social_sources?: JoinedSocialSourceRow | JoinedSocialSourceRow[] | null;
  text_snapshot: string;
};

export type JoinedSocialSourceRow = {
  display_name?: string | null;
  enabled?: boolean | null;
  is_following?: boolean | null;
  is_protected?: boolean | null;
  profile_image_url?: string | null;
  source_key?: string | null;
  username?: string | null;
};

export type JoinedSocialPostMetricRow = {
  like_count?: number | null;
  score?: number | string | null;
};

export type PublicFeedRankedPostRpcRow = {
  engagement_score?: number | string | null;
  like_count?: number | null;
  post_id?: string | null;
  ranking_score?: number | string | null;
  sincerity_score?: number | string | null;
};

export type PublicFeedRankedPostRow = PublicFeedRankedPostRpcRow & {
  post_id: string;
};

export function isPublicFeedRankedPostRow(
  row: PublicFeedRankedPostRpcRow,
): row is PublicFeedRankedPostRow {
  return typeof row.post_id === "string" && row.post_id.length > 0;
}

export function mapPublicPostRow(row: SocialPostRow): PublicMoongPost {
  const source = getJoinedSocialSource(row.social_sources);
  const authorName =
    getSourceDisplayNameOverride(source) ??
    source?.display_name ??
    row.author_name;
  const sourceKey = source?.source_key ?? row.author_username;
  const partyInfo = getSocialSourcePartyInfo({
    displayName: authorName,
    sourceKey,
    sourceUrl: row.source_url,
    username: source?.username ?? row.author_username,
  });
  const score = getPublicPostScore(row);
  const sincerityScore = getPublicPostSincerityScore(row);
  const rankingScore = getPublicPostRankingScore(row, sincerityScore);

  return {
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    authorName,
    authorProfileImageUrl: source?.profile_image_url ?? null,
    authorUsername: row.author_username,
    conversationId: row.conversation_id ?? null,
    id: row.id,
    links: Array.isArray(row.links) ? row.links : [],
    parentContext: isObject(row.parent_context) ? row.parent_context : null,
    partyAccentColor: partyInfo.accentColor,
    partyKey: partyInfo.key,
    partyLabel: partyInfo.label,
    partyLogoSrc: partyInfo.logoSrc,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    postType: row.post_type,
    postedAt: row.posted_at,
    promotedAt: row.promoted_at,
    quotedPlatformPostId: row.quoted_platform_post_id ?? null,
    quoteContext: isObject(row.quote_context) ? row.quote_context : null,
    replyToPlatformPostId: row.reply_to_platform_post_id ?? null,
    rankingScore,
    score,
    sincerityScore,
    sourceKey,
    sourceUrl: row.source_url,
    text: row.text_snapshot,
  };
}

export function mergeRankedPublicPostRow(
  row: SocialPostRow | undefined,
  rankedRow: PublicFeedRankedPostRow,
): SocialPostRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    ranking_score: rankedRow.ranking_score ?? null,
    sincerity_score: rankedRow.sincerity_score ?? null,
    social_post_metrics: {
      like_count: rankedRow.like_count ?? null,
      score: rankedRow.engagement_score ?? null,
    },
  };
}

export function getPublicPostGroupScore(posts: PublicMoongPost[]) {
  return Math.max(0, ...posts.map((post) => post.score));
}

export function getPublicPostGroupRankingScore(posts: PublicMoongPost[]) {
  return Math.max(0, ...posts.map((post) => post.rankingScore));
}

export function getPublicPostGroupSincerityScore(posts: PublicMoongPost[]) {
  return Math.max(0, ...posts.map((post) => post.sincerityScore));
}

export function readFiniteNumber(
  value: number | string | null | undefined,
  fallback: number,
) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function passesPublicFeedPolicy(row: SocialPostRow) {
  if (getJoinedSocialSource(row.social_sources)?.is_protected) {
    return false;
  }

  return shouldExposeByPublicFeedCharacterPolicy(
    getJoinedCharacterDecision(row.social_post_character_decisions),
  );
}

function getPublicPostScore(row: SocialPostRow) {
  const metric = getJoinedSocialPostMetric(row.social_post_metrics);
  const score = Number(metric?.score ?? 0);

  return Number.isFinite(score) ? score : 0;
}

function getPublicPostRankingScore(row: SocialPostRow, fallback: number) {
  return readFiniteNumber(row.ranking_score, fallback);
}

function getPublicPostSincerityScore(row: SocialPostRow) {
  return readFiniteNumber(row.sincerity_score, 0);
}

function getJoinedSocialSource(
  source: SocialPostRow["social_sources"],
): JoinedSocialSourceRow | null {
  if (Array.isArray(source)) {
    return source[0] ?? null;
  }

  return source ?? null;
}

function getJoinedSocialPostMetric(
  metric: SocialPostRow["social_post_metrics"],
): JoinedSocialPostMetricRow | null {
  if (Array.isArray(metric)) {
    return metric[0] ?? null;
  }

  return metric ?? null;
}

function getJoinedCharacterDecision(
  decision: SocialPostRow["social_post_character_decisions"],
): PublicFeedCharacterDecisionRow | null {
  if (Array.isArray(decision)) {
    return decision[0] ?? null;
  }

  return decision ?? null;
}

function getSourceDisplayNameOverride(source: JoinedSocialSourceRow | null) {
  if (!source) {
    return null;
  }

  const overrides = getSourceDisplayNameOverrides();
  const keys = [source.source_key, source.username]
    .map((key) => key?.replace(/^@/, "").toLowerCase())
    .filter((key): key is string => Boolean(key));

  for (const key of keys) {
    const value = overrides.get(key);

    if (value) {
      return value;
    }
  }

  return null;
}

let sourceDisplayNameOverrides: Map<string, string> | null = null;

function getSourceDisplayNameOverrides() {
  if (sourceDisplayNameOverrides) {
    return sourceDisplayNameOverrides;
  }

  sourceDisplayNameOverrides = new Map();
  const parsed = readJsonRecordEnv("MOONG_SOURCE_DISPLAY_NAMES");

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim()) {
      sourceDisplayNameOverrides.set(
        key.replace(/^@/, "").toLowerCase(),
        value.trim(),
      );
    }
  }

  return sourceDisplayNameOverrides;
}

function isObject(value: unknown): value is PublicMoongPost["parentContext"] {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
