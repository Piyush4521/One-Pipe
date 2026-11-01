import { useState, useEffect, type FC } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { api, type SystemStatusData } from '@/services/api';
import type { InspectionSessionRecord, SubsystemStatus } from '@/types/inspection';

export const OverviewPage: FC = () => {
  const [systemData, setSystemData] = useState<SystemStatusData | null>(null);
  const [recentInspections, setRecentInspections] = useState<InspectionSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOverviewData = async () => {
    try {
      const [statusRes, inspectionsRes] = await Promise.allSettled([
        api.system.getStatus(),
        api.inspections.list({ limit: 5 }),
      ]);

      if (statusRes.status === 'fulfilled') {
        setSystemData(statusRes.value);
      } else {
        setSystemData(null);
      }

      if (inspectionsRes.status === 'fulfilled') {
        setRecentInspections(inspectionsRes.value.items || []);
      } else {
        setRecentInspections([]);
      }
    } catch {
      setSystemData(null);
      setRecentInspections([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    const timer = setInterval(fetchOverviewData, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchOverviewData();
  };

  const getSubsystemStatus = (
    key: 'esp32' | 'camera' | 'aiEngine' | 'database',
    defaultLabel: string
  ): { status: SubsystemStatus; label: string } => {
    if (!systemData?.subsystems) {
      return { status: 'offline', label: defaultLabel };
    }
    const st = systemData.subsystems[key];
    if (key === 'database' && st === 'healthy') {
      const pingText = systemData.subsystems.databasePingMs != null
        ? ` (${systemData.subsystems.databasePingMs.toFixed(1)}ms)`
        : '';
      return { status: 'healthy', label: `Connected${pingText}` };
    }
    const labelMap: Record<SubsystemStatus, string> = {
      healthy: 'Operational',
      warning: 'Warning / Degraded',
      critical: 'Critical Error',
      offline: defaultLabel,
      unknown: 'Status Unknown',
    };
    return { status: st, label: labelMap[st] || defaultLabel };
  };

  const esp32Status = getSubsystemStatus('esp32', 'Awaiting Link');
  const cameraStatus = getSubsystemStatus('camera', 'Not Connected');
  const aiStatus = getSubsystemStatus('aiEngine', 'Dormant');
  const dbStatus = getSubsystemStatus('database', 'Local Link Pending');

  const subsystems = [
    {
      name: 'Hardware Controller',
      device: 'ESP32-WROOM-32 DevKit V1',
      description: 'Motor drivers, wheel encoders, and MPU6050 IMU telemetry link.',
      status: esp32Status.status,
      statusLabel: esp32Status.label,
      icon: Cpu,
    },
    {
      name: 'Optical Camera Subsystem',
      device: 'Raspberry Pi Zero 2 W',
      description: 'Direct camera stream ingestion over local private Wi-Fi.',
      status: cameraStatus.status,
      statusLabel: cameraStatus.label,
      icon: Camera,
    },
    {
      name: 'AI Inference Pipeline',
      device: systemData?.subsystems?.gpuDeviceName || 'RTX 2050 (Awaiting Stage 4)',
      description: 'Defect detection models running on laptop GPU (4 GB VRAM).',
      status: aiStatus.status,
      statusLabel: aiStatus.label,
      icon: Layers,
    },
    {
      name: 'Local Persistence Engine',
      device: systemData ? `MongoDB (${systemData.storage.driver})` : 'MongoDB Community Server',
      description: systemData?.storage?.limitation || 'Offline local database for inspection metadata, defects, and logs.',
      status: dbStatus.status,
      statusLabel: dbStatus.label,
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

  const formatDistance = (dist: number | null): string => {
    if (dist === null) return 'Uncalibrated';
    return `${dist.toFixed(2)} m`;
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-pipeborder rounded-sm hover:bg-cream-100 text-xs font-mono text-pipeblack flex items-center gap-1.5 transition-colors shadow-industrial-subtle"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Sync Status</span>
        </button>
      </div>

      {/* Subsystem Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-pipeblack">
            Subsystem Status Indicators
          </h2>
          <span className="text-[11px] font-mono text-pipeblack-muted">
            {systemData ? 'Live Backend Diagnostics Active' : 'Polling Backend Service (127.0.0.1:3000)...'}
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

                <div className="mt-4 pt-3 border-t border-pipeborder/60 text-[10px] font-mono text-pipeblack-subtle uppercase flex items-center justify-between">
                  <span>Interface: Local Socket / HTTP</span>
                  {subsystem.status === 'healthy' && (
                    <span className="text-pipestatus-healthy font-bold">ONLINE</span>
                  )}
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
            description={
              systemData
                ? `Populated from local MongoDB (${recentInspections.length} recorded session${recentInspections.length === 1 ? '' : 's'})`
                : 'Inspection run history will populate from local MongoDB storage'
            }
          >
            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs font-mono text-pipeblack-muted">
                Checking persistence engine...
              </div>
            ) : recentInspections.length > 0 ? (
              <div className="divide-y divide-pipeborder/60">
                {recentInspections.map((insp) => (
                  <div key={insp.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pipeblack">{insp.id}</span>
                        {insp.conduitName && (
                          <span className="text-[10px] bg-cream-100 px-1.5 py-0.5 border border-pipeborder text-pipeblack-muted">
                            {insp.conduitName}
                          </span>
                        )}
                        <Badge variant={insp.status === 'completed' ? 'neutral' : 'warning'}>
                          {insp.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-pipeblack-muted block">
                        Started: {formatDate(insp.startTimestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] text-pipeblack-muted block">Distance</span>
                        <span className="font-bold text-pipeblack">{formatDistance(insp.totalDistanceMeters)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-pipeblack-muted block">Defects</span>
                        <span className="font-bold text-pipestatus-critical">{insp.defectCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-pipeblack-muted">
                <Inbox className="w-8 h-8 text-pipeblack-subtle" />
                <span className="text-xs font-mono font-medium">No recent inspection sessions recorded</span>
                <p className="text-xs text-pipeblack-subtle max-w-sm">
                  Completed inspection runs, total travel distance, and defect counts will be cataloged here once sessions are executed.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
