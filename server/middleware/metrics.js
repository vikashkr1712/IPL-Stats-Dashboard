/**
 * API Metrics Middleware — Tracks response times, request counts, cache hits
 * Exposes GET /api/metrics for monitoring and debugging.
 */
const metrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  endpoints: {},      // { path: { count, totalMs, errors } }
  statusCodes: {},     // { 200: count, 404: count, ... }
  recentRequests: []   // last 50 requests for live log
};

const MAX_RECENT = 50;

function metricsMiddleware(req, res, next) {
  if (req.path === '/api/metrics') return next(); // don't track self
  const start = process.hrtime.bigint();
  metrics.totalRequests++;

  // Capture response finish
  const originalEnd = res.end;
  res.end = function (...args) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const cacheHeader = res.getHeader('x-cache');
    const path = req.route?.path 
      ? `${req.method} ${req.baseUrl}${req.route.path}`
      : `${req.method} ${req.originalUrl?.split('?')[0] || req.path}`;

    // Track cache hits
    if (cacheHeader === 'HIT') metrics.cacheHits++;
    else if (cacheHeader === 'MISS') metrics.cacheMisses++;

    // Track status codes
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

    // Track per-endpoint
    if (!metrics.endpoints[path]) {
      metrics.endpoints[path] = { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    }
    const ep = metrics.endpoints[path];
    ep.count++;
    ep.totalMs += durationMs;
    if (durationMs > ep.maxMs) ep.maxMs = durationMs;
    if (status >= 400) { ep.errors++; metrics.totalErrors++; }

    // Recent requests log
    metrics.recentRequests.unshift({
      method: req.method,
      path: req.originalUrl,
      status,
      ms: Math.round(durationMs * 100) / 100,
      cache: cacheHeader || '-',
      time: new Date().toISOString()
    });
    if (metrics.recentRequests.length > MAX_RECENT) {
      metrics.recentRequests.length = MAX_RECENT;
    }

    originalEnd.apply(res, args);
  };

  next();
}

function getMetrics(req, res) {
  const uptime = Math.round((Date.now() - metrics.startedAt) / 1000);
  const totalCacheChecks = metrics.cacheHits + metrics.cacheMisses;
  const cacheHitRatio = totalCacheChecks > 0
    ? Math.round((metrics.cacheHits / totalCacheChecks) * 10000) / 100
    : 0;

  // Build sorted endpoints by count
  const endpointStats = Object.entries(metrics.endpoints)
    .map(([path, data]) => ({
      path,
      requests: data.count,
      avgMs: data.count > 0 ? Math.round((data.totalMs / data.count) * 100) / 100 : 0,
      maxMs: Math.round(data.maxMs * 100) / 100,
      errors: data.errors
    }))
    .sort((a, b) => b.requests - a.requests);

  // Overall avg response time
  const totalMs = Object.values(metrics.endpoints).reduce((s, e) => s + e.totalMs, 0);
  const avgResponseTime = metrics.totalRequests > 0
    ? Math.round((totalMs / metrics.totalRequests) * 100) / 100
    : 0;

  res.status(200).json({
    status: 'success',
    data: {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      avgResponseTime: `${avgResponseTime}ms`,
      cache: {
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRatio: `${cacheHitRatio}%`
      },
      statusCodes: metrics.statusCodes,
      endpoints: endpointStats,
      recentRequests: metrics.recentRequests.slice(0, 20)
    }
  });
}

module.exports = { metricsMiddleware, getMetrics };
