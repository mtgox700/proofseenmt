import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { missionTemplates, type TemplateSummary } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { MissionForm } from "@/components/market/MissionForm";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";
import { day } from "@/lib/format";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { createMission } from "../actions";
import { removeTemplate } from "../company-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; modele?: string }>;
}

function Templates({ lang, s, templates }: { readonly lang: Lang; readonly s: MissionsSpaceDictionary; readonly templates: readonly TemplateSummary[] }) {
  if (templates.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="templates-title">
      <h2 id="templates-title">{s.templates.title}</h2>
      <p className="muted measure">{s.templates.lead}</p>
      <ul className="plain-list">
        {templates.map((template) => (
          <li key={template.id} className="org-member">
            <span>
              <strong>{template.name}</strong>
              <span className="muted small"> · {template.title} · {day(template.createdAt, lang)}</span>
            </span>
            <span className="row-actions">
              <Link className="btn" href={`/${lang}/app/missions/nouvelle?modele=${template.id}`}>
                {s.templates.use}
              </Link>
              <form action={removeTemplate}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit" className="btn btn-quiet">
                  {s.templates.remove}
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A new mission, saved as a draft (optionally from a template): publishing is a separate, deliberate step on its page. */
export default async function NewMissionPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.missions;
  const s = dict.missionsSpace;
  // The home page's « Publier une mission » leads here: a visitor who signs in comes back to this form.
  const market = await pageMarket(lang, ["company"], `/${lang}/app/missions/nouvelle`);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const { erreur, modele } = await searchParams;
  const [templates, template] = await Promise.all([
    missionTemplates(market.db).list(market.actor, organisation.id),
    modele === undefined ? Promise.resolve(null) : missionTemplates(market.db).get(market.actor, modele),
  ]);
  const error = erreur === undefined ? null : erreur === "trop" ? m.form.errors.tooMany : erreur === "brouillons" ? m.form.errors.drafts : m.form.errors.invalid;
  return (
    <>
      <header className="app-head">
        <h1>{m.form.newTitle}</h1>
      </header>
      <Templates lang={lang} s={s} templates={templates ?? []} />
      {template === null ? null : (
        <p className="form-ok" role="status">
          {s.templates.using(template.name)}
        </p>
      )}
      <MissionForm
        key={template?.id ?? "blank"}
        lang={lang}
        m={m}
        space={s}
        action={createMission}
        {...(template === null ? {} : { initial: template.input })}
        error={error}
        cancelHref={`/${lang}/app/missions`}
      />
    </>
  );
}
