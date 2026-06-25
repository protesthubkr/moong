"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_BATCH_SIZE = 20;
const LOAD_MORE_BUSY_MS = 1400;

type AnchorSnapshot = {
  id: string;
  top: number;
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
  const loadingTimerRef = useRef(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isScrollRestoring, setIsScrollRestoring] = useState(false);
  const [isAnchorHeld, setIsAnchorHeld] = useState(false);
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
  const isLoading = isLoadingMore || isScrollRestoring;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }

    window.clearTimeout(loadingTimerRef.current);
    anchorRef.current = captureAnchor(rootRef.current);
    setIsLoadingMore(true);
    setIsScrollRestoring(true);
    setIsAnchorHeld(true);
    setVisibleCount((current) => Math.min(totalCount, current + batchSize));
    loadingTimerRef.current = window.setTimeout(() => {
      setIsLoadingMore(false);
    }, LOAD_MORE_BUSY_MS);
  }, [batchSize, hasMore, isLoading, totalCount]);

  useEffect(
    () => () => {
      window.clearTimeout(loadingTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isAnchorHeld || isScrollRestoring) {
      return;
    }

    const releaseAnchor = () => {
      anchorRef.current = null;
      setIsAnchorHeld(false);
    };

    window.addEventListener("wheel", releaseAnchor, { passive: true });
    window.addEventListener("touchstart", releaseAnchor, {
      passive: true,
    });
    window.addEventListener("keydown", releaseAnchor);

    return () => {
      window.removeEventListener("wheel", releaseAnchor);
      window.removeEventListener("touchstart", releaseAnchor);
      window.removeEventListener("keydown", releaseAnchor);
    };
  }, [isAnchorHeld, isScrollRestoring]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      setIsScrollRestoring(false);
      setIsAnchorHeld(false);
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
      window.setTimeout(() => {
        restore();
        setIsScrollRestoring(false);
      }, 420),
      window.setTimeout(restore, 620),
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

  return (
    <div className="moong-feed-window" ref={rootRef}>
      {hasMore ? (
        <div className="moong-pull-loader">
          <button
            aria-label={`이전 ${nextBatchCount}개 불러오기, ${remainingCount}개 남음`}
            className={`moong-pull-button is-${
              isLoading ? "loading" : "ready"
            }`}
            disabled={isLoading}
            onClick={loadMore}
            type="button"
          >
            <span className="moong-pull-text">
              {isLoading ? "로딩 중" : "더보기"}
            </span>
          </button>
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
