const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const { metricsMiddleware, getMetrics } = require('./middleware/metrics');
const { authenticate, requireRole } = require('./middleware/rbac');

// Import routes
const teamRoutes = require('./routes/teamRoutes');
const playerRoutes = require('./routes/playerRoutes');
const statsRoutes = require('./routes/statsRoutes');
const matchRoutes = require('./routes/matchRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// ─── Logging (Morgan) ───────────────────────────────────────────────
// Custom token for response time color
morgan.token('colored-status', (req, res) => {
  const s = res.statusCode;
  return s >= 500 ? `\x1b[31m${s}\x1b[0m` : s >= 400 ? `\x1b[33m${s}\x1b[0m` : `\x1b[32m${s}\x1b[0m`;
});
morgan.token('cache', (req, res) => res.getHeader('x-cache') || '-');

app.use(morgan(':method :url :colored-status :response-time ms cache=:cache', {
  skip: (req) => req.url === '/api/health' // don't log health checks
}));

// ─── Core Middleware ─────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, Postman, health checks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true
}));
app.use(compression()); // Gzip all responses (~70% smaller payloads)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Metrics tracking (before routes, after basic middleware) ────────
app.use(metricsMiddleware);

// ─── Authentication (attaches req.user for all routes) ──────────────
app.use(authenticate);

// ─── In-memory API response cache ───────────────────────────────────
const apiCache = new Map();
app.locals.apiCache = apiCache; // expose to admin routes
const API_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheMiddleware(ttl = API_CACHE_TTL) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.ts < ttl) {
      res.set('X-Cache', 'HIT');
      res.set('Content-Type', 'application/json');
      return res.send(cached.body);
    }

    // Intercept res.json to cache ONLY successful responses
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      const body = JSON.stringify(data);
      // Only cache 2xx responses — never cache errors
      if (res.statusCode >= 200 && res.statusCode < 300) {
        apiCache.set(key, { body, ts: Date.now() });
      }
      res.set('X-Cache', 'MISS');
      res.set('Content-Type', 'application/json');
      return res.send(body);
    };
    next();
  };
}

// Apply caching to heavy endpoints
app.use('/api/stats', cacheMiddleware(10 * 60 * 1000));
app.use('/api/matches', cacheMiddleware(10 * 60 * 1000));
app.use('/api/teams', cacheMiddleware(10 * 60 * 1000));
app.use('/api/players/top-batsmen', cacheMiddleware(10 * 60 * 1000));
app.use('/api/players/top-bowlers', cacheMiddleware(10 * 60 * 1000));
app.use('/api/analytics', cacheMiddleware(10 * 60 * 1000));

// ─── API Routes ─────────────────────────────────────────────────────
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// ─── Monitoring endpoint ────────────────────────────────────────────
app.get('/api/metrics', requireRole('admin'), getMetrics);

// ─── Health check ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'IPL Dashboard API is running', uptime: process.uptime() });
});

// ─── API Documentation ──────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'success',
    name: 'IPL Dashboard REST API',
    version: '3.0',
    description: 'Cricket analytics API covering 2008–2025 IPL seasons with custom metrics, RBAC, and real-time support',
    features: [
      'Custom Analytics Engine (BIS, BPI, DOR)',
      'Advanced Multi-Filter Query Builder',
      'express-validator input validation',
      'Role-Based Access Control (admin/viewer)',
      'Morgan HTTP logging + /api/metrics monitoring',
      'WebSocket real-time notifications',
      'In-memory API caching with cache-hit tracking'
    ],
    endpoints: {
      stats: {
        'GET /api/stats/overview':          { params: '?season=', description: 'Dashboard overview stats' },
        'GET /api/stats/seasons':            { description: 'List all IPL seasons' },
        'GET /api/stats/headtohead':         { params: '?team1=&team2=', description: 'Head-to-head team comparison' },
        'GET /api/stats/matches-won-by':     { params: '?season=', description: 'Wins grouped by result type' },
        'GET /api/stats/team-wins':          { params: '?season=', description: 'Total wins per team' },
        'GET /api/stats/venue-stats':        { params: '?season=', description: 'Venue-wise match stats (top 15)' },
        'GET /api/stats/leaderboard':        { params: '?category=&season=&team=&limit=50', description: 'Leaderboard' },
        'GET /api/stats/leaderboard/categories': { description: 'Available leaderboard categories' }
      },
      players: {
        'GET /api/players/search':           { params: '?q=', description: 'Smart player search with ranking' },
        'GET /api/players/compare':          { params: '?p1=&p2=&season=', description: 'Full comparison' },
        'GET /api/players/top-batsmen':      { params: '?season=&limit=10', description: 'Top run scorers' },
        'GET /api/players/top-bowlers':      { params: '?season=&limit=10', description: 'Top wicket takers' },
        'GET /api/players/matchup':          { params: '?batter=&bowler=&season=', description: 'Batter vs bowler matchup' },
        'GET /api/players/:name/batting':    { params: '?season=', description: 'Player batting stats' },
        'GET /api/players/:name/bowling':    { params: '?season=', description: 'Player bowling stats' },
        'GET /api/players/:name/season-wise': { description: 'Season-wise batting breakdown' },
        'GET /api/players/:name/phase-stats': { description: 'Phase-wise batting & bowling (PP/Middle/Death)' },
        'GET /api/players/image/:name':      { description: '3-tier cached player photo' },
        'GET /api/players/images':           { params: '?names=a,b,c', description: 'Batch player images' }
      },
      analytics: {
        'GET /api/analytics/batting-impact':  { params: '?season=&limit=20', description: 'Batting Impact Score — custom derived metric' },
        'GET /api/analytics/bowling-pressure': { params: '?season=&limit=20', description: 'Bowling Pressure Index — custom derived metric' },
        'GET /api/analytics/death-rating':    { params: '?season=&type=batting|bowling&limit=20', description: 'Death Over Rating' },
        'GET /api/analytics/player/:name':    { description: 'All 3 custom metrics for a single player' }
      },
      matches: {
        'GET /api/matches/recent':           { params: '?page=1&limit=12&season=&team=', description: 'Paginated recent matches' },
        'GET /api/matches/filter':           { params: '?seasonFrom=&seasonTo=&venue=&tossWinner=&tossDecision=&batFirst=&winner=&result=&superOver=&team=&sort=&page=&limit=', description: 'Advanced multi-filter search' },
        'GET /api/matches/filter/options':   { description: 'Available filter values (seasons, venues, teams)' },
        'GET /api/matches/:id/scorecard':    { description: 'Full match scorecard' },
        'GET /api/matches/:id/commentary':   { params: '?inning=1', description: 'Ball-by-ball commentary' }
      },
      teams: {
        'GET /api/teams':                    { description: 'All IPL teams' },
        'GET /api/teams/:name':              { description: 'Team career stats' },
        'GET /api/teams/:name/season-wise':  { description: 'Team season-wise breakdown' },
        'GET /api/teams/wins-by-venue':      { description: 'Venue-wise wins' },
        'GET /api/teams/toss-impact':        { description: 'Toss decision win impact' }
      },
      admin: {
        'GET /api/metrics':                  { auth: 'admin', description: 'API metrics — response times, cache hit ratio, request counts' },
        'GET /api/admin/tokens':             { auth: 'admin', description: 'List API tokens' },
        'POST /api/admin/tokens':            { auth: 'admin', body: '{ role, label }', description: 'Create API token' },
        'DELETE /api/admin/tokens':          { auth: 'admin', body: '{ token }', description: 'Revoke token' },
        'POST /api/admin/clear-cache':       { auth: 'admin', description: 'Clear server API cache' },
        'POST /api/admin/refresh-data':      { auth: 'admin', description: 'Trigger data re-import' },
        'POST /api/admin/reindex':           { auth: 'admin', description: 'Re-index MongoDB collections' }
      }
    },
    auth: {
      method: 'Token via x-api-key header or ?apiKey= query param',
      roles: { admin: 'Full access — metrics, cache control, token management', viewer: 'Read-only access to all data endpoints' },
      note: 'All data endpoints are publicly readable. Admin token printed at server startup.'
    }
  });
});

// ─── Production: serve React build ─────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res, next) => {
    // Only serve index.html for non-API routes
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Handle undefined routes
app.all('/{path}', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

// ─── Start server with WebSocket support ────────────────────────────
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ─── WebSocket (Real-Time Architecture) ─────────────────────────────
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server, path: '/ws' });

const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', message: 'IPL Dashboard WebSocket connected', timestamp: new Date().toISOString() }));

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));

  // Handle client messages (subscribe to events)
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (msg.type === 'subscribe') ws.subscribedTo = msg.channel;
    } catch {}
  });
});

// Broadcast helper — used by admin endpoints or scheduled tasks
app.locals.broadcast = (event) => {
  const data = JSON.stringify(event);
  wsClients.forEach(ws => {
    if (ws.readyState === 1) ws.send(data); // 1 = OPEN
  });
};

// Periodic heartbeat to keep connections alive
setInterval(() => {
  const event = { type: 'heartbeat', clients: wsClients.size, timestamp: new Date().toISOString() };
  wsClients.forEach(ws => {
    if (ws.readyState === 1) ws.send(JSON.stringify(event));
    else wsClients.delete(ws);
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket at ws://localhost:${PORT}/ws`);
});

module.exports = app;
