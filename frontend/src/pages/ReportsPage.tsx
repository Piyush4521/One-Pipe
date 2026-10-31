import { useState, type FC } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableEmpty,
  Badge,
} from '@/components/ui';
import { FileText, HardDrive, ShieldAlert, Search, RefreshCw, AlertCircle } from 'lucide-react';

export const ReportsPage: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Backend Disconnected Notice */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-pipestatus-warning" />
          <span className="font-mono text-pipeblack font-bold uppercase">Report Service Status:</span>
          <span className="text-pipeblack-muted">
            ReportLab PDF compiler and automated backup verification are not connected in Stage 1.
          </span>
        </div>
        <Badge variant="neutral">0 Reports Generated</Badge>
      </div>

      {/* Local Storage Architecture & Backup Notice Callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex items-start gap-3">
          <HardDrive className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-pipeblack uppercase font-mono block">
              Local Storage Destination (Planned)
            </span>
            <span className="text-pipeblack-muted mt-0.5 block leading-relaxed">
              Consolidated reports and defect snapshots will be archived locally under <code className="bg-cream-100 px-1 py-0.5 border border-pipeborder font-mono text-[10px]">storage/reports/</code> upon inspection finalization.
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
              Per Rulebook § 18, a backup is never reported successful until files exist and checksums are verified on disk. No backup has run yet.
            </span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar Shell */}
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
          <span>Cataloged Reports: 0</span>
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

      {/* Complete Reports Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report ID</TableHead>
            <TableHead>Inspection Run ID</TableHead>
            <TableHead>Completion Date</TableHead>
            <TableHead>Total Distance</TableHead>
            <TableHead>Defect Count</TableHead>
            <TableHead>Compiler Status</TableHead>
            <TableHead>Backup State</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty
            colSpan={8}
            message="No consolidated inspection reports compiled yet (PDF service not connected)."
            icon={<FileText className="w-8 h-8 text-pipeblack-muted mb-1" />}
          />
        </TableBody>
      </Table>
    </div>
  );
};
