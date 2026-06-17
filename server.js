/* ==========================================================================
   MCR Studio Control Orchestrator v1
   Dependency-free Node.js prototype: static web server + REST API + SSE events.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;

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
  logs: []
};

const clients = new Set();

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

function mutate(action, fn) {
  const result = fn();
  syncDerivedState();
  broadcast('state', publicState());
  return result;
}

function isKnownProgramSource(source) {
  return ['cam1', 'cam2', 'liveu3', 'liveu4', 'replay', 'playout', 'ad'].includes(source);
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

  take(body) {
    const source = body.source || state.routing.preview;
    if (!isKnownProgramSource(source)) return { status: 400, body: { error: 'Unknown take source' } };
    return mutate('take', () => {
      if (['cam1', 'cam2', 'liveu3', 'liveu4'].includes(state.routing.program)) {
        state.routing.returnLive = state.routing.program;
      }
      state.routing.program = source;
      state.routing.preview = null;
      if (state.audio.followVideo) state.audio.programBus = state.audio.channels[source] ? source : null;
      const log = addLog('info', 'MIX', `Program switched to ${source}.`, 'take');
      return { body: { ok: true, state: publicState(), log } };
    });
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

  returnLive() {
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

  replayTake() {
    return commandHandlers.take({ source: 'replay' });
  },

  playoutTake(body) {
    if (body.assetId) state.playout.selectedAsset = body.assetId;
    return commandHandlers.take({ source: 'playout' });
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
    'Access-Control-Allow-Headers': 'Content-Type'
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
      cgpreview: 'cgPreview',
      cgtake: 'cgTake',
      cgclear: 'cgClear',
      replaycreate: 'replayCreate',
      replaytake: 'replayTake',
      playouttake: 'playoutTake'
    };
    const handler = commandHandlers[aliases[commandName]];
    if (!handler) return writeJson(res, 404, { error: 'Unknown API command' });
    try {
      const body = await readJson(req);
      const result = handler(body) || { body: { ok: true } };
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
});
