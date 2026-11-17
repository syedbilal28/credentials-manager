"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Next.js keeps pages you navigate away from mounted but hidden (React
 * <Activity>), so their state survives. For secrets that is not wanted:
 * this runs `reset` when the component is hidden or unmounted, so revealed
 * values, pasted .env text or one-time passwords don't linger in the DOM.
 */
export function useResetOnHide(reset: () => void) {
  const latest = useRef(reset);
  useLayoutEffect(() => {
    latest.current = reset;
  });
  useLayoutEffect(() => () => latest.current(), []);
}
