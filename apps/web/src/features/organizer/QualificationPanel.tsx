import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
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
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.8125rem] font-semibold">Qualification</h2>
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-raised p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Select
              label="Team"
              value={targetTeamId}
              onChange={(event) => setTargetTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-24">
            <Input
              label="Spots"
              type="number"
              min={1}
              max={teams.length}
              value={spots}
              onChange={(event) => setSpots(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Refresh
          </Button>
        </div>

        {query.isPending ? <Skeleton className="h-16" /> : null}
        {query.error ? <ErrorText error={query.error} /> : null}
        {query.data?.tooComplex ? (
          <p className="text-[0.8125rem] text-secondary">
            {query.data.relevantFixtureCount} fixtures left. Too many to enumerate yet.
          </p>
        ) : query.data ? (
          <dl className="grid grid-cols-3 divide-x divide-line rounded-[var(--radius-md)] border border-line">
            <Metric label="Qualifies in" value={`${qualifying}/${total}`} />
            <Metric label="Fixtures" value={query.data.relevantFixtureCount} />
            <Metric
              label="On NRR"
              value={query.data.scenarios.filter((scenario) => scenario.requiresNrr).length}
            />
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="tabular text-lg font-semibold tracking-[-0.03em]">{value}</dd>
    </div>
  );
}
