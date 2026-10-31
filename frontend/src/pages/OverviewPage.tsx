import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Card, Button, Badge, StatusIndicator } from '@/components/ui';
import {
  Cpu,
  Camera,
  Layers,
  Database,
  Eye,
  History,
  AlertOctagon,
  FileText,
  ArrowRight,
  ShieldAlert,
  Inbox,
} from 'lucide-react';

export const OverviewPage: FC = () => {
  const subsystems = [
    {
      name: 'Hardware Controller',
      device: 'ESP32-WROOM-32 DevKit V1',
      description: 'Motor drivers, wheel encoders, and MPU6050 IMU telemetry link.',
      status: 'offline' as const,
      statusLabel: 'Awaiting Link',
      icon: Cpu,
    },
    {
      name: 'Optical Camera Subsystem',
      device: 'Raspberry Pi Zero 2 W',
      description: 'Direct camera stream ingestion over local private Wi-Fi.',
      status: 'offline' as const,
      statusLabel: 'Not Connected',
      icon: Camera,
    },
    {
      name: 'AI Inference Pipeline',
      device: 'Ultralytics YOLO (RTX 2050)',
      description: 'Defect detection models running on laptop GPU (4 GB VRAM).',
      status: 'offline' as const,
      statusLabel: 'Dormant',
      icon: Layers,
    },
    {
      name: 'Local Persistence Engine',
      device: 'MongoDB Community Server',
      description: 'Offline local database for inspection metadata, defects, and logs.',
      status: 'offline' as const,
      statusLabel: 'Local Link Pending',
      icon: Database,
    },
  ];

  const quickActions = [
    {
      title: 'Live Inspection',
      description: 'Access the real-time optical feed, telemetry dashboard, and robot controls.',
      path: ROUTES.LIVE_INSPECTION,
      icon: Eye,
      badge: 'Console',
    },
    {
      title: 'Inspection Archives',
      description: 'Review previous pipe inspections, spatial timestamps, and summaries.',
      path: ROUTES.INSPECTIONS,
      icon: History,
      badge: 'Records',
    },
    {
      title: 'Defect Catalog',
      description: 'Inspect verified pipe anomalies, coordinate locations, and evidence frames.',
      path: ROUTES.DEFECTS,
      icon: AlertOctagon,
      badge: 'Evidence',
    },
    {
      title: 'Inspection Reports',
      description: 'Export and download consolidated PDF reports for completed runs.',
      path: ROUTES.REPORTS,
      icon: FileText,
      badge: 'Exports',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="yellow">Operator Station</Badge>
          <span className="text-xs font-mono text-pipeblack-muted">Single-Operator Offline Architecture</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
          System Overview & Readiness
        </h1>
        <p className="text-xs md:text-sm text-pipeblack-muted mt-1 max-w-3xl">
          Monitors subsystem link readiness, hardware status, and inspection session state.
          All services run locally on the operator laptop without requiring cloud dependencies.
        </p>
      </div>

      {/* Subsystem Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-pipeblack">
            Subsystem Status Indicators
          </h2>
          <span className="text-[11px] font-mono text-pipeblack-muted">
            Status checks will activate with backend services in Stage 2
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subsystems.map((subsystem) => {
            const Icon = subsystem.icon;
            return (
              <div
                key={subsystem.name}
                className="p-4 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="p-1.5 bg-cream-100 border border-pipeborder rounded-sm text-pipeblack">
                      <Icon className="w-4 h-4" />
                    </span>
                    <StatusIndicator
                      status={subsystem.status}
                      size="sm"
                      label={subsystem.statusLabel}
                    />
                  </div>

                  <h3 className="text-sm font-bold text-pipeblack tracking-tight mt-1">
                    {subsystem.name}
                  </h3>
                  <p className="text-[11px] font-mono font-medium text-pipeyellow-hover">
                    {subsystem.device}
                  </p>
                  <p className="text-xs text-pipeblack-muted mt-2 leading-relaxed">
                    {subsystem.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-pipeborder/60 text-[10px] font-mono text-pipeblack-subtle uppercase">
                  Interface: Local Socket / HTTP
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-pipeblack mb-3">
          Operational Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="neutral">{action.badge}</Badge>
                    <Icon className="w-4 h-4 text-pipeblack-muted" />
                  </div>
                  <h3 className="text-sm font-bold text-pipeblack uppercase tracking-tight">
                    {action.title}
                  </h3>
                  <p className="text-xs text-pipeblack-muted mt-1 leading-relaxed">
                    {action.description}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-pipeborder flex items-center justify-end">
                  <NavLink to={action.path}>
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Open
                    </Button>
                  </NavLink>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Hardware Safety Callout & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Safety Callout */}
        <div className="p-4 bg-cream-50 border-2 border-pipeblack rounded-sm shadow-industrial-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-pipeorange" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-pipeblack">
                Safety & Control Authority
              </span>
            </div>
            <p className="text-xs text-pipeblack-muted leading-relaxed">
              In accordance with project engineering rules, the laptop dashboard is the sole client authorized to issue robot movement commands.
              Mobile connections operate strictly in monitoring mode. The physical chassis emergency-stop path operates independently of Wi-Fi or software status.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-pipeborder text-[10px] font-mono text-pipeblack-muted">
            Governing Rulebook: Rules/PipeBot_Build_Rulebook.md § 10
          </div>
        </div>

        {/* Recent Activity Shell */}
        <div className="lg:col-span-2">
          <Card
            title="Recent Inspection Activity"
            description="Inspection run history will populate from local MongoDB storage"
          >
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-pipeblack-muted">
              <Inbox className="w-8 h-8 text-pipeblack-subtle" />
              <span className="text-xs font-mono font-medium">No recent inspection sessions recorded</span>
              <p className="text-xs text-pipeblack-subtle max-w-sm">
                Completed inspection runs, total travel distance, and defect counts will be cataloged here once sessions are executed.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
