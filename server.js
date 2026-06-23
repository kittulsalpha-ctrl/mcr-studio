/* ==========================================================================
   MCR Studio Control Orchestrator v1
   Dependency-free Node.js prototype: static web server + REST API + SSE events.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { OBSWebSocket } = require('obs-websocket-js');

const localEnvPath = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnvPath)) {
  fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const TELEMETRY_INGEST_TOKEN = process.env.TELEMETRY_INGEST_TOKEN || '';
const OBS_WEBSOCKET_ENABLED = process.env.OBS_WEBSOCKET_ENABLED === '1';
const OBS_WEBSOCKET_URL = process.env.OBS_WEBSOCKET_URL || 'ws://127.0.0.1:4455';
const OBS_WEBSOCKET_PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD || '';
const LOCAL_RUNTIME_CONFIG_PATH = path.join(__dirname, '.mcr-studio-local.json');
const TELEMETRY_SERVICE_IDS = ['directConnect', 'mediaConnect', 'mediaLive', 'cloudFront', 'encoder'];
const TELEMETRY_STATUSES = ['HEALTHY', 'ONLINE', 'RUNNING', 'READY', 'STANDBY', 'DEGRADED', 'ALARM', 'FAILED', 'UNKNOWN'];

function loadLocalRuntimeConfig() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_RUNTIME_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const localRuntimeConfig = loadLocalRuntimeConfig();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const state = {
  version: 'orchestrator-v1',
  updatedAt: new Date().toISOString(),
  sources: {
    cam1: { label: 'MULTIVIEW 1 / LiveU 1', state: 'ONLINE', type: 'liveu' },
    cam2: { label: 'MULTIVIEW 2 / Backup', state: 'STANDBY', type: 'liveu' },
    liveu3: { label: 'MULTIVIEW 3 / LiveU 3', state: 'ONLINE', type: 'liveu' },
    liveu4: { label: 'MULTIVIEW 4 / LiveU 4', state: 'ONLINE', type: 'liveu' },
    replay: { label: 'Replay Server EC2', state: 'STANDBY', type: 'replay' },
    playout: { label: 'Playout Server EC2', state: 'READY', type: 'playout' }
  },
  detections: {
    liveu1: { black: false, silence: false, frozen: false },
    liveu2: { black: false, silence: false, frozen: false },
    liveu3: { black: false, silence: false, frozen: false },
    liveu4: { black: false, silence: false, frozen: false }
  },
  routing: {
    preview: 'liveu3',
    program: 'cam1',
    returnLive: 'cam1'
  },
  audio: {
    followVideo: true,
    programBus: 'cam1',
    channels: {
      cam1: { fader: 0.82, mute: false, solo: false, pfl: false },
      cam2: { fader: 0.76, mute: false, solo: false, pfl: false },
      liveu3: { fader: 0.74, mute: false, solo: false, pfl: false },
      liveu4: { fader: 0.72, mute: false, solo: false, pfl: false },
      replay: { fader: 0.7, mute: true, solo: false, pfl: false },
      playout: { fader: 0.68, mute: true, solo: false, pfl: false }
    }
  },
  graphics: {
    preview: null,
    active: null,
    ticker: false,
    bug: false
  },
  replay: {
    source: 'cam1',
    selectedClip: 'replay-001',
    clips: [
      { id: 'replay-001', label: 'Replay 001 - Goal angle', source: 'cam1', duration: '00:00:08' },
      { id: 'replay-002', label: 'Replay 002 - Touchline ISO', source: 'liveu3', duration: '00:00:12' }
    ]
  },
  playout: {
    selectedAsset: 'slate-live',
    assets: [
      { id: 'slate-live', label: 'Holding Slate - Live Soon', type: 'SLATE', duration: 'LOOP' },
      { id: 'filler-loop', label: 'Filler Loop - Cloud MCR', type: 'FILLER', duration: 'LOOP' },
      { id: 'end-slate', label: 'End Slate - Transmission Complete', type: 'SLATE', duration: 'LOOP' },
      { id: 'emergency-loop', label: 'Emergency Backup Loop', type: 'BACKUP', duration: 'LOOP' }
    ]
  },
  services: {
    ingest: { label: 'Cloud Ingest Gateway', status: 'ONLINE', instance: 'ec2-ingest-a' },
    switcher: { label: 'Video Switcher', status: 'ROUTING', instance: 'ec2-switcher-gpu-a' },
    audio: { label: 'Audio Mixer', status: 'PGM', instance: 'ec2-audio-a' },
    cg: { label: 'CG Keyer', status: 'STANDBY', instance: 'ec2-cg-a' },
    replay: { label: 'Replay Server', status: 'STANDBY', instance: 'ec2-replay-a' },
    playout: { label: 'Playout Server', status: 'STANDBY', instance: 'ec2-playout-a' },
    encoder: { label: 'Program Encoder', status: 'ENCODING', instance: 'ec2-encoder-a' },
    distribution: { label: 'MediaLive / CDN', status: 'ONLINE', instance: 'aws-us-east-1' }
  },
  telemetry: {
    mode: 'SIMULATION',
    collector: 'mcr-studio-simulator',
    observedAt: new Date().toISOString(),
    services: {
      directConnect: { status: 'HEALTHY', region: 'us-east-1', detail: 'Primary VIF and BGP healthy', metrics: {} },
      mediaConnect: { status: 'HEALTHY', region: 'us-east-1', detail: 'Primary flow active', metrics: {} },
      mediaLive: { status: 'RUNNING', region: 'us-east-1', detail: 'Channel output active', metrics: {} },
      cloudFront: { status: 'HEALTHY', region: 'global', detail: 'Edge delivery healthy', metrics: {} },
      encoder: { status: 'HEALTHY', region: 'on-prem', detail: 'Contribution encoder locked', metrics: {} }
    },
    network: { rttMs: 25, lossPercent: 0, jitterMs: 5 }
  },
  obs: {
    enabled: OBS_WEBSOCKET_ENABLED,
    status: OBS_WEBSOCKET_ENABLED ? 'CONNECTING' : 'NOT CONFIGURED',
    programScene: '',
    scenes: [],
    detail: OBS_WEBSOCKET_ENABLED ? 'Connecting to local OBS.' : 'Local OBS connector is not configured.',
    followMcrTake: !!localRuntimeConfig.obs?.followMcrTake,
    mappings: { cam1: '', cam2: '', liveu3: '', liveu4: '', replay: '', playout: '', ...(localRuntimeConfig.obs?.mappings || {}) }
  },
  logs: []
};

const clients = new Set();
let obsClient;

function nowStamp() {
  return new Date().toISOString();
}

function addLog(severity, area, message, operatorAction = null) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: nowStamp(),
    severity,
    area,
    message,
    operatorAction
  };
  state.logs.push(entry);
  if (state.logs.length > 250) state.logs.shift();
  return entry;
}

function persistLocalRuntimeConfig() {
  const config = {
    obs: {
      followMcrTake: state.obs.followMcrTake,
      mappings: state.obs.mappings
    }
  };
  try {
    fs.writeFileSync(LOCAL_RUNTIME_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  } catch (error) {
    addLog('warning', 'SYSTEM', `Could not persist local routing configuration: ${error.message}`, 'config-save');
  }
}

function syncDerivedState() {
  state.updatedAt = nowStamp();
  state.services.switcher.status = state.routing.program ? 'ROUTING' : 'IDLE';
  state.services.audio.status = state.audio.programBus ? 'PGM' : 'IDLE';
  state.services.cg.status = state.graphics.active || state.graphics.ticker || state.graphics.bug ? 'KEYING' : 'STANDBY';
  state.services.replay.status = state.routing.program === 'replay' ? 'ON AIR' : state.routing.preview === 'replay' ? 'CUED' : 'STANDBY';
  state.services.playout.status = state.routing.program === 'playout' ? 'ON AIR' : state.routing.preview === 'playout' ? 'CUED' : 'STANDBY';
  state.services.encoder.status = state.routing.program ? 'ENCODING' : 'IDLE';
  state.services.distribution.status = state.routing.program ? 'ONLINE' : 'READY';
  state.sources.replay.state = state.services.replay.status;
  state.sources.playout.state = state.services.playout.status === 'STANDBY' ? 'READY' : state.services.playout.status;
}

function publicState() {
  syncDerivedState();
  return state;
}

function sendEvent(client, event, payload) {
  client.write(`event: ${event}\n`);
  client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event = 'state', payload = publicState()) {
  for (const client of clients) sendEvent(client, event, payload);
}

function publishObs(next) {
  state.obs = { ...state.obs, ...next, observedAt: nowStamp() };
  broadcast('state', publicState());
}

async function connectObs() {
  if (!OBS_WEBSOCKET_ENABLED) return;
  obsClient = new OBSWebSocket();
  obsClient.on('CurrentProgramSceneChanged', event => publishObs({ status: 'CONNECTED', programScene: event.sceneName || '', detail: `Program scene: ${event.sceneName || 'unnamed'}.` }));
  obsClient.on('ConnectionClosed', () => publishObs({ status: 'OFFLINE', detail: 'OBS WebSocket disconnected.' }));
  try {
    const version = await obsClient.connect(OBS_WEBSOCKET_URL, OBS_WEBSOCKET_PASSWORD || undefined);
    const [sceneList, program] = await Promise.all([obsClient.call('GetSceneList'), obsClient.call('GetCurrentProgramScene')]);
    publishObs({ status: 'CONNECTED', version: version.obsVersion || '', programScene: program.currentProgramSceneName || '', scenes: (sceneList.scenes || []).map(scene => scene.sceneName), detail: `OBS ${version.obsVersion || 'connected'} · ${sceneList.scenes?.length || 0} scene(s) available.` });
    addLog('info', 'OBS', 'OBS production engine connected.', 'obs-connect');
  } catch (error) {
    publishObs({ status: 'OFFLINE', detail: `OBS connection failed: ${error.message}` });
  }
}

function mutate(action, fn) {
  const result = fn();
  syncDerivedState();
  broadcast('state', publicState());
  return result;
}

function isKnownProgramSource(source) {
  return ['cam1', 'cam2', 'liveu3', 'liveu4', 'replay', 'playout', 'ad'].includes(source);
}

function normalizeContributionSource(source) {
  const aliases = { liveu1: 'cam1', liveu2: 'cam2', cam1: 'cam1', cam2: 'cam2', liveu3: 'liveu3', liveu4: 'liveu4' };
  return aliases[source] || null;
}

async function takeObsProgramScene(sceneName, reason) {
  if (!obsClient || state.obs.status !== 'CONNECTED') {
    throw new Error('OBS is not connected.');
  }
  if (!state.obs.scenes.includes(sceneName)) {
    throw new Error(`OBS scene "${sceneName}" is unavailable.`);
  }
  await obsClient.call('SetCurrentProgramScene', { sceneName });
  publishObs({ status: 'CONNECTED', programScene: sceneName, detail: `Program scene: ${sceneName}.` });
  const log = addLog('info', 'OBS', `OBS Program scene taken: ${sceneName}.`, reason);
  broadcast('state', publicState());
  return log;
}

function detectionSourceId(source) {
  const aliases = { cam1: 'liveu1', cam2: 'liveu2', liveu1: 'liveu1', liveu2: 'liveu2', liveu3: 'liveu3', liveu4: 'liveu4' };
  return aliases[source] || null;
}

function sanitizeTelemetryMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return {};
  return Object.entries(metrics).reduce((clean, [key, value]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) return clean;
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    if (typeof value === 'string' && value.length <= 120) clean[key] = value;
    return clean;
  }, {});
}

function normalizeTelemetryPayload(body) {
  const telemetry = body && typeof body === 'object' ? body : {};
  const services = telemetry.services && typeof telemetry.services === 'object' ? telemetry.services : {};
  const normalizedServices = {};

  TELEMETRY_SERVICE_IDS.forEach(serviceId => {
    const service = services[serviceId];
    if (!service || typeof service !== 'object') return;
    const status = String(service.status || 'UNKNOWN').toUpperCase();
    normalizedServices[serviceId] = {
      status: TELEMETRY_STATUSES.includes(status) ? status : 'UNKNOWN',
      region: typeof service.region === 'string' ? service.region.slice(0, 64) : '',
      detail: typeof service.detail === 'string' ? service.detail.slice(0, 180) : '',
      metrics: sanitizeTelemetryMetrics(service.metrics)
    };
  });

  const network = telemetry.network && typeof telemetry.network === 'object' ? telemetry.network : {};
  const normalizedNetwork = {};
  ['rttMs', 'lossPercent', 'jitterMs'].forEach(key => {
    if (typeof network[key] === 'number' && Number.isFinite(network[key])) normalizedNetwork[key] = network[key];
  });

  return {
    mode: telemetry.mode === 'LIVE' ? 'LIVE' : 'SIMULATION',
    collector: typeof telemetry.collector === 'string' ? telemetry.collector.slice(0, 96) : 'external-collector',
    observedAt: typeof telemetry.observedAt === 'string' ? telemetry.observedAt.slice(0, 48) : nowStamp(),
    services: normalizedServices,
    network: normalizedNetwork
  };
}

const commandHandlers = {
  preview(body) {
    const source = body.source;
    if (!isKnownProgramSource(source)) return { status: 400, body: { error: 'Unknown preview source' } };
    return mutate('preview', () => {
      state.routing.preview = source;
      const log = addLog('info', 'ROUTE', `Preview set to ${source}.`, 'preview');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  async take(body) {
    const source = body.source || state.routing.preview;
    if (!isKnownProgramSource(source)) return { status: 400, body: { error: 'Unknown take source' } };
    const result = mutate('take', () => {
      if (['cam1', 'cam2', 'liveu3', 'liveu4'].includes(state.routing.program)) {
        state.routing.returnLive = state.routing.program;
      }
      state.routing.program = source;
      state.routing.preview = null;
      if (state.audio.followVideo) state.audio.programBus = state.audio.channels[source] ? source : null;
      const log = addLog('info', 'MIX', `Program switched to ${source}.`, 'take');
      return { body: { ok: true, state: publicState(), log } };
    });
    const mappedScene = state.obs.followMcrTake ? state.obs.mappings[source] : '';
    if (mappedScene) {
      try {
        await takeObsProgramScene(mappedScene, `mcr-take:${source}`);
      } catch (error) {
        addLog('warning', 'OBS', `MCR Program changed, but OBS did not follow: ${error.message}`, 'obs-follow-take');
        broadcast('state', publicState());
      }
    }
    return { body: { ...result.body, state: publicState() } };
  },

  offAir() {
    return mutate('off-air', () => {
      state.routing.program = null;
      state.routing.preview = null;
      state.audio.programBus = null;
      const log = addLog('warning', 'MIX', 'Program output set OFF AIR.', 'off-air');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  async returnLive() {
    return commandHandlers.take({ source: state.routing.returnLive || 'cam1' });
  },

  audioProgram(body) {
    const source = body.source;
    if (source && !state.audio.channels[source]) return { status: 400, body: { error: 'Unknown audio source' } };
    return mutate('audio-program', () => {
      state.audio.followVideo = false;
      state.audio.programBus = source || null;
      const log = addLog('info', 'AUDIO', `PGM audio routed to ${source || 'none'}.`, 'audio-program');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  audioFader(body) {
    const source = body.source;
    const value = Number(body.value);
    if (!state.audio.channels[source] || Number.isNaN(value)) return { status: 400, body: { error: 'Invalid fader command' } };
    return mutate('audio-fader', () => {
      state.audio.channels[source].fader = Math.max(0, Math.min(1, value));
      const log = addLog('info', 'AUDIO', `${source} fader set to ${state.audio.channels[source].fader.toFixed(2)}.`, 'audio-fader');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  audioAfv(body) {
    return mutate('audio-afv', () => {
      state.audio.followVideo = !!body.enabled;
      if (state.audio.followVideo) state.audio.programBus = state.audio.channels[state.routing.program] ? state.routing.program : null;
      const log = addLog('info', 'AUDIO', `Audio Follow Video ${state.audio.followVideo ? 'enabled' : 'disabled'}.`, 'audio-afv');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  sourceState(body) {
    const source = normalizeContributionSource(body.source);
    const nextState = String(body.state || '').toUpperCase();
    if (!source || !['ONLINE', 'STANDBY', 'OFFLINE', 'ALARM'].includes(nextState)) {
      return { status: 400, body: { error: 'Invalid source state command' } };
    }
    return mutate('source-state', () => {
      state.sources[source].state = nextState;
      const log = addLog(nextState === 'ALARM' || nextState === 'OFFLINE' ? 'alarm' : nextState === 'STANDBY' ? 'warning' : 'info', 'SRC', `${state.sources[source].label} state set to ${nextState}.`, 'source-state');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  sourceDetection(body) {
    const source = detectionSourceId(body.source);
    const detection = body.detection;
    if (!source || !['black', 'silence', 'frozen'].includes(detection)) {
      return { status: 400, body: { error: 'Invalid source detection command' } };
    }
    return mutate('source-detection', () => {
      state.detections[source][detection] = !!body.active;
      const hasDetection = Object.values(state.detections[source]).some(Boolean);
      const routeSource = normalizeContributionSource(source);
      if (routeSource) state.sources[routeSource].state = hasDetection ? 'ALARM' : state.sources[routeSource].state === 'ALARM' ? 'ONLINE' : state.sources[routeSource].state;
      const log = addLog(body.active ? 'alarm' : 'info', 'QC', `${source.toUpperCase()} ${detection.toUpperCase()} detection ${body.active ? 'triggered' : 'cleared'}.`, 'source-detection');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  cgPreview(body) {
    return mutate('cg-preview', () => {
      state.graphics.preview = body.layer || 'lowerThird';
      const log = addLog('info', 'CG', `CG preview loaded: ${state.graphics.preview}.`, 'cg-preview');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  cgTake(body) {
    return mutate('cg-take', () => {
      state.graphics.active = body.layer || state.graphics.preview || 'lowerThird';
      state.graphics.preview = null;
      const log = addLog('info', 'CG', `CG keyed over Program: ${state.graphics.active}.`, 'cg-take');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  cgClear() {
    return mutate('cg-clear', () => {
      state.graphics.preview = null;
      state.graphics.active = null;
      state.graphics.ticker = false;
      state.graphics.bug = false;
      const log = addLog('info', 'CG', 'All CG layers cleared.', 'cg-clear');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  replayCreate(body) {
    return mutate('replay-create', () => {
      const source = body.source || state.replay.source;
      const clipNumber = String(state.replay.clips.length + 1).padStart(3, '0');
      const clip = { id: `replay-${clipNumber}`, label: `Replay ${clipNumber} - ${source} clip`, source, duration: body.duration || '00:00:10' };
      state.replay.clips.push(clip);
      state.replay.selectedClip = clip.id;
      const log = addLog('info', 'REPLAY', `${clip.label} created.`, 'replay-create');
      return { body: { ok: true, state: publicState(), clip, log } };
    });
  },

  async replayTake() {
    return commandHandlers.take({ source: 'replay' });
  },

  async playoutTake(body) {
    if (body.assetId) state.playout.selectedAsset = body.assetId;
    return commandHandlers.take({ source: 'playout' });
  },

  async obsTake(body) {
    const sceneName = String(body.sceneName || '');
    let log;
    try {
      log = await takeObsProgramScene(sceneName, 'obs-take');
    } catch (error) {
      return { status: 409, body: { error: error.message } };
    }
    return { body: { ok: true, state: publicState(), log } };
  },

  obsRoutingConfig(body) {
    const followMcrTake = !!body.followMcrTake;
    const mappings = body.mappings || {};
    const knownSources = ['cam1', 'cam2', 'liveu3', 'liveu4', 'replay', 'playout'];
    for (const [source, sceneName] of Object.entries(mappings)) {
      if (!knownSources.includes(source)) return { status: 400, body: { error: 'Unknown MCR source mapping.' } };
      if (sceneName && !state.obs.scenes.includes(sceneName)) return { status: 400, body: { error: `Unknown OBS scene: ${sceneName}` } };
    }
    return mutate('obs-routing-config', () => {
      state.obs.followMcrTake = followMcrTake;
      state.obs.mappings = { ...state.obs.mappings, ...mappings };
      persistLocalRuntimeConfig();
      const log = addLog('info', 'OBS', `OBS follow-MCR routing ${followMcrTake ? 'armed' : 'disarmed'}.`, 'obs-routing-config');
      return { body: { ok: true, state: publicState(), log } };
    });
  },

  telemetryIngest(body) {
    const telemetry = normalizeTelemetryPayload(body);
    if (!Object.keys(telemetry.services).length) {
      return { status: 400, body: { error: 'Telemetry payload must include at least one recognized service.' } };
    }
    return mutate('telemetry-ingest', () => {
      state.telemetry = {
        ...state.telemetry,
        ...telemetry,
        services: { ...state.telemetry.services, ...telemetry.services },
        network: { ...state.telemetry.network, ...telemetry.network }
      };
      const affected = Object.keys(telemetry.services).join(', ');
      const log = addLog('info', 'CLOUD', `Telemetry received from ${state.telemetry.collector}: ${affected}.`, 'telemetry-ingest');
      return { body: { ok: true, telemetry: state.telemetry, state: publicState(), log } };
    });
  }
};

addLog('info', 'SYSTEM', 'Control Orchestrator v1 initialized.', 'boot');
syncDerivedState();

function writeJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(req, res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(ROOT, normalized));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60'
    });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return writeJson(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return writeJson(res, 200, { ok: true, version: state.version, updatedAt: state.updatedAt, clients: clients.size });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return writeJson(res, 200, publicState());
  }

  if (req.method === 'GET' && url.pathname === '/api/logs') {
    return writeJson(res, 200, { logs: state.logs });
  }

  if (req.method === 'GET' && url.pathname === '/api/telemetry') {
    return writeJson(res, 200, state.telemetry);
  }

  if (req.method === 'GET' && url.pathname === '/api/obs') {
    return writeJson(res, 200, state.obs);
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.add(res);
    sendEvent(res, 'state', publicState());
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/telemetry') {
    const authorization = req.headers.authorization || '';
    if (TELEMETRY_INGEST_TOKEN && authorization !== `Bearer ${TELEMETRY_INGEST_TOKEN}`) {
      return writeJson(res, 401, { error: 'Telemetry ingest is unauthorized.' });
    }
    try {
      const body = await readJson(req);
      const result = commandHandlers.telemetryIngest(body);
      return writeJson(res, result.status || 200, result.body || result);
    } catch (error) {
      return writeJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const commandName = url.pathname.slice('/api/'.length).replaceAll('-', '');
    const aliases = {
      preview: 'preview',
      take: 'take',
      offair: 'offAir',
      returnlive: 'returnLive',
      audioprogram: 'audioProgram',
      audiofader: 'audioFader',
      audioafv: 'audioAfv',
      sourcestate: 'sourceState',
      sourcedetection: 'sourceDetection',
      cgpreview: 'cgPreview',
      cgtake: 'cgTake',
      cgclear: 'cgClear',
      replaycreate: 'replayCreate',
      replaytake: 'replayTake',
      playouttake: 'playoutTake',
      obstake: 'obsTake',
      obsroutingconfig: 'obsRoutingConfig'
    };
    const handler = commandHandlers[aliases[commandName]];
    if (!handler) return writeJson(res, 404, { error: 'Unknown API command' });
    try {
      const body = await readJson(req);
      const result = await handler(body) || { body: { ok: true } };
      return writeJson(res, result.status || 200, result.body || result);
    } catch (error) {
      return writeJson(res, 400, { error: error.message });
    }
  }

  return writeJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(error => writeJson(res, 500, { error: error.message }));
    return;
  }
  serveStatic(req, res, decodeURIComponent(url.pathname));
});

server.listen(PORT, () => {
  console.log(`MCR Studio Control Orchestrator listening on http://127.0.0.1:${PORT}`);
  connectObs().catch(() => {});
});
