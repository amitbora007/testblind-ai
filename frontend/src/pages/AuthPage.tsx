import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { api, CurrentUserProfile } from '@/services/api';
import {
  Lock,
  Mail,
  User,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Play,
  Cpu,
  Layers,
} from 'lucide-react';

export interface AuthPageProps {
  onLoginSuccess: (user: CurrentUserProfile) => void;
  onEnterDemoMode: () => void;
}

export function AuthPage({ onLoginSuccess, onEnterDemoMode }: AuthPageProps) {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (tab === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both your email address and password.');
        }
        await api.login({ email: email.trim(), password });
      } else {
        if (!fullName.trim() || !email.trim() || !password) {
          throw new Error('Please fill in your name, email, and password.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        await api.register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          organization_name: orgName.trim() || undefined,
        });
      }

      // Fetch user profile
      const profile = await api.getCurrentUser();
      onLoginSuccess(profile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication request failed. Please check your credentials or backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-base flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 text-slate-100 relative overflow-hidden">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/10 via-purple-600/10 to-brand-teal/5 blur-3xl pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header with Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Enterprise AI Test Gap Discovery &amp; Unified Regression Platform
          </p>
        </div>

        {/* Authentication Card */}
        <Card className="p-6 sm:p-8 bg-slate-900/80 border-slate-800 shadow-2xl backdrop-blur-xl">
          {/* Tab Switcher */}
          <div className="flex rounded-lg bg-slate-950 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                tab === 'signin'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                tab === 'register'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in-50 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Full Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    leftIcon={<User className="w-4 h-4 text-slate-400" />}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Organization Name <span className="text-slate-500 text-[11px]">(Optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Acme Engineering"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    leftIcon={<Building2 className="w-4 h-4 text-slate-400" />}
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Work Email</label>
              <Input
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  required
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2 font-semibold shadow-glow-primary flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : tab === 'signin' ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-mono">Or offline tour</span>
            </div>
          </div>

          {/* Demo Mode Button */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onEnterDemoMode}
              className="w-full border-slate-700 hover:bg-slate-800/80 text-slate-200 text-xs flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 text-blue-400" />
              <span>Explore in Demo Mode (No backend required)</span>
            </Button>
            <p className="text-[11px] text-center text-slate-500 leading-normal">
              Browse with simulated AST mutation engines, dual-state test executions, and sample repositories.
            </p>
          </div>
        </Card>

        {/* Security & Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Multi-Tenant RBAC</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Isolated Sandboxing</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AST Mutation AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
