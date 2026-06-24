import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPublicMoongFeed } from "@/lib/social/repository";
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
    return <MoongFeedRow item={item.post} />;
  }

  return (
    <div className="moong-quote-group">
      <div className="moong-quote-posts">
        {item.posts.map((post) => (
          <MoongFeedRow item={post} key={post.id} />
        ))}
      </div>
      <OriginalPostCard
        original={item.original}
        quotedPlatformPostId={item.quotedPlatformPostId}
      />
    </div>
  );
}

function MoongFeedRow({ item }: { item: PublicMoongPost }) {
  const displayTime = formatPostTime(item.postedAt);
  const displayText = getTweetPreviewText(item.text);
  const parentText = item.parentContext?.text
    ? getTweetPreviewText(item.parentContext.text)
    : null;

  return (
    <article className="moong-row">
      <div className="moong-author">
        <span aria-hidden="true" className="moong-avatar">
          {getAvatarLabel(item.authorName || item.authorUsername)}
        </span>
        <span className="moong-author-text">
          <span className="moong-author-name">{item.authorName}</span>
          <span className="moong-author-handle">@{item.authorUsername}</span>
        </span>
      </div>

      <div className="moong-message">
        <a
          aria-label={`${item.authorName} X 원문 열기`}
          className="moong-bubble"
          href={item.sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {item.postType === "reply" && item.parentContext ? (
            <span className="moong-parent">
              <span className="moong-parent-author">
                @{item.parentContext.authorUsername ?? "origin"}
              </span>
              <span className="moong-parent-text">
                {parentText ?? item.parentContext.text ?? "원글"}
              </span>
            </span>
          ) : null}
          <span className="moong-text">{displayText}</span>
        </a>

        <PostAttachments attachments={item.attachments} links={item.links} />

        {displayTime ? (
          <time className="moong-time" dateTime={item.postedAt ?? ""}>
            {displayTime}
          </time>
        ) : null}
      </div>
    </article>
  );
}

function OriginalPostCard({
  original,
  quotedPlatformPostId,
}: {
  original: SocialPostContext | null;
  quotedPlatformPostId: string;
}) {
  const href =
    original?.sourceUrl ?? `https://x.com/i/web/status/${quotedPlatformPostId}`;
  const author = original?.authorUsername
    ? `@${original.authorUsername}`
    : "original";
  const originalText = original?.text ? getTweetPreviewText(original.text) : "";

  return (
    <a
      className="moong-original-card"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="moong-original-label">원문</span>
      <span className="moong-original-author">{author}</span>
      {originalText ? (
        <span className="moong-original-text">{originalText}</span>
      ) : (
        <span className="moong-original-text moong-original-text--empty">
          원문 내용을 가져오지 못했습니다.
        </span>
      )}
    </a>
  );
}

function getTweetPreviewText(value: string) {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.slice(0, 2).join("\n\n");
}

function PostAttachments({
  attachments,
  links,
}: {
  attachments: SocialPostAttachment[];
  links: SocialPostLink[];
}) {
  const media = attachments.filter(
    (attachment) => attachment.url || attachment.previewImageUrl,
  );
  const safeLinks = links.filter((link) => isSafeHttpUrl(link.expandedUrl));

  if (media.length === 0 && safeLinks.length === 0) {
    return null;
  }

  return (
    <div className="moong-attachments">
      {media.length > 0 ? (
        <div className={`moong-media-grid moong-media-grid--${media.length}`}>
          {media.slice(0, 4).map((attachment, index) => (
            <a
              className="moong-media"
              href={attachment.url ?? attachment.previewImageUrl ?? "#"}
              key={`${attachment.mediaKey ?? attachment.url}-${index}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote X media domains are runtime data */}
              <img
                alt={attachment.altText ?? ""}
                decoding="async"
                loading="lazy"
                src={attachment.url ?? attachment.previewImageUrl ?? ""}
              />
              {attachment.type !== "photo" ? (
                <span className="moong-media-kind">{formatMediaKind(attachment.type)}</span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}

      {safeLinks.map((link) => (
        <a
          className="moong-link-card"
          href={link.expandedUrl}
          key={link.expandedUrl}
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

function formatMediaKind(type: string) {
  if (type === "animated_gif") {
    return "GIF";
  }

  if (type === "video") {
    return "영상";
  }

  return "미디어";
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

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
