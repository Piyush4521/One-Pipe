# PipeBot Backend Service

Node.js, Express, and TypeScript backend service foundation for the PipeBot AI-powered robotic PVC pipe inspection vehicle.

Governed strictly by [`Rules/PipeBot_Build_Rulebook.md`](../Rules/PipeBot_Build_Rulebook.md).

---

## 1. System Architecture & Stage Boundaries

> [!IMPORTANT]
> **Stage 2: Backend ONLY — Completed**
>
> This service implements the local-first HTTP backend foundation, versioned WebSocket event stream, Zod schema validation, structured Pino logging, request correlation, error handling, in-memory repository testbed, and health diagnostic probes.
>
> **Explicit Non-Implementations at this Stage**:
> - **Database**: Local MongoDB Community Server and Mongoose models are **not** implemented in Stage 2. The active storage driver is explicitly reported as `volatile_memory_testbed`. Persistent storage belongs exclusively to **Stage 3**.
> - **Hardware & Motors**: No ESP32 serial communication, PWM generation, or motor movement commands are executed. Movement route `/api/robot/commands` is unconditionally locked out with `503 FEATURE_DISABLED`. Hardware integration belongs to **Stage 5**.
> - **Telemetry Producer**: No physical ESP32 telemetry producer is connected. Live telemetry is explicitly broadcast as unavailable (`isAvailable: false`, explicit `null` sensor values).
> - **Camera**: Raspberry Pi camera stream reception is **not** initialized. Belongs to **Stage 5**.
> - **AI / YOLO**: Defect detection model inference and PyTorch GPU acceleration belong to **Stage 4**.
> - **Report PDF Compilation**: PDF file compilation and evidence bundling belong to **Stage 3 / Stage 11**. Reports are tracked in `pending` metadata state with `null` file paths.

---

## 2. Prerequisites & Environment Setup

- **Node.js**: `v20.x` or higher (verified on `v22.23.2`)
- **npm**: `v10.x` or higher (verified on `10.9.8`)
- **Operating System**: Windows 11 (runs locally on inspection laptop)

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
   | `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Permitted frontend origins (aligned with Vite port 3000) |
   | `LOG_LEVEL` | `info` | Structured logging verbosity level |
   | `OPERATOR_TOKEN` | `pipebot-dev-operator-token-32ch` | 32-character minimum secret for operator control authorization |

---

## 3. Development & Build Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts server with live auto-reload via `tsx watch` |
| `npm run typecheck` | Validates TypeScript types strictly (`tsc --noEmit`) |
| `npm test` | Runs the full Vitest suite (unit, integration, resilience) |
| `npm run build` | Compiles TypeScript source to `./dist` |
| `npm start` | Runs the compiled JavaScript application (`node dist/server.js`) |

---

## 4. REST API Overview

All REST responses adhere to the standard envelope structure:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-11-01T01:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### 4.1 System & Diagnostic Endpoints
- `GET /healthz`: Process liveness probe. Returns uptime, node environment, version.
- `GET /api/system/status`: Comprehensive subsystem status. Declares `storage.driver: "volatile_memory_testbed"` and truthy `offline` states for unattached hardware.

### 4.2 Robot State & Safety Endpoints
- `GET /api/robot/status`: Returns truthful ESP32 connection state (`disconnected`, `connecting`, `connected`, `error`).
- `POST /api/robot/commands`: Operator movement pulse. Protected by `x-operator-token`. Unconditionally rejected in Stage 2 with `503 FEATURE_DISABLED`.
- `POST /api/robot/emergency-stop`: Auxiliary software emergency stop request. Open without token gating (fail-safe principle). Returns `status: "REQUEST_ACCEPTED"`, `physicalStopConfirmed: false`, and explicitly warns that the physical chassis button is the primary safety cutoff.

### 4.3 Inspection Session Endpoints
- `POST /api/inspections`: Create new inspection session (`ready` status).
- `GET /api/inspections`: Paginated list of inspection records.
- `GET /api/inspections/:id`: Retrieve single inspection by ID.
- `POST /api/inspections/:id/start`: Transition from `ready` or `paused` to `running`.
- `POST /api/inspections/:id/pause`: Transition from `running` to `paused`.
- `POST /api/inspections/:id/resume`: Transition from `paused` to `running`.
- `POST /api/inspections/:id/complete`: Transition from `running` or `paused` to `completed`.

### 4.4 Defect Review Endpoints
- `GET /api/defects`: Filtered and paginated list of defect records.
- `GET /api/defects/:id`: Retrieve defect details by ID.
- `PATCH /api/defects/:id/review`: Human operator review update (`reviewStatus`: `UNREVIEWED`, `CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_VERIFICATION`).

### 4.5 Report Metadata Endpoints
- `GET /api/reports`: List of compiled or pending report metadata records.
- `GET /api/reports/:id`: Retrieve report metadata by ID.
- `POST /api/reports`: Request report generation for a `completed` inspection. Returns `status: "pending"` with truthful `null` values for `pdfRelativePath`, `fileSizeBytes`, `totalDistanceMeters`, and `defectCount`.

---

## 5. WebSocket Event Stream (`/ws`)

### 5.1 Protocol Specification & Transport Ping Semantics
- **Path**: `/ws`
- **Supported Protocol Version**: `1.0.0`
- **Origin Validation**: Only requests whose `Origin` header matches `CORS_ORIGIN` are upgraded. Unmatched origins receive HTTP `403 Forbidden`.
- **Transport Heartbeat Semantics**: Software-level ping/pong runs every 30 seconds (`WS_TRANSPORT_PING_INTERVAL_MS`).
  > [!IMPORTANT]
  > This ping/pong mechanism is **purely a software-level TCP socket keepalive** to detect and clean up dropped network connections between the client and Node.js backend.
  > It is **explicitly NOT an ESP32 robot command watchdog, motor safety cutoff, or hardware heartbeat timeout** (Rulebook § 10.1). No robot safety timing is inferred from this setting.

### 5.2 Versioned Message Envelope
Every WebSocket message conforms to:
```typescript
interface WsMessageEnvelope<T> {
  protocolVersion: "1.0.0";
  messageId: string;       // Unique UUID
  type: string;            // Message topic
  timestamp: string;       // ISO 8601 UTC
  payload: T;
}
```

### 5.3 Downstream Message Types (Server -> Client)
1. `connection.ack`: Handshake response with assigned role (`monitoring`), subscribed channels (`["monitoring"]`), and `isTelemetryProducerAttached: false`.
2. `robot.status`: Real-time hardware connection snapshot.
3. `robot.telemetry`: Vehicle telemetry snapshot (or explicit unavailable payload).
4. `inspection.status`: Lifecycle state transition event.
5. `defect.detected`: Defect detection event with separated optical frame capture and AI inference completion timestamps.
6. `system.status`: Subsystem health update.
7. `robot.emergency_stop_ack`: Software emergency-stop request acknowledgement (`physicalStopConfirmed: false`).
8. `subscription.ack`: Confirmed channel subscription list.
9. `error`: Structured protocol, validation, or disabled feature error.
10. `pong`: Transport keepalive pong response.

### 5.4 Upstream Message Types (Client -> Server)
1. `ping`: Transport keepalive ping (`{ protocolVersion: "1.0.0", type: "ping", payload: { clientTimestamp: "..." } }`).
2. `subscribe`: Channel subscription (`{ protocolVersion: "1.0.0", type: "subscribe", payload: { channels: ["monitoring"] } }`).
3. `unsubscribe`: Channel removal (`{ protocolVersion: "1.0.0", type: "unsubscribe", payload: { channels: ["monitoring"] } }`).

### 5.5 Client Authority & Hardened Access Control
- **Monitoring-Only Access**: In Stage 2, all WebSocket connections are restricted to role `monitoring` and channel `monitoring`.
- **Privileged Channel Lockout**: Subscriptions to `operator_control` are rejected with `FEATURE_DISABLED`.
- **In-Band Authentication Disabled**: In-band token authentication messages (`type: "auth"`) are rejected with `FEATURE_DISABLED`. Secure token provisioning and browser storage have not been established; operator credentials are never accepted over WebSocket.
- **Credential Protection**:
  - `OPERATOR_TOKEN` is **never** accepted via WebSocket URL query strings, messages, or browser parameters.
  - User-Agent and Origin are **never** treated as authentication credentials.
  - REST operator authorization remains strictly enforced on HTTP endpoints (`x-operator-token`).

### 5.6 Telemetry Measurement Semantics & Calibration Dependencies
- **Raw Sensor Readings**:
  - `leftEncoderCount`, `rightEncoderCount`: Raw integer pulse counts from ESP32 interrupt routines (null when unread).
  - `mpu6050`: Direct inertial measurement samples (accelerometer and gyro axes; null when unread).
- **Derived & Calibrated Measurements (Provisional)**:
  - `leftRpm`, `rightRpm`: Provisional rotational velocity. Dependent on hardware sample period and pulses-per-revolution (PPR) calibration.
  - `speedMps`: Provisional linear translational velocity. Dependent on wheel diameter, gearbox ratio, and slip ratio.
  - `estimatedDistanceMeters`: Provisional longitudinal travel. Dependent on physical wheel circumference and track calibration.
  > [!NOTE]
  > Derived metrics are **not physically meaningful** until mechanical calibration is performed in Stage 5. Uncalibrated or unavailable measurements strictly remain `null`. No hardware conversion constants (PPR, circumference, RPM limits) are invented.

### 5.7 Defect Event Readiness
- `defect.detected` exists as a provisional, versioned application event schema for Stage 4 integration.
- No AI inference producer is attached in Stage 2; no synthetic defect events are emitted at runtime.
- Model `confidence` (0.0 to 1.0 probability) is strictly distinguished from physical defect severity (Rulebook § 14.5).
- Camera `frameCaptureTimestamp` is strictly separated from AI `inferenceTimestamp`.

### 5.8 Backpressure & Slow-Client Protection
- **Latest-Value Dropping**: If a client socket's `bufferedAmount` exceeds `256 KB`, high-frequency telemetry messages are dropped for that client to avoid buffering stale sensor data.
- **Hard Ceiling Disconnection**: If a slow client's `bufferedAmount` exceeds `1 MB`, the server terminates the socket with close code `1008` (Policy Violation) to prevent backend process memory exhaustion.

---

## 6. Security Guarantees & Verification State

- **Zero Production Vulnerabilities**: `npm audit` reports 0 vulnerabilities across all production runtime dependencies.
- **Clean Compilation**: Strict TypeScript compilation (`tsc --noEmit` and `tsc`) produces 0 errors.
- **Automated Test Coverage**: 88 unit, integration, and resilience tests across 12 test suites with 100% pass rate.
- **Strict Decoupling**: Stage 2 contains zero MongoDB dependencies, zero hardware simulation loops, and zero fake sensor generators.
