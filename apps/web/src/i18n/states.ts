import type { Lang } from "./types";

/*
 * The words of the states between pages: an address that leads nowhere (404), a page that failed to render, a page
 * still loading. Kept apart from the main dictionaries so the client boundaries (error, loading) can read them
 * without pulling every string of the site into the browser. No figure, no promise: only what is true of any visit.
 */

export interface StatesCopy {
  readonly notFound: {
    readonly code: string;
    readonly title: string;
    readonly lead: string;
    /** Caption of the drawing: the slot where a mark would be struck, empty. */
    readonly mark: string;
    readonly searchLabel: string;
    readonly searchSubmit: string;
    readonly elsewhere: string;
    readonly links: { readonly home: string; readonly missions: string; readonly directory: string; readonly companies: string };
    /** One line for the reader of the other language, on the page served outside any language. */
    readonly otherLang: { readonly text: string; readonly link: string };
  };
  readonly error: {
    readonly code: string;
    readonly title: string;
    readonly lead: string;
    readonly hint: string;
    readonly retry: string;
    readonly home: string;
    readonly reference: string;
  };
  readonly loading: string;
}

const fr: StatesCopy = {
  notFound: {
    code: "Erreur 404",
    title: "Cette page n'existe pas.",
    lead: "Aucune page publiée ne répond à cette adresse. Elle a pu être retirée, ou l'adresse a été mal recopiée.",
    mark: "Aucune marque frappée ici.",
    searchLabel: "Chercher une mission",
    searchSubmit: "Chercher",
    elsewhere: "Reprendre ailleurs",
    links: { home: "Accueil", missions: "Missions", directory: "Annuaire des freelances", companies: "Entreprises" },
    otherLang: { text: "This page does not exist.", link: "Go to the English site" },
  },
  error: {
    code: "Incident",
    title: "Cette page n'a pas pu s'afficher.",
    lead: "Un incident de notre côté a interrompu l'affichage. Vous pouvez réessayer tout de suite.",
    hint: "Si vous veniez d'envoyer un formulaire, vérifiez qu'il a été pris en compte avant de le renvoyer.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
    reference: "Référence de l'incident",
  },
  loading: "Chargement de la page",
};

const en: StatesCopy = {
  notFound: {
    code: "Error 404",
    title: "This page does not exist.",
    lead: "No published page answers at this address. It may have been taken down, or the address was mistyped.",
    mark: "No mark struck here.",
    searchLabel: "Search missions",
    searchSubmit: "Search",
    elsewhere: "Carry on from here",
    links: { home: "Home", missions: "Missions", directory: "Freelancer directory", companies: "Companies" },
    otherLang: { text: "Cette page n'existe pas.", link: "Aller sur le site en français" },
  },
  error: {
    code: "Incident",
    title: "This page could not be displayed.",
    lead: "Something went wrong on our side while showing it. You can try again right away.",
    hint: "If you had just sent a form, check that it went through before sending it again.",
    retry: "Try again",
    home: "Back to home",
    reference: "Incident reference",
  },
  loading: "Loading the page",
};

export const STATES: Readonly<Record<Lang, StatesCopy>> = { fr, en };
