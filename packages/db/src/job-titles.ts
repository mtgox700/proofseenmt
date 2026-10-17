import { foldText } from "./search-text";

/*
 * Taxonomie des postes (intitulés) tech : une liste courte, écrite à la main, de familles d'intitulés. Une mission y
 * entre par son intitulé, un profil par son titre (headline), quand le texte plié (minuscules, sans accents) contient
 * l'une des expressions de la famille, en mots entiers. Une mission ou un profil peut entrer dans plusieurs familles
 * (« lead développeur full stack » est à la fois tech lead et full stack) : c'est un filtre, jamais un classement.
 *
 * Les expressions sont des fragments d'expression régulière sur du texte plié, sans barre oblique inverse : une espace
 * vaut un séparateur facultatif (« front end » trouve « front-end », « frontend » et « front end »), « [.] » un point.
 */

export interface JobTitle {
  readonly key: string;
  readonly label: { readonly fr: string; readonly en: string };
  readonly phrases: readonly string[];
}

/** « développeur X », « développeuse X », « dev X », « X developer ». */
const dev = (x: string): readonly string[] => [`developpeu(?:r|se)s? ${x}`, `dev ${x}`, `${x} developers?`];

export const JOB_TITLES: readonly JobTitle[] = [
  { key: "developpeur-full-stack", label: { fr: "Développeur full stack", en: "Full stack developer" }, phrases: ["full stack"] },
  {
    key: "developpeur-front-end",
    label: { fr: "Développeur front-end", en: "Front-end developer" },
    phrases: ["front end", ...dev("react"), ...dev("angular"), ...dev("vue(?:[.]?js)?"), "integrat(?:eur|rice) web"],
  },
  { key: "developpeur-back-end", label: { fr: "Développeur back-end", en: "Back-end developer" }, phrases: ["back end"] },
  {
    key: "developpeur-mobile",
    label: { fr: "Développeur mobile", en: "Mobile developer" },
    phrases: [...dev("mobile"), ...dev("ios"), ...dev("android"), ...dev("flutter"), "react native", "(?:ios|android|mobile) engineers?", "ingenieure? mobile"],
  },
  { key: "developpeur-java", label: { fr: "Développeur Java", en: "Java developer" }, phrases: [...dev("java"), ...dev("j2?ee"), "java engineers?", "ingenieure? java"] },
  { key: "developpeur-python", label: { fr: "Développeur Python", en: "Python developer" }, phrases: [...dev("python"), ...dev("django"), "python engineers?", "ingenieure? python"] },
  { key: "developpeur-php", label: { fr: "Développeur PHP", en: "PHP developer" }, phrases: [...dev("php"), ...dev("symfony"), ...dev("laravel")] },
  { key: "developpeur-dotnet", label: { fr: "Développeur .NET", en: ".NET developer" }, phrases: [...dev("(?:asp)?[.]net"), ...dev("c#"), "ingenieure? [.]net"] },
  {
    key: "developpeur-javascript",
    label: { fr: "Développeur JavaScript / Node.js", en: "JavaScript / Node.js developer" },
    phrases: [...dev("javascript"), ...dev("typescript"), ...dev("node(?:[.]?js)?")],
  },
  { key: "tech-lead", label: { fr: "Tech lead", en: "Tech lead" }, phrases: ["tech lead", "lead dev", "lead developers?", "lead developpeu(?:r|se)", "lead technique", "responsable technique"] },
  {
    key: "data-engineer",
    label: { fr: "Data engineer", en: "Data engineer" },
    phrases: ["data engineers?", "ingenieure?s? (?:de )?(?:la )?(?:donnees|data|big data)", "big data engineers?", "analytics engineers?"],
  },
  { key: "data-scientist", label: { fr: "Data scientist", en: "Data scientist" }, phrases: ["data scientists?", "data science", "scientifiques? des donnees"] },
  {
    key: "data-analyst",
    label: { fr: "Data analyst / BI", en: "Data analyst / BI" },
    phrases: ["data analysts?", "analyste (?:de )?(?:donnees|data)", "business intelligence", "(?:consultante?|developpeu(?:r|se)|analyste) bi", "bi (?:developer|analyst|consultant)s?"],
  },
  {
    key: "ingenieur-machine-learning",
    label: { fr: "Ingénieur machine learning / IA", en: "Machine learning / AI engineer" },
    phrases: ["machine learning engineers?", "ml engineers?", "ingenieure? (?:en )?(?:machine learning|ia|intelligence artificielle|llm)", "ai engineers?", "llm engineers?", "mlops", "deep learning"],
  },
  { key: "devops-sre", label: { fr: "DevOps / SRE", en: "DevOps / SRE" }, phrases: ["devops", "sre", "site reliability", "platform engineers?", "ingenieure? (?:de )?(?:la )?(?:plateforme|fiabilite)"] },
  {
    key: "architecte-cloud",
    label: { fr: "Architecte cloud", en: "Cloud architect" },
    phrases: ["architecte (?:cloud|aws|azure|gcp)", "(?:cloud|aws|azure|gcp) architects?", "ingenieure? cloud", "cloud engineers?"],
  },
  {
    key: "architecte-logiciel",
    label: { fr: "Architecte logiciel / solution", en: "Software / solution architect" },
    phrases: ["architecte (?:logiciel|solutions?|technique|applicatif|si|d entreprise|entreprise)", "(?:software|solutions?|enterprise|technical) architects?"],
  },
  {
    key: "ingenieur-cybersecurite",
    label: { fr: "Ingénieur cybersécurité", en: "Cybersecurity engineer" },
    phrases: ["cyber securite", "cybersecurity", "securite (?:informatique|des systemes|offensive|operationnelle)", "security (?:engineer|analyst|architect|consultant)s?", "ingenieure? (?:en )?securite", "pentest(?:eur|euse|er)?", "rssi", "ciso", "(?:analyste )?soc analysts?", "analyste soc"],
  },
  {
    key: "administrateur-systemes-reseaux",
    label: { fr: "Administrateur systèmes et réseaux", en: "Systems and network administrator" },
    phrases: ["administrat(?:eur|rice) (?:systemes?|reseaux?)", "sysadmin", "ingenieure? (?:systemes?|reseaux?)", "(?:network|systems?) (?:engineer|administrator)s?", "technicien(?:ne)? (?:systemes?|reseaux?)"],
  },
  {
    key: "product-designer",
    label: { fr: "Product designer / UX-UI", en: "Product designer / UX-UI" },
    phrases: ["product designers?", "(?:ux|ui|ux ui|ui ux) designers?", "designer (?:ux|ui|produit|d interface)", "ux ui", "ui ux", "ux researchers?", "web designers?"],
  },
  {
    key: "product-owner",
    label: { fr: "Product owner / product manager", en: "Product owner / product manager" },
    phrases: ["product owners?", "product managers?", "chef(?:fe)? de produit", "proxy po", "head of product", "responsable produit"],
  },
  { key: "scrum-master", label: { fr: "Scrum master / coach agile", en: "Scrum master / agile coach" }, phrases: ["scrum masters?", "coach agile", "agile coach", "release train engineer", "agiliste"] },
  {
    key: "chef-de-projet",
    label: { fr: "Chef de projet / PMO", en: "Project manager / PMO" },
    phrases: ["chef(?:fe)? de projets?", "project managers?", "pmo", "direct(?:eur|rice) de projets?", "program(?:me)? managers?", "delivery managers?"],
  },
  {
    key: "cto",
    label: { fr: "CTO / direction technique", en: "CTO / technical leadership" },
    phrases: ["cto", "direct(?:eur|rice) technique", "chief technology officer", "vp engineering", "head of engineering", "engineering managers?", "dsi"],
  },
  {
    key: "testeur-qa",
    label: { fr: "Testeur / QA", en: "Tester / QA engineer" },
    phrases: ["qa", "test(?:eur|euse)s?", "test engineers?", "ingenieure? (?:de |en )?(?:tests?|qualite logicielle)", "quality assurance", "test automation", "automaticien(?:ne)? de tests?", "sdet"],
  },
  {
    key: "developpeur-embarque",
    label: { fr: "Développeur embarqué", en: "Embedded developer" },
    phrases: ["(?:logiciel|systemes?|developpeu(?:r|se)|ingenieure?) embarquee?s?", "embedded", "firmware"],
  },
];

/** Une espace dans une expression : rien, ou un à trois signes qui ne sont ni lettres ni chiffres. */
const SEPARATOR = "[^a-z0-9]{0,3}";

const compile = (phrases: readonly string[]): RegExp =>
  new RegExp(`(?<![a-z0-9])(?:${phrases.map((p) => p.split(" ").join(SEPARATOR)).join("|")})(?![a-z0-9])`);

const MATCHERS: ReadonlyMap<string, RegExp> = new Map(JOB_TITLES.map((t) => [t.key, compile(t.phrases)]));

export const jobTitleByKey = (key: string): JobTitle | undefined => JOB_TITLES.find((t) => t.key === key);

/** Un texte déjà plié (foldText) correspond-il à la famille ? Pour comparer beaucoup de lignes sans les replier. */
export const matchesFoldedJobTitle = (key: string, folded: string): boolean => MATCHERS.get(key)?.test(folded) ?? false;

/** Le texte (intitulé de mission, titre de profil) correspond-il à la famille ? Comparé une fois plié. */
export const matchesJobTitle = (key: string, text: string): boolean => matchesFoldedJobTitle(key, foldText(text));

/** Les familles auxquelles un texte appartient, dans l'ordre de la taxonomie. */
export const jobTitlesOf = (text: string): readonly string[] => {
  const folded = foldText(text);
  return JOB_TITLES.filter((t) => MATCHERS.get(t.key)?.test(folded) === true).map((t) => t.key);
};
