import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, Lock, Hash } from 'lucide-react';
import { useSendOtp, useUpdatePassword } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import { nexusTheme } from '@/lib/theme';

const step1Schema = z.object({ email: z.string().email('Invalid email') });
const step2Schema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  password: z.string().min(8, 'At least 8 characters'),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

function FieldRow({
  id,
  label,
  error,
  icon,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground/80">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  `w-full h-11 pl-10 pr-4 rounded-xl border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
    hasError ? 'border-destructive/60' : 'border-border'
  }`;

export function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const sendOtp = useSendOtp();
  const updatePassword = useUpdatePassword();

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) });

  const onSendOtp = async (data: Step1) => {
    try {
      setError('');
      await sendOtp.mutateAsync({ email: data.email });
      setEmail(data.email);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const onReset = async (data: Step2) => {
    try {
      setError('');
      await updatePassword.mutateAsync({ email, otp: data.otp, password: data.password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
        <div className="flex flex-col items-center gap-4 animate-scale-in text-center max-w-xs">
          <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Password reset!</h2>
          <p className="text-muted-foreground text-sm">Your password has been updated successfully.</p>
          <Link
            to={ROUTES.LOGIN}
            className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-xl nexus-gradient text-white text-sm font-semibold hover:opacity-90 transition-all"
          >
            Go to Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

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
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-8 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-primary-500' : 'bg-muted'}`} />
          <div className={`w-8 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-primary-500' : 'bg-muted'}`} />
        </div>

        <div className="mb-7">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {step === 1 ? 'Reset password' : 'Enter your OTP'}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {step === 1
              ? "We'll send a one-time code to your email"
              : `Check your inbox at ${email}`}
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

        {step === 1 ? (
          <form onSubmit={form1.handleSubmit(onSendOtp)} className="space-y-4">
            <FieldRow
              id="email"
              label="Email address"
              error={form1.formState.errors.email?.message}
              icon={<Mail className="h-4 w-4" />}
            >
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...form1.register('email')}
                className={inputCls(!!form1.formState.errors.email)}
              />
            </FieldRow>

            <button
              type="submit"
              disabled={sendOtp.isPending}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl nexus-gradient text-white text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sendOtp.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <>Send OTP <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={form2.handleSubmit(onReset)} className="space-y-4">
            <FieldRow
              id="otp"
              label="One-time code"
              error={form2.formState.errors.otp?.message}
              icon={<Hash className="h-4 w-4" />}
            >
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                maxLength={6}
                {...form2.register('otp')}
                className={inputCls(!!form2.formState.errors.otp)}
              />
            </FieldRow>

            <FieldRow
              id="password"
              label="New password"
              error={form2.formState.errors.password?.message}
              icon={<Lock className="h-4 w-4" />}
            >
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...form2.register('password')}
                className={inputCls(!!form2.formState.errors.password)}
              />
            </FieldRow>

            <button
              type="submit"
              disabled={updatePassword.isPending}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl nexus-gradient text-white text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {updatePassword.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>
              ) : (
                <>Reset Password <ArrowRight className="h-4 w-4" /></>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remember it?{' '}
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
