# MCR Studio

Browser-based Cloud MCR/PCR prototype for monitoring, routing, preview/program switching, signal health, cloud distribution, and AI-assisted incident response.

This project is a working front-end demo for a modern hybrid broadcast operations cockpit. It combines a multiviewer, preview/program switching, source routing, CG graphics overlays, signal-path visibility, cloud distribution awareness, alarms/QC, incident logs, and an operational AI assistant.

## Current Demo Scope

- `OPERATIONS`: live-control workspace with a dominant Program Out monitor, Preview/Program labels, Take/Cut/Fade/Off Air controls, Emergency Backup, source tiles, CG graphics controls, Program audio mixer, rundown cues, Replay Server, and Playout Server.
- `MONITORING`: NOC-style workspace for signal path, Source Inspector, NDI bridge placeholder, AI Ops Assistant, cloud broadcast health, production chain topology, SRT telemetry, disaster recovery controls, SCTE cue simulation, alarms/QC, and incident timeline.
- `index.html` is the Operations screen. `monitoring.html` is the dedicated Monitoring/NOC screen. Open both URLs in separate browser windows or displays for a realistic control-room demo where the multiviewer stays visible while engineering watches alarms, logs, and signal health.

## Graphics vs Playout

The `CG / GRAPHICS ENGINE` tile represents a key/fill graphics system similar to a Vizrt-style CG engine. It does not replace the Program video route. Instead, operators can preview and take graphics layers such as lower-thirds, ticker, and bug overlays, which are keyed over the active Program source.

Full-frame playout is separate from CG. The current demo includes a simulated Playout Server for slates, filler, end slate, and emergency loop assets. These replace the Program video route like normal full-frame sources.

## Backend-Ready Model

The current front end now carries a structured simulated backend model. It separates contribution sources, ingest gateway, video switcher, audio mixer, CG keyer, replay server, playout server, encoder, and distribution services. This makes the UI ready to be connected later to a real orchestrator API/WebSocket layer rather than keeping all state directly in the browser.

The intended future API boundary is:

- UI sends commands such as Preview, Take, Off Air, audio fader changes, CG Take, replay/playout triggers, and failover actions.
- Orchestrator owns source state, Program/Preview routing, audio bus state, service health, alarms, and logs.
- Media engines perform real ingest, switching, audio mixing, graphics keying, replay, playout, encoding, and distribution.

## Control Orchestrator Backend

The repo includes a dependency-free Node.js Control Orchestrator prototype:

```bash
npm start
```

Open backend-connected mode:

```text
http://127.0.0.1:8080/?backend=1&preset=football
```

The backend exposes REST commands, `/api/state`, `/api/logs`, `/api/health`, and `/api/events` for live Server-Sent Events. It is still simulated, but it creates the real product boundary between the browser control surface and future media engines.

See `ORCHESTRATOR_API.md` for the API contract.

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

- Real replay and playout media engines with recording, clip storage, asset playback, and return-to-live routing.
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

For backend mode, use `npm start` instead of a static file server.
