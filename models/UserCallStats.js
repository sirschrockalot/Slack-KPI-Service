const mongoose = require('mongoose');

const userCallStatsSchema = new mongoose.Schema({
  userId: String,
  name: String,
  totalDials: Number,
  totalTalkTimeMinutes: Number,
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserCallStats', userCallStatsSchema); 