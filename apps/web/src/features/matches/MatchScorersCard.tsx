import { useMemo, useState, type FormEvent } from 'react';
import type { UserRef } from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorText } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { useTournament } from '@/features/organizer/queries';
import { useAssignScorer, useRemoveScorer } from './queries';

/**
 * Who may score this match.
 *
 * A tournament has one organizer, but a match has whoever is standing at that
 * pitch — and on a Sunday with four fixtures running at once those are four
 * different people. That is the whole reason ScorerAssignment is a per-match
 * row rather than a role on an account, and this is the screen that writes it.
 *
 * The card hides itself for anyone who is not the organizer. The check is the
 * tournament read succeeding: only an organizer can load a tournament, so a
 * failed read is precisely the signal that this viewer is an assigned scorer
 * rather than the owner. That is cheaper and harder to get wrong than a
 * separate permission call, and it fails closed.
 *
 * Shared by both sports because the concept is identical in both — nothing here
 * knows or cares whether the match is scored in overs or in minutes.
 */
export function MatchScorersCard({
  tournamentId,
  matchId,
  scorers,
}: {
  tournamentId: string;
  matchId: string;
  scorers: UserRef[];
}) {
  const tournament = useTournament(tournamentId);
  const assign = useAssignScorer(tournamentId, matchId);
  const remove = useRemoveScorer(tournamentId, matchId);

  const [username, setUsername] = useState('');

  const fieldError = useMemo(
    () => (assign.error instanceof Error ? assign.error.message : null),
    [assign.error],
  );

  if (!tournament.data) return null;

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    await assign.mutateAsync(username);
    setUsername('');
  }

  return (
    <Card>
      <CardHeader>
        <p className="eyebrow">Permissions</p>
        <h2 className="serif mt-2.5 text-xl text-primary">Scorers</h2>
        <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-secondary">
          Anyone with an account can score this match once you assign them. They do not need to
          be in a squad or own the tournament — and each match can have its own.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-7">
        {scorers.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {scorers.map((scorer) => (
              <li
                key={scorer.id}
                className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-line px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{scorer.name}</p>
                  <p className="mono truncate text-[0.6875rem] text-muted">@{scorer.username}</p>
                </div>

                <button
                  type="button"
                  onClick={() => remove.mutate(scorer.id)}
                  aria-label={`Remove ${scorer.name}`}
                  className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-alert"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                    <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.9375rem] text-muted">
            Nobody is assigned yet. As the organizer you can always score it yourself.
          </p>
        )}

        <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[15rem] flex-1">
            <Input
              label="Assign by handle"
              placeholder="whynotramaa"
              value={username}
              error={fieldError}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={username.trim().length < 3} isLoading={assign.isPending}>
            Assign
          </Button>
        </form>

        {remove.error ? <ErrorText error={remove.error} /> : null}
      </CardBody>
    </Card>
  );
}
