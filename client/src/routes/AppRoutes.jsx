import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import Dashboard from '../pages/Dashboard';
import CodeReview from '../pages/CodeReview';
import SecurityAnalysis from '../pages/SecurityAnalysis';
import PerformanceAnalysis from '../pages/PerformanceAnalysis';
import ReviewHistory from '../pages/ReviewHistory';
import CodeComparison from '../pages/CodeComparison';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';

export function AppRoutes() {
  return (
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
  );
}

export default AppRoutes;
