import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialSource, XPost, XUser } from "../types";

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

export async function getDisabledXSourceIdentities({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("social_sources")
    .select("platform_user_id,source_key,username")
    .eq("platform", "x")
    .eq("enabled", false);

  if (error) {
    throw new Error(error.message);
  }

  return {
    platformUserIds: new Set(
      (data ?? [])
        .map((source) => source.platform_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
    sourceKeys: new Set(
      (data ?? [])
        .flatMap((source) => [source.source_key, source.username])
        .map((key) => key?.replace(/^@/, "").toLowerCase())
        .filter((key): key is string => Boolean(key)),
    ),
  };
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
