import { PageSkeleton } from "@/components/states/Skeleton";

/*
 * Every page of the connected space reads its data on the server, per request. While it does, the shell and its menu
 * are already there and the page area shows an empty register at fixed sizes: the click answers at once, and nothing
 * moves when the page arrives.
 */
export default function AppLoading() {
  return <PageSkeleton />;
}
