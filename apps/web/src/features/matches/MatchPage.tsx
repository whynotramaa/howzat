import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PLAYERS_PER_TEAM, type MatchWithInningsDto, type TossDecision } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Card';
import { MatchHero, type MatchSide } from '@/components/ui/MatchCard';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { stageLabel } from '@/lib/pdf/sources';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { useTournament } from '@/features/organizer/queries';
import { cn } from '@/lib/cn';
import {
  useAbandonMatch,
  useAssignScorer,
  useMatch,
  useRecordToss,
  useRemoveScorer,
  useResumeInnings,
  useSetPlayingXi,
  useSquads,
  useStartMatch,
  type SquadSide,
} from './queries';

interface XiSelection {
  order: string[];
  captainId: string | null;
  keeperId: string | null;
}

export function MatchPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const onScoreRoute = useLocation().pathname.endsWith('/score');

  const match = useMatch(matchId);
  const squads = useSquads(matchId);
  const resume = useResumeInnings(matchId);

  if (match.isPending) return <SkeletonCard rows={4} />;
  if (match.error) return <ErrorText error={match.error} />;
  if (!match.data) return null;

  const data = match.data;
  const setupOpen = data.status === 'SCHEDULED' || data.status === 'TOSS';
  const pendingInnings = data.innings.find((entry) => entry.status === 'IN_PROGRESS');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <MatchHeader match={data} back={onScoreRoute ? '/dashboard' : undefined} />

      {data.status === 'LIVE' ? (
        <ButtonLink to={`/matches/${matchId}/score`} size="lg">
          Resume scoring
        </ButtonLink>
      ) : null}

      {data.status === 'INNINGS_BREAK' ? (
        <Button
          size="lg"
          isLoading={resume.isPending}
          onClick={async () => {
            if (!pendingInnings) return;
            await resume.mutateAsync(pendingInnings.number);
            void navigate(`/matches/${matchId}/score`);
          }}
        >
          Start innings {pendingInnings?.number ?? 2}
        </Button>
      ) : null}
      {resume.error ? <ErrorText error={resume.error} /> : null}

      {setupOpen ? (
        squads.isPending ? (
          <SkeletonCard rows={5} />
        ) : squads.error ? (
          <ErrorText error={squads.error} />
        ) : squads.data?.team1 && squads.data.team2 ? (
          <Setup match={data} sides={[squads.data.team1, squads.data.team2]} />
        ) : (
          <EmptyState compact title="Waiting on earlier results" />
        )
      ) : null}

      <ScorersCard match={data} />
    </div>
  );
}

function MatchHeader({ match, back }: { match: MatchWithInningsDto; back?: string }) {
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const side = (team: MatchWithInningsDto['team1']): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;
  const toss =
    match.tossWinnerId && match.tossDecision
      ? `${nameOfTeam(match, match.tossWinnerId)} chose to ${match.tossDecision === 'BAT' ? 'bat' : 'bowl'}`
      : null;

  return (
    <div className="flex flex-col gap-2">
      <BackLink to={back ?? `/tournaments/${match.tournamentId}?tab=fixtures`}>
        {back ? 'Matches' : 'Fixtures'}
      </BackLink>
      <MatchHero
        eyebrow={[stageLabel(match.stage, match.round), `${match.oversPerInnings} overs`, match.venue]
          .filter(Boolean)
          .join(' · ')}
        status={match.status}
        home={side(match.team1)}
        away={side(match.team2)}
        result={finished ? (match.resultText ?? 'No result') : undefined}
        detail={toss}
        actions={
          <>
            <ButtonLink
              to={`/live/${match.publicSlug}${finished ? '?view=scorecard' : ''}`}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="secondary"
            >
              {finished ? 'Scorecard' : 'Public page'}
            </ButtonLink>
            {finished ? (
              <PdfButton
                label="PDF"
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
                }
              />
            ) : null}
            <ShareLink
              slug={match.publicSlug}
              label="Share"
              matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
            />
          </>
        }
      />
    </div>
  );
}

function nameOfTeam(match: MatchWithInningsDto, teamId: string): string {
  if (match.team1?.id === teamId) return match.team1.name;
  if (match.team2?.id === teamId) return match.team2.name;
  return 'The winner';
}

function Setup({ match, sides }: { match: MatchWithInningsDto; sides: [SquadSide, SquadSide] }) {
  const navigate = useNavigate();
  const recordToss = useRecordToss(match.id);
  const setXi = useSetPlayingXi(match.id);
  const start = useStartMatch(match.id);

  const [winnerId, setWinnerId] = useState(match.tossWinnerId ?? '');
  const [decision, setDecision] = useState<TossDecision>(match.tossDecision ?? 'BAT');
  const [selections, setSelections] = useState<Record<string, XiSelection>>(() =>
    Object.fromEntries(sides.map((side) => [side.id, initialSelection(side)])),
  );
  const [open, setOpen] = useState<string>(sides[0].id);

  const complete = sides.every((side) => {
    const selection = selections[side.id];
    return selection?.order.length === PLAYERS_PER_TEAM && selection.captainId !== null;
  });
  const busy = recordToss.isPending || setXi.isPending || start.isPending;
  const error = recordToss.error ?? setXi.error ?? start.error;

  function toggle(sideId: string, playerId: string) {
    setSelections((current) => {
      const selection = current[sideId] ?? { order: [], captainId: null, keeperId: null };
      if (selection.order.includes(playerId)) {
        const order = selection.order.filter((id) => id !== playerId);
        return {
          ...current,
          [sideId]: {
            order,
            captainId: selection.captainId === playerId ? (order[0] ?? null) : selection.captainId,
            keeperId: selection.keeperId === playerId ? null : selection.keeperId,
          },
        };
      }
      if (selection.order.length >= PLAYERS_PER_TEAM) return current;
      return {
        ...current,
        [sideId]: {
          ...selection,
          order: [...selection.order, playerId],
          captainId: selection.captainId ?? playerId,
        },
      };
    });
  }

  function setRole(sideId: string, playerId: string, role: 'captainId' | 'keeperId') {
    setSelections((current) => {
      const selection = current[sideId];
      if (!selection || !selection.order.includes(playerId)) return current;
      return {
        ...current,
        [sideId]: { ...selection, [role]: selection[role] === playerId ? null : playerId },
      };
    });
  }

  async function handleStart(event: FormEvent) {
    event.preventDefault();
    if (match.tossWinnerId !== winnerId || match.tossDecision !== decision)
      await recordToss.mutateAsync({ tossWinnerId: winnerId, decision });
    await setXi.mutateAsync({
      teams: sides.map((side) => {
        const selection = selections[side.id]!;
        return {
          teamId: side.id,
          players: selection.order.map((playerId, index) => ({
            playerId,
            battingOrder: index + 1,
            isCaptain: selection.captainId === playerId,
            isKeeper: selection.keeperId === playerId,
          })),
        };
      }),
    });
    await start.mutateAsync();
    void navigate(`/matches/${match.id}/score`);
  }

  return (
    <form onSubmit={handleStart} className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-lg)] border border-line bg-raised p-4">
        <h2 className="mb-3 text-[0.8125rem] font-medium text-muted">Toss won by</h2>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          {sides.map((side) => (
            <button
              key={side.id}
              type="button"
              aria-pressed={winnerId === side.id}
              onClick={() => setWinnerId(side.id)}
              className={cn(
                'flex h-12 min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] border px-3 text-left transition-colors',
                winnerId === side.id
                  ? 'border-[var(--text-primary)] bg-sunken'
                  : 'border-line hover:border-line-strong',
              )}
            >
              <TeamMark shortName={side.shortName} color={side.primaryColor} size="sm" />
              <span className="min-w-0 truncate text-sm font-medium">{side.name}</span>
            </button>
          ))}
          <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-line bg-sunken p-1">
            {(['BAT', 'BOWL'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={decision === option}
                onClick={() => setDecision(option)}
                className={cn(
                  'h-10 rounded-[6px] border px-4 text-sm font-medium transition-colors',
                  decision === option
                    ? 'border-line bg-raised text-primary'
                    : 'border-transparent text-muted hover:text-primary',
                )}
              >
                {option === 'BAT' ? 'Bat' : 'Bowl'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
        <div className="grid grid-cols-2 border-b border-line">
          {sides.map((side) => {
            const count = selections[side.id]?.order.length ?? 0;
            return (
              <button
                key={side.id}
                type="button"
                onClick={() => setOpen(side.id)}
                aria-pressed={open === side.id}
                className={cn(
                  'flex h-12 min-w-0 items-center gap-2 border-b-2 px-3 text-left text-sm font-medium sm:px-4',
                  open === side.id
                    ? 'border-[var(--text-primary)] text-primary'
                    : 'border-transparent text-muted',
                )}
              >
                <TeamMark shortName={side.shortName} color={side.primaryColor} size="sm" />
                <span className="min-w-0 flex-1 truncate">{side.name}</span>
                <span
                  className={cn(
                    'mono text-xs',
                    count === PLAYERS_PER_TEAM ? 'text-success' : 'text-muted',
                  )}
                >
                  {count}/{PLAYERS_PER_TEAM}
                </span>
              </button>
            );
          })}
        </div>
        {sides
          .filter((side) => side.id === open)
          .map((side) => {
            const selection = selections[side.id] ?? { order: [], captainId: null, keeperId: null };
            return (
              <ul key={side.id}>
                {side.players.map((player) => {
                  const position = selection.order.indexOf(player.id);
                  const picked = position >= 0;
                  return (
                    <li
                      key={player.id}
                      className={cn(
                        'flex items-center gap-1.5 border-b border-line px-3 last:border-0 sm:px-4',
                        picked ? '' : 'text-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(side.id, player.id)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
                        aria-pressed={picked}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mono grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold',
                            picked ? 'bg-accent-fill text-on-accent' : 'border border-line-strong',
                          )}
                        >
                          {picked ? position + 1 : ''}
                        </span>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            picked && 'font-medium text-primary',
                          )}
                        >
                          {player.name}
                        </span>
                      </button>
                      <RoleToggle
                        label="C"
                        active={selection.captainId === player.id}
                        disabled={!picked}
                        onClick={() => setRole(side.id, player.id, 'captainId')}
                      />
                      <RoleToggle
                        label="WK"
                        active={selection.keeperId === player.id}
                        disabled={!picked}
                        onClick={() => setRole(side.id, player.id, 'keeperId')}
                      />
                    </li>
                  );
                })}
              </ul>
            );
          })}
      </section>

      {error ? <ErrorText error={error} /> : null}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" fullWidth disabled={!winnerId || !complete} isLoading={busy}>
          {!winnerId ? 'Pick the toss winner' : !complete ? 'Pick both XIs' : 'Start match'}
        </Button>
      </div>
    </form>
  );
}

function initialSelection(side: SquadSide): XiSelection {
  const picked = side.players
    .filter((player) => player.selected)
    .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));
  if (picked.length === 0) {
    const order = side.players.slice(0, PLAYERS_PER_TEAM).map((player) => player.id);
    return { order, captainId: order[0] ?? null, keeperId: null };
  }
  return {
    order: picked.map((player) => player.id),
    captainId: picked.find((player) => player.isCaptain)?.id ?? null,
    keeperId: picked.find((player) => player.isKeeper)?.id ?? null,
  };
}

function RoleToggle({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label === 'C' ? 'Captain' : 'Wicketkeeper'}
      className={cn(
        'grid h-7 min-w-8 shrink-0 place-items-center rounded-[6px] px-2 text-[0.6875rem] font-semibold transition-colors',
        active ? 'bg-inverse text-on-inverse' : 'border border-line text-muted',
        disabled && 'opacity-30',
      )}
    >
      {label}
    </button>
  );
}

function ScorersCard({ match }: { match: MatchWithInningsDto }) {
  const tournament = useTournament(match.tournamentId);
  const assign = useAssignScorer(match.tournamentId, match.id);
  const remove = useRemoveScorer(match.tournamentId, match.id);
  const abandon = useAbandonMatch(match.id);

  const [username, setUsername] = useState('');
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  if (!tournament.data) return null;
  const canAbandon = match.status !== 'COMPLETED' && match.status !== 'ABANDONED';

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    await assign.mutateAsync(username);
    setUsername('');
  }

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-line bg-raised p-4">
        <h2 className="mb-3 text-[0.8125rem] font-medium text-muted">Scorers</h2>
        {match.scorers.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-1">
            {match.scorers.map((scorer) => (
              <li key={scorer.id} className="flex items-center gap-2.5">
                <PlayerAvatar seed={scorer.username} name={scorer.name} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {scorer.name} <span className="text-muted">@{scorer.username}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(scorer.id)}
                  aria-label={`Remove ${scorer.name}`}
                  className="grid size-8 place-items-center rounded-[var(--radius-md)] text-muted hover:bg-hover hover:text-alert"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor">
                    <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={handleAssign} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label="Add by username"
              placeholder="username"
              value={username}
              error={assign.error instanceof Error ? assign.error.message : null}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={username.trim().length < 3}
            isLoading={assign.isPending}
          >
            Add
          </Button>
        </form>
        {remove.error ? <ErrorText error={remove.error} /> : null}
        {canAbandon ? (
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <Button
              variant="quiet"
              size="sm"
              className="text-alert"
              onClick={() => setConfirmAbandon(true)}
            >
              Abandon match
            </Button>
          </div>
        ) : null}
        {abandon.error ? <ErrorText error={abandon.error} /> : null}
      </section>

      <Sheet
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandon match?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAbandon(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={abandon.isPending}
              onClick={() => {
                abandon.mutate(undefined);
                setConfirmAbandon(false);
              }}
            >
              Abandon
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">Records no result. Scored balls are kept.</p>
      </Sheet>
    </>
  );
}
