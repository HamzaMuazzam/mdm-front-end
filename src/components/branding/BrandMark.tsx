import { cn } from '@/lib/utils';
import { useBranding } from '@/components/branding/BrandingProvider';

const sizeClasses = {
  sm: {
    frame: 'h-10 w-10 rounded-2xl',
    text: 'text-xs',
  },
  md: {
    frame: 'h-12 w-12 rounded-[1.15rem]',
    text: 'text-sm',
  },
  lg: {
    frame: 'h-14 w-14 rounded-[1.35rem]',
    text: 'text-base',
  },
};

interface BrandMarkProps {
  size?: keyof typeof sizeClasses;
  showLabel?: boolean;
  className?: string;
}

export function BrandMark({
  size = 'md',
  showLabel = true,
  className,
}: BrandMarkProps) {
  const { branding } = useBranding();
  const classes = sizeClasses[size];

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div
        className={cn(
          'relative isolate overflow-hidden border border-white/20 bg-white/10 shadow-lg',
          classes.frame
        )}
        style={{
          background:
            'linear-gradient(145deg, var(--primary-solid) 0%, var(--secondary-solid) 55%, var(--accent-solid) 100%)',
        }}
      >
        <div className="absolute inset-[1px] rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.34),transparent_60%)]" />
        {branding.identity.logoUrl ? (
          <img
            src={branding.identity.logoUrl}
            alt={branding.identity.appName}
            className="relative h-full w-full object-cover"
          />
        ) : (
          <span
            className={cn(
              'relative flex h-full w-full items-center justify-center font-heading font-bold uppercase tracking-[0.24em] text-white',
              classes.text
            )}
          >
            {branding.identity.logoMark}
          </span>
        )}
      </div>

      {showLabel && (
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
            {branding.identity.appName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {branding.identity.domainLabel}
          </p>
        </div>
      )}
    </div>
  );
}
