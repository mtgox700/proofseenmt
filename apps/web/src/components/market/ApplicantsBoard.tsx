import "@/styles/app-choisir.css";
import Link from "next/link";
import type { ApplicantView } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { FactLines } from "@/components/market/FactLines";
import { StatusTag } from "@/components/market/StatusTag";
import type { Lang } from "@/i18n";
import type { MissionsDictionary } from "@/i18n/market/missions-fr";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";
import { candidateFactLines } from "@/lib/candidate-facts";
import { day } from "@/lib/format";

interface BoardProps {
  readonly lang: Lang;
  readonly m: MissionsDictionary;
  readonly s: MissionsSpaceDictionary;
  readonly missionId: string;
  readonly applicants: readonly ApplicantView[];
  readonly decide: (formData: FormData) => Promise<void>;
}

/** The columns, in the order an application moves. Withdrawn applications are not listed to the company. */
const COLUMNS = ["submitted", "shortlisted", "hired", "declined"] as const;

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

function Card({ lang, m, s, missionId, applicant, decide }: Omit<BoardProps, "applicants"> & { readonly applicant: ApplicantView }) {
  const d = m.detail;
  const open = applicant.status === "submitted" || applicant.status === "shortlisted";
  return (
    <li className="board-card">
      <p className="board-who">
        <strong>{applicant.profile.reference}</strong>
        {applicant.profile.headline === null ? null : <span className="small">{applicant.profile.headline}</span>}
      </p>
      <FactLines lines={candidateFactLines(applicant.profile, s.board)} label={s.board.factsLabel(applicant.profile.reference)} />
      <p className="choice-trace">
        {s.board.received(day(applicant.createdAt, lang))} · {applicant.readAt === null ? s.board.unread : s.board.read(day(applicant.readAt, lang))}
      </p>
      <p className="row-actions">
        {/* Opening marks the application as read for the freelancer: never prefetched, only on a deliberate click. */}
        <Link className="btn" prefetch={false} href={`/${lang}/app/missions/${missionId}/candidatures/${applicant.applicationId}`}>
          {s.board.open}
        </Link>
        {applicant.conversationId === null ? null : (
          <Link className="btn btn-quiet" href={`/${lang}/app/messages/${applicant.conversationId}`}>
            {d.conversation}
          </Link>
        )}
      </p>
      {open ? (
        <form action={decide} className="row-actions">
          <Hidden name="lang" value={lang} />
          <Hidden name="missionId" value={missionId} />
          <Hidden name="applicationId" value={applicant.applicationId} />
          {applicant.status === "submitted" ? (
            <button type="submit" name="decision" value="shortlisted" className="btn">
              {d.shortlist}
            </button>
          ) : null}
          <button type="submit" name="decision" value="hired" className="btn btn-primary" aria-describedby="hire-hint">
            {d.hire}
          </button>
          <button type="submit" name="decision" value="declined" className="btn btn-quiet">
            {d.decline}
          </button>
        </form>
      ) : null}
    </li>
  );
}

/** Applications grouped by status, as plain sections: readable without JavaScript, no drag and drop to learn. */
export function ApplicantsBoard(props: BoardProps) {
  const { s, m, applicants } = props;
  return (
    <div className="board">
      {COLUMNS.map((status) => {
        const column = applicants.filter((a) => a.status === status);
        return (
          <section key={status} className="board-col" aria-labelledby={`col-${status}`}>
            <h3 id={`col-${status}`}>
              <StatusTag status={status} label={s.board.columns[status]} /> <span className="muted small">{column.length}</span>
            </h3>
            {column.length === 0 ? (
              <EmptyNote>{s.board.empty}</EmptyNote>
            ) : (
              <ul className="plain-list">
                {column.map((applicant) => (
                  <Card key={applicant.applicationId} {...props} applicant={applicant} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p id="hire-hint" className="muted small panel-span">
        {m.detail.hireHint}
      </p>
    </div>
  );
}
