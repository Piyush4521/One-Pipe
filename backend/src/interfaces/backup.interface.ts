/**
 * Backup & Restore Domain Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.4, 17
 */

export interface BackupFileEntry {
  relativePath: string;
  fileSizeBytes: number;
  sha256: string;
}

export interface BackupCollectionEntry {
  name: string;
  documentCount: number;
  fileSizeBytes?: number;
  sha256?: string;
}

export interface BackupManifest {
  backupId: string;
  timestamp: string; // ISO 8601
  databaseName: string;
  dumpMethod: 'mongodump' | 'structured_export';
  totalSizeBytes: number;
  files: BackupFileEntry[];
  collections: BackupCollectionEntry[];
  manifestVersion: string;
  consistencyVerified: boolean;
  verified: boolean;
}

export interface BackupSummary {
  backupId: string;
  timestamp: string;
  databaseName: string;
  dumpMethod: 'mongodump' | 'structured_export';
  fileCount: number;
  collectionCount: number;
  totalSizeBytes: number;
  verified: boolean;
}

export interface RestoreVerificationResult {
  backupId: string;
  targetDatabase: string;
  verifiedAt: string;
  manifestVerified: boolean;
  restoredCollections: {
    name: string;
    expectedCount: number;
    restoredCount: number;
  }[];
  representativeRecordsVerified: boolean;
  allMatched: boolean;
  cleanedUp: boolean;
}

