import type { FC } from 'react';
import {
  CameraViewport,
  InspectionControls,
  TelemetryPanel,
  RobotControlPad,
  EmergencyStopButton,
  PipeTimeline,
} from '@/components/inspection';
import { ShieldAlert } from 'lucide-react';

export const LiveInspectionPage: FC = () => {
  return (
    <div className="space-y-6">
      {/* 1. Inspection Session Lifecycle Bar */}
      <InspectionControls
        lifecycleState="disconnected"
        isBackendConnected={false}
      />

      {/* 2. Main Inspection Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Video Viewport & Defect Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Optical Camera Feed Viewport */}
          <CameraViewport
            streamUrl={null}
            isConnected={false}
            detections={[]}
          />

          {/* Conduit Distance Timeline */}
          <PipeTimeline
            defects={[]}
            currentDistance={null}
          />
        </div>

        {/* Right Column: Telemetry, Laptop Controls & Emergency Stop */}
        <div className="space-y-6">
          {/* Telemetry Gauges */}
          <TelemetryPanel />

          {/* Laptop-Only Robot Directional Movement Controls */}
          {/* Strictly excluded on mobile viewports (< 768px) per Rulebook § 3 & 10.1 */}
          <div className="hidden md:block">
            <RobotControlPad isControlActive={false} />
          </div>

          {/* Mobile Monitoring Mode Notice (Rendered only on narrow mobile viewports) */}
          <div className="md:hidden p-3.5 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted flex items-start gap-2.5 shadow-industrial-subtle">
            <ShieldAlert className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-pipeblack font-mono uppercase block">
                Mobile Monitoring Viewport
              </span>
              <p className="text-[11px] leading-relaxed">
                Robot movement controls are omitted on mobile devices.
                In accordance with project engineering rules, drive commands can only be transmitted from the laptop station.
              </p>
            </div>
          </div>

          {/* Software Emergency Stop Control */}
          <EmergencyStopButton isBackendConnected={false} />
        </div>
      </div>
    </div>
  );
};
