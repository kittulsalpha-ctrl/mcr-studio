# MCR Studio NDI Bridge API

The browser app cannot discover or decode NDI directly. A future local or cloud bridge service should discover NDI on the production network, convert previews to browser-safe media, and expose this endpoint:

```http
GET /api/ndi/sources
```

Expected JSON:

```json
{
  "sources": [
    {
      "id": "ndi1",
      "name": "NDI-CAM-01 Field TX",
      "shortLabel": "NDI CAM 1",
      "codec": "NDI HX3",
      "resolution": "1080p60",
      "bitrateMbps": 7.6,
      "latencyMs": 34,
      "location": "Stadium Touchline",
      "state": "ONLINE",
      "previewUrl": "webrtc://bridge/ndi1"
    }
  ]
}
```

Supported source fields:

- `id`: stable source identifier, without the `ndi:` prefix.
- `name` or `label`: operator-facing source name.
- `shortLabel`: compact multiviewer label.
- `codec`: for example `NDI HX3`, `NDI HX2`, or `NDI Full`.
- `resolution`: for example `1080p60`.
- `bitrateMbps` or `bitrate`: approximate source bitrate.
- `latencyMs` or `rttOffset`: bridge/source latency contribution.
- `location` or `group`: source grouping shown in the UI.
- `state` or `status`: `ONLINE`, `STANDBY`, `OFFLINE`, or `ALARM`.
- `previewUrl`: future WebRTC/HLS preview URL.

If this endpoint is unavailable, the app falls back to simulated NDI discovery so demos keep working.
