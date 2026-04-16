import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScreenIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SurfaceCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden border-white/60 bg-card/92 shadow-card', className)}>
      {children}
    </Card>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'bg-[color:var(--primary-soft)] text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  };

  return (
    <SurfaceCard className="card-lift">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70',
              tones[tone]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

export function StatusBadge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tones = {
    default:
      'border-border bg-muted/70 text-muted-foreground',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200',
    danger:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200',
    info:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition',
        active
          ? 'border-transparent bg-foreground text-background shadow-lg'
          : 'border-border bg-card/70 text-muted-foreground hover:border-border/80 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <SurfaceCard>
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-[color:var(--primary-soft)] text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction}>
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </CardContent>
    </SurfaceCard>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </SurfaceCard>
  );
}

export function MiniTrend({
  values,
  color = 'var(--primary-solid)',
}: {
  values: number[];
  color?: string;
}) {
  if (!values.length) {
    return (
      <div className="h-24 rounded-[1.4rem] border border-dashed border-border bg-muted/40" />
    );
  }

  const width = 240;
  const height = 80;
  const padding = 10;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x =
        padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-[1.4rem] border border-border bg-muted/35 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}
