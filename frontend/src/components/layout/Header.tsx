import { useState, useEffect, type FC } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { api, type SystemStatusData } from '@/services/api';

export const Header: FC = () => {
  const location = useLocation();
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      try {
        const res = await api.system.getStatus();
        if (isMounted) setSystemStatus(res);
      } catch {
        if (isMounted) setSystemStatus(null);
      }
    };

    probe();
    const interval = setInterval(probe, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getPageTitle = (pathname: string): { title: string; category: string } => {
    switch (pathname) {
      case ROUTES.OVERVIEW:
        return { title: 'System Overview', category: 'Console' };
      case ROUTES.LIVE_INSPECTION:
        return { title: 'Live Inspection', category: 'Operation' };
      case ROUTES.INSPECTIONS:
        return { title: 'Inspection Sessions', category: 'Archives' };
      case ROUTES.DEFECTS:
        return { title: 'Defect Records', category: 'Evidence' };
      case ROUTES.REPORTS:
        return { title: 'Consolidated Reports', category: 'Documentation' };
      case ROUTES.SETTINGS:
        return { title: 'System Settings', category: 'Configuration' };
      default:
        return { title: 'PipeBot Console', category: 'Navigation' };
    }
  };

  const { title, category } = getPageTitle(location.pathname);

  const esp32Status = systemStatus?.subsystems.esp32 ?? 'offline';
  const cameraStatus = systemStatus?.subsystems.camera ?? 'offline';
  const aiStatus = systemStatus?.subsystems.aiEngine ?? 'offline';
  const dbStatus = systemStatus?.subsystems.database ?? 'offline';
  const isBackendAlive = Boolean(systemStatus);

  return (
    <header className="h-16 bg-white border-b border-pipeborder px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20">
      {/* Title & Context */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-pipeyellow-hover">
            {category}
          </span>
          <span className="text-pipeborder">&bull;</span>
          <span className="text-[10px] font-mono uppercase text-pipeblack-muted truncate">
            Local Host &bull; Offline Wi-Fi
          </span>
        </div>
        <h2 className="text-base md:text-lg font-bold uppercase tracking-tight text-pipeblack leading-tight truncate">
          {title}
        </h2>
      </div>

      {/* Subsystem Indicators */}
      <div className="hidden sm:flex items-center gap-2 text-xs">
        <div className="px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status={isBackendAlive ? 'healthy' : 'offline'}
            size="sm"
            label={isBackendAlive ? 'Host: 127.0.0.1:3000' : 'Host: Offline'}
          />
        </div>
        <div className="px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status={esp32Status}
            size="sm"
            label={esp32Status === 'healthy' ? 'ESP32: Linked' : 'ESP32: Awaiting Link'}
          />
        </div>
        <div className="px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status={cameraStatus}
            size="sm"
            label={cameraStatus === 'healthy' ? 'Camera: Online' : 'Camera: Offline'}
          />
        </div>
        <div className="hidden lg:flex px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status={aiStatus}
            size="sm"
            label={aiStatus === 'healthy' ? 'AI: Active' : 'AI: Dormant'}
          />
        </div>
        <div className="hidden xl:flex px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status={dbStatus}
            size="sm"
            label={
              dbStatus === 'healthy'
                ? `DB: Connected${systemStatus?.subsystems.databasePingMs != null ? ` (${systemStatus.subsystems.databasePingMs.toFixed(0)}ms)` : ''}`
                : 'DB: Unlinked'
            }
          />
        </div>
      </div>
    </header>
  );
};
