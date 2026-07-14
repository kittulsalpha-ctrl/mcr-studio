# Control Orchestrator API v1

This is the first backend boundary for MCR Studio. It does not process real media yet. It owns control state and exposes command endpoints that future ingest, switcher, audio, CG, replay, playout, encoder, and distribution services can implement behind the scenes.

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:8080/?backend=1&preset=football
```

Without `?backend=1`, the browser demo stays in static simulation mode and can still run on GitHub Pages.

## State And Events

```text
GET /api/health
GET /api/state
GET /api/logs
GET /api/events
GET /api/telemetry
GET /api/ingest
```

`/api/events` is a Server-Sent Events stream. It emits `state` events whenever a command changes orchestrator state.

## Telemetry Ingest

```text
POST /api/telemetry
```

This endpoint accepts normalized on-prem and cloud telemetry from a trusted collector. The browser does not call AWS APIs directly.

Set `TELEMETRY_INGEST_TOKEN` on the server to require `Authorization: Bearer <token>` for ingest requests. See `TELEMETRY_COLLECTOR_API.md` for the schema, AWS metric mapping, and example payload.

## Commands

```text
POST /api/preview
{ "source": "cam1|cam2|liveu3|liveu4|replay|playout|ad" }

POST /api/take
{ "source": "cam1|cam2|liveu3|liveu4|replay|playout|ad" }

POST /api/off-air
{}

POST /api/return-live
{}
```

## Contribution Preview Gateway

```text
GET /api/ingest

POST /api/ingest/start
{
  "id": "contribution-main",
  "label": "SRT Contribution Main",
  "transport": "test|srt|rtmp",
  "slot": "cam1|cam2|liveu3|liveu4",
  "inputUrl": "srt://0.0.0.0:9001?mode=listener&latency=200000"
}

POST /api/ingest/stop
{ "id": "contribution-main" }
```

`test` generates a real H.264/AAC contribution signal locally and does not require `inputUrl`. `srt` and `rtmp` require a matching protocol in the configured FFmpeg runtime. The gateway publishes HLS preview assets under `/media/<source-id>/index.m3u8`; these files are runtime artifacts and are not committed to Git.

The public gateway state redacts contribution URL passwords, passphrases, tokens, and stream IDs. Production deployments must additionally protect all control endpoints with authenticated operator roles and TLS.

## Audio

```text
POST /api/audio-program
{ "source": "cam1|cam2|liveu3|liveu4|replay|playout|null" }

POST /api/audio-fader
{ "source": "cam1", "value": 0.82 }

POST /api/audio-afv
{ "enabled": true }
```

## Source Health / QC

```text
POST /api/source-state
{ "source": "liveu1|liveu2|liveu3|liveu4", "state": "ONLINE|STANDBY|OFFLINE|ALARM" }

POST /api/source-detection
{ "source": "liveu1|liveu2|liveu3|liveu4", "detection": "black|silence|frozen", "active": true }
```

These commands allow Operations and Monitoring pages to share alarm/QC state through `/api/events`.

## Graphics

```text
POST /api/cg-preview
{ "layer": "lowerThird" }

POST /api/cg-take
{ "layer": "lowerThird" }

POST /api/cg-clear
{}
```

## Replay / Playout

```text
POST /api/replay-create
{ "source": "cam1", "duration": "00:00:10" }

POST /api/replay-take
{}

POST /api/playout-take
{ "assetId": "slate-live" }
```

## Future Engine Mapping

- `preview` and `take` map to the cloud video switcher.
- `audio-*` maps to the audio mixer service.
- `cg-*` maps to the key/fill graphics engine.
- `replay-*` maps to ISO record and replay services.
- `playout-*` maps to asset playback services.
- `state`, `logs`, and `events` become the live telemetry/control plane for the browser UI.
