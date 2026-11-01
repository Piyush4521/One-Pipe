import { useState, useEffect, type FC } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Badge,
} from '@/components/ui';
import { AlertOctagon, Filter, Search, ShieldCheck, Database, RefreshCw, CheckCircle2, XCircle, HelpCircle, Image as ImageIcon } from 'lucide-react';
import { api, type DefectStats } from '@/services/api';
import type { DefectEvidenceRecord } from '@/types/inspection';

export const DefectRecordsPage: FC = () => {
  const [defects, setDefects] = useState<DefectEvidenceRecord[]>([]);
  const [stats, setStats] = useState<DefectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchDefectsAndStats = async () => {
    try {
      const [defectsRes, statsRes] = await Promise.allSettled([
        api.defects.list({
          limit: 100,
          reviewStatus: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        }),
        api.defects.getStats(),
      ]);

      if (defectsRes.status === 'fulfilled') {
        setDefects(defectsRes.value.items || []);
        setIsBackendConnected(true);
      } else {
        setIsBackendConnected(false);
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
    } catch {
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDefectsAndStats();
  }, [selectedStatus]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDefectsAndStats();
  };

  const handleUpdateReviewStatus = async (defectId: string, newStatus: string) => {
    setUpdatingId(defectId);
    try {
      const updated = await api.defects.updateReview(defectId, { reviewStatus: newStatus });
      setDefects((prev) =>
        prev.map((d) => (d.id === defectId ? { ...d, reviewStatus: updated.reviewStatus } : d))
      );
      // Refresh stats
      const newStats = await api.defects.getStats();
      setStats(newStats);
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = defects.filter((defect) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = defect.id.toLowerCase().includes(q);
      const matchFrame = defect.frameId.toLowerCase().includes(q);
      const matchClass = defect.className.toLowerCase().includes(q);
      const matchNotes = defect.operatorNotes?.toLowerCase().includes(q);
      if (!matchId && !matchFrame && !matchClass && !matchNotes) return false;
    }
    return true;
  });

  const formatDistance = (val: number | null): string => {
    if (val === null || val === undefined) return 'Uncalibrated (—)';
    return `${val.toFixed(2)} m`;
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getReviewBadge = (st: string) => {
    switch (st) {
      case 'CONFIRMED':
        return <Badge variant="success">CONFIRMED</Badge>;
      case 'FALSE_POSITIVE':
        return <Badge variant="critical">FALSE POSITIVE</Badge>;
      case 'NEEDS_VERIFICATION':
        return <Badge variant="warning">NEEDS REVIEW</Badge>;
      default:
        return <Badge variant="neutral">UNREVIEWED</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="yellow">Evidence Archive</Badge>
            <span className="text-xs font-mono text-pipeblack-muted">YOLO Detections & Coordinate Logs</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
            Defect Detection Records
          </h1>
          <p className="text-xs md:text-sm text-pipeblack-muted mt-1 max-w-3xl">
            Visual and coordinate log of pipe anomalies detected during inspections.
            All findings correlate the camera frame capture timestamp with wheel encoder telemetry to estimate conduit distance.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-pipeborder rounded-sm hover:bg-cream-100 text-xs font-mono text-pipeblack flex items-center gap-1.5 transition-colors shadow-industrial-subtle"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Summary Badges */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-white border border-pipeborder rounded-sm">
            <span className="text-[10px] font-mono text-pipeblack-muted uppercase block">Total Defects</span>
            <span className="text-lg font-bold font-mono text-pipeblack">{stats.total}</span>
          </div>
          <div className="p-3 bg-white border border-pipeborder rounded-sm">
            <span className="text-[10px] font-mono text-pipeblack-muted uppercase block">Unreviewed</span>
            <span className="text-lg font-bold font-mono text-pipeyellow-hover">{stats.unreviewed}</span>
          </div>
          <div className="p-3 bg-white border border-pipeborder rounded-sm">
            <span className="text-[10px] font-mono text-pipestatus-healthy uppercase block">Confirmed</span>
            <span className="text-lg font-bold font-mono text-pipestatus-healthy">{stats.confirmed}</span>
          </div>
          <div className="p-3 bg-white border border-pipeborder rounded-sm">
            <span className="text-[10px] font-mono text-pipestatus-critical uppercase block">False Positives</span>
            <span className="text-lg font-bold font-mono text-pipestatus-critical">{stats.falsePositive}</span>
          </div>
          <div className="p-3 bg-white border border-pipeborder rounded-sm">
            <span className="text-[10px] font-mono text-pipestatus-warning uppercase block">Needs Verification</span>
            <span className="text-lg font-bold font-mono text-pipestatus-warning">{stats.needsVerification}</span>
          </div>
        </div>
      )}

      {/* Safety Notice regarding Confidence vs Severity */}
      <div className="p-3.5 bg-cream-50 border-l-4 border-pipeyellow border-y border-r border-pipeborder rounded-sm flex items-start gap-3 text-xs">
        <ShieldCheck className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
        <div className="text-pipeblack-muted leading-relaxed">
          <strong className="text-pipeblack font-mono uppercase mr-1.5">Rulebook § 14.5 Engineering Constraint:</strong>
          AI confidence scores reflect model detection probability and must never be conflated with physical structural defect severity.
          Classification of structural severity requires independent engineering validation and is never fabricated.
        </div>
      </div>

      {/* Persistence Status */}
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
        <Badge variant={isBackendConnected ? 'neutral' : 'warning'}>
          {defects.length} Records Synchronized
        </Badge>
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
            placeholder="Search by Defect ID, Frame ID, or Class..."
            className="bg-transparent border-none outline-none w-full text-pipeblack placeholder:text-pipeblack-muted/60 font-mono text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-pipeblack-muted" />
            <span className="text-pipeblack-muted uppercase text-[10px] font-bold">Review:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-cream-50 border border-pipeborder rounded-sm px-2 py-1 text-xs text-pipeblack font-mono outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNREVIEWED">Unreviewed</option>
              <option value="CONFIRMED">Operator Confirmed</option>
              <option value="FALSE_POSITIVE">False Positive</option>
              <option value="NEEDS_VERIFICATION">Needs Verification</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('ALL');
            }}
            className="text-[11px] text-pipeblack-muted hover:text-pipeblack flex items-center gap-1 transition-colors"
            title="Reset Filters"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Defect Records Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evidence Frame</TableHead>
            <TableHead>Defect ID</TableHead>
            <TableHead>Inspection ID</TableHead>
            <TableHead>Class Name</TableHead>
            <TableHead>Model Probability</TableHead>
            <TableHead>Estimated Distance</TableHead>
            <TableHead>Capture Time</TableHead>
            <TableHead>Review Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableEmpty
              colSpan={9}
              message="Loading defect evidence records from local storage..."
              icon={<RefreshCw className="w-8 h-8 text-pipeblack-muted mb-1 animate-spin" />}
            />
          ) : filtered.length > 0 ? (
            filtered.map((defect) => (
              <TableRow key={defect.id}>
                <TableCell>
                  <div className="w-12 h-9 bg-cream-200 border border-pipeborder rounded-sm flex items-center justify-center text-pipeblack-subtle overflow-hidden">
                    {defect.evidenceImagePath ? (
                      <img
                        src={api.defects.getEvidenceDownloadUrl(defect.id)}
                        alt={defect.className}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono font-bold text-pipeblack">{defect.id}</TableCell>
                <TableCell className="font-mono text-pipeblack-muted">{defect.inspectionId}</TableCell>
                <TableCell className="font-mono font-bold text-pipeblack">{defect.className}</TableCell>
                <TableCell className="font-mono text-pipeblack">
                  {Math.round(defect.confidence * 100)}%
                </TableCell>
                <TableCell className="font-mono text-pipeblack">
                  {formatDistance(defect.estimatedDistance)}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-pipeblack-muted">
                  {formatDate(defect.frameCaptureTimestamp)}
                </TableCell>
                <TableCell>{getReviewBadge(defect.reviewStatus)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={updatingId === defect.id || defect.reviewStatus === 'CONFIRMED'}
                      onClick={() => handleUpdateReviewStatus(defect.id, 'CONFIRMED')}
                      className="p-1 hover:bg-cream-100 rounded text-pipestatus-healthy disabled:opacity-30"
                      title="Confirm Defect"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === defect.id || defect.reviewStatus === 'FALSE_POSITIVE'}
                      onClick={() => handleUpdateReviewStatus(defect.id, 'FALSE_POSITIVE')}
                      className="p-1 hover:bg-cream-100 rounded text-pipestatus-critical disabled:opacity-30"
                      title="Mark False Positive"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === defect.id || defect.reviewStatus === 'NEEDS_VERIFICATION'}
                      onClick={() => handleUpdateReviewStatus(defect.id, 'NEEDS_VERIFICATION')}
                      className="p-1 hover:bg-cream-100 rounded text-pipestatus-warning disabled:opacity-30"
                      title="Flag for Verification"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={9}
              message="No defect evidence records found. Records will populate automatically during live AI inspection runs."
              icon={<AlertOctagon className="w-8 h-8 text-pipeblack-muted mb-1" />}
            />
          )}
        </TableBody>
      </Table>
    </div>
  );
};
