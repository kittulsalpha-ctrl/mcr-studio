# MCR Studio

Browser-based Cloud MCR/PCR prototype for monitoring, routing, preview/program switching, signal health, cloud distribution, and AI-assisted incident response.

This project is a working front-end demo for a modern hybrid broadcast operations cockpit. It combines a multiviewer, preview/program switching, source routing, graphics/playout cues, signal-path visibility, cloud distribution awareness, alarms/QC, incident logs, and an operational AI assistant.

## Current Demo Scope

- `OPERATE`: operator-facing view with a dominant Program Out monitor, Preview/Program labels, Take/Cut/Fade/Off Air controls, Emergency Backup, source tiles, Signal Path, Source Inspector, and AI Ops Assistant.
- `ENGINEERING`: simulated cloud broadcast health dashboard for contribution inputs, NDI/SRT/WebRTC gateway, AWS MediaConnect, AWS MediaLive, CDN Edge, primary/backup path, RTT, bitrate, packet loss, jitter, region, encoder, and stream health.
- `EVENT / AUTOMATION`: simple rundown automation for pre-show, main live feed, graphics, break/SCTE marker, backup/filler, and end slate cues, plus the incident timeline.

## Simulated vs Real

The browser app currently simulates several broadcast/cloud systems so the workflow can be demonstrated without dedicated infrastructure:

- LiveU contribution feeds are represented as front-end source states.
- NDI/SRT/WebRTC gateway discovery is represented as a placeholder API contract.
- AWS MediaConnect, MediaLive, and CDN Edge health are simulated.
- QC alarms such as input loss, black, freeze, silence, high RTT, packet loss, and CDN degraded are simulated from source state and operator actions.
- AI Ops Assistant recommendations are generated locally from current source/program/alarm state.

Real webcam, local video file loading, URL embed preview, preview selection, Take to Air, Off Air, and source ejection are browser-side prototype features.

## GitHub Pages Limitation

GitHub Pages can host this static prototype, but it cannot run a real NDI/SRT/WebRTC gateway, FFmpeg process, LiveU receiver, MediaConnect integration, or MediaLive control service. Those require a backend service running on a workstation, server, container, or cloud environment.

For public demos, GitHub Pages is useful for showing the interface and simulated workflows. For real media I/O, pair this front end with a backend bridge.

## NDI Direction

Real NDI cannot be detected directly by a static browser page. A practical architecture is:

1. Local or cloud gateway discovers NDI sources on the network.
2. Gateway exposes available sources through an API such as `/api/ndi/sources`.
3. Gateway converts selected NDI feeds to a browser-compatible preview format such as WebRTC, HLS, or low-latency fragmented MP4.
4. MCR Studio attaches that preview stream to a multiviewer tile and routes it through Preview/Program logic.

See `NDI_BRIDGE_API.md` for the placeholder bridge contract.

## Roadmap

- Real NDI/SRT/WebRTC gateway bridge.
- FFmpeg or GStreamer backend for media ingest, transcode, preview generation, and QC probes.
- Browser audio meters, silence detection, black/freeze detection, and stream stats.
- AWS MediaConnect, MediaLive, and CDN API integration.
- Real incident timeline persistence and searchable logs page.
- AI incident assistant backed by live telemetry, event history, and operator runbooks.
- Docker and Kubernetes deployment profiles.

## Local Use

Because this is a static browser prototype, it can run from any simple local web server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```

For GitHub Pages deployment, enable Pages for the repository and point it at the branch/folder containing `index.html`.
