import type { FC } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmergencyStopButtonProps {
  className?: string;
  isBackendConnected?: boolean;
}

/**
 * Software Emergency Stop UI
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 10.2:
 * - Software Emergency Stop: Not connected in Stage 1.
 * - No software stop command can currently be sent.
 * - The dedicated physical emergency stop is the independent hardware safety mechanism that directly isolates motor drive power.
 * - The software stop is only a planned secondary request to be implemented after backend integration and hardware safety verification.
 * - The control remains strictly disabled.
 */
export const EmergencyStopButton: FC<EmergencyStopButtonProps> = ({
  className,
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
        <Badge variant="critical">Not Connected</Badge>
      </div>

      {/* Prominent High-Visibility Stop Control (Strictly Disabled in Stage 1) */}
      <Button
        variant="danger"
        size="lg"
        disabled
        className="w-full text-sm font-bold tracking-wider uppercase font-mono h-12 shadow-industrial"
      >
        SOFTWARE STOP (NOT CONNECTED)
      </Button>

      {/* Explicit Safety Notice */}
      <div className="space-y-2 pt-1 text-xs">
        <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm space-y-1.5 text-[11px] leading-relaxed text-pipeblack-muted">
          <div className="flex items-start gap-1.5 text-pipeblack">
            <ShieldAlert className="w-4 h-4 text-pipestatus-critical shrink-0 mt-0.5" />
            <span className="font-bold font-mono uppercase">
              No Software Stop Command Can Currently Be Sent
            </span>
          </div>
          <p>
            The software emergency stop is a planned secondary request that will only become operational after the Node.js backend and ESP32 command watchdog are integrated and validated in Stage 3.
          </p>
          <div className="flex items-start gap-1.5 text-pipeblack pt-1 border-t border-pipeborder/60">
            <ShieldCheck className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
            <span>
              <strong>Primary Safety Path:</strong> The dedicated physical emergency-stop button on the robot chassis is the independent hardware safety mechanism. It operates electrically without reliance on Wi-Fi, software, or microcontrollers.
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-pipeblack-subtle flex items-center justify-between">
          <span>Backend Stop Path: Unlinked</span>
          <span>Physical Chassis Stop: Primary</span>
        </div>
      </div>
    </div>
  );
};
