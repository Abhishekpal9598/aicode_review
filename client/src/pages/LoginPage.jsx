import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Terminal, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const destination = location.state?.from?.pathname || '/dashboard';

  // If already authenticated and not loading session, redirect immediately
  if (!authLoading && isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
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
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Developer Sign In</h1>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Enter your credentials to access the AI code review workstation and persistent history.
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-8 bg-surface-primary border border-border-subtle shadow-xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded bg-status-critical-bg border border-status-critical/30 flex items-start gap-3 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-text-secondary font-mono">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
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
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center text-xs py-2"
                isLoading={isSubmitting}
              >
                <span>Authenticate & Access Workstation</span>
                {!isSubmitting && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
              </Button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-border-subtle/60 text-center">
            <p className="text-xs text-text-secondary">
              Don't have an account yet?{' '}
              <Link
                to="/register"
                className="text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
              >
                Register here
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

export default LoginPage;
