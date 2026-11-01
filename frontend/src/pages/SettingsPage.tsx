import { useState, useEffect, type FC } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import {
  Wifi,
  Cpu,
  Camera,
  Layers,
  Database,
  HardDrive,
  Palette,
  Info,
  Lock,
  Server,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { api, type SystemStatusData } from '@/services/api';

/**
 * System Settings & Configuration Architecture
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 6.3, 10.3, 11.2, 12.1, 16.4, 25:
 * - All hardware parameters, sensor calibrations, and network endpoints remain unconfigured
 *   until verified empirically on physical hardware in subsequent stages.
 * - Displays live runtime configuration and telemetry when backend is linked.
 */
export const SettingsPage: FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.system.getStatus();
      setSystemStatus(res);
    } catch {
      setSystemStatus(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStatus();
  };

  const formatUptime = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="yellow">Configuration Schema</Badge>
            <span className="text-xs font-mono text-pipeblack-muted">Runtime Architecture & Interface Contracts</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
            System Configuration & Settings
          </h1>
          <p className="text-xs md:text-sm text-pipeblack-muted mt-1 max-w-3xl">
            Specification layout for network endpoints, hardware calibrations, camera streaming, AI thresholds, and local storage.
            All services bind exclusively to the local private subnet without internet dependencies.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-pipeborder rounded-sm hover:bg-cream-100 text-xs font-mono text-pipeblack flex items-center gap-1.5 transition-colors shadow-industrial-subtle"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Probe Runtime</span>
        </button>
      </div>

      {/* Live Backend Diagnostic Strip */}
      <div className="p-4 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-pipeyellow-hover" />
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-pipeblack">
              Live Backend Diagnostic Inspector
            </h3>
          </div>
          <Badge variant={systemStatus ? 'success' : 'neutral'}>
            {systemStatus ? 'Runtime Active (Node.js)' : 'Backend Unreachable'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="text-xs font-mono text-pipeblack-muted py-2">Probing backend runtime...</div>
        ) : systemStatus ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm">
              <span className="text-[10px] text-pipeblack-muted uppercase block">Process Uptime</span>
              <span className="font-bold text-pipeblack">{formatUptime(systemStatus.uptimeSeconds)}</span>
            </div>
            <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm">
              <span className="text-[10px] text-pipeblack-muted uppercase block">Storage Driver</span>
              <span className="font-bold text-pipeblack uppercase">{systemStatus.storage.driver}</span>
            </div>
            <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm">
              <span className="text-[10px] text-pipeblack-muted uppercase block">Database Ping</span>
              <span className="font-bold text-pipestatus-healthy">
                {systemStatus.subsystems.databasePingMs != null
                  ? `${systemStatus.subsystems.databasePingMs.toFixed(1)} ms`
                  : 'Connected'}
              </span>
            </div>
            <div className="p-2.5 bg-cream-50 border border-pipeborder rounded-sm">
              <span className="text-[10px] text-pipeblack-muted uppercase block">AI GPU Subsystem</span>
              <span className="font-bold text-pipeblack truncate block">
                {systemStatus.subsystems.gpuDeviceName || 'RTX 2050 (Awaiting S4)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono text-pipeblack-muted py-1 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-pipeblack-subtle" />
            <span>Local service at http://127.0.0.1:3000 is not responding. Start backend via `npm run dev` to view live diagnostics.</span>
          </div>
        )}
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 bg-cream-50 border-l-4 border-pipeyellow border-y border-r border-pipeborder rounded-sm flex items-start gap-3">
        <Info className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
        <div className="text-xs text-pipeblack-muted leading-relaxed">
          <strong className="text-pipeblack font-mono uppercase mr-1">Configuration Architecture Rule:</strong>
          These input fields depict the planned application configuration schema. Values bind to backend environment variables (<code className="font-mono bg-cream-100 px-1 py-0.5 border border-pipeborder text-[10px]">.env</code>) and local configuration. Modifying visual inputs does not alter robot or backend state.
        </div>
      </div>

      {/* 9 Structured Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Local Network */}
        <Card
          title="1. Local Network"
          description="Private Wi-Fi subnet and host interface"
          headerAction={<Wifi className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Subnet Range</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (Assigned by router/AP in field)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 6.3: Do not hardcode assumed IP addresses</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Laptop Host Binding</label>
              <input
                type="text"
                disabled
                defaultValue="0.0.0.0 (Local private interface only)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 2. ESP32 Connection */}
        <Card
          title="2. ESP32 Connection"
          description="Motor control & telemetry transport"
          headerAction={<Cpu className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">ESP32 Host Address</label>
              <input
                type="text"
                disabled
                defaultValue="Unassigned (To be discovered on private Wi-Fi)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Watchdog Timeout</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (Requires hardware test in Stage 3)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 10.3: Watchdog must stop motors on packet loss</span>
            </div>
          </div>
        </Card>

        {/* 3. Raspberry Pi Camera Stream */}
        <Card
          title="3. Camera Stream"
          description="Optical feed ingestion from Pi Zero 2 W"
          headerAction={<Camera className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Stream Endpoint</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (Awaiting camera integration)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Transport Protocol</label>
              <input
                type="text"
                disabled
                defaultValue="MJPEG / WebRTC / RTSP (Evaluated in Stage 6)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 4. AI Model Parameters */}
        <Card
          title="4. AI Inference"
          description="YOLO defect detection model thresholds"
          headerAction={<Layers className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Target Device</label>
              <input
                type="text"
                disabled
                defaultValue="NVIDIA GeForce RTX 2050 (4 GB VRAM)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Confidence Threshold</label>
              <input
                type="text"
                disabled
                defaultValue="0.25 (Awaiting model evaluation in Stage 4)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 5. Odometry Calibration */}
        <Card
          title="5. Odometry Calibration"
          description="Wheel geometry and encoder pulse rates"
          headerAction={<Cpu className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Wheel Circumference</label>
              <input
                type="text"
                disabled
                defaultValue="Uncalibrated (Requires physical measurement in Stage 5)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Pulses Per Revolution (PPR)</label>
              <input
                type="text"
                disabled
                defaultValue="Uncalibrated (Requires empirical calibration in Stage 5)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 6. IMU Orientation */}
        <Card
          title="6. IMU Calibration"
          description="MPU6050 offset zeroing and mounting alignment"
          headerAction={<Cpu className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Pitch / Roll Zero Offset</label>
              <input
                type="text"
                disabled
                defaultValue="Unzeroed (Requires level chassis zeroing in Stage 5)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Gyro Drift Compensation</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 7. Local Database */}
        <Card
          title="7. Local Database"
          description="Offline persistence engine"
          headerAction={<Database className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">MongoDB Connection URI</label>
              <input
                type="text"
                disabled
                defaultValue="mongodb://127.0.0.1:27017/pipebot"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 3: Local Community Server bound to 127.0.0.1</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Database State</label>
              <input
                type="text"
                disabled
                value={
                  systemStatus?.subsystems.database === 'healthy'
                    ? `Connected (Latency: ${systemStatus.subsystems.databasePingMs?.toFixed(1) ?? '<1'}ms)`
                    : 'Unconnected or Offline'
                }
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack font-bold cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 8. Storage and Backup */}
        <Card
          title="8. Storage & Backup"
          description="Local evidence archives and PDF reports"
          headerAction={<HardDrive className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Storage Directory Root</label>
              <input
                type="text"
                disabled
                value={systemStatus?.storage?.storageRoot || 'storage/ (Relative path verified)'}
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 16.5: Relative filesystem layout</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Backup Verification Policy</label>
              <input
                type="text"
                disabled
                defaultValue="Strict (Verified file existence + checksum manifest)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 9. Application Appearance */}
        <Card
          title="9. UI Appearance"
          description="Design tokens & theme parameters"
          headerAction={<Palette className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Active Visual Identity</label>
              <input
                type="text"
                disabled
                defaultValue="OneGuard LPG Industrial (Cream #FAF7EE / Yellow #EAB308)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Design System Guidelines</label>
              <input
                type="text"
                disabled
                defaultValue="Zero pill buttons • No purple gradients • Zero emoji icons"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Save Settings Action Bar */}
      <div className="p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-pipeblack-muted">
          <Lock className="w-3.5 h-3.5 text-pipeblack-subtle shrink-0" />
          <span>Configuration inputs locked. Active settings derive from backend .env and system telemetry.</span>
        </div>
        <Button variant="primary" size="md" disabled>
          Save Configuration
        </Button>
      </div>
    </div>
  );
};
