import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { StatusIndicator } from '@/components/ui/StatusIndicator';

export const Header: FC = () => {
  const location = useLocation();

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

      {/* Honest Subsystem Indicators (Neutral / Awaiting Connection) */}
      <div className="hidden sm:flex items-center gap-2 text-xs">
        <div className="px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status="offline"
            size="sm"
            label="ESP32: Awaiting Link"
          />
        </div>
        <div className="px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status="offline"
            size="sm"
            label="Camera: Not Connected"
          />
        </div>
        <div className="hidden lg:flex px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status="offline"
            size="sm"
            label="AI: Dormant"
          />
        </div>
        <div className="hidden xl:flex px-2.5 py-1 bg-cream-100 border border-pipeborder rounded-sm">
          <StatusIndicator
            status="offline"
            size="sm"
            label="DB: Unlinked"
          />
        </div>
      </div>
    </header>
  );
};

