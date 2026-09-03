"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";

/**
 * A number that eases to its target instead of jumping.
 *
 * The pot climbs on every hit, and a figure that snaps between two values
 * reads as a page refreshing rather than as money arriving. Easing it over a
 * few hundred milliseconds is the difference between a readout and a meter.
 * The DOM text is written directly from the animation loop — putting it in
 * state would re-render the surrounding panel sixty times a second for a
 * number that changes twice.
 */
export function Rolling({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  const target = useRef(value);
  const [initial] = useState(() => format(value));

  // Written from an effect rather than during render: the loop only needs the
  // newest target by the next frame, and a ref assignment in a render body is
  // a tearing hazard under concurrent rendering.
  useEffect(() => {
    target.current = value;
  }, [value]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const gap = target.current - current.current;
      if (Math.abs(gap) < 0.005) {
        current.current = target.current;
      } else {
        current.current += gap * Math.min(1, dt * 6);
      }
      if (ref.current) ref.current.textContent = format(current.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [format]);

  // The server renders the exact starting value, so there is nothing to
  // reconcile on hydration; the loop takes over on the first client frame.
  return (
    <span ref={ref} className={className}>
      {initial}
    </span>
  );
}

/** A labelled figure. The unit is part of the label, never the number. */
export function Stat({
  label,
  children,
  hint,
  className,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-1",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      <span className="type-label text-bone-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">{children}</span>
      {hint && <span className="type-data text-bone-muted">{hint}</span>}
    </div>
  );
}
