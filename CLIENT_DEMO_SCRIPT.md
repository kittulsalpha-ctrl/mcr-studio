# MCR Studio Client Demo Script

Use this script to present MCR Studio as a serious Cloud MCR/PCR prototype. The goal is not to show every control. The goal is to make the client understand the operational value quickly.

## Demo Positioning

MCR Studio is a browser-based Cloud MCR/PCR control surface for live source monitoring, preview/program switching, cloud delivery health, incident response, and future integration with real broadcast systems.

Say this clearly:

> This is a working prototype and integration blueprint. The current browser demo simulates the cloud broadcast chain, while the architecture is prepared for real gateways, orchestration APIs, OBS, NDI/SRT/WebRTC, AWS Media Services, QC probes, logs, and AI-assisted runbooks.

## Recommended Demo Flow

Start with `OPERATE`, then show `MONITOR`, then `INGEST`, and finish with `AI OPS`.

Do not start with Ingest. Clients should first see the control-room value.

## 1. Operate: Control Room Story

Open:

```text
https://kittulsalpha-ctrl.github.io/mcr-studio/
```

Talk track:

> This is the operator surface. Program Out is the main on-air output. Preview is the next source. The multiviewer shows available live sources. The right side gives controlled broadcast actions such as Take, Cut, Fade, Emergency Backup, Graphics, Audio Follow Video, replay/playout, and show cues.

Show:

- Program Out is the largest panel.
- Preview is separate from Program.
- Source tiles show signal state and Preview/Mute actions.
- Recent logs show operator actions.

Press:

```text
START CLIENT DEMO
```

Explain the sequence:

1. Source locks through contribution and ingest.
2. Source is sent to Preview.
3. Preview is taken to Program.
4. Graphics are keyed over Program.
5. A primary path incident is simulated.
6. The runbook recommends backup.
7. Backup is previewed and taken to Program.
8. Incident is summarized and resolved.

What the client should notice:

- The workflow is understandable without opening Ingest.
- Program/Preview routing is clear.
- Alarms and logs tell the same operational story.
- The UI demonstrates how real source, switcher, graphics, audio, cloud, and runbook systems can connect later.

## 2. Monitor: NOC / MCR Health Story

Open:

```text
https://kittulsalpha-ctrl.github.io/mcr-studio/monitoring.html
```

Talk track:

> This is the monitoring view for MCR/NOC engineers. It is not for switching the show. It is for signal confidence, cloud delivery health, alarms, incident response, DR, SCTE, and runbook guidance.

Show:

- Active Alarms first.
- Program Delivery and Signal Path.
- Delivery Health and SRT Contributor Telemetry.
- Cloud Chain Health service tiles.
- DR / Failover Monitoring.
- Operator & Incident Timeline.
- Ops Runbook Advisor.

Say:

> In production, these cards would be fed by an orchestrator, QC probes, cloud telemetry collectors, AWS MediaConnect/MediaLive/CloudFront APIs, encoder APIs, and gateway services. The browser should not hold AWS credentials or directly control private broadcast equipment.

## 3. Ingest: Source Team / Integration Story

Open:

```text
https://kittulsalpha-ctrl.github.io/mcr-studio/setup.html
```

Talk track:

> Ingest is where the source team configures incoming feeds, assigns metadata, validates signal lock, and prepares integration readiness. Operators should not need this during a live show unless they are assigning or testing sources.

Show:

- Contribution Source Ingest.
- Webcam/local file setup for browser demo.
- OBS / Local Production Mapping.
- NDI / IP gateway discovery placeholder.
- Region presets.
- Ingest presets.
- Gateway/API readiness.
- Integration Roadmap.

Say:

> Real NDI, SRT, WebRTC, LiveU receiver, AWS, replay, playout, and audio integration will require backend gateways and authenticated APIs. This page is where those integrations are exposed cleanly without cluttering the live operator view.

## 4. AI Ops: Runbook Intelligence Story

Open:

```text
https://kittulsalpha-ctrl.github.io/mcr-studio/automation.html
```

Talk track:

> AI Ops is not replacing the operator. It is the runbook intelligence layer that detects issues, correlates telemetry, recommends actions, prepares routes, and asks for human approval before any risky Program action.

Show:

- Broadcast AI Agent Overview.
- Event-Driven Runbook Rules.
- Workflow Designer.
- Broadcast Digital Twin.
- Assisted Incident Simulation.
- AI Ops Recommendation Panel.
- AI Ops Timeline.

Press:

```text
SIMULATE PACKET LOSS
```

Then show:

- The contribution node becomes critical.
- Agent cards move to warning state.
- Recommendation says backup can be previewed, but Take requires operator approval.
- Timeline records detected, analyzed, recommended, and guardrail events.

Say:

> This is the future control layer: AI can detect, analyze, recommend, preview, and prepare. It should not take a destructive action like Take, Emergency Backup, or Failover without operator approval.

## What Is Real Today

- Static GitHub Pages UI.
- Browser-side Preview to Program workflow.
- Simulated LiveU/source states.
- Simulated cloud delivery chain.
- Simulated alarms, telemetry, SCTE, failover, logs, and runbook recommendations.
- Webcam, local video, and URL-based browser source testing.
- Local Node Edge Agent for OBS/backend demo mode when run locally.

## What Is Simulated Today

- LiveU server ingest.
- NDI/SRT/WebRTC gateway discovery.
- AWS MediaConnect, MediaLive, MediaPackage, and CDN telemetry.
- Real audio mixing engine.
- Real replay/playout engine.
- Real AI assistant connected to live telemetry and historical incidents.
- Real cloud switching running on EC2/GPU instances.

## Client Questions To Expect

**Can this connect to our real systems?**  
Yes, but not through GitHub Pages alone. Real integration needs a backend gateway and orchestrator.

**Can this receive NDI directly in the browser?**  
No. NDI requires a bridge that discovers NDI and converts preview to WebRTC/HLS/fMP4.

**Can this use AWS Free Tier only?**  
For this prototype, yes, because the cloud chain is simulated. Real MediaLive/MediaConnect/CDN workflows may create AWS cost and should be tested carefully with budgets and alerts.

**Can this be hosted as a real web app?**  
Yes. The static UI can be hosted now. A production product needs authentication, HTTPS, backend APIs, secure agent pairing, logging persistence, and role-based access.

## Acceptance Checklist Before Any Client Demo

- Operate page loads without horizontal overflow.
- `START CLIENT DEMO` completes the full flow.
- Program Out updates after Take.
- Preview clears after Take.
- Graphics overlay appears only after Program is on air.
- Incident step updates alarms, logs, and monitoring state.
- Backup preview and backup take work.
- Monitor page shows Active Alarms, Signal Path, Cloud Chain Health, Timeline, and Runbook Advisor.
- Ingest page clearly separates source onboarding from live operation.
- AI Ops page shows AI agents, rules, digital twin, simulations, recommendations, and operator approval guardrails.
- GitHub Pages deployment is green.
- Public URL returns `200 OK`.

## Short Sales Story

Use this if you only have two minutes:

> MCR Studio shows how a live cloud control room can work in the browser. Operators switch sources in Operate, engineers watch signal health in Monitor, ingest teams onboard and validate sources in Ingest, and AI-assisted runbooks live in AI Ops. Today the media chain is simulated for safe demos, but the architecture is ready for real gateways, cloud telemetry, OBS, NDI/SRT/WebRTC, AWS Media Services, QC probes, and human-approved AI runbooks.
