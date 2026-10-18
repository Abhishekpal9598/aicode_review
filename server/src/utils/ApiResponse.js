export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {any} data - Response payload data
   * @param {string} message - Informational message
   * @param {object} meta - Optional metadata (pagination, timestamp, etc.)
   */
  constructor(statusCode = 200, data = null, message = 'Success', meta = {}) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.message = message;
    if (data !== null) {
      this.data = data;
    }
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta
    };
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      ...(this.data !== null && { data: this.data }),
      meta: this.meta
    });
  }
}

export default ApiResponse;
