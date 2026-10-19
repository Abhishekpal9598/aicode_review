import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Rate limiter for authentication endpoints (/register, /login).
 * Protects against brute-force password guessing and registration spam.
 * In development, allows 100 attempts per 15 mins to avoid developer lockouts.
 * In production, strictly enforces 10 attempts per 15 mins.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 10 : 100, // 10 in production, 100 in development
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
        'RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

/**
 * Independent Rate Limiter for Static Code Analysis (/api/v1/analysis/static).
 * Enforces a separate quota of 30 requests per minute per IP address.
 */
export const staticAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many static analysis requests from this IP address. Please wait a moment before analyzing again.',
        'RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

/**
 * Independent Rate Limiter for Persistent Code Reviews (/api/v1/reviews).
 * Enforces a separate quota of 10 requests per minute per IP address.
 */
export const reviewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many review requests from this IP address. Please wait a moment before submitting again.',
        'RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

/**
 * Configurable Rate Limiter for Public Health Endpoints (/api/health, /api/v1/health).
 * Protects health check endpoints against DoS while permitting legitimate monitoring tools.
 * Defaults to 60 requests per minute per IP (configurable via HEALTH_RATE_LIMIT_MAX).
 */
export const healthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.HEALTH_RATE_LIMIT_MAX || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many health check requests from this IP address. Please slow down.',
        'RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

export default {
  authLimiter,
  staticAnalysisLimiter,
  reviewLimiter,
  healthLimiter
};

