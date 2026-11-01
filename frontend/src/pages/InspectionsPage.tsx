import { useState, useEffect, type FC } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Button,
  Badge,
} from '@/components/ui';
import { Plus, History, Search, Filter, Calendar, Database, RefreshCw, X, Check } from 'lucide-react';
import { api } from '@/services/api';
import type { InspectionSessionRecord } from '@/types/inspection';

export const InspectionsPage: FC = () => {
  const [inspections, setInspections] = useState<InspectionSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL_TIME');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // New Inspection Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newConduitName, setNewConduitName] = useState('');
  const [newOperatorNotes, setNewOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchInspections = async () => {
    try {
      const res = await api.inspections.list({
        limit: 100,
        status: selectedStatus !== 'ALL' ? selectedStatus.toLowerCase() : undefined,
      });
      setInspections(res.items || []);
      setIsBackendConnected(true);
    } catch {
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [selectedStatus]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInspections();
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      const created = await api.inspections.create({
        conduitName: newConduitName.trim() || undefined,
        operatorNotes: newOperatorNotes.trim() || undefined,
      });
      setInspections((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewConduitName('');
      setNewOperatorNotes('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create inspection session');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Inspections
  const filtered = inspections.filter((insp) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = insp.id.toLowerCase().includes(q);
      const matchConduit = insp.conduitName?.toLowerCase().includes(q);
      const matchNotes = insp.operatorNotes?.toLowerCase().includes(q);
      if (!matchId && !matchConduit && !matchNotes) return false;
    }
    return true;
  });

  const formatDistance = (val: number | null): string => {
    if (val === null || val === undefined) return 'Uncalibrated (—)';
    return `${val.toFixed(2)} m`;
  };

  const formatDuration = (sec?: number): string => {
    if (sec === null || sec === undefined) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getStatusBadgeVariant = (st: string): 'neutral' | 'success' | 'warning' | 'critical' => {
    switch (st) {
      case 'completed':
        return 'neutral';
      case 'running':
        return 'success';
      case 'paused':
        return 'warning';
      case 'recovery_required':
        return 'critical';
      default:
        return 'neutral';
    }
  };

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

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          New Inspection
        </Button>
      </div>

      {/* Persistence Notice */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-pipeblack-muted" />
          <span className="font-mono text-pipeblack font-bold uppercase">Persistence Status:</span>
          <span className="text-pipeblack-muted">
            {isBackendConnected
              ? 'Local MongoDB Community Server connected and active.'
              : 'Local MongoDB Community Server unlinked (Stage 1/2 preview).'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isBackendConnected ? 'neutral' : 'warning'}>
            {inspections.length} Sessions Loaded
          </Badge>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-cream-100 rounded text-pipeblack-muted hover:text-pipeblack transition-colors"
            title="Refresh Inspections"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
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
              <option value="ready">Ready</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="recovery_required">Recovery Required</option>
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

      {/* Historical Sessions Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inspection ID</TableHead>
            <TableHead>Conduit / Pipe</TableHead>
            <TableHead>Start Timestamp</TableHead>
            <TableHead>Run Duration</TableHead>
            <TableHead>Total Distance</TableHead>
            <TableHead>Defects Count</TableHead>
            <TableHead>Session Status</TableHead>
            <TableHead className="text-right">Backup</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableEmpty
              colSpan={8}
              message="Loading inspection sessions from persistence engine..."
              icon={<RefreshCw className="w-8 h-8 text-pipeblack-muted mb-1 animate-spin" />}
            />
          ) : filtered.length > 0 ? (
            filtered.map((insp) => (
              <TableRow key={insp.id}>
                <TableCell className="font-mono font-bold text-pipeblack">{insp.id}</TableCell>
                <TableCell className="font-mono text-pipeblack-muted">
                  {insp.conduitName || '—'}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-pipeblack-muted">
                  {formatDate(insp.startTimestamp)}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-pipeblack">
                  {formatDuration(insp.durationSeconds)}
                </TableCell>
                <TableCell className="font-mono text-[11px] font-bold text-pipeblack">
                  {formatDistance(insp.totalDistanceMeters)}
                </TableCell>
                <TableCell className="font-mono text-center">
                  <span
                    className={`font-bold ${
                      insp.defectCount > 0 ? 'text-pipestatus-critical' : 'text-pipeblack-muted'
                    }`}
                  >
                    {insp.defectCount}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(insp.status)}>{insp.status}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-[10px]">
                  {insp.backupVerified ? (
                    <span className="text-pipestatus-healthy font-bold">VERIFIED</span>
                  ) : insp.backupStatus === 'failed' ? (
                    <span className="text-pipestatus-critical font-bold">FAILED</span>
                  ) : (
                    <span className="text-pipeblack-subtle">PENDING</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={8}
              message={
                isBackendConnected
                  ? 'No inspection sessions match your current filter.'
                  : 'No inspection sessions recorded in local database (Backend disconnected).'
              }
              icon={<History className="w-8 h-8 text-pipeblack-muted mb-1" />}
            />
          )}
        </TableBody>
      </Table>

      {/* New Inspection Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-pipeblack/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-pipeblack rounded-sm shadow-industrial max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pipeborder">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-pipeyellow-hover" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-pipeblack">
                  Create Inspection Session
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-pipeblack-muted hover:text-pipeblack"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-pipestatus-critical-bg border border-pipestatus-critical-border rounded-sm text-xs font-mono text-pipestatus-critical">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold font-mono uppercase text-pipeblack block mb-1">
                  Conduit / Pipe Segment Name
                </label>
                <input
                  type="text"
                  value={newConduitName}
                  onChange={(e) => setNewConduitName(e.target.value)}
                  placeholder="e.g. PVC-SEC-04-NORTH"
                  className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack font-mono outline-none focus:border-pipeblack"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold font-mono uppercase text-pipeblack block mb-1">
                  Operator Notes
                </label>
                <textarea
                  value={newOperatorNotes}
                  onChange={(e) => setNewOperatorNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Routine visual inspection of secondary drainage conduit."
                  className="w-full p-2 bg-cream-50 border border-pipeborder rounded-sm text-xs text-pipeblack font-mono outline-none focus:border-pipeblack"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-pipeborder">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  {isSubmitting ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
