import type { FC } from 'react';
import type { TimelineDefectMarker } from '@/types/inspection';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Info, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipeTimelineProps {
  defects?: TimelineDefectMarker[];
  currentDistance?: number | null;
  maxDistance?: number;
  className?: string;
}

/**
 * Longitudinal Conduit Defect Distance Timeline
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 11.3 & 15:
 * - Maps localized pipe findings along the conduit invert.
 * - Prior to empirical wheel calibration and clock synchronization, distances are explicitly labeled "Estimated location".
 * - Renders an empty state when no defect markers exist (no sample defects fabricated).
 */
export const PipeTimeline: FC<PipeTimelineProps> = ({
  defects = [],
  currentDistance = null,
  maxDistance = 50,
  className,
}) => {
  const hasDefects = defects.length > 0;

  return (
    <Card
      className={cn('space-y-3', className)}
      title="Conduit Defect Localization Timeline"
      description="Spatial distribution of anomalies along conduit invert (Estimated locations)"
      headerAction={<Badge variant="neutral">Odometry Sync</Badge>}
    >
      <div className="space-y-4">
        {hasDefects ? (
          <div className="space-y-2">
            {/* Visual Track Bar */}
            <div className="relative w-full h-8 bg-cream-200 border border-pipeblack rounded-sm flex items-center px-2 shadow-industrial-sm">
              {/* Pipe Invert Centerline */}
              <div className="absolute left-2 right-2 h-0.5 bg-pipeborder" />

              {/* Current Robot Position Marker */}
              {currentDistance !== null && (
                <div
                  style={{
                    left: `${Math.max(0, Math.min(100, (currentDistance / maxDistance) * 100))}%`,
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-20"
                >
                  <div className="w-3 h-3 bg-pipeyellow border border-pipeblack rounded-full shadow-industrial-sm" />
                </div>
              )}

              {/* Defect Markers */}
              {defects.map((defect) => {
                const pos = Math.max(0, Math.min(100, (defect.estimatedDistance / maxDistance) * 100));
                return (
                  <div
                    key={defect.id}
                    style={{ left: `${pos}%` }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer z-10"
                    title={`${defect.className} at ~${defect.estimatedDistance.toFixed(2)}m (${Math.round(defect.confidence * 100)}% conf)`}
                  >
                    <MapPin className="w-4 h-4 text-pipestatus-critical fill-pipestatus-critical" />
                  </div>
                );
              })}
            </div>

            {/* Track End Labels */}
            <div className="flex items-center justify-between text-[11px] font-mono text-pipeblack-muted">
              <span>0.0 m (Inspection Invert)</span>
              <span>{maxDistance.toFixed(1)} m (Track Scale)</span>
            </div>
          </div>
        ) : (
          /* Honest Empty Timeline */
          <div className="py-7 px-4 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-pipeborder rounded-sm bg-cream-50">
            <span className="text-xs font-mono font-bold text-pipeblack uppercase">
              No Conduit Defects Recorded
            </span>
            <p className="text-xs text-pipeblack-muted max-w-md leading-relaxed">
              When an inspection runs, detected anomalies will appear along this longitudinal distance line correlating frame capture times with encoder telemetry.
            </p>
            <div className="w-full max-w-md mt-2 flex items-center justify-between text-[10px] font-mono text-pipeblack-muted">
              <span>0.0 m (Inspection Start)</span>
              <span className="text-pipeborder">&bull; &bull; &bull;</span>
              <span>Conduit Reach (Pending Run)</span>
            </div>
          </div>
        )}

        {/* Estimation Notice */}
        <div className="flex items-start gap-1.5 text-[10px] font-mono text-pipeblack-muted border-t border-pipeborder pt-2">
          <Info className="w-3.5 h-3.5 text-pipeyellow-hover shrink-0 mt-0.5" />
          <span>
            Rulebook § 11.3: Distance calculations represent straight-line approximations subject to wheel slip and traction.
          </span>
        </div>
      </div>
    </Card>
  );
};

