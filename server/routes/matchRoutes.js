const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const filterController = require('../controllers/filterController');
const { validatePagination, validateMatchId, validateSeason } = require('../middleware/validators');

router.get('/recent', validatePagination, matchController.getRecentMatches);
router.get('/filter', filterController.getFilteredMatches);
router.get('/filter/options', filterController.getFilterOptions);
router.get('/:id/scorecard', validateMatchId, matchController.getScorecard);
router.get('/:id/commentary', validateMatchId, matchController.getCommentary);

module.exports = router;
