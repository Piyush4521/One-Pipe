import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value?: string | number | null;
  unit?: string;
  subtext?: string;
  icon?: ReactNode;
  isUnavailable?: boolean;
  variant?: 'default' | 'highlight' | 'warning' | 'critical';
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      label,
      value,
      unit,
      subtext,
      icon,
      isUnavailable = false,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    const isDataMissing = isUnavailable || value === undefined || value === null;

    const variants = {
      default: 'border-pipeborder bg-white',
      highlight: 'border-pipeyellow bg-cream-50',
      warning: 'border-pipestatus-warning bg-pipestatus-warning-bg',
      critical: 'border-pipestatus-critical bg-pipestatus-critical-bg',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'p-3.5 border rounded-sm shadow-industrial-subtle flex flex-col justify-between transition-colors',
          variants[variant],
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-pipeblack-muted font-mono">
            {label}
          </span>
          {icon && <span className="text-pipeblack-subtle shrink-0">{icon}</span>}
        </div>

        <div className="flex items-baseline gap-1.5 my-0.5">
          {isDataMissing ? (
            <span className="text-xl font-bold font-mono text-pipeblack-subtle tracking-tight">
              &mdash;&mdash;
            </span>
          ) : (
            <span className="text-2xl font-bold font-mono text-pipeblack tracking-tight leading-none">
              {value}
            </span>
          )}

          {unit && !isDataMissing && (
            <span className="text-xs font-mono text-pipeblack-muted font-medium">
              {unit}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-[10px] text-pipeblack-subtle mt-1 line-clamp-1">{subtext}</p>
        )}
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';

