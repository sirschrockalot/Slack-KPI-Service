const express = require('express');
const { body, validationResult } = require('express-validator');

function isYmdDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

module.exports = function(logger, generateReport, supabaseSyncService) {
  const router = express.Router();

  router.post(
    '/nightly-kpis',
    [
      body('date')
        .optional()
        .custom(value => {
          if (!isYmdDateString(value)) throw new Error('date must be YYYY-MM-DD');
          return true;
        })
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const requestedDate = req.body?.date;
      const entryDateYMD = requestedDate || supabaseSyncService.getDefaultEntryDateYMD();

      logger.info('Manual nightly KPI sync requested', {
        entryDateYMD
      });

      // Return quickly so this endpoint is safe even if Aircall fetch is slow.
      res.status(202).json({
        success: true,
        message: 'Nightly KPI sync started in background',
        entryDateYMD
      });

      (async () => {
        try {
          if (!supabaseSyncService?.isConfigured?.()) {
            logger.warn('Supabase sync skipped (service not configured)', { entryDateYMD });
            return;
          }

          const { startISO, endISO } = supabaseSyncService.getNightWindowISOForEntryDate(entryDateYMD);
          const activityData = await generateReport('night', startISO, endISO);

          const result = await supabaseSyncService.syncDailyPhoneKpisFromActivity({
            entryDateYMD,
            activityData
          });

          if (result?.success) {
            logger.info('✅ Supabase nightly KPI sync complete', {
              entryDateYMD,
              rowsProcessed: result.usersProcessed,
              rowsPrepared: result.rowsPrepared,
              rowsInsertedOrUpdated: result.rowsInsertedOrUpdated,
              insertedCount: result.insertedCount,
              updatedCount: result.updatedCount,
              unresolvedCount: result.unresolvedCount
            });
          } else {
            logger.warn('⚠️ Supabase nightly KPI sync did not succeed', {
              entryDateYMD,
              reason: result?.reason,
              rowsProcessed: result?.usersProcessed || 0,
              unresolvedCount: result?.unresolvedCount || 0,
              rowsPrepared: result?.rowsPrepared || 0
            });
          }
        } catch (err) {
          logger.error('❌ Supabase nightly KPI sync failed', {
            entryDateYMD,
            message: err.message,
            stack: err.stack
          });
        }
      })();
    }
  );

  return router;
};

