# PipeBot Project Rules & System Guidelines

## 1. Project Overview & Fixed Technology Stack
PipeBot is an AI-powered robotic PVC pipe inspection vehicle. The technology stack is strictly fixed:
- **Embedded**: ESP32-WROOM-32, Arduino C++.
- **Camera Subsystem**: Raspberry Pi + Raspberry Pi Camera.
- **AI / Computer Vision**: Python, PyTorch, Ultralytics YOLO, OpenCV running on laptop GPU (NVIDIA GeForce RTX 2050, 4 GB VRAM).
- **Backend Service**: Node.js, Express.js, MongoDB.
- **Frontend Dashboard**: React.js.
- **Communication Protocols**: Local Wi-Fi, low-latency video streaming (RTSP/WebRTC/MJPEG), WebSockets.

---

## 2. Core Engineering Rules & Constraints
1. **No Speculative Generation**: Do not generate the entire application upfront. Build incrementally, completing one coherent feature/milestone at a time.
2. **File Safety**: Never overwrite or delete existing files without explicit authorization.
3. **Minimal Dependencies**: Do not install unnecessary packages. Pinned dependencies only.
4. **Hardware Integrity**: Do not invent or fabricate hardware pinouts, specs, or capabilities. Ask for clarification if essential hardware details are missing.
5. **Stack Integrity**: Do not change the agreed technology stack (no replacement of Node.js/Express, MongoDB, ESP32, Raspberry Pi, React, or PyTorch/YOLO).
6. **Dataset First**: Do not begin model training before downloading and inspecting the actual dataset and label distribution.
7. **Production Quality**:
   - Strict typing, explicit error handling, input validation.
   - Graceful offline/reconnection handling for WebSockets and streams.
   - No hardcoded credentials, API keys, or environment-specific IP addresses. Use `.env.example` and environment configuration.
8. **Verification Requirement**: After making changes, verify functionality via tests, builds, or dry runs. Distinguish verified results from untested assumptions.
9. **Approval Gate**: Present findings, architectures, and plans to the user and wait for explicit approval before making major architectural changes or commencing large implementations.

