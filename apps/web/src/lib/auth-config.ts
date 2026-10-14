/*
 * Whether the connected app can run. Clerk needs both keys; without them the public site still works and every
 * connected page says plainly that sign-in is not configured, instead of crashing or opening a door.
 */
export const authConfigured = (): boolean =>
  clerkClientConfigured() && (process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_");

/*
 * Whether Clerk's provider can wrap the pages. It needs only the publishable key, which is known at build time; the
 * secret key is not (the production image gets it at run time). The shared layout is prerendered, so deciding on both
 * keys left the prerendered pages without a provider, and a client-side move from one of them to the sign-in page
 * crashed ("useSession can only be used within the <ClerkProvider />", production, 2026-10-14).
 */
export const clerkClientConfigured = (): boolean => (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_");
