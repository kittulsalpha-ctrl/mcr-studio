const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
const VALID_SLOTS = new Set(['cam1', 'cam2', 'liveu3', 'liveu4']);
const VALID_TRANSPORTS = new Set(['test', 'srt', 'rtmp']);
const DEFAULT_VLC_PATH = '/Applications/VLC.app/Contents/MacOS/VLC';

function redactInputUrl(inputUrl) {
  if (!inputUrl) return '';
  try {
    const parsed = new URL(inputUrl);
    if (parsed.password) parsed.password = 'REDACTED';
    ['passphrase', 'password', 'token', 'streamid'].forEach(key => {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, 'REDACTED');
    });
    return parsed.toString();
  } catch {
    return inputUrl.slice(0, 160);
  }
}

function probeFfmpeg(ffmpegPath) {
  const versionResult = spawnSync(ffmpegPath, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (versionResult.error || versionResult.status !== 0) {
    return {
      status: 'UNAVAILABLE',
      path: ffmpegPath,
      version: '',
      protocols: { srt: false, rtmp: false },
      preview: 'UNAVAILABLE',
      detail: versionResult.error?.message || versionResult.stderr?.trim() || 'FFmpeg could not be started.'
    };
  }

  const protocolResult = spawnSync(ffmpegPath, ['-hide_banner', '-protocols'], { encoding: 'utf8' });
  const protocols = `${protocolResult.stdout || ''}\n${protocolResult.stderr || ''}`
    .split(/\s+/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const versionLine = (versionResult.stdout || '').split(/\r?\n/)[0] || 'ffmpeg';

  return {
    status: 'AVAILABLE',
    path: ffmpegPath,
    version: versionLine.replace(/^ffmpeg version\s+/i, '').slice(0, 96),
    protocols: {
      srt: protocols.includes('srt'),
      rtmp: protocols.includes('rtmp')
    },
    preview: 'HLS',
    detail: protocols.includes('srt')
      ? 'FFmpeg is ready for SRT and RTMP contribution ingest.'
      : 'FFmpeg is ready for test/RTMP ingest; this build does not include SRT.'
  };
}

function probeVlcSrt(vlcPath) {
  if (!vlcPath || !fs.existsSync(vlcPath)) {
    return { status: 'UNAVAILABLE', path: vlcPath || '', version: '', detail: 'VLC SRT bridge runtime was not found.' };
  }
  const versionResult = spawnSync(vlcPath, ['--version'], { encoding: 'utf8', timeout: 5000 });
  const moduleResult = spawnSync(vlcPath, ['-I', 'dummy', '--list'], { encoding: 'utf8', timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
  const modules = `${moduleResult.stdout || ''}\n${moduleResult.stderr || ''}`;
  const hasInput = /\baccess_srt\b/.test(modules);
  const hasOutput = /\baccess_output_srt\b/.test(modules);
  const versionLine = (versionResult.stdout || '').split(/\r?\n/)[0] || '';
  return {
    status: !versionResult.error && hasInput && hasOutput ? 'AVAILABLE' : 'UNAVAILABLE',
    path: vlcPath,
    version: versionLine.replace(/^VLC version\s+/i, '').slice(0, 96),
    detail: hasInput && hasOutput
      ? 'VLC can bridge SRT contribution input to the FFmpeg preview pipeline.'
      : 'VLC is installed but its SRT input/output modules are unavailable.'
  };
}

function buildVlcSrtBridgeConfig(inputUrl, udpPort) {
  const parsed = new URL(inputUrl);
  const mode = String(parsed.searchParams.get('mode') || (parsed.hostname ? 'caller' : 'listener')).toLowerCase();
  if (!['caller', 'listener'].includes(mode)) throw new Error('VLC SRT bridge supports caller or listener mode.');
  if (!parsed.port) throw new Error('SRT input URL must include a port.');
  if (mode === 'caller' && !parsed.hostname) throw new Error('SRT caller mode requires a remote host.');

  const latencyRaw = Number(parsed.searchParams.get('latency') || 200);
  const latencyMs = latencyRaw > 10000 ? Math.round(latencyRaw / 1000) : Math.round(latencyRaw);
  const passphrase = parsed.searchParams.get('passphrase') || '';
  const streamId = parsed.searchParams.get('streamid') || '';
  const srtInput = mode === 'listener'
    ? `srt://:${parsed.port}`
    : `srt://${parsed.hostname}:${parsed.port}`;
  const args = ['-I', 'dummy', '--no-video-title-show', `--latency=${Math.max(20, latencyMs)}`];
  if (passphrase) args.push(`--passphrase=${passphrase}`);
  if (streamId) args.push(`--streamid=${streamId}`);
  args.push(srtInput, '--sout', `#standard{access=udp,mux=ts,dst=127.0.0.1:${udpPort}}`);
  return {
    mode,
    latencyMs: Math.max(20, latencyMs),
    args,
    ffmpegInputUrl: `udp://127.0.0.1:${udpPort}?fifo_size=1000000&overrun_nonfatal=1`
  };
}

function parseProgress(line, source) {
  const frameMatch = line.match(/frame=\s*(\d+)/);
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
  const speedMatch = line.match(/speed=\s*([\d.]+)x/);
  if (frameMatch) source.metrics.frames = Number(frameMatch[1]);
  if (fpsMatch) source.metrics.fps = Number(fpsMatch[1]);
  if (bitrateMatch) source.metrics.bitrateKbps = Number(bitrateMatch[1]);
  if (speedMatch) source.metrics.speed = Number(speedMatch[1]);
}

class MediaGateway {
  constructor({
    root,
    ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg',
    vlcPath = process.env.VLC_PATH || DEFAULT_VLC_PATH,
    srtBridgeUdpBase = Number(process.env.SRT_BRIDGE_UDP_BASE || 12000),
    onUpdate = () => {}
  } = {}) {
    this.root = root || __dirname;
    this.runtimeRoot = path.join(this.root, '.runtime', 'media');
    this.ffmpegPath = ffmpegPath;
    this.vlcPath = vlcPath;
    this.srtBridgeUdpBase = Number.isInteger(srtBridgeUdpBase) && srtBridgeUdpBase >= 1024 && srtBridgeUdpBase <= 65531
      ? srtBridgeUdpBase
      : 12000;
    this.onUpdate = onUpdate;
    this.capabilities = probeFfmpeg(ffmpegPath);
    this.capabilities.vlc = probeVlcSrt(vlcPath);
    this.capabilities.srtRuntime = this.capabilities.protocols.srt
      ? 'FFMPEG'
      : this.capabilities.vlc.status === 'AVAILABLE' ? 'VLC BRIDGE' : 'UNAVAILABLE';
    this.capabilities.protocols.srt = this.capabilities.srtRuntime !== 'UNAVAILABLE';
    if (this.capabilities.srtRuntime === 'VLC BRIDGE') {
      this.capabilities.detail = 'FFmpeg preview is available; SRT contribution uses the installed VLC bridge.';
    }
    this.sources = new Map();
    fs.mkdirSync(this.runtimeRoot, { recursive: true });
  }

  publicState() {
    return {
      status: [...this.sources.values()].some(source => source.status === 'ONLINE')
        ? 'ONLINE'
        : [...this.sources.values()].some(source => source.status === 'STARTING')
          ? 'STARTING'
          : this.capabilities.status === 'AVAILABLE' ? 'READY' : 'UNAVAILABLE',
      capabilities: this.capabilities,
      sources: [...this.sources.values()].map(source => ({
        id: source.id,
        label: source.label,
        slot: source.slot,
        transport: source.transport,
        status: source.status,
        inputUrl: redactInputUrl(source.inputUrl),
        previewUrl: source.previewUrl,
        startedAt: source.startedAt,
        observedAt: source.observedAt,
        detail: source.detail,
        metrics: { ...source.metrics }
      }))
    };
  }

  emitUpdate() {
    this.onUpdate(this.publicState());
  }

  validateConfig(config = {}) {
    const id = String(config.id || 'contribution-main').toLowerCase();
    const transport = String(config.transport || 'test').toLowerCase();
    const slot = String(config.slot || 'cam1');
    const label = String(config.label || 'Contribution Main').trim().slice(0, 64);
    const inputUrl = String(config.inputUrl || '').trim();

    if (!SOURCE_ID_PATTERN.test(id)) throw new Error('Source ID must contain only lowercase letters, numbers, and hyphens.');
    if (!VALID_TRANSPORTS.has(transport)) throw new Error('Transport must be test, srt, or rtmp.');
    if (!VALID_SLOTS.has(slot)) throw new Error('Slot must be cam1, cam2, liveu3, or liveu4.');
    if (transport !== 'test' && !inputUrl) throw new Error(`${transport.toUpperCase()} input URL is required.`);
    if (transport === 'srt' && !this.capabilities.protocols.srt) throw new Error('No SRT-capable FFmpeg or VLC bridge runtime is available.');
    if (transport === 'rtmp' && !this.capabilities.protocols.rtmp) throw new Error('This FFmpeg build does not include the RTMP protocol.');
    if (transport === 'srt' && !inputUrl.startsWith('srt://')) throw new Error('SRT input must start with srt://.');
    if (transport === 'rtmp' && !inputUrl.startsWith('rtmp://')) throw new Error('RTMP input must start with rtmp://.');

    return { id, transport, slot, label, inputUrl };
  }

  buildArgs(source) {
    const inputArgs = source.transport === 'test'
      ? [
          '-re', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
          '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000'
        ]
      : ['-fflags', '+genpts+discardcorrupt', '-flags', 'low_delay', '-i', source.ffmpegInputUrl || source.inputUrl];

    return [
      '-hide_banner', '-loglevel', 'info', '-nostdin',
      ...inputArgs,
      '-map', '0:v:0', '-map', source.transport === 'test' ? '1:a:0' : '0:a:0?',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
      '-profile:v', 'main', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-r', '30', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
      '-b:v', '2800k', '-maxrate', '3200k', '-bufsize', '1400k',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-f', 'hls', '-hls_time', '1', '-hls_list_size', '5',
      '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_flags', 'delete_segments+append_list+omit_endlist+independent_segments+program_date_time',
      '-hls_segment_filename', path.join(source.outputDir, 'segment-%06d.m4s'),
      path.join(source.outputDir, 'index.m3u8')
    ];
  }

  async start(config) {
    if (this.capabilities.status !== 'AVAILABLE') throw new Error(this.capabilities.detail);
    const normalized = this.validateConfig(config);
    if (this.sources.has(normalized.id)) await this.stop(normalized.id);
    const slotOwner = [...this.sources.values()].find(source =>
      source.id !== normalized.id
      && source.slot === normalized.slot
      && ['STARTING', 'ONLINE'].includes(source.status)
    );
    if (slotOwner) await this.stop(slotOwner.id);

    const outputDir = path.join(this.runtimeRoot, normalized.id);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const source = {
      ...normalized,
      outputDir,
      previewUrl: `/media/${normalized.id}/index.m3u8`,
      status: 'STARTING',
      startedAt: new Date().toISOString(),
      observedAt: new Date().toISOString(),
      detail: normalized.transport === 'test' ? 'Starting generated contribution test signal.' : `Waiting for ${normalized.transport.toUpperCase()} input lock.`,
      metrics: { frames: 0, fps: 0, bitrateKbps: 0, speed: 0 },
      process: null,
      bridgeProcess: null,
      bridgeShutdown: false,
      bridgeDetail: '',
      onlineTimer: null,
      lastMetricEmit: 0,
      stderrTail: ''
    };
    this.sources.set(source.id, source);
    this.emitUpdate();

    if (source.transport === 'srt' && this.capabilities.srtRuntime === 'VLC BRIDGE') {
      const slotOffset = [...VALID_SLOTS].indexOf(source.slot);
      const bridge = buildVlcSrtBridgeConfig(source.inputUrl, this.srtBridgeUdpBase + Math.max(0, slotOffset));
      source.ffmpegInputUrl = bridge.ffmpegInputUrl;
      source.bridgeDetail = `VLC ${bridge.mode.toUpperCase()} · ${bridge.latencyMs} ms`;
      source.detail = `Starting ${source.bridgeDetail} SRT bridge.`;
      const bridgeChild = spawn(this.vlcPath, bridge.args, { stdio: ['ignore', 'ignore', 'pipe'] });
      source.bridgeProcess = bridgeChild;
      bridgeChild.stderr.setEncoding('utf8');
      bridgeChild.stderr.on('data', chunk => {
        source.stderrTail = `${source.stderrTail}${chunk}`.slice(-4000);
      });
      bridgeChild.on('error', error => {
        source.status = 'FAILED';
        source.detail = `VLC SRT bridge failed: ${error.message}`;
        source.observedAt = new Date().toISOString();
        if (source.process && !source.process.killed) source.process.kill('SIGTERM');
        this.emitUpdate();
      });
      bridgeChild.on('close', (code, signal) => {
        source.bridgeProcess = null;
        if (source.status === 'STOPPED' || source.bridgeShutdown) return;
        source.status = 'FAILED';
        source.detail = `VLC SRT bridge exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}.`;
        source.observedAt = new Date().toISOString();
        if (source.process && !source.process.killed) source.process.kill('SIGTERM');
        this.emitUpdate();
      });
    }

    const child = spawn(this.ffmpegPath, this.buildArgs(source), { stdio: ['ignore', 'ignore', 'pipe'] });
    source.process = child;
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      source.stderrTail = `${source.stderrTail}${chunk}`.slice(-4000);
      chunk.split(/\r?\n|\r/).forEach(line => parseProgress(line, source));
      source.observedAt = new Date().toISOString();
      if (source.status === 'STARTING' && fs.existsSync(path.join(source.outputDir, 'index.m3u8'))) {
        source.status = 'ONLINE';
        source.detail = `${source.transport.toUpperCase()} contribution preview is online${source.bridgeDetail ? ` via ${source.bridgeDetail}` : ''}.`;
        this.emitUpdate();
      } else if (source.status === 'ONLINE' && Date.now() - source.lastMetricEmit >= 1000) {
        source.lastMetricEmit = Date.now();
        this.emitUpdate();
      }
    });
    child.on('error', error => {
      source.status = 'FAILED';
      source.detail = error.message;
      source.observedAt = new Date().toISOString();
      source.bridgeShutdown = true;
      if (source.bridgeProcess && !source.bridgeProcess.killed) source.bridgeProcess.kill('SIGTERM');
      this.emitUpdate();
    });
    child.on('close', (code, signal) => {
      if (source.onlineTimer) clearInterval(source.onlineTimer);
      source.process = null;
      source.observedAt = new Date().toISOString();
      if (source.status !== 'STOPPED') {
        source.status = code === 0 ? 'STOPPED' : 'FAILED';
        const errorLine = source.stderrTail.split(/\r?\n/).filter(Boolean).slice(-1)[0];
        source.detail = code === 0
          ? 'Contribution gateway stopped.'
          : `FFmpeg exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}${errorLine ? `: ${errorLine.slice(0, 180)}` : ''}`;
      }
      source.bridgeShutdown = true;
      if (source.bridgeProcess && !source.bridgeProcess.killed) source.bridgeProcess.kill('SIGTERM');
      this.emitUpdate();
    });

    source.onlineTimer = setInterval(() => {
      if (source.status === 'STARTING' && fs.existsSync(path.join(source.outputDir, 'index.m3u8'))) {
        source.status = 'ONLINE';
        source.detail = `${source.transport.toUpperCase()} contribution preview is online${source.bridgeDetail ? ` via ${source.bridgeDetail}` : ''}.`;
        source.observedAt = new Date().toISOString();
        this.emitUpdate();
      }
    }, 250);
    source.onlineTimer.unref?.();

    return this.publicState();
  }

  async stop(id) {
    const source = this.sources.get(String(id || ''));
    if (!source) return this.publicState();
    source.status = 'STOPPED';
    source.bridgeShutdown = true;
    source.detail = 'Contribution gateway stopped by operator.';
    source.observedAt = new Date().toISOString();
    if (source.onlineTimer) clearInterval(source.onlineTimer);
    if (source.process && !source.process.killed) {
      source.process.kill('SIGTERM');
      const forceTimer = setTimeout(() => {
        if (source.process && source.process.exitCode === null) source.process.kill('SIGKILL');
      }, 2000);
      forceTimer.unref?.();
    }
    if (source.bridgeProcess && !source.bridgeProcess.killed) {
      source.bridgeProcess.kill('SIGTERM');
      const bridgeForceTimer = setTimeout(() => {
        if (source.bridgeProcess && source.bridgeProcess.exitCode === null) source.bridgeProcess.kill('SIGKILL');
      }, 2000);
      bridgeForceTimer.unref?.();
    }
    this.emitUpdate();
    return this.publicState();
  }

  async stopAll() {
    await Promise.all([...this.sources.keys()].map(id => this.stop(id)));
  }

  resolveMediaPath(requestPath) {
    const relative = requestPath.replace(/^\/media\//, '');
    const resolved = path.resolve(this.runtimeRoot, relative);
    const containment = path.relative(this.runtimeRoot, resolved);
    return containment && !containment.startsWith('..') && !path.isAbsolute(containment) ? resolved : null;
  }
}

module.exports = { MediaGateway, buildVlcSrtBridgeConfig, probeFfmpeg, probeVlcSrt, redactInputUrl };
