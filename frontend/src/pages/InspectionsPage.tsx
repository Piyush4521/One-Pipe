import { useState, type FC } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableEmpty,
  Button,
  Badge,
} from '@/components/ui';
import { Plus, History, Search, Filter, Calendar, Database, RefreshCw } from 'lucide-react';

export const InspectionsPage: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL_TIME');

  return (
    <div className="space-y-6">
      {/* Header & New Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="yellow">Inspection Logs</Badge>
            <span className="text-xs font-mono text-pipeblack-muted">Historical PVC Pipe Sessions</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
            Inspection Session Archive
          </h1>
          <p className="text-xs md:text-sm text-pipeblack-muted mt-1 max-w-2xl">
            Chronological audit of completed and interrupted PVC pipe inspection runs, cumulative odometry distances, run durations, and recorded defect counts.
          </p>
        </div>

        <NavLink to={ROUTES.LIVE_INSPECTION} className="self-start sm:self-auto">
          <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
            New Inspection
          </Button>
        </NavLink>
      </div>

      {/* Backend Disconnected Notice */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-pipeblack-muted" />
          <span className="font-mono text-pipeblack font-bold uppercase">Persistence Status:</span>
          <span className="text-pipeblack-muted">Local MongoDB Community Server unlinked (Stage 1 frontend preview).</span>
        </div>
        <Badge variant="neutral">0 Sessions Loaded</Badge>
      </div>

      {/* Presentation-Ready Filter / Search Bar */}
      <div className="p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 w-full md:w-80 px-3 py-1.5 bg-cream-50 border border-pipeborder rounded-sm text-xs">
          <Search className="w-3.5 h-3.5 text-pipeblack-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Inspection ID, Operator, or Pipe Segment..."
            className="bg-transparent border-none outline-none w-full text-pipeblack placeholder:text-pipeblack-muted/60 font-mono text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-pipeblack-muted" />
            <span className="text-pipeblack-muted uppercase text-[10px] font-bold">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-cream-50 border border-pipeborder rounded-sm px-2 py-1 text-xs text-pipeblack font-mono outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="INTERRUPTED">Interrupted / Recovery Required</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-pipeblack-muted" />
            <span className="text-pipeblack-muted uppercase text-[10px] font-bold">Timeframe:</span>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-cream-50 border border-pipeborder rounded-sm px-2 py-1 text-xs text-pipeblack font-mono outline-none cursor-pointer"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('ALL');
              setSelectedDateFilter('ALL_TIME');
            }}
            className="text-[11px] text-pipeblack-muted hover:text-pipeblack flex items-center gap-1 transition-colors"
            title="Reset Filters"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Complete Historical Sessions Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inspection ID</TableHead>
            <TableHead>Start Timestamp</TableHead>
            <TableHead>End Timestamp</TableHead>
            <TableHead>Run Duration</TableHead>
            <TableHead>Total Distance</TableHead>
            <TableHead>Defects Count</TableHead>
            <TableHead>Session Status</TableHead>
            <TableHead className="text-right">Report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty
            colSpan={8}
            message="No inspection sessions recorded in local database (Backend disconnected)."
            icon={<History className="w-8 h-8 text-pipeblack-muted mb-1" />}
          />
        </TableBody>
      </Table>
    </div>
  );
};
