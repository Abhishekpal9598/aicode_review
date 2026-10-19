import { getDBStatus } from '../config/db.js';
import env from '../config/env.js';

// In-memory cache for database status to protect against high request volume / DDOS on health checks
let cachedDbStatus = null;
let lastDbCheckTime = 0;
const DB_CACHE_TTL_MS = 2000; // 2 seconds TTL

/**
 * Retrieve cached database status to prevent repetitive state lookups under high request volume.
 * @param {boolean} forceRefresh - If true, bypasses the cache and queries fresh status
 */
export const getCachedDBStatus = (forceRefresh = false) => {
  const now = Date.now();
  if (forceRefresh || !cachedDbStatus || (now - lastDbCheckTime) > DB_CACHE_TTL_MS) {
    cachedDbStatus = getDBStatus();
    lastDbCheckTime = now;
  }
  return cachedDbStatus;
};

/**
 * Reset health check DB cache (primarily for tests)
 */
export const clearHealthDBCache = () => {
  cachedDbStatus = null;
  lastDbCheckTime = 0;
};

/**
 * Phase 1 backward-compatible health check
 * GET /api/health
 */
export const getPhase1Health = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Code Review API is running',
    status: 'healthy'
  });
};

/**
 * Phase 2 versioned health check with database connectivity telemetry
 * GET /api/v1/health
 * Returns HTTP 200 when connected, HTTP 503 when database is unavailable
 */
export const getV1Health = (req, res) => {
  const dbStatus = getCachedDBStatus();
  const timestamp = new Date().toISOString();
  const aiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5);

  if (dbStatus.connected) {
    return res.status(200).json({
      success: true,
      message: 'AI Code Review API is running',
      status: 'healthy',
      database: {
        connected: true
      },
      ai: {
        configured: aiConfigured,
        model: env.GEMINI_MODEL
      },
      timestamp
    });
  }

  return res.status(503).json({
    success: false,
    message: 'AI Code Review API is degraded: Database unavailable',
    status: 'degraded',
    database: {
      connected: false
    },
    timestamp
  });
};

export default {
  getPhase1Health,
  getV1Health
};
