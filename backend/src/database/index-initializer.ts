/**
 * Controlled MongoDB Index Initializer
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.4
 *
 * Implements non-destructive, safe index initialization using Model.createIndexes().
 * CRITICAL SAFETY RULES:
 * 1. NEVER calls syncIndexes(), which destructively drops unrecognized operational indexes.
 * 2. createIndexes() ensures all defined indexes exist while leaving existing indexes intact.
 * 3. Does not add speculative indexes.
 */

import {
  DefectModel,
  InspectionModel,
  ReportModel,
  SystemEventModel,
  TelemetrySampleModel,
} from '../models';
import { logger } from '../utils/logger';

export interface IndexInitResult {
  collection: string;
  status: 'ensured' | 'failed';
  error?: string;
}

export interface DatabaseIndexReport {
  timestamp: string;
  success: boolean;
  results: IndexInitResult[];
}

/**
 * Ensures all required schema indexes are created in MongoDB.
 * Non-destructive and safe for startup invocation.
 */
export async function initializeDatabaseIndexes(): Promise<DatabaseIndexReport> {
  const models = [
    { name: 'inspections', model: InspectionModel },
    { name: 'defects', model: DefectModel },
    { name: 'reports', model: ReportModel },
    { name: 'system_events', model: SystemEventModel },
    { name: 'telemetry', model: TelemetrySampleModel },
  ];

  const results: IndexInitResult[] = [];
  let allSuccess = true;

  for (const { name, model } of models) {
    try {
      await model.createIndexes();
      results.push({ collection: name, status: 'ensured' });
    } catch (err: any) {
      allSuccess = false;
      results.push({ collection: name, status: 'failed', error: err.message });
      logger.error(
        { collection: name, errorMessage: err.message },
        'Failed to initialize collection indexes'
      );
    }
  }

  const report: DatabaseIndexReport = {
    timestamp: new Date().toISOString(),
    success: allSuccess,
    results,
  };

  logger.info({ report }, 'MongoDB index initialization check completed');
  return report;
}

