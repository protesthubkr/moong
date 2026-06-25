"use client";

import { useEffect } from "react";

const SCROLL_OFFSET = 64;
const BOUNDARY_PADDING = 18;
const TOUCH_STEP_THRESHOLD = 4;
const WHEEL_STEP_THRESHOLD = 2;
const WHEEL_STEP_COOLDOWN_MS = 520;
const WHEEL_RESET_MS = 180;
const LOCK_FALLBACK_MS = 420;
const SCROLL_ANIMATION_MS = 240;

type ScrollSource = "key" | "touch" | "wheel";

export function MessageStepScroll({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let locked = false;
    let lockedDirection: -1 | 1 | null = null;
    let animationFrame = 0;
    let lockTimer = 0;
    let wheelDelta = 0;
    let wheelGestureAnchorIndex: number | null = null;
    let wheelGestureDirection: -1 | 1 | null = null;
    let wheelGestureLastAt = 0;
    let wheelStepCooldownDirection: -1 | 1 | null = null;
    let wheelStepCooldownUntil = 0;
    let wheelTimer = 0;
    let pointerStart: {
      handled: boolean;
      id: number;
      x: number;
      y: number;
    } | null = null;
    let touchStart: {
      handled: boolean;
      x: number;
      y: number;
    } | null = null;

    const unlockSoon = () => {
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        unlockNow();
      }, LOCK_FALLBACK_MS);
    };

    const unlockNow = () => {
      window.clearTimeout(lockTimer);
      locked = false;
      lockedDirection = null;
    };

    const cancelLockedScroll = () => {
      window.cancelAnimationFrame(animationFrame);
      unlockNow();
    };

    const settleAnimation = () => {
      unlockNow();
    };

    const scrollOneStep = (
      direction: -1 | 1,
      source: ScrollSource,
      targetRow?: HTMLElement | null,
    ) => {
      const target = targetRow ?? getTargetRow(getMessageRows(), direction);

      if (!target) {
        return false;
      }

      locked = true;
      lockedDirection = direction;
      if (source === "wheel") {
        wheelStepCooldownDirection = direction;
        wheelStepCooldownUntil =
          window.performance.now() + WHEEL_STEP_COOLDOWN_MS;
      }
      animateScrollTo(Math.max(0, getRowDocumentTop(target) - SCROLL_OFFSET));
      unlockSoon();

      return true;
    };

    const rememberWheelGestureAnchor = (
      direction: -1 | 1,
      rows: HTMLElement[],
    ) => {
      const now = window.performance.now();

      if (
        wheelGestureAnchorIndex === null ||
        wheelGestureDirection !== direction ||
        now - wheelGestureLastAt > WHEEL_RESET_MS
      ) {
        const activeRow = getActiveRow(rows);
        wheelGestureAnchorIndex = activeRow ? rows.indexOf(activeRow) : null;
        wheelGestureDirection = direction;
      }

      wheelGestureLastAt = now;
    };

    const scrollWheelStep = (direction: -1 | 1) => {
      const rows = getMessageRows();
      const anchorIndex =
        wheelGestureAnchorIndex ?? rows.indexOf(getActiveRow(rows) ?? rows[0]);
      const targetIndex = anchorIndex + direction;
      const target = rows[targetIndex] ?? null;

      if (!target) {
        return false;
      }

      const scrolled = scrollOneStep(direction, "wheel", target);
      if (scrolled) {
        wheelGestureAnchorIndex = targetIndex;
        wheelGestureDirection = direction;
        wheelGestureLastAt = window.performance.now();
      }

      return scrolled;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || shouldIgnoreWheel(event)) {
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;

      if (locked) {
        if (direction === lockedDirection) {
          event.preventDefault();
          wheelDelta = 0;
          return;
        }

        cancelLockedScroll();
      }

      if (
        direction === wheelStepCooldownDirection &&
        window.performance.now() < wheelStepCooldownUntil
      ) {
        event.preventDefault();
        wheelDelta = 0;
        return;
      }

      rememberWheelGestureAnchor(direction, getMessageRows());
      wheelDelta += event.deltaY;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelDelta = 0;
        wheelGestureAnchorIndex = null;
        wheelGestureDirection = null;
      }, WHEEL_RESET_MS);

      if (Math.abs(wheelDelta) < WHEEL_STEP_THRESHOLD) {
        return;
      }

      const stepDirection = wheelDelta > 0 ? 1 : -1;
      if (!shouldSnapAtBoundary(stepDirection)) {
        return;
      }

      event.preventDefault();
      wheelDelta = 0;
      scrollWheelStep(stepDirection);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        (event.pointerType !== "touch" && event.pointerType !== "pen") ||
        shouldIgnoreTarget(event.target)
      ) {
        pointerStart = null;
        return;
      }

      pointerStart = {
        handled: false,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerStart || event.pointerId !== pointerStart.id) {
        return;
      }

      handleGestureMove({
        currentX: event.clientX,
        currentY: event.clientY,
        cancelLockedScroll,
        getHandled: () => pointerStart?.handled ?? false,
        getLockedDirection: () => lockedDirection,
        isLocked: () => locked,
        preventDefault: () => event.preventDefault(),
        scrollOneStep: (direction) => scrollOneStep(direction, "touch"),
        setHandled: (handled) => {
          if (pointerStart) {
            pointerStart.handled = handled;
          }
        },
        startX: pointerStart.x,
        startY: pointerStart.y,
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (pointerStart?.id === event.pointerId) {
        pointerStart = null;
      }

      if (locked) {
        unlockSoon();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || shouldIgnoreTarget(event.target)) {
        touchStart = null;
        return;
      }

      const touch = event.touches[0];
      touchStart = {
        handled: false,
        x: touch.clientX,
        y: touch.clientY,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchStart || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      handleGestureMove({
        currentX: touch.clientX,
        currentY: touch.clientY,
        cancelLockedScroll,
        getHandled: () => touchStart?.handled ?? false,
        getLockedDirection: () => lockedDirection,
        isLocked: () => locked,
        preventDefault: () => event.preventDefault(),
        scrollOneStep: (direction) => scrollOneStep(direction, "touch"),
        setHandled: (handled) => {
          if (touchStart) {
            touchStart.handled = handled;
          }
        },
        startX: touchStart.x,
        startY: touchStart.y,
      });
    };

    const handleTouchEnd = () => {
      touchStart = null;

      if (locked) {
        unlockSoon();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKey(event)) {
        return;
      }

      const direction = getKeyDirection(event);
      if (!direction) {
        return;
      }

      if (scrollOneStep(direction, "key")) {
        event.preventDefault();
      }
    };

    document.documentElement.dataset.moongStepScroll = "ready";
    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    const usePointerGestures = "PointerEvent" in window;

    if (usePointerGestures) {
      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("pointermove", handlePointerMove, {
        capture: true,
        passive: false,
      });
      window.addEventListener("pointerup", handlePointerEnd, true);
      window.addEventListener("pointercancel", handlePointerEnd, true);
    } else {
      window.addEventListener("touchstart", handleTouchStart, {
        capture: true,
        passive: true,
      });
      window.addEventListener("touchmove", handleTouchMove, {
        capture: true,
        passive: false,
      });
      window.addEventListener("touchend", handleTouchEnd, true);
      window.addEventListener("touchcancel", handleTouchEnd, true);
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      delete document.documentElement.dataset.moongStepScroll;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(lockTimer);
      window.clearTimeout(wheelTimer);
      window.removeEventListener("wheel", handleWheel, true);

      if (usePointerGestures) {
        window.removeEventListener("pointerdown", handlePointerDown, true);
        window.removeEventListener("pointermove", handlePointerMove, true);
        window.removeEventListener("pointerup", handlePointerEnd, true);
        window.removeEventListener("pointercancel", handlePointerEnd, true);
      } else {
        window.removeEventListener("touchstart", handleTouchStart, true);
        window.removeEventListener("touchmove", handleTouchMove, true);
        window.removeEventListener("touchend", handleTouchEnd, true);
        window.removeEventListener("touchcancel", handleTouchEnd, true);
      }

      window.removeEventListener("keydown", handleKeyDown, true);
    };
    function animateScrollTo(targetTop: number) {
      window.cancelAnimationFrame(animationFrame);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo({ left: 0, top: targetTop });
        settleAnimation();
        return;
      }

      const startTop = window.scrollY;
      const distance = targetTop - startTop;
      const startAt = window.performance.now();

      if (Math.abs(distance) < 2) {
        window.scrollTo({ left: 0, top: targetTop });
        settleAnimation();
        return;
      }

      const tick = (now: number) => {
        const progress = Math.min((now - startAt) / SCROLL_ANIMATION_MS, 1);
        const eased = 1 - (1 - progress) ** 3;

        window.scrollTo({
          left: 0,
          top: startTop + distance * eased,
        });

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(tick);
          return;
        }

        settleAnimation();
      };

      animationFrame = window.requestAnimationFrame(tick);
    }
  }, [enabled]);

  return null;
}

function getMessageRows() {
  return Array.from(document.querySelectorAll<HTMLElement>(".moong-row")).sort(
    (a, b) => getRowDocumentTop(a) - getRowDocumentTop(b),
  );
}

function getTargetRow(rows: HTMLElement[], direction: -1 | 1) {
  if (rows.length === 0) {
    return null;
  }

  const currentTop = window.scrollY + SCROLL_OFFSET;

  if (direction > 0) {
    return (
      rows.find((row) => getRowDocumentTop(row) > currentTop + 4) ??
      rows[rows.length - 1]
    );
  }

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (getRowDocumentTop(rows[index]) < currentTop - 4) {
      return rows[index];
    }
  }

  return rows[0];
}

function handleGestureMove({
  currentX,
  currentY,
  cancelLockedScroll,
  getHandled,
  getLockedDirection,
  isLocked,
  preventDefault,
  scrollOneStep,
  setHandled,
  startX,
  startY,
}: {
  currentX: number;
  currentY: number;
  cancelLockedScroll: () => void;
  getHandled: () => boolean;
  getLockedDirection: () => -1 | 1 | null;
  isLocked: () => boolean;
  preventDefault: () => void;
  scrollOneStep: (direction: -1 | 1) => boolean;
  setHandled: (handled: boolean) => void;
  startX: number;
  startY: number;
}) {
  const deltaX = startX - currentX;
  const deltaY = startY - currentY;

  if (Math.abs(deltaY) < Math.abs(deltaX)) {
    return;
  }

  if (Math.abs(deltaY) < TOUCH_STEP_THRESHOLD) {
    return;
  }

  const direction = deltaY > 0 ? 1 : -1;
  if (isLocked()) {
    if (getLockedDirection() === direction) {
      preventDefault();
      return;
    }

    cancelLockedScroll();
  }

  if (!shouldSnapAtBoundary(direction)) {
    return;
  }

  preventDefault();

  if (getHandled()) {
    return;
  }

  setHandled(scrollOneStep(direction));
}

function getRowDocumentTop(row: HTMLElement) {
  return row.getBoundingClientRect().top + window.scrollY;
}

function getRowDocumentBottom(row: HTMLElement) {
  return getRowDocumentTop(row) + row.getBoundingClientRect().height;
}

function shouldSnapAtBoundary(direction: -1 | 1) {
  const rows = getMessageRows();
  const activeRow = getActiveRow(rows);

  if (!activeRow) {
    return false;
  }

  const activeIndex = rows.indexOf(activeRow);
  const viewportBottom = window.scrollY + window.innerHeight;
  const anchorTop = window.scrollY + SCROLL_OFFSET;
  const rowTop = getRowDocumentTop(activeRow);
  const rowBottom = getRowDocumentBottom(activeRow);

  if (direction > 0) {
    if (activeIndex >= rows.length - 1) {
      return false;
    }

    return rowBottom <= viewportBottom + BOUNDARY_PADDING;
  }

  if (activeIndex <= 0) {
    return false;
  }

  return rowTop >= anchorTop - BOUNDARY_PADDING;
}

function getActiveRow(rows: HTMLElement[]) {
  const anchorTop = window.scrollY + SCROLL_OFFSET;
  const containingRow = rows.find(
    (row) =>
      getRowDocumentTop(row) <= anchorTop + BOUNDARY_PADDING &&
      getRowDocumentBottom(row) > anchorTop + BOUNDARY_PADDING,
  );

  if (containingRow) {
    return containingRow;
  }

  return (
    rows.find((row) => getRowDocumentTop(row) > anchorTop) ??
    rows[rows.length - 1] ??
    null
  );
}

function shouldIgnoreWheel(event: WheelEvent) {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    Math.abs(event.deltaY) < Math.abs(event.deltaX)
  ) {
    return true;
  }

  return shouldIgnoreTarget(event.target);
}

function shouldIgnoreKey(event: KeyboardEvent) {
  return event.altKey || event.ctrlKey || event.metaKey || shouldIgnoreTarget(event.target);
}

function shouldIgnoreTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        ".moong-media-lightbox",
        ".moong-media-arrow",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
      ].join(","),
    ),
  );
}

function getKeyDirection(event: KeyboardEvent): -1 | 1 | null {
  if (event.key === "ArrowDown" || event.key === "PageDown") {
    return 1;
  }

  if (event.key === "ArrowUp" || event.key === "PageUp") {
    return -1;
  }

  if (event.key === " " || event.key === "Spacebar") {
    return event.shiftKey ? -1 : 1;
  }

  return null;
}
