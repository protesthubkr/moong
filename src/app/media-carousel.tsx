"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import type { SocialPostAttachment } from "@/lib/social/types";

const MEDIA_CLICK_CANCEL_THRESHOLD = 6;
const MEDIA_GAP_PX = 6;
const MOBILE_MEDIA_QUERY = "(max-width: 760px)";
const SHORT_MEDIA_FRAME_MIN_EXTRA_PX = 36;
const SHORT_MEDIA_FRAME_THRESHOLD = 0.72;
const SAMPLE_CANVAS_SIZE = 24;
const MEDIA_BACKGROUND_SURFACE_RGB = {
  b: 244,
  g: 247,
  r: 247,
};
const DEFAULT_CLAMPED_TEXT_LINES = 10;
const FALLBACK_ROW_TOP_OFFSET = 64;
const MIN_INLINE_MEDIA_HEIGHT = 140;
const MOBILE_BOTTOM_SAFE_AREA = 12;
const DESKTOP_BOTTOM_SAFE_AREA = 40;
const MAIN_TEXT_LINE_HEIGHT_PX = 13 * 1.52;
const BUBBLE_VERTICAL_PADDING_PX = 14 * 2;
const BUBBLE_BORDER_PX = 2;
const ATTACHMENTS_TOP_GAP_PX = 8;
const MEDIA_STRIP_BOTTOM_PADDING_PX = 2;
const BUBBLE_FIT_BREATHING_ROOM_PX = 2;
const BUBBLE_VERTICAL_CHROME_PX =
  BUBBLE_VERTICAL_PADDING_PX +
  BUBBLE_BORDER_PX +
  ATTACHMENTS_TOP_GAP_PX +
  MEDIA_STRIP_BOTTOM_PADDING_PX +
  BUBBLE_FIT_BREATHING_ROOM_PX;
const BUBBLE_MAX_TEXT_RESERVE_PX =
  MAIN_TEXT_LINE_HEIGHT_PX * DEFAULT_CLAMPED_TEXT_LINES +
  BUBBLE_VERTICAL_CHROME_PX;

type StableMediaStyle = CSSProperties & {
  "--moong-media-aspect"?: string;
  "--moong-media-bg"?: string;
  "--moong-media-frame-height"?: string;
  "--moong-media-height-limited-width"?: string;
  "--moong-media-inline-max-height"?: string;
  "--moong-media-natural-width"?: string;
  "--moong-media-width"?: string;
};

type MediaBounds = {
  inlineMaxHeight: number;
  width: number;
};

type MediaLayout = {
  count: number;
  targetFrameHeight: number | null;
};

type StableMediaDimensions = {
  aspect: number;
  itemHeight: number;
  itemWidth: number;
};

const sampledImageColors = new Map<string, Promise<string | null>>();

export function MediaCarousel({
  attachments,
}: {
  attachments: SocialPostAttachment[];
}) {
  const clickResetTimerRef = useRef(0);
  const gestureRef = useRef({
    dragged: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [mediaBounds, setMediaBounds] = useState<MediaBounds>({
    inlineMaxHeight: 420,
    width: 0,
  });
  const media = attachments.slice(0, 4);
  const mediaLayout = getMediaLayout(media, mediaBounds);
  const activeAttachment =
    activeIndex === null ? null : media[activeIndex] ?? null;
  const activeVideoUrl = activeAttachment
    ? getPlayableAttachmentVideoUrl(activeAttachment)
    : null;
  const showControls = media.length > 2;

  const rememberGestureStart = useCallback((x: number, y: number) => {
    window.clearTimeout(clickResetTimerRef.current);
    gestureRef.current = {
      dragged: false,
      pointerId: -1,
      x,
      y,
    };
  }, []);

  const rememberGestureMove = useCallback((x: number, y: number) => {
    const deltaX = Math.abs(x - gestureRef.current.x);
    const deltaY = Math.abs(y - gestureRef.current.y);

    if (
      deltaX > MEDIA_CLICK_CANCEL_THRESHOLD ||
      deltaY > MEDIA_CLICK_CANCEL_THRESHOLD
    ) {
      gestureRef.current.dragged = true;
    }
  }, []);

  const resetGestureSoon = useCallback(() => {
    window.clearTimeout(clickResetTimerRef.current);
    clickResetTimerRef.current = window.setTimeout(() => {
      gestureRef.current.dragged = false;
    }, 350);
  }, []);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    setCanScrollPrev(viewport.scrollLeft > 2);
    setCanScrollNext(viewport.scrollLeft < maxScrollLeft - 2);
  }, []);

  const updateMediaBounds = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportWidth = Math.floor(viewport.getBoundingClientRect().width);
    const visualViewportHeight = Math.floor(
      Math.min(window.visualViewport?.height ?? window.innerHeight, window.innerHeight),
    );
    const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    const availableViewportHeight =
      visualViewportHeight -
      FALLBACK_ROW_TOP_OFFSET -
      (isMobile ? MOBILE_BOTTOM_SAFE_AREA : DESKTOP_BOTTOM_SAFE_AREA);
    const inlineMaxHeight = Math.max(
      MIN_INLINE_MEDIA_HEIGHT,
      availableViewportHeight - BUBBLE_MAX_TEXT_RESERVE_PX,
    );

    setMediaBounds((current) =>
      Math.abs(current.width - viewportWidth) < 1 &&
      Math.abs(current.inlineMaxHeight - inlineMaxHeight) < 1
        ? current
        : {
            inlineMaxHeight,
            width: viewportWidth,
          },
    );
  }, []);

  const scrollByOne = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    const firstItem = viewport?.querySelector<HTMLElement>(".moong-media");

    if (!viewport || !firstItem) {
      return;
    }

    const gap = Number.parseFloat(getComputedStyle(viewport).columnGap || "0");
    viewport.scrollBy({
      behavior: "smooth",
      left: direction * (firstItem.getBoundingClientRect().width + gap),
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    updateMediaBounds();

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleResize = () => {
      updateScrollState();
      updateMediaBounds();
    };
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [updateMediaBounds, updateScrollState]);

  useEffect(() => {
    if (!activeAttachment) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeAttachment]);

  useEffect(
    () => () => {
      window.clearTimeout(clickResetTimerRef.current);
    },
    [],
  );

  const handleMediaClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      if (gestureRef.current.dragged) {
        event.preventDefault();
        event.stopPropagation();
        gestureRef.current.dragged = false;
        return;
      }

      setActiveIndex(index);
    },
    [],
  );

  const handleMediaPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      rememberGestureStart(event.clientX, event.clientY);
      gestureRef.current.pointerId = event.pointerId;
    },
    [rememberGestureStart],
  );

  const handleMediaPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (gestureRef.current.pointerId !== event.pointerId) {
        return;
      }

      rememberGestureMove(event.clientX, event.clientY);
    },
    [rememberGestureMove],
  );

  const handleMediaPointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (gestureRef.current.pointerId === event.pointerId) {
        rememberGestureMove(event.clientX, event.clientY);
        gestureRef.current.pointerId = -1;
      }

      resetGestureSoon();
    },
    [rememberGestureMove, resetGestureSoon],
  );

  const handleMediaPointerCancel = useCallback(() => {
    gestureRef.current.dragged = true;
    gestureRef.current.pointerId = -1;
    resetGestureSoon();
  }, [resetGestureSoon]);

  const lightbox =
    activeAttachment && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-label="이미지 크게 보기"
            aria-modal="true"
            className="moong-media-lightbox"
            onClick={() => setActiveIndex(null)}
            role="dialog"
          >
            <button
              aria-label="닫기"
              className="moong-media-lightbox-close"
              onClick={() => setActiveIndex(null)}
              type="button"
            />
            <div
              className="moong-media-lightbox-frame"
              onClick={(event) => event.stopPropagation()}
            >
              {activeVideoUrl ? (
                <video
                  autoPlay
                  className="moong-media-lightbox-video"
                  controls
                  height={activeAttachment.height ?? undefined}
                  loop={activeAttachment.type === "animated_gif"}
                  muted={activeAttachment.type === "animated_gif"}
                  playsInline
                  poster={activeAttachment.previewImageUrl ?? undefined}
                  preload="metadata"
                  width={activeAttachment.width ?? undefined}
                >
                  <source
                    src={getVideoPlaybackUrl(activeVideoUrl)}
                    type="video/mp4"
                  />
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- remote X media domains are runtime data
                <img
                  alt={activeAttachment.altText ?? ""}
                  className="moong-media-lightbox-image"
                  decoding="async"
                  height={activeAttachment.height ?? undefined}
                  src={getAttachmentImageUrl(activeAttachment)}
                  width={activeAttachment.width ?? undefined}
                />
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="moong-media-carousel">
      <div
        className={`moong-media-strip moong-media-strip--${media.length}`}
        ref={viewportRef}
      >
        {media.map((attachment, index) => {
          const videoUrl = getPlayableAttachmentVideoUrl(attachment);
          const imageUrl = getAttachmentImageUrl(attachment);
          const key = `${attachment.mediaKey ?? imageUrl ?? videoUrl}-${index}`;
          const style = getMediaItemStyle(
            attachment,
            mediaLayout,
            Boolean(videoUrl),
            mediaBounds,
          );
          const sizedClassName = hasStableMediaSize(style)
            ? " moong-media--sized"
            : "";
          const framedClassName = hasFramedMediaStyle(style)
            ? " moong-media--framed"
            : "";

          if (videoUrl) {
            return (
              <VideoMedia
                attachment={attachment}
                fallbackUrl={videoUrl}
                key={key}
                onExpand={() => setActiveIndex(index)}
                style={style}
                videoUrl={getVideoPlaybackUrl(videoUrl)}
              />
            );
          }

          return (
            <button
              aria-label="이미지 크게 보기"
              className={`moong-media${sizedClassName}${framedClassName}`}
              key={key}
              onClick={(event) => handleMediaClick(event, index)}
              onDragStart={(event) => event.preventDefault()}
              onPointerCancel={handleMediaPointerCancel}
              onPointerDown={handleMediaPointerDown}
              onPointerMove={handleMediaPointerMove}
              onPointerUp={handleMediaPointerEnd}
              style={style}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote X media domains are runtime data */}
              <img
                alt={attachment.altText ?? ""}
                decoding="async"
                height={attachment.height ?? undefined}
                loading="lazy"
                onLoad={(event) =>
                  handleMediaImageLoad(
                    event.currentTarget,
                    hasFramedMediaStyle(style),
                  )
                }
                src={imageUrl}
                width={attachment.width ?? undefined}
              />
              {attachment.type !== "photo" ? (
                <span className="moong-media-kind">
                  {formatMediaKind(attachment.type)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {showControls ? (
        <>
          <button
            aria-label="이전 미디어"
            className="moong-media-arrow moong-media-arrow--prev"
            disabled={!canScrollPrev}
            onClick={() => scrollByOne(-1)}
            type="button"
          >
            <span aria-hidden="true" className="moong-media-arrow-icon" />
          </button>
          <button
            aria-label="다음 미디어"
            className="moong-media-arrow moong-media-arrow--next"
            disabled={!canScrollNext}
            onClick={() => scrollByOne(1)}
            type="button"
          >
            <span aria-hidden="true" className="moong-media-arrow-icon" />
          </button>
        </>
      ) : null}

      {lightbox}
    </div>
  );
}

function VideoMedia({
  attachment,
  fallbackUrl,
  onExpand,
  style,
  videoUrl,
}: {
  attachment: SocialPostAttachment;
  fallbackUrl: string;
  onExpand: () => void;
  style: CSSProperties | undefined;
  videoUrl: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playErrorMessage, setPlayErrorMessage] = useState("");
  const [playFailed, setPlayFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [mobileFullscreenMode, setMobileFullscreenMode] = useState(false);

  const syncPaused = useCallback(() => {
    setPaused(videoRef.current?.paused ?? true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    let animationFrame = 0;
    let timeout = 0;
    const syncMobileMode = () => {
      setMobileFullscreenMode(isMobileMediaViewport());
    };

    syncMobileMode();
    animationFrame = window.requestAnimationFrame(syncMobileMode);
    timeout = window.setTimeout(syncMobileMode, 120);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMobileMode);
    } else {
      legacyMediaQuery.addListener?.(syncMobileMode);
    }
    window.addEventListener("resize", syncMobileMode);
    window.visualViewport?.addEventListener("resize", syncMobileMode);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", syncMobileMode);
      } else {
        legacyMediaQuery.removeListener?.(syncMobileMode);
      }
      window.removeEventListener("resize", syncMobileMode);
      window.visualViewport?.removeEventListener("resize", syncMobileMode);
    };
  }, []);

  const handlePlayClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (mobileFullscreenMode) {
        onExpand();
        return;
      }

      const video = videoRef.current;

      if (!video) {
        return;
      }

      try {
        setPlayFailed(false);
        setPlayErrorMessage("");
        if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
          video.load();
        }
        await video.play();
        setPaused(video.paused);
      } catch (error) {
        setPlayErrorMessage(error instanceof Error ? error.message : String(error));
        setPlayFailed(true);
      }
    },
    [mobileFullscreenMode, onExpand],
  );

  const handleFullscreenClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onExpand();
    },
    [onExpand],
  );

  return (
    <div
      className={`moong-media moong-media--video${
        hasStableMediaSize(style) ? " moong-media--sized" : ""
      }`}
      style={style}
    >
      <video
        className="moong-media-video"
        controls={!mobileFullscreenMode}
        height={attachment.height ?? undefined}
        loop={attachment.type === "animated_gif"}
        muted={attachment.type === "animated_gif"}
        onEnded={syncPaused}
        onLoadedMetadata={syncPaused}
        onPause={syncPaused}
        onPlay={syncPaused}
        playsInline
        poster={attachment.previewImageUrl ?? undefined}
        preload="none"
        ref={videoRef}
        width={attachment.width ?? undefined}
      >
        <source src={videoUrl} type="video/mp4" />
        <a href={fallbackUrl} rel="noopener noreferrer" target="_blank">
          video
        </a>
      </video>
      {mobileFullscreenMode ? (
        <button
          aria-label="비디오 전체화면으로 보기"
          className="moong-video-fullscreen-button"
          onClick={handleFullscreenClick}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
      {paused && !mobileFullscreenMode ? (
        <button
          aria-label={playFailed ? "Video failed to play" : "Play video"}
          className="moong-video-play-button"
          data-play-error={playErrorMessage || undefined}
          onClick={handlePlayClick}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
      {!mobileFullscreenMode ? (
        <button
          aria-label="Expand video"
          className="moong-media-expand-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onExpand();
          }}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function getMediaItemStyle(
  attachment: SocialPostAttachment,
  mediaLayout: MediaLayout,
  hasVideo: boolean,
  mediaBounds: MediaBounds,
): CSSProperties | undefined {
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

  return getMediaAspectStyle(attachment) ?? getFallbackMediaBoundsStyle(mediaBounds);
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

function getMediaLayout(
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

function hasStableMediaSize(style: CSSProperties | undefined) {
  return Boolean(style && "--moong-media-aspect" in style);
}

function hasFramedMediaStyle(style: CSSProperties | undefined) {
  return Boolean(style && "--moong-media-frame-height" in style);
}

function isMobileMediaViewport() {
  return (
    window.matchMedia(MOBILE_MEDIA_QUERY).matches || window.innerWidth <= 760
  );
}

function shouldFrameShortMedia(itemHeight: number, targetFrameHeight: number) {
  return (
    targetFrameHeight - itemHeight >= SHORT_MEDIA_FRAME_MIN_EXTRA_PX &&
    itemHeight / targetFrameHeight <= SHORT_MEDIA_FRAME_THRESHOLD
  );
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

function getAttachmentImageUrl(attachment: SocialPostAttachment) {
  return attachment.url ?? attachment.previewImageUrl ?? "";
}

function handleMediaImageLoad(
  image: HTMLImageElement,
  hasPrecomputedFrame: boolean,
) {
  const hasNaturalFrame = applyNaturalMediaFrames(image);

  applySampledImageBackground(
    image,
    hasPrecomputedFrame ||
      hasNaturalFrame ||
      Boolean(image.closest(".moong-media--framed")),
  );
}

function applyNaturalMediaFrames(image: HTMLImageElement) {
  const strip = image.closest<HTMLElement>(".moong-media-strip");

  if (!strip) {
    return false;
  }

  const mediaElements = Array.from(
    strip.querySelectorAll<HTMLElement>(".moong-media:not(.moong-media--video)"),
  );

  if (mediaElements.length <= 1) {
    return false;
  }

  const measurements = mediaElements
    .map((element) => {
      const mediaImage = element.querySelector("img");
      const width = element.getBoundingClientRect().width;
      const naturalWidth = mediaImage?.naturalWidth ?? 0;
      const naturalHeight = mediaImage?.naturalHeight ?? 0;

      if (!mediaImage || width <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
        return null;
      }

      return {
        element,
        height: width / (naturalWidth / naturalHeight),
        width,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (measurements.length <= 1) {
    return false;
  }

  const targetFrameHeight = Math.max(
    ...measurements.map((measurement) => measurement.height),
  );
  let currentImageFramed = false;

  for (const measurement of measurements) {
    const shouldFrame = shouldFrameShortMedia(
      measurement.height,
      targetFrameHeight,
    );

    if (shouldFrame) {
      measurement.element.classList.add(
        "moong-media--sized",
        "moong-media--framed",
        "moong-media--natural-framed",
      );
      measurement.element.style.aspectRatio = `${measurement.width} / ${targetFrameHeight}`;
      measurement.element.style.flexBasis = `${measurement.width}px`;
      measurement.element.style.maxHeight = `${targetFrameHeight}px`;
      measurement.element.style.width = `${measurement.width}px`;
      measurement.element.style.setProperty(
        "--moong-media-aspect",
        String(measurement.width / targetFrameHeight),
      );
      measurement.element.style.setProperty(
        "--moong-media-frame-height",
        `${targetFrameHeight}px`,
      );

      if (measurement.element.contains(image)) {
        currentImageFramed = true;
      }
    } else if (measurement.element.classList.contains("moong-media--natural-framed")) {
      measurement.element.classList.remove(
        "moong-media--sized",
        "moong-media--framed",
        "moong-media--natural-framed",
      );
      measurement.element.style.removeProperty("aspect-ratio");
      measurement.element.style.removeProperty("flex-basis");
      measurement.element.style.removeProperty("max-height");
      measurement.element.style.removeProperty("width");
      measurement.element.style.removeProperty("--moong-media-aspect");
      measurement.element.style.removeProperty("--moong-media-frame-height");
      measurement.element.style.removeProperty("--moong-media-bg");
    }
  }

  return currentImageFramed;
}

function applySampledImageBackground(
  image: HTMLImageElement,
  shouldSample: boolean,
) {
  if (!shouldSample) {
    return;
  }

  const mediaElement = image.closest<HTMLElement>(".moong-media--framed");
  const imageUrl = image.currentSrc || image.src;

  if (!mediaElement || !imageUrl) {
    return;
  }

  getSampledImageColor(imageUrl).then((color) => {
    if (color && mediaElement.isConnected) {
      mediaElement.style.setProperty("--moong-media-bg", color);
    }
  });
}

function getSampledImageColor(imageUrl: string) {
  const cachedColor = sampledImageColors.get(imageUrl);

  if (cachedColor) {
    return cachedColor;
  }

  const colorPromise = new Promise<string | null>((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(sampleLoadedImageColor(image));
    image.onerror = () => resolve(null);
    image.src = getImageSamplingUrl(imageUrl);
  });

  sampledImageColors.set(imageUrl, colorPromise);

  return colorPromise;
}

function getImageSamplingUrl(value: string) {
  try {
    const url = new URL(value, window.location.href);

    if (url.protocol === "https:" && url.hostname.toLowerCase() === "pbs.twimg.com") {
      return `/api/social-media-proxy?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
}

function sampleLoadedImageColor(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      return null;
    }

    canvas.height = SAMPLE_CANVAS_SIZE;
    canvas.width = SAMPLE_CANVAS_SIZE;
    context.drawImage(image, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);

    return getSoftAverageColor(
      context.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE).data,
    );
  } catch {
    return null;
  }
}

function getSoftAverageColor(data: Uint8ClampedArray) {
  let b = 0;
  let count = 0;
  let g = 0;
  let r = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;

    if (alpha < 0.08) {
      continue;
    }

    r += data[index] * alpha;
    g += data[index + 1] * alpha;
    b += data[index + 2] * alpha;
    count += alpha;
  }

  if (count <= 0) {
    return null;
  }

  return `rgb(${softenColorChannel(r / count, MEDIA_BACKGROUND_SURFACE_RGB.r)}, ${softenColorChannel(
    g / count,
    MEDIA_BACKGROUND_SURFACE_RGB.g,
  )}, ${softenColorChannel(b / count, MEDIA_BACKGROUND_SURFACE_RGB.b)})`;
}

function softenColorChannel(value: number, surfaceValue: number) {
  return Math.round(value * 0.82 + surfaceValue * 0.18);
}

function getPlayableAttachmentVideoUrl(attachment: SocialPostAttachment) {
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

function getVideoPlaybackUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" && url.hostname.toLowerCase() === "video.twimg.com") {
      return `/api/social-media-proxy?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
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

function formatMediaKind(type: string) {
  if (type === "animated_gif") {
    return "GIF";
  }

  if (type === "video") {
    return "영상";
  }

  return "미디어";
}
