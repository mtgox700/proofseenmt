import { redirect, notFound } from "next/navigation";
import { dictionary, isLang } from "@/i18n";
import { isChosenRole } from "@/lib/roles";
import { chooseRole, session } from "@/lib/session";
import { returnPath } from "@/lib/sign-in-path";

/** Depends on who is signed in (and on whether sign-in is configured): rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ redirect_url?: string | string[] }>;
}

/*
 * First visit after sign-up: the person says which side they are on, once. The server action re-reads the session:
 * it never trusts an id or a role sent by the form, and `chooseRole` refuses to overwrite a choice already made.
 * When the account was created on the way to a page (posting a mission), that page is where the choice leads, and only
 * if it is a path of this site (`returnPath`, checked again in the action).
 */
export default async function WelcomePage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  const back = returnPath((await searchParams).redirect_url);
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const w = t.app.welcome;
  const state = await session();
  if (state.kind === "signed-out") redirect(`/${lang}/connexion`);
  if (state.kind === "signed-in" && state.person.role !== null) redirect(back ?? `/${lang}/app`);

  async function choose(formData: FormData): Promise<void> {
    "use server";
    const current = await session();
    if (current.kind !== "signed-in") redirect(`/${lang}/connexion`);
    const role = formData.get("role");
    if (!isChosenRole(role)) return;
    await chooseRole(current.person.id, role);
    redirect(returnPath(formData.get("return")) ?? `/${lang}/app`);
  }

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <header className="app-head">
        <h1 id="welcome-title">{w.title}</h1>
        <p className="muted measure">{w.lead}</p>
      </header>
      <form action={choose} className="welcome-choices">
        {back === null ? null : <input type="hidden" name="return" value={back} />}
        {(["freelance", "company"] as const).map((role) => (
          <button key={role} type="submit" name="role" value={role} className="welcome-choice">
            <strong>{w[role].title}</strong>
            <span className="muted">{w[role].text}</span>
            <span className="welcome-go" aria-hidden="true">
              {w.choose} →
            </span>
          </button>
        ))}
      </form>
    </section>
  );
}
