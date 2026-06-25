"use client";

import { useEffect } from "react";

const SCROLL_OFFSET = 64;
const STEP_LOCK_MS = 320;
const TOUCH_START_THRESHOLD = 7;
const TOUCH_STEP_THRESHOLD = 18;
const MAX_WHEEL_DELTA = 260;
const ROW_BOUNDARY_EPSILON = 2;

export function MessageStepScroll({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stepLockTimer = 0;
    let stepLocked = false;
    let touchGesture: {
      direction: -1 | 1 | null;
      lastY: number;
      stepped: boolean;
      x: number;
      y: number;
    } | null = null;

    const lockStep = () => {
      window.clearTimeout(stepLockTimer);
      stepLocked = true;
      stepLockTimer = window.setTimeout(() => {
        stepLocked = false;
        stepLockTimer = 0;
      }, STEP_LOCK_MS);
    };

    const scrollToRow = (row: HTMLElement, behavior: ScrollBehavior) => {
      const targetTop = Math.max(0, getRowDocumentTop(row) - SCROLL_OFFSET);

      if (Math.abs(window.scrollY - targetTop) < 2) {
        return;
      }

      window.scrollTo({
        behavior,
        left: 0,
        top: targetTop,
      });
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || shouldIgnoreTouchTarget(event.target)) {
        touchGesture = null;
        return;
      }

      const touch = event.touches[0];
      touchGesture = {
        direction: null,
        lastY: touch.clientY,
        stepped: false,
        x: touch.clientX,
        y: touch.clientY,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchGesture || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const totalX = touchGesture.x - touch.clientX;
      const totalY = touchGesture.y - touch.clientY;

      if (
        Math.abs(totalY) < TOUCH_START_THRESHOLD ||
        Math.abs(totalY) < Math.abs(totalX)
      ) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const deltaY = touchGesture.lastY - touch.clientY;
      const direction = totalY > 0 ? 1 : -1;
      const rows = getMessageRows();

      touchGesture.lastY = touch.clientY;

      if (rows.length === 0) {
        return;
      }

      if (touchGesture.direction !== direction) {
        touchGesture.direction = direction;
        touchGesture.stepped = false;
      }

      if (stepLocked || touchGesture.stepped) {
        return;
      }

      const activeRow = getContainingRow(rows);

      if (!activeRow) {
        if (Math.abs(totalY) < TOUCH_STEP_THRESHOLD) {
          return;
        }

        const target = getGapStepTargetRow(rows, direction);

        if (target) {
          touchGesture.stepped = true;
          lockStep();
          scrollToRow(target, getSnapBehavior());
        }

        return;
      }

      const bounds = getRowScrollBounds(activeRow);

      if (canScrollWithinRow(bounds, direction)) {
        scrollWithinRow(bounds, deltaY);
        return;
      }

      if (Math.abs(totalY) < TOUCH_STEP_THRESHOLD) {
        return;
      }

      const target = getAdjacentRow(rows, activeRow, direction);

      if (!target) {
        return;
      }

      touchGesture.stepped = true;
      lockStep();
      scrollToRow(target, getSnapBehavior());
    };

    const handleTouchEnd = () => {
      touchGesture = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKey(event)) {
        return;
      }

      const direction = getKeyDirection(event);
      if (!direction) {
        return;
      }

      const target = getTargetRow(getMessageRows(), direction);
      if (!target) {
        return;
      }

      event.preventDefault();
      scrollToRow(target, getSnapBehavior());
    };

    document.documentElement.dataset.moongStepScroll = "ready";
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
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      delete document.documentElement.dataset.moongStepScroll;
      window.clearTimeout(stepLockTimer);
      window.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
      window.removeEventListener("touchend", handleTouchEnd, true);
      window.removeEventListener("touchcancel", handleTouchEnd, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled]);

  return null;
}

function getMessageRows() {
  return Array.from(document.querySelectorAll<HTMLElement>(".moong-row")).sort(
    (a, b) => getRowDocumentTop(a) - getRowDocumentTop(b),
  );
}

function getContainingRow(rows: HTMLElement[]) {
  if (rows.length === 0) {
    return null;
  }

  const anchorTop = window.scrollY + SCROLL_OFFSET + 1;
  return (
    rows.find(
      (row) =>
        getRowDocumentTop(row) <= anchorTop &&
        getRowDocumentBottom(row) > anchorTop,
    ) ?? null
  );
}

function getGapStepTargetRow(rows: HTMLElement[], direction: -1 | 1) {
  const anchorTop = window.scrollY + SCROLL_OFFSET + 1;

  if (direction > 0) {
    return (
      rows.find(
        (row) => getRowDocumentTop(row) >= anchorTop - ROW_BOUNDARY_EPSILON,
      ) ?? null
    );
  }

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (getRowDocumentBottom(rows[index]) <= anchorTop + ROW_BOUNDARY_EPSILON) {
      return rows[index];
    }
  }

  return null;
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

function getAdjacentRow(
  rows: HTMLElement[],
  activeRow: HTMLElement,
  direction: -1 | 1,
) {
  const activeIndex = rows.indexOf(activeRow);

  if (activeIndex < 0) {
    return null;
  }

  return rows[activeIndex + direction] ?? null;
}

function getRowScrollBounds(row: HTMLElement) {
  const rowTop = getRowDocumentTop(row);
  const rowBottom = getRowDocumentBottom(row);
  const start = Math.max(0, rowTop - SCROLL_OFFSET);
  const end = Math.max(start, rowBottom - window.innerHeight);

  return { end, start };
}

function canScrollWithinRow(
  bounds: { end: number; start: number },
  direction: -1 | 1,
) {
  if (bounds.end - bounds.start <= ROW_BOUNDARY_EPSILON) {
    return false;
  }

  if (direction > 0) {
    return window.scrollY < bounds.end - ROW_BOUNDARY_EPSILON;
  }

  return window.scrollY > bounds.start + ROW_BOUNDARY_EPSILON;
}

function scrollWithinRow(bounds: { end: number; start: number }, deltaY: number) {
  const targetTop = clamp(
    window.scrollY + clamp(deltaY, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA),
    bounds.start,
    bounds.end,
  );

  if (Math.abs(window.scrollY - targetTop) < 1) {
    return;
  }

  window.scrollTo({
    behavior: "auto",
    left: 0,
    top: targetTop,
  });
}

function getRowDocumentTop(row: HTMLElement) {
  return row.getBoundingClientRect().top + window.scrollY;
}

function getRowDocumentBottom(row: HTMLElement) {
  return getRowDocumentTop(row) + row.getBoundingClientRect().height;
}

function getSnapBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function shouldIgnoreKey(event: KeyboardEvent) {
  return (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    shouldIgnoreTarget(event.target)
  );
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

function shouldIgnoreTouchTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        ".moong-media-lightbox",
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
