const { query, param, validationResult } = require('express-validator');

/**
 * Centralised validation error handler — returns 400 with clear field errors
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation error',
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: e.value
      }))
    });
  }
  next();
};

// ─── Reusable validation chains ───────────────────────────────────

const validateSeason = [
  query('season')
    .optional({ values: 'falsy' })
    .matches(/^(19|20)\d{2}(\/\d{2})?$/)
    .withMessage('Season must be a year like 2023 or 2023/24'),
  handleValidation
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  handleValidation
];

const validatePlayerName = [
  param('name')
    .trim()
    .notEmpty().withMessage('Player name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Player name must be 2-60 characters'),
  handleValidation
];

const validateTeamName = [
  param('name')
    .trim()
    .notEmpty().withMessage('Team name is required'),
  handleValidation
];

const validateSearch = [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 1, max: 50 }).withMessage('Query must be 1-50 characters'),
  handleValidation
];

const validateHeadToHead = [
  query('team1').trim().notEmpty().withMessage('team1 is required'),
  query('team2').trim().notEmpty().withMessage('team2 is required'),
  handleValidation
];

const validateCompare = [
  query('p1').trim().notEmpty().withMessage('p1 (player 1) is required'),
  query('p2').trim().notEmpty().withMessage('p2 (player 2) is required'),
  query('season')
    .optional()
    .matches(/^(19|20)\d{2}(\/\d{2})?$/)
    .withMessage('Season must be a year like 2023'),
  handleValidation
];

const validateMatchup = [
  query('batter').trim().notEmpty().withMessage('batter is required'),
  query('bowler').trim().notEmpty().withMessage('bowler is required'),
  query('season').optional().matches(/^(19|20)\d{2}(\/\d{2})?$/).withMessage('Invalid season'),
  handleValidation
];

const validateMatchId = [
  param('id').isInt({ min: 1 }).withMessage('Match ID must be a positive integer'),
  handleValidation
];

const validateLeaderboard = [
  query('category').optional().isString().withMessage('category must be a string'),
  query('season').optional().matches(/^(19|20)\d{2}(\/\d{2})?$/).withMessage('Invalid season'),
  query('team').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1-200'),
  handleValidation
];

const validateAnalytics = [
  query('season').optional().matches(/^(19|20)\d{2}(\/\d{2})?$/).withMessage('Invalid season'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query('type').optional().isIn(['batting', 'bowling']).withMessage('type must be batting or bowling'),
  handleValidation
];

module.exports = {
  handleValidation,
  validateSeason,
  validatePagination,
  validatePlayerName,
  validateTeamName,
  validateSearch,
  validateHeadToHead,
  validateCompare,
  validateMatchup,
  validateMatchId,
  validateLeaderboard,
  validateAnalytics
};
