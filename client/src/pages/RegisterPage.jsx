import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Terminal, Lock, Mail, User, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const { register, login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Real-time password requirement flags
  const hasMinLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  // If already authenticated and not loading session, redirect immediately
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      setErrorMessage('Password must contain at least 1 uppercase letter (A-Z), 1 lowercase letter (a-z), 1 number (0-9), and 1 special symbol (e.g. Sumit@2007).');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Register account
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      // 2. Auto-login immediately after successful registration
      await login({
        email: email.trim().toLowerCase(),
        password
      });

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-secondary border border-border-subtle mb-3">
          <Terminal className="w-6 h-6 text-brand-primary" />
          <span className="text-base font-bold tracking-tight text-text-primary">AI Code Review</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Create Developer Account</h1>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Register to unlock in-browser code analysis, dual-layer security checks, and review archives.
        </p>
      </div>

      {/* Registration Card */}
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-8 bg-surface-primary border border-border-subtle shadow-xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded bg-status-critical-bg border border-status-critical/30 flex items-start gap-3 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 font-mono">
                Full Name / Handle
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Mercer"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface-secondary border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono transition-colors"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 font-mono">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.mercer@codeforge.dev"
                  autoComplete="email"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface-secondary border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 font-mono">
                Password (min. 8 characters, upper, lower, number, symbol)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. Sumit@2007"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full pl-9 pr-10 py-2 bg-surface-secondary border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2 p-2.5 rounded bg-surface-secondary/80 border border-border-subtle text-[11px] font-mono grid grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-text-muted'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 8+ Characters
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400' : 'text-text-muted'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 Uppercase (A-Z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400' : 'text-text-muted'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 Lowercase (a-z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber && hasSpecial ? 'text-emerald-400' : 'text-text-muted'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Number & Symbol
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 font-mono">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full pl-9 pr-3 py-2 bg-surface-secondary border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center text-xs py-2"
                isLoading={isSubmitting}
              >
                <span>Complete Registration & Open Workstation</span>
                {!isSubmitting && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
              </Button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-border-subtle/60 text-center">
            <p className="text-xs text-text-secondary">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-8 text-center text-[11px] font-mono text-text-muted">
        AI Code Review Platform • Workstation v1.0.0
      </div>
    </div>
  );
}

export default RegisterPage;
