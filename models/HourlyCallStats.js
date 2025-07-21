const mongoose = require('mongoose');

const hourlyCallStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  timestamp: { type: Date, required: true },
  totalDials: { type: Number, default: 0 },
  totalTalkTimeMinutes: { type: Number, default: 0 },
  callIds: { type: [String], default: [] },
  source: { type: String, default: 'aircall' },
  createdAt: { type: Date, default: Date.now, expires: '13m' } // TTL index for 13 months
});

// Compound index for performance and to prevent duplicates
hourlyCallStatsSchema.index({ userId: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model('HourlyCallStats', hourlyCallStatsSchema); 