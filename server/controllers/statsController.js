const Match = require('../models/Match');
const Delivery = require('../models/Delivery');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { normalize, getAllNames } = require('../utils/teamNormalize');

// GET /api/stats/overview - Dashboard overview stats (parallelized)
exports.getOverview = catchAsync(async (req, res) => {
  const { season } = req.query;
  let matchFilter = {};
  if (season) matchFilter.season = season;

  // Get match IDs for delivery filter (needed if season is specified)
  let deliveryFilter = {};
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    deliveryFilter = { match_id: { $in: matchIds } };
  }

  // Run ALL aggregations in parallel instead of sequentially
  const [
    [overview],
    [topScorer],
    [topWicketTaker],
    [bestEconomy],
    [boundaries],
    seasons
  ] = await Promise.all([
    // 1. Overview stats from Match collection
    Match.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalMatches: { $sum: 1 },
          seasons: { $addToSet: '$season' },
          teams: { $addToSet: '$team1' },
          teams2: { $addToSet: '$team2' },
          venues: { $addToSet: '$venue' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMatches: 1,
          totalSeasons: { $size: '$seasons' },
          totalTeams: { $size: { $setUnion: ['$teams', '$teams2'] } },
          totalVenues: { $size: '$venues' }
        }
      }
    ]),

    // 2. Top scorer
    Delivery.aggregate([
      { $match: deliveryFilter },
      { $group: { _id: '$batter', runs: { $sum: '$batsman_runs' } } },
      { $sort: { runs: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, player: '$_id', runs: 1 } }
    ]),

    // 3. Top wicket taker
    Delivery.aggregate([
      { $match: { ...deliveryFilter, is_wicket: 1, dismissal_kind: { $nin: ['run out', 'retired hurt', 'retired out', 'obstructing the field'] } } },
      { $group: { _id: '$bowler', wickets: { $sum: 1 } } },
      { $sort: { wickets: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, player: '$_id', wickets: 1 } }
    ]),

    // 4. Best economy (min 500 balls)
    Delivery.aggregate([
      { $match: deliveryFilter },
      {
        $group: {
          _id: '$bowler',
          totalRuns: { $sum: '$total_runs' },
          totalBalls: { $sum: { $cond: [{ $in: ['$extras_type', ['wides', 'noballs']] }, 0, 1] } }
        }
      },
      { $match: { totalBalls: { $gte: 500 } } },
      {
        $project: {
          _id: 0, player: '$_id',
          economy: { $round: [{ $divide: [{ $multiply: ['$totalRuns', 6] }, '$totalBalls'] }, 2] }
        }
      },
      { $sort: { economy: 1 } },
      { $limit: 1 }
    ]),

    // 5. Boundaries
    Delivery.aggregate([
      { $match: deliveryFilter },
      {
        $group: {
          _id: null,
          totalSixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
          totalFours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } }
        }
      },
      { $project: { _id: 0, totalSixes: 1, totalFours: 1 } }
    ]),

    // 6. Seasons list
    Match.distinct('season')
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      ...overview,
      topScorer: topScorer || null,
      topWicketTaker: topWicketTaker || null,
      bestEconomy: bestEconomy || null,
      totalSixes: boundaries?.totalSixes || 0,
      totalFours: boundaries?.totalFours || 0,
      seasons: seasons.sort()
    }
  });
});

// GET /api/stats/headtohead?team1=MI&team2=CSK
exports.getHeadToHead = catchAsync(async (req, res, next) => {
  const { team1, team2 } = req.query;

  if (!team1 || !team2) {
    return next(new AppError('Both team1 and team2 parameters are required', 400));
  }

  const names1 = getAllNames(team1);  // e.g. ['Delhi Capitals','Delhi Daredevils']
  const names2 = getAllNames(team2);

  const matches = await Match.find({
    $or: [
      { team1: { $in: names1 }, team2: { $in: names2 } },
      { team1: { $in: names2 }, team2: { $in: names1 } }
    ]
  }).sort({ date: -1 }).lean();

  if (!matches.length) {
    return next(new AppError(`No matches found between ${team1} and ${team2}`, 404));
  }

  const team1Wins = matches.filter(m => names1.includes(m.winner)).length;
  const team2Wins = matches.filter(m => names2.includes(m.winner)).length;
  const noResult = matches.filter(m => !m.winner || m.winner === '').length;

  // Get highest scores from deliveries
  const matchIds = matches.map(m => m.id);

  const teamScores = await Delivery.aggregate([
    { $match: { match_id: { $in: matchIds } } },
    {
      $group: {
        _id: { match_id: '$match_id', batting_team: '$batting_team' },
        totalScore: { $sum: '$total_runs' }
      }
    },
    { $sort: { totalScore: -1 } }
  ]);

  const team1HighScore = teamScores
    .filter(s => names1.includes(s._id.batting_team))
    .sort((a, b) => b.totalScore - a.totalScore)[0];

  const team2HighScore = teamScores
    .filter(s => names2.includes(s._id.batting_team))
    .sort((a, b) => b.totalScore - a.totalScore)[0];

  // Recent 5 matches
  const recentMatches = matches.slice(0, 5).map(m => ({
    date: m.date,
    venue: m.venue,
    winner: m.winner,
    result: m.result,
    result_margin: m.result_margin
  }));

  res.status(200).json({
    status: 'success',
    data: {
      team1,
      team2,
      totalMatches: matches.length,
      team1Wins,
      team2Wins,
      noResult,
      team1HighScore: team1HighScore?.totalScore || 0,
      team2HighScore: team2HighScore?.totalScore || 0,
      recentMatches
    }
  });
});

// GET /api/stats/matches-won-by - Group by won_by type (runs/wickets/super over/no result)
exports.getMatchesWonBy = catchAsync(async (req, res) => {
  const { season } = req.query;
  let matchFilter = {};
  if (season) matchFilter.season = season;

  const wonByStats = await Match.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$result',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        wonBy: '$_id',
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: wonByStats
  });
});

// GET /api/stats/team-wins - Total wins per team
exports.getTeamWins = catchAsync(async (req, res) => {
  const { season } = req.query;
  let matchFilter = { winner: { $ne: '' } };
  if (season) matchFilter.season = season;

  const teamWins = await Match.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$winner',
        wins: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        team: '$_id',
        wins: 1
      }
    },
    { $sort: { wins: -1 } }
  ]);

  // Normalize team names using shared utility
  const mergedWins = {};
  teamWins.forEach(({ team, wins }) => {
    if (!team || team === 'Unknown') return;
    const normalizedTeam = normalize(team);
    mergedWins[normalizedTeam] = (mergedWins[normalizedTeam] || 0) + wins;
  });

  // Convert back to array and sort
  const result = Object.entries(mergedWins)
    .map(([team, wins]) => ({ team, wins }))
    .sort((a, b) => b.wins - a.wins);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

// GET /api/stats/seasons - List all seasons
exports.getSeasons = catchAsync(async (req, res) => {
  const seasons = await Match.distinct('season');
  res.status(200).json({
    status: 'success',
    data: seasons.sort()
  });
});

// GET /api/stats/venue-stats - Venue-wise match stats
exports.getVenueStats = catchAsync(async (req, res) => {
  const { season } = req.query;
  let matchFilter = {};
  if (season) matchFilter.season = season;

  const venueStats = await Match.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$venue',
        totalMatches: { $sum: 1 },
        winsByRuns: { $sum: { $cond: [{ $eq: ['$result', 'runs'] }, 1, 0] } },
        winsByWickets: { $sum: { $cond: [{ $eq: ['$result', 'wickets'] }, 1, 0] } },
        superOvers: { $sum: { $cond: [{ $eq: ['$super_over', 'Y'] }, 1, 0] } }
      }
    },
    { $sort: { totalMatches: -1 } },
    { $limit: 15 }
  ]);

  res.status(200).json({
    status: 'success',
    data: venueStats
  });
});

// GET /api/stats/points-table?season=2025 - Points table for a season
exports.getPointsTable = catchAsync(async (req, res) => {
  const { season } = req.query;
  if (!season) {
    return res.status(400).json({ status: 'fail', message: 'season query parameter is required' });
  }

  // 1. Get only LEAGUE matches for this season (exclude playoffs: Qualifier 1, Qualifier 2, Eliminator, Final, etc.)
  const playoffTypes = ['Qualifier 1', 'Qualifier 2', 'Eliminator', 'Final', 'Semi Final', '3rd Place Play-Off', 'Elimination Final'];
  const matches = await Match.find({ season, match_type: { $nin: playoffTypes } }).lean();
  if (!matches.length) {
    return res.status(200).json({ status: 'success', data: [] });
  }

  // 2. Build team stats from match results
  const teamStats = {};
  const initTeam = (team) => {
    const n = normalize(team);
    if (!teamStats[n]) {
      teamStats[n] = { team: n, played: 0, won: 0, lost: 0, noResult: 0, points: 0, matchIds: [] };
    }
    return n;
  };

  matches.forEach(m => {
    const t1 = initTeam(m.team1);
    const t2 = initTeam(m.team2);
    teamStats[t1].played++;
    teamStats[t2].played++;
    teamStats[t1].matchIds.push(m.id);
    teamStats[t2].matchIds.push(m.id);

    if (!m.winner || m.result === 'no result' || m.result === 'tie') {
      teamStats[t1].noResult++;
      teamStats[t2].noResult++;
      teamStats[t1].points += 1;
      teamStats[t2].points += 1;
    } else {
      const winner = normalize(m.winner);
      const loser = winner === t1 ? t2 : t1;
      if (teamStats[winner]) {
        teamStats[winner].won++;
        teamStats[winner].points += 2;
      }
      if (teamStats[loser]) {
        teamStats[loser].lost++;
      }
    }
  });

  // 3. Compute NRR from deliveries (runs scored & overs faced for/against each team)
  const matchIds = matches.map(m => m.id);

  // Per-team per-match innings aggregation
  const inningStats = await Delivery.aggregate([
    { $match: { match_id: { $in: matchIds } } },
    { $group: {
      _id: { match_id: '$match_id', inning: '$inning', batting_team: '$batting_team' },
      totalRuns: { $sum: '$total_runs' },
      legalBalls: { $sum: { $cond: [{ $in: ['$extras_type', ['wides', 'noballs']] }, 0, 1] } },
      wickets: { $sum: '$is_wicket' }
    }}
  ]);

  // Build per-team NRR components: runsFor, oversFor, runsAgainst, oversAgainst
  const nrrData = {};
  const initNRR = (team) => {
    if (!nrrData[team]) nrrData[team] = { runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0 };
  };

  inningStats.forEach(s => {
    const battingTeam = normalize(s._id.batting_team);
    initNRR(battingTeam);

    // Runs scored by this team (FOR)
    nrrData[battingTeam].runsFor += s.totalRuns;
    nrrData[battingTeam].ballsFor += s.legalBalls;
  });

  // Also need to compute "against" — runs scored against each team
  inningStats.forEach(s => {
    const battingTeam = normalize(s._id.batting_team);
    // Find which match this is and who the other team was
    const match = matches.find(m => m.id === s._id.match_id);
    if (!match) return;
    const nt1 = normalize(match.team1);
    const nt2 = normalize(match.team2);
    const bowlingTeam = battingTeam === nt1 ? nt2 : nt1;
    initNRR(bowlingTeam);

    // Runs conceded by bowling team (AGAINST)
    nrrData[bowlingTeam].runsAgainst += s.totalRuns;
    nrrData[bowlingTeam].ballsAgainst += s.legalBalls;
  });

  // 4. Compute NRR and build final table
  const ballsToOvers = (balls) => {
    const overs = Math.floor(balls / 6);
    const remaining = balls % 6;
    return overs + remaining / 6;
  };

  const result = Object.values(teamStats).map(t => {
    const nrr = nrrData[t.team];
    let netRunRate = 0;
    let runsFor = 0, oversFor = 0, runsAgainst = 0, oversAgainst = 0;
    if (nrr) {
      oversFor = ballsToOvers(nrr.ballsFor);
      oversAgainst = ballsToOvers(nrr.ballsAgainst);
      runsFor = nrr.runsFor;
      runsAgainst = nrr.runsAgainst;
      const rrFor = oversFor > 0 ? runsFor / oversFor : 0;
      const rrAgainst = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
      netRunRate = Math.round((rrFor - rrAgainst) * 1000) / 1000;
    }

    return {
      team: t.team,
      played: t.played,
      won: t.won,
      lost: t.lost,
      noResult: t.noResult,
      points: t.points,
      nrr: netRunRate,
      runsFor,
      oversFor: oversFor > 0 ? oversFor.toFixed(1) : '0',
      runsAgainst,
      oversAgainst: oversAgainst > 0 ? oversAgainst.toFixed(1) : '0'
    };
  });

  // Sort by points DESC, then NRR DESC
  result.sort((a, b) => b.points - a.points || b.nrr - a.nrr);

  // Add position
  result.forEach((t, i) => { t.position = i + 1; });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

// GET /api/stats/playoffs?season=2023 - Playoff bracket for a season
exports.getPlayoffs = catchAsync(async (req, res) => {
  const { season } = req.query;
  if (!season) {
    return res.status(400).json({ status: 'fail', message: 'season query parameter is required' });
  }

  const playoffTypes = ['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final'];
  const matches = await Match.find({
    season,
    match_type: { $in: playoffTypes }
  }).sort('date').lean();

  const bracket = {};
  playoffTypes.forEach(type => {
    const m = matches.find(match => match.match_type === type);
    if (m) {
      bracket[type] = {
        team1: normalize(m.team1),
        team2: normalize(m.team2),
        winner: m.winner ? normalize(m.winner) : null,
        date: m.date,
        venue: m.venue || '',
        result: m.result || '',
        result_margin: m.result_margin || ''
      };
    }
  });

  res.status(200).json({
    status: 'success',
    data: bracket
  });
});
