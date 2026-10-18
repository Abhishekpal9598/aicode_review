import { getDBStatus } from '../config/db.js';

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
  const dbStatus = getDBStatus();
  const timestamp = new Date().toISOString();

  if (dbStatus.connected) {
    return res.status(200).json({
      success: true,
      message: 'AI Code Review API is running',
      status: 'healthy',
      database: {
        connected: true
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
