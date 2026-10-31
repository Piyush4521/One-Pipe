import type { FC } from 'react';
import type { TelemetrySnapshot } from '@/types/inspection';
import { MetricCard } from '@/components/ui/MetricCard';
import { Gauge, Activity, RotateCw, Compass, Binary, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TelemetryPanelProps {
  telemetry?: TelemetrySnapshot;
  className?: string;
}

/**
 * Robot Vehicle Telemetry Panel
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 11:
 * - Encoder pulse counts and MPU6050 attitude are published by the ESP32.
 * - Prior to empirical calibration of PPR and wheel circumference, distance is an uncalibrated estimate.
 * - When disconnected or unreceived, fields explicitly display unavailable (——) states.
 */
export const TelemetryPanel: FC<TelemetryPanelProps> = ({
  telemetry,
  className,
}) => {
  const isAvailable = Boolean(telemetry && !telemetry.isStale && telemetry.timestamp !== null);

  const formatNumber = (val: number | null | undefined, digits = 2): string | null => {
    if (!isAvailable || val === null || val === undefined) return null;
    return val.toFixed(digits);
  };

  const formatRound = (val: number | null | undefined): string | null => {
    if (!isAvailable || val === null || val === undefined) return null;
    return Math.round(val).toString();
  };

  const formatCount = (val: number | null | undefined): string | null => {
    if (!isAvailable || val === null || val === undefined) return null;
    return val.toString();
  };

  const formatAngle = (val: number | null | undefined): string => {
    if (!isAvailable || val === null || val === undefined) return '——';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}°`;
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Telemetry Header with Freshness Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-pipeblack">
            Telemetry Stream
          </h2>
          {telemetry?.isStale && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-pipestatus-warning bg-pipestatus-warning-bg px-1.5 py-0.5 rounded-sm border border-pipestatus-warning-border">
              <AlertCircle className="w-3 h-3" />
              Stale Data
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-pipeblack-muted">
          <Clock className="w-3 h-3 text-pipeblack-subtle" />
          <span>Last Update: {telemetry?.timestamp ?? '——'}</span>
        </div>
      </div>

      {/* Primary Kinematic Telemetry */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Estimated Distance"
          value={formatNumber(telemetry?.distance, 2)}
          unit="m"
          subtext="Calibrated odometry"
          isUnavailable={!isAvailable || telemetry?.distance === null || telemetry?.distance === undefined}
          icon={<Gauge className="w-3.5 h-3.5" />}
          variant="highlight"
        />
        <MetricCard
          label="Translational Speed"
          value={formatNumber(telemetry?.speed, 2)}
          unit="m/s"
          subtext="Linear forward velocity"
          isUnavailable={!isAvailable || telemetry?.speed === null || telemetry?.speed === undefined}
          icon={<Activity className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Dual Motor RPM */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Left Motor RPM"
          value={formatRound(telemetry?.leftRpm)}
          unit="RPM"
          subtext="BO gearmotor left"
          isUnavailable={!isAvailable || telemetry?.leftRpm === null || telemetry?.leftRpm === undefined}
          icon={<RotateCw className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Right Motor RPM"
          value={formatRound(telemetry?.rightRpm)}
          unit="RPM"
          subtext="BO gearmotor right"
          isUnavailable={!isAvailable || telemetry?.rightRpm === null || telemetry?.rightRpm === undefined}
          icon={<RotateCw className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Raw Encoder Counts */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Left Raw Pulses"
          value={formatCount(telemetry?.leftEncoderCount)}
          subtext="Channel A/B transitions"
          isUnavailable={!isAvailable || telemetry?.leftEncoderCount === null || telemetry?.leftEncoderCount === undefined}
          icon={<Binary className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Right Raw Pulses"
          value={formatCount(telemetry?.rightEncoderCount)}
          subtext="Channel A/B transitions"
          isUnavailable={!isAvailable || telemetry?.rightEncoderCount === null || telemetry?.rightEncoderCount === undefined}
          icon={<Binary className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Inertial MPU6050 Attitude */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-pipeblack-muted mb-2">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-pipeblack-subtle" />
            <span>MPU6050 Attitude Angles</span>
          </div>
          <span className="text-[10px] text-pipeblack-subtle font-normal">Chassis Plane</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div className="p-2 bg-cream-50 border border-pipeborder rounded-sm">
            <span className="text-[10px] text-pipeblack-muted block uppercase">Pitch</span>
            <span className="font-bold text-pipeblack text-sm">
              {formatAngle(telemetry?.pitch)}
            </span>
          </div>
          <div className="p-2 bg-cream-50 border border-pipeborder rounded-sm">
            <span className="text-[10px] text-pipeblack-muted block uppercase">Roll</span>
            <span className="font-bold text-pipeblack text-sm">
              {formatAngle(telemetry?.roll)}
            </span>
          </div>
          <div className="p-2 bg-cream-50 border border-pipeborder rounded-sm">
            <span className="text-[10px] text-pipeblack-muted block uppercase">Yaw</span>
            <span className="font-bold text-pipeblack text-sm">
              {formatAngle(telemetry?.yaw)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
