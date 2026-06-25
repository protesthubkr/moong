import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ALLOWED_IMAGE_HOSTS = new Set(["pbs.twimg.com"]);
const ALLOWED_VIDEO_HOSTS = new Set(["video.twimg.com"]);
const IMAGE_CONTENT_TYPE_FALLBACK = "image/jpeg";
const VIDEO_CONTENT_TYPE_FALLBACK = "video/mp4";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  const targetMedia = parseAllowedMediaUrl(target);

  if (!targetMedia) {
    return NextResponse.json({ error: "invalid_media_url" }, { status: 400 });
  }

  const upstreamHeaders = new Headers({
    Accept:
      targetMedia.type === "video" ? "video/*,*/*;q=0.8" : "image/*,*/*;q=0.8",
    Referer: "https://x.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  });
  const range = request.headers.get("range");

  if (range) {
    upstreamHeaders.set("Range", range);
  }

  const upstream = await fetch(targetMedia.url, {
    cache: "no-store",
    headers: upstreamHeaders,
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: "media_fetch_failed" },
      { status: upstream.status },
    );
  }

  const responseHeaders = new Headers();

  copyHeader(upstream.headers, responseHeaders, "accept-ranges");
  copyHeader(upstream.headers, responseHeaders, "cache-control");
  copyHeader(upstream.headers, responseHeaders, "content-length");
  copyHeader(upstream.headers, responseHeaders, "content-range");
  copyHeader(upstream.headers, responseHeaders, "etag");
  copyHeader(upstream.headers, responseHeaders, "last-modified");
  responseHeaders.set(
    "content-type",
    upstream.headers.get("content-type") ??
      (targetMedia.type === "video"
        ? VIDEO_CONTENT_TYPE_FALLBACK
        : IMAGE_CONTENT_TYPE_FALLBACK),
  );

  if (!responseHeaders.has("cache-control")) {
    responseHeaders.set("cache-control", "public, max-age=3600");
  }

  return new Response(upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
  });
}

function parseAllowedMediaUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return null;
    }

    if (ALLOWED_VIDEO_HOSTS.has(host) && /\.mp4$/i.test(url.pathname)) {
      return {
        type: "video" as const,
        url,
      };
    }

    if (ALLOWED_IMAGE_HOSTS.has(host) && url.pathname.startsWith("/media/")) {
      return {
        type: "image" as const,
        url,
      };
    }

    if (
      ALLOWED_IMAGE_HOSTS.has(host) &&
      url.pathname.startsWith("/amplify_video_thumb/")
    ) {
      return {
        type: "image" as const,
        url,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function copyHeader(from: Headers, to: Headers, header: string) {
  const value = from.get(header);

  if (value) {
    to.set(header, value);
  }
}
