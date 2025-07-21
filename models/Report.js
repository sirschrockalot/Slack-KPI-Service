const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: String,
  startTime: Date,
  endTime: Date,
  data: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema); 