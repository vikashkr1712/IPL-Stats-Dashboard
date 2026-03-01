// Team abbreviations, colors, and logo URLs for IPL teams
// Using official IPL CDN for reliable logo delivery
const IPL_CDN = (abbr) => `https://scores.iplt20.com/ipl/teamlogos/${abbr}.png`;
const IPL_DOC = (abbr) => `https://documents.iplt20.com/ipl/${abbr}/Logos/Roundbig/${abbr}roundbig.png`;

/*
 * TEAM_ALIASES: maps old / renamed franchise names → current canonical name.
 * Used on the frontend so that getTeamInfo() returns the same logo for
 * "Delhi Daredevils" and "Delhi Capitals", etc.
 */
export const TEAM_ALIASES = {
  'Delhi Daredevils':              'Delhi Capitals',
  'Royal Challengers Bangalore':   'Royal Challengers Bengaluru',
  'Kings XI Punjab':               'Punjab Kings',
  'Rising Pune Supergiant':        'Rising Pune Supergiants',
};

export const TEAM_INFO = {
  // ─── Active franchises ────────────────────────────────────────────
  'Mumbai Indians':                { abbr: 'MI',   color: '#004BA0', logo: IPL_CDN('MI') },
  'Chennai Super Kings':           { abbr: 'CSK',  color: '#f9a825', logo: IPL_CDN('CSK') },
  'Royal Challengers Bengaluru':   { abbr: 'RCB',  color: '#d32f2f', logo: IPL_CDN('RCB') },
  'Kolkata Knight Riders':         { abbr: 'KKR',  color: '#7b1fa2', logo: IPL_CDN('KKR') },
  'Rajasthan Royals':              { abbr: 'RR',   color: '#e91e97', logo: IPL_CDN('RR') },
  'Delhi Capitals':                { abbr: 'DC',   color: '#1976d2', logo: IPL_CDN('DC') },
  'Sunrisers Hyderabad':           { abbr: 'SRH',  color: '#ff6f00', logo: IPL_CDN('SRH') },
  'Punjab Kings':                  { abbr: 'PBKS', color: '#e53935', logo: IPL_CDN('PBKS') },
  'Gujarat Titans':                { abbr: 'GT',   color: '#1a237e', logo: IPL_CDN('GT') },
  'Lucknow Super Giants':          { abbr: 'LSG',  color: '#00838f', logo: IPL_CDN('LSG') },

  // ─── Defunct / historical franchises ──────────────────────────────
  'Rising Pune Supergiants':       { abbr: 'RPS',  color: '#6a1b9a', logo: IPL_CDN('RPS') },
  'Gujarat Lions':                 { abbr: 'GL',   color: '#e65100', logo: IPL_CDN('GL') },
  'Deccan Chargers':               { abbr: 'DCH',  color: '#546e7a', logo: '/deccan_chargers_logo.jpeg' },
  'Kochi Tuskers Kerala':          { abbr: 'KTK',  color: '#6d4c41', logo: IPL_CDN('KTK') },
  'Pune Warriors':                 { abbr: 'PWI',  color: '#0277bd', logo: IPL_DOC('PWI') },
};

export function getTeamInfo(teamName) {
  // Resolve alias first, then look up canonical entry
  const canonical = TEAM_ALIASES[teamName] || teamName;
  return TEAM_INFO[canonical] || TEAM_INFO[teamName] || { abbr: teamName?.substring(0, 3)?.toUpperCase() || '?', color: '#888', logo: null };
}

/**
 * Normalize a team name to its canonical form (frontend mirror of backend util).
 */
export function normalizeTeamName(name) {
  return TEAM_ALIASES[name] || name;
}
