import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../modules/auth/tokens';

/**
 * There is no role gate in this file, and that is the point.
 *
 * Authorization in Howzat is always about a specific thing: you may edit this
 * tournament because you created it (loadOwnedTournament), and you may score
 * this match because you own its tournament or hold an assignment for it
 * (requireScorerForMatch). A coarse "is an organizer" check would be either
 * redundant with those or wrong — the same person organizes their own league
 * on Sunday and scores someone else's final on Tuesday.
 */

/** Verifies the bearer token and attaches req.user. 401 if absent or invalid. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Sign in to continue'));
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
};
