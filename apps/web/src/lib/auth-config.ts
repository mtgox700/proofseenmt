/*
 * Whether the connected app can run. Clerk needs both keys; without them the public site still works and every
 * connected page says plainly that sign-in is not configured, instead of crashing or opening a door.
 */
export const authConfigured = (): boolean =>
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_") && (process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_");
