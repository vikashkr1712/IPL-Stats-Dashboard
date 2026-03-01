const Match = require('../models/Match');
const Delivery = require('../models/Delivery');
const { catchAsync, AppError } = require('../middleware/errorHandler');

/* ================================================================
   CATEGORY DEFINITIONS
   ================================================================ */

const CATEGORIES = {
  // ========== BATTER — CAREER ==========
  orange_cap: {
    label: 'Orange Cap / Most Runs', type: 'batter', mode: 'career',
    sort: { runs: -1, sr: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'runs', label: 'RUNS' }, { key: 'hs', label: 'HS' },
      { key: 'avg', label: 'AVG' }, { key: 'sr', label: 'SR' },
      { key: 'fours', label: '4s' }, { key: 'sixes', label: '6s' }
    ]
  },
  most_fours: {
    label: 'Most Fours', type: 'batter', mode: 'career',
    sort: { fours: -1, runs: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'fours', label: '4s' }, { key: 'runs', label: 'RUNS' },
      { key: 'sr', label: 'SR' }
    ]
  },
  most_sixes: {
    label: 'Most Sixes', type: 'batter', mode: 'career',
    sort: { sixes: -1, runs: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'sixes', label: '6s' }, { key: 'runs', label: 'RUNS' },
      { key: 'sr', label: 'SR' }
    ]
  },
  most_fifties: {
    label: 'Most Fifties', type: 'batter', mode: 'career',
    sort: { fifties: -1, runs: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'fifties', label: '50s' }, { key: 'centuries', label: '100s' },
      { key: 'runs', label: 'RUNS' }, { key: 'avg', label: 'AVG' }
    ]
  },
  most_centuries: {
    label: 'Most Centuries', type: 'batter', mode: 'career',
    sort: { centuries: -1, runs: -1 },
    postFilter: { centuries: { $gt: 0 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'centuries', label: '100s' }, { key: 'fifties', label: '50s' },
      { key: 'runs', label: 'RUNS' }, { key: 'avg', label: 'AVG' }
    ]
  },
  best_batting_sr: {
    label: 'Best Strike Rate', type: 'batter', mode: 'career',
    sort: { sr: -1 },
    minFilter: { balls: { $gte: 500 } }, seasonMinFilter: { balls: { $gte: 100 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'runs', label: 'RUNS' }, { key: 'balls', label: 'BALLS' },
      { key: 'sr', label: 'SR' }
    ]
  },
  best_batting_avg: {
    label: 'Best Batting Average', type: 'batter', mode: 'career',
    sort: { avg: -1 },
    minFilter: { innings: { $gte: 30 } }, seasonMinFilter: { innings: { $gte: 8 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'runs', label: 'RUNS' }, { key: 'outs', label: 'OUTS' },
      { key: 'avg', label: 'AVG' }
    ]
  },

  // ========== BATTER — INNINGS ==========
  most_fours_innings: {
    label: 'Most Fours (Innings)', type: 'batter', mode: 'innings',
    sort: { fours: -1, runs: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'fours', label: '4s' }, { key: 'runs', label: 'RUNS' },
      { key: 'balls', label: 'BALLS' }, { key: 'sr', label: 'SR' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  most_sixes_innings: {
    label: 'Most Sixes (Innings)', type: 'batter', mode: 'innings',
    sort: { sixes: -1, runs: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'sixes', label: '6s' }, { key: 'runs', label: 'RUNS' },
      { key: 'balls', label: 'BALLS' }, { key: 'sr', label: 'SR' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  fastest_fifties: {
    label: 'Fastest Fifties', type: 'batter', mode: 'innings',
    sort: { balls: 1, runs: -1 },
    inningsFilter: { runs: { $gte: 50 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'runs', label: 'RUNS' }, { key: 'balls', label: 'BALLS' },
      { key: 'fours', label: '4s' }, { key: 'sixes', label: '6s' },
      { key: 'sr', label: 'SR' }, { key: 'opponent', label: 'VS' }
    ]
  },
  fastest_centuries: {
    label: 'Fastest Centuries', type: 'batter', mode: 'innings',
    sort: { balls: 1, runs: -1 },
    inningsFilter: { runs: { $gte: 100 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'runs', label: 'RUNS' }, { key: 'balls', label: 'BALLS' },
      { key: 'fours', label: '4s' }, { key: 'sixes', label: '6s' },
      { key: 'sr', label: 'SR' }, { key: 'opponent', label: 'VS' }
    ]
  },
  highest_scores: {
    label: 'Highest Scores', type: 'batter', mode: 'innings',
    sort: { runs: -1, balls: 1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'runs', label: 'RUNS' }, { key: 'balls', label: 'BALLS' },
      { key: 'fours', label: '4s' }, { key: 'sixes', label: '6s' },
      { key: 'sr', label: 'SR' }, { key: 'opponent', label: 'VS' }
    ]
  },
  best_batting_sr_innings: {
    label: 'Best Strike Rate (Innings)', type: 'batter', mode: 'innings',
    sort: { sr: -1, runs: -1 },
    inningsFilter: { balls: { $gte: 20 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'runs', label: 'RUNS' }, { key: 'balls', label: 'BALLS' },
      { key: 'sr', label: 'SR' }, { key: 'fours', label: '4s' },
      { key: 'sixes', label: '6s' }, { key: 'opponent', label: 'VS' }
    ]
  },

  // ========== BOWLER — CAREER ==========
  purple_cap: {
    label: 'Purple Cap / Most Wickets', type: 'bowler', mode: 'career',
    sort: { wickets: -1, avg: 1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'wickets', label: 'WKTS' }, { key: 'overs', label: 'OVS' },
      { key: 'economy', label: 'ECON' }, { key: 'avg', label: 'AVG' },
      { key: 'sr', label: 'SR' }
    ]
  },
  most_dot_balls: {
    label: 'Most Dot Balls', type: 'bowler', mode: 'career',
    sort: { dots: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'dots', label: 'DOTS' }, { key: 'overs', label: 'OVS' },
      { key: 'economy', label: 'ECON' }
    ]
  },
  most_maidens: {
    label: 'Most Maidens', type: 'bowler', mode: 'maidens',
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'maidens', label: 'MDNS' }, { key: 'overs', label: 'OVS' },
      { key: 'economy', label: 'ECON' }
    ]
  },
  best_bowling_avg: {
    label: 'Best Bowling Average', type: 'bowler', mode: 'career',
    sort: { avg: 1 },
    minFilter: { wickets: { $gte: 30 } }, seasonMinFilter: { wickets: { $gte: 8 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'wickets', label: 'WKTS' }, { key: 'runsConceded', label: 'RUNS' },
      { key: 'avg', label: 'AVG' }
    ]
  },
  best_bowling_economy: {
    label: 'Best Economy Rate', type: 'bowler', mode: 'career',
    sort: { economy: 1 },
    minFilter: { legalBalls: { $gte: 500 } }, seasonMinFilter: { legalBalls: { $gte: 100 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'overs', label: 'OVS' }, { key: 'runsConceded', label: 'RUNS' },
      { key: 'economy', label: 'ECON' }
    ]
  },
  best_bowling_sr: {
    label: 'Best Bowling Strike Rate', type: 'bowler', mode: 'career',
    sort: { sr: 1 },
    minFilter: { wickets: { $gte: 30 } }, seasonMinFilter: { wickets: { $gte: 8 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'matches', label: 'MAT' }, { key: 'innings', label: 'INNS' },
      { key: 'wickets', label: 'WKTS' }, { key: 'legalBalls', label: 'BALLS' },
      { key: 'sr', label: 'SR' }
    ]
  },

  // ========== BOWLER — INNINGS ==========
  most_dot_balls_innings: {
    label: 'Most Dot Balls (Innings)', type: 'bowler', mode: 'innings',
    sort: { dots: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'dots', label: 'DOTS' }, { key: 'overs', label: 'OVS' },
      { key: 'runsConceded', label: 'RUNS' }, { key: 'opponent', label: 'VS' }
    ]
  },
  best_bowling_economy_innings: {
    label: 'Best Economy (Innings)', type: 'bowler', mode: 'innings',
    sort: { economy: 1, wickets: -1 },
    inningsFilter: { legalBalls: { $gte: 24 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'overs', label: 'OVS' }, { key: 'runsConceded', label: 'RUNS' },
      { key: 'economy', label: 'ECON' }, { key: 'wickets', label: 'WKTS' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  best_bowling_sr_innings: {
    label: 'Best Bowling SR (Innings)', type: 'bowler', mode: 'innings',
    sort: { sr: 1, wickets: -1 },
    inningsFilter: { wickets: { $gte: 1 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'wickets', label: 'WKTS' }, { key: 'legalBalls', label: 'BALLS' },
      { key: 'sr', label: 'SR' }, { key: 'runsConceded', label: 'RUNS' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  best_bowling_figures: {
    label: 'Best Bowling Figures', type: 'bowler', mode: 'innings',
    sort: { wickets: -1, runsConceded: 1 },
    inningsFilter: { wickets: { $gte: 1 } },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'wickets', label: 'WKTS' }, { key: 'runsConceded', label: 'RUNS' },
      { key: 'overs', label: 'OVS' }, { key: 'economy', label: 'ECON' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  most_runs_conceded: {
    label: 'Most Runs Conceded (Innings)', type: 'bowler', mode: 'innings',
    sort: { runsConceded: -1 },
    columns: [
      { key: 'pos', label: 'POS' }, { key: 'player', label: 'PLAYER' },
      { key: 'runsConceded', label: 'RUNS' }, { key: 'overs', label: 'OVS' },
      { key: 'wickets', label: 'WKTS' }, { key: 'economy', label: 'ECON' },
      { key: 'opponent', label: 'VS' }
    ]
  },
  hat_tricks: {
    label: 'Hat-tricks (3+ Wkts in Over)', type: 'bowler', mode: 'hat_tricks',
    columns: [
      { key: 'pos', label: '#' }, { key: 'player', label: 'PLAYER' },
      { key: 'wicketsInOver', label: 'WKTS' },
      { key: 'opponent', label: 'VS' }, { key: 'venue', label: 'VENUE' },
      { key: 'season', label: 'SEASON' }
    ]
  }
};

/* ================================================================
   PIPELINE BUILDERS
   ================================================================ */

// ---------- Career Batting ----------
async function careerBatting(deliveryFilter, config, limit, hasSeason) {
  const minFilter = hasSeason && config.seasonMinFilter
    ? config.seasonMinFilter : config.minFilter;

  const pipeline = [
    { $match: deliveryFilter },
    // Per-innings aggregation
    { $group: {
      _id: { batter: '$batter', match_id: '$match_id', inning: '$inning' },
      team: { $first: '$batting_team' },
      runs: { $sum: '$batsman_runs' },
      balls: {
        $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] }
      },
      fours: {
        $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] }
      },
      sixes: {
        $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] }
      },
      isOut: {
        $max: { $cond: [
          { $and: [
            { $eq: ['$is_wicket', 1] },
            { $eq: ['$player_dismissed', '$batter'] }
          ]}, 1, 0
        ]}
      }
    }},
    // Sort by match_id desc to get latest team first
    { $sort: { '_id.match_id': -1 } },
    // Career totals
    { $group: {
      _id: '$_id.batter',
      team: { $first: '$team' },
      matches: { $addToSet: '$_id.match_id' },
      innings: { $sum: 1 },
      runs: { $sum: '$runs' },
      balls: { $sum: '$balls' },
      fours: { $sum: '$fours' },
      sixes: { $sum: '$sixes' },
      outs: { $sum: '$isOut' },
      fifties: {
        $sum: { $cond: [
          { $and: [{ $gte: ['$runs', 50] }, { $lt: ['$runs', 100] }] }, 1, 0
        ]}
      },
      centuries: {
        $sum: { $cond: [{ $gte: ['$runs', 100] }, 1, 0] }
      },
      hs: { $max: '$runs' }
    }},
    // Derived stats
    { $addFields: {
      matches: { $size: '$matches' },
      avg: {
        $cond: [{ $gt: ['$outs', 0] },
          { $round: [{ $divide: ['$runs', '$outs'] }, 2] }, null]
      },
      sr: {
        $cond: [{ $gt: ['$balls', 0] },
          { $round: [{ $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 2] }, null]
      }
    }}
  ];

  if (config.postFilter) pipeline.push({ $match: config.postFilter });
  if (minFilter) pipeline.push({ $match: minFilter });

  pipeline.push({ $sort: config.sort });
  pipeline.push({ $limit: parseInt(limit) });
  pipeline.push({ $project: {
    _id: 0, player: '$_id', team: 1,
    matches: 1, innings: 1, runs: 1, balls: 1,
    fours: 1, sixes: 1, fifties: 1, centuries: 1,
    outs: 1, hs: 1, avg: 1, sr: 1
  }});

  return Delivery.aggregate(pipeline).allowDiskUse(true);
}

// ---------- Innings Batting ----------
async function inningsBatting(deliveryFilter, config, limit) {
  const pipeline = [
    { $match: deliveryFilter },
    { $group: {
      _id: { batter: '$batter', match_id: '$match_id', inning: '$inning' },
      team: { $first: '$batting_team' },
      opponent: { $first: '$bowling_team' },
      runs: { $sum: '$batsman_runs' },
      balls: {
        $sum: { $cond: [{ $ne: ['$extras_type', 'wides'] }, 1, 0] }
      },
      fours: {
        $sum: { $cond: [{ $eq: ['$batsman_runs', 4] }, 1, 0] }
      },
      sixes: {
        $sum: { $cond: [{ $eq: ['$batsman_runs', 6] }, 1, 0] }
      }
    }},
    { $addFields: {
      sr: {
        $cond: [{ $gt: ['$balls', 0] },
          { $round: [{ $multiply: [{ $divide: ['$runs', '$balls'] }, 100] }, 2] }, null]
      }
    }}
  ];

  if (config.inningsFilter) pipeline.push({ $match: config.inningsFilter });

  pipeline.push(
    { $lookup: {
      from: 'matches',
      localField: '_id.match_id',
      foreignField: 'id',
      as: 'match'
    }},
    { $unwind: { path: '$match', preserveNullAndEmptyArrays: true } }
  );

  pipeline.push({ $sort: config.sort });
  pipeline.push({ $limit: parseInt(limit) });
  pipeline.push({ $project: {
    _id: 0, player: '$_id.batter', team: 1, opponent: 1,
    runs: 1, balls: 1, fours: 1, sixes: 1, sr: 1,
    venue: '$match.venue', season: '$match.season'
  }});

  return Delivery.aggregate(pipeline).allowDiskUse(true);
}

// ---------- Career Bowling ----------
async function careerBowling(deliveryFilter, config, limit, hasSeason) {
  const minFilter = hasSeason && config.seasonMinFilter
    ? config.seasonMinFilter : config.minFilter;

  const pipeline = [
    { $match: deliveryFilter },
    // Per-innings
    { $group: {
      _id: { bowler: '$bowler', match_id: '$match_id', inning: '$inning' },
      team: { $first: '$bowling_team' },
      runsConceded: {
        $sum: { $cond: [
          { $in: ['$extras_type', ['byes', 'legbyes']] },
          0, '$total_runs'
        ]}
      },
      legalBalls: {
        $sum: { $cond: [
          { $not: [{ $in: ['$extras_type', ['wides', 'noballs']] }] }, 1, 0
        ]}
      },
      wickets: {
        $sum: { $cond: [
          { $and: [
            { $eq: ['$is_wicket', 1] },
            { $not: [{ $in: ['$dismissal_kind', [
              'run out', 'retired hurt', 'retired out', 'obstructing the field'
            ]] }] }
          ]}, 1, 0
        ]}
      },
      dots: {
        $sum: { $cond: [{ $eq: ['$total_runs', 0] }, 1, 0] }
      }
    }},
    { $sort: { '_id.match_id': -1 } },
    // Career totals
    { $group: {
      _id: '$_id.bowler',
      team: { $first: '$team' },
      matches: { $addToSet: '$_id.match_id' },
      innings: { $sum: 1 },
      runsConceded: { $sum: '$runsConceded' },
      legalBalls: { $sum: '$legalBalls' },
      wickets: { $sum: '$wickets' },
      dots: { $sum: '$dots' }
    }},
    { $addFields: {
      matches: { $size: '$matches' },
      overs: {
        $round: [{ $add: [
          { $floor: { $divide: ['$legalBalls', 6] } },
          { $multiply: [{ $mod: ['$legalBalls', 6] }, 0.1] }
        ]}, 1]
      },
      economy: {
        $cond: [{ $gt: ['$legalBalls', 0] },
          { $round: [{ $divide: [{ $multiply: ['$runsConceded', 6] }, '$legalBalls'] }, 2] },
          null]
      },
      avg: {
        $cond: [{ $gt: ['$wickets', 0] },
          { $round: [{ $divide: ['$runsConceded', '$wickets'] }, 2] },
          null]
      },
      sr: {
        $cond: [{ $gt: ['$wickets', 0] },
          { $round: [{ $divide: ['$legalBalls', '$wickets'] }, 2] },
          null]
      }
    }}
  ];

  if (minFilter) pipeline.push({ $match: minFilter });

  pipeline.push({ $sort: config.sort });
  pipeline.push({ $limit: parseInt(limit) });
  pipeline.push({ $project: {
    _id: 0, player: '$_id', team: 1,
    matches: 1, innings: 1, wickets: 1,
    runsConceded: 1, legalBalls: 1, dots: 1,
    overs: 1, economy: 1, avg: 1, sr: 1
  }});

  return Delivery.aggregate(pipeline).allowDiskUse(true);
}

// ---------- Innings Bowling ----------
async function inningsBowling(deliveryFilter, config, limit) {
  const pipeline = [
    { $match: deliveryFilter },
    { $group: {
      _id: { bowler: '$bowler', match_id: '$match_id', inning: '$inning' },
      team: { $first: '$bowling_team' },
      opponent: { $first: '$batting_team' },
      runsConceded: {
        $sum: { $cond: [
          { $in: ['$extras_type', ['byes', 'legbyes']] },
          0, '$total_runs'
        ]}
      },
      legalBalls: {
        $sum: { $cond: [
          { $not: [{ $in: ['$extras_type', ['wides', 'noballs']] }] }, 1, 0
        ]}
      },
      wickets: {
        $sum: { $cond: [
          { $and: [
            { $eq: ['$is_wicket', 1] },
            { $not: [{ $in: ['$dismissal_kind', [
              'run out', 'retired hurt', 'retired out', 'obstructing the field'
            ]] }] }
          ]}, 1, 0
        ]}
      },
      dots: {
        $sum: { $cond: [{ $eq: ['$total_runs', 0] }, 1, 0] }
      }
    }},
    { $addFields: {
      overs: {
        $round: [{ $add: [
          { $floor: { $divide: ['$legalBalls', 6] } },
          { $multiply: [{ $mod: ['$legalBalls', 6] }, 0.1] }
        ]}, 1]
      },
      economy: {
        $cond: [{ $gt: ['$legalBalls', 0] },
          { $round: [{ $divide: [{ $multiply: ['$runsConceded', 6] }, '$legalBalls'] }, 2] },
          null]
      },
      sr: {
        $cond: [{ $gt: ['$wickets', 0] },
          { $round: [{ $divide: ['$legalBalls', '$wickets'] }, 2] },
          null]
      }
    }}
  ];

  if (config.inningsFilter) pipeline.push({ $match: config.inningsFilter });

  pipeline.push(
    { $lookup: {
      from: 'matches',
      localField: '_id.match_id',
      foreignField: 'id',
      as: 'match'
    }},
    { $unwind: { path: '$match', preserveNullAndEmptyArrays: true } }
  );

  pipeline.push({ $sort: config.sort });
  pipeline.push({ $limit: parseInt(limit) });
  pipeline.push({ $project: {
    _id: 0, player: '$_id.bowler', team: 1, opponent: 1,
    wickets: 1, runsConceded: 1, legalBalls: 1,
    dots: 1, overs: 1, economy: 1, sr: 1,
    venue: '$match.venue', season: '$match.season'
  }});

  return Delivery.aggregate(pipeline).allowDiskUse(true);
}

// ---------- Maidens Pipeline ----------
async function maidensPipeline(deliveryFilter, limit) {
  return Delivery.aggregate([
    { $match: deliveryFilter },
    // Group at over level
    { $group: {
      _id: { bowler: '$bowler', match_id: '$match_id', inning: '$inning', over: '$over' },
      team: { $first: '$bowling_team' },
      totalRuns: { $sum: '$total_runs' },
      legalBalls: {
        $sum: { $cond: [
          { $not: [{ $in: ['$extras_type', ['wides', 'noballs']] }] }, 1, 0
        ]}
      },
      runsConceded: {
        $sum: { $cond: [
          { $in: ['$extras_type', ['byes', 'legbyes']] },
          0, '$total_runs'
        ]}
      }
    }},
    // Group by bowler
    { $group: {
      _id: '$_id.bowler',
      team: { $last: '$team' },
      maidens: {
        $sum: { $cond: [
          { $and: [
            { $eq: ['$totalRuns', 0] },
            { $gte: ['$legalBalls', 6] }
          ]}, 1, 0
        ]}
      },
      totalLegalBalls: { $sum: '$legalBalls' },
      totalRunsConceded: { $sum: '$runsConceded' },
      matches: { $addToSet: '$_id.match_id' },
      inningsList: {
        $addToSet: {
          $concat: [
            { $toString: '$_id.match_id' }, '-',
            { $toString: '$_id.inning' }
          ]
        }
      }
    }},
    { $addFields: {
      matches: { $size: '$matches' },
      innings: { $size: '$inningsList' },
      overs: {
        $round: [{ $add: [
          { $floor: { $divide: ['$totalLegalBalls', 6] } },
          { $multiply: [{ $mod: ['$totalLegalBalls', 6] }, 0.1] }
        ]}, 1]
      },
      economy: {
        $cond: [{ $gt: ['$totalLegalBalls', 0] },
          { $round: [{ $divide: [
            { $multiply: ['$totalRunsConceded', 6] }, '$totalLegalBalls'
          ] }, 2] }, null]
      }
    }},
    { $match: { maidens: { $gt: 0 } } },
    { $sort: { maidens: -1 } },
    { $limit: parseInt(limit) },
    { $project: {
      _id: 0, player: '$_id', team: 1,
      matches: 1, innings: 1,
      maidens: 1, overs: 1, economy: 1
    }}
  ]).allowDiskUse(true);
}

// ---------- Hat-tricks Pipeline (3+ wickets in single over) ----------
async function hatTricksPipeline(deliveryFilter, limit) {
  return Delivery.aggregate([
    { $match: {
      ...deliveryFilter,
      is_wicket: 1,
      dismissal_kind: {
        $nin: ['run out', 'retired hurt', 'retired out', 'obstructing the field']
      }
    }},
    { $group: {
      _id: { bowler: '$bowler', match_id: '$match_id', inning: '$inning', over: '$over' },
      wicketsInOver: { $sum: 1 },
      team: { $first: '$bowling_team' },
      opponent: { $first: '$batting_team' }
    }},
    { $match: { wicketsInOver: { $gte: 3 } } },
    { $lookup: {
      from: 'matches',
      localField: '_id.match_id',
      foreignField: 'id',
      as: 'match'
    }},
    { $unwind: { path: '$match', preserveNullAndEmptyArrays: true } },
    { $sort: { wicketsInOver: -1, 'match.date': -1 } },
    { $limit: parseInt(limit) },
    { $project: {
      _id: 0,
      player: '$_id.bowler',
      team: 1, opponent: 1,
      wicketsInOver: 1,
      venue: '$match.venue',
      season: '$match.season'
    }}
  ]).allowDiskUse(true);
}

/* ================================================================
   MAIN HANDLERS
   ================================================================ */

exports.getLeaderboard = catchAsync(async (req, res, next) => {
  const { category = 'orange_cap', season, team, limit = 50 } = req.query;

  const config = CATEGORIES[category];
  if (!config) {
    return next(new AppError(
      `Invalid category: ${category}. Use GET /api/stats/leaderboard/categories for valid options.`,
      400
    ));
  }

  // Build delivery filter
  let deliveryFilter = {};

  if (season) {
    const matchIds = await Match.find({ season }).distinct('id');
    if (!matchIds.length) {
      return res.status(200).json({
        status: 'success',
        data: { category, label: config.label, type: config.type, columns: config.columns, rows: [] }
      });
    }
    deliveryFilter.match_id = { $in: matchIds };
  }

  if (team) {
    if (config.type === 'batter') {
      deliveryFilter.batting_team = team;
    } else {
      deliveryFilter.bowling_team = team;
    }
  }

  let rows;
  const hasSeason = !!season;

  switch (config.mode) {
    case 'career':
      rows = config.type === 'batter'
        ? await careerBatting(deliveryFilter, config, limit, hasSeason)
        : await careerBowling(deliveryFilter, config, limit, hasSeason);
      break;
    case 'innings':
      rows = config.type === 'batter'
        ? await inningsBatting(deliveryFilter, config, limit)
        : await inningsBowling(deliveryFilter, config, limit);
      break;
    case 'maidens':
      rows = await maidensPipeline(deliveryFilter, limit);
      break;
    case 'hat_tricks':
      rows = await hatTricksPipeline(deliveryFilter, limit);
      break;
    default:
      return next(new AppError('Unknown leaderboard mode', 500));
  }

  res.status(200).json({
    status: 'success',
    data: {
      category,
      label: config.label,
      type: config.type,
      columns: config.columns,
      rows
    }
  });
});

exports.getCategories = catchAsync(async (req, res) => {
  const categories = Object.entries(CATEGORIES).map(([key, val]) => ({
    key,
    label: val.label,
    type: val.type
  }));

  res.status(200).json({
    status: 'success',
    data: categories
  });
});
