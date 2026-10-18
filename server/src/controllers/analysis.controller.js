import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import { analyzeCode } from '../services/staticAnalyzer/index.js';

/**
 * Controller: Run Deterministic Static Code Analysis
 * POST /api/v1/analysis/static
 *
 * Strict Phase 7 Guarantees:
 * - Deterministic static analysis only (zero Gemini/LLM integration)
 * - Zero MongoDB persistence (results returned purely in volatile JSON response)
 * - Transient result marked with transient: true
 */
export const runStaticAnalysis = asyncHandler(async (req, res) => {
  const { code, language, fileName, title } = req.body;

  // Execute deterministic static analyzer engine
  const result = analyzeCode(code, language, { fileName, title });

  return new ApiResponse(
    200,
    result,
    'Static code analysis completed successfully',
    { engineVersion: '1.0.0-static' }
  ).send(res);
});

export default {
  runStaticAnalysis
};
