/**
 * Legacy API client — kept for backward compatibility with dead-code legacy pages.
 *
 * SECURITY NOTE: This file no longer reads tokens from localStorage.
 * All authentication is handled via HttpOnly cookies (credentials: 'include').
 * The active application uses apiClient.js which implements the dual-channel
 * HttpOnly cookie + Bearer sessionStorage architecture.
 *
 * localStorage-based token storage was REMOVED (Phase 13 security hardening)
 * because localStorage is accessible to any JavaScript running in the same origin,
 * making tokens vulnerable to XSS attacks.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true  // Transmit HttpOnly cookies automatically
});

// No localStorage.getItem('token') — tokens travel via HttpOnly cookie only.

export default api;
