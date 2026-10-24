/**
 * Centralized API Client for AI Code Review Platform
 * Handles base URL normalization, error mapping, network fault resilience,
 * and automatic HttpOnly cookie transmission via credentials: 'include'.
 */

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

/**
 * Safely resolves an API endpoint without duplicating '/api' prefix.
 * Example: BASE_URL = "/api", endpoint = "/health" -> "/api/health"
 * Example: BASE_URL = "/api", endpoint = "/api/health" -> "/api/health"
 * Example: BASE_URL = "/api", endpoint = "/v1/auth/me" -> "/api/v1/auth/me"
 */
export const resolveUrl = (endpoint) => {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4); // strip leading redundant '/api'
  }
  return `${BASE_URL}${cleanEndpoint}`;
};

class ApiClient {
  constructor() {
    this.token = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        this.token = window.sessionStorage.getItem('auth_token') || null;
      } catch {
        this.token = null;
      }
    }
  }

  setToken(token) {
    this.token = token || null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        if (token) {
          window.sessionStorage.setItem('auth_token', token);
        } else {
          window.sessionStorage.removeItem('auth_token');
        }
      } catch {
        // Ignore storage access errors in restricted contexts
      }
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const url = resolveUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      credentials: 'include', // Automatically transmit and store HttpOnly cookies
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalidated; clear client token cache
          this.setToken(null);
        }
        const error = new Error(
          (data && data.error?.message) ||
          (data && data.message) ||
          `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.code = data?.error?.code || 'HTTP_ERROR';
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        // Network failure / connection refused
        const networkError = new Error(
          'Unable to connect to the backend API server. Please check your network or server status.'
        );
        networkError.status = 0;
        networkError.code = 'NETWORK_UNAVAILABLE';
        networkError.originalError = err;
        throw networkError;
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Health check query specifically targeting GET /api/health
   */
  async checkHealth() {
    return this.get('/health');
  }

  /**
   * Phase 4: Authentication Helper Methods
   */
  async register(userData) {
    const res = await this.post('/v1/auth/register', userData);
    if (res && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async login(credentials) {
    const res = await this.post('/v1/auth/login', credentials);
    if (res && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async logout() {
    try {
      return await this.post('/v1/auth/logout');
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.get('/v1/auth/me');
  }

  async changePassword(passwordData) {
    const res = await this.put('/v1/auth/password', passwordData);
    if (res && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  /**
   * Phase 5: Fetch user dashboard statistics.
   * Resolves to the ApiResponse payload:
   * { success: true, message: string, data: { overview, scoreHistory, languageDistribution, recentReviews }, meta: { timestamp } }
   */
  async getUserStats() {
    return this.get('/v1/users/stats');
  }

  /**
   * Phase 2/5: Fetch versioned health telemetry with database status.
   * When DB connected: HTTP 200 with { success: true, message: string, status: 'healthy', database: { connected: true }, timestamp: string }
   * When DB disconnected: HTTP 503 with { success: false, message: string, status: 'degraded', database: { connected: false }, timestamp: string }
   */
  async getV1Health() {
    return this.get('/v1/health');
  }

  /**
   * Phase 7: Deterministic Static Code Analysis
   * Sends source code payload to POST /api/v1/analysis/static.
   *
   * @param {{ code: string, language: string, fileName?: string, title?: string }} payload
   * @returns {Promise<object>} ApiResponse with transient: true, metrics, scoring, findings
   */
  async analyzeCode(payload) {
    return this.post('/v1/analysis/static', payload);
  }

  /**
   * Phase 8: Persistent AI-Powered Code Review
   * Submits source code for dual static and Gemini AI analysis and atomic persistence.
   * POST /api/v1/reviews
   *
   * @param {{ code: string, language: string, title?: string, fileName?: string, sourceType?: string }} payload
   * @returns {Promise<object>} ApiResponse with { review, analysis, issues }
   */
  async createReview(payload) {
    return this.post('/v1/reviews', payload);
  }

  /**
   * Phase 8: Paginated Code Review History
   * Retrieves list of saved reviews with optional filtering and ReDoS-safe search.
   * GET /api/v1/reviews
   *
   * @param {object} [params={}]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.language]
   * @param {string} [params.status]
   * @param {string} [params.search]
   * @returns {Promise<object>} ApiResponse with { data: items, meta: { pagination } }
   */
  async getReviews(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.language) query.set('language', params.language);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const queryString = query.toString();
    const endpoint = queryString ? `/v1/reviews?${queryString}` : '/v1/reviews';
    return this.get(endpoint);
  }

  /**
   * Phase 8: Deep-Dive Review Inspection
   * Retrieves full details, analysis result, and child issues for a specific review.
   * GET /api/v1/reviews/:id
   *
   * @param {string} id - Review ObjectId
   * @returns {Promise<object>} ApiResponse with { review, analysis, issues }
   */
  async getReviewById(id) {
    return this.get(`/v1/reviews/${id}`);
  }

  /**
   * Phase 8: Cascade Review Deletion
   * Deletes review and child analysis and issues records.
   * DELETE /api/v1/reviews/:id
   *
   * @param {string} id - Review ObjectId
   * @returns {Promise<object>} ApiResponse with { success: true, message: string }
   */
  async deleteReview(id) {
    return this.delete(`/v1/reviews/${id}`);
  }

  /**
   * Phase 9: Dedicated Security Analysis Retrieval
   * Retrieves security findings, OWASP & CWE distributions, and telemetry.
   * GET /api/v1/reviews/:id/security
   *
   * @param {string} id - Review ObjectId (24-hex characters)
   * @param {object} [params={}] - Optional query filters
   * @param {string} [params.severity] - 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
   * @param {string} [params.source] - 'static' | 'gemini' | 'hybrid'
   * @param {string} [params.cwe] - CWE identifier (e.g. 'CWE-89')
   * @param {string} [params.owasp] - OWASP substring (e.g. 'A03')
   * @param {string} [params.sort] - 'severity_desc' | 'severity_asc' | 'line_asc' | 'line_desc'
   * @returns {Promise<object>} ApiResponse with security review payload
   */
  async getSecurityReview(id, params = {}) {
    const query = new URLSearchParams();
    if (params.severity) query.set('severity', params.severity);
    if (params.source) query.set('source', params.source);
    if (params.cwe) query.set('cwe', params.cwe);
    if (params.owasp) query.set('owasp', params.owasp);
    if (params.sort) query.set('sort', params.sort);

    const queryString = query.toString();
    const endpoint = queryString
      ? `/v1/reviews/${id}/security?${queryString}`
      : `/v1/reviews/${id}/security`;

    return this.get(endpoint);
  }

  /**
   * Phase 10: Dedicated Performance & Big-O Analysis Retrieval
   * Retrieves algorithmic performance telemetry, Big-O metrics, and bottleneck findings.
   * GET /api/v1/reviews/:id/performance
   *
   * @param {string} id - Review ObjectId (24-hex characters)
   * @param {object} [params={}] - Optional query filters
   * @param {string} [params.severity] - 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
   * @param {string} [params.source] - 'static' | 'gemini' | 'hybrid'
   * @param {string} [params.sort] - 'severity_desc' | 'severity_asc' | 'line_asc' | 'line_desc'
   * @returns {Promise<object>} ApiResponse with performance review payload
   */
  async getPerformanceReview(id, params = {}) {
    const query = new URLSearchParams();
    if (params.severity) query.set('severity', params.severity);
    if (params.source) query.set('source', params.source);
    if (params.sort) query.set('sort', params.sort);

    const queryString = query.toString();
    const endpoint = queryString
      ? `/v1/reviews/${id}/performance?${queryString}`
      : `/v1/reviews/${id}/performance`;

    return this.get(endpoint);
  }

  /**
   * Phase 11: Apply Fix to Review
   * Persists an applied fix to an existing review record while preserving rawCode.
   * POST /api/v1/reviews/:id/apply-fix
   *
   * @param {string} id - Review ObjectId
   * @param {object} fixData - { issueId?, ruleId?, lineStart, lineEnd, previousSnippet?, appliedSnippet, updatedCode }
   * @returns {Promise<object>} ApiResponse
   */
  async applyFix(id, fixData) {
    return this.post(`/v1/reviews/${id}/apply-fix`, fixData);
  }

  /**
   * Phase 11: Undo Fix on Review
   * Reverts the most recent applied fix on a review.
   * POST /api/v1/reviews/:id/undo-fix
   *
   * @param {string} id - Review ObjectId
   * @param {object} [data={}] - Optional restoredCode
   * @returns {Promise<object>} ApiResponse
   */
  async undoFix(id, data = {}) {
    return this.post(`/v1/reviews/${id}/undo-fix`, data);
  }

  /**
   * Phase 13: Export Review Audit Report
   * GET /api/v1/reviews/:id/export?format=json|markdown
   *
   * @param {string} id - Review ObjectId
   * @param {'json' | 'markdown'} [format='json'] - Desired format
   * @returns {Promise<object|string>} JSON export object or Markdown text string
   */
  async exportReview(id, format = 'json') {
    return this.get(`/v1/reviews/${id}/export?format=${format}`);
  }
}

export const apiClient = new ApiClient();
export default apiClient;


