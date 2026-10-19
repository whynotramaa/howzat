import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MatchDto } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { StatusPill, TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { useTournament } from '@/features/organizer/queries';
import { useFixtures, useGenerateFixtures, usePreviewFixtures } from './queries';

export function FixturesPage() {
  const { tournamentId = '' } = useParams();

  const tournament = useTournament(tournamentId);
  const fixtures = useFixtures(tournamentId);
  const preview = usePreviewFixtures(tournamentId);
  const generate = useGenerateFixtures(tournamentId);

  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const matches = fixtures.data?.items ?? [];
  const hasFixtures = matches.length > 0;
  const started = matches.some((match) => match.status !== 'SCHEDULED');

  async function handleGenerate(regenerate: boolean) {
    await generate.mutateAsync(regenerate);
    preview.reset();
    setConfirmRegenerate(false);
  }

  if (tournament.isPending) return <SkeletonCard rows={4} />;
  if (tournament.error) return <ErrorText error={tournament.error} />;
  if (!tournament.data) return null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink to={`/tournaments/${tournamentId}`}>{tournament.data.name}</BackLink>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="serif text-[2.75rem] leading-[1.05]">Fixtures</h1>
          <p className="tabular text-xs text-muted">
            {hasFixtures
              ? `${matches.length} matches · ${tournament.data.doubleRoundRobin ? 'home and away' : 'single round robin'}`
              : 'Not generated'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ShareLink
            slug={tournamentId}
            url={`${window.location.origin}/tournament/${tournamentId}`}
            label="Share"
            matchLabel={tournament.data.name}
            variant="quiet"
          />
          {!hasFixtures ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                isLoading={preview.isPending}
                onClick={() => preview.mutate()}
              >
                Preview
              </Button>
              <Button
                size="sm"
                isLoading={generate.isPending}
                onClick={() => void handleGenerate(false)}
              >
                Generate
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={started}
              title={started ? 'A match has started' : undefined}
              onClick={() => setConfirmRegenerate(true)}
            >
              Regenerate
            </Button>
          )}
        </div>
      </header>

      {preview.error ? <ErrorText error={preview.error} /> : null}
      {generate.error ? <ErrorText error={generate.error} /> : null}

      {preview.data && !hasFixtures ? (
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
            <h2 className="text-[0.8125rem] font-semibold">
              Preview{' '}
              <span className="tabular font-normal text-muted">{preview.data.totalMatches}</span>
            </h2>
            <Button
              size="sm"
              isLoading={generate.isPending}
              onClick={() => void handleGenerate(false)}
            >
              Generate
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {preview.data.rounds.map((round) => (
              <div key={round.round} className="border-b border-line px-4 py-3 sm:border-r">
                <p className="eyebrow mb-2">Round {round.round}</p>
                <ul className="flex flex-col gap-1">
                  {round.matches.map((match) => (
                    <li
                      key={`${match.home.id}-${match.away.id}`}
                      className="truncate text-[0.8125rem]"
                    >
                      {match.home.name} <span className="text-muted">v</span> {match.away.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {preview.data.playoffs.length > 0 ? (
              <div className="border-b border-line px-4 py-3">
                <p className="eyebrow mb-2">Playoffs</p>
                <ul className="flex flex-col gap-1">
                  {preview.data.playoffs.map((slot) => (
                    <li key={slot.stage} className="text-[0.8125rem]">
                      {slot.label} <span className="text-muted">{slot.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {fixtures.isPending ? (
        <SkeletonCard rows={3} />
      ) : fixtures.error ? (
        <ErrorText error={fixtures.error} />
      ) : hasFixtures ? (
        <RoundList matches={matches} />
      ) : (
        <EmptyState
          title="No fixtures"
          description="Generate once every squad is full."
          action={
            <Button
              size="sm"
              isLoading={generate.isPending}
              onClick={() => void handleGenerate(false)}
            >
              Generate
            </Button>
          }
        />
      )}

      <Sheet
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        title="Regenerate fixtures?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRegenerate(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={generate.isPending}
              onClick={() => void handleGenerate(true)}
            >
              Regenerate
            </Button>
          </>
        }
      >
        <p className="text-[0.8125rem] text-secondary">
          Replaces every unstarted fixture and clears scorer assignments.
        </p>
      </Sheet>
    </div>
  );
}

function RoundList({ matches }: { matches: MatchDto[] }) {
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-6">
      {rounds.map((round) => {
        const inRound = matches.filter((match) => match.round === round);
        const isPlayoff = inRound.every((match) => match.stage !== 'LEAGUE');

        return (
          <section key={round}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[0.8125rem] font-semibold">
                {isPlayoff ? 'Playoffs' : `Round ${round}`}
              </h2>
              <span className="tabular text-xs text-muted">{inRound.length}</span>
            </div>
            <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
              {inRound.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({ match }: { match: MatchDto }) {
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const primaryLabel = match.status === 'SCHEDULED' ? 'Set up' : live ? 'Score' : 'Details';

  return (
    <li className="ledger-row flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 last:border-0">
      <Link to={`/matches/${match.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <Side team={match.team1} />
          <Side team={match.team2} />
        </span>
      </Link>

      <p className="hidden min-w-0 flex-1 truncate text-xs text-muted md:block">
        {match.resultText ??
          [
            match.stage === 'LEAGUE' ? null : match.stage.replace(/_/g, ' ').toLowerCase(),
            match.sport === 'FOOTBALL' ? 'Football' : `${match.oversPerInnings} ov`,
            match.scorers.length > 0
              ? match.scorers.map((scorer) => `@${scorer.username}`).join(', ')
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
      </p>

      <div className="flex items-center gap-1.5">
        <StatusPill status={match.status} />
        <a
          href={`/live/${match.publicSlug}${match.resultText ? '?view=scorecard' : ''}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Open public page"
          className="grid size-8 place-items-center rounded-[var(--radius-md)] text-muted hover:bg-sunken hover:text-primary"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" />
          </svg>
        </a>
        <ShareLink
          slug={match.publicSlug}
          variant="quiet"
          matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
        />
        <Link to={`/matches/${match.id}`}>
          <Button
            size="sm"
            variant={match.status === 'SCHEDULED' || live ? 'primary' : 'secondary'}
          >
            {primaryLabel}
          </Button>
        </Link>
      </div>
    </li>
  );
}

function Side({ team }: { team: MatchDto['team1'] }) {
  if (!team) return <span className="text-[0.8125rem] text-muted">TBD</span>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
      <span className="truncate text-[0.8125rem] font-medium">{team.name}</span>
    </span>
  );
}
