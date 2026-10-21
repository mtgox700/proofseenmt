import { LangPick } from "@/components/states/LangPick";
import { NotFoundView } from "@/components/states/NotFoundView";

/*
 * notFound() from a page of the connected space (a mission, a contract or a thread that does not exist or is not the
 * person's): the 404 of the brand inside the shell, so the menu stays at hand. Status 404, set by Next.
 */
export default function AppNotFound() {
  return <LangPick fr={<NotFoundView lang="fr" />} en={<NotFoundView lang="en" />} />;
}
