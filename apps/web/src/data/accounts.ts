import { users, type Db, type Users } from "@proofseen/db";
import { erasureTombstoneKey } from "../lib/erasure-key";
import { logError } from "../lib/log";

/*
 * The account repository as the site uses it: with the erasure-tombstone key, so that a suspended account erased and
 * signed up again with the same address is suspended again (wave-3 review, L11). Every `ensure` of the site goes
 * through here.
 */

let warned = false;

const tombstoneKey = (): string | null => {
  const key = erasureTombstoneKey();
  if (key === null && !warned) {
    logError("accounts: PROOFSEEN_ACCESS_SECRET missing or too short, erasure tombstones disabled");
    warned = true;
  }
  return key;
};

export const accountUsers = (db: Db): Users => users(db, { tombstoneKey: tombstoneKey() });

/** What `gdpr(db).eraseUser` needs to leave the tombstone of a suspended account. */
export const erasureOptions = (): { readonly tombstoneKey: string | null } => ({ tombstoneKey: tombstoneKey() });
