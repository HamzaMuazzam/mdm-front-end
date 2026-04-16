import { cn } from '@/lib/utils';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  helper?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'grid gap-2 rounded-[1.4rem] border border-border bg-muted/60 p-1.5',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[1.05rem] px-3 py-2.5 text-left transition duration-150',
              active
                ? 'bg-card text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
            )}
          >
            <div className="text-sm font-semibold">{option.label}</div>
            {option.helper ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{option.helper}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
