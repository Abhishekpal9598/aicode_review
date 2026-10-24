import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { isOriginAllowed } from '../config/cors.js';
import { getDBStatus } from '../config/db.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Authentication & Session Verification Middleware.
 * Verifies JWT access token from HttpOnly cookie or Authorization Bearer header.
 * Enforces CSRF defense-in-depth on cookie-authenticated unsafe HTTP methods.
 * Attaches the authenticated Mongoose user model to req.user and req.userId.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;
  let isCookieAuth = false;

  // 1. Check HttpOnly cookie first
  if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
    isCookieAuth = true;
  }
  // 2. Fall back to Authorization: Bearer <token> header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw ApiError.unauthorized(
      'Authentication required. No access token provided.',
      'AUTH_TOKEN_MISSING'
    );
  }

  // 3. CSRF Protection for Cookie-Based Unsafe Requests (POST, PUT, DELETE, PATCH)
  if (isCookieAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
    const customHeader = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // A. If Origin is present, it MUST be an allowed origin
    if (origin) {
      if (!isOriginAllowed(origin)) {
        throw ApiError.forbidden(
          'CSRF validation failed: untrusted origin.',
          'CSRF_VALIDATION_FAILED'
        );
      }
    }
    // B. If Origin is absent, verify Referer or require custom header
    else {
      let isRefererAllowed = false;
      if (referer) {
        try {
          const refererOrigin = new URL(referer).origin;
          isRefererAllowed = isOriginAllowed(refererOrigin);
        } catch {
          isRefererAllowed = false;
        }
      }

      const hasValidHeader = customHeader === 'XMLHttpRequest';
      if (!isRefererAllowed && !hasValidHeader) {
        throw ApiError.forbidden(
          'CSRF validation failed: missing custom request header or untrusted origin.',
          'CSRF_VALIDATION_FAILED'
        );
      }
    }
  }

  // 4. Verify JWT signature & expiration with strict HS256 algorithm restriction
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Authentication token has expired.', 'AUTH_TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Authentication token is invalid.', 'AUTH_TOKEN_INVALID');
  }

  // 5. Verify payload structure
  if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
    throw ApiError.unauthorized('Authentication token is invalid.', 'AUTH_TOKEN_INVALID');
  }

  // 6. Verify database availability
  const dbStatus = getDBStatus();
  if (!dbStatus.connected) {
    throw ApiError.serviceUnavailable(
      'Database service is currently unavailable. Please try again later.',
      'DATABASE_UNAVAILABLE'
    );
  }

  // 7. Fetch user from database
  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized(
      'The user belonging to this token no longer exists.',
      'USER_NOT_FOUND'
    );
  }

  // 7b. Server-side token invalidation check via tokenVersion strategy
  const currentTokenVersion = user.tokenVersion ?? 0;
  const tokenVersionInPayload = decoded.tokenVersion ?? 0;
  if (tokenVersionInPayload !== currentTokenVersion) {
    throw ApiError.unauthorized(
      'Authentication token has been invalidated. Please log in again.',
      'AUTH_TOKEN_INVALIDATED'
    );
  }

  // 8. Attach authenticated user and userId strictly from verified token
  req.user = user;
  req.userId = user._id;

  next();
});

/**
 * Role-Based Access Control (RBAC) Authorization Middleware.
 * Enforces that the authenticated user possesses one of the allowed roles.
 * Must be used after the `authenticate` middleware.
 *
 * @param {...string} allowedRoles - Roles permitted to access the route (e.g. 'lead', 'admin')
 * @returns {Function} Express middleware function
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required.', 'AUTH_TOKEN_MISSING');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        'You do not have permission to access this resource.',
        'FORBIDDEN'
      );
    }

    next();
  };
};

export default authenticate;
