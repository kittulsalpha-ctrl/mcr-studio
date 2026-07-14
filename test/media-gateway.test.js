const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MediaGateway, buildVlcSrtBridgeConfig, probeFfmpeg, probeVlcSrt, redactInputUrl } = require('../media-gateway');

function waitFor(predicate, timeoutMs = 8000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Condition was not met within ${timeoutMs}ms.`));
      }
    }, 100);
  });
}

test('redacts sensitive contribution URL values', () => {
  const redacted = redactInputUrl('srt://encoder.example:9001?mode=caller&passphrase=top-secret&streamid=feed-1');
  assert.match(redacted, /passphrase=REDACTED/);
  assert.match(redacted, /streamid=REDACTED/);
  assert.doesNotMatch(redacted, /top-secret|feed-1/);
});

test('reports installed FFmpeg transport capabilities truthfully', () => {
  const capability = probeFfmpeg(process.env.FFMPEG_PATH || 'ffmpeg');
  assert.ok(['AVAILABLE', 'UNAVAILABLE'].includes(capability.status));
  assert.equal(typeof capability.protocols.srt, 'boolean');
  assert.equal(typeof capability.protocols.rtmp, 'boolean');
});

test('reports VLC SRT bridge capability truthfully', () => {
  const capability = probeVlcSrt(process.env.VLC_PATH || '/Applications/VLC.app/Contents/MacOS/VLC');
  assert.ok(['AVAILABLE', 'UNAVAILABLE'].includes(capability.status));
});

test('builds an SRT listener bridge with normalized latency and loopback output', () => {
  const bridge = buildVlcSrtBridgeConfig('srt://0.0.0.0:9001?mode=listener&latency=200000&passphrase=secret-value&streamid=field-1', 12000);
  assert.equal(bridge.mode, 'listener');
  assert.equal(bridge.latencyMs, 200);
  assert.equal(bridge.ffmpegInputUrl, 'udp://127.0.0.1:12000?fifo_size=1000000&overrun_nonfatal=1');
  assert.ok(bridge.args.includes('srt://:9001'));
  assert.ok(bridge.args.includes('--passphrase=secret-value'));
  assert.ok(bridge.args.includes('--streamid=field-1'));
});

test('builds an SRT caller bridge with a remote endpoint', () => {
  const bridge = buildVlcSrtBridgeConfig('srt://encoder.example:9002?mode=caller&latency=250', 12001);
  assert.equal(bridge.mode, 'caller');
  assert.equal(bridge.latencyMs, 250);
  assert.ok(bridge.args.includes('srt://encoder.example:9002'));
});

test('keeps preview media paths inside the gateway runtime directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcr-gateway-path-'));
  const gateway = new MediaGateway({ root, ffmpegPath: 'missing-ffmpeg-for-path-test' });
  assert.equal(gateway.resolveMediaPath('/media/../outside.txt'), null);
  assert.equal(gateway.resolveMediaPath('/media/source/index.m3u8'), path.join(root, '.runtime', 'media', 'source', 'index.m3u8'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('generated contribution creates a live HLS preview and stops cleanly', { timeout: 15000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcr-gateway-'));
  const gateway = new MediaGateway({ root });
  t.after(async () => {
    await gateway.stopAll();
    fs.rmSync(root, { recursive: true, force: true });
  });

  if (gateway.capabilities.status !== 'AVAILABLE') {
    t.skip(gateway.capabilities.detail);
    return;
  }

  await gateway.start({
    id: 'test-main',
    label: 'Test Contribution',
    transport: 'test',
    slot: 'cam1'
  });
  await waitFor(() => gateway.publicState().sources[0]?.status === 'ONLINE');

  const source = gateway.publicState().sources[0];
  assert.equal(source.status, 'ONLINE');
  assert.equal(source.slot, 'cam1');
  assert.equal(source.transport, 'test');
  assert.ok(fs.existsSync(path.join(root, '.runtime', 'media', 'test-main', 'index.m3u8')));

  await gateway.stop('test-main');
  assert.equal(gateway.publicState().sources[0].status, 'STOPPED');
});
