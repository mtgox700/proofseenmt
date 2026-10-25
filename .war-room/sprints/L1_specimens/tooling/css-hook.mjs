// Lets Node import the components of apps/web, which import their stylesheet: a .css module is empty here.
import { register } from "node:module";

const hook = `export async function load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  return next(url, context);
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);
