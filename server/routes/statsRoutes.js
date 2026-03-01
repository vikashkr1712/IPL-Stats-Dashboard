const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const leaderboardController = require('../controllers/leaderboardController');
const { validateSeason, validateHeadToHead, validateLeaderboard } = require('../middleware/validators');

router.get('/overview', validateSeason, statsController.getOverview);
router.get('/headtohead', validateHeadToHead, statsController.getHeadToHead);
router.get('/matches-won-by', validateSeason, statsController.getMatchesWonBy);
router.get('/team-wins', validateSeason, statsController.getTeamWins);
router.get('/seasons', statsController.getSeasons);
router.get('/venue-stats', validateSeason, statsController.getVenueStats);
router.get('/points-table', validateSeason, statsController.getPointsTable);
router.get('/playoffs', validateSeason, statsController.getPlayoffs);

// Leaderboard / Stats page
router.get('/leaderboard', validateLeaderboard, leaderboardController.getLeaderboard);
router.get('/leaderboard/categories', leaderboardController.getCategories);

module.exports = router;
