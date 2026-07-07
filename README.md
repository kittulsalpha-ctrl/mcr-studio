# MCR Studio

Browser-based Cloud MCR/PCR prototype for monitoring, routing, preview/program switching, signal health, cloud distribution, and AI-assisted incident response.

This project is a working front-end demo for a modern hybrid broadcast operations cockpit. It combines a multiviewer, preview/program switching, source routing, CG graphics overlays, signal-path visibility, cloud distribution awareness, alarms/QC, incident logs, and an operational AI assistant.

## Client Demo Positioning

Position this repo as a **sellable prototype**, not a finished 24/7 broadcast product. The product story is:

> MCR Studio is a browser-based Cloud MCR/PCR control surface that shows how operators can switch live sources, monitor cloud delivery, manage incidents, and prepare real backend integrations from one control-room interface.

For a client presentation, start with `OPERATE`, then show `MONITOR`, `SETUP`, and finish with `AUTOMATION`:

1. `OPERATE`: show the live control-room value first: Multiview, Preview, Program Out, Take to Air, graphics, audio, cues, and emergency backup.
2. `MONITOR`: show the NOC/MCR confidence layer: alarms, signal path, SRT telemetry, cloud chain health, DR status, incident timeline, and runbook advisor.
3. `SETUP`: show how engineering configures sources, regions, OBS/NDI/API readiness, and the integration roadmap.
4. `AUTOMATION`: show AI orchestration, event-driven rules, the broadcast digital twin, incident simulations, recommendations, and operator approval guardrails.

This avoids presenting the project as a settings dashboard. The first impression should be live broadcast control.

For a step-by-step presentation flow, use `CLIENT_DEMO_SCRIPT.md`.

## Product Architecture Story

The long-term product should be explained as five layers:

1. **Browser Control Surface**: Operate, Monitor, and Setup pages for PCR operators, MCR/NOC engineers, and system admins.
2. **Edge Gateway**: local or cloud gateway for OBS, NDI, SRT, WebRTC, RTSP, LiveU receivers, QC probes, and browser-safe preview streams.
3. **Control Orchestrator**: backend authority for Preview, Program, Off Air, audio buses, graphics, replay, playout, logs, alarms, and shared operator state.
4. **Cloud Media Chain**: MediaConnect, switcher, MediaLive, origin packaging, CDN Edge, primary/backup route, and regional failover.
5. **Ops Intelligence**: alarm correlation, incident timeline, runbook recommendations, show summaries, and operator action history.

The current static GitHub Pages app proves the workflow and UI. The Node Edge Agent proves the first backend boundary. A production product requires the gateway, orchestrator, media engines, authentication, and telemetry collectors.

## Current Demo Scope

- `OPERATIONS`: live-control workspace with a dominant Program Out monitor, Preview/Program labels, Take/Cut/Fade/Off Air controls, Emergency Backup, source tiles, Graphics Overlay controls, Program Audio with Follow Video, Show Cues, Replay Server, and Playout Server.
- `MONITORING`: NOC-style workspace for Active Alarms, Program Delivery, Signal Path, Delivery Health, SRT telemetry, Cloud Chain Health, DR/SCTE monitoring, Operator & Incident Timeline, and Ops Runbook Advisor.
- `SETUP`: engineering/admin workspace for source configuration, local test inputs, OBS mapping, NDI bridge placeholder, region presets, scenario presets, backend readiness, and the integration roadmap.
- `AUTOMATION`: AI Orchestrator workspace for broadcast agents, event-driven automation rules, workflow graph, digital twin, incident simulations, recommendations, and operator approval guardrails.
- `index.html` is the Operate screen. `monitoring.html` is the dedicated Monitoring/NOC screen. `setup.html` is the engineering Setup screen. `automation.html` is the AI Orchestrator screen. Open Operate and Monitoring in separate browser windows or displays for a realistic control-room demo where the multiviewer stays visible while engineering watches alarms, logs, and signal health.

## Graphics vs Playout

The `GRAPHICS OVERLAY` tile represents a key/fill graphics system similar to a Vizrt-style CG engine. It does not replace the Program video route. Instead, operators can preview and take graphics layers such as lower-thirds, ticker, and bug overlays, which are keyed over the active Program source.

Full-frame playout is separate from CG. The current demo includes a simulated Playout Server for slates, filler, end slate, and emergency loop assets. These replace the Program video route like normal full-frame sources.

Replay is separate from playout: it creates and cues clips from an ISO contribution source, then returns the operator to the prior live route.

## Backend-Ready Model

The current front end now carries a structured simulated backend model. It separates contribution sources, ingest gateway, video switcher, audio mixer, CG keyer, replay server, playout server, encoder, and distribution services. This makes the UI ready to be connected later to a real orchestrator API/WebSocket layer rather than keeping all state directly in the browser.

The intended future API boundary is:

- UI sends commands such as Preview, Take, Off Air, audio fader changes, CG Take, replay/playout triggers, and failover actions.
- Orchestrator owns source state, Program/Preview routing, audio bus state, service health, alarms, and logs.
- Media engines perform real ingest, switching, audio mixing, graphics keying, replay, playout, encoding, and distribution.

## MCR Edge Agent

The repo includes a dependency-free local **MCR Edge Agent**. It is the boundary between the browser control room and on-prem equipment such as OBS, future NDI/SRT gateways, contribution encoders, and QC probes:

```bash
npm start
```

Open backend-connected mode:

```text
http://127.0.0.1:8080/?backend=1&preset=football
```

The Edge Agent exposes REST commands, `/api/state`, `/api/logs`, `/api/health`, `/api/agent`, `/api/telemetry`, and `/api/events` for live Server-Sent Events. `/api/agent` and `/api/health` expose the safe operational contract: agent identity, local mode, equipment capabilities, OBS connection status, scene count, and pairing readiness. They do not expose OBS credentials.

When both `index.html` and `monitoring.html` are opened with `?backend=1`, they share Preview, Program, audio, source health, QC alarm, and log state through the Edge Agent. This is the intended dual-screen MCR demo mode.

The header always exposes the operating truth: `DEMO` is browser-only simulation, `DEMO API` is the local orchestrator demo, `API OFFLINE` means a requested orchestrator cannot be reached, and `LIVE DATA` means a trusted collector is sending live telemetry. `LIVE DATA` does not imply that media-control connectors are live; each connector must be explicitly integrated and approved.

See `ORCHESTRATOR_API.md` for the API contract.

See `TELEMETRY_COLLECTOR_API.md` for the normalized Direct Connect, MediaConnect, MediaLive, CloudFront, and encoder telemetry contract. A trusted backend collector posts this data; the browser never holds AWS credentials.

## AWS Telemetry Worker

`aws-telemetry-worker.js` is a configuration-driven collector scaffold for AWS Direct Connect, MediaConnect, MediaLive, and CloudFront. Copy `.env.telemetry.example` into the deployment environment, provide resource IDs and an IAM role/profile, then run:

```bash
npm install
npm start
npm run telemetry:aws
```

The worker posts only normalized telemetry to the local Control Orchestrator. It does not process media, and the encoder section remains intentionally vendor-neutral until a client provides an encoder API, SNMP, NMOS, or QC-probe integration.

## Client Integration Blueprint

See `CLIENT_INTEGRATION_BLUEPRINT.md` for the client-facing architecture plan. It explains what is real today, what needs backend services, what information a client must provide, and how to phase the product from demo to gateway pilot to production control plane.

A custom domain is not required for the current GitHub Pages demo. It becomes useful after API hosting, HTTPS, authentication, and backend gateway services are ready.

## Simulated vs Real

The browser app currently simulates several broadcast/cloud systems so the workflow can be demonstrated without dedicated infrastructure:

- LiveU contribution feeds are represented as front-end source states.
- NDI/SRT/WebRTC gateway discovery is represented as a placeholder API contract.
- AWS MediaConnect, MediaLive, and CDN Edge health are simulated.
- MediaPackage origin/ABR packaging is represented as a separate stage between MediaLive and CDN Edge. It becomes live only when a trusted collector is configured with the client's actual origin telemetry.
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

## Local OBS Connector

OBS can be connected locally through its WebSocket server. Copy `.env.obs.example` to `.env.local`, set the local OBS WebSocket password, and run `npm start`. The Edge Agent exposes actual OBS connection status, Program scene, scene list, and deliberate scene takes at `/api/obs` and in `/api/state`. Operators can map MCR routes to OBS scenes and explicitly arm MCR-to-OBS follow mode. The password stays in `.env.local`, which is excluded from Git.

The agent is intentionally local-only today. A future hosted control plane will pair to this agent through authenticated outbound connections; it must never require exposing OBS, NDI, or contribution equipment directly to the public internet.

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
