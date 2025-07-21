const HourlyCallStats = require('../models/HourlyCallStats');
const SyncStatus = require('../models/SyncStatus');
const winston = require('winston');

class HourlySyncService {
  constructor(aircallService, logger) {
    this.aircallService = aircallService;
    this.logger = logger;
    this.logger.info('HourlySyncService has been initialized.');
  }

  async syncCatchUp() {
    try {
      this.logger.info('SYNC_SERVICE: Starting catch-up sync.');
      // Find the last sync time
      let status = await SyncStatus.findOne({ key: 'hourly' });
      const now = new Date();
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      let lastSyncedAt = status ? status.lastSyncedAt : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // If lastSyncedAt is in the future, reset to start of today
      if (lastSyncedAt > currentHour) {
        lastSyncedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      // Sync each missing hour
      while (lastSyncedAt < currentHour) {
        const startTime = new Date(lastSyncedAt);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        this.logger.info(`SYNC_SERVICE: Syncing hour ${startTime.toISOString()} to ${endTime.toISOString()}`);
        await this.syncHour(startTime, endTime);
        // Update lastSyncedAt in DB
        await SyncStatus.findOneAndUpdate(
          { key: 'hourly' },
          { lastSyncedAt: endTime },
          { upsert: true, new: true }
        );
        lastSyncedAt = endTime;
      }
      this.logger.info('SYNC_SERVICE: Catch-up sync complete.');
    } catch (error) {
      this.logger.error('SYNC_SERVICE: Error during catch-up sync:', { message: error.message, stack: error.stack });
    }
  }

  async syncHour(startTime, endTime) {
    try {
      this.logger.info('SYNC_SERVICE: Starting hourly sync.');
      this.logger.info('SYNC_SERVICE: STEP 1: Calling aircallService.getUserActivity.');
      const data = await this.aircallService.getUserActivity(
        'hourly',
        startTime.toISOString(),
        endTime.toISOString()
      );
      this.logger.info('SYNC_SERVICE: STEP 2: Returned from aircallService.getUserActivity.');
      this.logger.info('SYNC_SERVICE: STEP 3: Data received:', { data: JSON.stringify(data, null, 2) });
      let users = data.users;
      if (!Array.isArray(users)) {
        this.logger.error('SYNC_SERVICE: users is not an array. Data:', data);
        return;
      }
      const operations = users.map(user => {
        const userStats = {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          timestamp: startTime,
          totalDials: user.totalCalls,
          totalTalkTimeMinutes: user.totalDurationMinutes,
          callIds: user.calls ? user.calls.map(c => c.id) : [],
        };
        return {
          updateOne: {
            filter: { userId: user.user_id, timestamp: startTime },
            update: { $set: userStats },
            upsert: true
          }
        };
      });
      if (operations.length > 0) {
        this.logger.info(`SYNC_SERVICE: STEP 4: Preparing to bulkWrite ${operations.length} operations.`);
        try {
          const result = await HourlyCallStats.bulkWrite(operations);
          this.logger.info(`Hourly sync complete. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
        } catch (dbError) {
          this.logger.error('SYNC_SERVICE: Error during bulkWrite:', dbError);
        }
      } else {
        this.logger.info('SYNC_SERVICE: STEP 4 FAILED: No operations to perform.');
      }
    } catch (error) {
      this.logger.error('SYNC_SERVICE: Error during hourly sync:', { message: error.message, stack: error.stack });
    }
  }
}

module.exports = HourlySyncService; 