# PipeBot Backend Service

Node.js, Express, and TypeScript backend service foundation with local persistent MongoDB database, filesystem evidence storage, versioned WebSocket telemetry streams, and cryptographic backup/restore for the PipeBot AI-powered robotic PVC pipe inspection vehicle.

Governed strictly by [`Rules/PipeBot_Build_Rulebook.md`](../Rules/PipeBot_Build_Rulebook.md).

---

## 1. System Architecture & Stage Status

> [!IMPORTANT]
> **Stage 2 (Backend) and Stage 3 (Database & Persistence) — COMPLETED & ACCEPTED**
>
> This service implements:
> - **Persistent Database**: Local-first MongoDB Community Server (bound strictly to `127.0.0.1:27017`) using Mongoose ODM with connection pooling, non-destructive indexing (`Model.createIndexes()`), connection fail-fast in production, and degraded development mode with 503 data-integrity guards.
> - **Durable Telemetry Persistence**: Batch ingestion with `sampleId` deduplication, bounded pagination, preserving raw encoder pulse counts and MPU6050 axes. Uncalibrated derived values (`leftRpm`, `speedMps`, `estimatedDistanceMeters`) remain strictly `null`.
> - **Durable Audit & System Event Logging**: Structured diagnostics across 8 categories, sensitive credential redaction, and strict enforcement of the safety invariant: software emergency stop events **always** have `physicalStopConfirmed: false`.
> - **Inspection Evidence Filesystem Storage**: Local storage under `storage/inspections/<id>/evidence/` with path traversal rejection, JPEG/PNG magic bytes validation, atomic temp-file writes, and SHA-256 verification.
> - **Report PDF File Storage & Download**: Local storage under `storage/inspections/<id>/reports/` with `%PDF-` magic bytes validation, SHA-256 checksum tracking, metadata-only MongoDB persistence, and verified file download.
> - **Backup & Restore System**: Cryptographic `manifest.json` generation, automated fallback from `mongodump` to structured JSON export, backup rotation (preserving minimum valid backup), and isolated restore verification into test database `pipebot_restore_test` with strict active database protection.
>
> **Explicit Boundaries & Prohibitions**:
> - **Local-First Only**: Remote/cloud MongoDB URIs (e.g. MongoDB Atlas) are strictly rejected at startup.
> - **Hardware & Motors**: No ESP32 serial communication or motor movement commands are executed. Movement route `/api/robot/commands` is unconditionally locked out with `503 FEATURE_DISABLED`. Hardware integration belongs to **Stage 5**.
> - **Camera**: Raspberry Pi camera optical stream reception belongs to **Stage 5**.
> - **AI / YOLO**: Defect detection model inference and PyTorch GPU acceleration belong to **Stage 4**.
> - **Continuous Video**: Continuous video is **never** stored in MongoDB (Rulebook § 16.4).
> - **No Distance Coercion**: Missing or uncalibrated distance measurements are **never** coerced to zero.

---

## 2. Prerequisites & Environment Setup

- **Node.js**: `v20.x` or higher (verified on `v22.23.2`)
- **npm**: `v10.x` or higher (verified on `10.9.8`)
- **MongoDB**: MongoDB Community Server 8.0.34 running locally on `127.0.0.1:27017`
- **Operating System**: Windows 11 x64 (local inspection laptop)

### Setup Steps
1. Navigate to the backend directory:
   ```bash
   cd D:\Pipe-Bot-2\backend
   ```
2. Install pinned dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration template:
   ```bash
   cp .env.example .env
   ```
4. Verify environment configuration variables:
   | Variable | Default | Purpose |
   |---|---|---|
   | `PORT` | `5000` | Port on which HTTP & WebSocket server listens |
   | `HOST` | `127.0.0.1` | Loopback host interface for secure local execution |
   | `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
   | `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Permitted frontend origins (Vite port 3000) |
   | `LOG_LEVEL` | `info` | Structured logging verbosity level |
   | `OPERATOR_TOKEN` | `pipebot-dev-operator-token-32ch` | 32-character minimum secret for operator control authorization |
   | `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Local MongoDB connection URI (remote URIs forbidden) |
   | `MONGODB_DB_NAME` | `pipebot` | Target database name (`pipebot` for prod, `pipebot_test` for tests) |
   | `STORAGE_DRIVER` | `mongodb` | Active storage driver (`mongodb` required in production) |
   | `STORAGE_ROOT` | `./storage` | Filesystem root for local evidence, reports, and logs |
   | `MAX_EVIDENCE_FILE_SIZE_BYTES`| `5242880` | Maximum evidence file size in bytes (5 MB) |
   | `BACKUP_DIR` | `./storage/backups` | Root directory for local database & file backups |
   | `BACKUP_RETENTION_COUNT` | `5` | Maximum number of completed backups to retain during rotation |

---

## 3. Development & Build Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts server with live auto-reload via `tsx watch` |
| `npm run typecheck` | Validates TypeScript types strictly (`tsc --noEmit`) |
| `npm test` | Runs the full Vitest suite (20 test suites, 200 tests) |
| `npm run build` | Compiles TypeScript source to `./dist` |
| `npm start` | Runs the compiled JavaScript application (`node dist/server.js`) |
| `npm audit --omit=dev` | Audits production dependencies (0 vulnerabilities) |

---

## 4. REST API Overview

All REST responses adhere to the standard envelope structure:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-11-01T15:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### 4.1 System & Diagnostic Endpoints
- `GET /healthz`: Process liveness probe.
- `GET /readyz`: Readiness probe confirming MongoDB connection state.
- `GET /api/system/status`: Comprehensive subsystem status, declaring storage driver, database health snapshot, and unattached hardware state.
- `GET /api/system/events`: Paginated query of system diagnostic and audit events.
- `POST /api/system/events`: Record system diagnostic event (emergency stop events enforce `physicalStopConfirmed: false`).

### 4.2 Robot State & Safety Endpoints
- `GET /api/robot/status`: Returns ESP32 connection state (`disconnected`, `connecting`, `connected`, `error`).
- `POST /api/robot/commands`: Operator movement pulse. Protected by `x-operator-token`. Unconditionally rejected in Stage 2/3 with `503 FEATURE_DISABLED`.
- `POST /api/robot/emergency-stop`: Auxiliary software emergency stop request. Open without token gating (fail-safe principle). Returns `status: "REQUEST_ACCEPTED"`, `physicalStopConfirmed: false`.

### 4.3 Inspection Session Endpoints
- `POST /api/inspections`: Create new inspection session (`ready` status, initial `totalDistanceMeters: null`).
- `GET /api/inspections`: Paginated list of inspection records.
- `GET /api/inspections/:id`: Retrieve single inspection by ID.
- `POST /api/inspections/:id/start`: Transition from `ready` or `paused` to `running`.
- `POST /api/inspections/:id/pause`: Transition from `running` to `paused`.
- `POST /api/inspections/:id/resume`: Transition from `paused` to `running`.
- `POST /api/inspections/:id/complete`: Transition from `running` or `paused` to `completed`.

### 4.4 Telemetry Endpoints
- `POST /api/inspections/:id/telemetry`: Ingest single telemetry sample or batch array. Deduplicates by `sampleId`.
- `GET /api/inspections/:id/telemetry`: Paginated and time-bounded query of stored telemetry samples.
- `GET /api/inspections/:id/telemetry/latest`: Retrieve newest telemetry sample for the inspection.

### 4.5 Defect & Evidence Endpoints
- `GET /api/defects`: Filtered and paginated list of defect records.
- `GET /api/defects/:id`: Retrieve defect details by ID.
- `PATCH /api/defects/:id/review`: Operator review update (`reviewStatus`: `UNREVIEWED`, `CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_VERIFICATION`).
- `POST /api/inspections/:id/defects/:defectId/evidence`: Upload binary image evidence (JPEG/PNG). Atomically written, SHA-256 calculated, and defect metadata updated.
- `GET /api/inspections/:id/evidence/:filename`: Stream stored evidence image with ETag, MIME type, and immutable caching headers.

### 4.6 Report Endpoints
- `GET /api/reports`: List of report metadata records.
- `GET /api/reports/:id`: Retrieve report metadata by ID.
- `POST /api/reports`: Request report generation for a `completed` inspection (`pending` state).
- `GET /api/reports/:id/download`: Download verified compiled report PDF file (`Content-Disposition: attachment`).

### 4.7 Backup & Restore Endpoints
- `GET /api/backups`: List all available backups with metadata, verification status, and timestamps.
- `GET /api/backups/:id`: Retrieve full `manifest.json` for a specific backup.
- `POST /api/backups`: Operator-authorized backup creation (`x-operator-token` required). Dumps database, copies evidence, and creates verified manifest.
- `POST /api/backups/:id/verify`: Verifies all files and collections in a backup against SHA-256 checksums.
- `POST /api/backups/:id/restore-verify`: Operator-authorized dry-run restore into isolated test database `pipebot_restore_test` (`x-operator-token` required). Strictly forbids restoring into active database `pipebot`.

---

## 5. Storage Directory Layout

```
storage/
├── inspections/
│   └── <inspection-id>/
│       ├── evidence/
│       │   └── <defectId>_<frameId>.jpg
│       └── reports/
│           └── <reportId>.pdf
└── backups/
    └── backup_<timestamp>_<uuid>/
        ├── manifest.json
        ├── mongo_dump/
        │   ├── inspections.json
        │   ├── defects.json
        │   ├── reports.json
        │   ├── telemetry.json
        │   └── system_events.json
        └── files/
            └── inspections/
                └── ...
```

---

## 6. Backup & Restore Architecture

### 6.1 Cryptographic Manifest Structure
Every backup produces a `manifest.json`:
```json
{
  "backupId": "backup_20261101153000_a1b2c3d4",
  "timestamp": "2026-11-01T15:30:00.000Z",
  "databaseName": "pipebot",
  "dumpMethod": "structured_export",
  "totalSizeBytes": 1048576,
  "files": [
    {
      "relativePath": "inspections/insp-01/evidence/def-01_frm-01.jpg",
      "fileSizeBytes": 45200,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "collections": [
    {
      "name": "inspections",
      "documentCount": 12,
      "fileSizeBytes": 8450,
      "sha256": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    }
  ],
  "manifestVersion": "1.0.0",
  "verified": true
}
```

### 6.2 Automatic Fallback & Concurrency Guard
- **CLI Detection**: The system checks for `mongodump` / `mongorestore` at `MONGODUMP_PATH` or in system `PATH`. If absent, it automatically executes a structured JSON export/import via Mongoose without failing.
- **Concurrency Guard**: An internal boolean lock prevents overlapping backup operations, returning `409 BACKUP_IN_PROGRESS`.
- **Rotation Guard**: When retaining the newest `BACKUP_RETENTION_COUNT` backups, the service ensures at least 1 verified backup remains at all times.
- **Active Database Protection**: Automated or manual restore verification strictly rejects restoring into active database `pipebot` (`403 ACTIVE_DATABASE_PROTECTED`). Restorations verify into isolated `pipebot_restore_test` and drop the test database after verification.

---

## 7. Security Guarantees & Audit Status

- **Zero Production Vulnerabilities**: `npm audit --omit=dev` reports **0 vulnerabilities** across all production runtime dependencies.
- **Clean TypeScript Compilation**: Strict TypeScript compilation (`tsc --noEmit` and `tsc`) produces **0 errors**.
- **Automated Test Coverage**: **20 test suites, 200 tests passing** with 100% pass rate.
- **Dev-Dependency Advisory Review**:
  Vitest 3.2.7 transitive dev-dependencies (`@vitest/mocker`, `tinypool`) have upstream advisories (GHSA-82fw-gwwq-j7x9, GHSA-5gmw-xhrv-c9v3). These are dev-only test runner dependencies that do not execute in production. Updating to Vitest 5.x introduces breaking changes to test execution hooks and will be coordinated during Stage 12 system hardening.
