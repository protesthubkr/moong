import "server-only";

import { getRequiredSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getMoongConfig,
  getRequiredXBearerToken,
  type MoongConfig,
} from "./config";
import {
  createScanRun,
  finishScanRun,
  getEnabledXSourcesForIngest,
  markUnfollowedXSources,
  markXSourceFailed,
  markXSourceScanned,
  refreshTrackedXPostMetrics,
  upsertXPost,
  upsertXSource,
} from "./repository";
import type { SocialSource, XPost } from "./types";
import {
  fetchFollowingAccountsForUser,
  fetchUserPosts,
  fetchXUserByUsername,
} from "./x-api";

export type SourceRefreshOptions = {
  dryRun?: boolean;
  maxAccounts?: number;
};

export type SourceRefreshResult = {
  accountsSeen: number;
  dryRun: boolean;
  fullyFetched: boolean;
  protectedSkipped: number;
  sourcesWritten: number;
  targetUsername: string;
  truncatedByLimit: boolean;
};

export type PostIngestOptions = {
  dryRun?: boolean;
  maxPages?: number;
  sourceKey?: string;
  sourceLimit?: number;
  startDate?: string;
};

export type PostIngestResult = {
  archived: number;
  dryRun: boolean;
  metricsRefreshed: number;
  postsPromoted: number;
  postsSeen: number;
  postsSkipped: number;
  postsWritten: number;
  sourcesSeen: number;
};

export async function refreshXFollowingSources(
  options: SourceRefreshOptions = {},
): Promise<SourceRefreshResult> {
  const dryRun = options.dryRun ?? false;
  const config = getMoongConfig();
  const supabase = getRequiredSupabaseAdminClient();
  const bearerToken = getRequiredXBearerToken();
  const scanRunId = await createScanRun({
    dryRun,
    options: { ...options, targetUsername: config.xFollowingUsername },
    platform: "x",
    runType: "source_refresh",
    supabase,
  });

  try {
    const targetAccount = await fetchXUserByUsername({
      bearerToken,
      username: config.xFollowingUsername,
    });
    const maxAccounts = Math.max(
      options.maxAccounts ?? config.maxFollowingAccounts,
      targetAccount.public_metrics?.following_count ?? 0,
    );
    const following = await fetchFollowingAccountsForUser({
      bearerToken,
      maxAccounts,
      userId: targetAccount.id,
    });
    const writableAccounts = following.accounts;

    if (!dryRun) {
      for (const account of writableAccounts) {
        await upsertXSource({ supabase, user: account });
      }

      if (following.fullyFetched) {
        await markUnfollowedXSources({
          currentPlatformUserIds: writableAccounts.map((account) => account.id),
          supabase,
        });
      }
    }

    const result = {
      accountsSeen: writableAccounts.length,
      dryRun,
      fullyFetched: following.fullyFetched,
      protectedSkipped: writableAccounts.filter((account) => account.protected)
        .length,
      sourcesWritten: dryRun ? 0 : writableAccounts.length,
      targetUsername: config.xFollowingUsername,
      truncatedByLimit: following.truncatedByLimit,
    };

    await finishScanRun({
      counters: { sourceCount: result.sourcesWritten },
      scanRunId,
      status: "succeeded",
      supabase,
    });

    return result;
  } catch (error) {
    await finishScanRun({
      counters: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      scanRunId,
      status: "failed",
      supabase,
    });

    throw error;
  }
}

export async function runSocialPostIngest(
  options: PostIngestOptions = {},
): Promise<PostIngestResult> {
  const dryRun = options.dryRun ?? false;
  const config = getMoongConfig();
  const supabase = getRequiredSupabaseAdminClient();
  const bearerToken = getRequiredXBearerToken();
  const result: PostIngestResult = {
    archived: 0,
    dryRun,
    metricsRefreshed: 0,
    postsPromoted: 0,
    postsSeen: 0,
    postsSkipped: 0,
    postsWritten: 0,
    sourcesSeen: 0,
  };
  const scanRunId = await createScanRun({
    dryRun,
    options,
    platform: "x",
    runType: "post_ingest",
    supabase,
  });

  try {
    const sources = await getEnabledXSourcesForIngest({
      limit: options.sourceLimit ?? config.sourceLimit,
      sourceKey: options.sourceKey,
      supabase,
    });
    result.sourcesSeen = sources.length;

    for (const source of sources) {
      try {
        const cursor = createTimelineCursor({ config, options, source });
        const response = await fetchUserPosts({
          bearerToken,
          maxPages: cursor.maxPages,
          pageSize: config.timelinePageSize,
          sinceId: cursor.sinceId,
          startTime: cursor.startTime,
          userId: source.platform_user_id,
        });
        const posts = (response.data ?? []).filter((post) =>
          isPostOnOrAfterStart(post, cursor.startTime),
        );
        result.postsSeen += posts.length;

        if (!dryRun) {
          for (const post of posts) {
            const outcome = await upsertXPost({
              config,
              post,
              source,
              supabase,
            });

            result.archived += outcome.archived ? 1 : 0;
            result.postsPromoted += outcome.promoted ? 1 : 0;
            result.postsSkipped += outcome.skipped ? 1 : 0;
            result.postsWritten += outcome.written ? 1 : 0;
          }

          await markXSourceScanned({
            latestPost: chooseLatestPost(posts),
            source,
            supabase,
          });
        }
      } catch (error) {
        if (!dryRun) {
          await markXSourceFailed({
            errorMessage: error instanceof Error ? error.message : String(error),
            source,
            supabase,
          });
        }
      }
    }

    if (!dryRun) {
      const metrics = await refreshTrackedXPostMetrics({
        bearerToken,
        config,
        supabase,
      });
      result.metricsRefreshed = metrics.metricsRefreshed;
      result.postsPromoted += metrics.postsPromoted;
    }

    await finishScanRun({
      counters: {
        metricsRefreshed: result.metricsRefreshed,
        postsPromoted: result.postsPromoted,
        postsSeen: result.postsSeen,
        postsWritten: result.postsWritten,
        sourceCount: result.sourcesSeen,
      },
      scanRunId,
      status: "succeeded",
      supabase,
    });

    return result;
  } catch (error) {
    await finishScanRun({
      counters: {
        errorMessage: error instanceof Error ? error.message : String(error),
        metricsRefreshed: result.metricsRefreshed,
        postsPromoted: result.postsPromoted,
        postsSeen: result.postsSeen,
        postsWritten: result.postsWritten,
        sourceCount: result.sourcesSeen,
      },
      scanRunId,
      status: "failed",
      supabase,
    });

    throw error;
  }
}

function createTimelineCursor({
  config,
  options,
  source,
}: {
  config: MoongConfig;
  options: PostIngestOptions;
  source: SocialSource;
}) {
  const requestedStartIso = parseStartDateOption(options.startDate);

  if (requestedStartIso) {
    return {
      maxPages: options.maxPages ?? config.timelineBootstrapMaxPages,
      startTime: requestedStartIso,
    };
  }

  if (source.last_scanned_post_id) {
    return {
      maxPages: options.maxPages,
      sinceId: source.last_scanned_post_id,
    };
  }

  return {
    maxPages: options.maxPages ?? config.timelineBootstrapMaxPages,
    startTime: config.startIso,
  };
}

function parseStartDateOption(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+09:00`).toISOString();
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isPostOnOrAfterStart(post: XPost, startTime: string | undefined) {
  if (!startTime || !post.created_at) {
    return true;
  }

  return Date.parse(post.created_at) >= Date.parse(startTime);
}

function chooseLatestPost(posts: XPost[]) {
  return posts.reduce<XPost | undefined>((latest, post) => {
    if (!post.created_at) {
      return latest;
    }

    if (!latest?.created_at) {
      return post;
    }

    if (Date.parse(post.created_at) > Date.parse(latest.created_at)) {
      return post;
    }

    if (
      Date.parse(post.created_at) === Date.parse(latest.created_at) &&
      comparePostIds(post.id, latest.id) > 0
    ) {
      return post;
    }

    return latest;
  }, undefined);
}

function comparePostIds(left: string, right: string) {
  try {
    const leftId = BigInt(left);
    const rightId = BigInt(right);

    if (leftId > rightId) {
      return 1;
    }

    if (leftId < rightId) {
      return -1;
    }

    return 0;
  } catch {
    return left.localeCompare(right);
  }
}
