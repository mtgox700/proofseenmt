import Link from "next/link";
import { dictionary } from "@/i18n";

/* Rendered for unknown profiles and workspaces. Next gives no params here, so the French copy is the default. */
export default function NotFound() {
  const t = dictionary("fr");
  return (
    <main id="contenu" className="wrap not-found">
      <h1>{t.notFound.title}</h1>
      <p>
        <Link href="/fr">{t.notFound.back}</Link>
      </p>
    </main>
  );
}
