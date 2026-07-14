const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MediaGateway, probeFfmpeg, redactInputUrl } = require('../media-gateway');

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
