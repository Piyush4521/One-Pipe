import type { FC } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmergencyStopButtonProps {
  className?: string;
  isBackendConnected?: boolean;
  onEmergencyStop?: () => Promise<void> | void;
  isTriggering?: boolean;
}

/**
 * Software Emergency Stop UI
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 10.2:
 * - Software Emergency Stop provides secondary command-level shutdown via backend.
 * - The dedicated physical emergency stop on the chassis remains the independent primary safety mechanism.
 */
export const EmergencyStopButton: FC<EmergencyStopButtonProps> = ({
  className,
  isBackendConnected = false,
  onEmergencyStop,
  isTriggering = false,
}) => {
  return (
    <div
      className={cn(
        'p-4 bg-white border-2 border-pipestatus-critical rounded-sm shadow-industrial-subtle space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-pipestatus-critical shrink-0" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider text-pipestatus-critical">
            Software Emergency Stop
          </span>
        </div>
        <Badge variant={isBackendConnected ? 'critical' : 'neutral'}>
          {isBackendConnected ? 'Armed' : 'Not Connected'}
        </Badge>
      </div>

      {/* Prominent High-Visibility Stop Control */}
      <Button
        variant="danger"
        size="lg"
        disabled={!isBackendConnected || isTriggering}
        onClick={onEmergencyStop}
        className="w-full text-sm font-bold tracking-wider uppercase font-mono h-12 shadow-industrial"
      >
        {isTriggering
          ? 'TRIGGERING EMERGENCY STOP...'
          : isBackendConnected
          ? 'EMERGENCY STOP (ARMED)'
          : 'SOFTWARE STOP (NOT CONNECTED)'}
      </Button>

      {/* Explicit Safety Notice */}
      <div className="space-y-2 pt-1 text-xs">
        <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm space-y-1.5 text-[11px] leading-relaxed text-pipeblack-muted">
          <div className="flex items-start gap-1.5 text-pipeblack">
            <ShieldAlert className="w-4 h-4 text-pipestatus-critical shrink-0 mt-0.5" />
            <span className="font-bold font-mono uppercase">
              {isBackendConnected ? 'Software Halt Armed' : 'No Software Stop Command Can Currently Be Sent'}
            </span>
          </div>
          <p>
            {isBackendConnected
              ? 'Clicking Emergency Stop transmits an immediate halt directive to the backend command queue and logs a critical safety event.'
              : 'The software emergency stop requires an active backend link. All robot movement commands remain disabled.'}
          </p>
          <div className="flex items-start gap-1.5 text-pipeblack pt-1 border-t border-pipeborder/60">
            <ShieldCheck className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
            <span>
              <strong>Primary Safety Path:</strong> The dedicated physical emergency-stop button on the robot chassis is the independent hardware safety mechanism. It operates electrically without reliance on Wi-Fi, software, or microcontrollers.
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-pipeblack-subtle flex items-center justify-between">
          <span>Backend Stop Path: {isBackendConnected ? 'Linked (HTTP / WS)' : 'Unlinked'}</span>
          <span>Physical Chassis Stop: Primary</span>
        </div>
      </div>
    </div>
  );
};
