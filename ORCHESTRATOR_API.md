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
```

`/api/events` is a Server-Sent Events stream. It emits `state` events whenever a command changes orchestrator state.

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

## Audio

```text
POST /api/audio-program
{ "source": "cam1|cam2|liveu3|liveu4|replay|playout|null" }

POST /api/audio-fader
{ "source": "cam1", "value": 0.82 }

POST /api/audio-afv
{ "enabled": true }
```

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
