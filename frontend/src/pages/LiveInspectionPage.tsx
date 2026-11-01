import { useState, useCallback, type FC } from 'react';
import {
  CameraViewport,
  InspectionControls,
  TelemetryPanel,
  RobotControlPad,
  EmergencyStopButton,
  PipeTimeline,
} from '@/components/inspection';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { useWebSocketTelemetry } from '@/hooks/useWebSocketTelemetry';
import { api } from '@/services/api';
import type { InspectionLifecycleState } from '@/types/inspection';

export const LiveInspectionPage: FC = () => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localState, setLocalState] = useState<InspectionLifecycleState>('ready');
  const [isStopping, setIsStopping] = useState(false);
  const [stopAlert, setStopAlert] = useState<string | null>(null);

  const handleEmergencyStopAck = useCallback((_data: unknown) => {
    setStopAlert('Emergency Stop confirmed by backend.');
    setLocalState('recovery_required');
  }, []);

  const { status, telemetry, inspectionState } = useWebSocketTelemetry({
    onEmergencyStopAck: handleEmergencyStopAck,
  });

  const isConnected = status === 'connected';
  const effectiveLifecycle: InspectionLifecycleState = !isConnected
    ? 'disconnected'
    : (inspectionState?.status || localState);

  const handleStart = async () => {
    try {
      let id = activeSessionId;
      if (!id) {
        const newSession = await api.inspections.create({
          conduitName: 'Live PVC Run',
          operatorNotes: 'Initiated from Live Inspection Console',
        });
        id = newSession.id;
        setActiveSessionId(id);
      }
      await api.inspections.updateStatus(id, 'running');
      setLocalState('running');
    } catch (err) {
      setStopAlert(err instanceof Error ? err.message : 'Failed to start inspection session');
    }
  };

  const handlePause = async () => {
    try {
      if (activeSessionId) {
        await api.inspections.updateStatus(activeSessionId, 'paused');
        setLocalState('paused');
      }
    } catch (err) {
      setStopAlert(err instanceof Error ? err.message : 'Failed to pause inspection session');
    }
  };

  const handleComplete = async () => {
    try {
      if (activeSessionId) {
        await api.inspections.updateStatus(activeSessionId, 'completed');
        setLocalState('completed');
      }
    } catch (err) {
      setStopAlert(err instanceof Error ? err.message : 'Failed to complete inspection session');
    }
  };

  const handleEmergencyStop = async () => {
    setIsStopping(true);
    setStopAlert(null);
    try {
      const res = await api.robot.emergencyStop();
      setStopAlert(`Emergency stop executed: ${res.status}`);
      setLocalState('recovery_required');
    } catch (err) {
      setStopAlert(err instanceof Error ? err.message : 'Emergency stop command failed to deliver');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Stop Notice Banner if triggered */}
      {stopAlert && (
        <div className="p-3.5 bg-pipestatus-critical-bg border-l-4 border-pipestatus-critical border-y border-r border-pipestatus-critical-border rounded-sm flex items-center justify-between text-xs text-pipestatus-critical font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{stopAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setStopAlert(null)}
            className="hover:underline text-[10px] uppercase font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Inspection Session Lifecycle Bar */}
      <InspectionControls
        lifecycleState={effectiveLifecycle}
        isBackendConnected={isConnected}
        onStart={handleStart}
        onPause={handlePause}
        onComplete={handleComplete}
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
            currentDistance={telemetry?.distance ?? null}
          />
        </div>

        {/* Right Column: Telemetry, Laptop Controls & Emergency Stop */}
        <div className="space-y-6">
          {/* Telemetry Gauges */}
          <TelemetryPanel telemetry={telemetry} />

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
          <EmergencyStopButton
            isBackendConnected={isConnected}
            onEmergencyStop={handleEmergencyStop}
            isTriggering={isStopping}
          />
        </div>
      </div>
    </div>
  );
};
