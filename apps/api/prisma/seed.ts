import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, type PlayerRole, type Prisma } from '@prisma/client';
import { generateRoundRobin, GUEST_USERNAME_PREFIX, PLAYOFF_BRACKET } from '@howzat/shared';
import { generateSlugs } from '../src/lib/slug';

/**
 * Seeds two tournaments:
 *
 *   • "Sunday League 2026" — 4 teams, a small sandbox for quick manual tests.
 *   • "IPL 2026"           — 10 teams, full fixtures, ready to score and share.
 *
 * Idempotent: re-running updates rather than duplicating, and it never
 * regenerates fixtures for a tournament whose matches have already started.
 *
 * The IPL squads below are illustrative demo data, not real 2026 rosters.
 */
const prisma = new PrismaClient();

/**
 * Every seeded account shares one password, printed at the end. These are
 * local demo accounts on a `.local` domain — the point is being able to sign
 * in without hunting through a log, not secrecy.
 */
const DEMO_PASSWORD = 'howzat1234';

const ORGANIZER = { email: 'organizer@howzat.local', username: 'organizer', name: 'Demo Organizer' };
const DEMO_SCORER = { email: 'scorer@howzat.local', username: 'demoscorer', name: 'Demo Scorer' };
const DEFAULT_SCORER = {
  email: 'whynotramaa@howzat.local',
  username: 'whynotramaa',
  name: 'Rama',
};

const SUNDAY_TEAMS = [
  { name: 'Chennai Super Kings', shortName: 'CSK', primaryColor: '#f9cd05' },
  { name: 'Mumbai Indians', shortName: 'MI', primaryColor: '#004b8d' },
  { name: 'Royal Challengers', shortName: 'RCB', primaryColor: '#c8102e' },
  { name: 'Kolkata Knight Riders', shortName: 'KKR', primaryColor: '#3a225d' },
];

const GENERIC_SQUAD: Array<{ name: string; role: PlayerRole }> = [
  { name: 'Opener One', role: 'BATSMAN' },
  { name: 'Opener Two', role: 'BATSMAN' },
  { name: 'Number Three', role: 'BATSMAN' },
  { name: 'Number Four', role: 'BATSMAN' },
  { name: 'The Keeper', role: 'KEEPER' },
  { name: 'Finisher', role: 'ALL_ROUNDER' },
  { name: 'Spin Allrounder', role: 'ALL_ROUNDER' },
  { name: 'Pace Spearhead', role: 'BOWLER' },
  { name: 'Second Seamer', role: 'BOWLER' },
  { name: 'Left-arm Spinner', role: 'BOWLER' },
  { name: 'Death Bowler', role: 'BOWLER' },
];

const R = (name: string, role: PlayerRole) => ({ name, role });

const IPL_TEAMS: Array<{
  name: string;
  shortName: string;
  primaryColor: string;
  players: Array<{ name: string; role: PlayerRole }>;
}> = [
  {
    name: 'Chennai Super Kings', shortName: 'CSK', primaryColor: '#f9cd05',
    players: [
      R('Ruturaj Gaikwad', 'BATSMAN'), R('Rachin Ravindra', 'BATSMAN'),
      R('Shivam Dube', 'ALL_ROUNDER'), R('Sam Curran', 'ALL_ROUNDER'),
      R('MS Dhoni', 'KEEPER'), R('Ravindra Jadeja', 'ALL_ROUNDER'),
      R('Deepak Chahar', 'BOWLER'), R('Matheesha Pathirana', 'BOWLER'),
      R('Maheesh Theekshana', 'BOWLER'), R('Tushar Deshpande', 'BOWLER'),
      R('Ajinkya Rahane', 'BATSMAN'),
    ],
  },
  {
    name: 'Mumbai Indians', shortName: 'MI', primaryColor: '#004b8d',
    players: [
      R('Rohit Sharma', 'BATSMAN'), R('Ishan Kishan', 'KEEPER'),
      R('Suryakumar Yadav', 'BATSMAN'), R('Tilak Varma', 'BATSMAN'),
      R('Hardik Pandya', 'ALL_ROUNDER'), R('Tim David', 'BATSMAN'),
      R('Jasprit Bumrah', 'BOWLER'), R('Trent Boult', 'BOWLER'),
      R('Piyush Chawla', 'BOWLER'), R('Gerald Coetzee', 'BOWLER'),
      R('Nehal Wadhera', 'BATSMAN'),
    ],
  },
  {
    name: 'Royal Challengers Bengaluru', shortName: 'RCB', primaryColor: '#c8102e',
    players: [
      R('Virat Kohli', 'BATSMAN'), R('Faf du Plessis', 'BATSMAN'),
      R('Rajat Patidar', 'BATSMAN'), R('Glenn Maxwell', 'ALL_ROUNDER'),
      R('Dinesh Karthik', 'KEEPER'), R('Cameron Green', 'ALL_ROUNDER'),
      R('Mohammed Siraj', 'BOWLER'), R('Yash Dayal', 'BOWLER'),
      R('Karn Sharma', 'BOWLER'), R('Lockie Ferguson', 'BOWLER'),
      R('Will Jacks', 'ALL_ROUNDER'),
    ],
  },
  {
    name: 'Kolkata Knight Riders', shortName: 'KKR', primaryColor: '#3a225d',
    players: [
      R('Shreyas Iyer', 'BATSMAN'), R('Sunil Narine', 'ALL_ROUNDER'),
      R('Phil Salt', 'KEEPER'), R('Venkatesh Iyer', 'ALL_ROUNDER'),
      R('Andre Russell', 'ALL_ROUNDER'), R('Rinku Singh', 'BATSMAN'),
      R('Varun Chakravarthy', 'BOWLER'), R('Mitchell Starc', 'BOWLER'),
      R('Harshit Rana', 'BOWLER'), R('Vaibhav Arora', 'BOWLER'),
      R('Ramandeep Singh', 'ALL_ROUNDER'),
    ],
  },
  {
    name: 'Sunrisers Hyderabad', shortName: 'SRH', primaryColor: '#f26522',
    players: [
      R('Pat Cummins', 'BOWLER'), R('Travis Head', 'BATSMAN'),
      R('Abhishek Sharma', 'ALL_ROUNDER'), R('Heinrich Klaasen', 'KEEPER'),
      R('Aiden Markram', 'BATSMAN'), R('Nitish Kumar Reddy', 'ALL_ROUNDER'),
      R('Bhuvneshwar Kumar', 'BOWLER'), R('T Natarajan', 'BOWLER'),
      R('Shahbaz Ahmed', 'ALL_ROUNDER'), R('Jaydev Unadkat', 'BOWLER'),
      R('Rahul Tripathi', 'BATSMAN'),
    ],
  },
  {
    name: 'Delhi Capitals', shortName: 'DC', primaryColor: '#17449b',
    players: [
      R('Rishabh Pant', 'KEEPER'), R('David Warner', 'BATSMAN'),
      R('Prithvi Shaw', 'BATSMAN'), R('Mitchell Marsh', 'ALL_ROUNDER'),
      R('Axar Patel', 'ALL_ROUNDER'), R('Abishek Porel', 'BATSMAN'),
      R('Kuldeep Yadav', 'BOWLER'), R('Anrich Nortje', 'BOWLER'),
      R('Khaleel Ahmed', 'BOWLER'), R('Ishant Sharma', 'BOWLER'),
      R('Tristan Stubbs', 'BATSMAN'),
    ],
  },
  {
    name: 'Rajasthan Royals', shortName: 'RR', primaryColor: '#e6338c',
    players: [
      R('Sanju Samson', 'KEEPER'), R('Yashasvi Jaiswal', 'BATSMAN'),
      R('Jos Buttler', 'BATSMAN'), R('Riyan Parag', 'ALL_ROUNDER'),
      R('Shimron Hetmyer', 'BATSMAN'), R('Ravichandran Ashwin', 'BOWLER'),
      R('Yuzvendra Chahal', 'BOWLER'), R('Trent Copeland', 'BOWLER'),
      R('Avesh Khan', 'BOWLER'), R('Sandeep Sharma', 'BOWLER'),
      R('Dhruv Jurel', 'KEEPER'),
    ],
  },
  {
    name: 'Punjab Kings', shortName: 'PBKS', primaryColor: '#dd1f2d',
    players: [
      R('Shikhar Dhawan', 'BATSMAN'), R('Jonny Bairstow', 'KEEPER'),
      R('Liam Livingstone', 'ALL_ROUNDER'), R('Sam Curran', 'ALL_ROUNDER'),
      R('Jitesh Sharma', 'KEEPER'), R('Shashank Singh', 'BATSMAN'),
      R('Arshdeep Singh', 'BOWLER'), R('Kagiso Rabada', 'BOWLER'),
      R('Harpreet Brar', 'BOWLER'), R('Rahul Chahar', 'BOWLER'),
      R('Prabhsimran Singh', 'BATSMAN'),
    ],
  },
  {
    name: 'Gujarat Titans', shortName: 'GT', primaryColor: '#1b2133',
    players: [
      R('Shubman Gill', 'BATSMAN'), R('Wriddhiman Saha', 'KEEPER'),
      R('Sai Sudharsan', 'BATSMAN'), R('David Miller', 'BATSMAN'),
      R('Rahul Tewatia', 'ALL_ROUNDER'), R('Rashid Khan', 'BOWLER'),
      R('Mohammed Shami', 'BOWLER'), R('Mohit Sharma', 'BOWLER'),
      R('Noor Ahmad', 'BOWLER'), R('Vijay Shankar', 'ALL_ROUNDER'),
      R('Matthew Wade', 'KEEPER'),
    ],
  },
  {
    name: 'Lucknow Super Giants', shortName: 'LSG', primaryColor: '#0057e2',
    players: [
      R('KL Rahul', 'KEEPER'), R('Quinton de Kock', 'KEEPER'),
      R('Marcus Stoinis', 'ALL_ROUNDER'), R('Nicholas Pooran', 'BATSMAN'),
      R('Deepak Hooda', 'ALL_ROUNDER'), R('Krunal Pandya', 'ALL_ROUNDER'),
      R('Ravi Bishnoi', 'BOWLER'), R('Mohsin Khan', 'BOWLER'),
      R('Naveen-ul-Haq', 'BOWLER'), R('Yash Thakur', 'BOWLER'),
      R('Ayush Badoni', 'BATSMAN'),
    ],
  },
];

async function upsertUser(spec: { email: string; username: string; name: string }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Seeded accounts skip the emailed code — there is no inbox behind a .local
  // address to receive one. Verification is set on update as well as create,
  // so re-seeding a database that predates passwords repairs those accounts
  // instead of leaving them permanently unable to sign in.
  const verified = { passwordHash, emailVerifiedAt: new Date() };

  return prisma.user.upsert({
    where: { email: spec.email },
    update: { username: spec.username, name: spec.name, ...verified },
    create: { ...spec, ...verified },
  });
}

const guestUsername = () => `${GUEST_USERNAME_PREFIX}${crypto.randomBytes(4).toString('hex')}`;

/**
 * `linkedUserIds` attaches real accounts to the first few squad slots, so the
 * seeded data exercises both kinds of player: a handful with profiles that
 * accumulate stats, and the rest as guests, which is the realistic ratio.
 */
async function upsertTeamWithSquad(
  tournamentId: string,
  spec: { name: string; shortName: string; primaryColor: string },
  squad: Array<{ name: string; role: PlayerRole }>,
  prefixNames: boolean,
  linkedUsers: Array<{ id: string; username: string; name: string }> = [],
) {
  const team = await prisma.team.upsert({
    where: { tournamentId_shortName: { tournamentId, shortName: spec.shortName } },
    update: { name: spec.name, primaryColor: spec.primaryColor },
    create: { ...spec, tournamentId },
  });

  const existing = await prisma.player.count({ where: { teamId: team.id } });

  if (existing === 0) {
    await prisma.player.createMany({
      data: squad.map((player) => ({
        teamId: team.id,
        name: prefixNames ? `${spec.shortName} ${player.name}` : player.name,
        username: guestUsername(),
        role: player.role,
      })),
    });
  }

  await linkAccountsToSquad(team.id, linkedUsers);

  return team;
}

/**
 * Points the first few squad slots at real accounts. Kept separate from squad
 * creation so it also repairs a database seeded before accounts existed —
 * otherwise the "already has players" guard above would skip it forever and
 * the demo data would never have a single registered player in it.
 */
async function linkAccountsToSquad(
  teamId: string,
  users: Array<{ id: string; username: string; name: string }>,
) {
  if (users.length === 0) return;

  const players = await prisma.player.findMany({
    where: { teamId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true },
  });

  for (const [index, user] of users.entries()) {
    const slot = players[index];
    if (!slot || slot.userId === user.id) continue;

    // Someone else already holds this slot — leave it rather than reassign a
    // row that may already carry match history.
    if (slot.userId !== null) continue;

    await prisma.player.update({
      where: { id: slot.id },
      data: { userId: user.id, username: user.username, name: user.name },
    });
  }
}

/**
 * Generates fixtures with the same circle-method function the API uses, so the
 * seed cannot drift from production behaviour. Skipped entirely if any match
 * already exists — the seed must never destroy scoring data.
 */
async function ensureFixtures(
  tournament: { id: string; oversPerInnings: number; format: string; doubleRoundRobin: boolean },
  teamIds: string[],
): Promise<number> {
  const existing = await prisma.match.count({ where: { tournamentId: tournament.id } });
  if (existing > 0) return existing;

  const rounds = generateRoundRobin(teamIds, { double: tournament.doubleRoundRobin });

  const league = rounds.flatMap((round) =>
    round.matches.map((match) => ({
      round: round.round,
      stage: 'LEAGUE' as const,
      team1Id: match.homeTeamId as string | null,
      team2Id: match.awayTeamId as string | null,
    })),
  );

  const playoffs =
    tournament.format === 'LEAGUE_PLAYOFFS'
      ? PLAYOFF_BRACKET.map((slot) => ({
          round: rounds.length + 1,
          stage: slot.stage,
          team1Id: null,
          team2Id: null,
        }))
      : [];

  const all = [...league, ...playoffs];
  const slugs = generateSlugs(all.length);

  const data: Prisma.MatchCreateManyInput[] = all.map((match, index) => ({
    tournamentId: tournament.id,
    round: match.round,
    stage: match.stage,
    team1Id: match.team1Id,
    team2Id: match.team2Id,
    oversPerInnings: tournament.oversPerInnings,
    publicSlug: slugs[index]!,
  }));

  await prisma.$transaction([
    prisma.match.createMany({ data }),
    prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: 'FIXTURES_GENERATED' },
    }),
  ]);

  return data.length;
}

async function assignScorerToAll(tournamentId: string, scorerId: string, assignedBy: string) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: { id: true },
  });

  await prisma.scorerAssignment.createMany({
    data: matches.map((match) => ({ matchId: match.id, scorerId, assignedBy })),
    skipDuplicates: true,
  });

  return matches.length;
}

async function main() {
  // No roles here — these are just three accounts. Which of them ends up an
  // organizer or a scorer is decided below by what they are given to do.
  const organizer = await upsertUser(ORGANIZER);
  const demoScorer = await upsertUser(DEMO_SCORER);
  const defaultScorer = await upsertUser(DEFAULT_SCORER);

  // ── Sunday League: the small sandbox ──────────────────────────────
  let sunday = await prisma.tournament.findFirst({
    where: { organizerId: organizer.id, name: 'Sunday League 2026' },
  });

  if (!sunday) {
    sunday = await prisma.tournament.create({
      data: {
        organizerId: organizer.id,
        name: 'Sunday League 2026',
        format: 'LEAGUE',
        teamsCount: SUNDAY_TEAMS.length,
        oversPerInnings: 20,
      },
    });
  }

  for (const [index, spec] of SUNDAY_TEAMS.entries()) {
    // The first team carries the three demo accounts as registered players, so
    // there is something to search for and a profile to look at.
    await upsertTeamWithSquad(
      sunday.id,
      spec,
      GENERIC_SQUAD,
      true,
      index === 0 ? [defaultScorer, demoScorer, organizer] : [],
    );
  }

  // ── IPL 2026: the real thing, ready to score ──────────────────────
  let ipl = await prisma.tournament.findFirst({
    where: { organizerId: organizer.id, name: 'IPL 2026' },
  });

  if (!ipl) {
    ipl = await prisma.tournament.create({
      data: {
        organizerId: organizer.id,
        name: 'IPL 2026',
        format: 'LEAGUE_PLAYOFFS',
        teamsCount: IPL_TEAMS.length,
        oversPerInnings: 20,
        // Single round-robin: 45 league matches rather than 90. Flip this to
        // true and regenerate if you want the full home-and-away season.
        doubleRoundRobin: false,
      },
    });
  }

  const iplTeamIds: string[] = [];
  for (const spec of IPL_TEAMS) {
    const team = await upsertTeamWithSquad(
      ipl.id,
      { name: spec.name, shortName: spec.shortName, primaryColor: spec.primaryColor },
      spec.players,
      false,
    );
    iplTeamIds.push(team.id);
  }

  const created = await ensureFixtures(ipl, iplTeamIds);
  const assigned = await assignScorerToAll(ipl.id, defaultScorer.id, organizer.id);

  const sample = await prisma.match.findFirst({
    where: { tournamentId: ipl.id, stage: 'LEAGUE' },
    include: { team1: true, team2: true },
    orderBy: { round: 'asc' },
  });

  console.log(`
Seed complete.

  Accounts — sign in with the username and password
    @${ORGANIZER.username}       ${DEMO_PASSWORD}   owns both tournaments
    @${DEFAULT_SCORER.username}    ${DEMO_PASSWORD}   assigned to every IPL 2026 match
    @${DEMO_SCORER.username}     ${DEMO_PASSWORD}   no assignments yet

  Nobody has a role. Being an organizer means owning a tournament; being a
  scorer means holding an assignment for a match. All three accounts are also
  registered players in ${SUNDAY_TEAMS[0]?.shortName ?? 'the first Sunday League team'},
  so their profiles fill in as matches complete.

  Tournaments
    Sunday League 2026   4 teams, 11 players each — small sandbox
    IPL 2026             ${IPL_TEAMS.length} teams, ${created} matches (45 league + 4 playoff slots)
                         ${assigned} matches assigned to @${DEFAULT_SCORER.username}

  First fixture
    ${sample?.team1?.shortName ?? '?'} v ${sample?.team2?.shortName ?? '?'}
    share link  /live/${sample?.publicSlug ?? ''}
    score at    /score/${sample?.id ?? ''}

New accounts sign up at /login and confirm their email once. With RESEND_API_KEY
unset that 6-digit code is printed to the API server log; with it set, emailed.

IPL squads are illustrative demo data, not real 2026 rosters.
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
