const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Match = require('../models/Match');
const Delivery = require('../models/Delivery');

const MATCHES_CSV = path.join(__dirname, '..', '..', 'archive (1)', 'matches.csv');
const DELIVERIES_CSV = path.join(__dirname, '..', '..', 'archive (1)', 'deliveries.csv');
const IPL_CSV = path.join(__dirname, '..', '..', 'archive', 'IPL.csv');

const BATCH_SIZE = 5000;

// ─── Import matches.csv (2008-2024) ─────────────────────────────────
async function importMatches() {
  console.log('📂 Importing matches from matches.csv (2008-2024)...');

  return new Promise((resolve, reject) => {
    const records = [];

    fs.createReadStream(MATCHES_CSV)
      .pipe(csv())
      .on('data', (row) => {
        records.push({
          id: parseInt(row.id),
          season: row.season || '',
          city: row.city || '',
          date: row.date ? new Date(row.date) : new Date(),
          match_type: row.match_type || 'League',
          player_of_match: row.player_of_match === 'NA' ? '' : (row.player_of_match || ''),
          venue: row.venue || '',
          team1: row.team1 || '',
          team2: row.team2 || '',
          toss_winner: row.toss_winner || '',
          toss_decision: row.toss_decision || '',
          winner: row.winner === 'NA' ? '' : (row.winner || ''),
          result: row.result === 'NA' ? '' : (row.result || ''),
          result_margin: row.result_margin === 'NA' ? 0 : (parseInt(row.result_margin) || 0),
          target_runs: row.target_runs === 'NA' ? 0 : (parseInt(row.target_runs) || 0),
          target_overs: row.target_overs === 'NA' ? 0 : (parseFloat(row.target_overs) || 0),
          super_over: row.super_over || 'N',
          method: row.method === 'NA' ? '' : (row.method || ''),
          umpire1: row.umpire1 === 'NA' ? '' : (row.umpire1 || ''),
          umpire2: row.umpire2 === 'NA' ? '' : (row.umpire2 || '')
        });
      })
      .on('end', async () => {
        try {
          await Match.insertMany(records, { ordered: false });
          console.log(`✅ Imported ${records.length} matches from matches.csv`);
          resolve(records.length);
        } catch (err) {
          if (err.code === 11000 || err.writeErrors) {
            console.log(`✅ Imported matches (some duplicates skipped)`);
            resolve(records.length);
          } else {
            reject(err);
          }
        }
      })
      .on('error', reject);
  });
}

// ─── Import deliveries.csv (2008-2024) ──────────────────────────────
async function importDeliveries() {
  console.log('📂 Importing deliveries from deliveries.csv (2008-2024)...');

  return new Promise((resolve, reject) => {
    let batch = [];
    let totalImported = 0;
    let processing = Promise.resolve();

    fs.createReadStream(DELIVERIES_CSV)
      .pipe(csv())
      .on('data', (row) => {
        batch.push({
          match_id: parseInt(row.match_id),
          inning: parseInt(row.inning) || 1,
          batting_team: row.batting_team || '',
          bowling_team: row.bowling_team || '',
          over: parseInt(row.over) || 0,
          ball: parseInt(row.ball) || 0,
          batter: row.batter || '',
          bowler: row.bowler || '',
          non_striker: row.non_striker || '',
          batsman_runs: parseInt(row.batsman_runs) || 0,
          extra_runs: parseInt(row.extra_runs) || 0,
          total_runs: parseInt(row.total_runs) || 0,
          extras_type: row.extras_type === 'NA' ? '' : (row.extras_type || ''),
          is_wicket: parseInt(row.is_wicket) || 0,
          player_dismissed: row.player_dismissed === 'NA' ? '' : (row.player_dismissed || ''),
          dismissal_kind: row.dismissal_kind === 'NA' ? '' : (row.dismissal_kind || ''),
          fielder: row.fielder === 'NA' ? '' : (row.fielder || '')
        });

        if (batch.length >= BATCH_SIZE) {
          const currentBatch = [...batch];
          batch = [];
          processing = processing.then(async () => {
            await Delivery.insertMany(currentBatch, { ordered: false });
            totalImported += currentBatch.length;
            process.stdout.write(`\r   Imported ${totalImported} deliveries...`);
          });
        }
      })
      .on('end', async () => {
        try {
          await processing;
          if (batch.length > 0) {
            await Delivery.insertMany(batch, { ordered: false });
            totalImported += batch.length;
          }
          console.log(`\n✅ Imported ${totalImported} deliveries from deliveries.csv`);
          resolve(totalImported);
        } catch (err) {
          console.error('\n❌ Error importing deliveries:', err.message);
          reject(err);
        }
      })
      .on('error', reject);
  });
}

// ─── Import 2025 season data from IPL.csv ────────────────────────────
async function import2025Data() {
  console.log('\n📂 Importing 2025 data from IPL.csv...');

  if (!fs.existsSync(IPL_CSV)) {
    console.log('⚠️  IPL.csv not found, skipping 2025 data');
    return;
  }

  return new Promise((resolve, reject) => {
    const matchMap = new Map();
    const deliveries = [];

    fs.createReadStream(IPL_CSV)
      .pipe(csv())
      .on('data', (row) => {
        if (row.season !== '2025') return;

        const matchId = parseInt(row.match_id);

        // Build match info from first row per match
        if (!matchMap.has(matchId)) {
          const winOutcome = row.win_outcome || '';
          let result = '';
          let resultMargin = 0;
          if (winOutcome.includes('run')) {
            result = 'runs';
            resultMargin = parseInt(winOutcome) || 0;
          } else if (winOutcome.includes('wicket')) {
            result = 'wickets';
            resultMargin = parseInt(winOutcome) || 0;
          }

          matchMap.set(matchId, {
            id: matchId,
            season: '2025',
            city: row.city || '',
            date: row.date ? new Date(row.date) : new Date(),
            match_type: row.match_type || 'T20',
            player_of_match: row.player_of_match || '',
            venue: row.venue || '',
            team1: '',
            team2: '',
            toss_winner: row.toss_winner || '',
            toss_decision: row.toss_decision || '',
            winner: row.match_won_by || '',
            result,
            result_margin: resultMargin,
            target_runs: parseInt(row.runs_target) || 0,
            target_overs: 0,
            super_over: 'N',
            method: (row.method && row.method !== 'NA') ? row.method : '',
            umpire1: '',
            umpire2: '',
            _teams: new Set()
          });
        }

        const matchInfo = matchMap.get(matchId);
        if (row.batting_team) matchInfo._teams.add(row.batting_team);
        if (row.bowling_team) matchInfo._teams.add(row.bowling_team);

        // Build delivery
        const wicketKind = (row.wicket_kind && row.wicket_kind !== 'NA' && row.wicket_kind !== '') ? row.wicket_kind : '';
        const isWicket = wicketKind ? 1 : 0;

        deliveries.push({
          match_id: matchId,
          inning: parseInt(row.innings) || 1,
          batting_team: row.batting_team || '',
          bowling_team: row.bowling_team || '',
          over: parseInt(row.over) || 0,
          ball: parseInt(row.ball) || 0,
          batter: row.batter || '',
          bowler: row.bowler || '',
          non_striker: row.non_striker || '',
          batsman_runs: parseInt(row.runs_batter) || 0,
          extra_runs: parseInt(row.runs_extras) || 0,
          total_runs: parseInt(row.runs_total) || 0,
          extras_type: (row.extra_type && row.extra_type !== 'NA') ? row.extra_type : '',
          is_wicket: isWicket,
          player_dismissed: (row.player_out && row.player_out !== 'NA') ? row.player_out : '',
          dismissal_kind: wicketKind,
          fielder: (row.fielders && row.fielders !== 'NA') ? row.fielders : ''
        });
      })
      .on('end', async () => {
        try {
          // Finalize teams
          const matches = [];
          for (const [, info] of matchMap) {
            const teams = [...info._teams];
            info.team1 = teams[0] || '';
            info.team2 = teams[1] || '';
            delete info._teams;
            matches.push(info);
          }

          if (matches.length > 0) {
            try {
              await Match.insertMany(matches, { ordered: false });
            } catch (err) {
              if (err.code !== 11000 && !err.writeErrors) throw err;
            }
            console.log(`✅ Imported ${matches.length} matches for 2025`);
          }

          let totalDel = 0;
          for (let i = 0; i < deliveries.length; i += BATCH_SIZE) {
            const chunk = deliveries.slice(i, i + BATCH_SIZE);
            await Delivery.insertMany(chunk, { ordered: false });
            totalDel += chunk.length;
            process.stdout.write(`\r   Imported ${totalDel} deliveries for 2025...`);
          }
          console.log(`\n✅ Imported ${totalDel} deliveries for 2025`);

          resolve();
        } catch (err) {
          console.error('❌ Error importing 2025 data:', err.message);
          reject(err);
        }
      })
      .on('error', reject);
  });
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Match.deleteMany({});
    await Delivery.deleteMany({});
    console.log('✅ Cleared\n');

    // Import 2008-2024 from archive (1)
    await importMatches();
    await importDeliveries();

    // Import 2025 from archive/IPL.csv
    await import2025Data();

    // Create indexes
    console.log('\n📇 Creating indexes...');
    await Match.createIndexes();
    await Delivery.createIndexes();
    console.log('✅ Indexes created');

    // Final summary
    const matchCount = await Match.countDocuments();
    const deliveryCount = await Delivery.countDocuments();
    const seasons = await Match.distinct('season');
    console.log(`\n🎉 Import complete!`);
    console.log(`   📊 ${matchCount} matches`);
    console.log(`   🏏 ${deliveryCount} deliveries`);
    console.log(`   📅 Seasons: ${seasons.sort().join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main();
