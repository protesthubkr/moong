"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { SocialPostAttachment } from "@/lib/social/types";
import { MOBILE_MEDIA_QUERY } from "./media-constants";
import { hasStableMediaSize } from "./media-layout";

export function VideoMedia({
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
        setPlayErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
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
          onClick={handleFullscreenClick}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function isMobileMediaViewport() {
  return (
    window.matchMedia(MOBILE_MEDIA_QUERY).matches || window.innerWidth <= 760
  );
}
