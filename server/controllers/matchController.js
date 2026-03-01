const Match = require('../models/Match');
const Delivery = require('../models/Delivery');
const { catchAsync, AppError } = require('../middleware/errorHandler');

// GET /api/matches/recent?page=1&limit=10&season=
exports.getRecentMatches = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const { season, team } = req.query;
  const filter = {};
  if (season) filter.season = season;
  if (team) filter.$or = [{ team1: team }, { team2: team }];

  const total = await Match.countDocuments(filter);
  const matches = await Match.find(filter)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.status(200).json({
    status: 'success',
    data: matches,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/matches/:id/scorecard
exports.getScorecard = catchAsync(async (req, res, next) => {
  const matchId = parseInt(req.params.id);
  const match = await Match.findOne({ id: matchId }).lean();
  if (!match) return next(new AppError('Match not found', 404));

  const deliveries = await Delivery.find({ match_id: matchId })
    .sort({ inning: 1, over: 1, ball: 1 })
    .lean();

  // Build innings scorecards
  const innings = {};
  deliveries.forEach(d => {
    const key = d.inning;
    if (!innings[key]) {
      innings[key] = {
        inning: key,
        battingTeam: d.batting_team,
        bowlingTeam: d.bowling_team,
        batsmen: {},
        bowlers: {},
        totalRuns: 0,
        totalWickets: 0,
        totalExtras: 0,
        overs: 0,
        balls: 0,
        fallOfWickets: []
      };
    }
    const inn = innings[key];
    // Batting
    if (!inn.batsmen[d.batter]) {
      inn.batsmen[d.batter] = { name: d.batter, runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: '', order: Object.keys(inn.batsmen).length + 1 };
    }
    const bat = inn.batsmen[d.batter];
    bat.runs += d.batsman_runs;
    bat.balls += 1;
    if (d.batsman_runs === 4) bat.fours++;
    if (d.batsman_runs === 6) bat.sixes++;

    // Bowling
    if (!inn.bowlers[d.bowler]) {
      inn.bowlers[d.bowler] = { name: d.bowler, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, order: Object.keys(inn.bowlers).length + 1 };
    }
    const bowl = inn.bowlers[d.bowler];
    bowl.runs += d.total_runs;
    const isLegal = !['wides', 'noballs'].includes(d.extras_type);
    if (isLegal) bowl.balls += 1;

    // Innings totals
    inn.totalRuns += d.total_runs;
    inn.totalExtras += d.extra_runs;

    // Wicket
    if (d.is_wicket === 1) {
      inn.totalWickets += 1;
      // Credit bowler for wickets (not run outs, retired hurt, etc.)
      if (!['run out', 'retired hurt', 'retired out', 'obstructing the field'].includes(d.dismissal_kind)) {
        bowl.wickets += 1;
      }
      const dismissed = d.player_dismissed || d.batter;
      if (inn.batsmen[dismissed]) {
        inn.batsmen[dismissed].dismissal = formatDismissal(d);
      }
      inn.fallOfWickets.push({
        player: dismissed,
        runs: inn.totalRuns,
        wickets: inn.totalWickets,
        over: `${d.over}.${d.ball}`
      });
    }

    // Track legal balls for overs
    if (isLegal) inn.balls += 1;
  });

  // Calculate overs and economy for bowlers
  Object.values(innings).forEach(inn => {
    inn.overs = Math.floor(inn.balls / 6) + (inn.balls % 6) / 10;
    inn.overs = parseFloat((Math.floor(inn.balls / 6) + '.' + (inn.balls % 6)));
    inn.batsmen = Object.values(inn.batsmen).sort((a, b) => a.order - b.order);
    inn.bowlers = Object.values(inn.bowlers).map(b => {
      const completedOvers = Math.floor(b.balls / 6);
      const remainingBalls = b.balls % 6;
      b.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
      b.economy = b.balls > 0 ? parseFloat(((b.runs / b.balls) * 6).toFixed(2)) : 0;
      return b;
    }).sort((a, b) => a.order - b.order);
  });

  const inningsArray = Object.values(innings).sort((a, b) => a.inning - b.inning);

  res.status(200).json({
    status: 'success',
    data: { match, innings: inningsArray }
  });
});

// GET /api/matches/:id/commentary?inning=1
exports.getCommentary = catchAsync(async (req, res, next) => {
  const matchId = parseInt(req.params.id);
  const inning = parseInt(req.query.inning) || 1;

  const match = await Match.findOne({ id: matchId }).lean();
  if (!match) return next(new AppError('Match not found', 404));

  const deliveries = await Delivery.find({ match_id: matchId, inning })
    .sort({ over: -1, ball: -1 })
    .lean();

  // Group by overs and generate commentary text
  const overs = {};
  deliveries.forEach(d => {
    const overKey = d.over;
    if (!overs[overKey]) overs[overKey] = { over: overKey, balls: [], runs: 0, wickets: 0 };
    const ov = overs[overKey];

    let text = '';
    const ballLabel = `${d.over}.${d.ball}`;

    if (d.is_wicket === 1) {
      text = `${ballLabel} — WICKET! ${d.player_dismissed} ${formatDismissal(d)}. ${d.bowler} strikes!`;
      ov.wickets++;
    } else if (d.batsman_runs === 6) {
      text = `${ballLabel} — SIX! ${d.batter} smashes ${d.bowler} for a maximum!`;
    } else if (d.batsman_runs === 4) {
      text = `${ballLabel} — FOUR! ${d.batter} finds the boundary off ${d.bowler}.`;
    } else if (d.extras_type === 'wides') {
      text = `${ballLabel} — Wide ball by ${d.bowler}. ${d.extra_runs} extra run(s).`;
    } else if (d.extras_type === 'noballs') {
      text = `${ballLabel} — No ball by ${d.bowler}! Free hit coming up.`;
    } else if (d.extras_type === 'legbyes' || d.extras_type === 'byes') {
      text = `${ballLabel} — ${d.extra_runs} ${d.extras_type} off ${d.bowler} to ${d.batter}.`;
    } else if (d.batsman_runs === 0) {
      text = `${ballLabel} — Dot ball. ${d.bowler} to ${d.batter}, no run.`;
    } else {
      text = `${ballLabel} — ${d.batter} takes ${d.batsman_runs} run(s) off ${d.bowler}.`;
    }

    ov.runs += d.total_runs;
    ov.balls.push({
      ball: d.ball,
      batter: d.batter,
      bowler: d.bowler,
      runs: d.batsman_runs,
      extras: d.extra_runs,
      totalRuns: d.total_runs,
      isWicket: d.is_wicket === 1,
      isSix: d.batsman_runs === 6,
      isFour: d.batsman_runs === 4,
      text
    });
  });

  const commentary = Object.values(overs)
    .sort((a, b) => b.over - a.over)
    .map(ov => ({
      ...ov,
      balls: ov.balls.sort((a, b) => b.ball - a.ball)
    }));

  res.status(200).json({
    status: 'success',
    data: {
      matchId,
      inning,
      battingTeam: deliveries.length > 0 ? deliveries[0].batting_team : '',
      bowlingTeam: deliveries.length > 0 ? deliveries[0].bowling_team : '',
      commentary
    }
  });
});

function formatDismissal(d) {
  switch (d.dismissal_kind) {
    case 'bowled': return `b ${d.bowler}`;
    case 'caught': return d.fielder ? `c ${d.fielder} b ${d.bowler}` : `c & b ${d.bowler}`;
    case 'lbw': return `lbw b ${d.bowler}`;
    case 'run out': return d.fielder ? `run out (${d.fielder})` : 'run out';
    case 'stumped': return `st ${d.fielder} b ${d.bowler}`;
    case 'caught and bowled': return `c & b ${d.bowler}`;
    case 'hit wicket': return `hit wicket b ${d.bowler}`;
    case 'retired hurt': return 'retired hurt';
    case 'retired out': return 'retired out';
    case 'obstructing the field': return 'obstructing the field';
    default: return d.dismissal_kind || '';
  }
}
