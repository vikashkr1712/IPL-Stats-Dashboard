const crypto = require('crypto');
const { AppError } = require('./errorHandler');
const uuidv4 = () => crypto.randomUUID();

/**
 * Role-Based Access Control (RBAC)
 * 
 * Roles:
 *   - viewer: Default. Read-only access to all API endpoints.
 *   - admin:  Full access. Can refresh data, clear cache, trigger re-index, view metrics.
 *
 * Auth: Token-based via x-api-key header or ?apiKey= query param
 * In a production app this would be JWT + database-stored roles. For a portfolio
 * project we use a simple in-memory token registry with seeded admin key.
 */

// In-memory token store: { token: { role, label, createdAt } }
const tokens = new Map();

// Seed admin token from env or generate one at startup
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || uuidv4();
tokens.set(ADMIN_TOKEN, { role: 'admin', label: 'Primary Admin', createdAt: Date.now() });

// Seed a default viewer token
const VIEWER_TOKEN = process.env.VIEWER_TOKEN || 'viewer-public';
tokens.set(VIEWER_TOKEN, { role: 'viewer', label: 'Public Viewer', createdAt: Date.now() });

console.log(`🔑 Admin token: ${ADMIN_TOKEN}`);

/**
 * Extract token from request
 */
function extractToken(req) {
  return req.headers['x-api-key'] || req.query.apiKey || null;
}

/**
 * Middleware: authenticate — attaches req.user = { role, label }
 * If no token is provided, defaults to 'viewer' role (public API).
 */
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (token && tokens.has(token)) {
    req.user = { ...tokens.get(token), token };
  } else {
    req.user = { role: 'viewer', label: 'Anonymous' };
  }
  next();
}

/**
 * Middleware factory: requireRole(...roles)
 * Returns 403 if the user's role is not in the allowed list.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
}

/**
 * Admin controller: list tokens (admin only)
 */
function listTokens(req, res) {
  const list = [];
  tokens.forEach((val, key) => {
    list.push({ token: key.substring(0, 8) + '...', role: val.role, label: val.label, createdAt: new Date(val.createdAt).toISOString() });
  });
  res.json({ status: 'success', data: list });
}

/**
 * Admin controller: create token
 */
function createToken(req, res) {
  const { role = 'viewer', label = 'API User' } = req.body || {};
  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ status: 'fail', message: 'Role must be admin or viewer' });
  }
  const token = uuidv4();
  tokens.set(token, { role, label, createdAt: Date.now() });
  res.status(201).json({ status: 'success', data: { token, role, label } });
}

/**
 * Admin controller: revoke token
 */
function revokeToken(req, res) {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ status: 'fail', message: 'token is required' });
  if (token === ADMIN_TOKEN) return res.status(400).json({ status: 'fail', message: 'Cannot revoke primary admin token' });
  tokens.delete(token);
  res.json({ status: 'success', message: 'Token revoked' });
}

module.exports = {
  authenticate,
  requireRole,
  listTokens,
  createToken,
  revokeToken,
  ADMIN_TOKEN,
  tokens
};
