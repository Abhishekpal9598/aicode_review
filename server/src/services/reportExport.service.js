/**
 * Audit Report & Multi-Format Serialization Service
 * server/src/services/reportExport.service.js
 *
 * Coordinates data aggregation and serialization for code review audit reports:
 * 1. Tenant-isolated review, analysis result, and issue retrieval
 * 2. Dynamic security metadata enrichment (CWE, OWASP Top 10, confidence, remediation)
 * 3. Algorithmic complexity evaluation & bottleneck synthesis
 * 4. Structured JSON serialization (sanitized, zero internal/secret data exposure)
 * 5. GitHub-Flavored Markdown (GFM) document formatting
 */

import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import CodeReview from '../models/review.model.js';
import AnalysisResult from '../models/analysisResult.model.js';
import ReviewIssue from '../models/reviewIssue.model.js';
import { getSecurityRuleById } from './staticAnalyzer/rules/security/index.js';
import { evaluateComplexity } from './staticAnalyzer/performance/index.js';

/**
 * Computes line-based additions and deletions between two code versions.
 *
 * @param {string} original - Original code string
 * @param {string} modified - Modified code string
 * @returns {{ addedLines: number, removedLines: number, unchangedLines: number }}
 */
export function computeDiffLineStats(original = '', modified = '') {
  const origLines = (original || '').split('\n');
  const modLines = (modified || '').split('\n');

  const origSet = new Set(origLines);
  const modSet = new Set(modLines);

  let addedLines = 0;
  for (const line of modLines) {
    if (!origSet.has(line)) addedLines++;
  }

  let removedLines = 0;
  for (const line of origLines) {
    if (!modSet.has(line)) removedLines++;
  }

  const unchangedLines = modLines.length - addedLines;

  return {
    addedLines,
    removedLines,
    unchangedLines: Math.max(0, unchangedLines)
  };
}

/**
 * Formats a comprehensive GitHub Flavored Markdown (GFM) audit report.
 *
 * @param {object} exportData - Aggregated review and analysis data
 * @returns {string} Formatted Markdown content
 */
export function formatMarkdownReport(exportData) {
  const { review, qualityScore, algorithmicComplexity, summary, severityBreakdown, findings, appliedFixes, code } = exportData;

  const dateStr = review.createdAt ? new Date(review.createdAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'N/A';
  const exportDateStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  let md = `# AI Code Review — Audit & Security Inspection Report\n\n`;

  // Metadata blockquote
  const engineDetails = review.reviewMode === 'hybrid'
    ? `Hybrid Mode (${review.aiModelTier === 'fallback' ? 'Fallback' : 'Primary'} Model: \`${review.aiModelUsed || 'Gemini'}\`)`
    : 'Deterministic Static Fallback Mode';
  md += `> **Target File:** \`${review.filename}\` (\`${review.language}\`)  \n`;
  md += `> **Review ID:** \`${review.id}\`  \n`;
  md += `> **Engine Mode:** ${engineDetails}  \n`;
  md += `> **Audit Executed:** ${dateStr}  \n`;
  md += `> **Report Exported:** ${exportDateStr}  \n`;
  md += `> **Overall Quality:** **Grade ${qualityScore.grade}** (${qualityScore.overall} / 100)  \n\n`;

  md += `---\n\n`;

  // 1. Executive Summary
  md += `## 1. Executive Summary\n\n`;
  md += `${summary || 'Code analysis completed successfully.'}\n\n`;

  md += `---\n\n`;

  // 2. Metrics & Severity Breakdown
  md += `## 2. Quality & Security Metrics Overview\n\n`;
  md += `| Evaluation Dimension | Score / Value | Status |\n`;
  md += `| :--- | :---: | :--- |\n`;
  md += `| **Overall Quality Score** | **${qualityScore.overall} / 100** | Grade ${qualityScore.grade} |\n`;
  if (qualityScore.securityScore !== null && qualityScore.securityScore !== undefined) {
    md += `| **Security Score** | **${qualityScore.securityScore} / 100** | ${qualityScore.securityScore >= 80 ? 'Optimal' : 'Action Required'} |\n`;
  }
  if (qualityScore.performanceScore !== null && qualityScore.performanceScore !== undefined) {
    md += `| **Performance Score** | **${qualityScore.performanceScore} / 100** | ${qualityScore.performanceScore >= 80 ? 'Optimal' : 'Optimization Advised'} |\n`;
  }
  md += `| **Algorithmic Time Complexity** | **${algorithmicComplexity.timeComplexity}** | ${algorithmicComplexity.complexityType.toUpperCase()} |\n`;
  md += `| **Algorithmic Space Complexity** | **${algorithmicComplexity.spaceComplexity}** | ${algorithmicComplexity.complexityType.toUpperCase()} |\n\n`;

  md += `### Findings Severity Distribution\n\n`;
  md += `| Severity | Count | Evaluation |\n`;
  md += `| :--- | :---: | :--- |\n`;
  md += `| 🔴 **CRITICAL** | ${severityBreakdown.CRITICAL} | ${severityBreakdown.CRITICAL > 0 ? 'Severe Vulnerability' : 'Clean'} |\n`;
  md += `| 🟠 **HIGH** | ${severityBreakdown.HIGH} | ${severityBreakdown.HIGH > 0 ? 'Remediation Required' : 'Clean'} |\n`;
  md += `| 🟡 **MEDIUM** | ${severityBreakdown.MEDIUM} | ${severityBreakdown.MEDIUM > 0 ? 'Attention Needed' : 'Clean'} |\n`;
  md += `| 🔵 **LOW** | ${severityBreakdown.LOW} | ${severityBreakdown.LOW > 0 ? 'Minor Issue' : 'Clean'} |\n`;
  md += `| ⚪ **INFO** | ${severityBreakdown.INFO} | Informational |\n\n`;

  md += `---\n\n`;

  // 3. Security Findings
  md += `## 3. Security Analysis & Vulnerabilities\n\n`;
  if (!findings.security || findings.security.length === 0) {
    md += `*No security vulnerabilities identified. Code satisfies baseline security checks.*\n\n`;
  } else {
    findings.security.forEach((f, idx) => {
      const cweText = f.cwe ? `[${f.cwe}](https://cwe.mitre.org/data/definitions/${f.cwe.replace('CWE-', '')}.html)` : 'N/A';
      md += `### 3.${idx + 1} [${f.severity}] ${f.title} (${f.ruleId || 'SEC'})\n\n`;
      md += `- **Line Range:** Lines ${f.lineStart} - ${f.lineEnd}\n`;
      md += `- **CWE:** ${cweText}\n`;
      md += `- **OWASP Category:** ${f.owaspCategory || 'Uncategorized'}\n`;
      md += `- **Confidence Rating:** ${f.confidence || 'HIGH'}\n`;
      md += `- **Details:** ${f.explanation || f.description || 'Security risk identified.'}\n\n`;

      if (f.originalSnippet) {
        md += `#### Flagged Code\n\`\`\`${review.language}\n${f.originalSnippet}\n\`\`\`\n\n`;
      }
      if (f.remediation || f.suggestedSnippet) {
        md += `#### Recommended Remediation\n`;
        if (f.remediation) md += `${f.remediation}\n\n`;
        if (f.suggestedSnippet) {
          md += `\`\`\`${review.language}\n${f.suggestedSnippet}\n\`\`\`\n\n`;
        }
      }
    });
  }

  md += `---\n\n`;

  // 4. Performance & Algorithmic Analysis
  md += `## 4. Algorithmic Performance & Complexity\n\n`;
  md += `- **Estimated Time Complexity:** \`${algorithmicComplexity.timeComplexity}\`\n`;
  md += `- **Estimated Space Complexity:** \`${algorithmicComplexity.spaceComplexity}\`\n`;
  md += `- **Evaluation Classification:** ${algorithmicComplexity.complexityType}\n\n`;

  if (!findings.performance || findings.performance.length === 0) {
    md += `*No algorithmic bottlenecks or nested complexity patterns detected.*\n\n`;
  } else {
    md += `| Line | Bottleneck Rule | Severity | Complexity Estimate | Optimization Suggestion |\n`;
    md += `| :---: | :--- | :---: | :---: | :--- |\n`;
    findings.performance.forEach((pf) => {
      md += `| ${pf.lineStart} | ${pf.title} | ${pf.severity} | ${pf.complexityEstimate || 'N/A'} | ${pf.remediation || pf.explanation || 'Optimize algorithmic structure'} |\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;

  // 5. Applied Fixes History
  md += `## 5. Applied Remediations History\n\n`;
  if (!appliedFixes || appliedFixes.length === 0) {
    md += `*No fixes have been applied to this review yet. Original source code remains active.*\n\n`;
  } else {
    md += `| # | Rule ID | Line Range | Applied Fix Summary | Applied Timestamp |\n`;
    md += `| :-: | :--- | :---: | :--- | :--- |\n`;
    appliedFixes.forEach((fix, idx) => {
      const time = fix.appliedAt ? new Date(fix.appliedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'N/A';
      const snippetPreview = (fix.appliedSnippet || '').split('\n')[0].slice(0, 60);
      md += `| ${idx + 1} | \`${fix.ruleId || 'MANUAL-FIX'}\` | Lines ${fix.lineStart} - ${fix.lineEnd} | \`${snippetPreview}...\` | ${time} |\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;

  // 6. Source Code Summary
  md += `## 6. Source Code Summary\n\n`;
  md += `- **Original Line Count:** ${review.lineCount} LOC\n`;
  md += `- **Modifications Applied:** ${code.hasModifications ? `${appliedFixes.length} Fixes Applied` : 'None (Original Code Intact)'}\n`;
  if (code.diffSummary) {
    md += `- **Diff Statistics:** +${code.diffSummary.addedLines} lines added, -${code.diffSummary.removedLines} lines removed\n`;
  }
  md += `\n---\n\n`;
  md += `*Report generated by AI Code Review Platform on ${exportDateStr}.*\n`;

  return md;
}

/**
 * Aggregates all data required for audit report generation and serializes it to JSON or Markdown.
 *
 * @param {string} reviewId - CodeReview ObjectId string
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's ID
 * @param {'json' | 'markdown'} [format='json'] - Desired serialization format
 * @returns {Promise<{ format: string, title: string, data: object, content?: string } | null>}
 */
export async function generateReviewExport(reviewId, userId, format = 'json') {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format', 'INVALID_ID_FORMAT');
  }

  const safeReviewId = new mongoose.Types.ObjectId(reviewId);
  const safeUserId = new mongoose.Types.ObjectId(userId);

  // 1. Strict tenant-scoped review lookup
  const review = await CodeReview.findOne({ _id: safeReviewId, userId: safeUserId }).lean();
  if (!review) {
    return null;
  }

  // 2. Fetch associated analysis and all issues
  const [analysis, rawIssues] = await Promise.all([
    AnalysisResult.findOne({ reviewId: safeReviewId, userId: safeUserId }).lean(),
    ReviewIssue.find({ reviewId: safeReviewId, userId: safeUserId })
      .sort({ lineStart: 1, severity: 1 })
      .lean()
  ]);

  const originalCode = review.rawCode || '';
  const currentCode = review.currentCode || originalCode;
  const appliedFixes = review.appliedFixes || [];
  const language = review.language || 'python';

  // 3. Algorithmic complexity derivation
  let evaluated = null;
  if (!analysis?.timeComplexity) {
    try {
      evaluated = evaluateComplexity(originalCode, language);
    } catch {
      // Non-fatal fallback
    }
  }

  const timeComplexity = analysis?.timeComplexity || evaluated?.timeComplexity || 'O(1)';
  const spaceComplexity = analysis?.spaceComplexity || evaluated?.spaceComplexity || 'O(1)';
  const complexityType = analysis?.complexityType || (analysis?.aiAvailable ? 'ai-assisted' : (evaluated?.complexityType || 'deterministic'));

  // 4. Enrich security and performance findings
  const enrichedSecurity = [];
  const enrichedPerformance = [];
  const enrichedBugs = [];
  const enrichedMaintainability = [];

  for (const issue of rawIssues) {
    let cwe = issue.cwe || null;
    let owaspCategory = issue.owaspCategory || null;
    let confidence = issue.confidence || null;
    let remediation = issue.remediation || null;

    if (issue.ruleId && (!cwe || !owaspCategory || !remediation)) {
      const rule = getSecurityRuleById(issue.ruleId);
      if (rule) {
        cwe = cwe || rule.cwe || null;
        owaspCategory = owaspCategory || rule.owaspCategory || null;
        confidence = confidence || rule.confidence || null;
        remediation = remediation || rule.remediation || null;
      }
    }

    const sanitizedIssue = {
      id: issue._id.toString(),
      ruleId: issue.ruleId || null,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      description: issue.description || issue.explanation || '',
      lineStart: issue.lineStart,
      lineEnd: issue.lineEnd,
      columnStart: issue.columnStart || 1,
      columnEnd: issue.columnEnd || 1,
      originalSnippet: issue.originalSnippet || '',
      suggestedSnippet: issue.suggestedSnippet || '',
      explanation: issue.explanation || issue.description || '',
      cwe,
      owaspCategory,
      confidence: confidence || 'HIGH',
      remediation: remediation || '',
      complexityEstimate: issue.complexityEstimate || null,
      source: issue.source || 'static'
    };

    if (issue.category === 'security') {
      enrichedSecurity.push(sanitizedIssue);
    } else if (issue.category === 'performance') {
      enrichedPerformance.push(sanitizedIssue);
    } else if (issue.category === 'bug') {
      enrichedBugs.push(sanitizedIssue);
    } else {
      enrichedMaintainability.push(sanitizedIssue);
    }
  }

  // If no performance issues were persisted in DB but deterministic analyzer found bottlenecks, add them
  if (enrichedPerformance.length === 0 && evaluated && evaluated.findings.length > 0) {
    for (const f of evaluated.findings) {
      enrichedPerformance.push({
        id: `perf-${f.ruleId}-${f.lineStart}`,
        ruleId: f.ruleId,
        category: 'performance',
        severity: f.severity,
        title: f.title,
        description: f.explanation,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        columnStart: 1,
        columnEnd: 1,
        originalSnippet: f.originalSnippet || '',
        suggestedSnippet: f.suggestedSnippet || '',
        explanation: f.explanation,
        cwe: null,
        owaspCategory: null,
        confidence: f.confidence || 'HIGH',
        remediation: f.optimization || '',
        complexityEstimate: f.complexityEstimate || null,
        source: 'static'
      });
    }
  }

  // 5. Severity distribution across all findings
  const severityBreakdown = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };

  const allEnriched = [
    ...enrichedSecurity,
    ...enrichedPerformance,
    ...enrichedBugs,
    ...enrichedMaintainability
  ];

  for (const item of allEnriched) {
    if (severityBreakdown[item.severity] !== undefined) {
      severityBreakdown[item.severity]++;
    }
  }

  // 6. Diff calculation
  const diffSummary = computeDiffLineStats(originalCode, currentCode);

  // 7. Sanitized clean JSON payload (strictly zero sensitive user/server attributes)
  const exportPayload = {
    exportMetadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      generator: 'AI Code Review Platform — Audit Exporter'
    },
    review: {
      id: review._id.toString(),
      title: review.title || 'Untitled Review',
      filename: review.filename || review.fileName || 'snippet',
      language,
      lineCount: review.lineCount || 0,
      reviewMode: review.reviewMode || 'hybrid',
      aiModelUsed: review.aiModelUsed || null,
      aiModelTier: review.aiModelTier || null,
      createdAt: review.createdAt
    },
    qualityScore: {
      overall: review.overallScore ?? analysis?.overallScore ?? 100,
      grade: review.grade ?? analysis?.grade ?? 'A',
      securityScore: analysis?.metrics?.securityScore ?? null,
      performanceScore: analysis?.metrics?.performanceScore ?? null
    },
    algorithmicComplexity: {
      timeComplexity,
      spaceComplexity,
      complexityType
    },
    summary: analysis?.executiveSummary || analysis?.summary || 'Code analysis completed successfully.',
    severityBreakdown,
    findings: {
      total: allEnriched.length,
      security: enrichedSecurity,
      performance: enrichedPerformance,
      bugs: enrichedBugs,
      maintainability: enrichedMaintainability
    },
    appliedFixes: appliedFixes.map((fix) => ({
      ruleId: fix.ruleId || null,
      lineStart: fix.lineStart,
      lineEnd: fix.lineEnd,
      previousSnippet: fix.previousSnippet || '',
      appliedSnippet: fix.appliedSnippet || '',
      appliedAt: fix.appliedAt
    })),
    code: {
      original: originalCode,
      current: currentCode,
      hasModifications: currentCode !== originalCode,
      diffSummary
    }
  };

  if (format === 'markdown') {
    const markdownContent = formatMarkdownReport(exportPayload);
    return {
      format: 'markdown',
      title: review.title || 'review',
      data: exportPayload,
      content: markdownContent
    };
  }

  return {
    format: 'json',
    title: review.title || 'review',
    data: exportPayload
  };
}

export default {
  generateReviewExport,
  computeDiffLineStats,
  formatMarkdownReport
};
