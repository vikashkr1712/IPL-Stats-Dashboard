const Match = require('../models/Match');
const Delivery = require('../models/Delivery');
const { catchAsync } = require('../middleware/errorHandler');

/**
 * GET /api/matches/filter — Advanced multi-filter query builder
 *
 * Query params:
 *   seasonFrom, seasonTo — Year range (e.g. 2018 to 2023)
 *   venue       — Venue name (partial match)
 *   tossWinner  — Team that won the toss
 *   tossDecision — 'bat' or 'field'
 *   batFirst    — Team that batted first (team1 if toss_decision=bat else team2)
 *   winner      — Match winner
 *   result      — 'runs', 'wickets', 'tie', 'no result'
 *   superOver   — 'Y' or 'N'
 *   team        — Either team1 or team2 contains this team
 *   page, limit — Pagination
 *   sort        — 'date_desc' (default), 'date_asc', 'margin_desc'
 */
exports.getFilteredMatches = catchAsync(async (req, res) => {
  const {
    seasonFrom, seasonTo, venue, tossWinner, tossDecision,
    batFirst, winner, result, superOver, team,
    page = 1, limit = 20, sort = 'date_desc'
  } = req.query;

  const filter = {};

  // Season range
  if (seasonFrom || seasonTo) {
    filter.season = {};
    if (seasonFrom) filter.season.$gte = seasonFrom;
    if (seasonTo) filter.season.$lte = seasonTo;
    // If only one bound
    if (!seasonFrom) delete filter.season.$gte;
    if (!seasonTo) delete filter.season.$lte;
    if (Object.keys(filter.season).length === 0) delete filter.season;
  }

  // Venue (partial match, case-insensitive)
  if (venue) filter.venue = { $regex: venue, $options: 'i' };

  // Toss
  if (tossWinner) filter.toss_winner = tossWinner;
  if (tossDecision) filter.toss_decision = tossDecision.toLowerCase();

  // Bat first — team that batted first
  if (batFirst) {
    // batFirst team batted first means:
    // (toss_winner = batFirst AND toss_decision = bat) OR (toss_winner != batFirst AND toss_decision = field)
    filter.$or = [
      { toss_winner: batFirst, toss_decision: 'bat' },
      { toss_winner: { $ne: batFirst }, toss_decision: 'field', $or: [{ team1: batFirst }, { team2: batFirst }] }
    ];
  }

  // Winner
  if (winner) filter.winner = winner;

  // Result type
  if (result) filter.result = result;

  // Super over
  if (superOver) filter.super_over = superOver;

  // Team involved
  if (team && !batFirst) {
    filter.$or = [{ team1: team }, { team2: team }];
  }

  // Sorting
  let sortObj = { date: -1 };
  if (sort === 'date_asc') sortObj = { date: 1 };
  else if (sort === 'margin_desc') sortObj = { result_margin: -1 };

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);

  const [matches, total] = await Promise.all([
    Match.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Match.countDocuments(filter)
  ]);

  // Summary stats
  const summary = {
    total,
    winsBy: {},
    avgMargin: 0
  };

  if (total > 0 && total <= 5000) {
    const summaryAgg = await Match.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        avgMargin: { $avg: '$result_margin' },
        runWins: { $sum: { $cond: [{ $eq: ['$result', 'runs'] }, 1, 0] } },
        wicketWins: { $sum: { $cond: [{ $eq: ['$result', 'wickets'] }, 1, 0] } },
        superOvers: { $sum: { $cond: [{ $eq: ['$super_over', 'Y'] }, 1, 0] } }
      }}
    ]);
    if (summaryAgg[0]) {
      summary.avgMargin = Math.round(summaryAgg[0].avgMargin * 100) / 100;
      summary.winsBy = {
        runs: summaryAgg[0].runWins,
        wickets: summaryAgg[0].wicketWins,
        superOvers: summaryAgg[0].superOvers
      };
    }
  }

  res.status(200).json({
    status: 'success',
    data: matches,
    summary,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    },
    filters: { seasonFrom, seasonTo, venue, tossWinner, tossDecision, batFirst, winner, result, superOver, team, sort }
  });
});

/**
 * GET /api/matches/filter/options — Available filter values
 * Returns: seasons, venues, teams, result types
 */
exports.getFilterOptions = catchAsync(async (req, res) => {
  const [seasons, venues, teams1, teams2, results] = await Promise.all([
    Match.distinct('season'),
    Match.distinct('venue'),
    Match.distinct('team1'),
    Match.distinct('team2'),
    Match.distinct('result')
  ]);

  const teams = [...new Set([...teams1, ...teams2])].sort();

  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    status: 'success',
    data: {
      seasons: seasons.sort(),
      venues: venues.sort(),
      teams,
      results: results.filter(Boolean).sort(),
      tossDecisions: ['bat', 'field']
    }
  });
});
