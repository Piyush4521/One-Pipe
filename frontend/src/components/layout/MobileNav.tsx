import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

export const MobileNav: FC = () => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pipeborder shadow-industrial z-40 select-none"
    >
      {/* Mobile Monitoring Notice Banner */}
      <div className="bg-cream-100 border-b border-pipeborder px-3 py-1 flex items-center justify-center gap-1.5 text-[10px] font-mono text-pipeblack-muted text-center">
        <ShieldAlert className="w-3 h-3 text-pipeorange shrink-0" />
        <span className="font-semibold text-pipeblack">Monitoring Mode:</span>
        <span className="truncate">Robot movement controls restricted to laptop console</span>
      </div>

      {/* Navigation Buttons Grid */}
      <div className="grid grid-cols-6 h-14">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 text-[10px] font-mono transition-colors border-t-2',
                  isActive
                    ? 'border-pipeyellow bg-cream-50 text-pipeblack font-bold'
                    : 'border-transparent text-pipeblack-muted hover:text-pipeblack'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[52px] leading-tight text-[9px] uppercase">
                {item.label.split(' ')[0]}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

