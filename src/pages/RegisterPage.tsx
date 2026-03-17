import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@/utils/validators';
import { useRegister } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

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
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-0 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center px-6 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-2xl sm:text-3xl">Create Account</CardTitle>
          <CardDescription>Register for TW MDM Portal</CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter your email" className="w-full" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">Username <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="userName" placeholder="Display name" className="w-full" {...register('userName')} />
              {errors.userName && <p className="text-sm text-destructive">{errors.userName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                className="w-full"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="phone" type="tel" placeholder="+1234567890" className="w-full" {...register('phone')} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
