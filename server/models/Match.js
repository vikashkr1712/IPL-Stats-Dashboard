const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  season: { type: String, required: true },
  city: { type: String, default: '' },
  date: { type: Date, required: true },
  match_type: { type: String, default: 'League' },
  player_of_match: { type: String, default: '' },
  venue: { type: String, required: true },
  team1: { type: String, required: true },
  team2: { type: String, required: true },
  toss_winner: { type: String, default: '' },
  toss_decision: { type: String, default: '' },
  winner: { type: String, default: '' },
  result: { type: String, default: '' },
  result_margin: { type: Number, default: 0 },
  target_runs: { type: Number, default: 0 },
  target_overs: { type: Number, default: 0 },
  super_over: { type: String, default: 'N' },
  method: { type: String, default: '' },
  umpire1: { type: String, default: '' },
  umpire2: { type: String, default: '' }
}, { timestamps: true });

// Indexes for faster queries
matchSchema.index({ season: 1 });
matchSchema.index({ team1: 1, team2: 1 });
matchSchema.index({ winner: 1 });
matchSchema.index({ venue: 1 });
matchSchema.index({ toss_winner: 1 });

module.exports = mongoose.model('Match', matchSchema);
