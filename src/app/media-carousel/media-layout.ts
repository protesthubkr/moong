import type { CSSProperties } from "react";
import type { SocialPostAttachment } from "@/lib/social/types";
import {
  MEDIA_GAP_PX,
  SHORT_MEDIA_FRAME_MIN_EXTRA_PX,
  SHORT_MEDIA_FRAME_THRESHOLD,
} from "./media-constants";

export type StableMediaStyle = CSSProperties & {
  "--moong-media-aspect"?: string;
  "--moong-media-bg"?: string;
  "--moong-media-frame-height"?: string;
  "--moong-media-height-limited-width"?: string;
  "--moong-media-inline-max-height"?: string;
  "--moong-media-natural-width"?: string;
  "--moong-media-width"?: string;
};

export type MediaBounds = {
  inlineMaxHeight: number;
  width: number;
};

export type MediaLayout = {
  count: number;
  targetFrameHeight: number | null;
};

type StableMediaDimensions = {
  aspect: number;
  itemHeight: number;
  itemWidth: number;
};

export function getMediaItemStyle({
  attachment,
  hasVideo,
  mediaBounds,
  mediaLayout,
}: {
  attachment: SocialPostAttachment;
  hasVideo: boolean;
  mediaBounds: MediaBounds;
  mediaLayout: MediaLayout;
}): CSSProperties | undefined {
  const stableStyle = getStableMediaStyle({
    attachment,
    hasVideo,
    mediaBounds,
    mediaLayout,
  });

  if (stableStyle) {
    return stableStyle;
  }

  if (hasVideo) {
    return getFallbackMediaBoundsStyle(mediaBounds);
  }

  return (
    getMediaAspectStyle(attachment) ?? getFallbackMediaBoundsStyle(mediaBounds)
  );
}

export function getMediaLayout(
  media: SocialPostAttachment[],
  mediaBounds: MediaBounds,
): MediaLayout {
  const count = media.length;

  if (count <= 1) {
    return {
      count,
      targetFrameHeight: null,
    };
  }

  const targetFrameHeight = media.reduce((height, attachment) => {
    const dimensions = getStableMediaDimensions(attachment, count, mediaBounds);

    return dimensions ? Math.max(height, dimensions.itemHeight) : height;
  }, 0);

  return {
    count,
    targetFrameHeight: targetFrameHeight > 0 ? targetFrameHeight : null,
  };
}

export function hasStableMediaSize(style: CSSProperties | undefined) {
  return Boolean(style && "--moong-media-aspect" in style);
}

export function hasFramedMediaStyle(style: CSSProperties | undefined) {
  return Boolean(style && "--moong-media-frame-height" in style);
}

export function shouldFrameShortMedia(
  itemHeight: number,
  targetFrameHeight: number,
) {
  return (
    targetFrameHeight - itemHeight >= SHORT_MEDIA_FRAME_MIN_EXTRA_PX &&
    itemHeight / targetFrameHeight <= SHORT_MEDIA_FRAME_THRESHOLD
  );
}

function getStableMediaStyle({
  attachment,
  hasVideo,
  mediaBounds,
  mediaLayout,
}: {
  attachment: SocialPostAttachment;
  hasVideo: boolean;
  mediaBounds: MediaBounds;
  mediaLayout: MediaLayout;
}): CSSProperties | undefined {
  const dimensions = getStableMediaDimensions(
    attachment,
    mediaLayout.count,
    mediaBounds,
  );

  if (!dimensions) {
    return undefined;
  }

  const targetFrameHeight = mediaLayout.targetFrameHeight;
  const shouldFrame =
    !hasVideo &&
    mediaLayout.count > 1 &&
    targetFrameHeight !== null &&
    shouldFrameShortMedia(dimensions.itemHeight, targetFrameHeight);
  const frameHeight =
    shouldFrame && targetFrameHeight !== null
      ? targetFrameHeight
      : dimensions.itemHeight;

  const style = {
    "--moong-media-aspect": String(dimensions.itemWidth / frameHeight),
    "--moong-media-height-limited-width": `${
      dimensions.aspect * mediaBounds.inlineMaxHeight
    }px`,
    "--moong-media-inline-max-height": `${mediaBounds.inlineMaxHeight}px`,
    "--moong-media-natural-width": `${attachment.width}px`,
    "--moong-media-width": `${dimensions.itemWidth}px`,
    aspectRatio: `${dimensions.itemWidth} / ${frameHeight}`,
    flexBasis: `${dimensions.itemWidth}px`,
    maxHeight: `${mediaBounds.inlineMaxHeight}px`,
    width: `${dimensions.itemWidth}px`,
  } as StableMediaStyle;

  if (shouldFrame) {
    style["--moong-media-frame-height"] = `${frameHeight}px`;
  }

  return style;
}

function getStableMediaDimensions(
  attachment: SocialPostAttachment,
  mediaCount: number,
  mediaBounds: MediaBounds,
): StableMediaDimensions | null {
  if (
    !attachment.width ||
    !attachment.height ||
    mediaBounds.width <= 0 ||
    mediaBounds.inlineMaxHeight <= 0
  ) {
    return null;
  }

  const aspect = attachment.width / attachment.height;
  const visibleColumns = mediaCount <= 1 ? 1 : 2;
  const columnGap = visibleColumns > 1 ? MEDIA_GAP_PX : 0;
  const widthFromContainer = Math.floor(
    (mediaBounds.width - columnGap) / visibleColumns,
  );
  const widthFromHeight = aspect * mediaBounds.inlineMaxHeight;
  const itemWidth = Math.max(
    1,
    mediaCount > 2
      ? widthFromContainer
      : Math.min(widthFromContainer, attachment.width, widthFromHeight),
  );

  return {
    aspect,
    itemHeight: Math.min(mediaBounds.inlineMaxHeight, itemWidth / aspect),
    itemWidth,
  };
}

function getFallbackMediaBoundsStyle(
  mediaBounds: MediaBounds,
): CSSProperties | undefined {
  if (mediaBounds.inlineMaxHeight <= 0) {
    return undefined;
  }

  return {
    "--moong-media-inline-max-height": `${mediaBounds.inlineMaxHeight}px`,
  } as StableMediaStyle;
}

function getMediaAspectStyle(
  attachment: SocialPostAttachment,
): CSSProperties | undefined {
  if (!attachment.width || !attachment.height) {
    return undefined;
  }

  return {
    aspectRatio: `${attachment.width} / ${attachment.height}`,
  };
}
