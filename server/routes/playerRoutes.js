const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const { validateSearch, validateCompare, validateMatchup, validatePlayerName, validateSeason } = require('../middleware/validators');

router.get('/search', validateSearch, playerController.searchPlayers);
router.get('/compare', validateCompare, playerController.getPlayerCompare);
router.get('/top-batsmen', validateSeason, playerController.getTopBatsmen);
router.get('/top-bowlers', validateSeason, playerController.getTopBowlers);
router.get('/matchup', validateMatchup, playerController.getMatchup);
router.get('/images', playerController.getPlayerImages);
router.get('/cache-status', playerController.getCacheStatus);
router.get('/image/:name', playerController.getPlayerImage);
router.get('/:name/batting', validatePlayerName, playerController.getBattingStats);
router.get('/:name/bowling', validatePlayerName, playerController.getBowlingStats);
router.get('/:name/season-wise', validatePlayerName, playerController.getPlayerSeasonWise);
router.get('/:name/phase-stats', validatePlayerName, playerController.getPhaseStats);
router.get('/:name/teams', validatePlayerName, playerController.getPlayerTeams);

module.exports = router;
