import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Terminal, Shield, Cpu, Activity, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

function PlaceholderHome() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    data: null,
    error: null,
    checkedAt: null
  });

  const checkHealth = async () => {
    setHealthStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiBase}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setHealthStatus({
        loading: false,
        data,
        error: null,
        checkedAt: new Date().toLocaleTimeString()
      });
    } catch (err) {
      setHealthStatus({
        loading: false,
        data: null,
        error: err.message,
        checkedAt: new Date().toLocaleTimeString()
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero Welcome */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-secondary border border-border-subtle text-text-secondary text-xs font-mono mb-4">
          <Activity className="w-3.5 h-3.5 text-brand-primary" />
          Phase 1: Project Initialization Active
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-3">
          AI Code Review Platform
        </h2>
        <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
          Intelligent AI-Powered Code Analysis & Review Platform. Scaffolding, security headers, environment proxy, and core API services are initialized.
        </p>
      </div>

      {/* Grid of Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Architecture Card */}
        <div className="bg-surface-primary border border-border-subtle rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded bg-surface-secondary text-brand-primary border border-border-subtle">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Architecture Spec</h3>
              <p className="text-xs text-text-muted">Verified Foundation Stack</p>
            </div>
          </div>
          <ul className="space-y-2.5 text-xs text-text-secondary">
            <li className="flex items-center justify-between">
              <span className="text-text-muted">Frontend Framework:</span>
              <span className="font-mono text-text-primary font-medium">React 19 + Vite 6</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-text-muted">Styling System:</span>
              <span className="font-mono text-text-primary font-medium">Tailwind CSS 3 (Cybernetic Charcoal)</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-text-muted">Backend Runtime:</span>
              <span className="font-mono text-text-primary font-medium">Node.js + Express 4 (ESM)</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-text-muted">Security Suite:</span>
              <span className="font-mono text-text-primary font-medium">Helmet + Origin-Restricted CORS</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-text-muted">Development Proxy:</span>
              <span className="font-mono text-text-primary font-medium">Vite /api &rarr; :5001</span>
            </li>
          </ul>
        </div>

        {/* API Health Monitor Card */}
        <div className="bg-surface-primary border border-border-subtle rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-surface-secondary text-brand-primary border border-border-subtle">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">API Health Monitor</h3>
                  <p className="text-xs text-text-muted">Endpoint: GET /api/health</p>
                </div>
              </div>
              <button
                onClick={checkHealth}
                disabled={healthStatus.loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-secondary hover:bg-surface-tertiary text-text-primary border border-border-subtle transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.loading ? 'animate-spin' : ''}`} />
                Test
              </button>
            </div>

            <div className="bg-canvas border border-border-subtle rounded p-3 font-mono text-xs">
              {healthStatus.loading && (
                <div className="flex items-center gap-2 text-text-muted py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
                  <span>Probing backend health endpoint...</span>
                </div>
              )}

              {!healthStatus.loading && healthStatus.data && (
                <div>
                  <div className="flex items-center gap-2 text-status-success font-semibold mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Status: {healthStatus.data.status}</span>
                  </div>
                  <pre className="text-text-secondary overflow-x-auto text-[11px] leading-relaxed">
                    {JSON.stringify(healthStatus.data, null, 2)}
                  </pre>
                </div>
              )}

              {!healthStatus.loading && healthStatus.error && (
                <div className="flex items-start gap-2 text-status-critical">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">Connectivity Error:</span>
                    <p className="text-text-muted text-[11px] mt-1">{healthStatus.error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {healthStatus.checkedAt && (
            <div className="text-[11px] text-text-muted mt-3 text-right">
              Last checked: {healthStatus.checkedAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-canvas text-text-primary flex flex-col font-sans selection:bg-brand-primary selection:text-white">
        {/* Top Navbar */}
        <header className="border-b border-border-subtle bg-surface-primary/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                <Terminal className="w-4 h-4" />
              </div>
              <h1 className="text-sm font-semibold tracking-wide text-text-primary">
                AI Code Review
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-secondary border border-border-subtle text-text-muted">
                v1.0.0
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <span>Phase 1 Initialized</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 flex items-center justify-center">
          <Routes>
            <Route path="/" element={<PlaceholderHome />} />
            <Route path="*" element={<PlaceholderHome />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-border-subtle bg-surface-primary/40 py-4 text-center text-xs text-text-muted font-mono">
          AI Code Review Workstation &bull; Phase 1: Project Initialization Complete
        </footer>
      </div>
    </BrowserRouter>
  );
}
