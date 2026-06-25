import type {
  SocialPostAttachment,
  SocialPostContext,
  SocialPostLink,
  SocialSource,
  XIncludes,
  XMedia,
  XPost,
  XUser,
} from "./types";

export function getXPostText(post: XPost) {
  return post.note_tweet?.text?.trim() || post.text?.trim() || "";
}

export function getXPostUrl(username: string, postId: string) {
  return `https://x.com/${username.replace(/^@/, "")}/status/${postId}`;
}

export function getXPostType(post: XPost) {
  const references = post.referenced_tweets ?? [];

  if (references.some((reference) => reference.type === "retweeted")) {
    return "repost" as const;
  }

  if (references.some((reference) => reference.type === "quoted")) {
    return "quote" as const;
  }

  if (references.some((reference) => reference.type === "replied_to")) {
    return "reply" as const;
  }

  return "original" as const;
}

export function getReferenceId(
  post: XPost,
  type: "quoted" | "replied_to" | "retweeted",
) {
  return post.referenced_tweets?.find((reference) => reference.type === type)?.id;
}

export function getPostAttachments(post: XPost) {
  const includes = post.hydration_includes;
  const mediaByKey = new Map(
    (includes?.media ?? []).map((media) => [media.media_key, media]),
  );

  return (post.attachments?.media_keys ?? [])
    .map((mediaKey) => mediaByKey.get(mediaKey))
    .filter((media): media is XMedia => Boolean(media))
    .map(
      (media): SocialPostAttachment => ({
        altText: media.alt_text ?? null,
        height: media.height ?? null,
        mediaKey: media.media_key,
        previewImageUrl: media.preview_image_url ?? null,
        type: media.type ?? "unknown",
        url: media.url ?? null,
        width: media.width ?? null,
      }),
    );
}

export function getPostLinks(post: XPost): SocialPostLink[] {
  return (post.entities?.urls ?? [])
    .map((url) => ({
      description: url.description ?? null,
      displayUrl: url.display_url ?? null,
      expandedUrl: url.expanded_url ?? url.unwound_url ?? url.url ?? "",
      images: url.images,
      shortUrl: url.url ?? null,
      title: url.title ?? null,
    }))
    .filter((link) => isHttpUrl(link.expandedUrl));
}

export function getReferencedContext({
  fallbackSource,
  post,
  type,
}: {
  fallbackSource: SocialSource;
  post: XPost;
  type: "quoted" | "replied_to";
}): SocialPostContext | null {
  const referenceId = getReferenceId(post, type);

  if (!referenceId) {
    return null;
  }

  const includes = post.hydration_includes;
  const referencedPost = includes?.tweets?.find((tweet) => tweet.id === referenceId);
  const author = getIncludedUser(includes, referencedPost?.author_id);
  const username = author?.username ?? fallbackSource.username;

  return {
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    platformPostId: referenceId,
    sourceUrl: getXPostUrl(username, referenceId),
    text: referencedPost ? getXPostText(referencedPost) : null,
  };
}

function getIncludedUser(includes: XIncludes | undefined, userId?: string) {
  if (!userId) {
    return undefined;
  }

  return (includes?.users ?? []).find((user): user is XUser => user.id === userId);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
