const Match = require('../models/Match');
const Delivery = require('../models/Delivery');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { normalize, getAllNames } = require('../utils/teamNormalize');

// GET /api/teams - List all teams (duplicates merged via normalization)
exports.getAllTeams = catchAsync(async (req, res) => {
  const teams = await Match.distinct('team1');
  const teams2 = await Match.distinct('team2');
  const raw = [...new Set([...teams, ...teams2])];
  const allTeams = [...new Set(raw.map(t => normalize(t)))].sort();
  
  res.status(200).json({
    status: 'success',
    count: allTeams.length,
    data: allTeams
  });
});

// GET /api/teams/:name - Get team stats (includes all historical aliases)
exports.getTeamStats = catchAsync(async (req, res, next) => {
  const teamName = req.params.name;
  const names = getAllNames(teamName);   // e.g. ['Delhi Capitals','Delhi Daredevils']
  
  const [stats] = await Match.aggregate([
    {
      $match: {
        $or: [{ team1: { $in: names } }, { team2: { $in: names } }]
      }
    },
    {
      $group: {
        _id: null,
        totalMatches: { $sum: 1 },
        wins: {
          $sum: { $cond: [{ $in: ['$winner', names] }, 1, 0] }
        },
        tossWins: {
          $sum: { $cond: [{ $in: ['$toss_winner', names] }, 1, 0] }
        },
        homeMatches: {
          $sum: { $cond: [{ $in: ['$team1', names] }, 1, 0] }
        },
        homeWins: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$team1', names] }, { $in: ['$winner', names] }] },
              1, 0
            ]
          }
        },
        awayMatches: {
          $sum: { $cond: [{ $in: ['$team2', names] }, 1, 0] }
        },
        awayWins: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$team2', names] }, { $in: ['$winner', names] }] },
              1, 0
            ]
          }
        },
        seasons: { $addToSet: '$season' }
      }
    },
    {
      $project: {
        _id: 0,
        totalMatches: 1,
        wins: 1,
        losses: { $subtract: ['$totalMatches', '$wins'] },
        winPercentage: {
          $round: [{ $multiply: [{ $divide: ['$wins', '$totalMatches'] }, 100] }, 2]
        },
        tossWins: 1,
        tossWinPercentage: {
          $round: [{ $multiply: [{ $divide: ['$tossWins', '$totalMatches'] }, 100] }, 2]
        },
        homeMatches: 1,
        homeWins: 1,
        homeWinPercentage: {
          $round: [
            { $cond: [{ $eq: ['$homeMatches', 0] }, 0, { $multiply: [{ $divide: ['$homeWins', '$homeMatches'] }, 100] }] },
            2
          ]
        },
        awayMatches: 1,
        awayWins: 1,
        awayWinPercentage: {
          $round: [
            { $cond: [{ $eq: ['$awayMatches', 0] }, 0, { $multiply: [{ $divide: ['$awayWins', '$awayMatches'] }, 100] }] },
            2
          ]
        },
        seasonsPlayed: { $size: '$seasons' },
        seasons: { $sortArray: { input: '$seasons', sortBy: 1 } }
      }
    }
  ]);

  if (!stats) {
    return next(new AppError(`Team '${teamName}' not found`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: { team: teamName, ...stats }
  });
});

// GET /api/teams/:name/season-wise - Season-wise breakdown (includes all aliases)
exports.getTeamSeasonWise = catchAsync(async (req, res, next) => {
  const teamName = req.params.name;
  const names = getAllNames(teamName);

  const seasonStats = await Match.aggregate([
    {
      $match: {
        $or: [{ team1: { $in: names } }, { team2: { $in: names } }]
      }
    },
    {
      $group: {
        _id: '$season',
        totalMatches: { $sum: 1 },
        wins: {
          $sum: { $cond: [{ $in: ['$winner', names] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        season: '$_id',
        totalMatches: 1,
        wins: 1,
        losses: { $subtract: ['$totalMatches', '$wins'] },
        winPercentage: {
          $round: [{ $multiply: [{ $divide: ['$wins', '$totalMatches'] }, 100] }, 2]
        }
      }
    },
    { $sort: { season: 1 } }
  ]);

  if (!seasonStats.length) {
    return next(new AppError(`Team '${teamName}' not found`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: { team: teamName, seasons: seasonStats }
  });
});

// GET /api/teams/wins-by-venue - Wins at each venue
exports.getWinsByVenue = catchAsync(async (req, res) => {
  const venueStats = await Match.aggregate([
    { $match: { winner: { $ne: '' } } },
    {
      $group: {
        _id: { venue: '$venue', winner: '$winner', result: '$result' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.venue',
        results: {
          $push: {
            winner: '$_id.winner',
            wonBy: '$_id.result',
            count: '$count'
          }
        },
        totalMatches: { $sum: '$count' }
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

// GET /api/teams/toss-impact - Toss decision impact
exports.getTossImpact = catchAsync(async (req, res) => {
  const tossStats = await Match.aggregate([
    { $match: { winner: { $ne: '' } } },
    {
      $group: {
        _id: '$toss_decision',
        totalMatches: { $sum: 1 },
        tossWinnerWon: {
          $sum: {
            $cond: [{ $eq: ['$toss_winner', '$winner'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        decision: '$_id',
        totalMatches: 1,
        tossWinnerWon: 1,
        tossWinnerLost: { $subtract: ['$totalMatches', '$tossWinnerWon'] },
        winPercentage: {
          $round: [{ $multiply: [{ $divide: ['$tossWinnerWon', '$totalMatches'] }, 100] }, 2]
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: tossStats
  });
});
