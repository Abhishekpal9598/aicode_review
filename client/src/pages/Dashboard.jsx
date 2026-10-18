import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import MetricCard from '../components/dashboard/MetricCard';
import QualityScoreChart from '../components/dashboard/QualityScoreChart';
import IssueRadarChart from '../components/dashboard/IssueRadarChart';
import RecentReviewsTable from '../components/dashboard/RecentReviewsTable';
import QuickActions from '../components/dashboard/QuickActions';
import GettingStartedGuide from '../components/dashboard/GettingStartedGuide';
import {
  LayoutDashboard,
  Code2,
  Gauge,
  ShieldAlert,
  Zap,
  Database,
  Bot,
  AlertTriangle,
  RotateCw,
  WifiOff
} from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();

  // Dashboard Stats State
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // null | 'db_unavailable' | 'network_error' | 'generic'

  // Independent Database Health Telemetry State
  const [dbStatus, setDbStatus] = useState('checking'); // 'connected' | 'offline' | 'checking' | 'unavailable'

  /**
   * Independent Database Health Telemetry
   * Queries GET /api/v1/health directly without coupling to dashboard statistics.
   * Gracefully handles HTTP 503 when MongoDB is disconnected.
   */
  const checkDbHealth = useCallback(async () => {
    try {
      const res = await apiClient.getV1Health();
      if (res && res.database?.connected === true) {
        setDbStatus('connected');
      } else {
        setDbStatus('offline');
      }
    } catch (err) {
      if (err.status === 503 && err.data?.database?.connected === false) {
        setDbStatus('offline');
      } else if (err.status === 0 || err.code === 'NETWORK_UNAVAILABLE') {
        setDbStatus('unavailable');
      } else {
        setDbStatus('offline');
      }
    }
  }, []);

  /**
   * Fetch Dashboard Statistics
   * Enforces explicit unwrapping from ApiResponse envelope ({ success, message, data, meta }).
   */
  const loadStats = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await apiClient.getUserStats();
      if (res && res.data) {
        setStats(res.data);
      } else {
        throw new Error('Malformed statistics response envelope.');
      }
    } catch (err) {
      if (err.status === 503 || err.code === 'DATABASE_UNAVAILABLE') {
        setErrorState('db_unavailable');
      } else if (err.status === 0 || err.code === 'NETWORK_UNAVAILABLE') {
        setErrorState('network_error');
      } else {
        setErrorState('generic');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    checkDbHealth();
  }, [loadStats, checkDbHealth]);

  const handleRetryAll = () => {
    loadStats();
    checkDbHealth();
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Welcome Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border-subtle/60">
        <PageHeader
          title={`Welcome back, ${user?.name || 'Developer'}`}
          description="Your centralized workstation for code analysis telemetry, quality trajectory, and review workflows."
          icon={LayoutDashboard}
          badgeText="Workstation Active"
          badgeVariant="indigo"
        />

        {/* Dynamic Telemetry Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* User Role Badge */}
          <Badge variant="indigo" size="xs" mono className="uppercase font-semibold">
            {user?.role || 'developer'}
          </Badge>

          {/* AI Engine Status (Strictly unreleased in Phase 5) */}
          <Badge variant="slate" size="xs" mono className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-text-muted" />
            <span>AI Engine: Coming in Phase 8</span>
          </Badge>

          {/* Dynamic Database Connection Telemetry */}
          {dbStatus === 'connected' && (
            <Badge variant="emerald" size="xs" mono className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-status-success" />
              <span>Database Connected</span>
            </Badge>
          )}
          {dbStatus === 'offline' && (
            <Badge variant="rose" size="xs" mono className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-status-critical" />
              <span>Database Offline</span>
            </Badge>
          )}
          {dbStatus === 'checking' && (
            <Badge variant="slate" size="xs" mono className="flex items-center gap-1.5 animate-pulse">
              <Database className="w-3.5 h-3.5 text-text-muted" />
              <span>Checking Database...</span>
            </Badge>
          )}
          {dbStatus === 'unavailable' && (
            <Badge variant="slate" size="xs" mono className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-text-muted" />
              <span>Database Telemetry Unavailable</span>
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Runtime Error State Banners with Functional Retry */}
      {errorState === 'db_unavailable' && (
        <Card className="p-5 border-status-critical/40 bg-status-critical-bg/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-status-critical-bg text-status-critical border border-status-critical/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Database Service Unavailable
                </h4>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Unable to retrieve review statistics because the database service is currently offline or unreachable.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              className="gap-2 shrink-0 border-status-critical/40 text-status-critical hover:bg-status-critical-bg font-mono text-xs cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </Button>
          </div>
        </Card>
      )}

      {errorState === 'network_error' && (
        <Card className="p-5 border-status-warning/40 bg-status-warning-bg/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-status-warning-bg text-status-warning border border-status-warning/30 shrink-0">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Backend API Unreachable
                </h4>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Cannot connect to the backend server. Please verify network connectivity or check if the backend service is running.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              className="gap-2 shrink-0 border-status-warning/40 text-status-warning hover:bg-status-warning-bg font-mono text-xs cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </Button>
          </div>
        </Card>
      )}

      {errorState === 'generic' && (
        <Card className="p-5 border-status-critical/40 bg-status-critical-bg/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-status-critical-bg text-status-critical border border-status-critical/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Failed to Load Dashboard Statistics
                </h4>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  An unexpected error occurred while communicating with the workstation API.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              className="gap-2 shrink-0 border-status-critical/40 text-status-critical hover:bg-status-critical-bg font-mono text-xs cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </Button>
          </div>
        </Card>
      )}

      {/* 3. Main Dashboard Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" message="Synchronizing workstation metrics..." />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* A. 4 KPI Overview Cards Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Code Reviews"
              value={stats.overview?.totalReviews ?? 0}
              subtext={
                stats.overview?.totalReviews > 0
                  ? 'Completed review sessions'
                  : 'No reviews submitted yet'
              }
              icon={Code2}
              badgeText="Live DB"
              badgeVariant="emerald"
            />

            <MetricCard
              title="Mean Quality Score"
              value={stats.overview?.averageQualityScore ?? null}
              subtext="Requires completed code reviews (Phase 8)"
              icon={Gauge}
              badgeText="Pending Reviews"
              badgeVariant="indigo"
            />

            <MetricCard
              title="Critical Security Flaws"
              value="Coming in Phase 7 & 9"
              subtext="Static pattern scanner activates in Phase 7; comprehensive OWASP vulnerability suite activates in Phase 9."
              icon={ShieldAlert}
              badgeText="Not Available Yet"
              badgeVariant="amber"
              isUnavailable={true}
            />

            <MetricCard
              title="Performance Optimizations"
              value="Coming in Phase 10"
              subtext="Big-O complexity profiler and loop efficiency analyzer activate in Phase 10."
              icon={Zap}
              badgeText="Not Available Yet"
              badgeVariant="amber"
              isUnavailable={true}
            />
          </div>

          {/* B. Analytical Visualizations Row (Desktop 60/40 Split | Mobile Stacked) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <QualityScoreChart scoreHistory={stats.scoreHistory || []} />
            </div>
            <div className="lg:col-span-5">
              <IssueRadarChart radarData={[]} />
            </div>
          </div>

          {/* C. Workstation Quick Actions Strip */}
          <QuickActions />

          {/* D. Bottom Section: Recent Reviews & Getting Started (Desktop 65/35 Split | Mobile Stacked) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <RecentReviewsTable recentReviews={stats.recentReviews || []} />
            </div>
            <div className="lg:col-span-4">
              <GettingStartedGuide />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Dashboard;
