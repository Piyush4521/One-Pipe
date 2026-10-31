import type { FC } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import {
  Wifi,
  Cpu,
  Camera,
  Layers,
  Gauge,
  Compass,
  Database,
  HardDrive,
  Palette,
  Info,
  Lock,
} from 'lucide-react';

/**
 * System Settings & Configuration Architecture
 *
 * In accordance with Rules/PipeBot_Build_Rulebook.md § 6.3, 10.3, 11.2, 12.1, 16.4, 25:
 * - All hardware parameters, sensor calibrations, and network endpoints remain unconfigured
 *   until verified empirically on physical hardware in subsequent stages.
 * - Inputs are display shells that will bind to backend environment variables (.env) in Stage 2.
 * - Changing visual inputs in this frontend preview does not alter firmware or backend state.
 */
export const SettingsPage: FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Safety Notice Banner */}
      <div className="p-3.5 bg-cream-50 border-l-4 border-pipeyellow border-y border-r border-pipeborder rounded-sm flex items-start gap-3">
        <Info className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
        <div className="text-xs text-pipeblack-muted leading-relaxed">
          <strong className="text-pipeblack font-mono uppercase mr-1">Configuration Architecture Rule:</strong>
          These input fields depict the planned application configuration schema. Values will bind to backend environment variables (<code className="font-mono bg-cream-100 px-1 py-0.5 border border-pipeborder text-[10px]">.env</code>) and local configuration in Stage 2. Modifying visual inputs does not alter robot or backend state.
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
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">VLC Stream URL</label>
              <input
                type="text"
                disabled
                defaultValue="Unverified (Inspect VLC working command in Stage 5)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 12.1: Preserve verified working stream parameters</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Transport Protocol</label>
              <input
                type="text"
                disabled
                defaultValue="HTTP / MJPEG direct stream"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 4. AI Model and GPU */}
        <Card
          title="4. AI Model & GPU"
          description="Ultralytics YOLO on laptop GPU"
          headerAction={<Layers className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Inference Device</label>
              <input
                type="text"
                disabled
                defaultValue="cuda:0 (NVIDIA RTX 2050 4 GB VRAM verified)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 6.1: Inference runs on laptop, not Raspberry Pi</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Confidence Threshold</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (To be tuned in Stage 7 evaluation)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 5. Encoder Calibration */}
        <Card
          title="5. Encoder Calibration"
          description="Wheel odometry & distance derivations"
          headerAction={<Gauge className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Effective PPR</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (Empirical count test required in Stage 4)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 11.2: Counts verified; calibration factor unknown</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Wheel Circumference</label>
              <input
                type="text"
                disabled
                defaultValue="Unconfigured (To be measured under physical chassis load)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* 6. MPU6050 IMU */}
        <Card
          title="6. MPU6050 Inertial"
          description="6-axis attitude & disturbance tracking"
          headerAction={<Compass className="w-4 h-4 text-pipeblack-muted" />}
        >
          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">I2C Module Address</label>
              <input
                type="text"
                disabled
                defaultValue="0x68 (Default, subject to AD0 pin inspection)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Sensor Calibration Offsets</label>
              <input
                type="text"
                disabled
                defaultValue="Uncalibrated (Stationary offset capture in Stage 4)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 11.4: MPU6050 supplements encoder odometry</span>
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
                defaultValue="mongodb://127.0.0.1:27017/pipebot (Planned local Community Server)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
              />
              <span className="text-[9px] text-pipeblack-subtle block mt-0.5">Rulebook § 3: Local Community Server; Atlas cloud prohibited</span>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Database State</label>
              <input
                type="text"
                disabled
                defaultValue="Unconnected in Stage 1 (To be integrated in Stage 2)"
                className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack-muted cursor-not-allowed"
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
              <label className="text-[10px] font-bold uppercase text-pipeblack block mb-1">Planned Storage Directory</label>
              <input
                type="text"
                disabled
                defaultValue="storage/ (Relative path, to be initialized in Stage 2)"
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
          <span>Configuration inputs locked in Stage 1 frontend development preview.</span>
        </div>
        <Button variant="primary" size="md" disabled>
          Save Configuration (Stage 2 Integration)
        </Button>
      </div>
    </div>
  );
};
