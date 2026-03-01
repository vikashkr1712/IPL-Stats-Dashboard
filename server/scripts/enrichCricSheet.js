/**
 * IPL 2025 Playoff Data Enrichment — CricSheet Edition
 * 
 * Sources complete ball-by-ball data from CricSheet (cricsheet.org)
 * for all 4 IPL 2025 playoff matches, both innings.
 * 
 * Replaces any previously inserted partial data with complete,
 * authoritative CricSheet data including non_striker info.
 * 
 * CricSheet match IDs → Our DB match IDs:
 *   1473508 → 1500001 (Qualifier 1: PBKS vs RCB)
 *   1473509 → 1500002 (Eliminator: MI vs GT)
 *   1473510 → 1500003 (Qualifier 2: MI vs PBKS)
 *   1473511 → 1500004 (Final: RCB vs PBKS)
 * 
 * Usage: cd server && node scripts/enrichCricSheet.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AdmZip = require('adm-zip');
const Match = require('../models/Match');
const Delivery = require('../models/Delivery');

// ──────────────────────────────────────────────────────────
//  CONFIGURATION
// ──────────────────────────────────────────────────────────

const ZIP_PATH = path.join(__dirname, 'ipl_json.zip');

// CricSheet ID → Our DB match ID mapping
const MATCH_MAP = {
  '1473508': 1500001, // Qualifier 1
  '1473509': 1500002, // Eliminator
  '1473510': 1500003, // Qualifier 2
  '1473511': 1500004, // Final
};

// Team name mapping (CricSheet → our DB)
// CricSheet uses the same names as our DB for 2025 teams
const TEAM_MAP = {
  'Punjab Kings': 'Punjab Kings',
  'Royal Challengers Bengaluru': 'Royal Challengers Bengaluru',
  'Mumbai Indians': 'Mumbai Indians',
  'Gujarat Titans': 'Gujarat Titans',
};

// ──────────────────────────────────────────────────────────
//  PARSE CRICSHEET JSON → DELIVERY DOCUMENTS
// ──────────────────────────────────────────────────────────

function parseCricSheetMatch(matchData, ourMatchId) {
  const deliveries = [];
  const info = matchData.info;
  const teams = info.teams; // [team1, team2]

  matchData.innings.forEach((inn, innIdx) => {
    const battingTeam = TEAM_MAP[inn.team] || inn.team;
    const bowlingTeam = teams.filter(t => t !== inn.team).map(t => TEAM_MAP[t] || t)[0];
    const inningNum = innIdx + 1;

    inn.overs.forEach((ov) => {
      let ballNum = 0;

      ov.deliveries.forEach((del) => {
        ballNum++;

        // Determine extras type
        let extrasType = '';
        if (del.extras) {
          const extrasKeys = Object.keys(del.extras);
          if (extrasKeys.length > 0) {
            extrasType = extrasKeys[0]; // wides, noballs, legbyes, byes, penalty
          }
        }

        // Wicket info
        const hasWicket = del.wickets && del.wickets.length > 0;
        const wicket = hasWicket ? del.wickets[0] : null;
        let fielder = '';
        if (wicket && wicket.fielders && wicket.fielders.length > 0) {
          fielder = wicket.fielders.map(f => f.name).join(', ');
        }

        deliveries.push({
          match_id: ourMatchId,
          inning: inningNum,
          batting_team: battingTeam,
          bowling_team: bowlingTeam,
          over: ov.over,       // 0-indexed (matches our DB convention)
          ball: ballNum,       // sequential within over (1, 2, 3... including extras)
          batter: del.batter,
          bowler: del.bowler,
          non_striker: del.non_striker,
          batsman_runs: del.runs.batter,
          extra_runs: del.runs.extras,
          total_runs: del.runs.total,
          extras_type: extrasType,
          is_wicket: hasWicket ? 1 : 0,
          player_dismissed: wicket ? wicket.player_out : '',
          dismissal_kind: wicket ? wicket.kind : '',
          fielder: fielder,
        });
      });
    });
  });

  return deliveries;
}

// ──────────────────────────────────────────────────────────
//  VERIFICATION HELPER
// ──────────────────────────────────────────────────────────

function verifyInningsTotals(deliveries, matchLabel) {
  const innings = {};
  deliveries.forEach(d => {
    const key = `Inn ${d.inning}: ${d.batting_team}`;
    if (!innings[key]) innings[key] = { runs: 0, wickets: 0, balls: 0 };
    innings[key].runs += d.total_runs;
    innings[key].wickets += d.is_wicket;
    innings[key].balls++;
  });

  console.log(`  ${matchLabel}:`);
  Object.entries(innings).forEach(([key, val]) => {
    console.log(`    ${key} → ${val.runs}/${val.wickets} (${val.balls} balls)`);
  });
  return innings;
}

// ──────────────────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────────────────

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Read CricSheet ZIP
    console.log('Reading CricSheet data from:', ZIP_PATH);
    const zip = new AdmZip(ZIP_PATH);

    // Parse all 4 playoff matches
    let allDeliveries = [];
    const expected = {
      '1473508': { label: 'Qualifier 1 (PBKS vs RCB)', scores: ['101/10', '106/2'] },
      '1473509': { label: 'Eliminator (MI vs GT)', scores: ['228/5', '208/6'] },
      '1473510': { label: 'Qualifier 2 (MI vs PBKS)', scores: ['203/6', '207/5'] },
      '1473511': { label: 'Final (RCB vs PBKS)', scores: ['190/9', '184/7'] },
    };

    console.log('\nParsing matches:');
    for (const [csId, ourId] of Object.entries(MATCH_MAP)) {
      const entry = zip.getEntry(`${csId}.json`);
      if (!entry) {
        console.error(`  ✗ CricSheet file ${csId}.json not found in zip!`);
        continue;
      }
      const matchData = JSON.parse(entry.getData().toString());
      const deliveries = parseCricSheetMatch(matchData, ourId);
      allDeliveries.push(...deliveries);

      const totals = verifyInningsTotals(deliveries, `${expected[csId].label} → DB ID ${ourId}`);
      
      // Verify totals match expected
      const innKeys = Object.keys(totals);
      innKeys.forEach((key, i) => {
        const expectedScore = expected[csId].scores[i];
        const [expRuns, expWkts] = expectedScore.split('/').map(Number);
        const actual = totals[key];
        if (actual.runs !== expRuns || actual.wickets !== expWkts) {
          console.error(`    ⚠ MISMATCH: Expected ${expectedScore}, got ${actual.runs}/${actual.wickets}`);
        } else {
          console.log(`    ✓ Verified: ${expectedScore}`);
        }
      });
    }

    console.log(`\nTotal deliveries parsed: ${allDeliveries.length}`);

    // Delete existing deliveries for playoff matches
    const matchIds = Object.values(MATCH_MAP);
    const deleteResult = await Delivery.deleteMany({ match_id: { $in: matchIds } });
    console.log(`\nDeleted ${deleteResult.deletedCount} existing playoff deliveries`);

    // Insert all new deliveries
    const insertResult = await Delivery.insertMany(allDeliveries, { ordered: false });
    console.log(`Inserted ${insertResult.length} deliveries`);

    // Final verification from DB
    console.log('\n═══ Post-Insert DB Verification ═══');
    for (const [csId, ourId] of Object.entries(MATCH_MAP)) {
      const count = await Delivery.countDocuments({ match_id: ourId });
      const innCounts = await Delivery.aggregate([
        { $match: { match_id: ourId } },
        { $group: {
          _id: { inning: '$inning', battingTeam: '$batting_team' },
          runs: { $sum: '$total_runs' },
          wickets: { $sum: '$is_wicket' },
          balls: { $sum: 1 }
        }},
        { $sort: { '_id.inning': 1 } }
      ]);
      console.log(`${expected[csId].label} (${ourId}): ${count} deliveries`);
      innCounts.forEach(ic => {
        console.log(`  Inn ${ic._id.inning}: ${ic._id.battingTeam} ${ic.runs}/${ic.wickets} (${ic.balls} balls)`);
      });
    }

    console.log('\n✓ Enrichment complete!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
