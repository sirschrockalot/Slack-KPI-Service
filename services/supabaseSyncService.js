const winston = require('winston');

let createClient = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  ({ createClient } = require('@supabase/supabase-js'));
} catch (err) {
  // This will be handled at runtime when sync is invoked.
}

const aircallRepMapping = require('../config/aircallRepMapping');

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
  // AircallService emits ISO strings; derive entry_date from local date of the window start.
  const startISO = activityData?.startTime;
  if (!startISO) return null;
  const startDate = new Date(startISO);
  return toYMDLocal(startDate);
}

function buildMappingIndex(mappingList) {
  const index = new Map();
  for (const m of mappingList || []) {
    if (!m?.aircall_user_name) continue;
    index.set(String(m.aircall_user_name).trim().toLowerCase(), m);
  }
  return index;
}

function tryResolveMapping({
  aircallUserName,
  mappingIndex,
  dispoAgentsEnv,
  acquisitionAgentsEnv
}) {
  const name = (aircallUserName || '').trim();
  if (!name) return null;

  const direct = mappingIndex.get(name.toLowerCase());
  if (direct) return direct;

  // Fallback: use existing repo env categorization (rep name == aircall name, user_id omitted).
  const dispoAgents = (dispoAgentsEnv || '').split(',').map(s => s.trim()).filter(Boolean);
  const acquisitionAgents = (acquisitionAgentsEnv || '').split(',').map(s => s.trim()).filter(Boolean);

  const nameLower = name.toLowerCase();
  const isDispo = dispoAgents.some(a => a.toLowerCase() === nameLower);
  if (isDispo) {
    return { rep_name: name, team: 'dispo', app_user_id: null, source_rep_name: name };
  }

  const isAcq = acquisitionAgents.some(a => a.toLowerCase() === nameLower);
  if (isAcq) {
    return { rep_name: name, team: 'acquisition', app_user_id: null, source_rep_name: name };
  }

  return null;
}

function aggregateDailyPhoneKpis({ entryDateYMD, activityData, mappingIndex, logger, config }) {
  const users = activityData?.users || [];
  const usersProcessed = users.length;

  const byRepKey = new Map();
  const unresolvedAircallUsers = [];

  for (const user of users) {
    const aircallUserName = user?.name;
    const resolved = tryResolveMapping({
      aircallUserName,
      mappingIndex,
      dispoAgentsEnv: config?.dispoAgentsEnv,
      acquisitionAgentsEnv: config?.acquisitionAgentsEnv
    });

    if (!resolved) {
      unresolvedAircallUsers.push(aircallUserName);
      continue;
    }

    const rep_name = resolved.rep_name;
    const team = resolved.team;
    const app_user_id = resolved.app_user_id || null;
    const source = 'aircall';
    const key = `${entryDateYMD}|${rep_name}|${team}|${source}`;

    const dials = Number(user?.totalCalls || 0);
    const talkTimeMinutesRaw = Number(user?.totalDurationMinutes || 0); // can be decimal

    const prev = byRepKey.get(key) || {
      entry_date: entryDateYMD,
      rep_name,
      user_id: app_user_id,
      team,
      source,
      dials: 0,
      talk_time_minutes_raw: 0,
      raw_aircall_users: []
    };

    prev.dials += dials;
    prev.talk_time_minutes_raw += talkTimeMinutesRaw;
    prev.raw_aircall_users.push({
      aircall_user_name: aircallUserName,
      aircall_user_id: user?.user_id || null,
      dials,
      talk_time_minutes_raw: talkTimeMinutesRaw,
      agentCategory: user?.agentCategory || null
    });

    // Preserve a non-null app_user_id if later mappings provide it.
    if (!prev.user_id && app_user_id) prev.user_id = app_user_id;

    byRepKey.set(key, prev);
  }

  const { startTime, endTime } = activityData || {};
  const rawWindow = {
    source: 'aircall',
    startTime,
    endTime
  };

  const rows = Array.from(byRepKey.values()).map(agg => ({
    entry_date: agg.entry_date,
    rep_name: agg.rep_name,
    user_id: agg.user_id,
    team: agg.team,
    source: agg.source,
    dials: Math.round(agg.dials),
    talk_time_minutes: Math.round(agg.talk_time_minutes_raw),
    raw_payload: {
      window: rawWindow,
      by_aircall_users: agg.raw_aircall_users
    }
  }));

  return {
    rows,
    usersProcessed,
    unresolvedCount: unresolvedAircallUsers.length,
    unresolvedAircallUsers: unresolvedAircallUsers
  };
}

class SupabaseSyncService {
  constructor(logger = null, options = {}) {
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
    this.config = {
      dispoAgentsEnv: process.env.DISPO_AGENTS || process.env.INPUT_DISPO_AGENTS || '',
      acquisitionAgentsEnv: process.env.ACQUISITION_AGENTS || process.env.INPUT_ACQUISITION_AGENTS || ''
    };

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
    const repNames = Array.from(new Set(rows.map(r => r.rep_name)));
    const teams = Array.from(new Set(rows.map(r => r.team)));

    const { data: existingRows, error: existingError } = await this.supabase
      .from('daily_phone_kpis')
      .select('rep_name, team, source')
      .eq('entry_date', entryDateYMD)
      .eq('source', 'aircall')
      .in('rep_name', repNames)
      .in('team', teams);

    if (existingError) {
      throw existingError;
    }

    const existingSet = new Set((existingRows || []).map(r => `${entryDateYMD}|${r.rep_name}|${r.team}|${r.source}`));
    const insertedCount = rows.filter(r => !existingSet.has(`${entryDateYMD}|${r.rep_name}|${r.team}|${r.source}`)).length;
    const updatedCount = rows.length - insertedCount;

    const upsertPayload = rows.map(r => ({
      ...r,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError, data: upsertData } = await this.supabase
      .from('daily_phone_kpis')
      .upsert(upsertPayload, { onConflict: 'entry_date,rep_name,team,source' })
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

    const mappingIndex = buildMappingIndex(aircallRepMapping);
    const { rows, usersProcessed, unresolvedCount, unresolvedAircallUsers } = aggregateDailyPhoneKpis({
      entryDateYMD,
      activityData,
      mappingIndex,
      logger: this.logger,
      config: this.config
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

