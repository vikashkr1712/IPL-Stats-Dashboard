const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { validateTeamName } = require('../middleware/validators');

router.get('/', teamController.getAllTeams);
router.get('/wins-by-venue', teamController.getWinsByVenue);
router.get('/toss-impact', teamController.getTossImpact);
router.get('/:name', validateTeamName, teamController.getTeamStats);
router.get('/:name/season-wise', validateTeamName, teamController.getTeamSeasonWise);

module.exports = router;
