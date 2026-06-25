import type { SocialPostLink } from "@/lib/social/types";

const SAFE_HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const SOCIAL_STATUS_PATH_PATTERN = /^\/[A-Za-z0-9_]+\/status\/\d+/;
const SOCIAL_MEDIA_PATH_PATTERN = /\/status\/\d+\/(?:photo|video)\//;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

export type YouTubeEmbed = {
  embedUrl: string;
  title: string;
};

export function getHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function isSafeHttpUrl(value: string) {
  try {
    return SAFE_HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function getYouTubeEmbed(link: SocialPostLink): YouTubeEmbed | null {
  const videoId = getYouTubeVideoId(link.expandedUrl);

  if (!videoId) {
    return null;
  }

  return {
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    title: link.title ?? "YouTube video",
  };
}

export function isMediaAttachmentLink(link: SocialPostLink) {
  if (link.displayUrl?.startsWith("pic.x.com/")) {
    return true;
  }

  return getLinkUrls(link).some((value) => {
    const parsed = parseUrl(value);

    if (!parsed) {
      return false;
    }

    return (
      parsed.host === "t.co" ||
      (isXHost(parsed.host) && SOCIAL_MEDIA_PATH_PATTERN.test(parsed.pathname))
    );
  });
}

export function isShortUrlLink(link: SocialPostLink) {
  return getLinkUrls(link).some((value) => parseUrl(value)?.host === "t.co");
}

export function isSocialStatusLink(link: SocialPostLink) {
  return getLinkUrls(link).some((value) => {
    const parsed = parseUrl(value);

    return Boolean(
      parsed &&
        isXHost(parsed.host) &&
        SOCIAL_STATUS_PATH_PATTERN.test(parsed.pathname),
    );
  });
}

function getYouTubeVideoId(value: string) {
  const parsed = parseUrl(value);

  if (!parsed) {
    return null;
  }

  if (parsed.host === "youtu.be") {
    return normalizeYouTubeVideoId(
      parsed.url.pathname.split("/").filter(Boolean)[0],
    );
  }

  if (parsed.host !== "youtube.com" && parsed.host !== "m.youtube.com") {
    return null;
  }

  if (parsed.url.pathname === "/watch") {
    return normalizeYouTubeVideoId(parsed.url.searchParams.get("v"));
  }

  const [, route, id] = parsed.url.pathname.split("/");
  return route === "shorts" || route === "embed"
    ? normalizeYouTubeVideoId(id)
    : null;
}

function normalizeYouTubeVideoId(value: string | null | undefined) {
  if (!value || !YOUTUBE_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
}

function getLinkUrls(link: SocialPostLink) {
  return [link.expandedUrl, link.shortUrl].filter(
    (value): value is string => Boolean(value),
  );
}

function parseUrl(value: string) {
  try {
    const url = new URL(value);

    return {
      host: url.hostname.replace(/^www\./, "").toLowerCase(),
      pathname: url.pathname,
      url,
    };
  } catch {
    return null;
  }
}

function isXHost(host: string) {
  return host === "x.com" || host === "twitter.com";
}
