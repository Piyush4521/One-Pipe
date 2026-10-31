# PipeBot Build Rulebook
## Product Requirements, Architecture, Engineering Standards, Safety Rules, and Development Plan

**Document:** PipeBot Build Rulebook  
**Version:** 1.0  
**Status:** Approved baseline for Version 1  
**Project root:** `D:\Pipe-Bot-2`  
**Development environment:** Windows 11 + Google Antigravity  
**Purpose:** This document is the controlling build specification for PipeBot. Use it as the persistent project instruction file when planning, generating, reviewing, testing, or modifying code.

---

# 1. How this rulebook must be used

1. Treat this document as the source of truth for PipeBot V1.
2. Follow the approved architecture, product decisions, hardware boundaries, dataset policy, safety requirements, and development order.
3. Do not silently change the stack, architecture, protocols, database, control permissions, or dataset policy.
4. If a requirement conflicts with this document, stop and ask for clarification rather than guessing.
5. New explicit decisions from the project owner may amend this rulebook. Record the change and its reason in the project documentation.
6. Distinguish verified facts, proposed designs, assumptions, and items still requiring measurement or inspection.
7. Never represent a proposed feature, illustrative metric, untested connection, or simulated result as working hardware functionality.
8. Work in small, testable stages. Do not proceed to the next major stage until the current stage passes its acceptance tests.
9. Before modifying an existing project, inspect its files, current Git status, and relevant implementation. Preserve working code unless a change is explicitly approved.
10. Provide complete implementations, exact file paths, commands, execution location, configuration requirements, and tests.

## Requirement labels

Use these labels in project documentation and implementation notes:

- **CONFIRMED:** Explicitly reported by the project owner or demonstrated in the current project.
- **APPROVED:** Explicitly selected as the V1 product or architecture decision.
- **PROPOSED:** Recommended design that has not yet been implemented or validated.
- **UNVERIFIED:** Needs datasheet inspection, measurement, test, or user confirmation.
- **BLOCKED:** Must not proceed until a named dependency or safety condition is resolved.

---

# 2. Product objective

PipeBot is an AI-powered robotic PVC pipe inspection vehicle.

The intended end-to-end operation is:

1. The operator connects the robot to the laptop over local Wi-Fi.
2. The application verifies ESP32, camera, AI service, and database availability.
3. The operator creates an inspection record.
4. The operator starts the inspection.
5. The robot travels inside a pipe under laptop control.
6. The Raspberry Pi captures and streams internal pipe footage directly to the laptop.
7. The laptop runs the project's trained YOLO model on the incoming footage.
8. The live video is displayed with AI bounding boxes.
9. Encoder telemetry is synchronized with each frame's capture time to estimate defect distance from the inspection start.
10. The application records defect evidence and inspection metadata.
11. The operator completes the inspection.
12. PipeBot creates one consolidated report for the complete inspection.
13. Inspection data, defect images, reports, and backups remain on local storage.

**Primary objective:** Deliver a working end-to-end prototype on real hardware. A visually polished but disconnected dashboard is not an acceptable completion.

---

# 3. Approved product decisions

These decisions are approved for V1 and override any earlier conflicting proposal.

| Area | Approved V1 decision |
|---|---|
| Product | PipeBot robotic PVC pipe inspection system |
| Laptop OS | Windows 11 |
| IDE | Google Antigravity |
| Network | Local Wi-Fi |
| Internet during operation | Not required |
| Operator model | Single operator; no user-account system |
| Main interface | Laptop web dashboard |
| Mobile interface | Browser-based monitoring only |
| Mobile robot controls | Not allowed |
| Robot control authority | Laptop only |
| Inspection workflow | Connect robot → create inspection → start |
| Video | Live camera feed with AI bounding boxes |
| AI execution | Laptop, not Raspberry Pi |
| GPU | NVIDIA GeForce RTX 2050, 4 GB VRAM |
| Video storage | Do not continuously record video in V1 |
| Evidence storage | Save defect images and complete inspection metadata |
| Database | MongoDB Community Server running locally on laptop |
| File storage | Local filesystem |
| Reports | Locally generated consolidated PDF per inspection |
| Backup | Automatic local backup after each completed inspection |
| Emergency stop | Dedicated physical emergency stop plus dashboard stop |
| UI reference | OneGuard LPG screenshots and website |
| Visual identity | Cream/off-white, yellow, black, restrained orange, green/amber/red statuses |

Do not use MongoDB Atlas as the V1 operational database. The owner selected MongoDB Community Server on the laptop so the inspection system works without internet access.

Do not provide robot movement controls in the mobile interface. Mobile is monitoring-only.

---

# 4. Existing hardware inventory

The following is the current reported hardware inventory.

| Component | Current information | Status / restrictions |
|---|---|---|
| Main controller | ESP32-WROOM-32 DevKit V1 | Confirmed by owner and photographs |
| Raspberry Pi | Raspberry Pi Zero 2 W | Confirmed by owner and photograph |
| Camera | Raspberry Pi camera; exact model not known | UNVERIFIED; identify before camera-specific changes |
| Motor driver | SmartElex 15D dual-channel motor driver | Reported and photographed; verify exact board revision and datasheet |
| Motors | Four BO geared DC motors | Confirmed; exact voltage, current, RPM and gear ratio unknown |
| Encoders | Two external wheel encoders | Owner reports pulse counts are being produced |
| IMU | MPU6050 module | Confirmed by photograph |
| Battery | Pro:Range battery pack; label appears to show 5000 mAh and 3C | Exact cell count, nominal voltage, full-charge voltage, chemistry and protection details remain UNVERIFIED |
| Chassis | Four-wheel robot chassis | Photographs supplied |

## 4.1 Existing functions reported as working

These are owner-reported demonstrations, not independently bench-tested by this document:

- The robot/car has been driven and movement worked.
- Raspberry Pi camera streaming has been started.
- The stream was opened and viewed in VLC using its stream link.
- Both external encoders are producing pulse counts.

Do not unnecessarily rebuild or replace these working functions. Inspect their existing code, configuration, wiring and test procedure before modifying them.

## 4.2 Hardware details that must not be guessed

Never invent or assume:

- ESP32 GPIO assignments.
- Motor-driver input pin mapping.
- Motor-driver logic voltage or motor supply range.
- Motor stall current or continuous current.
- Battery voltage, cell count, polarity, chemistry or safe discharge limits.
- Encoder output voltage, output type, pulses per revolution, quadrature mode or effective PPR.
- Wheel diameter or effective rolling circumference.
- Gearbox ratio.
- Camera model, sensor, lens, resolution, frame rate or connector compatibility.
- Raspberry Pi camera interface compatibility.
- MPU6050 module voltage tolerance or logic-level compatibility.

Before giving wiring instructions, inspect the exact board/module labels and authoritative datasheets. Use a multimeter where appropriate. Confirm common ground and logic-level compatibility. Never connect an unknown voltage to an ESP32 GPIO.

## 4.3 Hardware safety rules

1. Keep the robot wheels raised or the robot mechanically restrained during initial motor-control tests.
2. Disconnect motor power before changing motor-driver wiring.
3. Do not power motors from the ESP32 3.3 V rail.
4. Do not assume the motor driver can safely handle the combined stall current of four motors.
5. Verify the SmartElex 15D board's supported motor arrangement and current limits before final wiring.
6. Verify whether the two driver channels are intended to drive the four motors in the robot's actual left/right arrangement.
7. Check battery polarity, voltage and current capability before connection.
8. Use suitable fusing and power distribution after the load and wiring are verified.
9. Avoid powering the Raspberry Pi from an unverified supply.
10. Secure wires, connectors, battery and boards against vibration and wheel entanglement.
11. Test the physical emergency-stop path before any autonomous or remote movement test.
12. Never rely on AI, Wi-Fi, the web dashboard, or a software message as the only motor safety mechanism.

---

# 5. Laptop and development environment

## 5.1 Owner-reported environment

| Item | Reported value |
|---|---|
| OS | Windows 11 |
| Project directory | `D:\Pipe-Bot-2` |
| Editor | Google Antigravity |
| Python | 3.13.0 |
| Node.js | v22.23.2 |
| npm | 10.9.8 |
| Git | 2.51.0.windows.2 |
| GPU | NVIDIA GeForce RTX 2050 |
| Dedicated GPU memory | 4 GB |
| NVIDIA driver | 581.83 |
| Driver-reported CUDA version | 13.0 |

These are values reported by the owner on 31 October 2026. Recheck the actual environment before installing or debugging dependencies.

## 5.2 Python environment policy

- Do not assume Python 3.13 is compatible with every required PyTorch, CUDA and Ultralytics package combination.
- Use a separate project virtual environment for the AI engine.
- The proposed baseline is Python 3.11, subject to package compatibility verification at implementation time.
- Do not uninstall or replace the system Python 3.13 installation.
- Verify PyTorch GPU availability using a real CUDA tensor test.
- `nvidia-smi` reporting CUDA 13.0 describes driver capability; it does not prove that the installed PyTorch build can use the GPU.
- Record exact Python and package versions in a lock/requirements file after a working configuration is verified.
- Do not download or install random CUDA toolkits to fix an unverified issue.

## 5.3 Node environment policy

- Keep the existing Node.js installation unless a demonstrated compatibility issue requires a change.
- Pin project dependencies through `package-lock.json`.
- Do not use global packages as hidden runtime dependencies.
- Use npm scripts for repeatable development and test commands.

## 5.4 Antigravity workflow

Antigravity is the development environment, not a runtime dependency of the finished application.

When asking Antigravity to implement a task:

1. State the relevant rulebook sections.
2. Ask it to inspect existing files before editing.
3. Define the exact files it may create or change.
4. Require complete code, not partial snippets with omitted sections.
5. Require input validation, error handling and logging where relevant.
6. Require tests or a concrete manual verification procedure.
7. Ask it to summarize changed files and commands run.
8. Review the diff before accepting changes.
9. Do not accept invented hardware pins, sensor values, dataset classes, or successful test claims.

---

# 6. Fixed system architecture

The laptop is the central application, AI, persistence and control host.

## 6.1 Component responsibilities

### ESP32-WROOM-32 DevKit V1

Responsible for:

- Motor-control signals to the SmartElex 15D driver.
- Four-motor movement logic, subject to verified driver topology.
- PWM generation.
- Encoder pulse counting.
- RPM calculation.
- Distance calculation after calibration.
- MPU6050 communication and readings.
- Telemetry transmission to laptop.
- Receiving validated movement commands from laptop.
- Communication watchdog and safe-stop behavior.
- Emergency-stop input/safety integration as electrically designed and verified.

The ESP32 does not receive, process, relay or stream camera video.

### Raspberry Pi Zero 2 W

Responsible for:

- Raspberry Pi camera capture.
- Camera configuration.
- Live video streaming over local Wi-Fi.
- Optional camera-side diagnostics.
- No YOLO inference in the approved architecture.
- No requirement to store continuous video in V1.

The existing VLC-tested stream should be preserved and reused if its format and reliability meet integration requirements.

### Windows laptop

Responsible for:

- Hosting the React dashboard.
- Hosting the Node.js/Express backend.
- Hosting local MongoDB Community Server.
- Receiving ESP32 telemetry.
- Sending robot movement commands.
- Receiving Pi camera footage.
- Running Python, PyTorch, OpenCV and Ultralytics inference.
- Annotating frames with detections.
- Synchronizing frame timestamps and encoder telemetry.
- Estimating defect locations.
- Saving evidence images and inspection metadata.
- Generating PDF reports.
- Performing local backups.

### Mobile browser

Responsible for:

- Viewing the dashboard over local Wi-Fi.
- Monitoring robot/camera/AI/database status.
- Viewing live video and telemetry.
- Viewing inspection status and defect findings.
- Viewing completed inspection summaries and reports where supported.

Mobile must not expose movement commands or an emergency-stop control as a substitute for the physical stop. The laptop is the only normal robot-control client.

## 6.2 Communication architecture

Approved/proposed protocol mapping:

| Link | Protocol | Direction / purpose |
|---|---|---|
| Browser → Express | HTTP REST | Application operations |
| Browser ↔ Express | WebSocket | Live status, telemetry and events |
| Laptop ↔ ESP32 | WebSocket over local Wi-Fi | Commands and telemetry |
| Raspberry Pi → laptop | Existing camera stream over HTTP/MJPEG, subject to verification | Raw camera video |
| Express ↔ Python AI service | Local HTTP API or another explicitly documented local IPC method | AI status/configuration/results |
| Python → browser | Laptop-hosted annotated MJPEG/HTTP stream or verified alternative | Annotated live video |
| Express → MongoDB | MongoDB driver | Persistent application data |

The Pi and ESP32 connect independently to the laptop. Video must never pass through the ESP32.

Do not change the current camera stream protocol until the exact working VLC URL, stream type, authentication, resolution and behavior have been inspected.

## 6.3 Local network and offline operation

- All runtime services must operate on the local network.
- No internet connection may be required for inspection.
- Do not depend on cloud APIs, cloud AI inference, cloud databases, remote fonts, CDNs or external runtime assets.
- Assign or reserve stable local addresses for the laptop, Pi and ESP32 as appropriate.
- Do not hardcode example IP addresses as if they were the actual network.
- Configure Windows Firewall for the required private-network ports only.
- Do not expose robot-control services to public networks.
- Mobile connects to the laptop-hosted dashboard over the local Wi-Fi.
- Keep the Python AI service bound to loopback unless another device genuinely needs access.
- Document actual IP addresses, ports and stream URLs in local configuration, not source-code literals.

---

# 7. Approved software stack

Use this stack unless a compatibility issue is demonstrated and the owner approves a change.

| Layer | Technology |
|---|---|
| Frontend | React.js + TypeScript |
| Frontend build | Vite |
| Styling | Tailwind CSS |
| Icons | Lucide |
| Charts | Recharts only where useful |
| Backend | Node.js + Express.js |
| API | REST |
| Real-time application events | WebSocket |
| AI language | Python |
| Deep learning | PyTorch |
| Object detection | Ultralytics YOLO |
| Computer vision | OpenCV |
| Database | MongoDB Community Server, local |
| Node validation | Zod or equivalent selected once |
| Python validation | Pydantic where useful |
| PDF generation | ReportLab |
| Frontend tests | Vitest and suitable React testing tools |
| Backend tests | Node test tooling selected with the project |
| AI tests | pytest |
| Version control | Git |

## 7.1 Architecture simplicity

Use a modular monolith for the Node backend and a separate Python AI process.

Do not add these without an approved, demonstrated need:

- Microservices.
- Kubernetes.
- Docker orchestration.
- Redis.
- Kafka.
- Firebase.
- Cloud hosting.
- Cloud GPU.
- External AI APIs.
- Native Android/iOS applications.
- Separate databases for each module.
- Unnecessary state-management or networking libraries.

Do not introduce a dependency just because it is popular. Explain its purpose and maintenance cost.

## 7.2 Licensing

Before redistribution or commercialization, review the applicable licenses for every dependency, especially Ultralytics YOLO and its AGPL-3.0/Enterprise licensing options. Do not make legal conclusions or assume a development use automatically permits every commercial deployment model.

---

# 8. Frontend product and design rules

## 8.1 Visual reference

Use the user-provided OneGuard LPG website and screenshots as the UI/UX reference.

Preserve the general visual language:

- Warm cream/off-white background.
- Bright yellow primary highlights.
- Black or near-black typography and outlines.
- Restrained orange accents.
- Green for safe/connected states.
- Amber for warnings.
- Red for critical/error states.
- Strong but controlled card borders and shadows.
- Bold, readable headings.
- Small uppercase section labels.
- Narrow vertical navigation/sidebar.
- Light and dark themes.
- Clear connectivity/status indicators.
- Dense but readable monitoring cards.

Build a distinct PipeBot product. Do not copy LPG-specific text, emergency instructions, cylinder graphics, or unrelated LPG features.

## 8.2 Prohibited design patterns

Do not use:

- Purple gradients.
- Generic AI-generated hero imagery.
- Fake customer counts, testimonials, reviews or metrics.
- Vague marketing statements.
- Excessive animation or scroll effects.
- Cursor-following animations.
- Excessive pill-shaped buttons.
- Emoji as interface icons.
- Unnecessary decorative graphics.
- Fake sensor readings or simulated device-online indicators presented as real.
- A dashboard that looks polished but has nonfunctional controls.

Use Lucide icons consistently. Keep the interface accessible, responsive and legible.

## 8.3 Main navigation

Approved proposed pages:

1. **Overview**
   - ESP32 connection.
   - Raspberry Pi camera connection.
   - AI service status.
   - MongoDB status.
   - GPU availability where measured.
   - Last inspection and actual recent activity.
   - Action to connect the robot.

2. **Live Inspection**
   - Main live video with AI bounding boxes.
   - Camera/ESP32/AI connectivity.
   - Speed, RPM and distance.
   - MPU6050 motion/orientation readings.
   - Laptop movement controls.
   - Dashboard emergency-stop request.
   - Inspection start/pause/resume/complete workflow.
   - Detection class, confidence and estimated distance.
   - Clear warning if any required subsystem is unavailable.

3. **Inspections**
   - Active and previous inspection sessions.
   - IDs, dates, duration, total distance, status and defect count.

4. **Defect Records**
   - Individual evidence records.
   - Class, confidence, timestamp, distance, image and review status.
   - Confidence is not physical defect severity.

5. **Reports**
   - One consolidated report per inspection.
   - Preview and local PDF access.

6. **System Settings**
   - Network and device configuration.
   - Camera stream configuration.
   - AI/model configuration.
   - Storage and backup status.
   - Diagnostics and logs.

## 8.4 UI truthfulness

- A device is connected only after a real connection/health check succeeds.
- A camera is streaming only when frames are actually received.
- GPU status must come from an actual runtime check.
- FPS and latency must be measured, not hardcoded.
- Empty states must say no data is available.
- Errors must explain the failed subsystem and a useful next action.
- Demo/simulation mode, if ever added, must be visibly labelled and must never be confused with real hardware operation.

---

# 9. Inspection workflow and lifecycle

Approved workflow:

**Connect robot → verify required subsystems → create inspection → start inspection → inspect → complete inspection → finalize records and PDF → back up completed inspection.**

The application must enforce valid state transitions.

Proposed lifecycle:

- `disconnected`
- `connecting`
- `ready`
- `inspection_created`
- `inspecting`
- `paused`
- `finalizing`
- `completed`
- `error` or `recovery_required`

Rules:

1. Do not allow inspection start until required hardware and storage checks pass.
2. A failed connection must not be shown as ready.
3. A missing camera, ESP32 or database must have a distinct status.
4. If AI is unavailable, report the AI failure clearly. Do not claim that AI inspection is running.
5. AI failure must not disable the independent physical emergency-stop path.
6. Persist inspection state so a laptop restart does not silently erase an active or interrupted session.
7. An interrupted inspection must be marked incomplete/recovery-required, not falsely completed.
8. Completing an inspection must finalize metadata and evidence before reporting success.
9. Generate one consolidated report for the whole inspection, not a separate report for every defect.
10. Do not create a new inspection automatically after a restart.

---

# 10. Robot control and safety requirements

## 10.1 Control authority

- Laptop is the only robot movement-control client.
- Mobile is monitoring-only.
- Use a single control owner/session on the laptop.
- Reject malformed, out-of-range, stale or unauthorized movement commands.
- Commands must have a bounded duration or explicit refresh/heartbeat policy.
- Do not allow browser focus loss or a held key to leave motors running indefinitely.
- Release/timeout behavior must command a safe stop.
- The ESP32 must have its own command watchdog. Do not rely only on Node.js or browser timers.

## 10.2 Emergency stop

The approved system includes:

1. A dedicated physical emergency-stop mechanism.
2. A dashboard emergency-stop request.

The physical mechanism must independently interrupt/disable the motor-drive energy or enable path using an electrically appropriate, verified design. It must not depend on Wi-Fi, the laptop, the browser, the AI process or a normal ESP32 application task to stop motor power.

The dashboard stop is an additional software command, not a replacement for physical emergency stop.

Do not provide final E-stop wiring until the driver board, motor supply, switching device, current, voltage, and safe circuit topology have been verified. The E-stop design must avoid unsafe automatic restart when released.

## 10.3 Watchdogs and safe states

- ESP32 must stop motor outputs on loss of valid control heartbeat within a defined, tested timeout.
- ESP32 must start with motors disabled.
- Invalid commands must be rejected.
- Communication reconnect must not automatically resume previous motion.
- Emergency stop must latch or otherwise require deliberate reset according to the verified safety design.
- AI inference, database, camera or frontend failures must not prevent the physical stop path from functioning.
- Test loss of Wi-Fi and laptop shutdown with wheels safely raised before any pipe trial.

---

# 11. Telemetry, encoders and MPU6050

## 11.1 Telemetry requirements

The ESP32 should publish structured, timestamped telemetry containing the fields that are actually implemented and verified, such as:

- Device identity and firmware version.
- ESP32 uptime.
- Telemetry sequence number.
- Encoder left/right raw counts.
- Encoder direction if supported by the hardware.
- Calculated RPM once validated.
- Calculated distance once calibrated.
- MPU6050 accelerometer and gyroscope readings.
- Derived orientation only after calibration and algorithm verification.
- Motor/command state.
- Emergency-stop state.
- Fault and watchdog state.

Do not fabricate unavailable fields.

## 11.2 Encoder calibration

The owner reports that both encoders produce pulse counts. This confirms pulse activity, not calibrated distance.

Before distance localization is accepted, measure and document:

- Encoder type and output wiring.
- Pulses per motor/wheel revolution under the actual counting method.
- Whether counts use one edge, both edges, or quadrature decoding.
- Gearbox relationship if encoder is mounted on motor shaft.
- Effective wheel diameter under load.
- Effective rolling circumference.
- Left/right wheel differences.
- Direction behavior.
- Repeatability over measured test distances.

Do not call a value PPR without defining what edges/channels are counted. Store the exact effective count-per-wheel-revolution used in the calculation.

## 11.3 Distance calculation

After effective PPR and wheel circumference are verified:

`left_distance = left_count_delta / left_effective_ppr * left_wheel_circumference`

`right_distance = right_count_delta / right_effective_ppr * right_wheel_circumference`

For a straight-motion estimate:

`average_distance = (left_distance + right_distance) / 2`

Handle reverse direction and counter rollover correctly. Preserve raw counts.

Wheel slip, wheel compression, unequal traction and turning can create errors. Record calibration information and treat the result as an estimate.

## 11.4 MPU6050

The MPU6050 supplements encoder odometry. It does not replace wheel encoders as the primary distance measurement.

- Verify module power and I2C logic compatibility.
- Calibrate accelerometer and gyroscope offsets.
- Record sensor orientation relative to the robot chassis.
- Use gyroscope/accelerometer data to estimate motion/orientation and detect disturbances.
- Do not claim that the MPU6050 reliably detects every tiny crack or physical pipe defect.
- Do not infer defect presence from IMU vibration unless a separate validated algorithm and test evidence support it.
- Do not integrate raw acceleration twice and present it as accurate distance.
- Define filtering, thresholds, sampling frequency and calibration based on actual tests.
- Distinguish measured sensor values from derived estimates.

---

# 12. Camera and live-video requirements

## 12.1 Current state

The owner reports that Raspberry Pi Zero 2 W camera streaming already works and the stream was viewed in VLC using a URL.

The exact camera model and stream details remain unknown. Preserve the working stream until inspected.

## 12.2 Required camera behavior

- Raspberry Pi captures footage.
- Raspberry Pi sends footage directly to the laptop over local Wi-Fi.
- ESP32 is not part of the video path.
- Laptop receives and decodes frames.
- Python/OpenCV provides frames to the AI pipeline.
- React displays the laptop's annotated stream.
- Camera failure is visibly reported.
- Video rendering should continue independently of a slower AI inference loop where technically possible.

## 12.3 Frame identity and overlays

Each received frame should have a unique frame ID and capture timestamp.

An AI result must be associated with the exact source frame it analyzed. Do not draw detections from an old frame on a newer unrelated frame.

If inference is slower than video capture:

- Use a bounded latest-frame strategy.
- Drop stale frames rather than building an unbounded inference queue.
- Preserve source frame identity.
- Display the overlay only on its corresponding frame or on a carefully defined synchronized output.
- Show AI update/inference age where useful.
- Keep video latency and AI-result latency as separate measurements.

## 12.4 No zero-latency promise

Literal zero latency is physically impossible. The engineering objective is low, measured and stable end-to-end latency.

Any latency target must be tested under the actual Wi-Fi, camera, resolution and model load. Do not claim a target has been met without measurements.

---

# 13. Dataset and YOLO policy

This section is mandatory and must not be bypassed.

## 13.1 Dataset source restriction

Use only the owner's existing dataset:

**Dataset name:** `Pipe Defect Detection.v7 Dataset Pipe.yolov8`  
**Dataset URL:** `https://platform.ultralytics.com/piyush-sonawane/datasets/pipe-defect-detectionv7-dataset-pipeyolov8`

Owner-reported dataset details:

- 1,916 images.
- 1,285 labeled images.
- 2,424 annotations.
- 631 remaining images whose annotation status must be inspected.

These counts are owner-provided and must be checked against the actual export before processing.

**Never add external datasets. Never merge external datasets. Never silently augment the dataset with unrelated public images.**

## 13.2 JSON inspection gate

The owner will provide the exported JSON. Before writing a converter, training script or data configuration:

1. Inspect the actual JSON structure.
2. Identify the format and schema.
3. Identify image records and file references.
4. Identify annotation records and coordinate conventions.
5. Identify category/class definitions and IDs.
6. Inspect train/validation/test split information.
7. Check missing images, duplicate records and malformed annotations.
8. Determine the status of all unlabeled images.
9. Verify annotation counts and class distribution.
10. Produce a dataset audit report.

Do not guess the JSON schema based on a familiar platform export.

## 13.3 Unlabeled images

The 631 images not reported as labeled must not automatically be treated as negative/background samples.

Do not convert them into empty-label training examples unless the actual export and owner explicitly establish that they are confirmed negative images.

Keep unlabeled/unknown images separate and document their status.

## 13.4 Preserve source data

- Preserve original labels.
- Preserve original split assignments.
- Do not move images between splits without explicit approval.
- Do not overwrite the original export.
- Do not rename or discard source data without a reproducible mapping.
- Keep generated YOLO labels/configuration in a separate derived directory.
- Log every conversion and validation result.
- Do not add robot-camera footage to training unless the owner explicitly authorizes it.

Robot-camera footage should remain an independent real-world test set by default.

## 13.5 Training environment

- Training and inference run on the Windows laptop.
- Use the NVIDIA RTX 2050 4 GB GPU when compatible.
- Select batch size and image resolution through measured memory tests.
- Start with a conservative model/configuration and verify CUDA.
- Avoid out-of-memory conditions by benchmarking before long training.
- Record random seeds and package versions where practical.
- Keep trained weights, training configuration and metrics versioned.
- Never claim GPU training if the process actually ran on CPU.

## 13.6 Required evaluation

Report:

- Precision.
- Recall.
- mAP50.
- mAP50-95.
- Confusion matrix.
- Per-class metrics.
- Per-class sample/annotation counts.
- Validation/test split details.
- Training configuration.
- Hardware and runtime information.
- Failure examples and limitations.

Do not claim a model is suitable for field inspection from training metrics alone. Test on independent robot-camera footage.

---

# 14. AI inference and defect evidence

## 14.1 Processing location

All YOLO inference runs on the laptop. The Raspberry Pi performs capture and streaming only.

## 14.2 Inference pipeline

Proposed flow:

1. Receive camera frame.
2. Assign frame ID and capture timestamp.
3. Associate/interpolate encoder telemetry at frame capture time.
4. Put the frame into a bounded inference queue/latest-frame slot.
5. Run YOLO inference on laptop GPU.
6. Convert predictions to class, confidence and bounding-box coordinates.
7. Associate predictions with original frame metadata.
8. Annotate the corresponding frame.
9. Send annotated video to the browser.
10. Persist qualifying defect evidence and metadata according to the detection policy.

## 14.3 Detection record fields

Each defect finding should preserve, where available:

- Defect record ID.
- Inspection ID.
- Model version.
- Dataset-defined class ID and class name.
- Confidence score.
- Bounding-box coordinates.
- Frame ID.
- Frame capture timestamp.
- Inference timestamp.
- Raw left/right encoder counts.
- Estimated distance from inspection start.
- Localization/calibration version.
- Evidence image path.
- Review status.
- Operator notes.

Do not substitute inference-completion time for frame-capture time.

## 14.4 Repeated detections

A single physical defect may appear in multiple consecutive frames. Do not automatically create a new physical defect record for every frame-level prediction.

Implement a documented grouping/deduplication strategy using available information such as distance proximity, time, class, bounding-box overlap and track continuity. Preserve source detections as needed for traceability. Allow operator review.

## 14.5 Confidence and severity

AI confidence is model certainty, not physical defect severity.

Do not label a high-confidence detection as severe or a low-confidence detection as minor. Severity requires a separate, validated engineering classification process and must not be invented.

---

# 15. Timestamp synchronization and defect localization

This is a critical subsystem.

## 15.1 Required rule

A defect's distance must be based on encoder telemetry corresponding to the camera frame's capture time, not the time YOLO completes inference.

## 15.2 Required metadata

For each frame, maintain:

- Frame ID.
- Camera capture timestamp.
- Laptop receive timestamp.
- ESP32 telemetry sequence number.
- ESP32 telemetry timestamp or uptime.
- Left encoder count.
- Right encoder count.
- Estimated distance.
- Clock-offset/synchronization estimate.
- Interpolation method and quality/uncertainty.
- AI inference start and completion timestamps.

## 15.3 Clock strategy

The camera/Pi and ESP32 may have different clocks. Do not directly compare their raw timestamps unless their clocks have been synchronized and the synchronization error is measured.

Establish a defined timestamp strategy using laptop receipt times, measured clock offsets, sequence numbers and interpolation. Document the actual method and its limitations. Do not claim millisecond synchronization without measuring it.

## 15.4 Localization limitations

- Encoder distance is an estimate.
- Wheel slip and turning can introduce errors.
- Sensor timestamps may be delayed or sampled at different rates.
- The camera's image timestamp may represent capture, encode or stream time depending on the source.
- Calibration must be repeated if wheel, motor, gearing, chassis load or encoder configuration changes.
- Preserve raw values so estimates can be recalculated later.
- Report uncertainty/quality where possible.

---

# 16. Backend, API and data rules

## 16.1 Backend structure

Use a maintainable Express structure, for example:

```text
backend/
  src/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    validators/
    sockets/
    utils/
    app.js
  tests/
```

Keep routes, controllers, models, services, configuration, validation and middleware separate where their responsibilities justify it.

Do not create empty abstraction layers that add no value.

## 16.2 Proposed API resources

Examples of REST resources:

- `GET /api/system/status`
- `GET /api/robot/status`
- `POST /api/robot/connect`
- `POST /api/robot/disconnect`
- `POST /api/robot/commands`
- `POST /api/robot/emergency-stop`
- `GET /api/camera/status`
- `POST /api/inspections`
- `POST /api/inspections/:id/start`
- `POST /api/inspections/:id/pause`
- `POST /api/inspections/:id/resume`
- `POST /api/inspections/:id/complete`
- `GET /api/inspections`
- `GET /api/inspections/:id`
- `GET /api/defects`
- `GET /api/reports/:id`
- `POST /api/reports/:id/generate`

These are proposed routes. Implement only with correct validation, authorization boundaries, state checks and response behavior.

## 16.3 API quality

- Use correct HTTP status codes.
- Validate all incoming data.
- Sanitize file names and paths.
- Prevent path traversal.
- Apply request size limits.
- Handle timeouts and disconnections.
- Do not expose stack traces or secrets to the browser.
- Log errors with useful context.
- Do not log passwords, tokens or sensitive configuration.
- Use consistent response structures.
- Validate inspection state transitions on the backend, not only in React.
- Reject mobile movement-control requests at the backend as well as omitting the UI controls.

## 16.4 MongoDB collections

Proposed collections:

- `inspections`
- `defects`
- `telemetry` (only if the chosen retention and volume strategy makes MongoDB suitable)
- `system_events`
- `model_versions`

No users collection is required for the approved single-operator V1.

Do not store continuous video in MongoDB.

Avoid writing every high-frequency telemetry sample to MongoDB without a measured retention/storage plan. Define sampling, batching, retention and indexes before high-volume persistence.

## 16.5 Local file storage

Store images, reports and backups on the laptop filesystem. Use safe relative paths in MongoDB rather than machine-specific absolute paths where possible.

Proposed layout:

```text
storage/
  inspections/
    <inspection-id>/
      defects/
      frames/
      metadata.json
  reports/
  backups/
  logs/
```

Save only defect images and necessary evidence frames in V1, not continuous inspection video.

---

# 17. PDF report requirements

Generate one consolidated PDF for each completed inspection.

The report should contain:

1. Inspection ID and name.
2. Inspection start and completion time.
3. Duration.
4. Total distance.
5. Robot/camera/model information where known.
6. Summary of all findings.
7. Each defect's image.
8. Dataset-defined class.
9. Confidence score.
10. Approximate location from inspection start.
11. Capture timestamp.
12. Relevant frame/encoder metadata where useful.
13. Review status and operator notes.
14. Limitations or localization quality where available.

Do not invent missing values. Mark unavailable information as unavailable.

A report must be generated from persisted inspection data, not only from transient frontend state.

---

# 18. Backup and recovery

Approved requirement: automatic local backup after every completed inspection.

## 18.1 Backup contents

A completed-inspection backup should include:

- Inspection record.
- Related defect records.
- Required evidence images.
- Generated PDF.
- Relevant model/version metadata.
- Relevant configuration/calibration identifiers.
- Manifest with file names, sizes and checksums where practical.

If telemetry is persisted for the inspection, include the required telemetry data according to the defined retention policy.

## 18.2 Backup behavior

- Run backup only after inspection finalization has succeeded.
- Verify that the backup files exist and are readable.
- Record backup completion status and timestamp.
- Do not report backup success before verification.
- Keep the original inspection data if backup fails.
- Show backup failure clearly and allow retry.
- Do not overwrite the only existing backup.
- Document retention and cleanup policy before automatic deletion is introduced.

## 18.3 Recovery

Test recovery from:

- Laptop restart during inspection.
- Backend process crash.
- AI process crash.
- MongoDB unavailable.
- Disk/file write failure.
- Backup failure.
- Network interruption.

An incomplete inspection must remain recoverable or be clearly marked incomplete. Never silently convert an interrupted inspection to completed.

---

# 19. Performance and reliability

The laptop has an RTX 2050 with 4 GB VRAM. Performance must be measured on the actual machine.

Initial proposed benchmarking starting points, not guarantees:

| Parameter | Initial test range/target |
|---|---|
| Camera frame size | Begin around 640×480 if supported by the current stream |
| Display frame rate | Measure; target a usable 15–25 FPS if hardware/network permit |
| AI inference rate | Benchmark; initial 5–15 FPS range |
| Video latency | Measure end-to-end; do not promise zero latency |
| AI overlay latency | Measure separately from raw video latency |

Rules:

- Keep video reception/display decoupled from inference.
- Use bounded queues and discard stale frames where appropriate.
- Avoid unbounded memory growth.
- Measure GPU memory, inference duration, frame age and stream latency.
- Use sensible timeouts and reconnection behavior.
- Do not let a slow inference loop freeze the dashboard or video receiver.
- Do not show stale telemetry as current; display its age or mark it stale.
- Do not silently reconnect and resume motor movement.
- Add structured logs and clear diagnostics.

---

# 20. Security and privacy

Even without accounts, the application controls physical machinery.

- Bind services to the intended interfaces only.
- Restrict robot-control endpoints to the laptop/local trusted network.
- Use a short-lived local operator authorization/session mechanism for control if needed; this is not a user-account system.
- Mobile is read-only/monitoring-only.
- Validate Origin and connection behavior for WebSockets.
- Do not expose MongoDB directly to the Wi-Fi network.
- Keep MongoDB bound to localhost unless there is a documented need otherwise.
- Store secrets in environment variables or local configuration excluded from Git.
- Never commit `.env`, Wi-Fi passwords, private keys or credentials.
- Configure Windows Firewall narrowly.
- Avoid public port forwarding.
- Do not collect unrelated personal information.
- Keep inspection images and records local unless the owner explicitly authorizes export.

---

# 21. Code quality and repository rules

## 21.1 General

- Use meaningful names and clear module boundaries.
- Prefer simple, testable implementations.
- Avoid duplicated business logic.
- Avoid hidden global state.
- Use typed interfaces between frontend/backend and documented message schemas for ESP32 telemetry.
- Add comments for non-obvious hardware, timing, calibration and safety behavior.
- Do not use placeholder implementations in production paths.
- Do not swallow exceptions.
- Do not report success if a required operation failed.

## 21.2 Configuration

- Keep environment-specific values in configuration.
- Provide `.env.example` with placeholders only.
- Validate configuration at process startup.
- Fail with a clear error if required configuration is missing.
- Do not hardcode real IPs, passwords, database credentials or stream secrets.

## 21.3 Git

- Inspect `git status` before modifying files.
- Preserve existing work and uncommitted changes.
- Use `.gitignore` for virtual environments, node_modules, model weights, datasets, logs, secrets and generated storage as appropriate.
- Do not commit large datasets or inspection evidence unless explicitly requested.
- Commit in logical milestones if the owner uses commits.
- Do not force-push or rewrite history without permission.

## 21.4 README and documentation

The project README must eventually include:

- Project overview.
- Architecture.
- Hardware inventory and verified wiring references.
- Prerequisites.
- Python setup.
- Node setup.
- MongoDB setup.
- Environment configuration.
- Frontend/backend/AI startup instructions.
- Raspberry Pi camera service instructions.
- ESP32 firmware build/upload instructions.
- Test commands.
- Troubleshooting.
- Backup and restore.
- Known limitations.

---

# 22. Development sequence and stage gates

Follow this sequence. Do not skip ahead merely to build the dashboard.

## Stage 0 — Existing project and environment audit

- Inspect `D:\Pipe-Bot-2`.
- Inspect Git status and current files.
- Preserve working code.
- Record current Python, Node, npm, Git, GPU and driver versions.
- Identify existing firmware, Pi stream scripts, frontend/backend code and dataset export if present.

**Exit test:** A documented project inventory exists and no existing work has been overwritten.

## Stage 1 — Project foundation

- Establish repository structure.
- Set up React + TypeScript + Vite.
- Set up Node.js + Express.
- Set up isolated Python environment.
- Configure environment variables and `.gitignore`.
- Add logging and basic health endpoints.
- Add a README with verified setup steps.

**Exit test:** Frontend and backend start; health endpoint responds; Python environment activates; Git status is understood.

## Stage 2 — Local database and storage

- Install/configure MongoDB Community Server.
- Connect backend to local MongoDB.
- Add schemas/models and indexes.
- Add local storage paths and validation.
- Add backup manifest design.

**Exit test:** Create, read and persist a test inspection record; restart MongoDB/backend and verify data remains.

## Stage 3 — ESP32 communication and safety

- Inspect current ESP32 firmware before changes.
- Document existing pin mapping from verified source/wiring.
- Define telemetry and command message schemas.
- Connect ESP32 to laptop over local Wi-Fi.
- Implement validated commands and watchdog.
- Verify physical emergency-stop design independently.

**Exit test:** Real telemetry arrives; valid test commands work with wheels safely restrained; invalid/stale commands are rejected; communication loss causes safe stop; physical stop is verified.

## Stage 4 — Encoder and MPU6050 integration/calibration

- Verify encoder electrical output and count method.
- Measure effective PPR.
- Measure effective wheel circumference.
- Calibrate left/right distances.
- Verify reverse direction and repeatability.
- Calibrate MPU6050 and document orientation.

**Exit test:** Distance agrees with measured test travel within a documented tolerance; sensor readings and limitations are recorded.

## Stage 5 — Raspberry Pi camera integration

- Identify exact Pi camera model.
- Inspect existing working VLC stream URL and server command.
- Verify the stream format, resolution, frame rate and timestamp availability.
- Receive the stream on laptop.
- Add camera health and reconnect handling.

**Exit test:** Laptop receives stable real camera frames over local Wi-Fi without ESP32 involvement.

## Stage 6 — Dataset audit and AI environment

- Obtain the owner's actual exported JSON and associated files.
- Inspect actual schema, classes, annotations and splits.
- Audit unlabeled images.
- Preserve original dataset.
- Prepare derived YOLO data only after audit approval.
- Verify PyTorch CUDA on RTX 2050.

**Exit test:** Dataset audit report is approved; no external data is present; GPU test passes or a documented blocker is raised.

## Stage 7 — YOLO training and evaluation

- Train only on the approved existing dataset.
- Tune resolution and batch size for 4 GB VRAM.
- Save weights and configuration.
- Evaluate all required metrics.
- Keep robot footage separate for independent testing unless explicitly authorized.

**Exit test:** Reproducible training run, saved weights, evaluation report and independent test results exist.

## Stage 8 — Live AI inference

- Connect live Pi stream to Python/OpenCV.
- Run model inference on laptop GPU.
- Add frame IDs and timestamps.
- Annotate correct frames.
- Serve annotated video.
- Measure latency and inference rate.

**Exit test:** Real pipe footage appears with correctly aligned AI bounding boxes and no unbounded frame queue.

## Stage 9 — Timestamp synchronization and defect localization

- Define clock strategy.
- Synchronize/associate frame and telemetry times.
- Interpolate encoder values at capture time.
- Calculate distance from inspection start.
- Record uncertainty and calibration version.
- Group repeated detections.

**Exit test:** Known test markers/defects are localized against measured travel with documented error.

## Stage 10 — Dashboard and application integration

- Implement the approved OneGuard-inspired PipeBot design.
- Build Overview, Live Inspection, Inspections, Defect Records, Reports and Settings.
- Integrate actual APIs and WebSockets.
- Laptop-only robot controls.
- Mobile monitoring-only interface.
- Add loading, empty, stale, disconnected and error states.

**Exit test:** Dashboard values come from actual subsystem data; mobile cannot issue movement commands.

## Stage 11 — Inspection lifecycle, reports and backup

- Enforce inspection state transitions.
- Persist all defect findings.
- Generate one consolidated PDF per inspection.
- Save evidence images and metadata.
- Automatically back up after completion.
- Implement backup verification and retry.

**Exit test:** A completed inspection can be reopened after restart, report is complete, and backup can be restored.

## Stage 12 — End-to-end validation

Run a full inspection using the real robot, actual camera, trained model, encoder localization, database and report generator.

**Exit test:** All critical tests in Section 23 pass. Document unresolved limitations honestly.

---

# 23. Mandatory verification checklist

PipeBot is not ready for a real inspection demonstration until these tests pass.

| Test | Acceptance condition |
|---|---|
| ESP32 connection | Real device connection and telemetry verified |
| Pi camera connection | Real frames received by laptop |
| Independent data paths | Video does not pass through ESP32 |
| Robot movement | Correct directions and controlled response |
| Laptop-only control | Mobile cannot issue movement commands |
| Physical E-stop | Stops motor drive independently of software/network |
| Dashboard stop | Sends stop request and reports actual result |
| Wi-Fi loss | ESP32 watchdog stops motion |
| Startup behavior | Motors remain disabled on boot/reconnect |
| Encoders | Pulse counts and direction verified |
| Distance | Calibrated against measured physical travel |
| MPU6050 | Calibrated readings and orientation verified |
| Camera display | Live video remains responsive |
| AI inference | Real model runs on laptop GPU |
| Bounding boxes | Overlay matches the source frame |
| AI failure | Clearly reported; safety remains functional |
| Localization | Uses frame capture time and corresponding telemetry |
| Repeated detections | Physical findings are not blindly duplicated per frame |
| Database | Records persist across restart |
| Evidence | Defect images and metadata are saved |
| Report | One complete PDF per inspection |
| Backup | Automatic backup verified after completion |
| Restore | Backup can be restored and checked |
| Mobile | Monitoring works on local Wi-Fi |
| Offline | Inspection works with internet disconnected |
| Recovery | Interrupted session is not falsely marked completed |

Record test date, software version, firmware version, hardware configuration, test procedure, result and evidence.

---

# 24. Explicitly prohibited shortcuts

Never:

1. Guess wiring or GPIO pins.
2. Guess motor-driver or battery ratings.
3. Assume the camera model.
4. Assume encoder PPR or wheel diameter.
5. Treat the 631 unlabeled dataset images as negative samples automatically.
6. Add external datasets.
7. Train on robot footage without owner approval.
8. Run AI inference on Raspberry Pi.
9. Route video through ESP32.
10. Use inference completion time for defect distance.
11. Treat AI confidence as defect severity.
12. Save continuous video in V1 by default.
13. Use MongoDB Atlas as the V1 operational database.
14. Give mobile robot-control functionality.
15. Use dashboard-only emergency stop.
16. Claim zero latency.
17. Show fake sensor readings or fake device status.
18. Skip tests because a UI page looks complete.
19. Rewrite working firmware or stream code without inspection.
20. Introduce unnecessary technologies or services.
21. Delete or overwrite user data without explicit approval.
22. Claim a test passed without executing it.
23. Mark the product production-ready before real end-to-end verification.

---

# 25. Current known unknowns and blockers

These items remain unresolved and must be verified at the relevant stage.

| Item | Current status | Required action |
|---|---|---|
| Exact Raspberry Pi camera model | UNVERIFIED | Identify board/module and camera sensor |
| Existing camera stream URL and server command | Owner says VLC works; details not recorded here | Obtain exact URL/command and stream details |
| ESP32 firmware source and pin mapping | Not yet inspected | Inspect current project/firmware |
| SmartElex 15D exact revision/specification | Not verified | Obtain board datasheet/revision |
| Motor voltage/current/stall current | Unknown | Read motor markings/datasheet and measure as needed |
| Battery exact voltage/cell count | Unknown | Inspect full battery label/datasheet |
| Encoder type and effective PPR | Pulse counts reported; calibration unknown | Identify encoder and calibrate |
| Wheel diameter/circumference | Unknown | Measure under load |
| MPU6050 wiring and calibration | Module identified; details unknown | Inspect and test |
| Dataset exported JSON | Not yet inspected in this workflow | Owner to provide export |
| Actual local Wi-Fi addressing | Unknown | Inspect router/network |
| Existing project files | Not yet audited | Run project inspection commands |
| MongoDB Community installation | Not verified | Check/install during Stage 2 |

Do not block unrelated software scaffolding on hardware details, but do block any wiring, calibration, or hardware-control change that depends on unknown specifications.

---

# 26. First action: inspect the existing project

Do not create a new application over existing files.

Open the Antigravity terminal in PowerShell and run:

```powershell
Set-Location "D:\Pipe-Bot-2"
Get-Location
Get-ChildItem -Force
git status
tree /A /F
```

If `tree /A /F` is too large, use:

```powershell
Get-ChildItem -Directory
```

Share the outputs before making project-structure changes.

The first implementation task is the Stage 0 audit, followed by Stage 1 project foundation.

---

# 27. Change-control record

When an approved decision changes, record:

| Field | Required information |
|---|---|
| Change ID | Unique identifier |
| Date | Date approved |
| Previous requirement | Existing rule |
| New requirement | Replacement rule |
| Reason | Owner's stated reason |
| Affected modules | Hardware, firmware, AI, backend, frontend, storage, etc. |
| Migration/testing | Required changes and tests |
| Approval | Explicit owner approval |

Do not silently modify this rulebook's approved decisions.

---

# 28. Definition of success

PipeBot V1 succeeds only when the real robot can:

1. Connect to the laptop over local Wi-Fi.
2. Be controlled safely from the laptop.
3. Stream real internal pipe footage from the Raspberry Pi to the laptop.
4. Run the owner's trained YOLO model on the laptop RTX 2050.
5. Display detections correctly over the live footage.
6. Measure movement using calibrated encoders.
7. Associate defects with the correct frame capture time and encoder position.
8. Record all findings in one inspection session.
9. Save defect evidence images and complete metadata locally.
10. Generate one consolidated PDF inspection report.
11. Automatically back up the completed inspection.
12. Remain usable from a mobile browser for monitoring without internet.
13. Stop safely through the independent physical emergency-stop mechanism.

**Final rule:** Functional correctness, hardware safety, data integrity and traceable test results take priority over visual polish, feature count and speed of development.
