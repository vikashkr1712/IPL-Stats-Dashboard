const mongoose = require('mongoose');

const playerImageSchema = new mongoose.Schema({
  playerName: { type: String, required: true, unique: true, index: true },
  imageUrl:   { type: String, default: null },
  fallback:   { type: String, default: null },
  fetchedAt:  { type: Date, default: Date.now },
  source:     { type: String, default: 'wikipedia' }
});

module.exports = mongoose.model('PlayerImage', playerImageSchema);
