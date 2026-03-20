const winston = require('winston');

let createClient = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  ({ createClient } = require('@supabase/supabase-js'));
} catch (err) {
  // This will be handled at runtime when sync is invoked.
}

const performanceAppUserMap = require('../config/performanceAppUserMap');

function toYMDLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getPreviousLocalDateYMD(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return toYMDLocal(d);
}

function getNightWindowISOForEntryDate(entryDateYMD, opts = {}) {
  const logger = opts.logger;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDateYMD)) {
    throw new Error(`Invalid entryDate (expected YYYY-MM-DD): ${entryDateYMD}`);
  }

  const [yearStr, monthStr, dayStr] = entryDateYMD.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // JS months are 0-based
  const day = Number(dayStr);

  // Align with AircallService's "night" KPI window (7AM - 7PM local time).
  const start = new Date(year, month, day, 7, 0, 0, 0);
  const end = new Date(year, month, day, 19, 0, 0, 0);

  logger?.debug?.('Computed Aircall "night" window for entry date', {
    entryDateYMD,
    startISO: start.toISOString(),
    endISO: end.toISOString()
  });

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function getEntryDateFromActivityData(activityData) {
  // AircallService emits ISO strings; derive entryDate from local date of the window start.
  const startISO = activityData?.startTime;
  if (!startISO) return null;
  const startDate = new Date(startISO);
  return toYMDLocal(startDate);
}

function buildMappingIndex(mappingList) {
  const index = new Map();
  for (const m of mappingList || []) {
    if (!m?.aircallUserName) continue;
    index.set(String(m.aircallUserName).trim().toLowerCase(), m);
  }
  return index;
}

function tryResolveMapping({ aircallUserName, mappingIndex }) {
  const name = (aircallUserName || '').trim();
  if (!name) return null;

  const direct = mappingIndex.get(name.toLowerCase());
  if (!direct) return null;
  if (!direct.userId || !direct.teamId) return null;
  return direct;
}

function aggregateDailyPhoneKpis({ entryDateYMD, activityData, mappingIndex }) {
  const users = activityData?.users || [];
  const usersProcessed = users.length;

  const byKpiKey = new Map();
  const unresolvedAircallUsers = [];

  for (const user of users) {
    const aircallUserName = user?.name;
    const resolved = tryResolveMapping({ aircallUserName, mappingIndex });

    if (!resolved) {
      unresolvedAircallUsers.push(aircallUserName);
      continue;
    }

    const userId = String(resolved.userId);
    const teamId = String(resolved.teamId);
    const source = 'AIRCALL';
    const key = `${userId}|${teamId}|${entryDateYMD}|${source}`;

    const dials = Number(user?.totalCalls || 0);
    const talkTimeMinutesRaw = Number(user?.totalDurationMinutes || 0); // can be decimal
    const inboundTalkTimeMinutesRaw = Number(user?.inboundDurationMinutes || 0);
    const outboundTalkTimeMinutesRaw = Number(user?.outboundDurationMinutes || 0);

    const prev = byKpiKey.get(key) || {
      userId,
      teamId,
      entryDate: entryDateYMD,
      source,
      dials: 0,
      talk_time_minutes_raw: 0,
      inbound_talk_time_minutes_raw: 0,
      outbound_talk_time_minutes_raw: 0,
      raw_aircall_users: []
    };

    prev.dials += dials;
    prev.talk_time_minutes_raw += talkTimeMinutesRaw;
    prev.inbound_talk_time_minutes_raw += inboundTalkTimeMinutesRaw;
    prev.outbound_talk_time_minutes_raw += outboundTalkTimeMinutesRaw;
    prev.raw_aircall_users.push({
      aircall_user_name: aircallUserName,
      aircall_user_id: user?.user_id || null,
      mapped_user_id: userId,
      mapped_team_id: teamId,
      mapped_rep_name: resolved.repName || null,
      mapped_team_name: resolved.teamName || null,
      dials,
      talk_time_minutes_raw: talkTimeMinutesRaw,
      inbound_talk_time_minutes_raw: inboundTalkTimeMinutesRaw,
      outbound_talk_time_minutes_raw: outboundTalkTimeMinutesRaw,
      agentCategory: user?.agentCategory || null
    });

    byKpiKey.set(key, prev);
  }

  const { startTime, endTime } = activityData || {};
  const rawWindow = {
    source: 'aircall',
    startTime,
    endTime
  };

  const rows = Array.from(byKpiKey.values()).map(agg => ({
    userId: agg.userId,
    teamId: agg.teamId,
    entryDate: agg.entryDate,
    source: agg.source,
    dials: Math.round(agg.dials),
    talkTimeMinutes: Math.round(agg.talk_time_minutes_raw),
    inboundTalkTimeMinutes: Math.round(agg.inbound_talk_time_minutes_raw),
    outboundTalkTimeMinutes: Math.round(agg.outbound_talk_time_minutes_raw),
    rawPayload: {
      window: rawWindow,
      by_aircall_users: agg.raw_aircall_users
    },
    externalRef: agg.raw_aircall_users
      .map(u => u.aircall_user_id)
      .filter(Boolean)
      .sort()
      .join(',')
  }));

  return {
    rows,
    usersProcessed,
    unresolvedCount: unresolvedAircallUsers.length,
    unresolvedAircallUsers: unresolvedAircallUsers
  };
}

class SupabaseSyncService {
  constructor(logger = null) {
    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        defaultMeta: { service: 'supabase-sync-service' }
      });

    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabaseEnabled = Boolean(this.supabaseUrl && this.supabaseServiceRoleKey && createClient);

    if (this.supabaseEnabled) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }
  }

  isConfigured() {
    return this.supabaseEnabled;
  }

  getDefaultEntryDateYMD(now = new Date()) {
    return getPreviousLocalDateYMD(now);
  }

  getEntryDateFromActivityData(activityData) {
    return getEntryDateFromActivityData(activityData);
  }

  getNightWindowISOForEntryDate(entryDateYMD) {
    return getNightWindowISOForEntryDate(entryDateYMD, { logger: this.logger });
  }

  async upsertDailyPhoneKpis({ entryDateYMD, rows }) {
    if (!this.supabaseEnabled) {
      return {
        success: false,
        reason: 'Supabase not configured (missing env vars or dependency)'
      };
    }

    if (!rows || rows.length === 0) {
      return {
        success: true,
        rowsPrepared: 0,
        rowsInsertedOrUpdated: 0,
        insertedCount: 0,
        updatedCount: 0,
        unresolvedCount: 0
      };
    }

    // Determine insert vs update for logging (idempotency/observability).
    const userIds = Array.from(new Set(rows.map(r => r.userId)));
    const teamIds = Array.from(new Set(rows.map(r => r.teamId)));

    const { data: existingRows, error: existingError } = await this.supabase
      .from('DailyKpiEntry')
      .select('userId, teamId, source')
      .eq('entryDate', entryDateYMD)
      .eq('source', 'AIRCALL')
      .in('userId', userIds)
      .in('teamId', teamIds);

    if (existingError) {
      throw existingError;
    }

    const existingSet = new Set((existingRows || []).map(r => `${r.userId}|${r.teamId}|${entryDateYMD}|${r.source}`));
    const insertedCount = rows.filter(r => !existingSet.has(`${r.userId}|${r.teamId}|${entryDateYMD}|${r.source}`)).length;
    const updatedCount = rows.length - insertedCount;

    const upsertPayload = rows.map(r => ({
      ...r
    }));

    const { error: upsertError, data: upsertData } = await this.supabase
      .from('DailyKpiEntry')
      .upsert(upsertPayload, { onConflict: 'userId,teamId,entryDate,source' })
      .select('id');

    if (upsertError) {
      throw upsertError;
    }

    return {
      success: true,
      rowsPrepared: rows.length,
      rowsInsertedOrUpdated: upsertData?.length || rows.length,
      insertedCount,
      updatedCount
    };
  }

  async syncDailyPhoneKpisFromActivity({ entryDateYMD, activityData }) {
    if (!entryDateYMD) {
      throw new Error('entryDateYMD is required for syncDailyPhoneKpisFromActivity');
    }

    if (!this.supabaseEnabled) {
      this.logger.warn('Skipping Supabase sync (not configured)');
      return {
        success: false,
        reason: 'Supabase not configured',
        unresolvedCount: 0,
        rowsPrepared: 0
      };
    }

    const mappingIndex = buildMappingIndex(performanceAppUserMap);
    const { rows, usersProcessed, unresolvedCount, unresolvedAircallUsers } = aggregateDailyPhoneKpis({
      entryDateYMD,
      activityData,
      mappingIndex
    });

    if (unresolvedCount > 0) {
      this.logger.warn('Unresolved Aircall users skipped during Supabase sync', {
        entryDateYMD,
        unresolvedCount,
        unresolvedAircallUsers: unresolvedAircallUsers.slice(0, 50)
      });
    }

    const result = await this.upsertDailyPhoneKpis({ entryDateYMD, rows });

    return {
      ...result,
      entryDateYMD,
      usersProcessed,
      unresolvedCount,
      unresolvedAircallUsers
    };
  }
}

module.exports = SupabaseSyncService;

