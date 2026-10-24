import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Route-level lazy loading — preserves fast initial bundle and ensures
// heavy editor chunks (Monaco) are only loaded when visiting editor routes.
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const CodeReview = lazy(() => import('../pages/CodeReview'));
const SecurityAnalysis = lazy(() => import('../pages/SecurityAnalysis'));
const PerformanceAnalysis = lazy(() => import('../pages/PerformanceAnalysis'));
const ReviewHistory = lazy(() => import('../pages/ReviewHistory'));
const CodeComparison = lazy(() => import('../pages/CodeComparison'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <LoadingSpinner size="lg" message="Loading workstation module..." />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Workstation Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Root redirects to Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Core 8 Foundational Workstation Modules */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/code-review" element={<CodeReview />} />
            <Route path="/security" element={<SecurityAnalysis />} />
            <Route path="/performance" element={<PerformanceAnalysis />} />
            <Route path="/history" element={<ReviewHistory />} />
            <Route path="/comparison" element={<CodeComparison />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* 404 Catch-All Route */}
        <Route element={<MainLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
