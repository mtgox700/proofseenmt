"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeLive, type LiveEvent } from "./live-stream";

const DELAY_MS = 800;

interface LiveRefreshProps {
  /** What the page shows: the inbox follows messages and reads, the notification centre its own counter. */
  readonly on?: "messages" | "notifications";
}

/**
 * Re-renders the current page from the server when what it shows changed, grouped over a short delay: the inbox
 * reorders itself and its unread markers follow, a new notification appears, without a reload. Renders nothing.
 */
export function LiveRefresh({ on = "messages" }: LiveRefreshProps) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastNotifications: number | null = null;
    const relevant = (event: LiveEvent): boolean => {
      if (on === "messages") return event.type !== "counts";
      if (event.type !== "counts") return event.type === "resync";
      const changed = lastNotifications !== null && lastNotifications !== event.notifications;
      lastNotifications = event.notifications;
      return changed;
    };
    const unsubscribe = subscribeLive((event) => {
      if (!relevant(event) || timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [router, on]);
  return null;
}
