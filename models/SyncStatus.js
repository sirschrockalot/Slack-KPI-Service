const mongoose = require('mongoose');

const syncStatusSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  lastSyncedAt: { type: Date, required: true }
});

module.exports = mongoose.model('SyncStatus', syncStatusSchema); 