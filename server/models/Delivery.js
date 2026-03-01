const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  match_id: { type: Number, required: true },
  inning: { type: Number, required: true },
  batting_team: { type: String, required: true },
  bowling_team: { type: String, required: true },
  over: { type: Number, required: true },
  ball: { type: Number, required: true },
  batter: { type: String, required: true },
  bowler: { type: String, required: true },
  non_striker: { type: String, default: '' },
  batsman_runs: { type: Number, default: 0 },
  extra_runs: { type: Number, default: 0 },
  total_runs: { type: Number, default: 0 },
  extras_type: { type: String, default: '' },
  is_wicket: { type: Number, default: 0 },
  player_dismissed: { type: String, default: '' },
  dismissal_kind: { type: String, default: '' },
  fielder: { type: String, default: '' }
}, { timestamps: true });

// Indexes for faster aggregation queries
deliverySchema.index({ match_id: 1 });
deliverySchema.index({ batter: 1 });
deliverySchema.index({ bowler: 1 });
deliverySchema.index({ batting_team: 1 });
deliverySchema.index({ bowling_team: 1 });
deliverySchema.index({ match_id: 1, inning: 1 });
// Compound indexes for common aggregation pipelines
deliverySchema.index({ batter: 1, batsman_runs: 1 });
deliverySchema.index({ bowler: 1, is_wicket: 1 });
deliverySchema.index({ match_id: 1, batting_team: 1 });
deliverySchema.index({ player_dismissed: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
