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
import { FileText, HardDrive, ShieldAlert, Search, RefreshCw, AlertCircle, Download, CheckCircle2 } from 'lucide-react';
import { api } from '@/services/api';
import type { ConsolidatedReportRecord } from '@/types/inspection';

export const ReportsPage: FC = () => {
  const [reports, setReports] = useState<ConsolidatedReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await api.reports.list({ limit: 100 });
      setReports(res.items || []);
      setIsBackendConnected(true);
    } catch {
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReports();
  };

  const filtered = reports.filter((rep) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = rep.id.toLowerCase().includes(q);
      const matchInsp = rep.inspectionId.toLowerCase().includes(q);
      if (!matchId && !matchInsp) return false;
    }
    return true;
  });

  const formatDistance = (val: number | null): string => {
    if (val === null || val === undefined) return 'Uncalibrated (—)';
    return `${val.toFixed(2)} m`;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="yellow">Compliance & Archives</Badge>
            <span className="text-xs font-mono text-pipeblack-muted">Consolidated Inspection PDFs</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-pipeblack">
            Inspection Reports Archive
          </h1>
          <p className="text-xs md:text-sm text-pipeblack-muted mt-1 max-w-3xl">
            Single consolidated PDF report generation per completed inspection run (Rulebook § 17).
            Reports incorporate comprehensive session metadata, localized defect coordinates, and evidence images.
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

      {/* Backend & Persistence Notice */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {isBackendConnected ? (
            <CheckCircle2 className="w-4 h-4 text-pipestatus-healthy" />
          ) : (
            <AlertCircle className="w-4 h-4 text-pipestatus-warning" />
          )}
          <span className="font-mono text-pipeblack font-bold uppercase">Report Service Status:</span>
          <span className="text-pipeblack-muted">
            {isBackendConnected
              ? 'PDF Compiler service and storage linked via local backend.'
              : 'ReportLab PDF compiler and automated backup verification are not connected in Stage 1/2.'}
          </span>
        </div>
        <Badge variant={isBackendConnected ? 'neutral' : 'warning'}>
          {reports.length} Reports Generated
        </Badge>
      </div>

      {/* Local Storage Architecture & Backup Notice Callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex items-start gap-3">
          <HardDrive className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-pipeblack uppercase font-mono block">
              Local Storage Destination
            </span>
            <span className="text-pipeblack-muted mt-0.5 block leading-relaxed">
              Consolidated reports and defect snapshots are archived locally under <code className="bg-cream-100 px-1 py-0.5 border border-pipeborder font-mono text-[10px]">storage/reports/</code> upon inspection finalization.
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-pipeorange shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-pipeblack uppercase font-mono block">
              Backup Verification Requirement
            </span>
            <span className="text-pipeblack-muted mt-0.5 block leading-relaxed">
              Per Rulebook § 18, a backup is never reported successful until files exist and checksums are verified on disk.
            </span>
          </div>
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
            placeholder="Search by Report ID or Inspection ID..."
            className="bg-transparent border-none outline-none w-full text-pipeblack placeholder:text-pipeblack-muted/60 font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-pipeblack-muted">
          <span>Cataloged Reports: {filtered.length}</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-pipeblack-muted hover:text-pipeblack flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report ID</TableHead>
            <TableHead>Inspection Run ID</TableHead>
            <TableHead>Completion Date</TableHead>
            <TableHead>File Size</TableHead>
            <TableHead>Total Distance</TableHead>
            <TableHead>Defect Count</TableHead>
            <TableHead>Backup State</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableEmpty
              colSpan={8}
              message="Loading compiled reports from persistence storage..."
              icon={<RefreshCw className="w-8 h-8 text-pipeblack-muted mb-1 animate-spin" />}
            />
          ) : filtered.length > 0 ? (
            filtered.map((rep) => (
              <TableRow key={rep.id}>
                <TableCell className="font-mono font-bold text-pipeblack">{rep.id}</TableCell>
                <TableCell className="font-mono text-pipeblack-muted">{rep.inspectionId}</TableCell>
                <TableCell className="font-mono text-[11px] text-pipeblack-muted">
                  {formatDate(rep.compiledTimestamp)}
                </TableCell>
                <TableCell className="font-mono text-pipeblack">{formatFileSize(rep.fileSizeBytes)}</TableCell>
                <TableCell className="font-mono text-pipeblack">
                  {formatDistance(rep.totalDistanceMeters)}
                </TableCell>
                <TableCell className="font-mono font-bold text-pipeblack text-center">
                  {rep.defectCount ?? '—'}
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {rep.backupVerified ? (
                    <span className="text-pipestatus-healthy font-bold">VERIFIED</span>
                  ) : (
                    <span className="text-pipeblack-subtle">PENDING</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {rep.pdfRelativePath ? (
                    <a
                      href={api.reports.getDownloadUrl(rep.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-cream-100 hover:bg-cream-200 border border-pipeborder rounded-sm text-xs font-mono font-bold text-pipeblack transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </a>
                  ) : (
                    <span className="font-mono text-[10px] text-pipeblack-muted">Compiling</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={8}
              message={
                isBackendConnected
                  ? 'No consolidated inspection reports compiled yet.'
                  : 'No consolidated inspection reports compiled yet (PDF service not connected).'
              }
              icon={<FileText className="w-8 h-8 text-pipeblack-muted mb-1" />}
            />
          )}
        </TableBody>
      </Table>
    </div>
  );
};
