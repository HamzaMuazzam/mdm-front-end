import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Hash, Loader2, RefreshCw } from 'lucide-react';
import { otpSchema } from '@/utils/validators';
import { useVerifyOtp, useSendOtp } from '@/hooks/useAuth';
import { nexusTheme } from '@/lib/theme';

interface OtpForm { otp: string }

export function VerifyOtpPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const verifyMutation = useVerifyOtp();
  const sendOtpMutation = useSendOtp();

  useEffect(() => {
    const pendingEmail = localStorage.getItem('pendingEmail');
    if (pendingEmail) setEmail(pendingEmail);
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
  });

  const onSubmit = async (data: OtpForm) => {
    try {
      setError('');
      await verifyMutation.mutateAsync({ email, otp: data.otp });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP');
    }
  };

  const handleResend = async () => {
    try {
      setError('');
      setResent(false);
      await sendOtpMutation.mutateAsync({ email });
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
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
        {/* Email icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl nexus-gradient-soft border border-primary-100 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-primary-500" />
          </div>
        </div>

        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Check your email</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            We sent a 6-digit code to
          </p>
          <p className="font-semibold text-foreground text-sm mt-0.5">{email}</p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm animate-scale-in">
            <div className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold">!</span>
            </div>
            {error}
          </div>
        )}

        {resent && (
          <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-success-50 border border-success-100 text-success-700 text-sm animate-scale-in">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Code resent successfully!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="otp" className="text-sm font-semibold text-foreground/80">
              Verification code
            </label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                maxLength={6}
                {...register('otp')}
                className={`w-full h-11 pl-10 pr-4 rounded-xl border bg-surface text-foreground text-sm text-center tracking-[0.3em] placeholder:text-muted-foreground/50 placeholder:tracking-normal outline-none transition-all duration-150 focus:ring-2 focus:ring-primary/25 focus:border-primary/50 ${
                  errors.otp ? 'border-destructive/60' : 'border-border'
                }`}
              />
            </div>
            {errors.otp && <p className="text-xs text-destructive font-medium">{errors.otp.message}</p>}
          </div>

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl nexus-gradient text-white text-sm font-semibold shadow-glow-primary hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {verifyMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
            ) : (
              <>Verify Email <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={sendOtpMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {sendOtpMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" /> Resend code</>
            )}
          </button>
        </div>
      </div>

      <p className="mt-auto pt-8 text-xs text-muted-foreground/40 text-center">
        © {new Date().getFullYear()} {nexusTheme.brand.fullName}. All rights reserved.
      </p>
    </div>
  );
}
