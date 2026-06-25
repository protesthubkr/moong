"use client";

import { createPortal } from "react-dom";
import type { SocialPostAttachment } from "@/lib/social/types";
import { getAttachmentImageUrl, getVideoPlaybackUrl } from "./media-urls";

export function MediaLightbox({
  attachment,
  onClose,
  videoUrl,
}: {
  attachment: SocialPostAttachment | null;
  onClose: () => void;
  videoUrl: string | null;
}) {
  if (!attachment || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-label="이미지 크게 보기"
      aria-modal="true"
      className="moong-media-lightbox"
      onClick={onClose}
      role="dialog"
    >
      <button
        aria-label="닫기"
        className="moong-media-lightbox-close"
        onClick={onClose}
        type="button"
      />
      <div
        className="moong-media-lightbox-frame"
        onClick={(event) => event.stopPropagation()}
      >
        {videoUrl ? (
          <video
            autoPlay
            className="moong-media-lightbox-video"
            controls
            height={attachment.height ?? undefined}
            loop={attachment.type === "animated_gif"}
            muted={attachment.type === "animated_gif"}
            playsInline
            poster={attachment.previewImageUrl ?? undefined}
            preload="metadata"
            width={attachment.width ?? undefined}
          >
            <source src={getVideoPlaybackUrl(videoUrl)} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- remote X media domains are runtime data
          <img
            alt={attachment.altText ?? ""}
            className="moong-media-lightbox-image"
            decoding="async"
            height={attachment.height ?? undefined}
            src={getAttachmentImageUrl(attachment)}
            width={attachment.width ?? undefined}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
