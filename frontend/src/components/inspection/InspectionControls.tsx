import type { FC } from 'react';
import type { InspectionLifecycleState } from '@/types/inspection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Play, Pause, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InspectionControlsProps {
  lifecycleState?: InspectionLifecycleState;
  isBackendConnected?: boolean;
  className?: string;
}

/**
 * Inspection Session Workflow & Lifecycle Bar
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 9:
 * - Workflow: Connect robot -> Verify subsystems -> Create inspection -> Start -> Inspect -> Complete -> Back up.
 * - Actions remain disabled until backend services and hardware readiness are verified.
 * - No active inspection or simulated state transitions are mocked.
 */
export const InspectionControls: FC<InspectionControlsProps> = ({
  lifecycleState = 'disconnected',
  isBackendConnected = false,
  className,
}) => {
  const stateLabels: Record<InspectionLifecycleState, { label: string; badge: 'neutral' | 'success' | 'warning' | 'critical' }> = {
    disconnected: { label: 'Subsystems Disconnected', badge: 'neutral' },
    ready: { label: 'Ready to Inspect', badge: 'neutral' },
    running: { label: 'Inspection Active', badge: 'success' },
    paused: { label: 'Inspection Paused', badge: 'warning' },
    completed: { label: 'Session Finalized', badge: 'neutral' },
    recovery_required: { label: 'Recovery Required', badge: 'critical' },
  };

  const current = stateLabels[lifecycleState];

  return (
    <div
      className={cn(
        'p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-col md:flex-row md:items-center justify-between gap-4',
        className
      )}
    >
      {/* Current State & Connectivity */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={current.badge}>State: {current.label}</Badge>
        <div className="h-4 w-px bg-pipeborder hidden sm:block" />
        <div className="flex items-center gap-2">
          <StatusIndicator
            status={isBackendConnected ? 'healthy' : 'offline'}
            size="sm"
            label={isBackendConnected ? 'Backend Connected' : 'Inspection Service Offline'}
          />
        </div>
      </div>

      {/* Lifecycle Action Buttons (Disabled in Stage 1) */}
      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
        <Button
          variant="primary"
          size="sm"
          disabled={!isBackendConnected || lifecycleState === 'running'}
          leftIcon={<Play className="w-3.5 h-3.5" />}
        >
          Start
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!isBackendConnected || lifecycleState !== 'running'}
          leftIcon={<Pause className="w-3.5 h-3.5" />}
        >
          Pause
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!isBackendConnected || (lifecycleState !== 'running' && lifecycleState !== 'paused')}
          leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
        >
          Complete Run
        </Button>
      </div>
    </div>
  );
};
