"use client";

import { useEffect, useRef, useState } from "react";

const MAX_LINES = 10;

export function ClampedText({
  className,
  text,
}: {
  className: string;
  text: string;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const node = textRef.current;

    if (!node) {
      return;
    }

    let active = true;
    let frame = 0;
    const measure = () => {
      if (!active) {
        return;
      }

      const style = window.getComputedStyle(node);
      const configuredMaxHeight = Number.parseFloat(
        style.getPropertyValue("--moong-text-max-height"),
      );
      const lineHeight = Number.parseFloat(style.lineHeight);
      const maxHeight = Number.isFinite(configuredMaxHeight)
        ? configuredMaxHeight
        : lineHeight * MAX_LINES;

      setIsOverflowing(node.scrollHeight > maxHeight + 1);
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);

    scheduleMeasure();
    resizeObserver.observe(node);

    if (document.fonts) {
      void document.fonts.ready.then(scheduleMeasure);
    }

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [text]);

  return (
    <span
      className={`${className} moong-clamped-text${
        isOverflowing ? " moong-clamped-text--overflow" : ""
      }`}
      ref={textRef}
    >
      {text}
      <span aria-hidden="true" className="moong-clamped-text-fade" />
    </span>
  );
}
