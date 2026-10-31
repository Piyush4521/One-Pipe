import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button, Badge } from '@/components/ui';
import { AlertTriangle, Home } from 'lucide-react';

export const NotFoundPage: FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="p-3 bg-cream-50 border-2 border-pipeblack rounded-sm shadow-industrial-sm">
        <AlertTriangle className="w-8 h-8 text-pipeorange" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Badge variant="warning">Route Error</Badge>
          <span className="font-mono text-xs text-pipeblack-muted font-bold">404</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
          Page Not Found
        </h1>
        <p className="text-xs md:text-sm text-pipeblack-muted max-w-md">
          The requested console route does not exist or has been relocated.
        </p>
      </div>

      <NavLink to={ROUTES.OVERVIEW} className="mt-2">
        <Button variant="primary" size="md" leftIcon={<Home className="w-4 h-4" />}>
          Return to Overview
        </Button>
      </NavLink>
    </div>
  );
};

