/*
 * MCR Studio AWS Telemetry Worker
 *
 * Polls configured AWS resources, normalizes their health, and posts it to the
 * local Control Orchestrator. Credentials are resolved by the standard AWS SDK
 * provider chain (instance/task role, environment, profile, or web identity).
 */

const {
  CloudWatchClient,
  GetMetricDataCommand
} = require('@aws-sdk/client-cloudwatch');
const {
  MediaLiveClient,
  DescribeChannelCommand
} = require('@aws-sdk/client-medialive');
const {
  MediaConnectClient,
  DescribeFlowCommand
} = require('@aws-sdk/client-mediaconnect');
const {
  DirectConnectClient,
  DescribeVirtualInterfacesCommand
} = require('@aws-sdk/client-direct-connect');

const region = process.env.AWS_REGION || 'us-east-1';
const orchestratorUrl = (process.env.MCR_ORCHESTRATOR_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const ingestToken = process.env.TELEMETRY_INGEST_TOKEN || '';
const pollSeconds = Math.max(15, Number(process.env.TELEMETRY_POLL_SECONDS || 60));

const config = {
  mediaLiveChannelId: process.env.MEDIALIVE_CHANNEL_ID || '',
  mediaConnectFlowArn: process.env.MEDIACONNECT_FLOW_ARN || '',
  directConnectVifId: process.env.DIRECT_CONNECT_VIF_ID || '',
  cloudFrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID || '',
  encoderName: process.env.CONTRIBUTION_ENCODER_NAME || ''
};

const cloudWatch = new CloudWatchClient({ region });
const mediaLive = new MediaLiveClient({ region });
const mediaConnect = new MediaConnectClient({ region });
const directConnect = new DirectConnectClient({ region });

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function serviceStatus(value, healthyValues) {
  const normalized = String(value || '').toUpperCase();
  if (healthyValues.includes(normalized)) return 'HEALTHY';
  if (['RUNNING', 'ACTIVE'].includes(normalized)) return 'RUNNING';
  if (['DELETED', 'FAILED', 'ERROR'].includes(normalized)) return 'FAILED';
  return normalized ? 'DEGRADED' : 'UNKNOWN';
}

async function cloudWatchMetric(namespace, metricName, dimensions, statistic = 'Average', metricRegion = region) {
  const client = metricRegion === region ? cloudWatch : new CloudWatchClient({ region: metricRegion });
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);
  const response = await client.send(new GetMetricDataCommand({
    StartTime: startTime,
    EndTime: endTime,
    ScanBy: 'TimestampDescending',
    MetricDataQueries: [{
      Id: 'metric',
      ReturnData: true,
      MetricStat: {
        Metric: { Namespace: namespace, MetricName: metricName, Dimensions: dimensions },
        Period: 60,
        Stat: statistic
      }
    }]
  }));
  return numberOrNull(response.MetricDataResults?.[0]?.Values?.[0]);
}

async function collectDirectConnect() {
  if (!config.directConnectVifId) return null;
  const response = await directConnect.send(new DescribeVirtualInterfacesCommand({
    virtualInterfaceId: config.directConnectVifId
  }));
  const vif = response.virtualInterfaces?.[0] || {};
  const bgpUp = vif.bgpPeers?.some(peer => String(peer.bgpStatus).toUpperCase() === 'UP');
  const dimensions = [{ Name: 'VirtualInterfaceId', Value: config.directConnectVifId }];
  const [ingressBps, egressBps, bgpStatus] = await Promise.all([
    cloudWatchMetric('AWS/DX', 'VirtualInterfaceBpsIngress', dimensions),
    cloudWatchMetric('AWS/DX', 'VirtualInterfaceBpsEgress', dimensions),
    cloudWatchMetric('AWS/DX', 'VirtualInterfaceBgpStatus', dimensions, 'Maximum')
  ]);
  const healthy = bgpStatus === 1 || bgpUp;
  return {
    status: healthy ? 'HEALTHY' : 'DEGRADED',
    region,
    detail: `${vif.virtualInterfaceState || 'unknown'} VIF; BGP ${healthy ? 'up' : 'down'}`,
    metrics: {
      ingressMbps: ingressBps === null ? 'n/a' : Number((ingressBps / 1_000_000).toFixed(2)),
      egressMbps: egressBps === null ? 'n/a' : Number((egressBps / 1_000_000).toFixed(2)),
      bgpStatus: bgpStatus === null ? 'n/a' : bgpStatus
    }
  };
}

async function collectMediaConnect() {
  if (!config.mediaConnectFlowArn) return null;
  const response = await mediaConnect.send(new DescribeFlowCommand({ FlowArn: config.mediaConnectFlowArn }));
  const flow = response.flow || {};
  const status = serviceStatus(flow.status, ['ACTIVE', 'STANDBY']);
  return {
    status,
    region,
    detail: `Flow ${flow.name || config.mediaConnectFlowArn.split('/').pop() || 'configured'} is ${flow.status || 'unknown'}`,
    metrics: { sourceCount: flow.source?.length || flow.sources?.length || 0 }
  };
}

async function collectMediaLive() {
  if (!config.mediaLiveChannelId) return null;
  const response = await mediaLive.send(new DescribeChannelCommand({ ChannelId: config.mediaLiveChannelId }));
  const channel = response.channel || {};
  const dimensions = [{ Name: 'ChannelId', Value: config.mediaLiveChannelId }];
  const [activeOutputs, fillMsec, droppedFrames] = await Promise.all([
    cloudWatchMetric('AWS/MediaLive', 'ActiveOutputs', dimensions, 'Minimum'),
    cloudWatchMetric('AWS/MediaLive', 'FillMsec', dimensions, 'Maximum'),
    cloudWatchMetric('AWS/MediaLive', 'DroppedFrames', dimensions, 'Sum')
  ]);
  const channelStatus = String(channel.state || '').toUpperCase();
  const degraded = fillMsec > 0 || droppedFrames > 0 || activeOutputs === 0;
  return {
    status: degraded ? 'DEGRADED' : serviceStatus(channelStatus, ['RUNNING']),
    region,
    detail: `Channel ${channel.name || config.mediaLiveChannelId} is ${channelStatus || 'unknown'}`,
    metrics: { activeOutputs, fillMsec, droppedFrames }
  };
}

async function collectCloudFront() {
  if (!config.cloudFrontDistributionId) return null;
  const dimensions = [
    { Name: 'DistributionId', Value: config.cloudFrontDistributionId },
    { Name: 'Region', Value: 'Global' }
  ];
  const [error5xxRate, cacheHitRate, originLatencyP95Ms] = await Promise.all([
    cloudWatchMetric('AWS/CloudFront', '5xxErrorRate', dimensions, 'Average', 'us-east-1'),
    cloudWatchMetric('AWS/CloudFront', 'CacheHitRate', dimensions, 'Average', 'us-east-1'),
    cloudWatchMetric('AWS/CloudFront', 'OriginLatency', dimensions, 'p95', 'us-east-1')
  ]);
  const degraded = error5xxRate !== null && error5xxRate > 1;
  return {
    status: degraded ? 'DEGRADED' : 'HEALTHY',
    region: 'global',
    detail: degraded ? 'Viewer 5xx rate exceeds 1%' : 'CloudFront delivery healthy',
    metrics: { error5xxRate, cacheHitRate, originLatencyP95Ms }
  };
}

function collectEncoder() {
  if (!config.encoderName) return null;
  return {
    status: 'UNKNOWN',
    region: 'on-prem',
    detail: `${config.encoderName} requires vendor API, SNMP, NMOS, or QC probe integration`,
    metrics: {}
  };
}

async function postTelemetry(payload) {
  const response = await fetch(`${orchestratorUrl}/api/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ingestToken ? { Authorization: `Bearer ${ingestToken}` } : {})
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Telemetry ingest failed: HTTP ${response.status} ${await response.text()}`);
}

async function collectAndPost() {
  const results = await Promise.allSettled([
    collectDirectConnect(),
    collectMediaConnect(),
    collectMediaLive(),
    collectCloudFront(),
    Promise.resolve(collectEncoder())
  ]);
  const serviceIds = ['directConnect', 'mediaConnect', 'mediaLive', 'cloudFront', 'encoder'];
  const services = {};
  results.forEach((result, index) => {
    const serviceId = serviceIds[index];
    if (result.status === 'fulfilled' && result.value) services[serviceId] = result.value;
    if (result.status === 'rejected') {
      services[serviceId] = { status: 'UNKNOWN', region, detail: `Collector error: ${result.reason.message}`, metrics: {} };
    }
  });
  if (!Object.keys(services).length) throw new Error('No AWS or encoder resources are configured.');

  await postTelemetry({
    mode: 'LIVE',
    collector: process.env.TELEMETRY_COLLECTOR_NAME || 'aws-telemetry-worker',
    observedAt: new Date().toISOString(),
    services
  });
  console.log(`[telemetry] posted ${Object.keys(services).join(', ')}`);
}

async function main() {
  await collectAndPost();
  setInterval(() => {
    collectAndPost().catch(error => console.error(`[telemetry] ${error.message}`));
  }, pollSeconds * 1000);
}

main().catch(error => {
  console.error(`[telemetry] startup failed: ${error.message}`);
  process.exitCode = 1;
});
