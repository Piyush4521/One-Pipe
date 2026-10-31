import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'critical' | 'yellow';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', size = 'sm', children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center font-mono font-medium uppercase tracking-wider rounded-sm border select-none';

    const variants = {
      neutral: 'bg-cream-100 text-pipeblack-muted border-pipeborder',
      success: 'bg-pipestatus-healthy-bg text-pipestatus-healthy border-pipestatus-healthy-border',
      warning: 'bg-pipestatus-warning-bg text-pipestatus-warning border-pipestatus-warning-border',
      critical: 'bg-pipestatus-critical-bg text-pipestatus-critical border-pipestatus-critical-border',
      yellow: 'bg-pipeyellow-subtle text-pipeblack border-pipeyellow font-bold',
    };

    const sizes = {
      sm: 'text-[10px] px-1.5 py-0.5 leading-none',
      md: 'text-xs px-2 py-0.5 leading-tight',
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

