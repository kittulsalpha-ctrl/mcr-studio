# Telemetry Collector API v1

This contract connects a trusted backend collector to MCR Studio. The browser never receives AWS credentials and never calls AWS APIs directly.

The collector can run in AWS, on a client workstation, or in the customer network. It gathers CloudWatch/API data and encoder/QC telemetry, normalizes it, then posts it to the Control Orchestrator.

## Endpoints

```text
GET  /api/telemetry
POST /api/telemetry
```

When the server has `TELEMETRY_INGEST_TOKEN` configured, the POST request must include:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Leave the token unset only for local prototype development. Production deployments should place the ingest endpoint behind authentication, TLS, network restrictions, and a secret manager.

## Normalized Payload

```json
{
  "mode": "LIVE",
  "collector": "client-aws-telemetry-worker",
  "observedAt": "2026-06-22T12:34:56.000Z",
  "network": {
    "rttMs": 38,
    "lossPercent": 0.2,
    "jitterMs": 7
  },
  "services": {
    "directConnect": {
      "status": "HEALTHY",
      "region": "us-east-1",
      "detail": "Primary VIF BGP up; backup VIF ready",
      "metrics": {
        "connectionState": 1,
        "bgpStatus": 1,
        "ingressMbps": 85.4,
        "egressMbps": 12.1,
        "errorCount": 0
      }
    },
    "mediaConnect": {
      "status": "HEALTHY",
      "region": "us-east-1",
      "detail": "Flow sports-main-primary active",
      "metrics": {
        "arqRecovered": 4,
        "inputLossSeconds": 0
      }
    },
    "mediaLive": {
      "status": "RUNNING",
      "region": "us-east-1",
      "detail": "Channel output active on both pipelines",
      "metrics": {
        "activeOutputs": 2,
        "fillMsec": 0,
        "droppedFrames": 0,
        "networkOutMbps": 18.2
      }
    },
    "cloudFront": {
      "status": "HEALTHY",
      "region": "global",
      "detail": "Distribution edge delivery nominal",
      "metrics": {
        "error5xxRate": 0,
        "cacheHitRate": 94.2,
        "originLatencyP95Ms": 112
      }
    },
    "encoder": {
      "status": "HEALTHY",
      "region": "on-prem",
      "detail": "Encoder locked at 1080p59.94 with embedded audio",
      "metrics": {
        "bitrateMbps": 14.8,
        "droppedFrames": 0,
        "audioSilenceSeconds": 0
      }
    }
  }
}
```

## Allowed Service IDs And States

Service IDs: `directConnect`, `mediaConnect`, `mediaLive`, `cloudFront`, `encoder`.

States: `HEALTHY`, `ONLINE`, `RUNNING`, `READY`, `STANDBY`, `DEGRADED`, `ALARM`, `FAILED`, `UNKNOWN`.

The endpoint accepts partial updates. Send only the services the collector has authority to observe; the orchestrator retains the most recent data for the others.

## AWS Collector Mapping

- Direct Connect: connection/VIF state, BGP state, bitrate, discards, and errors.
- MediaConnect: source/flow health, ARQ recovery, transport/QC metrics.
- MediaLive: channel state/alerts, active outputs, input loss, fill frames, dropped frames, audio, and output errors.
- CloudFront: 5xx rate, total error rate, cache hit rate, origin latency, and request volume.
- Encoder: vendor API, SNMP, NMOS, or a local FFmpeg/GStreamer/QC probe.

Use EventBridge for fast MediaLive channel state, channel alert, and input-change notifications. Use CloudWatch/API polling for metric snapshots. The collector should convert both into this payload and post updates over HTTPS.

## Example

```bash
curl -X POST http://127.0.0.1:8080/api/telemetry \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer development-token' \
  --data @telemetry.json
```

The orchestrator logs the ingest, broadcasts the resulting state through `/api/events`, and the Monitoring page changes its Cloud Broadcast Health badge to `LIVE COLLECTOR` when backend mode is enabled.
