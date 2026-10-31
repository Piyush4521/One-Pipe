import type { FC } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  ShieldAlert,
  Laptop,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RobotControlPadProps {
  className?: string;
  isControlActive?: boolean;
}

/**
 * Laptop-Only Robot Directional Control Pad
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 3, 10.1:
 * - Movement authority is restricted exclusively to the laptop operator station.
 * - Mobile monitoring clients are strictly prohibited from issuing drive commands.
 * - Controls are disabled by default as no verified backend control service exists in Stage 1.
 * - Zero commands, fake acknowledgments, or simulated movements are transmitted.
 */
export const RobotControlPad: FC<RobotControlPadProps> = ({
  className,
  isControlActive = false,
}) => {
  return (
    <Card
      className={cn('space-y-3', className)}
      title="Laptop Robot Movement Controls"
      description="Operator directional control pad (Restricted to laptop station)"
      headerAction={<Badge variant="neutral">Laptop Only</Badge>}
    >
      <div className="space-y-3.5">
        {/* Status Callout Banner */}
        <div className="p-2.5 bg-cream-100 border border-pipeborder rounded-sm text-xs text-pipeblack-muted flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-pipeblack font-mono block">
              Control Service Unavailable
            </span>
            <span className="text-[11px] leading-relaxed block">
              Movement commands remain completely disabled until the Node.js backend WebSocket broker and ESP32 command watchdog are integrated in Stage 3.
            </span>
          </div>
        </div>

        {/* Directional Pad Visualization (Disabled) */}
        <div className="flex flex-col items-center gap-2 py-1 select-none">
          {/* Forward */}
          <Button
            variant="outline"
            size="md"
            disabled={!isControlActive}
            className="w-24 font-mono font-bold"
            leftIcon={<ArrowUp className="w-4 h-4" />}
          >
            FWD
          </Button>

          {/* Steer Left, Stop, Steer Right */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              disabled={!isControlActive}
              className="w-24 font-mono font-bold"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              LEFT
            </Button>

            <Button
              variant="secondary"
              size="md"
              disabled={!isControlActive}
              className="w-24 font-mono font-bold bg-pipeblack text-white hover:bg-pipeblack-soft"
              leftIcon={<Square className="w-3.5 h-3.5" />}
            >
              STOP
            </Button>

            <Button
              variant="outline"
              size="md"
              disabled={!isControlActive}
              className="w-24 font-mono font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              RIGHT
            </Button>
          </div>

          {/* Reverse */}
          <Button
            variant="outline"
            size="md"
            disabled={!isControlActive}
            className="w-24 font-mono font-bold"
            leftIcon={<ArrowDown className="w-4 h-4" />}
          >
            REV
          </Button>
        </div>

        {/* Safety Note on Operator Authority */}
        <div className="pt-2.5 border-t border-pipeborder text-[10px] font-mono text-pipeblack-muted flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-pipeblack-subtle" />
            <span>Authority: Laptop Console Exclusive</span>
          </div>
          <span>Watchdog: Unconfigured</span>
        </div>
      </div>
    </Card>
  );
};

