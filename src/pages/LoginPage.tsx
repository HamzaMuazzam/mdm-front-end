import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Smartphone, ShieldCheck, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { loginSchema } from '@/utils/validators';
import { useLogin } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import type { LoginRequest } from '@/types/auth.types';
import { nexusTheme } from '@/lib/theme';

const FEATURES = [
  {
    icon: <Smartphone className="h-4 w-4" />,
    title: 'Real-time Device Monitoring',
    desc: 'Track every device in your fleet with live status updates.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Security-first Architecture',
    desc: 'Enforce policies and access controls across your organization.',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'One-tap App Deployment',
    desc: 'Push app updates and configurations instantly at scale.',
  },
];

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const loginMutation = useLogin();
  const [searchParams] = useSearchParams();
  const fcmTokenFromUrl = searchParams.get('fcmToken') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginRequest) => {
    try {
      setError('');
      await loginMutation.mutateAsync({ ...data, fcmToken: fcmTokenFromUrl });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Sign in failed';
      if (message !== 'Email not verified') setError(message);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel — brand (hidden on mobile) ───────────────── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative overflow-hidden bg-[#0f172a]">
        {/* Background mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              radial-gradient(at 20% 30%, rgba(99,102,241,0.35) 0px, transparent 50%),
              radial-gradient(at 80% 70%, rgba(139,92,246,0.25) 0px, transparent 50%),
              radial-gradient(at 60% 10%, rgba(14,165,233,0.2) 0px, transparent 50%)
            `,
          }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col p-10 xl:p-14 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl nexus-gradient flex items-center justify-center shadow-glow-primary">
              <span className="text-white font-bold text-base">N</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">{nexusTheme.brand.fullName}</p>
              <p className="text-white/35 text-[10px] uppercase tracking-[0.14em] mt-0.5">
                Enterprise Platform
              </p>
            </div>
          </div>

          {/* Hero text */}
          <div className="py-12 xl:py-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/12 text-white/60 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse-dot" />
              Trusted by 500+ enterprises worldwide
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-[1.15] text-balance mb-4">
              Manage every device.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 via-purple-300 to-cyan-300">
                Enforce every policy.
              </span>
            </h1>
            <p className="text-white/50 text-base xl:text-lg leading-relaxed max-w-sm">
              {nexusTheme.brand.tagline}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 mb-auto">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-primary-300 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white/85 text-sm font-semibold leading-none mb-1">{f.title}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="mt-10 p-4 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-white/65 text-sm leading-relaxed italic">
              "Nexus transformed how we manage 12,000+ field devices. Setup took one afternoon."
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-purple-400 flex items-center justify-center">
                <span className="text-white text-xs font-bold">AK</span>
              </div>
              <div>
                <p className="text-white/80 text-xs font-semibold leading-none">Aisha Khan</p>
                <p className="text-white/35 text-[10px] mt-0.5">IT Director, Meridian Corp</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 lg:px-12 bg-background">
        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl nexus-gradient flex items-center justify-center">
            <span className="text-white font-bold text-base">N</span>
          </div>
          <p className="text-foreground font-bold text-xl">{nexusTheme.brand.fullName}</p>
        </div>

        <div className="w-full max-w-sm xl:max-w-md animate-fade-in">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Welcome back
            </h2>
            <p className="text-muted-foreground mt-1.5">
              Sign in to your {nexusTheme.brand.name} account
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm animate-scale-in">
              <div className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login"
                className="text-sm font-semibold text-foreground/80"
              >
                Email address
              </label>
              <input
                id="login"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('login')}
                className={`w-full h-11 px-4 rounded-xl border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
                  errors.login
                    ? 'border-destructive/60 focus:ring-destructive/20'
                    : 'border-border hover:border-border/80'
                }`}
              />
              {errors.login && (
                <p className="text-xs text-destructive font-medium">{errors.login.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-foreground/80"
                >
                  Password
                </label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`w-full h-11 pl-4 pr-11 rounded-xl border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
                    errors.password
                      ? 'border-destructive/60 focus:ring-destructive/20'
                      : 'border-border hover:border-border/80'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl nexus-gradient text-white text-sm font-semibold shadow-glow-primary hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="text-primary-500 hover:text-primary-600 font-semibold transition-colors"
            >
              Create account
            </Link>
          </p>
        </div>

        {/* Bottom caption */}
        <p className="mt-auto pt-8 text-xs text-muted-foreground/40 text-center">
          © {new Date().getFullYear()} {nexusTheme.brand.fullName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
