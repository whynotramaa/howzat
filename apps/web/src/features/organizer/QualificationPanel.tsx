import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, SectionHeading } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { api } from '@/lib/api';

interface QualificationResponse {
  targetTeamId: string;
  qualificationSpots: number;
  relevantFixtureCount: number;
  tooComplex: boolean;
  scenarios: Array<{
    outcomes: Record<string, string>;
    qualified: boolean;
    rank: number;
    requiresNrr: boolean;
  }>;
  fixtures: Array<{ fixtureId: string; label: string }>;
}

export function QualificationPanel({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: Array<{ id: string; name: string }>;
}) {
  const [targetTeamId, setTargetTeamId] = useState(teams[0]?.id ?? '');
  const [spots, setSpots] = useState(4);
  const query = useQuery({
    queryKey: ['tournaments', tournamentId, 'qualification', targetTeamId, spots],
    queryFn: () =>
      api.get<QualificationResponse>(
        `/tournaments/${tournamentId}/qualification?teamId=${encodeURIComponent(targetTeamId)}&spots=${spots}`,
      ),
    enabled: Boolean(targetTeamId),
  });

  if (teams.length === 0) return null;

  const qualifying = query.data?.scenarios.filter((scenario) => scenario.qualified).length ?? 0;
  const total = query.data?.scenarios.length ?? 0;

  return (
    <section className="flex flex-col gap-7">
      <SectionHeading
        eyebrow="What-if desk"
        title="Qualification scenarios"
        description="A bounded view of the remaining fixtures that can change this side’s position. Tied outcomes are flagged for NRR review."
      />
      <Card>
        <CardBody className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-52 flex-1 flex-col gap-2 text-sm text-secondary">
              Team
              <select
                className="h-11 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-primary"
                value={targetTeamId}
                onChange={(event) => setTargetTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-28 flex flex-col gap-2 text-sm text-secondary">
              Spots
              <input
                className="h-11 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-primary"
                type="number"
                min={1}
                max={teams.length}
                value={spots}
                onChange={(event) => setSpots(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Refresh
            </Button>
          </div>

          {query.isPending ? <Skeleton className="h-24" /> : null}
          {query.error ? <ErrorText error={query.error} /> : null}
          {query.data?.tooComplex ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-4 py-3 text-sm text-primary">
              There are {query.data.relevantFixtureCount} relevant fixtures. Narrow the tournament
              or revisit this after the next result.
            </p>
          ) : query.data ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Can qualify" value={`${qualifying}/${total}`} />
              <Metric label="Relevant matches" value={query.data.relevantFixtureCount} />
              <Metric
                label="NRR calls"
                value={query.data.scenarios.filter((scenario) => scenario.requiresNrr).length}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-4 py-4">
      <p className="mono text-2xl font-medium text-primary">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
    </div>
  );
}
