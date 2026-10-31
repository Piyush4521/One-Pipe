import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-white border-r border-pipeborder transition-all duration-200 select-none z-30 shrink-0 min-h-screen',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-pipeborder bg-cream-50">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-pipeblack flex items-center justify-center rounded-sm shrink-0 border border-pipeblack shadow-industrial-sm">
              <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="10" stroke="#FAF7EE" strokeWidth="2.5" />
                <circle cx="16" cy="16" r="5" stroke="#EAB308" strokeWidth="2" />
                <line x1="16" y1="2" x2="16" y2="7" stroke="#EAB308" strokeWidth="2" strokeLinecap="square" />
                <line x1="16" y1="25" x2="16" y2="30" stroke="#EAB308" strokeWidth="2" strokeLinecap="square" />
                <line x1="2" y1="16" x2="7" y2="16" stroke="#EAB308" strokeWidth="2" strokeLinecap="square" />
                <line x1="25" y1="16" x2="30" y2="16" stroke="#EAB308" strokeWidth="2" strokeLinecap="square" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-wider uppercase text-pipeblack leading-none font-mono">
                PIPEBOT
              </span>
              <span className="text-[10px] uppercase font-mono text-pipeblack-muted tracking-wider mt-0.5 truncate">
                Inspection Console
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div className="w-8 h-8 bg-pipeblack flex items-center justify-center rounded-sm shrink-0 border border-pipeblack shadow-industrial-sm">
              <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="8" stroke="#EAB308" strokeWidth="2" />
              </svg>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'p-1 text-pipeblack-muted hover:text-pipeblack hover:bg-cream-200 rounded-sm transition-colors',
            isCollapsed && 'hidden'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs transition-colors border select-none',
                  isActive
                    ? 'bg-pipeyellow border-pipeblack text-pipeblack font-bold shadow-industrial-sm'
                    : 'border-transparent text-pipeblack-muted hover:text-pipeblack hover:bg-cream-200 hover:border-pipeborder',
                  isCollapsed && 'justify-center px-0'
                )
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Collapse Toggle (when collapsed) */}
      {isCollapsed && (
        <div className="p-2 border-t border-pipeborder flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="p-2 text-pipeblack-muted hover:text-pipeblack hover:bg-cream-200 rounded-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer System Version */}
      {!isCollapsed && (
        <div className="p-3 border-t border-pipeborder bg-cream-50 text-[10px] font-mono text-pipeblack-muted flex items-center justify-between">
          <span className="uppercase tracking-wider">Baseline V1.0</span>
          <span className="text-pipeblack-subtle">Local Node</span>
        </div>
      )}
    </aside>
  );
};

