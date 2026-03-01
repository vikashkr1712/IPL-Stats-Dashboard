const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Custom derived metrics — not raw stats
router.get('/batting-impact', analyticsController.getBattingImpactScore);
router.get('/bowling-pressure', analyticsController.getBowlingPressureIndex);
router.get('/death-rating', analyticsController.getDeathOverRating);
router.get('/player/:name', analyticsController.getPlayerAnalytics);

module.exports = router;
