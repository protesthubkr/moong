import type { CSSProperties } from "react";
import { MediaCarousel } from "@/app/media-carousel";
import type {
  SocialPostAttachment,
  SocialPostContext,
  SocialPostLink,
} from "@/lib/social/types";
import { ClampedText } from "../clamped-text";
import { getTweetPreviewText } from "./text";
import {
  getHost,
  getYouTubeEmbed,
  isMediaAttachmentLink,
  isSafeHttpUrl,
  isShortUrlLink,
  isSocialStatusLink,
  type YouTubeEmbed,
} from "./urls";

export type EmbeddedOriginal = {
  original: SocialPostContext | null;
  quotedPlatformPostId: string;
};

export function PostAttachments({
  attachments,
  links,
}: {
  attachments: SocialPostAttachment[];
  links: SocialPostLink[];
}) {
  const media = attachments.filter(hasRenderableAttachment);
  const youtubeEmbeds = links
    .map(getYouTubeEmbed)
    .filter((embed): embed is YouTubeEmbed => Boolean(embed));
  const safeLinks = links.filter((link) =>
    shouldRenderLinkCard({ link, mediaCount: media.length }),
  );

  if (media.length === 0 && youtubeEmbeds.length === 0 && safeLinks.length === 0) {
    return null;
  }

  return (
    <div className="moong-attachments">
      {media.length > 0 ? <MediaCarousel attachments={media} /> : null}

      {youtubeEmbeds.map((embed) => (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="moong-youtube-embed"
          key={embed.embedUrl}
          referrerPolicy="strict-origin-when-cross-origin"
          src={embed.embedUrl}
          title={embed.title}
        />
      ))}

      {safeLinks.map((link, index) => (
        <a
          className="moong-link-card"
          href={link.expandedUrl}
          key={`${link.expandedUrl}-${index}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="moong-link-host">{getHost(link.expandedUrl)}</span>
          {link.title ? <span className="moong-link-title">{link.title}</span> : null}
          {link.description ? (
            <span className="moong-link-desc">{link.description}</span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

export function OriginalPostCard({
  embedded = false,
  original,
  quotedPlatformPostId,
  style,
}: {
  embedded?: boolean;
  original: SocialPostContext | null;
  quotedPlatformPostId: string;
  style?: CSSProperties;
}) {
  const href =
    original?.sourceUrl ?? `https://x.com/i/web/status/${quotedPlatformPostId}`;
  const author = original?.authorName ?? original?.authorUsername ?? "original";
  const originalText = original?.text ? getTweetPreviewText(original.text) : "";

  return (
    <a
      className={`moong-original-card${embedded ? " moong-original-card--embedded" : ""}`}
      href={href}
      rel="noopener noreferrer"
      style={style}
      target="_blank"
    >
      <span className="moong-original-label">원문</span>
      <span className="moong-original-author">{author}</span>
      {originalText ? (
        <ClampedText className="moong-original-text" text={originalText} />
      ) : (
        <span className="moong-original-text moong-original-text--empty">
          원문 내용을 가져오지 못했습니다.
        </span>
      )}
    </a>
  );
}

export function hasRichPostContent({
  attachments,
  links,
}: {
  attachments: SocialPostAttachment[];
  links: SocialPostLink[];
}) {
  return (
    attachments.some((attachment) => hasRenderableAttachment(attachment)) ||
    links.some((link) => isSafeHttpUrl(link.expandedUrl))
  );
}

export function hasRenderableAttachment(attachment: SocialPostAttachment) {
  return Boolean(
    attachment.url ||
      attachment.previewImageUrl ||
      attachment.videoUrl ||
      (Array.isArray(attachment.variants) &&
        attachment.variants.some((variant) => isSafeHttpUrl(variant.url))),
  );
}

function shouldRenderLinkCard({
  link,
  mediaCount,
}: {
  link: SocialPostLink;
  mediaCount: number;
}) {
  return (
    isSafeHttpUrl(link.expandedUrl) &&
    !getYouTubeEmbed(link) &&
    !isShortUrlLink(link) &&
    !isSocialStatusLink(link) &&
    !(mediaCount > 0 && isMediaAttachmentLink(link))
  );
}
