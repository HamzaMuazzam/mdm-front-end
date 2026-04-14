import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]',
          // Variants
          variant === 'default' &&
            'nexus-gradient text-white shadow-glow-primary hover:opacity-90',
          variant === 'destructive' &&
            'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          variant === 'outline' &&
            'border border-border bg-surface text-foreground hover:bg-muted hover:border-border/80',
          variant === 'ghost' &&
            'text-foreground hover:bg-muted hover:text-foreground',
          variant === 'secondary' &&
            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          variant === 'link' &&
            'text-primary-500 underline-offset-4 hover:underline p-0 h-auto shadow-none',
          // Sizes
          size === 'default' && 'h-10 px-4 py-2 text-sm',
          size === 'sm' && 'h-8 px-3 text-xs rounded-lg',
          size === 'lg' && 'h-12 px-6 text-base',
          size === 'icon' && 'h-9 w-9 p-0',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
