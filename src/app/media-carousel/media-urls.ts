import type { SocialPostAttachment } from "@/lib/social/types";

export function getAttachmentImageUrl(attachment: SocialPostAttachment) {
  return attachment.url ?? attachment.previewImageUrl ?? "";
}

export function getPlayableAttachmentVideoUrl(
  attachment: SocialPostAttachment,
) {
  if (attachment.type !== "video" && attachment.type !== "animated_gif") {
    return null;
  }

  if (attachment.videoUrl && isHttpUrl(attachment.videoUrl)) {
    return attachment.videoUrl;
  }

  return (
    getAttachmentVariants(attachment)
      .filter((variant) =>
        isVideoVariant({
          contentType: variant.contentType,
          url: variant.url,
        }),
      )
      .sort((a, b) => (b.bitRate ?? 0) - (a.bitRate ?? 0))[0]?.url ?? null
  );
}

export function getVideoPlaybackUrl(value: string) {
  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "video.twimg.com"
    ) {
      return `/api/social-media-proxy?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function getImageSamplingUrl(value: string) {
  try {
    const url = new URL(value, window.location.href);

    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "pbs.twimg.com"
    ) {
      return `/api/social-media-proxy?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function formatMediaKind(type: SocialPostAttachment["type"]) {
  if (type === "animated_gif") {
    return "GIF";
  }

  if (type === "video") {
    return "영상";
  }

  return "미디어";
}

function getAttachmentVariants(attachment: SocialPostAttachment) {
  return Array.isArray(attachment.variants) ? attachment.variants : [];
}

function isVideoVariant({
  contentType,
  url,
}: {
  contentType?: string | null;
  url: string;
}) {
  return (
    isHttpUrl(url) &&
    (contentType?.toLowerCase().startsWith("video/") ||
      /\.mp4(?:[?#]|$)/i.test(url))
  );
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
