import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { otpSchema } from '@/utils/validators';
import { useVerifyOtp, useSendOtp } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OtpForm {
  otp: string;
}

export function VerifyOtpPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const verifyMutation = useVerifyOtp();
  const sendOtpMutation = useSendOtp();

  useEffect(() => {
    const pendingEmail = localStorage.getItem('pendingEmail');
    if (pendingEmail) {
      setEmail(pendingEmail);
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpForm>({
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

  const handleResendOtp = async () => {
    try {
      setError('');
      setSuccessMessage('');
      await sendOtpMutation.mutateAsync({ email });
      setSuccessMessage('OTP sent successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to <br />
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md text-center">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 text-sm text-success bg-success/10 rounded-md text-center">
                {successMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                placeholder="6-digit code"
                maxLength={6}
                {...register('otp')}
              />
              {errors.otp && <p className="text-sm text-destructive">{errors.otp.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Email'}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={sendOtpMutation.isPending}
                className="text-primary hover:underline"
              >
                {sendOtpMutation.isPending ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
