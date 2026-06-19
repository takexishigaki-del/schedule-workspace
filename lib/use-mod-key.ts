"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns "⌘" on macOS and "Ctrl" on Windows/Linux.
 * Uses useSyncExternalStore for proper SSR/hydration safety.
 */
const subscribe = () => () => {};

function getSnapshot(): "⌘" | "Ctrl" {
  return /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent) ||
    navigator.platform.toUpperCase().startsWith("MAC")
    ? "⌘"
    : "Ctrl";
}

function getServerSnapshot(): "⌘" | "Ctrl" {
  return "Ctrl";
}

export function useModKey(): "⌘" | "Ctrl" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
