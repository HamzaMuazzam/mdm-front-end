import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/utils/validators';
import { useLogin } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LoginRequest } from '@/types/auth.types';

export function LoginPage() {
  const [error, setError] = useState('');
  const loginMutation = useLogin();
  const [searchParams] = useSearchParams();
  const fcmTokenFromUrl = searchParams.get('fcmToken') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginRequest) => {
    try {
      setError('');
      await loginMutation.mutateAsync({ ...data, fcmToken: fcmTokenFromUrl });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      if (message !== 'Email not verified') {
        setError(message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-0 p-4">
      <Card className="w-full max-w-md mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="text-center px-6 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-xl font-semibold text-gray-900">TW MDM Portal</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="login">Email</Label>
              <Input
                id="login"
                type="email"
                placeholder="Enter your email"
                className="w-full"
                {...register('login')}
              />
              {errors.login && (
                <p className="text-sm text-destructive">{errors.login.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="w-full"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center space-y-2 text-sm">
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm text-blue-600 hover:text-blue-700 hover:underline block">
                Forgot Password?
              </Link>
              <div>
                Don't have an account?{' '}
                <Link to={ROUTES.REGISTER} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                  Register
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
