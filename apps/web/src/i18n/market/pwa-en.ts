import type { PwaDictionary } from "./pwa-fr";

/** Installable app and push notifications (C20): manifest, offline page, per-device setting. */
export const pwaEn: PwaDictionary = {
  manifest: {
    description: "Proofseen missions, messages and applications, on your phone.",
    shortcuts: { messages: "Messages", missions: "Missions", notifications: "Notifications" },
  },
  offline: {
    title: "Offline",
    lead: "Proofseen cannot be reached: check your connection. Nothing you sent is lost, and the page reloads as soon as the network is back.",
    retry: "Try again",
  },
  push: {
    title: "Notifications on this device",
    lead: "An alert on this phone or computer when a company writes to you, an application moves forward or a contract changes. The alert says what happened, never the content of a message.",
    toggle: "Receive notifications on this device",
    on: "This device receives notifications.",
    off: "This device does not receive notifications.",
    enable: "Turn on for this device",
    disable: "Turn off for this device",
    working: "One moment…",
    unsupported: "This browser cannot receive Proofseen notifications.",
    iosHint: "On iPhone and iPad: first add Proofseen to your Home Screen (Share, then “Add to Home Screen”), open it from the icon, then come back here.",
    denied: "Notifications are blocked for Proofseen in this browser. Allow them in the site settings, then try again.",
    failed: "That did not work. Try again in a moment.",
    tooMany: "Too many requests in a row. Try again in a minute.",
    suspended: "Your account is suspended: no notifications are sent.",
  },
  devices: (n: number): string => (n === 0 ? "No device receives your account's notifications." : `${n} device${n > 1 ? "s receive" : " receives"} your account's notifications.`),
  install: "To install Proofseen: open the browser menu, then “Install app” or “Add to Home Screen”.",
};
