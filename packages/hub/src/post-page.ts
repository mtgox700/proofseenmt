import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { isoDay, longDate, marketFooter, marketHeader, MENU_STYLES, type Lang } from "./market-shell";
import { renderMarkdown } from "./markdown";
import { FAVICON } from "./pages";
import { fileUrl } from "./profile-sections";

/*
 * Page publique d'une publication de la communauté (C22) : un document HTML complet, sans JavaScript (seul le JSON-LD
 * `SocialMediaPosting` est dans une balise script), le même pour tous. Le texte est un Markdown simple rendu sûr ; les
 * commentaires sont du texte échappé. Un profil pseudonyme parle sous sa référence, jamais sous un nom : la page reste
 * indexable, l'identité ne fuit pas. Les nombres de réactions, de commentaires et de partages sont publics ; les
 * impressions et les vues ne le sont pas et n'apparaissent jamais ici.
 */

export interface PublicPostAuthor {
  readonly kind: "profile" | "organisation";
  readonly name: string;
  readonly profileSlug: string | null;
  readonly companySlug: string | null;
}

export interface PublicPostOriginal {
  readonly id: string;
  readonly author: PublicPostAuthor;
  readonly body: string;
  readonly linkUrl: string | null;
  readonly imageFileId: string | null;
  readonly createdAt: Date;
}

export interface PublicPostComment {
  readonly id: string;
  /** `null` : commentaire supprimé, ou compte effacé. */
  readonly author: PublicPostAuthor | null;
  readonly body: string;
  readonly state: "live" | "deleted" | "erased" | "moderated";
  readonly createdAt: Date;
  readonly replies: readonly PublicPostComment[];
}

export interface PublicPostModel {
  readonly id: string;
  readonly author: PublicPostAuthor;
  readonly body: string;
  readonly linkUrl: string | null;
  readonly imageFileId: string | null;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  readonly shared: PublicPostOriginal | "unavailable" | null;
  readonly counts: { readonly reactions: Readonly<Record<string, number>>; readonly comments: number; readonly shares: number };
  readonly comments: readonly PublicPostComment[];
}

const LABELS = {
  fr: {
    back: "← Freelances",
    post: "Publication",
    by: "Publié par",
    on: (d: string) => `le ${d}`,
    edited: (d: string) => `modifié le ${d}`,
    link: "Lien partagé",
    image: (name: string) => `Image publiée par ${name}`,
    shared: "Partage d'une publication",
    unavailable: "La publication partagée n'est plus disponible.",
    counts: (r: number, c: number, s: number) => `${r} réaction${r > 1 ? "s" : ""} · ${c} commentaire${c > 1 ? "s" : ""} · ${s} partage${s > 1 ? "s" : ""}`,
    comments: "Commentaires",
    noComments: "Aucun commentaire pour l'instant.",
    deleted: "Commentaire supprimé.",
    erased: "Compte supprimé.",
    cta: "Réagir et commenter sur Proofseen",
    ctaHint: "Compte Proofseen requis. Les coordonnées ne s'échangent pas ici : le contact passe par la plateforme.",
    title: (name: string) => `Publication de ${name}`,
  },
  en: {
    back: "← Freelancers",
    post: "Post",
    by: "Posted by",
    on: (d: string) => `on ${d}`,
    edited: (d: string) => `edited on ${d}`,
    link: "Shared link",
    image: (name: string) => `Image posted by ${name}`,
    shared: "Share of a post",
    unavailable: "The shared post is no longer available.",
    counts: (r: number, c: number, s: number) => `${r} reaction${r === 1 ? "" : "s"} · ${c} comment${c === 1 ? "" : "s"} · ${s} share${s === 1 ? "" : "s"}`,
    comments: "Comments",
    noComments: "No comment yet.",
    deleted: "Comment deleted.",
    erased: "Account deleted.",
    cta: "React and comment on Proofseen",
    ctaHint: "Proofseen account required. Contact details are not exchanged here: contact goes through the platform.",
    title: (name: string) => `Post by ${name}`,
  },
} as const;

const POST_STYLES =
  ".post-body{margin-top:1.4rem;max-width:44rem}.post-body p,.post-body ul,.post-body ol,.post-body blockquote{margin:0 0 1rem}" +
  ".post-body blockquote{border-left:3px solid var(--accent);padding-left:1rem;color:var(--muted)}" +
  ".post-image{display:block;max-width:100%;height:auto;margin-top:1.2rem;border:1px solid var(--line);border-radius:12px}" +
  ".shared{margin-top:1.4rem;padding:1rem 1.2rem;border:1px solid var(--line);border-radius:12px;background:var(--raised)}" +
  ".comments{list-style:none;margin:0;padding:0;display:grid;gap:.9rem}.comments .replies{list-style:none;margin:.8rem 0 0 1.4rem;padding:0;display:grid;gap:.8rem}" +
  ".comment{padding:.9rem 1rem;border:1px solid var(--line);border-radius:12px;background:var(--surface)}";

export const postUrl = (baseUrl: string, lang: Lang, id: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/publications/${encodeURIComponent(id)}`;

/**
 * Le Markdown simple d'une publication : titres ramenés à du texte en gras, liens ramenés à leur texte. Une publication a
 * son propre champ de lien, relu par le filtre de coordonnées ; un lien caché dans le texte (« [rdv](//signal.group/…) »)
 * y échapperait (relecture sécurité C22, M1).
 */
export const renderPostBody = (body: string): string =>
  renderMarkdown(body)
    .html.replace(/<h[1-6] id="[^"]*">([\s\S]*?)<\/h[1-6]>/g, (_m, inner: string) => `<p><strong>${inner}</strong></p>`)
    .replace(/<a href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (_m, inner: string) => inner);

const authorHref = (a: PublicPostAuthor, lang: Lang): string | null =>
  a.profileSlug !== null ? `/${lang}/profils/${encodeURIComponent(a.profileSlug)}` : a.companySlug !== null ? `/${lang}/entreprises/${encodeURIComponent(a.companySlug)}` : null;

const authorLink = (a: PublicPostAuthor, lang: Lang): string => {
  const href = authorHref(a, lang);
  return href === null ? `<strong>${e(a.name)}</strong>` : `<a href="${e(href)}"><strong>${e(a.name)}</strong></a>`;
};

/** Le texte brut d'une publication, sur une ligne, pour la description et les données structurées. */
const plain = (body: string): string => body.replace(/[#*_`>~[\]()!|]/g, " ").replace(/\s+/g, " ").trim();
const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

const linkBlock = (url: string | null, lang: Lang): string =>
  url === null ? "" : `<p class="meta">${LABELS[lang].link} : <a href="${e(url)}" rel="nofollow ugc noopener noreferrer">${e(url)}</a></p>`;

const imageBlock = (id: string | null, name: string, o: { readonly baseUrl: string; readonly lang: Lang }): string =>
  id === null ? "" : `<img class="post-image" src="${e(fileUrl(o.baseUrl, id))}" alt="${e(LABELS[o.lang].image(name))}" loading="lazy" decoding="async">`;

const sharedBlock = (p: PublicPostModel, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  if (p.shared === null) return "";
  if (p.shared === "unavailable") return `<aside class="shared"><p class="muted">${l.unavailable}</p></aside>`;
  const s = p.shared;
  return (
    `<aside class="shared" aria-label="${l.shared}"><p class="meta">${l.shared} · ${authorLink(s.author, o.lang)} · <a href="${e(`/${o.lang}/publications/${s.id}`)}"><time datetime="${isoDay(s.createdAt)}">${e(longDate(s.createdAt, o.lang))}</time></a></p>` +
    `<div class="post-body">${renderPostBody(s.body)}</div>${linkBlock(s.linkUrl, o.lang)}${imageBlock(s.imageFileId, s.author.name, o)}</aside>`
  );
};

const commentItem = (c: PublicPostComment, lang: Lang): string => {
  const l = LABELS[lang];
  const head = c.author === null ? `<p class="muted">${c.state === "erased" ? l.erased : l.deleted}</p>` : `<p class="meta">${authorLink(c.author, lang)} · <time datetime="${isoDay(c.createdAt)}">${e(longDate(c.createdAt, lang))}</time></p>`;
  const body = c.author === null ? "" : `<p>${e(c.body).replace(/\n/g, "<br>")}</p>`;
  const replies = c.replies.length === 0 ? "" : `<ul class="replies">${c.replies.map((r) => commentItem(r, lang)).join("")}</ul>`;
  return `<li class="comment">${head}${body}${replies}</li>`;
};

const total = (reactions: Readonly<Record<string, number>>): number => Object.values(reactions).reduce((sum, n) => sum + n, 0);

const personOrOrg = (a: PublicPostAuthor, baseUrl: string, lang: Lang): Record<string, unknown> => {
  const href = authorHref(a, lang);
  return { "@type": a.kind === "organisation" ? "Organization" : "Person", name: a.name, ...(href === null ? {} : { url: `${baseUrl.replace(/\/$/, "")}${href}` }) };
};

const liveComments = (comments: readonly PublicPostComment[]): readonly PublicPostComment[] =>
  comments.flatMap((c) => [...(c.state === "live" && c.author !== null ? [c] : []), ...liveComments(c.replies)]);

export const postJsonLd = (p: PublicPostModel, o: { readonly baseUrl: string; readonly lang: Lang }): Record<string, unknown> => {
  const url = postUrl(o.baseUrl, o.lang, p.id);
  const text = plain(p.body);
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": url,
    url,
    headline: cut(text === "" ? LABELS[o.lang].title(p.author.name) : text, 110),
    ...(text === "" ? {} : { articleBody: text }),
    datePublished: p.createdAt.toISOString(),
    dateModified: (p.editedAt ?? p.createdAt).toISOString(),
    author: personOrOrg(p.author, o.baseUrl, o.lang),
    ...(p.imageFileId === null ? {} : { image: fileUrl(o.baseUrl, p.imageFileId) }),
    ...(p.shared === null || p.shared === "unavailable" ? {} : { sharedContent: { "@type": "SocialMediaPosting", url: postUrl(o.baseUrl, o.lang, p.shared.id) } }),
    commentCount: p.counts.comments,
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: total(p.counts.reactions) },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.counts.comments },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ShareAction", userInteractionCount: p.counts.shares },
    ],
    comment: liveComments(p.comments).map((c) => ({ "@type": "Comment", text: c.body, dateCreated: c.createdAt.toISOString(), ...(c.author === null ? {} : { author: personOrOrg(c.author, o.baseUrl, o.lang) }) })),
  };
};

export const renderPostPage = (p: PublicPostModel, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const url = postUrl(o.baseUrl, o.lang, p.id);
  const text = plain(p.body);
  const title = cut(`${l.title(p.author.name)}${text === "" ? "" : ` : ${text}`}`, 70);
  const dates =
    `<time datetime="${isoDay(p.createdAt)}">${e(l.on(longDate(p.createdAt, o.lang)))}</time>` +
    (p.editedAt === null ? "" : ` · <time datetime="${isoDay(p.editedAt)}">${e(l.edited(longDate(p.editedAt, o.lang)))}</time>`);
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${e(title)} — Proofseen</title>`,
    `<meta name="description" content="${e(cut(text === "" ? l.title(p.author.name) : text, 160))}">`,
    `<link rel="canonical" href="${e(url)}">`,
    `<link rel="alternate" hreflang="fr" href="${e(postUrl(o.baseUrl, "fr", p.id))}">`,
    `<link rel="alternate" hreflang="en" href="${e(postUrl(o.baseUrl, "en", p.id))}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${e(title)}">`,
    `<style>${STYLES}${MENU_STYLES}${POST_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(postJsonLd(p, o))}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, postUrl(o.baseUrl, other, p.id)),
    '<main class="wrap">',
    `<a class="crumb" href="/${o.lang}/freelances">${l.back}</a>`,
    "<article>",
    `<h1 class="title">${e(l.title(p.author.name))}</h1>`,
    `<p class="byline">${l.by} ${authorLink(p.author, o.lang)} ${dates}</p>`,
    p.body === "" ? "" : `<div class="post-body">${renderPostBody(p.body)}</div>`,
    linkBlock(p.linkUrl, o.lang),
    imageBlock(p.imageFileId, p.author.name, o),
    sharedBlock(p, o),
    `<p class="meta">${e(l.counts(total(p.counts.reactions), p.counts.comments, p.counts.shares))}</p>`,
    "</article>",
    `<section aria-labelledby="post-comments"><h2 id="post-comments">${l.comments}</h2>`,
    p.comments.length === 0 ? `<p class="muted">${l.noComments}</p>` : `<ul class="comments">${p.comments.map((c) => commentItem(c, o.lang)).join("")}</ul>`,
    "</section>",
    `<p><a class="cta" href="${e(`/${o.lang}/app/fil/${p.id}`)}" rel="nofollow">${l.cta}</a></p>`,
    `<p class="muted">${l.ctaHint}</p>`,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

/** Sitemap des publications publiques, dans les deux langues. */
export const postSitemap = (baseUrl: string, items: readonly { readonly id: string; readonly updatedAt: Date }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(postUrl(baseUrl, lang, item.id))}</loc><lastmod>${isoDay(item.updatedAt)}</lastmod></url>`)),
    "</urlset>",
    "",
  ].join("\n");

/** Une publication récente, telle qu'une page de profil ou d'entreprise la cite. */
export interface RecentPostItem {
  readonly id: string;
  readonly excerpt: string;
  readonly createdAt: Date;
}

/** La section « Publications récentes » d'une page publique ; rien si aucune. */
export const recentPostsSection = (items: readonly RecentPostItem[] | undefined, lang: Lang): string => {
  if (items === undefined || items.length === 0) return "";
  const heading = lang === "fr" ? "Publications récentes" : "Recent posts";
  const rows = items
    .map((p) => `<li><a href="${e(`/${lang}/publications/${p.id}`)}"><span>${e(p.excerpt)}</span><small class="muted"><time datetime="${isoDay(p.createdAt)}">${e(longDate(p.createdAt, lang))}</time></small></a></li>`)
    .join("");
  return `<h2>${heading}</h2><ul class="links">${rows}</ul>`;
};
