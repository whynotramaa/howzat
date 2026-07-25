import bcrypt from 'bcryptjs';

/**
 * bcrypt at cost 12. The cost is the whole security argument for storing a
 * password at all, so it is a constant here rather than a tunable that could
 * quietly be set to something useless in an env file.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * Accounts created before passwords existed carry an empty digest (see the
 * migration). bcrypt.compare returns false for those rather than throwing,
 * which is exactly the behaviour we want: they simply cannot sign in.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Burns roughly the same time as a real comparison when no such user exists.
 * Without it, "unknown username" returns visibly faster than "wrong password"
 * and the login endpoint becomes an account-enumeration oracle regardless of
 * how carefully the error message is worded.
 *
 * The decoy is hashed once, lazily, from a random value — a literal digest
 * checked into the repo would be a published hash of a known string, and a
 * malformed one would be rejected instantly and defeat the whole purpose.
 */
let decoyHash: Promise<string> | null = null;

export async function burnPasswordComparison(): Promise<void> {
  decoyHash ??= hashPassword(`decoy-${Math.random()}`);
  await bcrypt.compare('howzat-no-such-account', await decoyHash);
}
