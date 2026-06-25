"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import type { SocialPostAttachment } from "@/lib/social/types";

const MEDIA_CLICK_CANCEL_THRESHOLD = 6;

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
  const media = attachments.slice(0, 4);
  const activeAttachment =
    activeIndex === null ? null : media[activeIndex] ?? null;
  const activeImageAttachment =
    activeAttachment && !getPlayableAttachmentVideoUrl(activeAttachment)
      ? activeAttachment
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

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    if (!activeImageAttachment) {
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
  }, [activeImageAttachment]);

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
    activeImageAttachment && typeof document !== "undefined"
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
              {/* eslint-disable-next-line @next/next/no-img-element -- remote X media domains are runtime data */}
              <img
                alt={activeImageAttachment.altText ?? ""}
                className="moong-media-lightbox-image"
                decoding="async"
                src={getAttachmentImageUrl(activeImageAttachment)}
              />
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
            media.length,
            Boolean(videoUrl),
          );

          if (videoUrl) {
            return (
              <div
                className="moong-media moong-media--video"
                key={key}
                style={style}
              >
                <video
                  className="moong-media-video"
                  controls
                  loop={attachment.type === "animated_gif"}
                  muted={attachment.type === "animated_gif"}
                  playsInline
                  poster={attachment.previewImageUrl ?? undefined}
                  preload="metadata"
                  src={videoUrl}
                >
                  <a href={videoUrl} rel="noopener noreferrer" target="_blank">
                    video
                  </a>
                </video>
                <span className="moong-media-kind">
                  {formatMediaKind(attachment.type)}
                </span>
              </div>
            );
          }

          return (
            <button
              aria-label="이미지 크게 보기"
              className="moong-media"
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
                loading="lazy"
                src={imageUrl}
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

function getMediaItemStyle(
  attachment: SocialPostAttachment,
  mediaCount: number,
  hasVideo: boolean,
): CSSProperties | undefined {
  if (mediaCount <= 1 && !hasVideo) {
    return undefined;
  }

  return getMediaAspectStyle(attachment);
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
