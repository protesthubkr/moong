import type { CSSProperties } from "react";
import {
  getContextColorStyle,
  getPostColorStyle,
} from "@/lib/social/source-colors";
import type {
  PublicMoongFeedItem,
  PublicMoongPost,
  SocialPostContext,
} from "@/lib/social/types";
import { ClampedText } from "../clamped-text";
import {
  OriginalPostCard,
  PostAttachments,
  hasRichPostContent,
  type EmbeddedOriginal,
} from "./attachments";
import {
  formatPostTime,
  getAvatarLabel,
  getTweetPreviewText,
  splitAuthorName,
} from "./text";

export function MoongFeedItem({ item }: { item: PublicMoongFeedItem }) {
  if (item.kind === "post") {
    return <MoongPostThread post={item.post} />;
  }

  if (item.kind === "thread") {
    return <MoongSelfThread posts={item.posts} />;
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

function MoongSelfThread({ posts }: { posts: PublicMoongPost[] }) {
  const [firstPost, ...continuationPosts] = posts;

  if (!firstPost) {
    return null;
  }

  return (
    <article
      className="moong-row moong-row--thread"
      data-moong-party-key={firstPost.partyKey}
      style={getPostColorStyle(firstPost) as CSSProperties}
    >
      <MoongAuthor item={firstPost} />
      <div className="moong-message moong-message--thread">
        <MoongPostMessage
          embeddedOriginal={getEmbeddedOriginal(firstPost)}
          item={firstPost}
          showParentContext={firstPost.postType !== "reply"}
        />
        {continuationPosts.map((post) => (
          <MoongPostMessage
            item={post}
            key={post.id}
            showParentContext={false}
            threadContinuation
          />
        ))}
      </div>
    </article>
  );
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
  embeddedOriginal?: EmbeddedOriginal;
  item: PublicMoongPost;
  showParentContext?: boolean;
}) {
  return (
    <article
      className="moong-row"
      data-moong-party-key={item.partyKey}
      style={getPostColorStyle(item) as CSSProperties}
    >
      <MoongAuthor item={item} />
      <div className="moong-message">
        <MoongPostMessage
          embeddedOriginal={embeddedOriginal}
          item={item}
          showParentContext={showParentContext}
        />
      </div>
    </article>
  );
}

function MoongAuthor({ item }: { item: PublicMoongPost }) {
  const authorName = splitAuthorName(item.authorName);

  return (
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
  );
}

function MoongPostMessage({
  embeddedOriginal,
  item,
  showParentContext = true,
  threadContinuation = false,
}: {
  embeddedOriginal?: EmbeddedOriginal;
  item: PublicMoongPost;
  showParentContext?: boolean;
  threadContinuation?: boolean;
}) {
  const displayTime = formatPostTime(item.postedAt);
  const displayText = getTweetPreviewText(item.text);
  const hasRichContent =
    embeddedOriginal ||
    hasRichPostContent({
      attachments: item.attachments,
      links: item.links,
    });
  const parentText = item.parentContext?.text
    ? getTweetPreviewText(item.parentContext.text)
    : null;

  return (
    <div
      className={`moong-message-block${
        threadContinuation ? " moong-message-block--continuation" : ""
      }`}
    >
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
            <ParentContext context={item.parentContext} text={parentText} />
          ) : null}
          <ClampedText className="moong-text" text={displayText} />
        </span>
        <PostAttachments attachments={item.attachments} links={item.links} />
        {embeddedOriginal ? (
          <OriginalPostCard
            embedded
            original={embeddedOriginal.original}
            quotedPlatformPostId={embeddedOriginal.quotedPlatformPostId}
            style={getContextColorStyle(embeddedOriginal.original) as CSSProperties}
          />
        ) : null}
        {displayTime ? (
          <time className="moong-time" dateTime={item.postedAt ?? ""}>
            {displayTime}
          </time>
        ) : null}
      </div>
    </div>
  );
}

function ParentContext({
  context,
  text,
}: {
  context: SocialPostContext;
  text: string | null;
}) {
  return (
    <span
      className="moong-parent"
      style={getContextColorStyle(context) as CSSProperties}
    >
      <span className="moong-parent-author">
        {context.authorName ?? context.authorUsername ?? "origin"}
      </span>
      <ClampedText
        className="moong-parent-text"
        text={text ?? context.text ?? "원글"}
      />
    </span>
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

function getEmbeddedOriginal(post: PublicMoongPost) {
  if (post.postType !== "quote" || !post.quotedPlatformPostId) {
    return undefined;
  }

  return {
    original: post.quoteContext,
    quotedPlatformPostId: post.quotedPlatformPostId,
  };
}
