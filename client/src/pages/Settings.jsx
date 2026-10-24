import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import {
  Settings as SettingsIcon,
  Shield,
  User,
  Lock,
  Monitor,
  Sparkles,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Check,
  Cpu
} from 'lucide-react';

const PREFERENCES_KEY = 'workspace_preferences';

const DEFAULT_PREFERENCES = {
  theme: 'cybernetic-dark',
  fontSize: 14,
  tabSize: 2,
  defaultLanguage: 'python',
  primaryAiModel: 'gemini-1.5-pro',
  enableFallbackModel: true,
  autoScrollFindings: true
};

export function Settings() {
  const { user, logout } = useAuth();

  // Workspace Editor & AI Preferences state
  const [preferences, setPreferences] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(PREFERENCES_KEY);
        if (stored) {
          return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_PREFERENCES;
  });

  const [prefSaveSuccess, setPrefSaveSuccess] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // Logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Persist preferences handler
  const handlePreferenceChange = (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
        setPrefSaveSuccess(true);
        setTimeout(() => setPrefSaveSuccess(false), 2000);
      } catch (err) {
        console.error('Failed to save preferences to localStorage', err);
      }
    }
  };

  // Password submission handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    // Password complexity check
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);

    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      setPasswordError('Password must contain at least 1 lowercase, 1 uppercase, 1 digit, and 1 special symbol.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiClient.changePassword({
        currentPassword,
        newPassword
      });
      setPasswordSuccess('Password successfully updated. Your active session has been renewed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Please verify your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Settings & Workspace Preferences"
        description="Manage your developer profile, security credentials, Monaco editor environment, and AI analysis engine."
        icon={SettingsIcon}
        badgeText="Workstation v1.0.0"
        badgeVariant="slate"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader
            title="Developer Profile"
            subtitle="Account credentials and role verification"
            icon={User}
          />
          <div className="space-y-4 text-xs pt-1">
            <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
              <span className="text-text-muted">Account Name:</span>
              <span className="font-medium text-text-primary text-sm">
                {user?.name || 'Developer'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
              <span className="text-text-muted">Email Address:</span>
              <span className="font-mono text-text-primary">
                {user?.email || 'user@example.com'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
              <span className="text-text-muted">Authorization Role:</span>
              <Badge variant="indigo" size="xs">
                {user?.role || 'DEVELOPER'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
              <span className="text-text-muted">Session Authentication:</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Dual-Channel JWT
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-muted">Member Since:</span>
              <span className="font-mono text-text-secondary">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Workspace'}
              </span>
            </div>
          </div>
        </Card>

        {/* Security & Password Change */}
        <Card>
          <CardHeader
            title="Account Security"
            subtitle="Change password and update credentials"
            icon={Lock}
          />
          <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
            {passwordError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-text-secondary mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-surface-primary border border-border-subtle px-3 py-1.5 text-xs text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono pr-8"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-2.5 top-2 text-text-muted hover:text-text-primary"
                >
                  {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters with upper, lower, number, symbol"
                  className="w-full bg-surface-primary border border-border-subtle px-3 py-1.5 text-xs text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono pr-8"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-2.5 top-2 text-text-muted hover:text-text-primary"
                >
                  {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="w-full bg-surface-primary border border-border-subtle px-3 py-1.5 text-xs text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
                autoComplete="new-password"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="w-full"
              >
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Monaco Editor Preferences */}
        <Card>
          <CardHeader
            title="Monaco Editor Preferences"
            subtitle="Customize typography, indentations, and defaults"
            icon={Monitor}
          />
          <div className="space-y-4 text-xs pt-1">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Default Language</span>
                <span className="text-text-muted text-[11px]">Preferred starter template language</span>
              </div>
              <select
                value={preferences.defaultLanguage}
                onChange={(e) => handlePreferenceChange('defaultLanguage', e.target.value)}
                className="bg-surface-primary border border-border-subtle text-text-primary px-2.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
              >
                <option value="auto">Auto Detect (Default)</option>
                <option value="c">C (.c)</option>
                <option value="cpp">C++ (.cpp)</option>
                <option value="java">Java (.java)</option>
                <option value="python">Python (.py)</option>
                <option value="javascript">JavaScript (.js)</option>
                <option value="typescript">TypeScript (.ts)</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Font Size</span>
                <span className="text-text-muted text-[11px]">Monaco editor character scale</span>
              </div>
              <select
                value={preferences.fontSize}
                onChange={(e) => handlePreferenceChange('fontSize', Number(e.target.value))}
                className="bg-surface-primary border border-border-subtle text-text-primary px-2.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
              >
                <option value={12}>12 px</option>
                <option value={14}>14 px (Default)</option>
                <option value={16}>16 px</option>
                <option value={18}>18 px</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Tab Size</span>
                <span className="text-text-muted text-[11px]">Indentation width</span>
              </div>
              <select
                value={preferences.tabSize}
                onChange={(e) => handlePreferenceChange('tabSize', Number(e.target.value))}
                className="bg-surface-primary border border-border-subtle text-text-primary px-2.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-text-primary font-medium block">Editor Theme</span>
                <span className="text-text-muted text-[11px]">IDE color scheme</span>
              </div>
              <Badge variant="indigo" size="xs">
                Obsidian Dark IDE
              </Badge>
            </div>

            {prefSaveSuccess && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Preferences saved to local browser storage</span>
              </div>
            )}
          </div>
        </Card>

        {/* AI Engine & Fallback Preferences */}
        <Card>
          <CardHeader
            title="AI Analysis Engine Preferences"
            subtitle="Gemini model selection and static-fallback policy"
            icon={Sparkles}
          />
          <div className="space-y-4 text-xs pt-1">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Primary Gemini Model</span>
                <span className="text-text-muted text-[11px]">Primary LLM for code review</span>
              </div>
              <select
                value={preferences.primaryAiModel}
                onChange={(e) => handlePreferenceChange('primaryAiModel', e.target.value)}
                className="bg-surface-primary border border-border-subtle text-text-primary px-2.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
              >
                <option value="gemini-1.5-pro">gemini-1.5-pro (Standard)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Low Latency)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Preview)</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Automatic Fallback</span>
                <span className="text-text-muted text-[11px]">Switch on 429 quota exhaustion</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.enableFallbackModel}
                  onChange={(e) => handlePreferenceChange('enableFallbackModel', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
              <div>
                <span className="text-text-primary font-medium block">Auto-Focus Findings</span>
                <span className="text-text-muted text-[11px]">Expand finding panel on completion</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.autoScrollFindings}
                  onChange={(e) => handlePreferenceChange('autoScrollFindings', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-text-primary font-medium block">Analysis Engine Mode</span>
                <span className="text-text-muted text-[11px]">Hybrid static + AI analyzer</span>
              </div>
              <Badge variant="emerald" size="xs">
                Active & Verified
              </Badge>
            </div>
          </div>
        </Card>

        {/* Session Management Card */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Session Management & Sign Out"
            subtitle="Manage your current active browser session"
            icon={LogOut}
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1 text-xs text-text-secondary">
              <p>
                Logging out revokes your active JWT token session on the server via <code className="text-text-primary font-mono">tokenVersion</code> increment and clears all authentication cookies.
              </p>
              <p className="text-text-muted text-[11px]">
                Active Workstation: AI Code Review Platform &bull; Dual-channel CSRF protection enabled
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="shrink-0 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? 'Signing Out...' : 'Sign Out of Workstation'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="p-3.5 rounded bg-surface-secondary/40 border border-border-subtle flex items-start gap-3 text-xs text-text-secondary">
        <Shield className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-text-primary">Enterprise Security Guarantee:</strong> All internal secrets (MongoDB connection string, Gemini API credentials, JWT private key) are strictly contained on the server runtime and are never exposed to the client.
        </p>
      </div>
    </div>
  );
}

export default Settings;