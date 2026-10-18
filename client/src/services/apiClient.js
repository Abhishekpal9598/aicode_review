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
  async request(endpoint, options = {}) {
    const url = resolveUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers
    };

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
    return this.post('/v1/auth/register', userData);
  }

  async login(credentials) {
    return this.post('/v1/auth/login', credentials);
  }

  async logout() {
    return this.post('/v1/auth/logout');
  }

  async getCurrentUser() {
    return this.get('/v1/auth/me');
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
}

export const apiClient = new ApiClient();
export default apiClient;

