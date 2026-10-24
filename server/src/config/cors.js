import { env } from './env.js';

const rawAllowedOrigin = env.CLIENT_URL || 'http://localhost:5173';
export const normalizedAllowedOrigin = rawAllowedOrigin.replace(/\/+$/, '');

const isProduction = env.NODE_ENV === 'production';

/**
 * Validates whether an incoming HTTP Origin header is in the trusted allowlist.
 *
 * Rules:
 * 1. Missing/null Origin (same-origin, curl, server-to-server) -> Allowed.
 * 2. Exact match against configured CLIENT_URL -> Allowed.
 * 3. Localhost origins (http://localhost:*, http://127.0.0.1:*) ->
 *    Allowed in development/test only; BLOCKED in production.
 * 4. Project-specific Vercel production and preview domains
 *    (https://ai-code-review*.vercel.app, https://aicode-review*.vercel.app) -> Allowed.
 * 5. All other origins (including arbitrary third-party *.vercel.app) ->
 *    Strictly Rejected.
 *
 * @param {string|undefined|null} origin - The Origin header value
 * @returns {boolean} True if origin is trusted, false otherwise
 */
export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/+$/, '');

  // Exact match against configured CLIENT_URL
  if (cleanOrigin === normalizedAllowedOrigin) return true;

  // Localhost development and testing origins — blocked in production
  if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) return true;

  // Project-specific Vercel production and preview domains
  // Matches both 'ai-code-review' and 'aicode-review' naming conventions (e.g. aicode-review-ten.vercel.app)
  if (/^https:\/\/(ai-code-review|aicode-review)(-[a-zA-Z0-9_-]+)?\.vercel\.app$/.test(cleanOrigin)) return true;

  return false;
};

export const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

export default {
  normalizedAllowedOrigin,
  isOriginAllowed,
  corsOptions
};
