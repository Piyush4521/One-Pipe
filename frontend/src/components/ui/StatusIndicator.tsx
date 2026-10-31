import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type SystemStatusType = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  status: SystemStatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusIndicator = forwardRef<HTMLDivElement, StatusIndicatorProps>(
  ({ className, status, label, size = 'md', showPulse = false, ...props }, ref) => {
    const dotColors: Record<SystemStatusType, string> = {
      healthy: 'bg-pipestatus-healthy',
      warning: 'bg-pipestatus-warning',
      critical: 'bg-pipestatus-critical',
      offline: 'bg-pipestatus-offline',
      unknown: 'bg-pipeborder',
    };

    const pulseColors: Record<SystemStatusType, string> = {
      healthy: 'bg-pipestatus-healthy',
      warning: 'bg-pipestatus-warning',
      critical: 'bg-pipestatus-critical',
      offline: 'bg-pipestatus-offline',
      unknown: 'bg-pipeborder',
    };

    const dotSizes = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
    };

    const textSizes = {
      sm: 'text-xs',
      md: 'text-xs font-medium',
      lg: 'text-sm font-medium',
    };

    const defaultLabels: Record<SystemStatusType, string> = {
      healthy: 'Online / Healthy',
      warning: 'Warning / Degraded',
      critical: 'Critical / Error',
      offline: 'Offline / Disconnected',
      unknown: 'Unknown / Checking',
    };

    const displayLabel = label ?? defaultLabels[status];

    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center gap-2 select-none', className)}
        {...props}
      >
        <span className="relative flex items-center justify-center">
          {showPulse && (status === 'healthy' || status === 'warning') && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                pulseColors[status]
              )}
            />
          )}
          <span
            className={cn('relative inline-flex rounded-full', dotSizes[size], dotColors[status])}
          />
        </span>
        {displayLabel && (
          <span className={cn('text-pipeblack', textSizes[size])}>{displayLabel}</span>
        )}
      </div>
    );
  }
);

StatusIndicator.displayName = 'StatusIndicator';

