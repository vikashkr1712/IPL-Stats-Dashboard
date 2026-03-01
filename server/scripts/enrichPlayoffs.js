/**
 * IPL 2025 Playoff Data Enrichment Script
 * Source: iplt20.com match pages (1869-1872)
 * 
 * This script:
 * 1. Updates 4 playoff match records with correct results, MoM, toss data
 * 2. Inserts ball-by-ball delivery data for the 2nd innings of:
 *    - Qualifier 1 (RCB chase: 106/2 in 10 overs)
 *    - Eliminator  (GT chase: 208/6 in 20 overs)
 *    - Final       (PBKS chase: 184/7 in 20 overs)
 * 
 * Usage: cd server && node scripts/enrichPlayoffs.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Match = require('../models/Match');
const Delivery = require('../models/Delivery');

// ══════════════════════════════════════════════════════════════════════
//  STEP 1 — Correct Match Records
// ══════════════════════════════════════════════════════════════════════

const matchUpdates = [
  {
    id: 1500001,
    update: {
      match_type: 'Qualifier 1',
      city: 'Chandigarh',
      venue: 'New PCA Stadium, Chandigarh',
      date: new Date('2025-05-29'),
      team1: 'Punjab Kings',
      team2: 'Royal Challengers Bengaluru',
      toss_winner: 'Royal Challengers Bengaluru',
      toss_decision: 'field',
      winner: 'Royal Challengers Bengaluru',
      result: 'wickets',
      result_margin: 8,
      target_runs: 102,
      target_overs: 0,
      player_of_match: 'Suyash Sharma',
      super_over: 'N',
      method: ''
    }
  },
  {
    id: 1500002,
    match_type: 'Eliminator',
    update: {
      match_type: 'Eliminator',
      city: 'Chandigarh',
      venue: 'New PCA Stadium, Chandigarh',
      date: new Date('2025-05-30'),
      team1: 'Mumbai Indians',
      team2: 'Gujarat Titans',
      toss_winner: 'Mumbai Indians',
      toss_decision: 'bat',
      winner: 'Mumbai Indians',
      result: 'runs',
      result_margin: 20,
      target_runs: 229,
      target_overs: 0,
      player_of_match: 'Rohit Sharma',
      super_over: 'N',
      method: ''
    }
  },
  {
    id: 1500003,
    update: {
      match_type: 'Qualifier 2',
      city: 'Ahmedabad',
      venue: 'Narendra Modi Stadium, Ahmedabad',
      date: new Date('2025-06-01'),
      team1: 'Punjab Kings',
      team2: 'Mumbai Indians',
      toss_winner: 'Mumbai Indians',
      toss_decision: 'bat',
      winner: 'Punjab Kings',
      result: 'wickets',
      result_margin: 5,
      target_runs: 204,
      target_overs: 0,
      player_of_match: 'Shreyas Iyer',
      super_over: 'N',
      method: ''
    }
  },
  {
    id: 1500004,
    update: {
      match_type: 'Final',
      city: 'Ahmedabad',
      venue: 'Narendra Modi Stadium, Ahmedabad',
      date: new Date('2025-06-03'),
      team1: 'Royal Challengers Bengaluru',
      team2: 'Punjab Kings',
      toss_winner: 'Punjab Kings',
      toss_decision: 'field',
      winner: 'Royal Challengers Bengaluru',
      result: 'runs',
      result_margin: 6,
      target_runs: 191,
      target_overs: 0,
      player_of_match: 'Krunal Pandya',
      super_over: 'N',
      method: ''
    }
  }
];

// ══════════════════════════════════════════════════════════════════════
//  STEP 2 — Ball-by-Ball Delivery Data (compact format)
// ══════════════════════════════════════════════════════════════════════
//
// Format: "over.ball|batter|bowler|batsmanRuns|extraInfo|wicketInfo"
//  extraInfo  → "" normal | "4lb" leg-bye 4 | "1w" wide 1 | "1nb" no-ball
//  wicketInfo → "" none | "W:caught:fielder" | "W:lbw" | "W:bowled" | "W:hitwicket"
//
// Player abbreviations are expanded by a lookup table per innings.

function parseDeliveries(lines, matchId, inning, battingTeam, bowlingTeam, playerMap) {
  const deliveries = [];
  for (const line of lines) {
    const parts = line.split('|');
    const [overBall, batterKey, bowlerKey] = parts;
    const batsmanRuns = parseInt(parts[3]) || 0;
    const extraInfo = parts[4] || '';
    const wicketInfo = parts[5] || '';

    const dotParts = overBall.split('.');
    const over = parseInt(dotParts[0]);
    const ball = parseInt(dotParts[1]);

    const batter = playerMap[batterKey] || batterKey;
    const bowler = playerMap[bowlerKey] || bowlerKey;

    let extraRuns = 0;
    let extrasType = '';
    if (extraInfo) {
      const m = extraInfo.match(/^(\d+)(lb|w|nb|b)$/);
      if (m) {
        extraRuns = parseInt(m[1]);
        const typeMap = { lb: 'legbyes', w: 'wides', nb: 'noballs', b: 'byes' };
        extrasType = typeMap[m[2]] || '';
      }
    }

    let isWicket = 0, playerDismissed = '', dismissalKind = '', fielder = '';
    if (wicketInfo.startsWith('W:')) {
      isWicket = 1;
      const wParts = wicketInfo.split(':');
      dismissalKind = wParts[1] || '';
      fielder = wParts[2] || '';
      // The dismissed player is the batter (typically)
      playerDismissed = batter;
    }

    const totalRuns = batsmanRuns + extraRuns;

    deliveries.push({
      match_id: matchId,
      inning,
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      over,
      ball,
      batter,
      bowler,
      non_striker: '',
      batsman_runs: batsmanRuns,
      extra_runs: extraRuns,
      total_runs: totalRuns,
      extras_type: extrasType,
      is_wicket: isWicket,
      player_dismissed: playerDismissed,
      dismissal_kind: dismissalKind,
      fielder
    });
  }
  return deliveries;
}

// ──────────────────────────────────────────────────────────────────────
//  QUALIFIER 1 — 2nd Innings: RCB chases 102 → 106/2 (10 overs)
//  Match 1500001 | Batting: RCB | Bowling: PBKS
// ──────────────────────────────────────────────────────────────────────
const Q1_PLAYERS = {
  PS: 'Phil Salt', VK: 'Virat Kohli', MA: 'Mayank Agarwal', RP: 'Rajat Patidar',
  AS: 'Arshdeep Singh', KJ: 'Kyle Jamieson', AO: 'Azmatullah Omarzai',
  HB: 'Harpreet Brar', MK: 'Musheer Khan'
};

const Q1_INN2 = `
0.1|PS|AS|1
0.2|VK|AS|4
0.3|VK|AS|0|4lb
0.4|VK|AS|0
0.5|VK|AS|1
0.6|PS|AS|1
1.1|PS|KJ|0
1.2|PS|KJ|1
1.3|VK|KJ|4
1.4|VK|KJ|0
1.5|VK|KJ|0
1.6|VK|KJ|1
2.1|VK|AS|1
2.2|PS|AS|1
2.3|VK|AS|1
2.4|PS|AS|4
2.5|PS|AS|0
2.6|PS|AS|6
3.1|VK|KJ|0
3.2|VK|KJ|0||W:caught:Josh Inglis
3.3|MA|KJ|0
3.4|MA|KJ|0
3.5|MA|KJ|0
3.6|MA|KJ|0
4.1|PS|AO|0
4.2|PS|AO|0
4.3|PS|AO|4
4.4|PS|AO|0
4.5|PS|AO|2
4.6|PS|AO|4
5.1|MA|KJ|4
5.2|MA|KJ|1
5.3|PS|KJ|2
5.4|PS|KJ|4
5.5|PS|KJ|4
5.6|PS|KJ|6
6.1|MA|HB|1
6.2|PS|HB|6
6.3|PS|HB|1
6.4|MA|HB|1
6.5|PS|HB|1
6.6|MA|HB|1
7.1|MA|MK|1
7.2|PS|MK|1
7.3|MA|MK|6
7.4|MA|MK|4
7.5|MA|MK|0||W:caught:Shreyas Iyer
7.6|RP|MK|1
8.1|RP|HB|1
8.2|PS|HB|1
8.3|RP|HB|0
8.4|RP|HB|1
8.5|PS|HB|4
8.6|PS|HB|0
9.1|RP|MK|1
9.2|PS|MK|1
9.3|RP|MK|4
9.4|RP|MK|1
9.5|PS|MK|1
9.6|RP|MK|6
`.trim().split('\n');

// ──────────────────────────────────────────────────────────────────────
//  ELIMINATOR — 2nd Innings: GT chases 229 → 208/6 (20 overs)
//  Match 1500002 | Batting: GT | Bowling: MI
// ──────────────────────────────────────────────────────────────────────
const ELIM_PLAYERS = {
  SAI: 'Sai Sudharsan', SG: 'Shubman Gill', KM: 'Kusal Mendis',
  WS: 'Washington Sundar', SR: 'Sherfane Rutherford', RT: 'Rahul Tewatia',
  SK: 'Shahrukh Khan', RK: 'Rashid Khan',
  TB: 'Trent Boult', JB: 'Jasprit Bumrah', HP: 'Hardik Pandya',
  ND: 'Naman Dhir', MS: 'Mitchell Santner', RG: 'Richard Gleeson', AK: 'Ashwani Kumar'
};

const ELIM_INN2 = `
0.1|SAI|TB|1
0.2|SG|TB|1
0.3|SAI|TB|1
0.4|SG|TB|0||W:lbw
0.5|KM|TB|0
0.6|KM|TB|2
1.1|SAI|JB|0
1.2|SAI|JB|2
1.3|SAI|JB|0|1w
1.3|SAI|JB|0
1.4|SAI|JB|1
1.5|KM|JB|0
1.6|KM|JB|0
2.1|SAI|TB|0
2.2|SAI|TB|6
2.3|SAI|TB|2
2.4|SAI|TB|1
2.5|KM|TB|6
2.6|KM|TB|6
3.1|SAI|RG|0
3.2|SAI|RG|4
3.3|SAI|RG|1
3.4|KM|RG|0|1w
3.4|KM|RG|1
3.5|SAI|RG|0
3.6|SAI|RG|4
4.1|KM|HP|1
4.2|SAI|HP|0
4.3|SAI|HP|4
4.4|SAI|HP|4
4.5|SAI|HP|1
4.6|KM|HP|4
5.1|SAI|JB|4
5.2|SAI|JB|0
5.3|SAI|JB|0
5.4|SAI|JB|4
5.5|SAI|JB|2
5.6|SAI|JB|1
6.1|SAI|MS|1
6.2|KM|MS|0||W:hitwicket
6.3|WS|MS|0
6.4|WS|MS|1
6.5|SAI|MS|4
6.6|SAI|MS|4
7.1|WS|ND|0
7.2|WS|ND|1
7.3|SAI|ND|2
7.4|SAI|ND|4
7.5|SAI|ND|1
7.6|WS|ND|1
8.1|WS|HP|2
8.2|WS|HP|4
8.3|WS|HP|1
8.4|SAI|HP|1
8.5|WS|HP|1
8.6|SAI|HP|1
9.1|SAI|RG|4
9.2|SAI|RG|1
9.3|WS|RG|4
9.4|WS|RG|1
9.5|SAI|RG|1
9.6|WS|RG|0
10.1|SAI|HP|2
10.2|SAI|HP|1
10.3|WS|HP|4
10.4|WS|HP|0
10.5|WS|HP|0
10.6|WS|HP|6
11.1|SAI|AK|2
11.2|SAI|AK|2
11.3|SAI|AK|1
11.4|WS|AK|1
11.5|SAI|AK|1
11.6|WS|AK|4
12.1|SAI|TB|0
12.2|SAI|TB|1
12.3|WS|TB|0
12.4|WS|TB|6
12.5|WS|TB|6
12.6|WS|TB|0|1w
12.6|WS|TB|4
13.1|SAI|JB|1
13.2|WS|JB|1
13.3|SAI|JB|1
13.4|WS|JB|0||W:bowled
13.5|SR|JB|0
13.6|SR|JB|1
14.1|SR|AK|1
14.2|SAI|AK|1
14.3|SR|AK|1
14.4|SAI|AK|0|1lb
14.5|SR|AK|4
14.6|SR|AK|1
15.1|SR|RG|4
15.2|SR|RG|4
15.3|SR|RG|1
15.4|SAI|RG|0||W:bowled
15.5|RT|RG|1
15.6|SR|RG|4
16.1|RT|AK|0
16.2|RT|AK|0|1w
16.2|RT|AK|2
16.3|RT|AK|1
16.4|SR|AK|1
16.5|RT|AK|4
16.6|RT|AK|0
17.1|SR|JB|0
17.2|SR|JB|1
17.3|RT|JB|6
17.4|RT|JB|0
17.5|RT|JB|0|1lb
17.6|SR|JB|1
18.1|SR|TB|0||W:caught:N Tilak Varma
18.2|SK|TB|2
18.3|SK|TB|2
18.4|SK|TB|1
18.5|RT|TB|1
18.6|SK|TB|6
19.1|RT|RG|1
19.2|SK|RG|0
19.3|SK|RG|2
19.4|SK|AK|0||W:caught:Surya Kumar Yadav
19.5|RK|AK|0
19.6|RK|AK|0
`.trim().split('\n');

// ──────────────────────────────────────────────────────────────────────
//  FINAL — 2nd Innings: PBKS chases 191 → 184/7 (20 overs)
//  Match 1500004 | Batting: PBKS | Bowling: RCB
// ──────────────────────────────────────────────────────────────────────
const FINAL_PLAYERS = {
  PA: 'Priyansh Arya', PS: 'Prabhsimran Singh', JIN: 'Josh Inglis',
  SI: 'Shreyas Iyer', NW: 'Nehal Wadhera', SS: 'Shashank Singh',
  MST: 'Marcus Stoinis', AO: 'Azmatullah Omarzai', KJ: 'Kyle Jamieson',
  BK: 'Bhuvneshwar Kumar', YD: 'Yash Dayal', JH: 'Josh Hazlewood',
  KP: 'Krunal Pandya', RS: 'Romario Shepherd', SY: 'Suyash Sharma'
};

const FINAL_INN2 = `
0.1|PA|BK|4
0.2|PA|BK|1
0.3|PS|BK|1
0.4|PA|BK|0
0.5|PA|BK|1
0.6|PS|BK|6
1.1|PA|YD|0
1.2|PA|YD|4
1.3|PA|YD|1
1.4|PS|YD|0
1.5|PS|YD|1
1.6|PA|YD|0|4lb
2.1|PS|JH|0
2.2|PS|JH|1
2.3|PA|JH|1
2.4|PS|JH|1
2.5|PA|JH|0
2.6|PA|JH|2
3.1|PS|BK|2
3.2|PS|BK|1
3.3|PA|BK|0
3.4|PA|BK|0
3.5|PA|BK|1
3.6|PS|BK|0
4.1|PA|JH|0|1w
4.1|PA|JH|0
4.2|PA|JH|4
4.3|PA|JH|4
4.4|PA|JH|1
4.5|PS|JH|1
4.6|PA|JH|0||W:caught:Phil Salt
5.1|PS|YD|1
5.2|JIN|YD|2
5.3|JIN|YD|0
5.4|JIN|YD|0
5.5|JIN|YD|6
5.6|JIN|YD|0
6.1|PS|KP|0
6.2|PS|KP|1
6.3|JIN|KP|0
6.4|JIN|KP|1
6.5|PS|KP|0
6.6|PS|KP|1
7.1|PS|SY|1
7.2|JIN|SY|6
7.3|JIN|SY|1
7.4|PS|SY|0
7.5|PS|SY|6
7.6|PS|SY|1
8.1|PS|KP|1
8.2|JIN|KP|1
8.3|PS|KP|0||W:caught:Bhuvneshwar Kumar
8.4|SI|KP|1
8.5|JIN|KP|0
8.6|JIN|KP|1
9.1|JIN|RS|4
9.2|JIN|RS|0
9.3|JIN|RS|1
9.4|SI|RS|0||W:caught:Jitesh Sharma
9.5|NW|RS|1
9.6|JIN|RS|1
10.1|JIN|KP|6
10.2|JIN|KP|0
10.3|JIN|KP|1
10.4|NW|KP|0
10.5|NW|KP|0
10.6|NW|KP|0
11.1|JIN|RS|1
11.2|NW|RS|0
11.3|NW|RS|0|1w
11.3|NW|RS|0
11.4|NW|RS|1
11.5|JIN|RS|6
11.6|JIN|RS|1
12.1|JIN|KP|0||W:caught:Liam Livingstone
12.2|SS|KP|0
12.3|SS|KP|0
12.4|SS|KP|1
12.5|NW|KP|1
12.6|SS|KP|1
13.1|SS|SY|0|1lb
13.2|NW|SY|0
13.3|NW|SY|2
13.4|NW|SY|0
13.5|NW|SY|1
13.6|SS|SY|1
14.1|SS|RS|4
14.2|SS|RS|1
14.3|NW|RS|6
14.4|NW|RS|1
14.5|SS|RS|0
14.6|SS|RS|1
15.1|SS|JH|1
15.2|NW|JH|1
15.3|SS|JH|6
15.4|SS|JH|0|1lb
15.5|NW|JH|0|1w
15.5|NW|JH|1
15.6|SS|JH|6
16.1|NW|BK|0
16.2|NW|BK|0||W:caught:Krunal Pandya
16.3|MST|BK|6
16.4|MST|BK|0||W:caught:Yash Dayal
16.5|AO|BK|1
16.6|SS|BK|1
17.1|SS|YD|0|1lb
17.2|AO|YD|0||W:caught:Manoj Bhandage
17.3|KJ|YD|0|1lb
17.4|SS|YD|2
17.5|SS|YD|1
17.6|KJ|YD|0
18.1|SS|BK|6
18.2|SS|BK|0
18.3|SS|BK|0
18.4|SS|BK|4
18.5|SS|BK|2
18.6|SS|BK|1
19.1|SS|JH|0
19.2|SS|JH|0
19.3|SS|JH|6
19.4|SS|JH|4
19.5|SS|JH|6
19.6|SS|JH|6
`.trim().split('\n');


// ══════════════════════════════════════════════════════════════════════
//  MAIN — Connect, Update, Insert
// ══════════════════════════════════════════════════════════════════════

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── Step 1: Update match records ──────────────────────────────────
  console.log('═══ STEP 1: Updating Playoff Match Records ═══');
  for (const { id, update } of matchUpdates) {
    const result = await Match.updateOne({ id }, { $set: update });
    const label = update.match_type;
    if (result.modifiedCount > 0) {
      console.log(`  ✅ ${label} (${id}): ${update.team1 || ''} vs ${update.team2 || ''} → ${update.winner} by ${update.result_margin} ${update.result} | MoM: ${update.player_of_match}`);
    } else if (result.matchedCount > 0) {
      console.log(`  ⏭️  ${label} (${id}): Already up to date`);
    } else {
      console.log(`  ❌ ${label} (${id}): Match not found!`);
    }
  }

  // ── Step 2: Insert delivery data ──────────────────────────────────
  console.log('\n═══ STEP 2: Inserting Ball-by-Ball Delivery Data ═══');

  const innings = [
    {
      name: 'Qualifier 1 — RCB 2nd innings (106/2)',
      matchId: 1500001, inning: 2,
      battingTeam: 'Royal Challengers Bengaluru',
      bowlingTeam: 'Punjab Kings',
      data: Q1_INN2, players: Q1_PLAYERS
    },
    {
      name: 'Eliminator — GT 2nd innings (208/6)',
      matchId: 1500002, inning: 2,
      battingTeam: 'Gujarat Titans',
      bowlingTeam: 'Mumbai Indians',
      data: ELIM_INN2, players: ELIM_PLAYERS
    },
    {
      name: 'Final — PBKS 2nd innings (184/7)',
      matchId: 1500004, inning: 2,
      battingTeam: 'Punjab Kings',
      bowlingTeam: 'Royal Challengers Bengaluru',
      data: FINAL_INN2, players: FINAL_PLAYERS
    }
  ];

  for (const { name, matchId, inning, battingTeam, bowlingTeam, data, players } of innings) {
    // Remove any existing deliveries for this innings
    const deleted = await Delivery.deleteMany({ match_id: matchId, inning });
    if (deleted.deletedCount > 0) {
      console.log(`  🗑️  Cleared ${deleted.deletedCount} existing deliveries for match ${matchId} inning ${inning}`);
    }

    const deliveries = parseDeliveries(data, matchId, inning, battingTeam, bowlingTeam, players);
    await Delivery.insertMany(deliveries, { ordered: false });
    
    // Calculate totals for verification
    const totalRuns = deliveries.reduce((s, d) => s + d.total_runs, 0);
    const totalWickets = deliveries.reduce((s, d) => s + d.is_wicket, 0);
    console.log(`  ✅ ${name}: ${deliveries.length} balls → ${totalRuns}/${totalWickets}`);
  }

  // ── Step 3: Verification ──────────────────────────────────────────
  console.log('\n═══ STEP 3: Verification ═══');
  for (const { id } of matchUpdates) {
    const match = await Match.findOne({ id }).lean();
    const deliveryCount = await Delivery.countDocuments({ match_id: id });
    const hasScorecard = deliveryCount > 0;
    console.log(`  Match ${id} (${match.match_type}): ${match.team1} vs ${match.team2} → Winner: ${match.winner} by ${match.result_margin} ${match.result} | MoM: ${match.player_of_match} | Deliveries: ${deliveryCount} | Scorecard: ${hasScorecard ? 'YES' : 'NO'}`);
  }

  console.log('\n✅ Enrichment complete!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
