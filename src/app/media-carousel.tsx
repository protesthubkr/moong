"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { SocialPostAttachment } from "@/lib/social/types";
import {
  BUBBLE_MAX_TEXT_RESERVE_PX,
  DESKTOP_BOTTOM_SAFE_AREA,
  MEDIA_CLICK_CANCEL_THRESHOLD,
  MEDIA_ROW_TOP_OFFSET,
  MIN_INLINE_MEDIA_HEIGHT,
  MOBILE_BOTTOM_SAFE_AREA,
  MOBILE_MEDIA_QUERY,
} from "./media-carousel/media-constants";
import {
  getMediaItemStyle,
  getMediaLayout,
  hasFramedMediaStyle,
  hasStableMediaSize,
  type MediaBounds,
} from "./media-carousel/media-layout";
import { MediaLightbox } from "./media-carousel/media-lightbox";
import { handleMediaImageLoad } from "./media-carousel/media-sampling";
import {
  formatMediaKind,
  getAttachmentImageUrl,
  getPlayableAttachmentVideoUrl,
  getVideoPlaybackUrl,
} from "./media-carousel/media-urls";
import { VideoMedia } from "./media-carousel/video-media";

const INITIAL_MEDIA_BOUNDS: MediaBounds = {
  inlineMaxHeight: 420,
  width: 0,
};

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
  const [mediaBounds, setMediaBounds] =
    useState<MediaBounds>(INITIAL_MEDIA_BOUNDS);
  const media = useMemo(() => attachments.slice(0, 4), [attachments]);
  const mediaLayout = useMemo(
    () => getMediaLayout(media, mediaBounds),
    [media, mediaBounds],
  );
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
      Math.min(
        window.visualViewport?.height ?? window.innerHeight,
        window.innerHeight,
      ),
    );
    const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    const availableViewportHeight =
      visualViewportHeight -
      MEDIA_ROW_TOP_OFFSET -
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

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
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
        closeLightbox();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeAttachment, closeLightbox]);

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

  const handleImageRef = useCallback((image: HTMLImageElement | null) => {
    if (!image || !image.complete || image.naturalWidth <= 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (image.isConnected) {
        handleMediaImageLoad(image);
      }
    });
  }, []);

  return (
    <div className="moong-media-carousel">
      <div
        className={`moong-media-strip moong-media-strip--${media.length}`}
        ref={viewportRef}
      >
        {media.map((attachment, index) => {
          const videoUrl = getPlayableAttachmentVideoUrl(attachment);
          const imageUrl = getAttachmentImageUrl(attachment);
          const style = getMediaItemStyle({
            attachment,
            hasVideo: Boolean(videoUrl),
            mediaBounds,
            mediaLayout,
          });
          const sizedClassName = hasStableMediaSize(style)
            ? " moong-media--sized"
            : "";
          const framedClassName = hasFramedMediaStyle(style)
            ? " moong-media--framed"
            : "";
          const key = `${attachment.mediaKey ?? imageUrl ?? videoUrl}-${index}`;

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
                  handleMediaImageLoad(event.currentTarget)
                }
                ref={handleImageRef}
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

      <MediaLightbox
        attachment={activeAttachment}
        onClose={closeLightbox}
        videoUrl={activeVideoUrl}
      />
    </div>
  );
}
