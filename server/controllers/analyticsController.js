const Delivery = require('../models/Delivery');
const Match = require('../models/Match');
const { catchAsync } = require('../middleware/errorHandler');

// ─── Custom Analytics Engine ───────────────────────────────────────
// Derived metrics that go beyond raw stats — demonstrates analytical thinking.

/**
 * Batting Impact Score (BIS) — Measures match-winning contribution
 * Formula: (Runs × SR_factor) + (Boundaries_weight) + (Finish_bonus) + (Pressure_bonus)
 *   SR_factor = SR / 130 (normalised around T20 par)
 *   Boundaries_weight = (4s × 1.5 + 6s × 3)
 *   Finish_bonus = +15 if batter was not out in a won match
 *   Pressure_bonus = death-over runs × 1.2
 */
exports.getBattingImpactScore = catchAsync(async (req, res) => {
  const { season, limit = 20 } = req.query;

  let matchFilter = {};
  if (season) matchFilter.season = season;

  // Get match outcomes
  const matches = await Match.find(matchFilter, { id: 1, winner: 1 }).lean();
  const matchMap = {};
  matches.forEach(m => { matchMap[m.id] = m.winner; });
  const matchIds = matches.map(m => m.id);

  const delivFilter = matchIds.length ? { match_id: { $in: matchIds } } : {};

  const pipeline = [
    { $match: delivFilter },
    { $addFields: {
      isDeath: { $gte: ['$over', 15] },
      isLegal: { $ne: ['$extras_type', 'wides'] }
    }},
    { $group: {
      _id: { batter: '$batter', match_id: '$match_id' },
      runs: { $sum: '$batsman_runs' },
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
      sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
      deathRuns: { $sum: { $cond: [{ $and: ['$isDeath', { $gt: ['$batsman_runs', 0] }] }, '$batsman_runs', 0] } },
      battingTeam: { $last: '$batting_team' },
      wasOut: { $max: { $cond: [{ $eq: ['$player_dismissed', '$batter'] }, 1, 0] } }
    }},
    { $project: {
      _id: 0,
      batter: '$_id.batter',
      match_id: '$_id.match_id',
      runs: 1, balls: 1, fours: 1, sixes: 1, deathRuns: 1, battingTeam: 1, wasOut: 1,
      sr: { $cond: [{ $gt: ['$balls', 0] }, { $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 0] }
    }}
  ];

  const innings = await Delivery.aggregate(pipeline);

  // Calculate per-player aggregate BIS
  const playerMap = {};
  innings.forEach(inn => {
    const srFactor = inn.sr / 130;
    const boundaryWeight = (inn.fours * 1.5) + (inn.sixes * 3);
    const winner = matchMap[inn.match_id];
    const finishBonus = (!inn.wasOut && winner === inn.battingTeam) ? 15 : 0;
    const pressureBonus = inn.deathRuns * 1.2;
    const bis = (inn.runs * srFactor) + boundaryWeight + finishBonus + pressureBonus;

    if (!playerMap[inn.batter]) {
      playerMap[inn.batter] = { totalBIS: 0, innings: 0, totalRuns: 0, totalBalls: 0, totalFours: 0, totalSixes: 0 };
    }
    const p = playerMap[inn.batter];
    p.totalBIS += bis;
    p.innings += 1;
    p.totalRuns += inn.runs;
    p.totalBalls += inn.balls;
    p.totalFours += inn.fours;
    p.totalSixes += inn.sixes;
  });

  const result = Object.entries(playerMap)
    .filter(([, v]) => v.innings >= 10)
    .map(([name, v]) => ({
      player: name,
      impactScore: Math.round((v.totalBIS / v.innings) * 100) / 100,
      totalBIS: Math.round(v.totalBIS),
      innings: v.innings,
      avgRuns: Math.round(v.totalRuns / v.innings * 100) / 100,
      sr: v.totalBalls > 0 ? Math.round((v.totalRuns / v.totalBalls) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, parseInt(limit));

  res.status(200).json({
    status: 'success',
    metric: 'Batting Impact Score',
    description: 'Measures match-winning batting contribution using SR factor, boundary weight, finish bonus & death-over pressure',
    data: result
  });
});

/**
 * Bowling Pressure Index (BPI) — Measures how much pressure a bowler creates
 * Formula: (Dot% × 1.5) + (Wickets_per_match × 10) + (Economy_factor) + (Death_clutch)
 *   Dot% = dot balls / total balls × 100
 *   Economy_factor = max(0, (8 - economy) × 5) — rewards sub-8 economy
 *   Death_clutch = death_over_wickets × 3
 */
exports.getBowlingPressureIndex = catchAsync(async (req, res) => {
  const { season, limit = 20 } = req.query;

  let matchFilter = {};
  if (season) matchFilter.season = season;

  const matchIds = season
    ? await Match.find(matchFilter).distinct('id')
    : null;

  const delivFilter = matchIds ? { match_id: { $in: matchIds } } : {};

  const pipeline = [
    { $match: delivFilter },
    { $addFields: {
      isDeath: { $gte: ['$over', 15] },
      isLegal: { $and: [{ $ne: ['$extras_type', 'wides'] }, { $ne: ['$extras_type', 'noballs'] }] },
      isBowlerWicket: { $and: [
        { $eq: ['$is_wicket', 1] },
        { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
      ]}
    }},
    { $group: {
      _id: { bowler: '$bowler', match_id: '$match_id' },
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      runs: { $sum: '$total_runs' },
      dots: { $sum: { $cond: [{ $and: ['$isLegal', { $eq: ['$total_runs', 0] }] }, 1, 0] } },
      wickets: { $sum: { $cond: ['$isBowlerWicket', 1, 0] } },
      deathWickets: { $sum: { $cond: [{ $and: ['$isBowlerWicket', '$isDeath'] }, 1, 0] } }
    }},
    { $match: { balls: { $gte: 6 } } } // At least 1 over per match appearance
  ];

  const spells = await Delivery.aggregate(pipeline);

  const playerMap = {};
  spells.forEach(sp => {
    if (!playerMap[sp._id.bowler]) {
      playerMap[sp._id.bowler] = { totalBPI: 0, matches: 0, totalBalls: 0, totalRuns: 0, totalDots: 0, totalWickets: 0, totalDeathWickets: 0 };
    }
    const p = playerMap[sp._id.bowler];
    const dotPct = sp.balls > 0 ? (sp.dots / sp.balls) * 100 : 0;
    const economy = sp.balls > 0 ? (sp.runs / sp.balls) * 6 : 12;
    const econFactor = Math.max(0, (8 - economy) * 5);
    const bpi = (dotPct * 1.5) + (sp.wickets * 10) + econFactor + (sp.deathWickets * 3);

    p.totalBPI += bpi;
    p.matches += 1;
    p.totalBalls += sp.balls;
    p.totalRuns += sp.runs;
    p.totalDots += sp.dots;
    p.totalWickets += sp.wickets;
    p.totalDeathWickets += sp.deathWickets;
  });

  const result = Object.entries(playerMap)
    .filter(([, v]) => v.matches >= 10)
    .map(([name, v]) => ({
      player: name,
      pressureIndex: Math.round((v.totalBPI / v.matches) * 100) / 100,
      totalBPI: Math.round(v.totalBPI),
      matches: v.matches,
      wickets: v.totalWickets,
      economy: v.totalBalls > 0 ? Math.round((v.totalRuns / v.totalBalls) * 600) / 100 : 0,
      dotPct: v.totalBalls > 0 ? Math.round((v.totalDots / v.totalBalls) * 10000) / 100 : 0,
      deathWickets: v.totalDeathWickets
    }))
    .sort((a, b) => b.pressureIndex - a.pressureIndex)
    .slice(0, parseInt(limit));

  res.status(200).json({
    status: 'success',
    metric: 'Bowling Pressure Index',
    description: 'Measures bowling pressure via dot ball %, wickets per match, economy factor & death-over clutch wickets',
    data: result
  });
});

/**
 * Death Over Rating (DOR) — Rates performance in overs 16-20
 * Batting: (runs × SR/140) + (sixes × 4) + (not-out bonus 10)
 * Bowling: (dotPct × 2) + (wickets × 12) + max(0, (9 - economy) × 4)
 */
exports.getDeathOverRating = catchAsync(async (req, res) => {
  const { season, type = 'batting', limit = 20 } = req.query;

  let matchIds = null;
  if (season) {
    matchIds = await Match.find({ season }).distinct('id');
  }

  const delivFilter = { over: { $gte: 15 } }; // over is 0-indexed, so 15 = over 16
  if (matchIds) delivFilter.match_id = { $in: matchIds };

  if (type === 'bowling') {
    const bowlPipeline = [
      { $match: delivFilter },
      { $addFields: {
        isLegal: { $and: [{ $ne: ['$extras_type', 'wides'] }, { $ne: ['$extras_type', 'noballs'] }] },
        isBowlerWicket: { $and: [
          { $eq: ['$is_wicket', 1] },
          { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
        ]}
      }},
      { $group: {
        _id: { bowler: '$bowler', match_id: '$match_id' },
        balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
        runs: { $sum: '$total_runs' },
        dots: { $sum: { $cond: [{ $and: ['$isLegal', { $eq: ['$total_runs', 0] }] }, 1, 0] } },
        wickets: { $sum: { $cond: ['$isBowlerWicket', 1, 0] } }
      }},
      { $match: { balls: { $gte: 6 } } }
    ];

    const spells = await Delivery.aggregate(bowlPipeline);
    const pMap = {};
    spells.forEach(sp => {
      const name = sp._id.bowler;
      if (!pMap[name]) pMap[name] = { totalDOR: 0, matches: 0, totalBalls: 0, totalRuns: 0, totalDots: 0, totalWickets: 0 };
      const p = pMap[name];
      const dotPct = sp.balls > 0 ? (sp.dots / sp.balls) * 100 : 0;
      const economy = sp.balls > 0 ? (sp.runs / sp.balls) * 6 : 15;
      const dor = (dotPct * 2) + (sp.wickets * 12) + Math.max(0, (9 - economy) * 4);
      p.totalDOR += dor;
      p.matches += 1;
      p.totalBalls += sp.balls;
      p.totalRuns += sp.runs;
      p.totalDots += sp.dots;
      p.totalWickets += sp.wickets;
    });

    const result = Object.entries(pMap)
      .filter(([, v]) => v.matches >= 8)
      .map(([name, v]) => ({
        player: name,
        deathRating: Math.round((v.totalDOR / v.matches) * 100) / 100,
        matches: v.matches,
        wickets: v.totalWickets,
        economy: v.totalBalls > 0 ? Math.round((v.totalRuns / v.totalBalls) * 600) / 100 : 0,
        dotPct: v.totalBalls > 0 ? Math.round((v.totalDots / v.totalBalls) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.deathRating - a.deathRating)
      .slice(0, parseInt(limit));

    return res.status(200).json({
      status: 'success',
      metric: 'Death Over Rating (Bowling)',
      description: 'Rates death-over bowling via dot ball %, wickets & economy in overs 16-20',
      data: result
    });
  }

  // Batting DOR
  const batPipeline = [
    { $match: delivFilter },
    { $addFields: { isLegal: { $ne: ['$extras_type', 'wides'] } } },
    { $group: {
      _id: { batter: '$batter', match_id: '$match_id' },
      runs: { $sum: '$batsman_runs' },
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
      fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
      wasOut: { $max: { $cond: [{ $eq: ['$player_dismissed', '$batter'] }, 1, 0] } }
    }},
    { $match: { balls: { $gte: 3 } } }
  ];

  const batInnings = await Delivery.aggregate(batPipeline);
  const pMap = {};
  batInnings.forEach(inn => {
    const name = inn._id.batter;
    if (!pMap[name]) pMap[name] = { totalDOR: 0, innings: 0, totalRuns: 0, totalBalls: 0, totalSixes: 0, totalFours: 0 };
    const p = pMap[name];
    const sr = inn.balls > 0 ? (inn.runs / inn.balls) * 100 : 0;
    const dor = (inn.runs * (sr / 140)) + (inn.sixes * 4) + (inn.fours * 1) + (!inn.wasOut ? 10 : 0);
    p.totalDOR += dor;
    p.innings += 1;
    p.totalRuns += inn.runs;
    p.totalBalls += inn.balls;
    p.totalSixes += inn.sixes;
    p.totalFours += inn.fours;
  });

  const result = Object.entries(pMap)
    .filter(([, v]) => v.innings >= 8)
    .map(([name, v]) => ({
      player: name,
      deathRating: Math.round((v.totalDOR / v.innings) * 100) / 100,
      innings: v.innings,
      runs: v.totalRuns,
      sr: v.totalBalls > 0 ? Math.round((v.totalRuns / v.totalBalls) * 10000) / 100 : 0,
      sixes: v.totalSixes
    }))
    .sort((a, b) => b.deathRating - a.deathRating)
    .slice(0, parseInt(limit));

  res.status(200).json({
    status: 'success',
    metric: 'Death Over Rating (Batting)',
    description: 'Rates death-over batting using runs × SR factor, sixes bonus & not-out bonus in overs 16-20',
    data: result
  });
});

/**
 * GET /api/analytics/player/:name — All 3 custom metrics for one player
 */
exports.getPlayerAnalytics = catchAsync(async (req, res) => {
  const player = req.params.name;

  // Batting Impact — aggregate per match
  const matchesData = await Match.find({}, { id: 1, winner: 1 }).lean();
  const winnerMap = {};
  matchesData.forEach(m => { winnerMap[m.id] = m.winner; });

  const batInnings = await Delivery.aggregate([
    { $match: { batter: player } },
    { $addFields: { isDeath: { $gte: ['$over', 15] }, isLegal: { $ne: ['$extras_type', 'wides'] } } },
    { $group: {
      _id: '$match_id',
      runs: { $sum: '$batsman_runs' },
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } },
      sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
      deathRuns: { $sum: { $cond: ['$isDeath', '$batsman_runs', 0] } },
      battingTeam: { $last: '$batting_team' },
      wasOut: { $max: { $cond: [{ $eq: ['$player_dismissed', player] }, 1, 0] } }
    }}
  ]);

  let totalBIS = 0;
  batInnings.forEach(inn => {
    const sr = inn.balls > 0 ? (inn.runs / inn.balls) * 100 : 0;
    const srFactor = sr / 130;
    const finishBonus = (!inn.wasOut && winnerMap[inn._id] === inn.battingTeam) ? 15 : 0;
    totalBIS += (inn.runs * srFactor) + (inn.fours * 1.5) + (inn.sixes * 3) + finishBonus + (inn.deathRuns * 1.2);
  });

  const avgBIS = batInnings.length > 0 ? Math.round((totalBIS / batInnings.length) * 100) / 100 : 0;

  // Bowling Pressure Index
  const bowlSpells = await Delivery.aggregate([
    { $match: { bowler: player } },
    { $addFields: {
      isDeath: { $gte: ['$over', 15] },
      isLegal: { $and: [{ $ne: ['$extras_type', 'wides'] }, { $ne: ['$extras_type', 'noballs'] }] },
      isBowlerWicket: { $and: [
        { $eq: ['$is_wicket', 1] },
        { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
      ]}
    }},
    { $group: {
      _id: '$match_id',
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      runs: { $sum: '$total_runs' },
      dots: { $sum: { $cond: [{ $and: ['$isLegal', { $eq: ['$total_runs', 0] }] }, 1, 0] } },
      wickets: { $sum: { $cond: ['$isBowlerWicket', 1, 0] } },
      deathWickets: { $sum: { $cond: [{ $and: ['$isBowlerWicket', '$isDeath'] }, 1, 0] } }
    }},
    { $match: { balls: { $gte: 6 } } }
  ]);

  let totalBPI = 0;
  bowlSpells.forEach(sp => {
    const dotPct = sp.balls > 0 ? (sp.dots / sp.balls) * 100 : 0;
    const economy = sp.balls > 0 ? (sp.runs / sp.balls) * 6 : 12;
    totalBPI += (dotPct * 1.5) + (sp.wickets * 10) + Math.max(0, (8 - economy) * 5) + (sp.deathWickets * 3);
  });

  const avgBPI = bowlSpells.length > 0 ? Math.round((totalBPI / bowlSpells.length) * 100) / 100 : 0;

  // Death Over Rating (batting + bowling)
  const deathBat = await Delivery.aggregate([
    { $match: { batter: player, over: { $gte: 15 } } },
    { $addFields: { isLegal: { $ne: ['$extras_type', 'wides'] } } },
    { $group: {
      _id: null,
      runs: { $sum: '$batsman_runs' },
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      sixes: { $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] } },
      fours: { $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] } }
    }}
  ]);

  const deathBowl = await Delivery.aggregate([
    { $match: { bowler: player, over: { $gte: 15 } } },
    { $addFields: {
      isLegal: { $and: [{ $ne: ['$extras_type', 'wides'] }, { $ne: ['$extras_type', 'noballs'] }] },
      isBowlerWicket: { $and: [
        { $eq: ['$is_wicket', 1] },
        { $not: { $in: ['$dismissal_kind', ['run out', 'retired hurt', 'retired out', 'obstructing the field']] } }
      ]}
    }},
    { $group: {
      _id: null,
      balls: { $sum: { $cond: ['$isLegal', 1, 0] } },
      runs: { $sum: '$total_runs' },
      dots: { $sum: { $cond: [{ $and: ['$isLegal', { $eq: ['$total_runs', 0] }] }, 1, 0] } },
      wickets: { $sum: { $cond: ['$isBowlerWicket', 1, 0] } }
    }}
  ]);

  const db = deathBat[0] || { runs: 0, balls: 0, sixes: 0, fours: 0 };
  const dbw = deathBowl[0] || { balls: 0, runs: 0, dots: 0, wickets: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      player,
      battingImpact: {
        score: avgBIS,
        innings: batInnings.length,
        description: 'Avg match-winning batting contribution'
      },
      bowlingPressure: {
        index: avgBPI,
        matches: bowlSpells.length,
        description: 'Avg bowling pressure per match'
      },
      deathOvers: {
        batting: {
          runs: db.runs, balls: db.balls, sixes: db.sixes, fours: db.fours,
          sr: db.balls > 0 ? Math.round((db.runs / db.balls) * 10000) / 100 : 0
        },
        bowling: {
          balls: dbw.balls, runsConceded: dbw.runs, wickets: dbw.wickets,
          economy: dbw.balls > 0 ? Math.round((dbw.runs / dbw.balls) * 600) / 100 : 0,
          dotPct: dbw.balls > 0 ? Math.round((dbw.dots / dbw.balls) * 10000) / 100 : 0
        }
      }
    }
  });
});
