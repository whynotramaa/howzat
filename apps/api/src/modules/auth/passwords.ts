import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

let decoyHash: Promise<string> | null = null;

export async function burnPasswordComparison(): Promise<void> {
  decoyHash ??= hashPassword(`decoy-${Math.random()}`);
  await bcrypt.compare('howzat-no-such-account', await decoyHash);
}
