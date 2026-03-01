const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

const playoffMatches = [
  {
    id: 1500001,
    season: '2025',
    city: 'New Chandigarh',
    date: new Date('2025-05-29'),
    match_type: 'Qualifier 1',
    venue: 'New PCA Stadium, New Chandigarh',
    team1: 'Punjab Kings',
    team2: 'Royal Challengers Bengaluru',
    winner: 'Royal Challengers Bengaluru',
    result: 'wickets',
    result_margin: 0,
    toss_winner: '',
    toss_decision: '',
    player_of_match: '',
    super_over: 'N'
  },
  {
    id: 1500002,
    season: '2025',
    city: 'New Chandigarh',
    date: new Date('2025-05-30'),
    match_type: 'Eliminator',
    venue: 'New PCA Stadium, New Chandigarh',
    team1: 'Gujarat Titans',
    team2: 'Mumbai Indians',
    winner: 'Mumbai Indians',
    result: 'wickets',
    result_margin: 0,
    toss_winner: '',
    toss_decision: '',
    player_of_match: '',
    super_over: 'N'
  },
  {
    id: 1500003,
    season: '2025',
    city: 'Ahmedabad',
    date: new Date('2025-06-01'),
    match_type: 'Qualifier 2',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    team1: 'Punjab Kings',
    team2: 'Mumbai Indians',
    winner: 'Punjab Kings',
    result: 'wickets',
    result_margin: 0,
    toss_winner: '',
    toss_decision: '',
    player_of_match: '',
    super_over: 'N'
  },
  {
    id: 1500004,
    season: '2025',
    city: 'Ahmedabad',
    date: new Date('2025-06-03'),
    match_type: 'Final',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    team1: 'Royal Challengers Bengaluru',
    team2: 'Punjab Kings',
    winner: 'Royal Challengers Bengaluru',
    result: 'wickets',
    result_margin: 0,
    toss_winner: '',
    toss_decision: '',
    player_of_match: '',
    super_over: 'N'
  }
];

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Delete any existing playoff matches for 2025 first
  await Match.deleteMany({
    season: '2025',
    match_type: { $in: ['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final'] }
  });
  
  const result = await Match.insertMany(playoffMatches);
  console.log('Inserted', result.length, 'playoff matches');
  
  // Verify
  const verify = await Match.find({
    season: '2025',
    match_type: { $in: ['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final'] }
  }).sort('date').lean();
  
  verify.forEach(m => {
    console.log(m.match_type + ': ' + m.team1 + ' vs ' + m.team2 + ' -> Winner: ' + m.winner);
  });
  
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
  mongoose.disconnect();
});
