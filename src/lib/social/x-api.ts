import "server-only";

import type {
  XFollowingResponse,
  XIncludes,
  XPost,
  XTimelineResponse,
  XUser,
  XUserResponse,
} from "./types";

const X_API_BASE_URL = "https://api.x.com/2";

const USER_FIELDS = [
  "created_at",
  "description",
  "location",
  "name",
  "profile_image_url",
  "protected",
  "public_metrics",
  "verified",
  "verified_type",
  "username",
].join(",");

const TWEET_FIELDS = [
  "attachments",
  "author_id",
  "conversation_id",
  "created_at",
  "edit_history_tweet_ids",
  "entities",
  "note_tweet",
  "public_metrics",
  "referenced_tweets",
  "text",
].join(",");

const TWEET_EXPANSIONS = [
  "attachments.media_keys",
  "author_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
  "referenced_tweets.id.attachments.media_keys",
].join(",");

const MEDIA_FIELDS = [
  "alt_text",
  "height",
  "media_key",
  "preview_image_url",
  "type",
  "url",
  "variants",
  "width",
].join(",");

export async function fetchXUserByUsername({
  bearerToken,
  username,
}: {
  bearerToken: string;
  username: string;
}) {
  const url = new URL(
    `${X_API_BASE_URL}/users/by/username/${normalizeUsername(username)}`,
  );
  url.searchParams.set("user.fields", USER_FIELDS);

  const response = await fetchX<XUserResponse>(url, bearerToken);

  if (!response.data?.id) {
    throw new Error(`x_user_not_found:${username}`);
  }

  return response.data;
}

export async function fetchFollowingAccountsForUser({
  bearerToken,
  maxAccounts,
  userId,
}: {
  bearerToken: string;
  maxAccounts: number;
  userId: string;
}) {
  const accounts: XUser[] = [];
  let paginationToken: string | undefined;
  let fullyFetched = false;

  while (accounts.length < maxAccounts) {
    const url = new URL(`${X_API_BASE_URL}/users/${userId}/following`);
    url.searchParams.set(
      "max_results",
      String(Math.min(maxAccounts - accounts.length, 1000)),
    );
    url.searchParams.set("user.fields", USER_FIELDS);

    if (paginationToken) {
      url.searchParams.set("pagination_token", paginationToken);
    }

    const page = await fetchX<XFollowingResponse>(url, bearerToken);
    accounts.push(...(page.data ?? []));

    if (!page.meta?.next_token) {
      fullyFetched = true;
      break;
    }

    paginationToken = page.meta.next_token;
  }

  return {
    accounts: accounts.slice(0, maxAccounts),
    fullyFetched,
    truncatedByLimit: !fullyFetched,
  };
}

export async function fetchUserPosts({
  bearerToken,
  maxPages,
  pageSize,
  sinceId,
  startTime,
  userId,
}: {
  bearerToken: string;
  maxPages?: number;
  pageSize: number;
  sinceId?: string;
  startTime?: string;
  userId: string;
}) {
  const merged: XTimelineResponse = {
    data: [],
    includes: { media: [], tweets: [], users: [] },
  };
  let paginationToken: string | undefined;
  let pagesFetched = 0;

  do {
    const url = new URL(`${X_API_BASE_URL}/users/${userId}/tweets`);
    url.searchParams.set("max_results", String(pageSize));
    url.searchParams.set("exclude", "retweets");
    url.searchParams.set("tweet.fields", TWEET_FIELDS);
    url.searchParams.set("expansions", TWEET_EXPANSIONS);
    url.searchParams.set("media.fields", MEDIA_FIELDS);
    url.searchParams.set("user.fields", USER_FIELDS);

    if (sinceId) {
      url.searchParams.set("since_id", sinceId);
    } else if (startTime) {
      url.searchParams.set("start_time", startTime);
    }

    if (paginationToken) {
      url.searchParams.set("pagination_token", paginationToken);
    }

    const page = await fetchX<XTimelineResponse>(url, bearerToken);
    merged.data?.push(...attachIncludes(page.data ?? [], page.includes));
    merged.includes?.media?.push(...(page.includes?.media ?? []));
    merged.includes?.tweets?.push(...(page.includes?.tweets ?? []));
    merged.includes?.users?.push(...(page.includes?.users ?? []));
    merged.errors = [...(merged.errors ?? []), ...(page.errors ?? [])];
    merged.meta = page.meta;
    paginationToken = page.meta?.next_token;
    pagesFetched += 1;
  } while (paginationToken && shouldFetchNextPage(pagesFetched, maxPages));

  return merged;
}

export async function fetchPostsByIds({
  bearerToken,
  postIds,
}: {
  bearerToken: string;
  postIds: string[];
}) {
  const merged: XTimelineResponse = {
    data: [],
    includes: { media: [], tweets: [], users: [] },
  };

  for (const chunk of chunkArray([...new Set(postIds)], 100)) {
    if (chunk.length === 0) {
      continue;
    }

    const url = new URL(`${X_API_BASE_URL}/tweets`);
    url.searchParams.set("ids", chunk.join(","));
    url.searchParams.set("tweet.fields", TWEET_FIELDS);
    url.searchParams.set("expansions", TWEET_EXPANSIONS);
    url.searchParams.set("media.fields", MEDIA_FIELDS);
    url.searchParams.set("user.fields", USER_FIELDS);

    const page = await fetchX<XTimelineResponse>(url, bearerToken);
    merged.data?.push(...attachIncludes(page.data ?? [], page.includes));
    merged.includes?.media?.push(...(page.includes?.media ?? []));
    merged.includes?.tweets?.push(...(page.includes?.tweets ?? []));
    merged.includes?.users?.push(...(page.includes?.users ?? []));
    merged.errors = [...(merged.errors ?? []), ...(page.errors ?? [])];
  }

  return merged;
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, "");
}

async function fetchX<T>(url: URL, bearerToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new Error(`x_api_request_failed:${response.status}`);
  }

  if (!payload) {
    throw new Error("x_api_empty_response");
  }

  return payload;
}

function attachIncludes(posts: XPost[], includes: XIncludes | undefined) {
  return posts.map((post) => ({
    ...post,
    hydration_includes: includes,
  }));
}

function shouldFetchNextPage(pagesFetched: number, maxPages?: number) {
  return maxPages === undefined || pagesFetched < maxPages;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
