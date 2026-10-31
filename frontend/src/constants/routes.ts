import {
  LayoutDashboard,
  Eye,
  History,
  AlertOctagon,
  FileText,
  Settings,
} from 'lucide-react';
import type { NavItem } from '@/types/navigation';

export const ROUTES = {
  OVERVIEW: '/',
  LIVE_INSPECTION: '/live-inspection',
  INSPECTIONS: '/inspections',
  DEFECTS: '/defects',
  REPORTS: '/reports',
  SETTINGS: '/settings',
} as const;

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    path: ROUTES.OVERVIEW,
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Live Inspection',
    path: ROUTES.LIVE_INSPECTION,
    icon: Eye,
  },
  {
    label: 'Inspections',
    path: ROUTES.INSPECTIONS,
    icon: History,
  },
  {
    label: 'Defect Records',
    path: ROUTES.DEFECTS,
    icon: AlertOctagon,
  },
  {
    label: 'Reports',
    path: ROUTES.REPORTS,
    icon: FileText,
  },
  {
    label: 'Settings',
    path: ROUTES.SETTINGS,
    icon: Settings,
  },
];

