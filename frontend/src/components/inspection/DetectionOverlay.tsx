import type { FC } from 'react';
import type { DetectionBox } from '@/types/inspection';
import { cn } from '@/lib/utils';

export interface DetectionOverlayProps {
  detections?: DetectionBox[];
  className?: string;
  isStreaming?: boolean;
}

/**
 * AI Detection Bounding Box Presentation Layer
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 12.3 & 14.3:
 * - Rendered strictly relative to the source frame geometry (using percentage coordinates).
 * - Detections must be paired with original frame ID and frame capture timestamp.
 * - Confidence reflects model certainty, not physical defect severity (§ 14.5).
 * - When detections array is empty or undefined, zero boxes are rendered.
 */
export const DetectionOverlay: FC<DetectionOverlayProps> = ({
  detections = [],
  className,
  isStreaming = false,
}) => {
  if (!isStreaming || detections.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden z-10',
        className
      )}
      aria-label="AI Defect Detections Overlay"
    >
      {detections.map((detection) => {
        // Convert normalized coordinates (0.0 to 1.0) into CSS percentages
        const style = {
          left: `${Math.max(0, Math.min(100, detection.x * 100))}%`,
          top: `${Math.max(0, Math.min(100, detection.y * 100))}%`,
          width: `${Math.max(0, Math.min(100, detection.width * 100))}%`,
          height: `${Math.max(0, Math.min(100, detection.height * 100))}%`,
        };

        const confidencePct = Math.round(detection.confidence * 100);

        return (
          <div
            key={detection.id}
            style={style}
            className="absolute border-2 border-pipeyellow bg-pipeyellow/10 rounded-[1px] transition-all"
          >
            {/* Tag Label with class and model confidence */}
            <div className="absolute -top-5 left-0 bg-pipeblack text-pipeyellow font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-pipeyellow shadow-industrial-sm flex items-center gap-1.5 whitespace-nowrap">
              <span className="uppercase">{detection.className}</span>
              <span className="text-cream-100 font-normal opacity-90">
                {confidencePct}% conf
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

