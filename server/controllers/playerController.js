const Delivery = require('../models/Delivery');
const Match = require('../models/Match');
const PlayerImage = require('../models/PlayerImage');
const { catchAsync, AppError } = require('../middleware/errorHandler');

// GET /api/players/search?q=kohli - Search players
exports.searchPlayers = catchAsync(async (req, res) => {
  const query = req.query.q || '';
  if (query.length < 1) {
    return res.status(200).json({ status: 'success', data: [] });
  }

  const trimmed = query.trim();
  const words = trimmed.split(/\s+/);

  // Build a regex that finds players where each word matches the START of any name-part
  // e.g. "R Sharma" -> finds names where one part starts with "R" and another starts with "Sharma"
  // e.g. "Ro" -> finds names where any part starts with "Ro"
  // For single word: match start of any word in the name using word boundary
  let regexPattern;
  if (words.length === 1) {
    // Single word: match names where any word starts with the query
    regexPattern = `\\b${trimmed}`;
  } else {
    // Multi-word: match ANY of the words (start of word boundary)
    regexPattern = words.map(w => `\\b${w}`).join('|');
  }

  const batters = await Delivery.distinct('batter', {
    batter: { $regex: regexPattern, $options: 'i' }
  });
  const bowlers = await Delivery.distinct('bowler', {
    bowler: { $regex: regexPattern, $options: 'i' }
  });

  let allPlayers = [...new Set([...batters, ...bowlers])];

  // Smart ranking
  allPlayers.sort((a, b) => {
    const aParts = a.split(/\s+/);
    const bParts = b.split(/\s+/);

    // Score each player based on how many query words match name parts
    const scorePlayer = (parts) => {
      let score = 0;
      for (const w of words) {
        const wLower = w.toLowerCase();
        let bestPartScore = 0;
        for (const p of parts) {
          const pLower = p.toLowerCase();
          if (pLower === wLower) {
            bestPartScore = Math.max(bestPartScore, 10); // Exact word match
          } else if (pLower.startsWith(wLower)) {
            bestPartScore = Math.max(bestPartScore, 7); // Prefix match (query is prefix of name part)
          } else if (wLower.startsWith(pLower) && pLower.length >= 2) {
            // Name part is a prefix of query word (e.g. "RG" is prefix of "Rohit"? No.)
            // Actually: name part like "Ro" being prefix of query "Rohit" = decent match
            bestPartScore = Math.max(bestPartScore, 4);
          } else if (wLower.length > 1 && pLower[0] === wLower[0]) {
            // First-letter-only match: score based on how meaningful the match is
            // If query word is long (e.g. "Rohit"=5) but name part is tiny (e.g. "R"=1),
            // this is a weak coincidental initial match
            const ratio = Math.min(pLower.length, wLower.length) / Math.max(pLower.length, wLower.length);
            if (pLower.length <= 2 && wLower.length >= 4) {
              bestPartScore = Math.max(bestPartScore, 1); // Weak: "R" or "RG" vs "Rohit"
            } else {
              bestPartScore = Math.max(bestPartScore, 3);
            }
          } else if (pLower.includes(wLower)) {
            bestPartScore = Math.max(bestPartScore, 2); // Contains match
          }
        }
        score += bestPartScore;
      }
      // Bonus for matching all words well (prefix or exact match only - not weak initial matches)
      const strongMatchedWords = words.filter(w => 
        parts.some(p => {
          const pl = p.toLowerCase(), wl = w.toLowerCase();
          return pl === wl || pl.startsWith(wl) || wl.startsWith(pl);
        })
      ).length;
      if (strongMatchedWords === words.length) score += 20;
      // Smaller bonus for all words having at least first-letter match
      const weakMatchedWords = words.filter(w => 
        parts.some(p => {
          const pl = p.toLowerCase(), wl = w.toLowerCase();
          return pl[0] === wl[0];
        })
      ).length;
      if (weakMatchedWords === words.length && strongMatchedWords < words.length) score += 5;
      return score;
    };

    const aScore = scorePlayer(aParts);
    const bScore = scorePlayer(bParts);
    return bScore - aScore || a.localeCompare(b);
  });

  allPlayers = allPlayers.slice(0, 20);

  res.status(200).json({
    status: 'success',
    count: allPlayers.length,
    data: allPlayers
  });
});

// GET /api/players/:name/teams - Get teams a player played for
exports.getPlayerTeams = catchAsync(async (req, res, next) => {
  const playerName = req.params.name;

  // Find all match IDs where this player batted or bowled
  const [batterMatchIds, bowlerMatchIds] = await Promise.all([
    Delivery.distinct('match_id', { batter: playerName }),
    Delivery.distinct('match_id', { bowler: playerName })
  ]);
  const allMatchIds = [...new Set([...batterMatchIds, ...bowlerMatchIds])];

  if (allMatchIds.length === 0) {
    return next(new AppError(`Player '${playerName}' not found`, 404));
  }

  // Get the batting_team for each match this player was in
  const teamsByMatch = await Delivery.aggregate([
    { $match: { match_id: { $in: allMatchIds }, $or: [{ batter: playerName }, { bowler: playerName }] } },
    { $group: { _id: '$match_id', team: { $first: { $cond: [{ $eq: ['$batter', playerName] }, '$batting_team', '$bowling_team'] } } } }
  ]);

  // Get match dates for ordering
  const matches = await Match.find({ id: { $in: allMatchIds } }, { id: 1, season: 1, date: 1 }).lean();
  const matchMap = {};
  matches.forEach(m => { matchMap[m.id] = m; });

  // Build team history with seasons
  const teamSeasons = {};
  teamsByMatch.forEach(({ _id: matchId, team }) => {
    const match = matchMap[matchId];
    if (!match || !team) return;
    if (!teamSeasons[team]) teamSeasons[team] = { seasons: new Set(), lastDate: null };
    const seasonLabel = match.season?.includes('/') ? match.season.split('/')[0] : match.season;
    teamSeasons[team].seasons.add(seasonLabel);
    const d = new Date(match.date);
    if (!teamSeasons[team].lastDate || d > teamSeasons[team].lastDate) teamSeasons[team].lastDate = d;
  });

  const teams = Object.entries(teamSeasons)
    .map(([team, info]) => ({
      team,
      seasons: [...info.seasons].sort(),
      lastPlayed: info.lastDate
    }))
    .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));

  // The first entry is the most recent team
  const currentTeam = teams.length > 0 ? teams[0].team : null;

  res.status(200).json({
    status: 'success',
    data: { player: playerName, currentTeam, teams }
  });
});

// GET /api/players/:name/batting?season=2023 - Batting stats (optional season filter)
exports.getBattingStats = catchAsync(async (req, res, next) => {
  const playerName = req.params.name;
  const { season } = req.query;

  let matchFilter = { batter: playerName };
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    matchFilter.match_id = { $in: matchIds };
  }

  const [stats] = await Delivery.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalRuns: { $sum: '$batsman_runs' },
        totalBalls: { $sum: { $cond: [{ $in: ['$extras_type', ['wides', '']] }, { $cond: [{ $eq: ['$extras_type', 'wides'] }, 0, 1] }, 1] } },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
        dots: { $sum: { $cond: [{ $eq: ['$batsman_runs', 0] }, 1, 0] } },
        matchIds: { $addToSet: '$match_id' }
      }
    },
    {
      $project: {
        _id: 0,
        totalRuns: 1,
        totalBalls: 1,
        strikeRate: {
          $round: [{ $cond: [{ $eq: ['$totalBalls', 0] }, 0, { $multiply: [{ $divide: ['$totalRuns', '$totalBalls'] }, 100] }] }, 2]
        },
        fours: 1,
        sixes: 1,
        dots: 1,
        boundaryPercentage: {
          $round: [{
            $cond: [
              { $eq: ['$totalRuns', 0] }, 0,
              { $multiply: [{ $divide: [{ $add: [{ $multiply: ['$fours', 4] }, { $multiply: ['$sixes', 6] }] }, '$totalRuns'] }, 100] }
            ]
          }, 2]
        },
        matchesPlayed: { $size: '$matchIds' }
      }
    }
  ]);

  if (!stats) {
    return next(new AppError(`Player '${playerName}' not found`, 404));
  }

  // Calculate average (runs per dismissal)
  const dismissals = await Delivery.countDocuments({
    player_dismissed: playerName
  });

  const average = dismissals > 0 ? Math.round((stats.totalRuns / dismissals) * 100) / 100 : stats.totalRuns;

  res.status(200).json({
    status: 'success',
    data: {
      player: playerName,
      ...stats,
      average,
      dismissals
    }
  });
});

// GET /api/players/:name/bowling?season=2023 - Bowling stats (optional season filter)
exports.getBowlingStats = catchAsync(async (req, res, next) => {
  const playerName = req.params.name;
  const { season } = req.query;

  let matchFilter = { bowler: playerName };
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    matchFilter.match_id = { $in: matchIds };
  }

  const [stats] = await Delivery.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalRunsConceded: { $sum: '$total_runs' },
        totalBalls: {
          $sum: {
            $cond: [{ $in: ['$extras_type', ['wides', 'noballs']] }, 0, 1]
          }
        },
        wickets: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$is_wicket', 1] },
                { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
              ]},
              1, 0
            ]
          }
        },
        dots: {
          $sum: { $cond: [{ $eq: ['$total_runs', 0] }, 1, 0] }
        },
        matchIds: { $addToSet: '$match_id' },
        extras: { $sum: '$extra_runs' }
      }
    },
    {
      $project: {
        _id: 0,
        totalRunsConceded: 1,
        totalBalls: 1,
        overs: {
          $round: [{ $divide: ['$totalBalls', 6] }, 1]
        },
        wickets: 1,
        economy: {
          $round: [{
            $cond: [
              { $eq: ['$totalBalls', 0] }, 0,
              { $divide: [{ $multiply: ['$totalRunsConceded', 6] }, '$totalBalls'] }
            ]
          }, 2]
        },
        bowlingStrikeRate: {
          $round: [{
            $cond: [
              { $eq: ['$wickets', 0] }, 0,
              { $divide: ['$totalBalls', '$wickets'] }
            ]
          }, 2]
        },
        dots: 1,
        dotBallPercentage: {
          $round: [{
            $cond: [
              { $eq: ['$totalBalls', 0] }, 0,
              { $multiply: [{ $divide: ['$dots', '$totalBalls'] }, 100] }
            ]
          }, 2]
        },
        matchesPlayed: { $size: '$matchIds' }
      }
    }
  ]);

  if (!stats) {
    return next(new AppError(`Bowler '${playerName}' not found`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: { player: playerName, ...stats }
  });
});

// GET /api/players/:name/season-wise - Season-wise batting stats
exports.getPlayerSeasonWise = catchAsync(async (req, res, next) => {
  const playerName = req.params.name;

  // First get match_id to season mapping
  const matchSeasons = await Match.find({}, { id: 1, season: 1 }).lean();
  const seasonMap = {};
  matchSeasons.forEach(m => { seasonMap[m.id] = m.season; });

  const deliveries = await Delivery.aggregate([
    { $match: { batter: playerName } },
    {
      $group: {
        _id: '$match_id',
        runs: { $sum: '$batsman_runs' },
        balls: {
          $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] }
        },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } }
      }
    }
  ]);

  // Group by season
  const seasonData = {};
  deliveries.forEach(d => {
    const season = seasonMap[d._id] || 'Unknown';
    if (!seasonData[season]) {
      seasonData[season] = { runs: 0, balls: 0, fours: 0, sixes: 0, matches: 0 };
    }
    seasonData[season].runs += d.runs;
    seasonData[season].balls += d.balls;
    seasonData[season].fours += d.fours;
    seasonData[season].sixes += d.sixes;
    seasonData[season].matches += 1;
  });

  const result = Object.entries(seasonData)
    .map(([season, data]) => ({
      season,
      ...data,
      strikeRate: data.balls > 0 ? Math.round((data.runs / data.balls) * 10000) / 100 : 0
    }))
    .sort((a, b) => a.season.localeCompare(b.season));

  res.status(200).json({
    status: 'success',
    data: { player: playerName, seasons: result }
  });
});

// ─── Comprehensive Player Comparison Endpoint ───────────────────────
// GET /api/players/compare?p1=V+Kohli&p2=RG+Sharma&season=2023
// Returns: batting, bowling, phase-wise, milestones, POTM, matchup — all in one call
exports.getPlayerCompare = catchAsync(async (req, res) => {
  const { p1, p2, season } = req.query;
  if (!p1 || !p2) {
    return res.status(400).json({ status: 'fail', message: 'Both p1 and p2 are required' });
  }

  // Resolve season → matchIds ONCE
  let matchIds = null;
  if (season) {
    matchIds = await Match.find({ season }).distinct('id');
  }
  const delivFilter = (extra) => {
    const f = { ...extra };
    if (matchIds) f.match_id = { $in: matchIds };
    return f;
  };

  // Helper: batting stats for a player
  async function battingStats(player) {
    // Per-innings aggregation for 50s, 100s, HS
    const innings = await Delivery.aggregate([
      { $match: delivFilter({ batter: player }) },
      { $group: {
        _id: { match_id: '$match_id', inning: '$inning' },
        runs: { $sum: '$batsman_runs' },
        balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
        dots: { $sum: { $cond: [{ $and: [{ $eq: ['$batsman_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } }
      }}
    ]);
    if (!innings.length) return null;
    const matchSet = new Set(innings.map(i => i._id.match_id));
    const totalRuns = innings.reduce((s, i) => s + i.runs, 0);
    const totalBalls = innings.reduce((s, i) => s + i.balls, 0);
    const totalFours = innings.reduce((s, i) => s + i.fours, 0);
    const totalSixes = innings.reduce((s, i) => s + i.sixes, 0);
    const totalDots = innings.reduce((s, i) => s + i.dots, 0);
    const fifties = innings.filter(i => i.runs >= 50 && i.runs < 100).length;
    const centuries = innings.filter(i => i.runs >= 100).length;
    const highestScore = Math.max(...innings.map(i => i.runs));

    const dismissals = await Delivery.countDocuments(delivFilter({ player_dismissed: player }));
    const average = dismissals > 0 ? Math.round((totalRuns / dismissals) * 100) / 100 : totalRuns;

    return {
      player, matches: matchSet.size, innings: innings.length,
      totalRuns, totalBalls, fours: totalFours, sixes: totalSixes, dots: totalDots,
      strikeRate: totalBalls > 0 ? Math.round((totalRuns / totalBalls) * 10000) / 100 : 0,
      average, dismissals, fifties, centuries, highestScore,
      boundaryPercentage: totalRuns > 0 ? Math.round(((totalFours * 4 + totalSixes * 6) / totalRuns) * 10000) / 100 : 0,
      dotBallPercentage: totalBalls > 0 ? Math.round((totalDots / totalBalls) * 10000) / 100 : 0
    };
  }

  // Helper: bowling stats for a player
  async function bowlingStats(player) {
    const [stats] = await Delivery.aggregate([
      { $match: delivFilter({ bowler: player }) },
      { $group: {
        _id: null,
        runsConceded: { $sum: '$total_runs' },
        legalBalls: { $sum: { $cond: [{ $in: ['$extras_type', ['wides', 'noballs']] }, 0, 1] } },
        wickets: { $sum: { $cond: [{ $and: [
          { $eq: ['$is_wicket', 1] },
          { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
        ]}, 1, 0] } },
        dots: { $sum: { $cond: [{ $eq: ['$total_runs', 0] }, 1, 0] } },
        matchIds: { $addToSet: '$match_id' },
        inningKeys: { $addToSet: { $concat: [{ $toString: '$match_id' }, '-', { $toString: '$inning' }] } }
      }}
    ]);
    if (!stats || stats.legalBalls === 0) return null;
    const overs = Math.floor(stats.legalBalls / 6) + (stats.legalBalls % 6) / 10;
    return {
      player, matches: stats.matchIds.length, innings: stats.inningKeys.length,
      wickets: stats.wickets, runsConceded: stats.runsConceded,
      legalBalls: stats.legalBalls,
      overs: parseFloat(overs.toFixed(1)),
      economy: stats.legalBalls > 0 ? Math.round((stats.runsConceded * 6 / stats.legalBalls) * 100) / 100 : 0,
      bowlingStrikeRate: stats.wickets > 0 ? Math.round((stats.legalBalls / stats.wickets) * 100) / 100 : 0,
      bowlingAverage: stats.wickets > 0 ? Math.round((stats.runsConceded / stats.wickets) * 100) / 100 : 0,
      dots: stats.dots,
      dotBallPercentage: stats.legalBalls > 0 ? Math.round((stats.dots / stats.legalBalls) * 10000) / 100 : 0
    };
  }

  // Helper: phase-wise batting stats (PP 1-6, Middle 7-15, Death 16-20)
  async function phaseStats(player) {
    const phases = await Delivery.aggregate([
      { $match: delivFilter({ batter: player }) },
      { $addFields: {
        phase: { $cond: [{ $lte: ['$over', 5] }, 'powerplay',
                 { $cond: [{ $lte: ['$over', 14] }, 'middle', 'death'] }] }
      }},
      { $group: {
        _id: '$phase',
        runs: { $sum: '$batsman_runs' },
        balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
        dots: { $sum: { $cond: [{ $and: [{ $eq: ['$batsman_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } }
      }},
      { $project: {
        _id: 0, phase: '$_id', runs: 1, balls: 1, fours: 1, sixes: 1, dots: 1,
        strikeRate: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 2] }, 0] },
        dotPct: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$dots', '$balls'] }, 100] }, 2] }, 0] }
      }}
    ]);
    const map = {};
    phases.forEach(p => { map[p.phase] = p; });
    const empty = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, strikeRate: 0, dotPct: 0 };
    return {
      powerplay: { phase: 'powerplay', ...empty, ...map.powerplay },
      middle: { phase: 'middle', ...empty, ...map.middle },
      death: { phase: 'death', ...empty, ...map.death }
    };
  }

  // Helper: Player of Match awards
  async function potmCount(player) {
    const matchFilter = { player_of_match: player };
    if (season) matchFilter.season = season;
    return Match.countDocuments(matchFilter);
  }

  // Helper: head-to-head matchup (batter vs bowler)
  async function matchupStats(batter, bowler) {
    const [stats] = await Delivery.aggregate([
      { $match: delivFilter({ batter, bowler }) },
      { $group: {
        _id: null,
        balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } },
        runs: { $sum: '$batsman_runs' },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
        dots: { $sum: { $cond: [{ $and: [{ $eq: ['$batsman_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } },
        wickets: { $sum: { $cond: [{ $and: [
          { $eq: ['$is_wicket', 1] }, { $eq: ['$player_dismissed', batter] },
          { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out']] } }
        ]}, 1, 0] } },
        matchIds: { $addToSet: '$match_id' }
      }},
      { $project: {
        _id: 0, balls: 1, runs: 1, fours: 1, sixes: 1, dots: 1, wickets: 1,
        matches: { $size: '$matchIds' },
        strikeRate: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 2] }, 0] },
        dotBallPercentage: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$dots', '$balls'] }, 100] }, 2] }, 0] }
      }}
    ]);
    return stats || { balls: 0, runs: 0, fours: 0, sixes: 0, dots: 0, wickets: 0, matches: 0, strikeRate: 0, dotBallPercentage: 0 };
  }

  // Helper: season-wise comparison
  async function seasonWise(player) {
    const matchSeasons = await Match.find(matchIds ? { id: { $in: matchIds } } : {}, { id: 1, season: 1 }).lean();
    const sMap = {};
    matchSeasons.forEach(m => { sMap[m.id] = m.season; });

    const deliv = await Delivery.aggregate([
      { $match: delivFilter({ batter: player }) },
      { $group: {
        _id: '$match_id',
        runs: { $sum: '$batsman_runs' },
        balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } }
      }}
    ]);
    // Bowling per match
    const bowlDeliv = await Delivery.aggregate([
      { $match: delivFilter({ bowler: player }) },
      { $group: {
        _id: '$match_id',
        wickets: { $sum: { $cond: [{ $and: [
          { $eq: ['$is_wicket', 1] },
          { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
        ]}, 1, 0] } }
      }}
    ]);

    const seasonData = {};
    deliv.forEach(d => {
      const s = sMap[d._id] || 'Unknown';
      if (!seasonData[s]) seasonData[s] = { runs: 0, balls: 0, matches: 0, wickets: 0 };
      seasonData[s].runs += d.runs;
      seasonData[s].balls += d.balls;
      seasonData[s].matches += 1;
    });
    bowlDeliv.forEach(d => {
      const s = sMap[d._id] || 'Unknown';
      if (!seasonData[s]) seasonData[s] = { runs: 0, balls: 0, matches: 0, wickets: 0 };
      seasonData[s].wickets += d.wickets;
    });

    return Object.entries(seasonData).map(([season, data]) => ({
      season, ...data,
      strikeRate: data.balls > 0 ? Math.round((data.runs / data.balls) * 10000) / 100 : 0
    })).sort((a, b) => a.season.localeCompare(b.season));
  }

  // Execute ALL queries in parallel
  const [
    bat1, bat2, bowl1, bowl2,
    phase1, phase2,
    potm1, potm2,
    mu1v2, mu2v1,
    seasons1, seasons2
  ] = await Promise.all([
    battingStats(p1), battingStats(p2),
    bowlingStats(p1), bowlingStats(p2),
    phaseStats(p1), phaseStats(p2),
    potmCount(p1), potmCount(p2),
    matchupStats(p1, p2), matchupStats(p2, p1),
    seasonWise(p1), seasonWise(p2)
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      player1: {
        name: p1,
        batting: bat1, bowling: bowl1,
        phases: phase1, awards: { playerOfMatch: potm1 },
        seasons: seasons1
      },
      player2: {
        name: p2,
        batting: bat2, bowling: bowl2,
        phases: phase2, awards: { playerOfMatch: potm2 },
        seasons: seasons2
      },
      matchup: {
        p1BattingVsP2: mu1v2,
        p2BattingVsP1: mu2v1
      }
    }
  });
});

// GET /api/players/top-batsmen?season=2020&limit=10
exports.getTopBatsmen = catchAsync(async (req, res) => {
  const { season, limit = 10 } = req.query;

  let matchFilter = {};
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    matchFilter = { match_id: { $in: matchIds } };
  }

  const topBatsmen = await Delivery.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$batter',
        totalRuns: { $sum: '$batsman_runs' },
        totalBalls: {
          $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] }
        },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        player: '$_id',
        totalRuns: 1,
        totalBalls: 1,
        strikeRate: {
          $round: [{ $cond: [{ $eq: ['$totalBalls', 0] }, 0, { $multiply: [{ $divide: ['$totalRuns', '$totalBalls'] }, 100] }] }, 2]
        },
        fours: 1,
        sixes: 1
      }
    },
    { $sort: { totalRuns: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.status(200).json({
    status: 'success',
    data: topBatsmen
  });
});

// GET /api/players/top-bowlers?season=2020&limit=10
exports.getTopBowlers = catchAsync(async (req, res) => {
  const { season, limit = 10 } = req.query;

  let matchFilter = {};
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    matchFilter = { match_id: { $in: matchIds } };
  }

  const topBowlers = await Delivery.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$bowler',
        totalRunsConceded: { $sum: '$total_runs' },
        totalBalls: {
          $sum: { $cond: [{ $in: ['$extras_type', ['wides', 'noballs']] }, 0, 1] }
        },
        wickets: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$is_wicket', 1] },
                { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out']] } }
              ]},
              1, 0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        player: '$_id',
        wickets: 1,
        totalRunsConceded: 1,
        economy: {
          $round: [{
            $cond: [{ $eq: ['$totalBalls', 0] }, 0, { $divide: [{ $multiply: ['$totalRunsConceded', 6] }, '$totalBalls'] }]
          }, 2]
        },
        bowlingStrikeRate: {
          $round: [{
            $cond: [{ $eq: ['$wickets', 0] }, 0, { $divide: ['$totalBalls', '$wickets'] }]
          }, 2]
        }
      }
    },
    { $sort: { wickets: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.status(200).json({
    status: 'success',
    data: topBowlers
  });
});

// GET /api/players/matchup?batter=V+Kohli&bowler=JJ+Bumrah&season=2023 - Head-to-head batter vs bowler
exports.getMatchup = catchAsync(async (req, res) => {
  const { batter, bowler, season } = req.query;
  if (!batter || !bowler) {
    return res.status(400).json({ status: 'fail', message: 'Both batter and bowler are required' });
  }

  let matchFilter = { batter, bowler };
  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    matchFilter.match_id = { $in: matchIds };
  }

  const [stats] = await Delivery.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } },
        runs: { $sum: '$batsman_runs' },
        totalRuns: { $sum: '$total_runs' },
        fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
        dots: { $sum: { $cond: [{ $and: [{ $eq: ['$batsman_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } },
        wickets: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$is_wicket', 1] },
                { $eq: ['$player_dismissed', batter] },
                { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out']] } }
              ]},
              1, 0
            ]
          }
        },
        matchIds: { $addToSet: '$match_id' }
      }
    },
    {
      $project: {
        _id: 0,
        balls: 1,
        runs: 1,
        totalRuns: 1,
        fours: 1,
        sixes: 1,
        dots: 1,
        wickets: 1,
        matches: { $size: '$matchIds' },
        strikeRate: {
          $round: [{ $cond: [{ $eq: ['$balls', 0] }, 0, { $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }] }, 2]
        },
        dotBallPercentage: {
          $round: [{ $cond: [{ $eq: ['$balls', 0] }, 0, { $multiply: [{ $divide: ['$dots', '$balls'] }, 100] }] }, 2]
        },
        boundaryPercentage: {
          $round: [{
            $cond: [
              { $eq: ['$runs', 0] }, 0,
              { $multiply: [{ $divide: [{ $add: [{ $multiply: ['$fours', 4] }, { $multiply: ['$sixes', 6] }] }, '$runs'] }, 100] }
            ]
          }, 2]
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: stats || { balls: 0, runs: 0, fours: 0, sixes: 0, dots: 0, wickets: 0, matches: 0, strikeRate: 0, dotBallPercentage: 0, boundaryPercentage: 0 }
  });
});

// ─── 3-Tier Player Image Cache: Memory → MongoDB → Wikipedia ────────
// Tier 1: In-memory cache (instant, <1ms — survives until server restart)
const memoryImageCache = new Map(); // name → imageUrl|null

// Warm up: load all MongoDB-cached images into memory on startup
(async () => {
  try {
    const cached = await PlayerImage.find({}).lean();
    for (const doc of cached) {
      memoryImageCache.set(doc.playerName, doc.imageUrl);
    }
    console.log(`🖼️  Image cache warmed: ${cached.length} players in memory`);
  } catch (err) {
    console.error('Image cache warm-up failed:', err.message);
  }
})();

// Save image to both MongoDB (Tier 2) and memory (Tier 1)
async function persistImageCache(playerName, imageUrl) {
  memoryImageCache.set(playerName, imageUrl);
  try {
    await PlayerImage.findOneAndUpdate(
      { playerName },
      { playerName, imageUrl, fetchedAt: new Date(), source: 'wikipedia' },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`Failed to persist image for ${playerName}:`, err.message);
  }
}

// Tier 3: Fetch from Wikipedia (slow, 1-3s — only called if not in any cache)
async function fetchWikipediaImage(playerName) {
  // Check memory cache first (Tier 1)
  if (memoryImageCache.has(playerName)) {
    return memoryImageCache.get(playerName);
  }

  // Check MongoDB cache (Tier 2)
  try {
    const dbCached = await PlayerImage.findOne({ playerName }).lean();
    if (dbCached) {
      memoryImageCache.set(playerName, dbCached.imageUrl);
      return dbCached.imageUrl;
    }
  } catch {}

  // Tier 3: Fetch from Wikipedia
  const UA = { headers: { 'User-Agent': 'IPLDashboard/1.0 (educational project)' } };
  const nameParts = playerName.trim().split(/\s+/);
  const surname = nameParts[nameParts.length - 1].toLowerCase();
  const firstName = nameParts[0].toLowerCase();

  async function getVerifiedCricketerImage(pageTitle) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const res = await fetch(url, UA);
      if (!res.ok) return null;
      const data = await res.json();
      const title = (data.title || '').toLowerCase();
      const desc = (data.description || '').toLowerCase();
      const extract = (data.extract || '').toLowerCase();

      const isCricketer = desc.includes('cricket') || desc.includes('cricketer') ||
        (extract.includes('cricket') && (extract.includes('batsman') || extract.includes('batter') || extract.includes('bowler') || extract.includes('ipl') || extract.includes('wicket')));
      if (!isCricketer) return null;

      const fullText = `${title} ${extract}`;
      const textWords = fullText.split(/[\s,.\-()]+/).filter(Boolean);

      if (!fullText.includes(surname)) return null;

      if (firstName.length >= 3) {
        if (!fullText.includes(firstName)) return null;
      } else {
        const chars = firstName.split('');
        const availableWords = [...textWords];
        const allInitialsMatch = chars.every(c => {
          const idx = availableWords.findIndex(w => w[0] === c);
          if (idx === -1) return false;
          availableWords.splice(idx, 1);
          return true;
        });
        if (!allInitialsMatch) return null;
      }

      return data.thumbnail?.source || null;
    } catch { return null; }
  }

  try {
    // Direct page lookup
    const directImage = await getVerifiedCricketerImage(playerName);
    if (directImage) {
      await persistImageCache(playerName, directImage);
      return directImage;
    }

    // Search Wikipedia
    const searches = [
      `${playerName} cricketer IPL`,
      ...(firstName.length <= 3 && nameParts.length > 1 ? [`${surname} cricketer IPL`] : []),
    ];

    for (const q of searches) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5`;
      const searchRes = await fetch(searchUrl, UA);
      const searchData = await searchRes.json();
      const results = searchData.query?.search || [];

      for (const r of results) {
        const image = await getVerifiedCricketerImage(r.title);
        if (image) {
          await persistImageCache(playerName, image);
          return image;
        }
      }
    }

    // No match found — cache null to avoid re-fetching
    await persistImageCache(playerName, null);
    return null;
  } catch (err) {
    console.error('Wikipedia image fetch error:', err.message);
    await persistImageCache(playerName, null);
    return null;
  }
}

// GET /api/players/image/:name - Get player's real photo (3-tier cached)
exports.getPlayerImage = catchAsync(async (req, res) => {
  const name = decodeURIComponent(req.params.name).trim();
  if (!name) {
    return res.status(400).json({ status: 'fail', message: 'Player name is required' });
  }

  const imageUrl = await fetchWikipediaImage(name);

  // Tell browser to cache for 30 days
  res.set('Cache-Control', 'public, max-age=2592000');
  res.status(200).json({
    status: 'success',
    data: {
      name,
      imageUrl,
      fallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=80&bold=true&format=svg`
    }
  });
});

// GET /api/players/images - Batch: get images for multiple players (3-tier cached)
exports.getPlayerImages = catchAsync(async (req, res) => {
  const names = req.query.names ? req.query.names.split(',').map(n => n.trim()).filter(Boolean) : [];
  if (!names.length) {
    return res.status(400).json({ status: 'fail', message: 'Provide comma-separated player names' });
  }

  // Fetch ALL names concurrently (each has its own 3-tier cache check)
  const results = {};
  const promises = names.map(async (name) => {
    try {
      const imageUrl = await fetchWikipediaImage(name);
      results[name] = imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=80&bold=true&format=svg`;
    } catch {
      results[name] = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=80&bold=true&format=svg`;
    }
  });
  await Promise.all(promises);

  res.set('Cache-Control', 'public, max-age=2592000');
  res.status(200).json({ status: 'success', data: results });
});

// GET /api/players/:name/phase-stats - Phase-wise batting & bowling stats (PP / Middle / Death)
exports.getPhaseStats = catchAsync(async (req, res) => {
  const player = req.params.name;

  const empty = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, strikeRate: 0, dotPct: 0 };
  const emptyBowl = { runsConceded: 0, balls: 0, wickets: 0, dots: 0, economy: 0, dotPct: 0 };

  // Phase-wise batting
  const battingPipeline = [
    { $match: { batter: player } },
    { $addFields: {
      phase: { $cond: [{ $lte: ['$over', 5] }, 'powerplay',
               { $cond: [{ $lte: ['$over', 14] }, 'middle', 'death'] }] }
    }},
    { $group: {
      _id: '$phase',
      runs: { $sum: '$batsman_runs' },
      balls: { $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] } },
      fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
      sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
      dots: { $sum: { $cond: [{ $and: [{ $eq: ['$batsman_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } }
    }},
    { $project: {
      _id: 0, phase: '$_id', runs: 1, balls: 1, fours: 1, sixes: 1, dots: 1,
      strikeRate: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 2] }, 0] },
      dotPct: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$dots', '$balls'] }, 100] }, 2] }, 0] }
    }}
  ];

  // Phase-wise bowling
  const bowlingPipeline = [
    { $match: { bowler: player } },
    { $addFields: {
      phase: { $cond: [{ $lte: ['$over', 5] }, 'powerplay',
               { $cond: [{ $lte: ['$over', 14] }, 'middle', 'death'] }] }
    }},
    { $group: {
      _id: '$phase',
      runsConceded: { $sum: '$total_runs' },
      balls: { $sum: { $cond: [{ $and: [{ $ne: ['$extras_type', 'wides'] }, { $ne: ['$extras_type', 'noballs'] }] }, 1, 0] } },
      wickets: { $sum: { $cond: [{ $and: [{ $eq: ['$is_wicket', 1] }, { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'obstructing the field']] } }] }, 1, 0] } },
      dots: { $sum: { $cond: [{ $and: [{ $eq: ['$total_runs', 0] }, { $ne: ['$extras_type', 'wides'] }] }, 1, 0] } }
    }},
    { $project: {
      _id: 0, phase: '$_id', runsConceded: 1, balls: 1, wickets: 1, dots: 1,
      economy: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$runsConceded', '$balls'] }, 6] }, 2] }, 0] },
      dotPct: { $cond: [{ $gt: ['$balls', 0] }, { $round: [{ $multiply: [{ $divide: ['$dots', '$balls'] }, 100] }, 2] }, 0] }
    }}
  ];

  const [batPhases, bowlPhases] = await Promise.all([
    Delivery.aggregate(battingPipeline),
    Delivery.aggregate(bowlingPipeline)
  ]);

  const batMap = {};
  batPhases.forEach(p => { batMap[p.phase] = p; });
  const bowlMap = {};
  bowlPhases.forEach(p => { bowlMap[p.phase] = p; });

  res.set('Cache-Control', 'public, max-age=600');
  res.status(200).json({
    status: 'success',
    data: {
      batting: {
        powerplay: { ...empty, ...batMap.powerplay, phase: 'Powerplay' },
        middle: { ...empty, ...batMap.middle, phase: 'Middle' },
        death: { ...empty, ...batMap.death, phase: 'Death' }
      },
      bowling: {
        powerplay: { ...emptyBowl, ...bowlMap.powerplay, phase: 'Powerplay' },
        middle: { ...emptyBowl, ...bowlMap.middle, phase: 'Middle' },
        death: { ...emptyBowl, ...bowlMap.death, phase: 'Death' }
      }
    }
  });
});

// GET /api/players/cache-status - Check image cache stats (for debugging)
exports.getCacheStatus = catchAsync(async (req, res) => {
  const dbCount = await PlayerImage.countDocuments();
  const withImages = await PlayerImage.countDocuments({ imageUrl: { $ne: null } });
  res.status(200).json({
    status: 'success',
    data: {
      memoryCache: memoryImageCache.size,
      mongoCache: dbCount,
      withImages,
      withoutImages: dbCount - withImages,
      message: `${memoryImageCache.size} in memory, ${dbCount} in MongoDB (${withImages} with photos)`
    }
  });
});
