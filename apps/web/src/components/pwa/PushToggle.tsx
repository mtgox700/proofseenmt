"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PushTexts } from "@/i18n/market/pwa-fr";
import { currentPushState, disablePush, enablePush, looksLikeIos, type EnableResult, type PushState } from "@/lib/pwa/push-client";

interface PushToggleProps {
  readonly publicKey: string;
  readonly texts: PushTexts;
}

type Notice = Exclude<EnableResult, "on"> | null;

/**
 * "Receive notifications on this device" (C20): a switch for this browser only. The server renders it disabled; it
 * comes alive once the page knows whether this device is already subscribed.
 */
export function PushToggle({ publicKey, texts }: PushToggleProps) {
  const router = useRouter();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    currentPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const toggle = async (wanted: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      if (!wanted) {
        const result = await disablePush();
        setState("off");
        if (result === "failed") setNotice("failed");
      } else {
        const result = await enablePush(publicKey);
        if (result === "on") setState("on");
        else if (result === "denied") setState("denied");
        else setNotice(result);
      }
      // The device count of the page is rendered by the server.
      router.refresh();
    } catch (error) {
      console.warn("push: toggle failed", error instanceof Error ? error.name : error);
      setNotice("failed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "unsupported") {
    return (
      <p className="small muted" role="status">
        {texts.unsupported} {looksLikeIos() ? texts.iosHint : null}
      </p>
    );
  }
  if (state === "denied") return <p className="form-error">{texts.denied}</p>;

  const on = state === "on";
  const message = notice === "too-many" ? texts.tooMany : notice === "suspended" ? texts.suspended : notice === "failed" ? texts.failed : null;
  return (
    <div className="field field-inline">
      <input
        id="push-device"
        type="checkbox"
        role="switch"
        checked={on}
        disabled={state === "loading" || busy}
        aria-describedby="push-device-state"
        onChange={(event) => void toggle(event.currentTarget.checked)}
      />
      <label htmlFor="push-device">{texts.toggle}</label>
      <p id="push-device-state" className="field-hint" role="status">
        {busy ? texts.working : state === "loading" ? null : on ? texts.on : texts.off}
      </p>
      {message === null ? null : (
        <p className="form-error field-hint" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
