import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPublicMoongFeed } from "@/lib/social/repository";
import { ClampedText } from "./clamped-text";
import { MediaCarousel } from "./media-carousel";
import { MessageStepScroll } from "./message-step-scroll";
import { ScrollToBottom } from "./scroll-to-bottom";
import type {
  PublicMoongFeedItem,
  PublicMoongPost,
  SocialPostAttachment,
  SocialPostContext,
  SocialPostLink,
} from "@/lib/social/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await loadFeed();

  return (
    <main className="moong-page">
      <ScrollToBottom enabled={items.length > 0} />
      <MessageStepScroll enabled={items.length > 0} />
      <header className="moong-topbar">
        <Link aria-label="뭉" className="moong-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny local logo, stable dimensions */}
          <img alt="" className="moong-brand-mark" src="/moong-logo.png" />
        </Link>
      </header>

      <section aria-label="뭉 피드" className="moong-feed-shell">
        {items.length > 0 ? (
          <ol className="moong-feed">
            {items.map((item) => (
              <li className="moong-feed-item" key={item.id}>
                <MoongFeedItem item={item} />
              </li>
            ))}
          </ol>
        ) : (
          <div className="moong-empty">
            <p>아직 올라온 글이 없습니다.</p>
          </div>
        )}
      </section>
    </main>
  );
}

async function loadFeed() {
  try {
    return await getPublicMoongFeed({
      limit: 160,
      supabase: getSupabaseAdminClient(),
    });
  } catch (error) {
    console.warn("[moong-feed] failed to load", error);

    return [];
  }
}

function MoongFeedItem({ item }: { item: PublicMoongFeedItem }) {
  if (item.kind === "post") {
    return <MoongPostThread post={item.post} />;
  }

  const originalCarrierIds = getQuoteOriginalCarrierIds(item.posts);

  return (
    <div className="moong-quote-group">
      <div className="moong-quote-posts">
        {item.posts.map((post) => (
          <MoongFeedRow
            embeddedOriginal={
              originalCarrierIds.has(post.id)
                ? {
                    original: item.original,
                    quotedPlatformPostId: item.quotedPlatformPostId,
                  }
                : undefined
            }
            item={post}
            key={post.id}
          />
        ))}
      </div>
    </div>
  );
}

function getQuoteOriginalCarrierIds(posts: PublicMoongPost[]) {
  const promotedPosts = posts.filter((post) => post.promotedAt);
  const carriers =
    promotedPosts.length > 0
      ? promotedPosts
      : posts.slice(Math.max(posts.length - 1, 0));

  return new Set(carriers.map((post) => post.id));
}

function MoongPostThread({ post }: { post: PublicMoongPost }) {
  if (post.postType === "quote" && post.quotedPlatformPostId) {
    return (
      <div className="moong-quote-group">
        <MoongFeedRow
          embeddedOriginal={{
            original: post.quoteContext,
            quotedPlatformPostId: post.quotedPlatformPostId,
          }}
          item={post}
        />
      </div>
    );
  }

  if (post.postType !== "reply" || !post.parentContext) {
    return <MoongFeedRow item={post} />;
  }

  return (
    <div className="moong-quote-group">
      <MoongFeedRow
        embeddedOriginal={{
          original: post.parentContext,
          quotedPlatformPostId: post.parentContext.platformPostId,
        }}
        item={post}
        showParentContext={false}
      />
    </div>
  );
}

function MoongFeedRow({
  embeddedOriginal,
  item,
  showParentContext = true,
}: {
  embeddedOriginal?: {
    original: SocialPostContext | null;
    quotedPlatformPostId: string;
  };
  item: PublicMoongPost;
  showParentContext?: boolean;
}) {
  const displayTime = formatPostTime(item.postedAt);
  const authorName = splitAuthorName(item.authorName);
  const displayText = getTweetPreviewText(item.text);
  const hasRichContent =
    embeddedOriginal ||
    item.attachments.some(
      (attachment) => hasRenderableAttachment(attachment),
    ) ||
    item.links.some((link) => isSafeHttpUrl(link.expandedUrl));
  const parentText = item.parentContext?.text
    ? getTweetPreviewText(item.parentContext.text)
    : null;

  return (
    <article className="moong-row">
      <div className="moong-author">
        <span aria-hidden="true" className="moong-avatar">
          {item.authorProfileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- profile URLs are stored runtime data
            <img alt="" src={item.authorProfileImageUrl} />
          ) : (
            getAvatarLabel(item.authorName || item.authorUsername)
          )}
        </span>
        <span className="moong-author-text" title={item.authorName}>
          {authorName.top ? (
            <span className="moong-author-name-primary">{authorName.top}</span>
          ) : null}
          {authorName.bottom ? (
            <span className="moong-author-name-secondary">
              {authorName.bottom}
            </span>
          ) : null}
        </span>
      </div>

      <div className="moong-message">
        <div className={`moong-bubble${hasRichContent ? " moong-bubble--rich" : ""}`}>
          <a
            aria-label={`${item.authorName} X 원문 열기`}
            className="moong-bubble-hit-area"
            href={item.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          />
          <span className="moong-bubble-body">
            {showParentContext && item.postType === "reply" && item.parentContext ? (
              <span className="moong-parent">
                <span className="moong-parent-author">
                  {item.parentContext.authorName ??
                    item.parentContext.authorUsername ??
                    "origin"}
                </span>
                <ClampedText
                  className="moong-parent-text"
                  text={parentText ?? item.parentContext.text ?? "원글"}
                />
              </span>
            ) : null}
            <ClampedText className="moong-text" text={displayText} />
          </span>
          <PostAttachments attachments={item.attachments} links={item.links} />
          {embeddedOriginal ? (
            <OriginalPostCard
              embedded
              original={embeddedOriginal.original}
              quotedPlatformPostId={embeddedOriginal.quotedPlatformPostId}
            />
          ) : null}
        </div>

        {displayTime ? (
          <time className="moong-time" dateTime={item.postedAt ?? ""}>
            {displayTime}
          </time>
        ) : null}
      </div>
    </article>
  );
}

function splitAuthorName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      bottom: value.trim(),
      top: "",
    };
  }

  return {
    bottom: parts.slice(1).join(" "),
    top: parts[0],
  };
}

function OriginalPostCard({
  embedded = false,
  original,
  quotedPlatformPostId,
}: {
  embedded?: boolean;
  original: SocialPostContext | null;
  quotedPlatformPostId: string;
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

function getTweetPreviewText(
  value: string,
) {
  const paragraphs = sanitizeTweetText(value)
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);

  return paragraphs.join("\n\n");
}

function sanitizeTweetText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/https?:\/\/t\.co\/[A-Za-z0-9]+(?:[ \t]*-[ \t]*@YouTube)?/gi, "")
    .replace(/(?:^|[ \t])-?[ \t]*@YouTube\b/gi, " ")
    .replace(
      /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+(?:[/?#][^\s]*)?/gi,
      "",
    )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    const namedEntities: Record<string, string> = {
      amp: "&",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\"",
      apos: "'",
    };
    const normalized = token.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return isValidCodePoint(codePoint)
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return isValidCodePoint(codePoint)
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return namedEntities[normalized] ?? entity;
  });
}

function PostAttachments({
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
  const safeLinks = links.filter(
    (link) =>
      isSafeHttpUrl(link.expandedUrl) &&
      !getYouTubeEmbed(link) &&
      !isShortUrlLink(link) &&
      !isSocialStatusLink(link) &&
      !(media.length > 0 && isMediaAttachmentLink(link)),
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

function hasRenderableAttachment(attachment: SocialPostAttachment) {
  return Boolean(
      attachment.url ||
      attachment.previewImageUrl ||
      attachment.videoUrl ||
      (Array.isArray(attachment.variants) &&
        attachment.variants.some((variant) => isSafeHttpUrl(variant.url))),
  );
}

type YouTubeEmbed = {
  embedUrl: string;
  title: string;
};

function getYouTubeEmbed(link: SocialPostLink): YouTubeEmbed | null {
  const videoId = getYouTubeVideoId(link.expandedUrl);

  if (!videoId) {
    return null;
  }

  return {
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    title: link.title ?? "YouTube video",
  };
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return normalizeYouTubeVideoId(url.pathname.split("/").filter(Boolean)[0]);
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return normalizeYouTubeVideoId(url.searchParams.get("v"));
      }

      const [, route, id] = url.pathname.split("/");
      if (route === "shorts" || route === "embed") {
        return normalizeYouTubeVideoId(id);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeVideoId(value: string | null | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{6,}$/.test(value)) {
    return null;
  }

  return value;
}

function isValidCodePoint(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

function formatPostTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getAvatarLabel(name: string) {
  return Array.from(name.replace(/\s+/g, ""))[0]?.toUpperCase() ?? "뭉";
}

function getHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function isMediaAttachmentLink(link: SocialPostLink) {
  if (link.displayUrl?.startsWith("pic.x.com/")) {
    return true;
  }

  const values = [link.expandedUrl, link.shortUrl].filter(
    (value): value is string => Boolean(value),
  );

  return values.some((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");

      return (
        host === "t.co" ||
        ((host === "x.com" || host === "twitter.com") &&
          /\/status\/\d+\/(?:photo|video)\//.test(url.pathname))
      );
    } catch {
      return false;
    }
  });
}

function isShortUrlLink(link: SocialPostLink) {
  const values = [link.expandedUrl, link.shortUrl].filter(
    (value): value is string => Boolean(value),
  );

  return values.some((value) => {
    try {
      return new URL(value).hostname.replace(/^www\./, "") === "t.co";
    } catch {
      return false;
    }
  });
}

function isSocialStatusLink(link: SocialPostLink) {
  const values = [link.expandedUrl, link.shortUrl].filter(
    (value): value is string => Boolean(value),
  );

  return values.some((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");

      return (
        (host === "x.com" || host === "twitter.com") &&
        /^\/[A-Za-z0-9_]+\/status\/\d+/.test(url.pathname)
      );
    } catch {
      return false;
    }
  });
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
