/**
 * Team name normalization utility.
 * Maps historical / renamed team names to their current canonical name.
 * This ensures "Delhi Daredevils" + "Delhi Capitals" are treated as one franchise, etc.
 */

const TEAM_ALIASES = {
  'Delhi Daredevils':              'Delhi Capitals',
  'Royal Challengers Bangalore':   'Royal Challengers Bengaluru',
  'Kings XI Punjab':               'Punjab Kings',
  'Rising Pune Supergiant':        'Rising Pune Supergiants',
};

// Build reverse map: canonical → Set of all names (including itself)
const TEAM_GROUPS = {};
Object.entries(TEAM_ALIASES).forEach(([alias, canonical]) => {
  if (!TEAM_GROUPS[canonical]) TEAM_GROUPS[canonical] = new Set([canonical]);
  TEAM_GROUPS[canonical].add(alias);
});

/**
 * Normalize a team name to its canonical form.
 * @param {string} name - raw team name from DB
 * @returns {string} canonical name
 */
function normalize(name) {
  return TEAM_ALIASES[name] || name;
}

/**
 * Given a canonical (or any) team name, return an array of ALL names
 * that belong to the same franchise (for use with MongoDB $in queries).
 * @param {string} name - any team name
 * @returns {string[]} all variant names for that franchise
 */
function getAllNames(name) {
  const canonical = normalize(name);
  return TEAM_GROUPS[canonical] ? [...TEAM_GROUPS[canonical]] : [canonical];
}

module.exports = { normalize, getAllNames, TEAM_ALIASES };
