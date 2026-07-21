import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSendOtp, useUpdatePassword } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const step1Schema = z.object({
  email: z.string().email('Invalid email format'),
});

const step2Schema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;

export function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const sendOtpMutation = useSendOtp();
  const updatePasswordMutation = useUpdatePassword();

  const form1 = useForm<Step1FormData>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2FormData>({ resolver: zodResolver(step2Schema) });

  const onSendOtp = async (data: { email: string }) => {
    try {
      setError('');
      await sendOtpMutation.mutateAsync({ email: data.email });
      setEmail(data.email);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const onResetPassword = async (data: { otp: string; password: string }) => {
    try {
      setError('');
      await updatePasswordMutation.mutateAsync({
        email,
        otp: data.otp,
        password: data.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-0 p-4">
        <Card className="w-full max-w-md mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
          <CardHeader className="text-center px-6 sm:px-8 pt-6 sm:pt-8">
            <CardTitle className="text-xl font-semibold text-green-700">Password Reset Successful!</CardTitle>
            <CardDescription>Redirecting to login...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-0 p-4">
      <Card className="w-full max-w-md mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="text-center px-6 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-xl font-semibold text-gray-900">Reset Password</CardTitle>
          <CardDescription>
            {step === 1 ? 'Enter your email to receive OTP' : 'Enter OTP and new password'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          {step === 1 ? (
            <form onSubmit={form1.handleSubmit(onSendOtp)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" className="w-full" {...form1.register('email')} />
                {form1.formState.errors.email && (
                  <p className="text-sm text-destructive">{form1.formState.errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={sendOtpMutation.isPending}>
                {sendOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
              </Button>

              <div className="text-center text-sm">
                <Link to={ROUTES.LOGIN} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={form2.handleSubmit(onResetPassword)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp">OTP</Label>
                <Input id="otp" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="w-full" {...form2.register('otp')} />
                {form2.formState.errors.otp && (
                  <p className="text-sm text-destructive">{form2.formState.errors.otp.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  className="w-full"
                  {...form2.register('password')}
                />
                {form2.formState.errors.password && (
                  <p className="text-sm text-destructive">{form2.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={updatePasswordMutation.isPending}>
                {updatePasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
