/**
 * PipeBot Unified Typed API Client
 * Follows Rules/PipeBot_Build_Rulebook.md § 16, 17, 18, 25
 *
 * Connects frontend operator dashboard to local Node.js backend.
 * Default API host: http://127.0.0.1:3000
 */

import type {
  InspectionSessionRecord,
  DefectEvidenceRecord,
  ConsolidatedReportRecord,
  InspectionLifecycleState,
} from '@/types/inspection';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    skip?: number;
    timestamp?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface DefectStats {
  total: number;
  unreviewed: number;
  confirmed: number;
  falsePositive: number;
  needsVerification: number;
}

export interface TelemetrySessionSummary {
  inspectionId: string;
  sampleCount: number;
  totalDistanceMeters: number | null;
  maxSpeedMps: number | null;
  avgSpeedMps: number | null;
  maxPitchDeg: number | null;
  minPitchDeg: number | null;
  maxRollDeg: number | null;
  minRollDeg: number | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
}

export interface SystemStatusData {
  process: 'alive' | 'degraded';
  uptimeSeconds: number;
  subsystems: {
    esp32: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';
    camera: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';
    aiEngine: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';
    database: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';
    databasePingMs?: number | null;
    gpuDeviceName: string | null;
    isGpuAvailable: boolean;
    lastChecked: string;
  };
  storage: {
    driver: string;
    isPersistent: boolean;
    limitation: string;
    storageRoot?: string;
  };
  details: {
    esp32: string;
    camera: string;
    aiEngine: string;
    database: string;
    gpu: string;
  };
}

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) {
        throw new ApiError(`Request failed with status ${res.status}`, res.status, 'HTTP_ERROR');
      }
      return {} as T;
    }

    const payload = (await res.json()) as ApiResponse<T>;

    if (!res.ok || payload.success === false) {
      const errMsg = payload.error?.message || `Request failed with status ${res.status}`;
      const errCode = payload.error?.code || 'API_ERROR';
      throw new ApiError(errMsg, res.status, errCode, payload.error?.details);
    }

    return payload.data;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request to ${endpoint} timed out after ${timeoutMs}ms`, 504, 'TIMEOUT');
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(message, 0, 'NETWORK_UNREACHABLE');
  }
}

export const api = {
  system: {
    getStatus: (): Promise<SystemStatusData> => request<SystemStatusData>('/api/system/status'),
    getHealth: (): Promise<{ status: string; uptimeSeconds: number }> => request('/healthz'),
    getReadiness: (): Promise<{ status: string; database: string }> => request('/readyz'),
  },

  inspections: {
    list: (params?: { limit?: number; skip?: number; status?: string }): Promise<{ items: InspectionSessionRecord[]; total: number }> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.skip) query.set('skip', String(params.skip));
      if (params?.status && params.status !== 'ALL') query.set('status', params.status);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request<{ items: InspectionSessionRecord[]; total: number }>(`/api/inspections${qs}`);
    },

    getById: (id: string): Promise<InspectionSessionRecord> =>
      request<InspectionSessionRecord>(`/api/inspections/${encodeURIComponent(id)}`),

    create: (dto: { conduitName?: string; operatorNotes?: string }): Promise<InspectionSessionRecord> =>
      request<InspectionSessionRecord>('/api/inspections', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    updateStatus: (id: string, status: InspectionLifecycleState): Promise<InspectionSessionRecord> =>
      request<InspectionSessionRecord>(`/api/inspections/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    getTelemetrySummary: (id: string): Promise<TelemetrySessionSummary> =>
      request<TelemetrySessionSummary>(`/api/inspections/${encodeURIComponent(id)}/telemetry/summary`),
  },

  defects: {
    list: (params?: { limit?: number; skip?: number; inspectionId?: string; reviewStatus?: string }): Promise<{ items: DefectEvidenceRecord[]; total: number }> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.skip) query.set('skip', String(params.skip));
      if (params?.inspectionId) query.set('inspectionId', params.inspectionId);
      if (params?.reviewStatus && params.reviewStatus !== 'ALL') query.set('reviewStatus', params.reviewStatus);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request<{ items: DefectEvidenceRecord[]; total: number }>(`/api/defects${qs}`);
    },

    getStats: (): Promise<DefectStats> =>
      request<DefectStats>('/api/defects/stats'),

    getById: (id: string): Promise<DefectEvidenceRecord> =>
      request<DefectEvidenceRecord>(`/api/defects/${encodeURIComponent(id)}`),

    updateReview: (id: string, dto: { reviewStatus: string; operatorNotes?: string }): Promise<DefectEvidenceRecord> =>
      request<DefectEvidenceRecord>(`/api/defects/${encodeURIComponent(id)}/review`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),

    getEvidenceDownloadUrl: (id: string): string =>
      `${API_BASE_URL}/api/evidence/${encodeURIComponent(id)}/download`,
  },

  reports: {
    list: (params?: { limit?: number; skip?: number }): Promise<{ items: ConsolidatedReportRecord[]; total: number }> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.skip) query.set('skip', String(params.skip));
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request<{ items: ConsolidatedReportRecord[]; total: number }>(`/api/reports${qs}`);
    },

    generate: (dto: { inspectionId: string }): Promise<ConsolidatedReportRecord> =>
      request<ConsolidatedReportRecord>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    getById: (id: string): Promise<ConsolidatedReportRecord> =>
      request<ConsolidatedReportRecord>(`/api/reports/${encodeURIComponent(id)}`),

    getDownloadUrl: (id: string): string =>
      `${API_BASE_URL}/api/reports/${encodeURIComponent(id)}/download`,
  },

  robot: {
    emergencyStop: (): Promise<{ status: string; stoppedAt: string }> =>
      request<{ status: string; stoppedAt: string }>('/api/robot/emergency-stop', {
        method: 'POST',
      }),
  },

  backups: {
    list: (): Promise<unknown> => request('/api/backups'),
    create: (dto: { inspectionId?: string; backupType?: 'full' | 'incremental' }): Promise<unknown> =>
      request('/api/backups', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    verify: (id: string): Promise<unknown> =>
      request(`/api/backups/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
      }),
  },
};
