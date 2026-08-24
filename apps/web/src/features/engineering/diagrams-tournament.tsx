import { useMemo, useState } from 'react';
import {
  aggregateStandings,
  ballsAsOversText,
  formatNrr,
  sortStandings,
  type MatchResult,
} from '@howzat/shared';
import { Btn, Controls, Figure, Icon } from './chrome';
import { cn } from '@/lib/cn';

/* ================================================================== *
 * 1. Every cache in the system, and what it costs when Redis is gone
 * ================================================================== */

interface CacheEntry {
  key: string;
  what: string;
  ttl: string;
  refresh: string;
  /** What a reader gets when Redis answers nothing. */
  down: string;
  /** Whether losing it costs correctness or only speed. */
  fatal: boolean;
}

const CACHES: CacheEntry[] = [
  {
    key: 'match:{id}:snapshot',
    what: 'The whole live scorecard, folded from the event log',
    ttl: '6 hours',
    refresh: 'Written by the ball write, guarded by lastEventSeq',
    down: 'Every read folds the log again. Slower, never wrong.',
    fatal: false,
  },
  {
    key: 'standings:{tournamentId}',
    what: 'The sorted points table, ready to serve',
    ttl: '5 minutes',
    refresh: 'Deleted the moment a match completes',
    down: 'Rebuilt from PointsTable rows on the next request.',
    fatal: false,
  },
  {
    key: 'stats:{tournamentId}',
    what: 'Leaderboards: runs, wickets, strike rates',
    ttl: '60 seconds',
    refresh: 'Deleted on match completion',
    down: 'Recomputed from the log. The expensive one.',
    fatal: false,
  },
  {
    key: 'authz:match:{id}:user:{id}',
    what: 'Is this person allowed to score this match',
    ttl: '60 seconds',
    refresh: 'SCAN and delete when an assignment moves',
    down: 'Falls through to Postgres. The check still runs.',
    fatal: false,
  },
  {
    key: 'slug:{publicSlug}',
    what: 'Public slug to match id',
    ttl: '24 hours',
    refresh: 'Never invalidated — a slug never changes owner',
    down: 'One indexed lookup instead of none.',
    fatal: false,
  },
  {
    key: 'rl:{scope}:{subject}',
    what: 'Rate limit counters',
    ttl: 'The window',
    refresh: 'INCR on each request, TTL set on the first',
    down: 'Fails open. A cost guard must not make a match unscorable.',
    fatal: false,
  },
  {
    key: 'lock:match:{id}',
    what: 'The scoring lease',
    ttl: '5 seconds',
    refresh: 'SET NX per write, released by a Lua compare-and-delete',
    down: 'Writes serialise on the Postgres unique index instead.',
    fatal: false,
  },
];

export function CacheMap() {
  const [down, setDown] = useState(false);

  return (
    <Figure
      label="Figure 10 — the cache inventory"
      hint="Press Kill Redis. Every card flips to what a reader gets instead. Nothing turns red, and that is the point."
      controls={
        <Controls label="The whole cache tier" tone={down ? 'danger' : undefined}>
          <Btn onClick={() => setDown((d) => !d)} tone={down ? undefined : 'primary'} active={down}>
            <Icon name="offline" />
            {down ? 'Bring Redis back' : 'Kill Redis'}
          </Btn>
        </Controls>
      }
      caption="Seven caches, one rule: every value here is derivable from Postgres. That is what makes the whole tier optional at runtime and lets each call site swallow its own Redis error."
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {CACHES.map((entry) => (
          <div
            key={entry.key}
            className={cn(
              'flex flex-col gap-1.5 rounded-[var(--radius-md)] border p-3 transition-colors',
              down
                ? 'border-[color-mix(in_oklab,var(--warning)_35%,var(--line))] bg-[color-mix(in_oklab,var(--warning)_7%,var(--surface-raised))]'
                : 'border-line bg-raised',
            )}
          >
            <span className="eng-key">{entry.key}</span>
            <span className="text-[0.8125rem] text-primary">{entry.what}</span>
            {down ? (
              <span className="text-[0.8125rem] text-secondary">
                <span className="eyebrow mr-1.5 text-warning">without redis</span>
                {entry.down}
              </span>
            ) : (
              <span className="text-[0.8125rem] text-secondary">
                <span className="mono mr-1.5 text-[0.6875rem] text-muted">ttl {entry.ttl}</span>
                {entry.refresh}
              </span>
            )}
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 2. The points table, folded by the real production functions
 * ================================================================== */

const TEAMS = [
  { id: 'kin', name: 'Kingfishers' },
  { id: 'rov', name: 'Rovers' },
  { id: 'sul', name: 'Sultans' },
  { id: 'tit', name: 'Titans' },
];

const TEAM_NAME = (id: string) => TEAMS.find((team) => team.id === id)?.name ?? id;

interface Knobs {
  quota: boolean;
  abandon: boolean;
  dls: boolean;
}

/**
 * Three completed twenty-over matches. The knobs change one fact each, and the
 * table below is folded by `aggregateStandings` and `sortStandings` — the same
 * two functions the API calls. Nothing here reimplements the maths.
 */
function buildResults(knobs: Knobs): MatchResult[] {
  // `chargeableBalls` charges an all-out side its full quota. Turning the knob
  // off drops the end reason, so the side is charged only the balls it faced.
  const allOut = knobs.quota ? ('ALL_OUT' as const) : null;

  return [
    {
      matchId: 'm1',
      teamIds: ['kin', 'rov'],
      winnerTeamId: 'kin',
      noResult: false,
      innings: [
        {
          battingTeamId: 'kin',
          bowlingTeamId: 'rov',
          runs: 164,
          legalBalls: 120,
          oversQuota: 20,
          endReason: 'OVERS_COMPLETE',
        },
        {
          battingTeamId: 'rov',
          bowlingTeamId: 'kin',
          runs: 140,
          legalBalls: 108,
          oversQuota: 20,
          endReason: allOut,
        },
      ],
    },
    {
      matchId: 'm2',
      teamIds: ['tit', 'sul'],
      winnerTeamId: 'sul',
      noResult: false,
      dls: knobs.dls ? { parScore: 118 } : null,
      innings: [
        {
          battingTeamId: 'tit',
          bowlingTeamId: 'sul',
          runs: 122,
          legalBalls: 96,
          oversQuota: 20,
          endReason: allOut,
        },
        {
          battingTeamId: 'sul',
          bowlingTeamId: 'tit',
          runs: 126,
          legalBalls: 105,
          oversQuota: 20,
          endReason: 'TARGET_CHASED',
        },
      ],
    },
    {
      matchId: 'm3',
      teamIds: ['kin', 'sul'],
      winnerTeamId: knobs.abandon ? null : 'kin',
      noResult: knobs.abandon,
      innings: [
        {
          battingTeamId: 'sul',
          bowlingTeamId: 'kin',
          runs: 158,
          legalBalls: 120,
          oversQuota: 20,
          endReason: 'OVERS_COMPLETE',
        },
        {
          battingTeamId: 'kin',
          bowlingTeamId: 'sul',
          runs: 159,
          legalBalls: 114,
          oversQuota: 20,
          endReason: 'TARGET_CHASED',
        },
      ],
    },
  ];
}

const KNOB_NOTE: Record<keyof Knobs, string> = {
  quota:
    'Off: a side bowled out in 18 overs is charged 18 overs, and losing badly with balls to spare improves its run rate. On, which is the real rule, it is charged the full 20.',
  abandon:
    'Match three is abandoned. Both sides take a point, and neither innings contributes a single run or ball to net run rate — the fold skips them entirely.',
  dls: 'Match two was called with Titans on 122 and a DLS par of 118. Net run rate charges the first innings the par score, not the runs actually made, so the two rows stay comparable.',
};

export function StandingsLab() {
  const [knobs, setKnobs] = useState<Knobs>({ quota: true, abandon: false, dls: false });
  const [last, setLast] = useState<keyof Knobs | null>(null);

  const rows = useMemo(() => {
    const results = buildResults(knobs);
    const totals = aggregateStandings(
      TEAMS.map((team) => team.id),
      results,
    );
    return sortStandings(totals, results, TEAM_NAME);
  }, [knobs]);

  const toggle = (key: keyof Knobs) => {
    setKnobs((prev) => ({ ...prev, [key]: !prev[key] }));
    setLast(key);
  };

  return (
    <Figure
      label="Figure 11 — the points table, folded live"
      hint="Change a fact about one match and watch the table move. This runs the same aggregateStandings and sortStandings the API runs."
      controls={
        <Controls label="Change one fact">
          <Btn onClick={() => toggle('quota')} active={knobs.quota}>
            Charge an all-out side its full quota
          </Btn>
          <Btn onClick={() => toggle('abandon')} active={knobs.abandon}>
            Abandon match three
          </Btn>
          <Btn onClick={() => toggle('dls')} active={knobs.dls}>
            Match two decided by DLS
          </Btn>
        </Controls>
      }
      caption="Three matches, four teams. Points are trivial. Net run rate is where every tournament argument actually happens, which is why it is folded from the ball log rather than typed in by anyone."
    >
      <div className="eng-scroll">
        <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line text-left">
              {['#', 'Team', 'P', 'W', 'L', 'T', 'NR', 'Pts', 'For', 'Against', 'NRR'].map(
                (head) => (
                  <th
                    key={head}
                    className="eyebrow py-2 pr-2 font-medium last:pr-0 last:text-right"
                  >
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="mono">
            {rows.map((row, i) => (
              <tr key={row.teamId} className="border-b border-line/60 last:border-0">
                <td className="py-2 pr-2 text-muted">{i + 1}</td>
                <td className="py-2 pr-2 whitespace-nowrap text-primary">{TEAM_NAME(row.teamId)}</td>
                <td className="py-2 pr-2 text-secondary">{row.played}</td>
                <td className="py-2 pr-2 text-secondary">{row.won}</td>
                <td className="py-2 pr-2 text-secondary">{row.lost}</td>
                <td className="py-2 pr-2 text-secondary">{row.tied}</td>
                <td className="py-2 pr-2 text-secondary">{row.noResult}</td>
                <td className="py-2 pr-2 font-semibold text-primary">{row.points}</td>
                <td className="py-2 pr-2 whitespace-nowrap text-muted">
                  {row.runsScored}/{ballsAsOversText(row.ballsFaced)}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap text-muted">
                  {row.runsConceded}/{ballsAsOversText(row.ballsBowled)}
                </td>
                <td
                  className={cn(
                    'py-2 text-right font-semibold',
                    row.nrr >= 0 ? 'text-success' : 'text-alert',
                  )}
                >
                  {formatNrr(row.nrr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 min-h-[3.25rem] rounded-[var(--radius-sm)] border border-line bg-sunken px-3 py-2.5 text-[0.8125rem] text-secondary">
        {last ? KNOB_NOTE[last] : 'Three matches played. Press a button to change one fact about one of them.'}
      </p>
    </Figure>
  );
}
