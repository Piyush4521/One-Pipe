/**
 * Report Domain Models & DTO Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 * Aligned with frontend ConsolidatedReportRecord in frontend/src/types/inspection.ts
 *
 * NOTE: Values are strictly null until a real PDF is compiled and verified on disk (Stage 3/11).
 */

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface ReportRecord {
  id: string;
  inspectionId: string;
  status: ReportStatus;
  compiledTimestamp: string | null;   // null until compiled
  fileSizeBytes: number | null;       // null until file generated & verified on disk
  totalDistanceMeters: number | null; // null until compiled from verified data
  defectCount: number | null;         // null until compiled from verified data
  pdfRelativePath: string | null;     // null until PDF file exists on disk
  pdfSha256?: string | null;          // SHA-256 hash of generated report PDF
  backupVerified: boolean;
  errorMessage?: string;
  note?: string;
}

export interface GenerateReportDTO {
  inspectionId: string;
}
