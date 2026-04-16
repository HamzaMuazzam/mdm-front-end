import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary' | 'link' | 'soft';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[1.1rem] border border-transparent font-semibold tracking-tight transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.99]',
          variant === 'default' &&
            'brand-gradient text-white shadow-card hover:opacity-95',
          variant === 'destructive' &&
            'bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/92',
          variant === 'outline' &&
            'border-border bg-card/85 text-foreground hover:border-border/80 hover:bg-muted/80',
          variant === 'ghost' &&
            'bg-transparent text-foreground hover:bg-muted/75 hover:text-foreground',
          variant === 'secondary' &&
            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          variant === 'soft' &&
            'border-[color:var(--primary-soft)] bg-[color:var(--primary-soft)] text-primary hover:opacity-90',
          variant === 'link' &&
            'text-primary-500 underline-offset-4 hover:underline p-0 h-auto shadow-none',
          size === 'default' && 'h-11 px-4 py-2 text-sm',
          size === 'sm' && 'h-9 rounded-xl px-3 text-xs',
          size === 'lg' && 'h-12 px-6 text-base',
          size === 'icon' && 'h-11 w-11 rounded-2xl p-0',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
