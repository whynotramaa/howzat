import crypto from 'node:crypto';
import { GUEST_USERNAME_PREFIX, type CreatePlayerInput } from '@howzat/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../lib/errors';

/**
 * Turning "who is this player?" into a squad row.
 *
 * The organizer building a squad is typing names off a team sheet. Some of
 * those people have a Howzat account and want their runs on their profile;
 * most, realistically, do not and never will. Both have to be addable in the
 * same flow, at the same speed, or the feature does not get used — so the
 * distinction is one optional field, resolved here.
 */

/**
 * Placeholders are random, not sequential. `guest_1`, `guest_2` across a
 * tournament would read like a ranking and invite someone to "claim" a number;
 * an opaque tail reads as what it is, a label with no meaning.
 */
function generateGuestUsername(): string {
  return `${GUEST_USERNAME_PREFIX}${crypto.randomBytes(4).toString('hex')}`;
}

export interface ResolvedPlayer {
  name: string;
  username: string;
  userId: string | null;
}

/**
 * Resolves one entry. With a username it must match a real, verified account —
 * a typo silently becoming a guest would be far worse than an error, because
 * nobody notices until the season is over and the stats went nowhere.
 */
export async function resolvePlayerIdentity(
  input: Pick<CreatePlayerInput, 'name' | 'username'>,
  teamId: string,
): Promise<ResolvedPlayer> {
  if (!input.username) {
    return {
      name: input.name!.trim(),
      username: await allocateGuestUsername(teamId),
      userId: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true, name: true, username: true, emailVerifiedAt: true },
  });

  // notFound() appends "not found", so the argument is the subject, not a
  // sentence. An unverified signup reads as "no such handle" on purpose:
  // until they confirm their email the account is not yet anyone.
  if (!user || !user.emailVerifiedAt) {
    throw notFound(`@${input.username}`);
  }

  const alreadyInSquad = await prisma.player.findFirst({
    where: { teamId, userId: user.id },
    select: { id: true },
  });

  if (alreadyInSquad) {
    throw conflict(`@${user.username} is already in this squad`);
  }

  return {
    // Their own name wins over whatever the organizer typed — it is their
    // profile the runs land on, and their spelling of their name.
    name: user.name,
    username: user.username,
    userId: user.id,
  };
}

/** Resolves a whole bulk paste, rejecting duplicates within the batch itself. */
export async function resolvePlayerIdentities(
  inputs: Array<Pick<CreatePlayerInput, 'name' | 'username'>>,
  teamId: string,
): Promise<ResolvedPlayer[]> {
  const named = inputs.map((input) => input.username).filter(Boolean) as string[];
  const duplicate = named.find((username, index) => named.indexOf(username) !== index);

  if (duplicate) {
    throw conflict(`@${duplicate} appears twice in this list`);
  }

  const resolved: ResolvedPlayer[] = [];

  // Sequential rather than Promise.all: each guest handle must see the ones
  // allocated before it, and a batch of eleven is not worth the concurrency.
  for (const input of inputs) {
    resolved.push(await resolvePlayerIdentity(input, teamId));
  }

  return resolved;
}

/** Retries on the vanishingly unlikely collision within a single squad. */
async function allocateGuestUsername(teamId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateGuestUsername();

    const taken = await prisma.player.findFirst({
      where: { teamId, username: candidate },
      select: { id: true },
    });

    if (!taken) return candidate;
  }

  return `${GUEST_USERNAME_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
}

/** The row shape both the single and bulk create paths write. */
export function toPlayerCreateData(
  teamId: string,
  identity: ResolvedPlayer,
  input: CreatePlayerInput,
): Prisma.PlayerCreateManyInput {
  return {
    teamId,
    userId: identity.userId,
    name: identity.name,
    username: identity.username,
    role: input.role,
    battingStyle: input.battingStyle ?? null,
    bowlingStyle: input.bowlingStyle ?? null,
  };
}
