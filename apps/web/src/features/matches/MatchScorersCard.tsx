import { useMemo, useState, type FormEvent } from 'react';
import type { UserRef } from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorText } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useTournament } from '@/features/organizer/queries';
import { useAssignScorer, useRemoveScorer } from './queries';

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
      <CardHeader className="border-0 pb-0">
        <h2 className="text-[0.8125rem] font-medium text-muted">Scorers</h2>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {scorers.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {scorers.map((scorer) => (
              <li
                key={scorer.id}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line px-3 py-2.5"
              >
                <PlayerAvatar seed={scorer.username} name={scorer.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{scorer.name}</p>
                  <p className="mono truncate text-[0.6875rem] text-muted">@{scorer.username}</p>
                </div>

                <button
                  type="button"
                  onClick={() => remove.mutate(scorer.id)}
                  aria-label={`Remove ${scorer.name}`}
                  className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-alert"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                    <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-4 py-4 text-center text-xs text-muted">
            Nobody assigned yet. As organiser you can score it yourself.
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
