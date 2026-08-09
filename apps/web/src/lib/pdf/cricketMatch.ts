import { ReportDoc, pdfFileName, type BuiltPdf } from './doc';
import { ACCENT, INK, MUTED, SECONDARY, SUCCESS, hexToRgb } from './theme';
import {
  fetchMatchHeader,
  fetchScorecard,
  formatWhen,
  stageLabel,
  statusLabel,
  type PublicMatchHeader,
  type ScorecardInnings,
  type ScorecardResponse,
} from './sources';

export async function buildCricketMatchPdf(slug: string): Promise<BuiltPdf> {
  const [header, scorecard] = await Promise.all([fetchMatchHeader(slug), fetchScorecard(slug)]);

  return renderCricketMatchPdf(header, scorecard);
}

export function renderCricketMatchPdf(
  header: PublicMatchHeader,
  scorecard: ScorecardResponse,
): BuiltPdf {
  const [teamA, teamB] = header.teams;
  const title = `${teamA?.name ?? 'TBD'} v ${teamB?.name ?? 'TBD'}`;
  const shortTitle = `${teamA?.shortName ?? 'TBD'} v ${teamB?.shortName ?? 'TBD'}`;

  const doc = new ReportDoc({
    title: `${title} — scorecard`,
    subject: `${header.tournamentName} · ${stageLabel(header.stage, header.round)}`,
    runningHead: shortTitle,
  });

  const when = formatWhen(header.scheduledAt);

  doc.masthead({
    kicker: `Cricket · ${header.tournamentName}`,
    title,
    subtitle: [
      stageLabel(header.stage, header.round),
      `${header.oversPerInnings} overs a side`,
      when,
    ]
      .filter(Boolean)
      .join('  ·  '),
    status: statusLabel(header.status),
    facts: [
      header.venue ? `Venue ${header.venue}` : 'Venue not recorded',
      tossLine(header) ?? 'Toss not recorded',
      `${scorecard.innings.length} innings played`,
    ],
  });

  renderResult(doc, header, scorecard);

  if (scorecard.innings.length === 0) {
    doc.heading('Scorecard', 'Not a ball bowled');
    doc.paragraph(
      'This fixture has no innings on record yet. The full card appears here once the first delivery is scored.',
    );
  }

  for (const innings of scorecard.innings) {
    renderInnings(doc, innings, header);
  }

  renderKey(doc);

  return {
    blob: doc.blob(),
    fileName: pdfFileName([shortTitle, 'scorecard']),
    title: `${shortTitle} — scorecard`,
    text: header.resultText
      ? `${title}. ${header.resultText}.`
      : `Scorecard for ${title}, ${header.tournamentName}.`,
  };
}

function renderResult(
  doc: ReportDoc,
  header: PublicMatchHeader,
  scorecard: ScorecardResponse,
): void {
  const [teamA, teamB] = header.teams;
  if (!teamA || !teamB) return;

  doc.heading('The result', header.resultText ? 'Final score' : 'Score');

  for (const team of [teamA, teamB]) {
    const innings = scorecard.innings.find((entry) => entry.battingTeam.id === team.id);
    const decided = header.winnerTeamId !== null;

    doc.scoreLine({
      color: hexToRgb(team.primaryColor),
      name: team.name,
      detail: innings
        ? `${innings.overs} overs  ·  ${innings.extras.total} extras  ·  run rate ${runRate(innings)}`
        : 'Did not bat',
      figure: innings ? `${innings.runs}/${innings.wickets}` : '—',
      won: decided ? header.winnerTeamId === team.id : undefined,
    });
  }

  doc.space(6);
  doc.rule(true);
  doc.space(12);

  if (header.resultText) {
    doc.paragraph(header.resultText, { color: SUCCESS, size: 12 });
  } else if (header.status === 'LIVE' || header.status === 'INNINGS_BREAK') {
    doc.paragraph('This match was still in progress when the report was generated.', {
      color: MUTED,
      italic: true,
    });
  }

  const toss = tossLine(header);
  if (toss) doc.paragraph(toss, { color: SECONDARY, size: 9 });
}

function tossLine(header: PublicMatchHeader): string | null {
  if (!header.tossWinnerId || !header.tossDecision) return null;

  const winner = header.teams.find((team) => team?.id === header.tossWinnerId);
  if (!winner) return null;

  return `${winner.name} won the toss and chose to ${header.tossDecision === 'BAT' ? 'bat' : 'bowl'}`;
}

function runRate(innings: ScorecardInnings): string {
  const balls = oversToBalls(innings.overs);
  return balls === 0 ? '—' : ((innings.runs / balls) * 6).toFixed(2);
}

function oversToBalls(overs: string): number {
  const [whole = '0', part = '0'] = overs.split('.');
  return Number(whole) * 6 + Number(part);
}

function renderInnings(doc: ReportDoc, innings: ScorecardInnings, header: PublicMatchHeader): void {
  doc.heading(
    `Innings ${innings.number}`,
    `${innings.battingTeam.name} batting`,
    `${innings.runs}/${innings.wickets}  (${innings.overs} ov)`,
  );

  doc.metrics([
    { label: 'Total', value: `${innings.runs}/${innings.wickets}` },
    {
      label: 'Overs',
      // The innings' own allotment, not the fixture's — DLS can cut them apart.
      value: `${innings.overs}/${innings.quotaOvers ?? header.oversPerInnings}`,
    },
    { label: 'Run rate', value: runRate(innings) },
    { label: 'Extras', value: String(innings.extras.total) },
    {
      label: 'Boundaries',
      value: String(
        innings.batting.reduce((total, batter) => total + batter.fours + batter.sixes, 0),
      ),
    },
  ]);

  doc.space(14);
  doc.table({
    head: [['Batter', 'How out', 'R', 'B', '4s', '6s', 'SR']],
    body: innings.batting.map((batter) => [
      batter.isOut ? batter.name : `${batter.name} *`,
      batter.dismissal,
      String(batter.runs),
      String(batter.balls),
      String(batter.fours),
      String(batter.sixes),
      batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—',
    ]),
    foot: [
      [
        {
          content: `Extras ${innings.extras.total}  (w ${innings.extras.wides}, nb ${innings.extras.noBalls}, b ${innings.extras.byes}, lb ${innings.extras.legByes})`,
          colSpan: 2,
          styles: { fontStyle: 'normal', textColor: SECONDARY, fontSize: 7.5 },
        },
        {
          content: `${innings.runs}/${innings.wickets}`,
          colSpan: 2,
          styles: { halign: 'left' },
        },
        {
          content: `${innings.overs} ov`,
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'normal', textColor: SECONDARY, fontSize: 7.5 },
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 118, fontStyle: 'bold' },
      1: { textColor: MUTED, fontSize: 7.5 },
      2: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 44, textColor: MUTED },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const batter = innings.batting[data.row.index];
        if (batter && !batter.isOut) data.cell.styles.textColor = ACCENT;
      }
    },
  });

  if (innings.fallOfWickets.length > 0) {
    doc.caption(
      'Fall of wickets',
      innings.fallOfWickets
        .map((wicket) => `${wicket.teamRuns}-${wicket.wicket} (${wicket.name}, ${wicket.overs})`)
        .join('   ·   '),
    );
  }

  doc.space(16);
  doc.table({
    head: [[`${innings.bowlingTeam.name} bowling`, 'O', 'M', 'R', 'W', 'Econ']],
    body: innings.bowling.map((bowler) => [
      bowler.name,
      bowler.overs,
      String(bowler.maidens),
      String(bowler.runs),
      String(bowler.wickets),
      economy(bowler.overs, bowler.runs),
    ]),
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 34 },
      3: { halign: 'right', cellWidth: 34 },
      4: { halign: 'right', cellWidth: 34, fontStyle: 'bold', textColor: INK },
      5: { halign: 'right', cellWidth: 42, textColor: MUTED },
    },
  });

  const best = [...innings.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];

  if (best && best.wickets > 0) {
    doc.caption('Best figures', `${best.name} ${best.figures}`);
  }
}

function economy(overs: string, runs: number): string {
  const balls = oversToBalls(overs);
  return balls === 0 ? '—' : ((runs / balls) * 6).toFixed(2);
}

function renderKey(doc: ReportDoc): void {
  doc.space(20);
  doc.caption(
    'Reading this card',
    'R runs · B balls faced · SR strike rate · O overs · M maidens · W wickets · Econ runs per over. ' +
      'An asterisk marks a batter who was not out. Extras are itemised as wides, no-balls, byes and leg-byes.',
  );
}
