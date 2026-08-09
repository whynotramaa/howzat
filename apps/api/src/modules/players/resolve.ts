import crypto from 'node:crypto';
import { GUEST_USERNAME_PREFIX, type CreatePlayerInput } from '@howzat/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../lib/errors';

function generateGuestUsername(): string {
  return `${GUEST_USERNAME_PREFIX}${crypto.randomBytes(4).toString('hex')}`;
}

export interface ResolvedPlayer {
  name: string;
  username: string;
  userId: string | null;
}

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
    name: user.name,
    username: user.username,
    userId: user.id,
  };
}

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

  for (const input of inputs) {
    resolved.push(await resolvePlayerIdentity(input, teamId));
  }

  return resolved;
}

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
