const HourlyCallStats = require('../models/HourlyCallStats');
const winston = require('winston');

class HourlySyncService {
  constructor(aircallService, logger) {
    this.aircallService = aircallService;
    this.logger = logger;
    this.logger.info('HourlySyncService has been initialized.');
  }

  async syncLastHour() {
    try {
      this.logger.info('SYNC_SERVICE: Starting hourly sync.');
      const now = new Date();
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const startTime = new Date(endTime.getTime() - (60 * 60 * 1000));

      this.logger.info('SYNC_SERVICE: STEP 1: Calling aircallService.getUserActivity.');
      const data = await this.aircallService.getUserActivity(
        'hourly',
        startTime.toISOString(),
        endTime.toISOString()
      );
      this.logger.info('SYNC_SERVICE: STEP 2: Returned from aircallService.getUserActivity.');
      this.logger.info('SYNC_SERVICE: STEP 3: Data received:', { data: JSON.stringify(data, null, 2) });


      if (!data || !data.users) {
        this.logger.warn('No user data returned from Aircall for the last hour.');
        return;
      }

      const operations = data.users.map(user => {
        const userStats = {
          userId: user.user_id,
          name: user.name,
          timestamp: startTime,
          totalDials: user.totalCalls,
          totalTalkTimeMinutes: user.totalDurationMinutes,
          callIds: user.calls.map(c => c.id) // Assuming calls are returned with IDs
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