import "@/styles/app-compte.css";
import { notFound } from "next/navigation";
import { appNotifications, messageDigests, pushSubscriptions } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import { messageTime } from "@/components/live/message-time";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { PushToggle } from "@/components/pwa/PushToggle";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";
import { notificationText } from "@/lib/notification-link";
import { vapidFromEnv } from "@/lib/push/vapid";
import { markAllNotificationsRead, markNotificationRead, openNotification, setMessageDigest } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ avis?: string }>;
}

/**
 * The notification centre: latest first, unread marked, each one opening where it points; the daily summary; and push
 * notifications on this device (C20), offered only when the server holds its VAPID keys.
 */
export default async function NotificationsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const { avis } = await searchParams;
  const n = m.live.notifications;
  const pushKey = vapidFromEnv(process.env)?.publicKey ?? null;
  const [items, digestOn, devices] = await Promise.all([
    appNotifications(market.db).list(market.actor),
    messageDigests(market.db).enabled(market.actor),
    pushKey === null ? 0 : pushSubscriptions(market.db).count(market.actor),
  ]);
  const p = m.pwa;
  const unread = items.some((item) => item.readAt === null);
  const notice = avis === "trop" ? n.tooMany : avis === "resume-on" ? n.digest.on : avis === "resume-off" ? n.digest.off : null;
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  return (
    <>
      <header className="app-head">
        <h1>{n.title}</h1>
        <p className="muted measure">{n.lead}</p>
      </header>
      <LiveRefresh on="notifications" />
      {notice === null ? null : (
        <p className={avis === "trop" ? "form-error" : "form-ok"} role="status">
          {notice}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title={n.empty} headingLevel={2}>
          <p>{n.lead}</p>
        </EmptyState>
      ) : (
        <>
          {unread ? (
            <form action={markAllNotificationsRead}>
              {hidden("lang", lang)}
              <button type="submit" className="btn btn-quiet">
                {n.markAllRead}
              </button>
            </form>
          ) : null}
          <ul className="notifications">
            {items.map((item) => (
              <li key={item.id} data-unread={item.readAt === null || undefined}>
                <p className="notification-text">
                  {item.readAt === null ? <span className="tag small">{n.unread}</span> : null} {notificationText(item, n)}
                </p>
                <time className="small muted" dateTime={item.createdAt.toISOString()}>
                  {messageTime(item.createdAt, lang)}
                </time>
                <div className="row-actions">
                  <form action={openNotification}>
                    {hidden("lang", lang)}
                    {hidden("notificationId", item.id)}
                    <button type="submit" className="btn">
                      {n.open}
                    </button>
                  </form>
                  {item.readAt === null ? (
                    <form action={markNotificationRead}>
                      {hidden("lang", lang)}
                      {hidden("notificationId", item.id)}
                      <button type="submit" className="btn btn-quiet">
                        {n.markRead}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="panel" aria-labelledby="digest-title">
        <h2 id="digest-title">{n.digest.title}</h2>
        <p className="muted measure">{n.digest.lead}</p>
        <p>{digestOn ? n.digest.on : n.digest.off}</p>
        <form action={setMessageDigest}>
          {hidden("lang", lang)}
          {hidden("digest", digestOn ? "off" : "on")}
          <button type="submit" className={digestOn ? "btn" : "btn btn-primary"}>
            {digestOn ? n.digest.disable : n.digest.enable}
          </button>
        </form>
      </section>

      {pushKey === null ? null : (
        <section className="panel" aria-labelledby="push-title">
          <h2 id="push-title">{p.push.title}</h2>
          <p className="muted measure">{p.push.lead}</p>
          <PushToggle publicKey={pushKey} texts={p.push} />
          <p className="small muted">{p.devices(devices)}</p>
          <p className="small muted">{p.install}</p>
        </section>
      )}
    </>
  );
}
