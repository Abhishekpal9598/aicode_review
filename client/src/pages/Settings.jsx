import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Settings as SettingsIcon, Shield } from 'lucide-react';

export function Settings() {
  const publicConfig = {
    appVersion: '1.0.0',
    currentPhase: 'Phase 3 — Frontend Foundation',
    apiBaseEndpoint: import.meta.env.VITE_API_BASE_URL || '/api',
    themeMode: 'Cybernetic Charcoal & Obsidian (Dark IDE)',
    maxFileSize: '1 MB (UTF-8 source code)',
    supportedLanguages: ['C', 'C++', 'Java', 'Python', 'JavaScript', 'TypeScript']
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Workspace Preferences"
        description="Public workstation configuration, environment parameters, and editor display preferences."
        icon={SettingsIcon}
        badgeText="Workstation v1.0.0"
        badgeVariant="slate"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment & Connection Parameters */}
        <Card>
          <CardHeader
            title="Public Environment Config"
            subtitle="Client runtime parameters"
          />
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">API Base URL:</span>
              <span className="font-mono text-text-primary font-medium">
                {publicConfig.apiBaseEndpoint}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Active Architecture:</span>
              <span className="font-mono text-text-primary font-medium">
                {publicConfig.currentPhase}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Version Tag:</span>
              <span className="font-mono text-text-primary font-medium">
                v{publicConfig.appVersion}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-text-muted">Proxy Target:</span>
              <span className="font-mono text-text-primary font-medium">
                http://localhost:5001
              </span>
            </div>
          </div>
        </Card>

        {/* Display & Design System Settings */}
        <Card>
          <CardHeader
            title="Visual Theme Specification"
            subtitle="Cybernetic Charcoal design tokens"
          />
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Theme Mode:</span>
              <Badge variant="indigo" size="xs">
                Obsidian Dark IDE
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Canvas Color:</span>
              <span className="font-mono text-text-primary font-medium">#0A0D12</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Primary Brand Hue:</span>
              <span className="font-mono text-text-primary font-medium">#6366F1 (Electric Indigo)</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-text-muted">Typography:</span>
              <span className="font-mono text-text-primary font-medium">Inter & JetBrains Mono</span>
            </div>
          </div>
        </Card>

        {/* Ingestion & Language Support Specs */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Source Code Ingestion Rules"
            subtitle="Platform limits and language scope"
          />
          <div className="space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Max Source File Size:</span>
              <span className="font-mono text-text-primary font-medium">
                {publicConfig.maxFileSize}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 py-1.5">
              <span className="text-text-muted">Supported Languages:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {publicConfig.supportedLanguages.map((lang) => (
                  <Badge key={lang} variant="slate" size="xs" mono>
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="p-3.5 rounded bg-surface-secondary/40 border border-border-subtle flex items-start gap-3 text-xs text-text-secondary">
        <Shield className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-text-primary">Security Note:</strong> Internal secrets (database connection URIs, Gemini API credentials, JWT keys) are securely isolated in the server-side runtime and never transmitted to or rendered by the client application.
        </p>
      </div>
    </div>
  );
}

export default Settings;
