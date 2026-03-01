import axios from 'axios';

// In production (Vercel), VITE_API_URL points to the Render backend.
// In development, falls back to relative '/api' (proxied by Vite).
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// ─── In-memory API response cache (avoids refetching on page revisits) ──
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cachedGet(url, config = {}) {
  const key = url + JSON.stringify(config.params || {});
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < RESPONSE_CACHE_TTL) {
    return Promise.resolve(cached.data);
  }
  return api.get(url, config).then(data => {
    responseCache.set(key, { data, ts: Date.now() });
    return data;
  });
}

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// Stats APIs (cached — these are heavy aggregations)
export const fetchOverview = (season) =>
  cachedGet('/stats/overview', { params: season ? { season } : {} });

export const fetchSeasons = () => cachedGet('/stats/seasons');

export const fetchHeadToHead = (team1, team2) =>
  cachedGet('/stats/headtohead', { params: { team1, team2 } });

export const fetchMatchesWonBy = (season) =>
  cachedGet('/stats/matches-won-by', { params: season ? { season } : {} });

export const fetchTeamWins = (season) =>
  cachedGet('/stats/team-wins', { params: season ? { season } : {} });

export const fetchVenueStats = (season) =>
  cachedGet('/stats/venue-stats', { params: season ? { season } : {} });

export const fetchPointsTable = (season) =>
  cachedGet('/stats/points-table', { params: { season } });

export const fetchPlayoffs = (season) =>
  cachedGet('/stats/playoffs', { params: { season } });

// Team APIs (cached)
export const fetchAllTeams = () => cachedGet('/teams');

export const fetchTeamStats = (name) => cachedGet(`/teams/${encodeURIComponent(name)}`);

export const fetchTeamSeasonWise = (name) =>
  cachedGet(`/teams/${encodeURIComponent(name)}/season-wise`);

export const fetchTossImpact = () => cachedGet('/teams/toss-impact');

// Player APIs (search is NOT cached — needs to be real-time)
export const searchPlayers = (query) =>
  api.get('/players/search', { params: { q: query } });

export const fetchBattingStats = (name) =>
  cachedGet(`/players/${encodeURIComponent(name)}/batting`);

export const fetchBowlingStats = (name) =>
  cachedGet(`/players/${encodeURIComponent(name)}/bowling`);

export const fetchPlayerSeasonWise = (name) =>
  cachedGet(`/players/${encodeURIComponent(name)}/season-wise`);

export const fetchPhaseStats = (name) =>
  cachedGet(`/players/${encodeURIComponent(name)}/phase-stats`);

export const fetchPlayerTeams = (name) =>
  cachedGet(`/players/${encodeURIComponent(name)}/teams`);

export const fetchMatchup = (batter, bowler, season) =>
  cachedGet('/players/matchup', { params: { batter, bowler, ...(season ? { season } : {}) } });

// Comprehensive player comparison — single call for all data
export const fetchPlayerCompare = (p1, p2, season) =>
  cachedGet('/players/compare', { params: { p1, p2, ...(season ? { season } : {}) } });

export const fetchPlayerImage = (name) =>
  api.get(`/players/image/${encodeURIComponent(name)}`);

export const fetchPlayerImages = (names) =>
  api.get('/players/images', { params: { names: names.join(',') } });

// ─── Client-side localStorage image cache (Tier 0: browser, instant) ──
const IMG_CACHE_KEY = 'ipl_player_images';
const IMG_CACHE_VERSION_KEY = 'ipl_player_images_v';
const IMG_CACHE_VERSION = 4; // Bump to invalidate old cache (v4 = 3-tier server caching)
const IMG_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (server caches permanently now)

// Auto-clear cache when version changes
try {
  const v = localStorage.getItem(IMG_CACHE_VERSION_KEY);
  if (v !== String(IMG_CACHE_VERSION)) {
    localStorage.removeItem(IMG_CACHE_KEY);
    localStorage.setItem(IMG_CACHE_VERSION_KEY, String(IMG_CACHE_VERSION));
  }
} catch {}

function getImageCache() {
  try {
    const raw = localStorage.getItem(IMG_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Prune expired entries
    const now = Date.now();
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v.ts && now - v.ts < IMG_CACHE_TTL) clean[k] = v;
    }
    return clean;
  } catch { return {}; }
}

function setImageCache(cache) {
  try { localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Fetch player images with localStorage caching.
 * Returns cached images immediately, fetches uncached ones from the server,
 * and calls onPartial(map) with each batch as it arrives.
 */
export async function fetchPlayerImagesWithCache(names, onPartial) {
  const cache = getImageCache();
  const cached = {};
  const uncached = [];

  for (const name of names) {
    if (cache[name]?.url) {
      cached[name] = cache[name].url;
    } else {
      uncached.push(name);
    }
  }

  // Return cached results immediately
  if (Object.keys(cached).length > 0 && onPartial) {
    onPartial(cached);
  }

  // Fetch uncached names in small batches of 5 for faster progressive loading
  if (uncached.length > 0) {
    const BATCH = 5;
    for (let i = 0; i < uncached.length; i += BATCH) {
      const batch = uncached.slice(i, i + BATCH);
      try {
        const res = await api.get('/players/images', { params: { names: batch.join(',') } });
        if (res.data) {
          const updatedCache = getImageCache();
          for (const [name, url] of Object.entries(res.data)) {
            updatedCache[name] = { url, ts: Date.now() };
          }
          setImageCache(updatedCache);
          if (onPartial) onPartial(res.data);
        }
      } catch {}
    }
  }
}

export const fetchTopBatsmen = (season, limit = 10) =>
  cachedGet('/players/top-batsmen', { params: { ...(season ? { season } : {}), limit } });

export const fetchTopBowlers = (season, limit = 10) =>
  cachedGet('/players/top-bowlers', { params: { ...(season ? { season } : {}), limit } });

// Leaderboard / Stats APIs (cached — heavy aggregations)
export const fetchLeaderboard = (category, season, team, limit = 50) =>
  cachedGet('/stats/leaderboard', { params: { category, season, team, limit } });

export const fetchLeaderboardCategories = () =>
  cachedGet('/stats/leaderboard/categories');

// Match / Scorecard APIs (cached)
export const fetchRecentMatches = (page = 1, limit = 12, season = '', team = '') =>
  cachedGet('/matches/recent', { params: { page, limit, season, team } });

export const fetchScorecard = (matchId) =>
  cachedGet(`/matches/${matchId}/scorecard`);

export const fetchCommentary = (matchId, inning = 1) =>
  cachedGet(`/matches/${matchId}/commentary`, { params: { inning } });

// Analytics APIs — custom derived metrics
export const fetchBattingImpact = (season, limit = 20) =>
  cachedGet('/analytics/batting-impact', { params: { ...(season ? { season } : {}), limit } });

export const fetchBowlingPressure = (season, limit = 20) =>
  cachedGet('/analytics/bowling-pressure', { params: { ...(season ? { season } : {}), limit } });

export const fetchDeathRating = (season, type = 'batting', limit = 20) =>
  cachedGet('/analytics/death-rating', { params: { ...(season ? { season } : {}), type, limit } });

export const fetchPlayerAnalytics = (name) =>
  cachedGet(`/analytics/player/${encodeURIComponent(name)}`);

// Advanced filter API
export const fetchFilteredMatches = (params) =>
  cachedGet('/matches/filter', { params });

export const fetchFilterOptions = () =>
  cachedGet('/matches/filter/options');

export default api;
