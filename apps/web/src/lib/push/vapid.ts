/*
 * The VAPID identity that signs every push (C20), read from the environment. Without all three variables, valid, push
 * notifications are off: the setting is hidden and nothing is sent. The private key never leaves the server; the
 * public one is handed to the browser when it subscribes.
 *
 * Keys as printed by `npx web-push generate-vapid-keys`: base64url, 65 bytes for the public key (87 characters) and
 * 32 for the private one (43 characters).
 */

export interface VapidConfig {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
}

const PUBLIC_KEY = /^[A-Za-z0-9_-]{87}$/;
const PRIVATE_KEY = /^[A-Za-z0-9_-]{43}$/;
const SUBJECT = /^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/;

type Env = Readonly<Record<string, string | undefined>>;

export const vapidFromEnv = (env: Env): VapidConfig | null => {
  const publicKey = env.PROOFSEEN_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.PROOFSEEN_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.PROOFSEEN_VAPID_SUBJECT?.trim() ?? "";
  if (!PUBLIC_KEY.test(publicKey) || !PRIVATE_KEY.test(privateKey) || !SUBJECT.test(subject)) return null;
  return { publicKey, privateKey, subject };
};

/** True when some VAPID variable is set but the whole is unusable: worth a line in the logs, not silence. */
export const vapidMisconfigured = (env: Env): boolean =>
  vapidFromEnv(env) === null && [env.PROOFSEEN_VAPID_PUBLIC_KEY, env.PROOFSEEN_VAPID_PRIVATE_KEY, env.PROOFSEEN_VAPID_SUBJECT].some((value) => (value?.trim() ?? "") !== "");
