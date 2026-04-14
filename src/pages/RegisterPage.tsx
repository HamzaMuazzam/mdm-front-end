import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, User, Mail, Lock, Phone } from 'lucide-react';
import { registerSchema } from '@/utils/validators';
import { useRegister } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import { nexusTheme } from '@/lib/theme';

interface RegisterForm {
  email: string;
  userName?: string;
  password: string;
  phone?: string;
}

export function RegisterPage() {
  const [error, setError] = useState('');
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError('');
      await registerMutation.mutateAsync({
        login: data.email,
        email: data.email,
        userName: data.userName || undefined,
        password: data.password,
        phone: data.phone || undefined,
        copyConfiguration: true,
        active: true,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5 py-10">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl nexus-gradient flex items-center justify-center">
          <span className="text-white font-bold text-base">N</span>
        </div>
        <p className="text-foreground font-bold text-xl">{nexusTheme.brand.fullName}</p>
      </div>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Get started with {nexusTheme.brand.name} today
          </p>
        </div>

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
            <label htmlFor="email" className="text-sm font-semibold text-foreground/80">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('email')}
                className={`w-full h-11 pl-10 pr-4 rounded-xl border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
                  errors.email ? 'border-destructive/60' : 'border-border'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label htmlFor="userName" className="text-sm font-semibold text-foreground/80">
              Display name{' '}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="userName"
                placeholder="Your name"
                {...register('userName')}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-foreground/80">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...register('password')}
                className={`w-full h-11 pl-10 pr-4 rounded-xl border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
                  errors.password ? 'border-destructive/60' : 'border-border'
                }`}
              />
            </div>
            {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-semibold text-foreground/80">
              Phone{' '}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                {...register('phone')}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full h-11 mt-1 flex items-center justify-center gap-2 rounded-xl nexus-gradient text-white text-sm font-semibold shadow-glow-primary hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to={ROUTES.LOGIN}
            className="text-primary-500 hover:text-primary-600 font-semibold transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-auto pt-8 text-xs text-muted-foreground/40 text-center">
        © {new Date().getFullYear()} {nexusTheme.brand.fullName}. All rights reserved.
      </p>
    </div>
  );
}
