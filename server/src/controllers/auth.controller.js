import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDBStatus } from '../config/db.js';
import User from '../models/user.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Helper to ensure database is connected before DB operations.
 */
const assertDatabaseConnected = () => {
  const dbStatus = getDBStatus();
  if (!dbStatus.connected) {
    throw ApiError.serviceUnavailable(
      'Database service is currently unavailable. Please try again later.',
      'DATABASE_UNAVAILABLE'
    );
  }
};

/**
 * Configure standard cookie options for access_token.
 * Uses sameSite: 'none' in production to allow cross-origin API calls (Vercel client -> Render backend),
 * and sameSite: 'lax' in development for secure localhost transmission.
 */
const getCookieOptions = () => {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000 // 15 minutes
  };
};

/**
 * POST /api/v1/auth/register
 * Public registration for developer accounts.
 */
export const register = asyncHandler(async (req, res) => {
  assertDatabaseConnected();

  const { name, email, password } = req.body;

  // Check for duplicate account
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict(
      'An account with this email address already exists.',
      'EMAIL_ALREADY_EXISTS'
    );
  }

  // Hash password using bcrypt (work factor 12)
  const passwordHash = await bcrypt.hash(password, 12);

  // Persist user record
  const user = await User.create({
    name,
    email,
    passwordHash
  });

  return new ApiResponse(
    201,
    { user: user.toSafeJSON() },
    'Account registered successfully.'
  ).send(res);
});

/**
 * POST /api/v1/auth/login
 * Public login verifying credentials and setting HttpOnly cookie.
 */
export const login = asyncHandler(async (req, res) => {
  assertDatabaseConnected();

  const { email, password } = req.body;

  // Retrieve user with passwordHash included
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  // Compare password hash
  const isMatch = await user.isPasswordMatch(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  // Sign stateless JWT with explicit HS256 algorithm and tokenVersion
  const token = jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256'
    }
  );

  // Set secure HttpOnly cookie
  res.cookie('access_token', token, getCookieOptions());

  return new ApiResponse(
    200,
    {
      user: user.toSafeJSON(),
      token
    },
    'Logged in successfully.'
  ).send(res);
});

/**
 * POST /api/v1/auth/logout
 * Authenticated logout: invalidates server-side token session via tokenVersion increment and clears HttpOnly cookie.
 */
export const logout = asyncHandler(async (req, res) => {
  assertDatabaseConnected();

  // Invalidate all tokens for this user on logout
  if (req.user && req.user._id) {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  }

  res.clearCookie('access_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });

  return new ApiResponse(
    200,
    { message: 'Logged out successfully.' },
    'Logged out successfully.'
  ).send(res);
});

/**
 * PUT /api/v1/auth/password
 * Authenticated password update.
 * Verifies current password, updates hash, increments tokenVersion,
 * and issues a fresh token for the current session.
 */
export const changePassword = asyncHandler(async (req, res) => {
  assertDatabaseConnected();

  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('User not found.', 'USER_NOT_FOUND');
  }

  const isMatch = await user.isPasswordMatch(currentPassword);
  if (!isMatch) {
    throw ApiError.unauthorized('Incorrect current password.', 'INVALID_CREDENTIALS');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = newHash;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Issue fresh token with updated tokenVersion for the active session
  const token = jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256'
    }
  );

  res.cookie('access_token', token, getCookieOptions());

  return new ApiResponse(
    200,
    {
      user: user.toSafeJSON(),
      token
    },
    'Password changed successfully.'
  ).send(res);
});

/**
 * GET /api/v1/auth/me
 * Authenticated profile retrieval for session verification.
 */
export const getMe = asyncHandler(async (req, res) => {
  return new ApiResponse(
    200,
    { user: req.user.toSafeJSON() },
    'Current user profile retrieved successfully.'
  ).send(res);
});

export default {
  register,
  login,
  logout,
  changePassword,
  getMe
};
