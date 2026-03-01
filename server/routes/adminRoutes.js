const express = require('express');
const router = express.Router();
const { requireRole, listTokens, createToken, revokeToken } = require('../middleware/rbac');

// All admin routes require admin role
router.use(requireRole('admin'));

// Token management
router.get('/tokens', listTokens);
router.post('/tokens', createToken);
router.delete('/tokens', revokeToken);

// Cache management
router.post('/clear-cache', (req, res) => {
  // The apiCache is passed in via app.locals when mounting
  const cache = req.app.locals.apiCache;
  if (cache) {
    const size = cache.size;
    cache.clear();
    return res.json({ status: 'success', message: `Cleared ${size} cached entries` });
  }
  res.json({ status: 'success', message: 'No cache to clear' });
});

// Force data re-import trigger (placeholder — runs import in background)
router.post('/refresh-data', (req, res) => {
  // In production, this would trigger the importData script
  // For portfolio demo, we just acknowledge
  res.json({
    status: 'success',
    message: 'Data refresh triggered (background)',
    note: 'Run `npm run import` on the server to re-import CSV data'
  });
});

// Re-index MongoDB collections
router.post('/reindex', async (req, res) => {
  try {
    const Delivery = require('../models/Delivery');
    const Match = require('../models/Match');
    await Promise.all([
      Delivery.collection.reIndex(),
      Match.collection.reIndex()
    ]);
    res.json({ status: 'success', message: 'Collections re-indexed successfully' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
