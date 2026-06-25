"use client";

import { useEffect } from "react";

export function ScrollToBottom({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let userMoved = false;
    const markUserMoved = () => {
      userMoved = true;
    };
    const scrollToBottom = () => {
      if (userMoved) {
        return;
      }

      window.scrollTo({
        behavior: "auto",
        left: 0,
        top: document.documentElement.scrollHeight,
      });
    };

    const previousScrollRestoration = window.history.scrollRestoration;
    const frames: number[] = [];

    window.history.scrollRestoration = "manual";

    frames.push(window.requestAnimationFrame(() => {
      scrollToBottom();
      frames.push(window.requestAnimationFrame(scrollToBottom));
    }));
    const timeouts = [
      window.setTimeout(scrollToBottom, 120),
      window.setTimeout(scrollToBottom, 420),
      window.setTimeout(scrollToBottom, 900),
    ];
    const observer = new ResizeObserver(scrollToBottom);

    observer.observe(document.body);
    window.addEventListener("wheel", markUserMoved, { passive: true });
    window.addEventListener("touchstart", markUserMoved, { passive: true });
    window.addEventListener("pointerdown", markUserMoved, { passive: true });
    window.addEventListener("keydown", markUserMoved);

    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      observer.disconnect();
      window.history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener("wheel", markUserMoved);
      window.removeEventListener("touchstart", markUserMoved);
      window.removeEventListener("pointerdown", markUserMoved);
      window.removeEventListener("keydown", markUserMoved);
    };
  }, [enabled]);

  return null;
}
