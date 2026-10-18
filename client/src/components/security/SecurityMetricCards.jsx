import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  ShieldAlert,
  ShieldCheck,
  Gauge,
  Layers,
  Bug,
  Sparkles,
  Cpu
} from 'lucide-react';

const GRADE_STYLES = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40',
  B: 'text-blue-400 bg-blue-500/10 border-blue-500/40',
  C: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40',
  D: 'text-amber-400 bg-amber-500/10 border-amber-500/40',
  F: 'text-rose-400 bg-rose-500/10 border-rose-500/40',
  'N/A': 'text-text-muted bg-surface-tertiary border-border-subtle'
};

export function SecurityMetricCards({
  securityScore = null,
  securityGrade = null,
  hasCriticalVulnerability = false,
  totalSecurityIssues = 0,
  filteredCount = null,
  severityCounts = {},
  sourceCounts = {}
}) {
  const isScorePresent = typeof securityScore === 'number';
  const displayScore = isScorePresent ? securityScore : 'N/A';
  const displayGrade = securityGrade || 'N/A';
  const gradeStyle = GRADE_STYLES[displayGrade] || GRADE_STYLES['N/A'];

  const critCount = severityCounts?.CRITICAL || 0;
  const isCritical = Boolean(hasCriticalVulnerability || critCount > 0);

  const showFilteredSubtext =
    filteredCount !== null &&
    filteredCount !== undefined &&
    filteredCount !== totalSecurityIssues;

  return (
    <div
      data-testid="security-metric-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* 1. Security Health Score */}
      <Card
        data-testid="metric-security-score"
        className="flex flex-col justify-between p-4 bg-surface-secondary/70 border-border-subtle"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Security Score
          </span>
          <span
            data-testid="security-grade-badge"
            className={`w-7 h-7 rounded border flex items-center justify-center font-bold text-xs ${gradeStyle}`}
            title={`Security Grade: ${displayGrade}`}
          >
            {displayGrade}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            data-testid="security-score-value"
            className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary"
          >
            {displayScore}
          </span>
          {isScorePresent && (
            <span className="text-xs text-text-muted font-mono">/ 100</span>
          )}
        </div>

        <p className="text-[11px] text-text-muted mt-2">
          {isScorePresent
            ? 'Deterministic & AI aggregated security posture'
            : 'Score Not Available'}
        </p>
      </Card>

      {/* 2. Critical Risk Status */}
      <Card
        data-testid="metric-critical-status"
        className={`flex flex-col justify-between p-4 bg-surface-secondary/70 transition-colors ${
          isCritical
            ? 'border-rose-500/40 bg-rose-500/[0.04]'
            : 'border-border-subtle'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Critical Risk
          </span>
          <span data-testid="critical-status-badge">
            <Badge
              variant={isCritical ? 'red' : 'emerald'}
              size="xs"
              mono
            >
              {isCritical ? 'ACTION REQUIRED' : 'COMPLIANT'}
            </Badge>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {isCritical ? (
            <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
          )}
          <div>
            <span className="text-lg font-bold font-mono text-text-primary">
              {isCritical ? `${critCount} Critical` : '0 Critical'}
            </span>
            <p className="text-[11px] text-text-muted">
              {isCritical
                ? 'High-risk vulnerabilities detected'
                : 'No critical vulnerabilities'}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-text-muted mt-2 truncate">
          {isCritical
            ? 'Requires immediate remediation before deployment'
            : 'Zero blocking critical CVE hazards'}
        </p>
      </Card>

      {/* 3. Total Security Findings (Pre-filter Telemetry) */}
      <Card
        data-testid="metric-total-findings"
        className="flex flex-col justify-between p-4 bg-surface-secondary/70 border-border-subtle"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Total Findings
          </span>
          <span className="text-[10px] text-text-muted font-mono">Pre-filter</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            data-testid="total-findings-value"
            className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary"
          >
            {totalSecurityIssues}
          </span>
          <span className="text-xs text-text-muted">issues</span>
        </div>

        {showFilteredSubtext ? (
          <p
            data-testid="filtered-subtext"
            className="text-[11px] text-brand-primary font-medium mt-2"
          >
            Showing {filteredCount} of {totalSecurityIssues} findings
          </p>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
              C:{severityCounts?.CRITICAL || 0}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              H:{severityCounts?.HIGH || 0}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono">
              M:{severityCounts?.MEDIUM || 0}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              L:{severityCounts?.LOW || 0}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">
              I:{severityCounts?.INFO || 0}
            </span>
          </div>
        )}
      </Card>

      {/* 4. Analysis Origin & Source Breakdown */}
      <Card
        data-testid="metric-source-breakdown"
        className="flex flex-col justify-between p-4 bg-surface-secondary/70 border-border-subtle"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Analysis Origin
          </span>
          <Badge variant="indigo" size="xs" mono>
            Dual Layer
          </Badge>
        </div>

        <div className="space-y-1 mt-1 font-mono text-xs">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Hybrid Fusion:
            </span>
            <strong className="text-emerald-400 font-semibold">
              {sourceCounts?.hybrid || 0}
            </strong>
          </div>
          <div className="flex items-center justify-between text-text-secondary">
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Cpu className="w-3 h-3 text-cyan-400" />
              Static Scanner:
            </span>
            <strong className="text-cyan-400 font-semibold">
              {sourceCounts?.static || 0}
            </strong>
          </div>
          <div className="flex items-center justify-between text-text-secondary">
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Layers className="w-3 h-3 text-purple-400" />
              Gemini AI:
            </span>
            <strong className="text-purple-400 font-semibold">
              {sourceCounts?.gemini || 0}
            </strong>
          </div>
        </div>

        <p className="text-[11px] text-text-muted mt-2">
          Deterministic heuristics + AI reasoning
        </p>
      </Card>
    </div>
  );
}

export default SecurityMetricCards;
