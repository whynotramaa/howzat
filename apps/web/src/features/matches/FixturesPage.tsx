import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MatchDto } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui/Card';
import { MatchCard, type MatchSide } from '@/components/ui/MatchCard';
import { Scene } from '@/components/ui/Sketch';
import { stageLabel } from '@/lib/pdf/sources';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
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

  const done = matches.filter((match) => match.status === 'COMPLETED').length;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        back={<BackLink to={`/tournaments/${tournamentId}`}>{tournament.data.name}</BackLink>}
        eyebrow={
          hasFixtures
            ? `${matches.length} matches · ${tournament.data.doubleRoundRobin ? 'Home and away' : 'Single round robin'}`
            : 'Not drawn yet'
        }
        title={
          <>
            The <em>fixtures</em>
          </>
        }
        description={
          hasFixtures
            ? `${done} of ${matches.length} played. Set up a match to toss and pick the XIs, or open the public page to follow along.`
            : 'Howzat pairs every team so nobody plays twice in a round. Preview the draw first, then lock it in.'
        }
        art={<Scene name="fixtures" />}
        actions={
          <>
            {!hasFixtures ? (
              <>
                <Button isLoading={generate.isPending} onClick={() => void handleGenerate(false)}>
                  Generate fixtures
                </Button>
                <Button
                  variant="secondary"
                  isLoading={preview.isPending}
                  onClick={() => preview.mutate()}
                >
                  Preview the draw
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                disabled={started}
                title={started ? 'A match has started' : undefined}
                onClick={() => setConfirmRegenerate(true)}
              >
                Regenerate
              </Button>
            )}
            <ShareLink
              slug={tournamentId}
              url={`${window.location.origin}/tournament/${tournamentId}`}
              label="Share"
              matchLabel={tournament.data.name}
              variant="quiet"
            />
          </>
        }
      />

      {preview.error ? <ErrorText error={preview.error} /> : null}
      {generate.error ? <ErrorText error={generate.error} /> : null}

      {preview.data && !hasFixtures ? (
        <section className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="Preview"
            title={`${preview.data.totalMatches} matches in the draw`}
            description="Nothing is saved yet. Generate when the pairings look right."
            action={
              <Button size="sm" isLoading={generate.isPending} onClick={() => void handleGenerate(false)}>
                Lock it in
              </Button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {preview.data.rounds.map((round) => (
              <div key={round.round} className="rounded-[var(--radius-xl)] border border-line bg-raised p-4">
                <p className="eyebrow">Round {round.round}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {round.matches.map((match) => (
                    <li
                      key={`${match.home.id}-${match.away.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[0.8125rem]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <TeamMark shortName={match.home.shortName} color={match.home.primaryColor} size="sm" />
                        <span className="truncate font-medium">{match.home.name}</span>
                      </span>
                      <span className="font-serif text-muted italic">v</span>
                      <span className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
                        <TeamMark shortName={match.away.shortName} color={match.away.primaryColor} size="sm" />
                        <span className="truncate font-medium">{match.away.name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {preview.data.playoffs.length > 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-dashed border-line-strong p-4">
                <p className="eyebrow">Playoffs</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {preview.data.playoffs.map((slot) => (
                    <li key={slot.stage} className="text-[0.8125rem]">
                      <span className="font-semibold">{slot.label}</span>{' '}
                      <span className="text-muted">{slot.description}</span>
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
      ) : !preview.data ? (
        <EmptyState
          scene="fixtures"
          title="No fixtures yet"
          description="Generate once every squad is full. You can preview the draw before anything is saved."
          action={
            <Button size="sm" isLoading={generate.isPending} onClick={() => void handleGenerate(false)}>
              Generate fixtures
            </Button>
          }
        />
      ) : null}

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
    <div className="flex flex-col gap-12">
      {rounds.map((round) => {
        const inRound = matches.filter((match) => match.round === round);
        const isPlayoff = inRound.every((match) => match.stage !== 'LEAGUE');
        const finished = inRound.filter((match) => match.status === 'COMPLETED').length;

        return (
          <section key={round} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h2 className="serif text-[1.875rem]">{isPlayoff ? 'Playoffs' : `Round ${round}`}</h2>
              <span className="tabular text-xs text-muted">
                {finished}/{inRound.length} played
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {inRound.map((match, index) => (
                <FixtureCard key={match.id} match={match} index={index} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FixtureCard({ match, index }: { match: MatchDto; index: number }) {
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const primaryLabel = match.status === 'SCHEDULED' ? 'Set up' : live ? 'Score' : 'Details';
  const side = (team: MatchDto['team1']): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;

  return (
    <MatchCard
      className="reveal"
      style={{ '--delay': `${index * 50}ms` } as CSSProperties}
      eyebrow={stageLabel(match.stage, match.round)}
      status={match.status}
      home={side(match.team1)}
      away={side(match.team2)}
      result={match.resultText}
      to={`/matches/${match.id}`}
      meta={[
        match.sport === 'FOOTBALL' ? 'Football' : `${match.oversPerInnings} overs`,
        match.scorers.length > 0
          ? match.scorers.map((scorer) => `@${scorer.username}`).join(', ')
          : 'No scorer yet',
      ].join(' · ')}
      actions={
        <>
          <a
            href={`/live/${match.publicSlug}${match.resultText ? '?view=scorecard' : ''}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open public page"
            title="Open public page"
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-primary"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4"
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
            <Button size="sm" variant={match.status === 'SCHEDULED' || live ? 'primary' : 'secondary'}>
              {primaryLabel}
            </Button>
          </Link>
        </>
      }
    />
  );
}
