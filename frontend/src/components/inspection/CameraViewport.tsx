import type { FC } from 'react';
import type { DetectionBox } from '@/types/inspection';
import { DetectionOverlay } from './DetectionOverlay';
import { VideoOff, Layers, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CameraViewportProps {
  streamUrl?: string | null;
  isConnected?: boolean;
  detections?: DetectionBox[];
  fps?: number | null;
  latencyMs?: number | null;
  syncSequence?: number | null;
  className?: string;
}

/**
 * Low-Latency Optical Camera Viewport
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 6.2 & 12:
 * - Direct stream from Raspberry Pi Zero 2 W over local Wi-Fi (video does NOT pass through ESP32).
 * - Decoupled presentation: Video rendering continues independently of AI inference loop.
 * - When disconnected, displays an explicit neutral unavailable state without stock video.
 */
export const CameraViewport: FC<CameraViewportProps> = ({
  streamUrl = null,
  isConnected = false,
  detections = [],
  fps = null,
  latencyMs = null,
  syncSequence = null,
  className,
}) => {
  const isStreaming = Boolean(isConnected && streamUrl);

  return (
    <div
      className={cn(
        'bg-pipeblack rounded-sm border-2 border-pipeblack shadow-industrial overflow-hidden flex flex-col',
        className
      )}
    >
      {/* Viewport Status Header Bar */}
      <div className="bg-pipeblack-soft px-3.5 py-2 border-b border-pipeborder/20 flex flex-wrap items-center justify-between text-[11px] font-mono text-cream-200 gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full inline-block',
              isStreaming ? 'bg-pipestatus-healthy animate-pulse' : 'bg-pipestatus-critical'
            )}
          />
          <span className="uppercase tracking-wider font-bold">
            {isStreaming ? 'Optical Feed: Active' : 'Optical Feed: Offline'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-pipeblack-muted">
          <span>FPS: {fps !== null ? fps : '——'}</span>
          <span>Latency: {latencyMs !== null ? `${latencyMs} ms` : '——'}</span>
          <span>Sync Seq: {syncSequence !== null ? syncSequence : '——'}</span>
        </div>
      </div>

      {/* 16:9 Aspect Video Container */}
      <div className="aspect-video w-full bg-pipeblack-soft/60 relative flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        {isStreaming ? (
          <>
            {/* Future MJPEG Stream Receiver */}
            <img
              src={streamUrl!}
              alt="Live Pipe Inspection Feed"
              className="w-full h-full object-contain"
            />
            {/* AI Bounding Box Layer */}
            <DetectionOverlay detections={detections} isStreaming={true} />
          </>
        ) : (
          /* Neutral Disconnected Placeholder */
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className="p-3 bg-pipeblack border border-pipeborder/30 rounded-sm mb-3 shadow-industrial-sm">
              <VideoOff className="w-8 h-8 text-cream-200/50" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-cream-100 font-mono">
              Camera Stream Disconnected
            </h3>
            <p className="text-xs text-pipeblack-muted mt-1.5 max-w-md leading-relaxed">
              Awaiting direct HTTP/MJPEG camera connection from Raspberry Pi Zero 2 W over local Wi-Fi.
              Video frames will ingest directly to the laptop without routing through the ESP32 controller.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-pipeyellow-highlight bg-pipeblack/80 px-2.5 py-1 rounded-sm border border-pipeborder/30">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Stream URL unconfigured • Offline mode</span>
            </div>
          </div>
        )}

        {/* Viewport Overlay Diagnostics (Bottom Bar) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono text-pipeblack-muted bg-pipeblack/90 px-3 py-1.5 rounded-sm border border-pipeborder/20 z-20">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-pipeyellow" />
            <span>AI Inference: RTX 2050 (Dormant)</span>
          </div>
          <span>Frame Overlay: Synchronized</span>
        </div>
      </div>

      {/* Viewport Specification Footer */}
      <div className="bg-pipeblack-soft px-3.5 py-2 border-t border-pipeborder/20 text-[10px] font-mono text-cream-300 flex flex-wrap items-center justify-between gap-1">
        <span>Rulebook § 15.1: Defect distance correlates with frame capture time</span>
        <span className="text-pipeyellow">V1 Storage: Defect evidence only</span>
      </div>
    </div>
  );
};

