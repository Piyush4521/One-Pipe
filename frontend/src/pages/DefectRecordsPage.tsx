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
import { AlertOctagon, Filter, Search, ShieldCheck, Database, RefreshCw } from 'lucide-react';

export const DefectRecordsPage: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Safety Notice regarding Confidence vs Severity */}
      <div className="p-3.5 bg-cream-50 border-l-4 border-pipeyellow border-y border-r border-pipeborder rounded-sm flex items-start gap-3 text-xs">
        <ShieldCheck className="w-4 h-4 text-pipeyellow-hover shrink-0 mt-0.5" />
        <div className="text-pipeblack-muted leading-relaxed">
          <strong className="text-pipeblack font-mono uppercase mr-1.5">Rulebook § 14.5 Engineering Constraint:</strong>
          AI confidence scores reflect model detection probability and must never be conflated with physical structural defect severity.
          Classification of structural severity requires independent engineering validation and is never fabricated.
        </div>
      </div>

      {/* Backend Disconnected Notice */}
      <div className="p-3 bg-white border border-pipeborder rounded-sm shadow-industrial-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-pipeblack-muted" />
          <span className="font-mono text-pipeblack font-bold uppercase">Persistence Status:</span>
          <span className="text-pipeblack-muted">Local MongoDB Community Server unlinked (Stage 1 frontend preview).</span>
        </div>
        <Badge variant="neutral">0 Records Synchronized</Badge>
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
            placeholder="Search by Defect ID, Frame ID, or Notes..."
            className="bg-transparent border-none outline-none w-full text-pipeblack placeholder:text-pipeblack-muted/60 font-mono text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-pipeblack-muted" />
            <span className="text-pipeblack-muted uppercase text-[10px] font-bold">Class:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-cream-50 border border-pipeborder rounded-sm px-2 py-1 text-xs text-pipeblack font-mono outline-none cursor-pointer"
            >
              <option value="ALL">All Dataset Classes</option>
              <option value="UNAUDITED">Pending Dataset Audit (Rulebook § 13)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
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
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedClass('ALL');
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

      {/* Table Structure with Complete Field Headers */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evidence Frame</TableHead>
            <TableHead>Defect ID</TableHead>
            <TableHead>Frame ID</TableHead>
            <TableHead>Dataset Class</TableHead>
            <TableHead>Model Confidence</TableHead>
            <TableHead>Estimated Distance</TableHead>
            <TableHead>Capture Timestamp</TableHead>
            <TableHead className="text-right">Review Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty
            colSpan={8}
            message="No defect evidence records found. Records will populate automatically during live AI inspection runs."
            icon={<AlertOctagon className="w-8 h-8 text-pipeblack-muted mb-1" />}
          />
        </TableBody>
      </Table>
    </div>
  );
};
