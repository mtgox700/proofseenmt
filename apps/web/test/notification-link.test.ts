import { describe, expect, it } from "vitest";
import { liveEn } from "../src/i18n/market/live-en";
import { liveFr } from "../src/i18n/market/live-fr";
import { notificationHref, notificationText } from "../src/lib/notification-link";

const ID = "0198f0aa-1234-7abc-8def-0123456789ab";

describe("in-app notification links", () => {
  it("leads to the thread, the mission or the contract named in the payload", () => {
    expect(notificationHref("fr", { kind: "message_received", payload: { conversationId: ID } })).toBe(`/fr/app/messages/${ID}`);
    expect(notificationHref("en", { kind: "mission_invitation", payload: { missionId: ID } })).toBe(`/en/missions/${ID}`);
    expect(notificationHref("fr", { kind: "contract_update", payload: { contractId: ID, status: "to_sign" } })).toBe(`/fr/app/contrats/${ID}`);
    expect(notificationHref("fr", { kind: "mission_confirmation", payload: { status: "requested" } })).toBe("/fr/app/confirmations");
    expect(notificationHref("fr", { kind: "mission_confirmation", payload: { status: "confirmed" } })).toBe("/fr/app/preuves");
    expect(notificationHref("fr", { kind: "measurement_done", payload: {} })).toBe("/fr/app/visibilite");
    expect(notificationHref("en", { kind: "availability_reminder", payload: {} })).toBe("/en/app/profil#disponibilite");
  });

  it("never puts anything but a uuid in a path", () => {
    expect(notificationHref("fr", { kind: "message_received", payload: { conversationId: "..-evil" } })).toBe("/fr/app/messages");
    expect(notificationHref("fr", { kind: "application_received", payload: {} })).toBe("/fr/app/missions");
  });

  it("describes each kind in both languages, the status sentence first", () => {
    expect(notificationText({ kind: "application_status", payload: { status: "hired" } }, liveFr.notifications)).toBe(liveFr.notifications.statuses.hired);
    expect(notificationText({ kind: "application_status", payload: { status: "unknown" } }, liveEn.notifications)).toBe(liveEn.notifications.kinds.application_status);
    expect(Object.keys(liveEn.notifications.kinds).sort()).toEqual(Object.keys(liveFr.notifications.kinds).sort());
    expect(Object.keys(liveEn.notifications.statuses).sort()).toEqual(Object.keys(liveFr.notifications.statuses).sort());
  });
});
