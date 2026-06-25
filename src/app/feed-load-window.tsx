"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

const DEFAULT_BATCH_SIZE = 20;
const PULL_LOAD_THRESHOLD = 72;
const PULL_DAMPING = 0.55;
const SCROLL_OFFSET = 64;

type AnchorSnapshot = {
  id: string;
  top: number;
};

type PointerSnapshot = {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
};

export function FeedLoadWindow({
  batchSize = DEFAULT_BATCH_SIZE,
  children,
}: {
  batchSize?: number;
  children: ReactNode;
}) {
  const allChildren = useMemo(() => Children.toArray(children), [children]);
  const totalCount = allChildren.length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<AnchorSnapshot | null>(null);
  const pointerRef = useRef<PointerSnapshot>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
  });
  const [isScrollRestoring, setIsScrollRestoring] = useState(false);
  const [isSnapSuppressed, setIsSnapSuppressed] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(batchSize, totalCount),
  );

  const boundedVisibleCount = Math.min(
    Math.max(visibleCount, Math.min(batchSize, totalCount)),
    totalCount,
  );
  const visibleStart = Math.max(0, totalCount - boundedVisibleCount);
  const visibleChildren = useMemo(
    () => allChildren.slice(visibleStart),
    [allChildren, visibleStart],
  );
  const remainingCount = visibleStart;
  const hasMore = remainingCount > 0;
  const nextBatchCount = Math.min(batchSize, remainingCount);
  const pullProgress = Math.min(pullDistance / PULL_LOAD_THRESHOLD, 1);
  const isPullReady = pullDistance >= PULL_LOAD_THRESHOLD;
  const pullState =
    isScrollRestoring
      ? "loading"
      : isPullReady
        ? "ready"
        : pullDistance > 0
          ? "pulling"
          : "idle";

  const loadMore = useCallback(() => {
    if (!hasMore || isScrollRestoring) {
      return;
    }

    anchorRef.current = captureAnchor(rootRef.current);
    setIsScrollRestoring(true);
    setIsSnapSuppressed(true);
    setVisibleCount((current) => Math.min(totalCount, current + batchSize));
  }, [batchSize, hasMore, isScrollRestoring, totalCount]);

  useEffect(() => {
    if (!isSnapSuppressed || isScrollRestoring) {
      return;
    }

    const releaseSnapSuppression = () => {
      anchorRef.current = null;
      setIsSnapSuppressed(false);
    };

    window.addEventListener("wheel", releaseSnapSuppression, { passive: true });
    window.addEventListener("touchstart", releaseSnapSuppression, {
      passive: true,
    });
    window.addEventListener("keydown", releaseSnapSuppression);

    return () => {
      window.removeEventListener("wheel", releaseSnapSuppression);
      window.removeEventListener("touchstart", releaseSnapSuppression);
      window.removeEventListener("keydown", releaseSnapSuppression);
    };
  }, [isScrollRestoring, isSnapSuppressed]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      setIsScrollRestoring(false);
      setIsSnapSuppressed(false);
      return;
    }

    const restore = () => {
      if (anchorRef.current !== anchor) {
        return;
      }

      restoreAnchorPosition(rootRef.current, anchor);
    };
    const root = rootRef.current;
    const observer = new ResizeObserver(restore);
    const frame = window.requestAnimationFrame(restore);
    const timers = [
      window.setTimeout(restore, 40),
      window.setTimeout(restore, 120),
      window.setTimeout(restore, 260),
      window.setTimeout(restore, 520),
      window.setTimeout(() => {
        restore();
        setIsScrollRestoring(false);
      }, 620),
      window.setTimeout(restore, 820),
      window.setTimeout(restore, 1120),
      window.setTimeout(restore, 1420),
      window.setTimeout(restore, 1900),
    ];

    if (root) {
      observer.observe(root);
    }

    restore();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [visibleStart]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        isPullControlTarget(event.target) ||
        !event.isPrimary ||
        !hasMore ||
        !isAtFeedBoundary(rootRef.current)
      ) {
        pointerRef.current.active = false;
        return;
      }

      pointerRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [hasMore],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        !pointerRef.current.active ||
        pointerRef.current.pointerId !== event.pointerId
      ) {
        return;
      }

      const deltaX = event.clientX - pointerRef.current.startX;
      const deltaY = event.clientY - pointerRef.current.startY;

      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        setPullDistance(0);
        return;
      }

      setPullDistance(deltaY * PULL_DAMPING);
    },
    [],
  );

  const handlePointerEnd = useCallback(() => {
    const shouldLoad = isPullReady;

    pointerRef.current.active = false;
    pointerRef.current.pointerId = -1;
    setPullDistance(0);

    if (shouldLoad) {
      loadMore();
    }
  }, [isPullReady, loadMore]);

  return (
    <div
      className="moong-feed-window"
      data-pull-state={pullState}
      data-scroll-restoring={isSnapSuppressed ? "true" : undefined}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={rootRef}
      style={
        {
          "--moong-pull-distance": `${pullDistance}px`,
          "--moong-pull-progress": Math.max(
            pullProgress,
            isScrollRestoring ? 1 : 0,
          ),
        } as CSSProperties
      }
    >
      {hasMore && pullDistance > 0 ? (
        <div
          aria-label={getPullStatusText({
            isLoading: isScrollRestoring,
            isReady: isPullReady,
          })}
          aria-live="polite"
          className={`moong-pull-indicator is-${pullState}`}
        >
          <span aria-hidden="true" className="moong-pull-mark">
            <span className="moong-pull-arrow">↓</span>
          </span>
          <span className="moong-pull-text">
            {getPullStatusText({
              isLoading: isScrollRestoring,
              isReady: isPullReady,
            })}
          </span>
        </div>
      ) : null}

      {hasMore ? (
        <div className="moong-pull-loader">
          <button
            aria-label={`이전 ${nextBatchCount}개 불러오기, ${remainingCount}개 남음`}
            className={`moong-pull-button is-${isScrollRestoring ? "loading" : "ready"}`}
            disabled={isScrollRestoring}
            onClick={loadMore}
            type="button"
          >
            <span aria-hidden="true" className="moong-pull-mark">
              <span className="moong-pull-arrow">↓</span>
            </span>
            <span className="moong-pull-text">
              {isScrollRestoring ? "불러오는 중" : "더보기"}
            </span>
          </button>
        </div>
      ) : totalCount > batchSize ? (
        <div aria-hidden="true" className="moong-pull-loader moong-pull-loader--done">
          <span className="moong-pull-loader-done">처음까지 왔어요</span>
        </div>
      ) : null}

      <ol
        className="moong-feed"
        data-total-count={totalCount}
        data-visible-count={visibleChildren.length}
      >
        {visibleChildren}
      </ol>
    </div>
  );
}

function getPullStatusText({
  isLoading,
  isReady,
}: {
  isLoading: boolean;
  isReady: boolean;
}) {
  if (isLoading) {
    return "불러오는 중";
  }

  if (isReady) {
    return "놓으면 더보기";
  }

  return "더보기";
}

function captureAnchor(root: HTMLDivElement | null): AnchorSnapshot | null {
  const firstItem = root?.querySelector<HTMLElement>(".moong-feed-item");
  const id = firstItem?.dataset.feedItemId;

  if (!firstItem || !id) {
    return null;
  }

  return {
    id,
    top: firstItem.getBoundingClientRect().top,
  };
}

function restoreAnchorPosition(
  root: HTMLDivElement | null,
  anchor: AnchorSnapshot,
) {
  const anchoredItem = Array.from(
    root?.querySelectorAll<HTMLElement>(".moong-feed-item") ?? [],
  ).find((item) => item.dataset.feedItemId === anchor.id);

  if (!anchoredItem) {
    return;
  }

  const scrollCorrection = anchoredItem.getBoundingClientRect().top - anchor.top;

  if (Math.abs(scrollCorrection) < 1) {
    return;
  }

  window.scrollTo({
    behavior: "auto",
    left: 0,
    top: Math.max(0, window.scrollY + scrollCorrection),
  });
}

function isAtFeedBoundary(root: HTMLDivElement | null) {
  const firstItem = root?.querySelector<HTMLElement>(".moong-feed-item");

  if (!firstItem) {
    return false;
  }

  const firstItemTop = firstItem.getBoundingClientRect().top + window.scrollY;
  const boundaryTop = Math.max(0, firstItemTop - SCROLL_OFFSET);

  return window.scrollY <= boundaryTop + 4;
}

function isPullControlTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(".moong-pull-button");
}
