import "@proofseen/brand/profile-card.css";
import "@/styles/app-choisir.css";
import Link from "next/link";
import { freelanceLists, matching, profileCardsInOrder, type ListSummary, type ProfileForMission } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { ProfileResultCard } from "@/components/search/ProfileResultCard";
import { ReferenceCard } from "@/components/search/ReferenceCard";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MatchingDictionary } from "@/i18n/market/matching-fr";
import type { Market } from "@/lib/market";
import { profileCardKey } from "@/lib/profile-card-view";
import { MatchReasons } from "./MatchReasons";

type Action = (formData: FormData) => Promise<void>;

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

const LIST_NOTICES = ["added", "already", "limit", "absent"] as const;
type ListNotice = (typeof LIST_NOTICES)[number];
const noticeOf = (raw: string | undefined): ListNotice | null => LIST_NOTICES.find((n) => n === raw) ?? null;

interface RowProps {
  readonly lang: Lang;
  readonly m: MatchingDictionary;
  readonly missionId: string;
  readonly open: boolean;
  readonly profile: ProfileForMission;
  readonly lists: readonly ListSummary[];
  readonly invite: Action;
  readonly addToList: Action;
}

/** Invite (existing invitations) and add to one of the company's lists. */
function RowActions({ lang, m, missionId, open, profile, lists, invite, addToList }: RowProps) {
  const f = m.forMission;
  return (
    <div className="row-actions">
      {!open ? null : profile.invited ? (
        <span className="muted small">{f.invited}</span>
      ) : (
        <form action={invite}>
          <Hidden name="lang" value={lang} />
          <Hidden name="missionId" value={missionId} />
          <Hidden name="reference" value={profile.reference} />
          <button type="submit" className="btn">
            {f.invite}
          </button>
        </form>
      )}
      {lists.length === 0 ? (
        <Link className="btn btn-quiet" href={`/${lang}/app/listes`}>
          {f.noList}
        </Link>
      ) : (
        <form action={addToList} className="row-actions">
          <Hidden name="lang" value={lang} />
          <Hidden name="missionId" value={missionId} />
          <Hidden name="profileId" value={profile.id} />
          <label htmlFor={`match-list-${profile.id}`} className="sr-only">
            {f.addTo}
          </label>
          <select id={`match-list-${profile.id}`} name="listId" defaultValue={lists[0]?.id}>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-quiet">
            {f.add}
          </button>
        </form>
      )}
    </div>
  );
}

interface ProfilesForMissionProps {
  readonly lang: Lang;
  readonly market: Market;
  readonly missionId: string;
  readonly organisationId: string;
  readonly open: boolean;
  readonly notice: string | undefined;
  readonly invite: Action;
  readonly addToList: Action;
}

/** "Matching profiles" on the company's mission page: facts compared one by one, the reason on each row. Members only. */
export async function ProfilesForMission({ lang, market, missionId, organisationId, open, notice, invite, addToList }: ProfilesForMissionProps) {
  const dict = marketDictionary(lang);
  const m = dict.matching;
  const f = m.forMission;
  const now = new Date();
  const [suggestions, lists] = await Promise.all([matching(market.db).profilesForMission(market.actor, missionId), freelanceLists(market.db).lists(market.actor, organisationId)]);
  if (suggestions === null) return null;
  // The one profile card of each suggestion, read in the order the rule above writes; no order is made here.
  const cards = await profileCardsInOrder(
    market.db,
    suggestions.items.map(({ item }) => item.id),
    now,
  );
  const cardOf = new Map(cards.map((card) => [card.id, card]));
  const listNotice = noticeOf(notice);
  return (
    <section className="ws-block" id="profils" aria-labelledby="matching-title">
      <h2 id="matching-title">{f.title}</h2>
      <p className="muted measure">{f.lead}</p>
      {listNotice === null ? null : (
        <p className={listNotice === "added" ? "form-ok" : "form-error"} role={listNotice === "added" ? "status" : "alert"}>
          {f.listNotice[listNotice]}
        </p>
      )}
      {suggestions.items.length === 0 ? (
        <EmptyNote>{f.empty}</EmptyNote>
      ) : (
        <>
          <p className="muted small">{f.rule}</p>
          <div dangerouslySetInnerHTML={{ __html: profileCardKey(cards, lang, now) }} />
          <ol className="choice-grid">
            {suggestions.items.map(({ item, matched, missing }) => {
              const card = cardOf.get(item.id);
              const desk = (
                <div className="choice-desk">
                  <div className="choice-why">
                    <MatchReasons lang={lang} m={m} matched={matched} missing={missing} rate="budget" />
                  </div>
                  <RowActions lang={lang} m={m} missionId={missionId} open={open} profile={item} lists={lists ?? []} invite={invite} addToList={addToList} />
                </div>
              );
              return (
                <li key={item.id}>
                  {card === undefined ? (
                    <ReferenceCard reference={item.reference} title={item.displayName ?? dict.search.card.pseudonym(item.reference)} headingId={`match-${item.id}`}>
                      {desk}
                    </ReferenceCard>
                  ) : (
                    <ProfileResultCard lang={lang} card={card} now={now}>
                      {desk}
                    </ProfileResultCard>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
