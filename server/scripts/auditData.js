const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Match = require('../models/Match');
const Delivery = require('../models/Delivery');

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Count matches per season
  const matchesBySeason = await Match.aggregate([
    { $group: { _id: '$season', count: { $sum: 1 }, matchTypes: { $addToSet: '$match_type' } } },
    { $sort: { _id: 1 } }
  ]);
  console.log('=== MATCHES BY SEASON ===');
  matchesBySeason.forEach(s => console.log(s._id + ': ' + s.count + ' matches | Types: ' + s.matchTypes.join(', ')));

  const totalMatches = await Match.countDocuments();
  const totalDeliveries = await Delivery.countDocuments();
  console.log('\nTotal matches: ' + totalMatches);
  console.log('Total deliveries: ' + totalDeliveries);

  // 2025 non-league matches
  const playoffs = await Match.find({ season: '2025', match_type: { $nin: ['League', 'T20'] } }).sort('date').lean();
  console.log('\n=== 2025 NON-LEAGUE MATCHES ===');
  playoffs.forEach(m => {
    console.log('ID: ' + m.id + ' | ' + m.match_type + ' | ' + m.team1 + ' vs ' + m.team2 +
      ' | Winner: ' + m.winner + ' | MoM: ' + (m.player_of_match || 'N/A') +
      ' | Margin: ' + m.result_margin + ' ' + m.result + ' | Toss: ' + (m.toss_winner || 'N/A'));
  });

  // Matches with no deliveries
  const allMatchIds = await Match.distinct('id', { season: '2025' });
  const deliveryMatchIds = await Delivery.distinct('match_id');
  const deliverySet = new Set(deliveryMatchIds);
  const noDeliveries = allMatchIds.filter(id => !deliverySet.has(id));
  console.log('\n2025 matches with NO delivery data: ' + noDeliveries.length + ' / ' + allMatchIds.length);
  if (noDeliveries.length > 0) {
    console.log('IDs without deliveries: ' + noDeliveries.join(', '));
  }

  // Missing fields for 2025
  const missingToss = await Match.countDocuments({ season: '2025', toss_winner: '' });
  const missingMoM = await Match.countDocuments({ season: '2025', player_of_match: '' });
  const missingUmpire = await Match.countDocuments({ season: '2025', umpire1: '' });
  const missingCity = await Match.countDocuments({ season: '2025', city: '' });
  console.log('\n=== 2025 MISSING DATA ===');
  console.log('Missing toss_winner: ' + missingToss);
  console.log('Missing player_of_match: ' + missingMoM);
  console.log('Missing umpires: ' + missingUmpire);
  console.log('Missing city: ' + missingCity);

  // Sample a 2025 league match to see what fields are populated
  const sample = await Match.findOne({ season: '2025', match_type: { $in: ['League', 'T20'] } }).lean();
  console.log('\n=== SAMPLE 2025 LEAGUE MATCH ===');
  console.log(JSON.stringify(sample, null, 2));

  // Check all seasons have both matches and deliveries
  console.log('\n=== DELIVERY COVERAGE BY SEASON ===');
  for (const season of matchesBySeason) {
    const seasonMatchIds = await Match.distinct('id', { season: season._id });
    const seasonDeliveryIds = await Delivery.distinct('match_id', { match_id: { $in: seasonMatchIds } });
    const coverage = seasonDeliveryIds.length + '/' + seasonMatchIds.length;
    console.log(season._id + ': ' + coverage + ' matches have deliveries');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

audit().catch(err => { console.error(err); process.exit(1); });
