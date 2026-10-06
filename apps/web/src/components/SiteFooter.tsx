import type { Dictionary } from "@/i18n";

export function SiteFooter({ t }: { readonly t: Dictionary }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>{t.footer.line}</p>
        <p>{t.footer.legal}</p>
        <p>{t.footer.marks}</p>
      </div>
    </footer>
  );
}
