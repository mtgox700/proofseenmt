import { hrefWith, param, type SearchParams } from "../url";

/*
 * The inspector is in the address (LEGENDS_P2_CONCEPT §B.4): `?voir=<id>` opens it, its absence closes it. So it is
 * drawn by the server, can be sent to another operator, and the back button closes it.
 */

export const INSPECTOR_PARAM = "voir";
/** An identifier as the database writes them (cuid, uuid, a reference): never a free text. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The item the address asks to inspect, or null when absent or not an identifier. */
export function inspectedId(params: SearchParams): string | null {
  const id = param(params, INSPECTOR_PARAM);
  return id !== null && ID.test(id) ? id : null;
}

/** The same view with the inspector open on an item; the sort, filters and page stay. */
export function inspectHref(path: string, params: SearchParams, id: string): string {
  if (!ID.test(id)) throw new Error("an inspector opens on an identifier");
  return hrefWith(path, params, { [INSPECTOR_PARAM]: id });
}

/** The same view with the inspector closed. */
export function closeInspectorHref(path: string, params: SearchParams): string {
  return hrefWith(path, params, { [INSPECTOR_PARAM]: null });
}
