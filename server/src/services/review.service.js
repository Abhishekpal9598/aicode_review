/**
 * Review Lifecycle & Orchestration Service
 * server/src/services/review.service.js
 *
 * Coordinates the full persistent code review lifecycle:
 * 1. Independent secret redaction (secretRedaction.service.js)
 * 2. Deterministic static code analysis (staticAnalyzer/index.js)
 * 3. AI semantic review via Google Gemini (gemini.service.js)
 * 4. Mathematical scoring & Critical vulnerability ceiling enforcement
 * 5. Honest static fallback (zero fabricated metrics when AI is unavailable)
 * 6. Dual-mode atomic MongoDB persistence (reviewPersistence.service.js)
 * 7. Paginated history with ReDoS-safe search and strict tenant query enforcement
 * 8. Tenant-isolated deep dive inspection and cascade deletion
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import CodeReview from '../models/review.model.js';
import AnalysisResult from '../models/analysisResult.model.js';
import ReviewIssue from '../models/reviewIssue.model.js';
import { redactSecrets } from './secretRedaction.service.js';
import { analyzeCode } from './staticAnalyzer/index.js';
import { geminiService } from './gemini.service.js';
import { persistReviewAtomic } from './reviewPersistence.service.js';
import { fuseFindings, validateCandidateContent, compareFindingsTotal } from './hybridFusion.service.js';
import { getSecurityRuleById } from './staticAnalyzer/rules/security/index.js';
import { evaluateComplexity } from './staticAnalyzer/performance/index.js';

/**
 * Escapes special regex characters in user search input to prevent ReDoS attacks.
 *
 * @param {string} str - User search string
 * @returns {string} Escaped string safe for RegExp
 */
export function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Derives the letter grade from an overall score in [0, 100].
 *
 * @param {number} score - Overall score
 * @returns {'A' | 'B' | 'C' | 'D' | 'F'}
 */
export function gradeForScore(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Maps static analyzer category identifiers to ReviewIssue category enum values.
 *
 * @param {string} cat - Static rule category ('SEC', 'RISK', 'QUAL')
 * @returns {'security' | 'bug' | 'maintainability'}
 */
export function mapStaticCategory(cat) {
  switch (cat) {
    case 'SEC':
      return 'security';
    case 'RISK':
      return 'bug';
    case 'QUAL':
      return 'maintainability';
    default:
      return 'bug';
  }
}

/**
 * Executes a full code review with dual-engine evaluation and atomic persistence.
 *
 * @param {object} params
 * @param {string} params.code - Untrusted original source code
 * @param {string} params.language - Programming language ('c', 'cpp', 'java', 'python', 'javascript', 'typescript')
 * @param {string} [params.title] - Optional review title
 * @param {string} [params.fileName] - Optional filename
 * @param {string} [params.sourceType='pasted'] - Source type ('pasted' | 'upload')
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated user's ID
 * @param {object} [options={}] - Execution and testing overrides
 * @returns {Promise<{ review: object, analysis: object, issues: Array }>}
 */
export async function executeReview({ code, language, title, fileName, sourceType = 'pasted', userId }, options = {}) {
  const startTime = Date.now();

  // 1. Authenticated User Validation
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'A valid authenticated userId is required', 'INVALID_USER_ID');
  }
  const safeUserId = new mongoose.Types.ObjectId(userId);

  const safeCode = typeof code === 'string' ? code : '';
  const safeLang = (language || '').toLowerCase().trim();

  // 1. Pre-LLM Secret Redaction (Guarantees raw credentials NEVER enter AI client or external network)
  const { redactedCode, coordinateMapper } = redactSecrets(safeCode);

  // 2. Deterministic Static Analysis (Run on original code so secret-detection rules can identify patterns)
  const staticResult = analyzeCode(safeCode, safeLang, { fileName, title });
  const staticScore = staticResult.scoring.overallScore;
  const staticDeductions = Math.max(0, 100 - staticScore);

  // Check for Critical static findings for ceiling enforcement
  const hasCriticalStaticFinding = staticResult.findings.some((f) => f.severity === 'CRITICAL');

  const linesForCoords = safeCode.split(/\r?\n/);

  // Convert static findings into ReviewIssue format
  const staticIssues = staticResult.findings.map((f) => {
    const colStart = Math.max(1, f.columnStart || 1);
    let colEnd = Math.max(1, f.columnEnd || 1);
    if (f.lineStart === f.lineEnd && colEnd <= colStart) {
      const lineLen = (linesForCoords[f.lineStart - 1] || '').length;
      colEnd = Math.max(colStart + 1, lineLen + 1);
    }
    return {
      category: mapStaticCategory(f.category),
      severity: f.severity,
      title: f.title || f.name,
      description: f.explanation || f.description || f.title,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      columnStart: colStart,
      columnEnd: colEnd,
      originalSnippet: f.originalSnippet || '',
      suggestedSnippet: f.suggestedSnippet || '',
      explanation: f.explanation || '',
      ruleId: f.ruleId || null,
      source: 'static',
      cwe: f.cwe || null,
      owaspCategory: f.owaspCategory || null,
      confidence: f.confidence || null,
      remediation: f.remediation || ''
    };
  });

  // Deterministic Performance & Big-O Complexity Evaluation (Phase 10)
  const perfEval = evaluateComplexity(safeCode, safeLang);
  const performanceIssues = perfEval.findings.map((f) => {
    const colStart = 1;
    const lineLen = (linesForCoords[f.lineStart - 1] || '').length;
    const colEnd = f.lineStart === f.lineEnd ? Math.max(colStart + 1, lineLen + 1) : 1;
    return {
      category: 'performance',
      severity: f.severity,
      title: f.title,
      description: f.explanation || f.title,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      columnStart: colStart,
      columnEnd: colEnd,
      originalSnippet: f.originalSnippet || '',
      suggestedSnippet: f.suggestedSnippet || '',
      explanation: f.explanation || '',
      ruleId: f.ruleId || null,
      source: 'static',
      cwe: null,
      owaspCategory: null,
      confidence: f.confidence || 'HIGH',
      remediation: f.optimization || '',
      complexityEstimate: f.complexityEstimate || null
    };
  });

  const allStaticIssues = [...staticIssues, ...performanceIssues];

  // 3. AI Semantic Analysis via Google Gemini (Transmits ONLY redactedCode)
  let geminiResult = null;
  let aiError = null;

  try {
    const geminiClient = options.geminiClient !== undefined ? options.geminiClient : geminiService;
    geminiResult = await geminiClient.analyze(redactedCode, safeLang, options.geminiOptions || {});
  } catch (err) {
    aiError = err;
    logger.info(`AI analysis unavailable (${err.message}). Activating deterministic static fallback mode.`);
  }

  // 4. Scoring & Dual-Mode Normalization
  let overallScore;
  let grade;
  let reviewMode;
  let aiAvailable;
  let summary;
  let metrics;
  let timeComplexity;
  let spaceComplexity;
  let complexityType;
  let suggestedCode;
  let refactoringRationale;
  let finalIssues = [];
  let aiModelUsed = null;
  let aiModelTier = 'static-fallback';

  if (geminiResult) {
    // -------------------------------------------------------------------------
    // HYBRID MODE
    // -------------------------------------------------------------------------
    reviewMode = 'hybrid';
    aiAvailable = true;
    complexityType = 'ai-assisted';
    aiModelUsed = geminiResult.aiModelUsed || null;
    aiModelTier = geminiResult.aiModelTier || geminiResult.modelTier || 'primary';

    // Step 1: AI Composite Score
    const aiCompositeScore = geminiResult.aiCompositeScore;

    // Step 2: Base Hybrid Score (0.40 * static + 0.60 * aiComposite)
    const baseScore = Math.round(0.40 * staticScore + 0.60 * aiCompositeScore);

    // Step 3: Critical Vulnerability Ceiling (<= 74 if any Critical static finding)
    overallScore = hasCriticalStaticFinding ? Math.min(baseScore, 74) : baseScore;
    grade = gradeForScore(overallScore);

    summary = geminiResult.summary;
    timeComplexity = geminiResult.timeComplexity || perfEval.timeComplexity;
    spaceComplexity = geminiResult.spaceComplexity || perfEval.spaceComplexity;
    suggestedCode = geminiResult.suggestedCode;
    refactoringRationale = geminiResult.refactoringRationale;

    // Hybrid Security Finding Fusion & Normalization (Phase 9 Step 3)
    const activeMapper = geminiResult.coordinateMapper || coordinateMapper;
    const fusionResult = fuseFindings({
      staticFindings: allStaticIssues,
      aiFindings: geminiResult.issues || [],
      sourceCode: safeCode,
      redactedCode,
      coordinateMapper: activeMapper,
      language: safeLang
    });

    finalIssues = fusionResult.finalFindings;

    metrics = {
      bugScore: geminiResult.categoryScores.bugScore,
      securityScore: geminiResult.categoryScores.securityScore,
      performanceScore: geminiResult.categoryScores.performanceScore,
      maintainabilityScore: geminiResult.categoryScores.maintainabilityScore,
      aiCompositeScore,
      staticDeductions,
      issueCounts: {
        critical: finalIssues.filter((i) => i.severity === 'CRITICAL').length,
        high: finalIssues.filter((i) => i.severity === 'HIGH').length,
        medium: finalIssues.filter((i) => i.severity === 'MEDIUM').length,
        low: finalIssues.filter((i) => i.severity === 'LOW').length,
        info: finalIssues.filter((i) => i.severity === 'INFO').length
      }
    };
  } else {
    // -------------------------------------------------------------------------
    // STATIC FALLBACK MODE (Honest nulls, zero fabricated metrics)
    // -------------------------------------------------------------------------
    reviewMode = 'static-fallback';
    aiAvailable = false;
    overallScore = staticScore;
    grade = gradeForScore(staticScore);

    summary =
      'AI semantic analysis was unavailable. Review completed using deterministic static code analysis engine.';
    timeComplexity = perfEval.timeComplexity;
    spaceComplexity = perfEval.spaceComplexity;
    complexityType = perfEval.complexityType;
    suggestedCode = null;
    refactoringRationale = null;

    const rawLines = safeCode.split(/\r\n|\r|\n/);
    const validStaticIssues = [];
    for (const s of allStaticIssues) {
      const { isValid, sanitizedIssue } = validateCandidateContent(s, rawLines);
      if (isValid && sanitizedIssue) {
        validStaticIssues.push(sanitizedIssue);
      }
    }
    validStaticIssues.sort(compareFindingsTotal);
    finalIssues = validStaticIssues;

    metrics = {
      bugScore: null,
      securityScore: null,
      performanceScore: perfEval.metrics.performanceScore,
      maintainabilityScore: null,
      aiCompositeScore: null,
      staticDeductions,
      issueCounts: {
        critical: finalIssues.filter((i) => i.severity === 'CRITICAL').length,
        high: finalIssues.filter((i) => i.severity === 'HIGH').length,
        medium: finalIssues.filter((i) => i.severity === 'MEDIUM').length,
        low: finalIssues.filter((i) => i.severity === 'LOW').length,
        info: finalIssues.filter((i) => i.severity === 'INFO').length
      }
    };
  }

  // 5. Build Review & Analysis Documents
  const lines = safeCode.split(/\r?\n/);
  const lineCount = lines.length;
  const characterCount = safeCode.length;
  const fileSizeBytes = Buffer.byteLength(safeCode, 'utf8');

  const defaultTitle = fileName ? `Review of ${fileName}` : `${safeLang.toUpperCase()} Code Review`;

  const reviewData = {
    title: (title || defaultTitle).slice(0, 120),
    sourceType,
    filename: (fileName || 'snippet').slice(0, 120),
    language: safeLang,
    rawCode: redactedCode, // Only redacted code is stored!
    lineCount,
    characterCount,
    fileSizeBytes,
    status: 'completed',
    reviewMode,
    aiModelUsed,
    aiModelTier,
    staticScore,
    errorMessage: aiError ? aiError.message : null
  };

  const executionTimeMs = Math.max(1, Date.now() - startTime);

  const analysisData = {
    overallScore,
    grade,
    staticScore,
    aiAvailable,
    aiModelUsed,
    aiModelTier,
    summary,
    metrics,
    timeComplexity,
    spaceComplexity,
    complexityType,
    suggestedCode,
    refactoringRationale,
    executionTimeMs
  };

  // 6. Atomic MongoDB Persistence
  return persistReviewAtomic(
    {
      reviewData,
      analysisData,
      issuesData: finalIssues,
      userId: safeUserId
    },
    options.persistenceOptions || {}
  );
}

/**
 * Retrieves a paginated list of code reviews for the authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} query - Query parameters (page, limit, language, status, search)
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function getUserReviews(userId, query = {}) {
  const safeUserId = new mongoose.Types.ObjectId(userId);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { userId: safeUserId };

  if (query.language) {
    filter.language = query.language;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.search && typeof query.search === 'string' && query.search.trim().length > 0) {
    const escaped = escapeRegex(query.search.trim().slice(0, 100));
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { filename: { $regex: escaped, $options: 'i' } }
    ];
  }

  const [reviews, total] = await Promise.all([
    CodeReview.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CodeReview.countDocuments(filter)
  ]);

  // Load summary analysis for each review
  const reviewIds = reviews.map((r) => r._id);
  const analyses = await AnalysisResult.find({ reviewId: { $in: reviewIds }, userId: safeUserId }).lean();
  const analysisMap = new Map(analyses.map((a) => [a.reviewId.toString(), a]));

  const items = reviews.map((r) => ({
    ...r,
    analysis: analysisMap.get(r._id.toString()) || null
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

/**
 * Retrieves deep-dive review details strictly scoped to the authenticated user.
 *
 * @param {string} reviewId - Review ObjectId hex string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @returns {Promise<{ review: object, analysis: object, issues: Array } | null>}
 */
export async function getReviewById(reviewId, userId) {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  // Parallel tenant-scoped queries
  const [review, analysis, issues] = await Promise.all([
    CodeReview.findOne({ _id: safeReviewId, userId: safeUserId }).lean(),
    AnalysisResult.findOne({ reviewId: safeReviewId, userId: safeUserId }).lean(),
    ReviewIssue.find({ reviewId: safeReviewId, userId: safeUserId })
      .sort({ lineStart: 1, severity: 1 })
      .lean()
  ]);

  if (!review) {
    return null;
  }

  return {
    review,
    analysis,
    issues
  };
}

/**
 * Executes cascade deletion of a review and all associated analysis/issue records.
 *
 * @param {string} reviewId - Review ObjectId hex string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} [options={}] - Execution options
 * @returns {Promise<boolean>} True if deleted, false if not found or unauthorized
 */
export async function deleteReview(reviewId, userId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  // 1. Verify existence and tenant ownership
  const review = await CodeReview.findOne({ _id: safeReviewId, userId: safeUserId });
  if (!review) {
    return false;
  }

  // 2. Cascade delete policy (Revision 2.1 Section 6.4)
  const topologyType = mongoose.connection.client?.topology?.description?.type;
  const isReplicaOrSharded = topologyType ? (topologyType !== 'Single' && topologyType !== 'Unknown') : false;
  const useTx = options.useTransactions === true || (options.useTransactions !== false && !options.forceStandalone && isReplicaOrSharded);

  if (useTx) {
    const session = options.mockSession || (await mongoose.startSession());
    try {
      if (!options.mockSession) session.startTransaction();
      await ReviewIssue.deleteMany({ reviewId: safeReviewId, userId: safeUserId }, { session });
      await AnalysisResult.deleteMany({ reviewId: safeReviewId, userId: safeUserId }, { session });
      await CodeReview.deleteOne({ _id: safeReviewId, userId: safeUserId }, { session });
      if (!options.mockSession) await session.commitTransaction();
      return true;
    } catch (err) {
      if (!options.mockSession) {
        try {
          await session.abortTransaction();
        } catch {}
      }
      logger.error('Failed to cascade delete review in transaction', { error: err.message });
      throw new ApiError(500, 'Failed to cascade delete review', 'INTERNAL_SERVER_ERROR');
    } finally {
      if (!options.mockSession) {
        try {
          await session.endSession();
        } catch {}
      }
    }
  }

  // Standalone compensating deletion
  try {
    await ReviewIssue.deleteMany({ reviewId: safeReviewId, userId: safeUserId });
    await AnalysisResult.deleteMany({ reviewId: safeReviewId, userId: safeUserId });
    await CodeReview.deleteOne({ _id: safeReviewId, userId: safeUserId });
    return true;
  } catch (err) {
    logger.error('Failed to cascade delete review in standalone mode', { error: err.message });
    throw new ApiError(500, 'Failed to cascade delete review', 'INTERNAL_SERVER_ERROR');
  }
}

const OWASP_TOP_10_2021 = Object.freeze([
  'A01:2021-Broken Access Control',
  'A02:2021-Cryptographic Failures',
  'A03:2021-Injection',
  'A04:2021-Insecure Design',
  'A05:2021-Security Misconfiguration',
  'A06:2021-Vulnerable and Outdated Components',
  'A07:2021-Identification and Authentication Failures',
  'A08:2021-Software and Data Integrity Failures',
  'A09:2021-Security Logging and Monitoring Failures',
  'A10:2021-Server-Side Request Forgery'
]);

const SEVERITY_RANK = Object.freeze({
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1
});

/**
 * Retrieves dedicated security analysis details strictly scoped to the authenticated user.
 *
 * @param {string} reviewId - Review ObjectId hex string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} [query={}] - Optional query parameters (severity, source, owasp, cwe, sort)
 * @returns {Promise<object|null>} Security review data object or null if not found
 */
export async function getSecurityReview(reviewId, userId, query = {}) {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  // 1. Fetch review, analysis result, and security issues concurrently
  const [review, analysis, rawIssues] = await Promise.all([
    CodeReview.findOne({ _id: safeReviewId, userId: safeUserId }).lean(),
    AnalysisResult.findOne({ reviewId: safeReviewId, userId: safeUserId }).lean(),
    ReviewIssue.find({ reviewId: safeReviewId, userId: safeUserId, category: 'security' }).lean()
  ]);

  if (!review) {
    return null;
  }

  // 3. Derive security score and grade using authoritative gradeForScore
  let securityScore = null;
  let securityGrade = null;
  if (analysis && analysis.metrics && typeof analysis.metrics.securityScore === 'number') {
    securityScore = analysis.metrics.securityScore;
    securityGrade = gradeForScore(securityScore);
  }

  // 4. Dynamic metadata enrichment (zero fabricated values for AI or unregistered rules)
  const enrichedIssues = rawIssues.map((issue) => {
    let cwe = null;
    let owaspCategory = null;
    let confidence = null;
    let remediation = null;

    if (issue.ruleId) {
      const rule = getSecurityRuleById(issue.ruleId);
      if (rule) {
        cwe = rule.cwe || null;
        owaspCategory = rule.owaspCategory || null;
        confidence = rule.confidence || null;
        remediation = rule.remediation || null;
      }
    }

    return {
      ...issue,
      cwe,
      owaspCategory,
      confidence,
      remediation
    };
  });

  // 5. Pre-filter telemetry calculation and conservation invariants
  const totalSecurityIssues = enrichedIssues.length;

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  const sourceCounts = {
    static: 0,
    gemini: 0,
    hybrid: 0
  };

  const owaspDistribution = {};
  for (const cat of OWASP_TOP_10_2021) {
    owaspDistribution[cat] = 0;
  }
  owaspDistribution['Uncategorized'] = 0;

  const cweDistribution = {};

  for (const issue of enrichedIssues) {
    if (severityCounts[issue.severity] !== undefined) {
      severityCounts[issue.severity]++;
    }

    if (sourceCounts[issue.source] !== undefined) {
      sourceCounts[issue.source]++;
    }

    if (issue.owaspCategory && owaspDistribution[issue.owaspCategory] !== undefined) {
      owaspDistribution[issue.owaspCategory]++;
    } else {
      owaspDistribution['Uncategorized']++;
    }

    if (issue.cwe) {
      cweDistribution[issue.cwe] = (cweDistribution[issue.cwe] || 0) + 1;
    } else {
      cweDistribution['Uncategorized'] = (cweDistribution['Uncategorized'] || 0) + 1;
    }
  }

  const hasCriticalVulnerability = severityCounts.CRITICAL > 0;

  // 6. Query filtering
  let filteredIssues = enrichedIssues;

  if (query.severity) {
    const targetSeverity = query.severity.toUpperCase();
    filteredIssues = filteredIssues.filter((issue) => issue.severity === targetSeverity);
  }

  if (query.source) {
    const targetSource = query.source.toLowerCase();
    filteredIssues = filteredIssues.filter((issue) => issue.source === targetSource);
  }

  if (query.cwe) {
    const targetCwe = query.cwe.toUpperCase();
    filteredIssues = filteredIssues.filter(
      (issue) => issue.cwe && issue.cwe.toUpperCase() === targetCwe
    );
  }

  if (query.owasp) {
    const targetOwasp = query.owasp.trim().toLowerCase();
    filteredIssues = filteredIssues.filter(
      (issue) => issue.owaspCategory && issue.owaspCategory.toLowerCase().includes(targetOwasp)
    );
  }

  const filteredCount = filteredIssues.length;

  // 7. Deterministic multi-tier sorting with a._id.toString().localeCompare(b._id.toString()) tie-breaker
  const sortMode = query.sort || 'severity_desc';

  filteredIssues.sort((a, b) => {
    const aRank = SEVERITY_RANK[a.severity] || 0;
    const bRank = SEVERITY_RANK[b.severity] || 0;

    if (sortMode === 'severity_asc') {
      const rankDiff = aRank - bRank;
      if (rankDiff !== 0) return rankDiff;
      if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
      if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
      return a._id.toString().localeCompare(b._id.toString());
    }

    if (sortMode === 'line_asc') {
      if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
      if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
      const rankDiff = bRank - aRank;
      if (rankDiff !== 0) return rankDiff;
      return a._id.toString().localeCompare(b._id.toString());
    }

    if (sortMode === 'line_desc') {
      if (a.lineStart !== b.lineStart) return b.lineStart - a.lineStart;
      if (a.columnStart !== b.columnStart) return b.columnStart - a.columnStart;
      const rankDiff = bRank - aRank;
      if (rankDiff !== 0) return rankDiff;
      return a._id.toString().localeCompare(b._id.toString());
    }

    // Default: severity_desc
    const rankDiff = bRank - aRank;
    if (rankDiff !== 0) return rankDiff;
    if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
    if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
    return a._id.toString().localeCompare(b._id.toString());
  });

  return {
    reviewId: review._id.toString(),
    securityScore,
    securityGrade,
    hasCriticalVulnerability,
    totalSecurityIssues,
    filteredCount,
    severityCounts,
    sourceCounts,
    owaspDistribution,
    cweDistribution,
    issues: filteredIssues
  };
}

/**
 * Retrieves dedicated performance analysis details strictly scoped to the authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} reviewId - Target review ObjectId
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} [query={}] - Optional filters (severity, source, sort)
 * @returns {Promise<object|null>} Performance analysis payload or null if not found
 */
export async function getPerformanceReview(reviewId, userId, query = {}) {
  // 1. Authenticated tenant & reviewId validation
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'A valid authenticated userId is required', 'INVALID_USER_ID');
  }
  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'A valid reviewId is required', 'INVALID_REVIEW_ID');
  }

  const safeUserId = new mongoose.Types.ObjectId(userId);
  const safeReviewId = new mongoose.Types.ObjectId(reviewId);

  // 1. Fetch review, analysis result, and performance issues concurrently
  const [review, analysis, rawIssues] = await Promise.all([
    CodeReview.findOne({ _id: safeReviewId, userId: safeUserId }).lean(),
    AnalysisResult.findOne({ reviewId: safeReviewId, userId: safeUserId }).lean(),
    ReviewIssue.find({ reviewId: safeReviewId, userId: safeUserId, category: 'performance' }).lean()
  ]);

  if (!review) {
    return null;
  }

  // 3. Fallback evaluation if review was generated prior to Phase 10 or issues empty
  let evaluated = null;
  if (review.rawCode) {
    evaluated = evaluateComplexity(review.rawCode, review.language);
  }

  // 4. Derive performance scores and complexities
  let performanceScore = 100;
  if (analysis && analysis.metrics && typeof analysis.metrics.performanceScore === 'number') {
    performanceScore = analysis.metrics.performanceScore;
  } else if (evaluated) {
    performanceScore = evaluated.metrics.performanceScore;
  }
  const performanceGrade = gradeForScore(performanceScore);

  const timeComplexity = analysis?.timeComplexity || evaluated?.timeComplexity || 'O(1)';
  const spaceComplexity = analysis?.spaceComplexity || evaluated?.spaceComplexity || 'O(1)';
  const complexityType = analysis?.complexityType || (analysis?.aiAvailable ? 'ai-assisted' : (evaluated?.complexityType || 'deterministic'));

  // If rawIssues is empty and evaluated produced findings, dynamically enrich issues
  let enrichedIssues = rawIssues;
  if (enrichedIssues.length === 0 && evaluated && evaluated.findings.length > 0) {
    enrichedIssues = evaluated.findings.map((f) => ({
      _id: new mongoose.Types.ObjectId(),
      reviewId: safeReviewId,
      analysisResultId: analysis?._id || new mongoose.Types.ObjectId(),
      userId: safeUserId,
      category: 'performance',
      severity: f.severity,
      title: f.title,
      description: f.explanation,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      columnStart: 1,
      columnEnd: 1,
      originalSnippet: f.originalSnippet,
      suggestedSnippet: f.suggestedSnippet,
      explanation: f.explanation,
      ruleId: f.ruleId,
      source: 'static',
      cwe: null,
      owaspCategory: null,
      confidence: f.confidence || 'HIGH',
      remediation: f.optimization || '',
      complexityEstimate: f.complexityEstimate || null,
      createdAt: review.createdAt || new Date()
    }));
  }

  // 5. Pre-filter telemetry calculation
  const totalPerformanceIssues = enrichedIssues.length;

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  const sourceCounts = {
    static: 0,
    gemini: 0,
    hybrid: 0
  };

  const complexityDistribution = {};

  for (const issue of enrichedIssues) {
    if (severityCounts[issue.severity] !== undefined) {
      severityCounts[issue.severity]++;
    }
    if (sourceCounts[issue.source] !== undefined) {
      sourceCounts[issue.source]++;
    }
    const cEst = issue.complexityEstimate || 'Unspecified';
    complexityDistribution[cEst] = (complexityDistribution[cEst] || 0) + 1;
  }

  // 6. Query filtering
  let filteredIssues = enrichedIssues;
  if (query.severity) {
    const targetSeverity = query.severity.toUpperCase();
    filteredIssues = filteredIssues.filter((issue) => issue.severity === targetSeverity);
  }
  if (query.source) {
    const targetSource = query.source.toLowerCase();
    filteredIssues = filteredIssues.filter((issue) => issue.source === targetSource);
  }

  const filteredCount = filteredIssues.length;

  // 7. Deterministic sorting
  const SEVERITY_SORT_RANK = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
  const sortMode = query.sort || 'severity_desc';

  filteredIssues.sort((a, b) => {
    const aRank = SEVERITY_SORT_RANK[a.severity] ?? 0;
    const bRank = SEVERITY_SORT_RANK[b.severity] ?? 0;

    if (sortMode === 'severity_asc') {
      const rankDiff = aRank - bRank;
      if (rankDiff !== 0) return rankDiff;
      if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
      return a._id.toString().localeCompare(b._id.toString());
    }

    if (sortMode === 'line_asc') {
      if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
      const rankDiff = bRank - aRank;
      if (rankDiff !== 0) return rankDiff;
      return a._id.toString().localeCompare(b._id.toString());
    }

    if (sortMode === 'line_desc') {
      if (a.lineStart !== b.lineStart) return b.lineStart - a.lineStart;
      const rankDiff = bRank - aRank;
      if (rankDiff !== 0) return rankDiff;
      return a._id.toString().localeCompare(b._id.toString());
    }

    // Default: severity_desc
    const rankDiff = bRank - aRank;
    if (rankDiff !== 0) return rankDiff;
    if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
    return a._id.toString().localeCompare(b._id.toString());
  });

  return {
    reviewId: review._id.toString(),
    title: review.title,
    language: review.language,
    performanceScore,
    performanceGrade,
    timeComplexity,
    spaceComplexity,
    complexityType,
    confidence: evaluated?.confidence || 'HIGH',
    hasCriticalBottleneck: severityCounts.CRITICAL > 0,
    totalPerformanceIssues,
    filteredCount,
    severityCounts,
    sourceCounts,
    complexityDistribution,
    suggestedCode: analysis?.suggestedCode || null,
    refactoringRationale: analysis?.refactoringRationale || null,
    summary: analysis?.summary || evaluated?.summary || 'Performance evaluation completed.',
    issues: filteredIssues
  };
}

/**
 * Persists an applied fix to an existing review record while strictly preserving original rawCode.
 *
 * @param {string} reviewId - Review ObjectId hex string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} fixData - Fix details (issueId, ruleId, lineStart, lineEnd, previousSnippet, appliedSnippet, updatedCode)
 * @returns {Promise<{ review: object, appliedFix: object } | null>}
 */
export async function applyFixToReview(reviewId, userId, fixData) {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  const review = await CodeReview.findOne({ _id: safeReviewId, userId: safeUserId });
  if (!review) {
    return null;
  }

  if (fixData.lineStart < 1 || fixData.lineEnd < fixData.lineStart) {
    throw new ApiError(400, 'Invalid line coordinates for applied fix', 'INVALID_LINE_COORDINATES');
  }

  const appliedRecord = {
    issueId: fixData.issueId && mongoose.Types.ObjectId.isValid(fixData.issueId)
      ? new mongoose.Types.ObjectId(fixData.issueId)
      : null,
    ruleId: fixData.ruleId || null,
    lineStart: fixData.lineStart,
    lineEnd: fixData.lineEnd,
    previousSnippet: fixData.previousSnippet || '',
    appliedSnippet: fixData.appliedSnippet || '',
    appliedAt: new Date()
  };

  if (!Array.isArray(review.appliedFixes)) {
    review.appliedFixes = [];
  }

  review.appliedFixes.push(appliedRecord);
  review.currentCode = fixData.updatedCode;

  await review.save();

  return {
    review: review.toObject ? review.toObject() : review,
    appliedFix: appliedRecord
  };
}

/**
 * Reverts the most recent applied fix on an existing review while strictly preserving original rawCode.
 *
 * @param {string} reviewId - Review ObjectId hex string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {object} [options={}] - Optional restoredCode string
 * @returns {Promise<{ review: object, undoneFix: object } | null>}
 */
export async function undoFixOnReview(reviewId, userId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  const review = await CodeReview.findOne({ _id: safeReviewId, userId: safeUserId });
  if (!review) {
    return null;
  }

  if (!Array.isArray(review.appliedFixes) || review.appliedFixes.length === 0) {
    throw new ApiError(400, 'No applied fixes to undo on this review', 'NO_FIXES_TO_UNDO');
  }

  const undoneFix = review.appliedFixes.pop();

  if (typeof options.restoredCode === 'string') {
    review.currentCode = options.restoredCode;
  } else if (review.appliedFixes.length === 0) {
    review.currentCode = null;
  }

  await review.save();

  return {
    review: review.toObject ? review.toObject() : review,
    undoneFix: undoneFix.toObject ? undoneFix.toObject() : undoneFix
  };
}

export default {
  escapeRegex,
  gradeForScore,
  mapStaticCategory,
  executeReview,
  getUserReviews,
  getReviewById,
  getSecurityReview,
  getPerformanceReview,
  applyFixToReview,
  undoFixOnReview,
  deleteReview
};


