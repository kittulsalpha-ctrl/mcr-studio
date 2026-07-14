const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { MediaGateway } = require('../media-gateway');

const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const vlcPath = process.env.VLC_PATH || '/Applications/VLC.app/Contents/MacOS/VLC';
const srtPort = Number(process.env.SRT_TEST_PORT || 19001);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcr-srt-loopback-'));
const sourcePath = path.join(root, 'source.ts');
let caller;
let gateway;

function waitFor(predicate, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`SRT preview did not reach ONLINE within ${timeoutMs} ms.`));
      }
    }, 150);
  });
}

async function cleanup() {
  if (caller && !caller.killed) caller.kill('SIGTERM');
  if (gateway) await gateway.stopAll();
  fs.rmSync(root, { recursive: true, force: true });
}

async function main() {
  if (!Number.isInteger(srtPort) || srtPort < 1024 || srtPort > 65535) {
    throw new Error('SRT_TEST_PORT must be an integer between 1024 and 65535.');
  }

  const generated = spawnSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=750:sample_rate=48000',
    '-t', '20', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '30',
    '-c:a', 'aac', '-b:a', '128k', '-f', 'mpegts', sourcePath
  ], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(generated.stderr?.trim() || 'Could not generate the SRT test source.');

  gateway = new MediaGateway({ root, ffmpegPath, vlcPath });
  if (!gateway.capabilities.protocols.srt) throw new Error(gateway.capabilities.detail);
  await gateway.start({
    id: 'srt-loopback',
    label: 'SRT Loopback Test',
    transport: 'srt',
    slot: 'cam1',
    inputUrl: `srt://0.0.0.0:${srtPort}?mode=listener&latency=200000`
  });

  const callerArgs = [
    '-I', 'dummy', '--no-video-title-show', '--play-and-exit', '--latency=200',
    sourcePath, '--sout', `#standard{access=srt,mux=ts,dst=127.0.0.1:${srtPort}}`
  ];
  caller = spawn(vlcPath, callerArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let callerLog = '';
  caller.stderr.setEncoding('utf8');
  caller.stderr.on('data', chunk => { callerLog = `${callerLog}${chunk}`.slice(-3000); });
  caller.on('error', error => { callerLog = `${callerLog}\n${error.message}`; });

  try {
    await waitFor(() => gateway.publicState().sources[0]?.status === 'ONLINE');
  } catch (error) {
    const failedSource = gateway.publicState().sources[0];
    const detail = failedSource?.detail || 'No gateway source detail was reported.';
    const callerDetail = callerLog.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
    throw new Error(`${error.message} Gateway: ${detail}${callerDetail ? ` Caller: ${callerDetail}` : ''}`);
  }
  const state = gateway.publicState();
  const source = state.sources[0];
  console.log(`SRT loopback ONLINE via ${state.capabilities.srtRuntime}`);
  console.log(`Preview: ${source.previewUrl}`);
  console.log(`Route: SRT listener :${srtPort} -> local bridge -> HLS`);
  console.log(`Metrics: ${Math.round(source.metrics.fps || 0)} fps, ${Math.round(source.metrics.bitrateKbps || 0)} kbps`);

  if (source.status !== 'ONLINE') throw new Error(callerLog || source.detail);
}

process.once('SIGINT', () => cleanup().finally(() => process.exit(130)));
process.once('SIGTERM', () => cleanup().finally(() => process.exit(143)));

main()
  .then(cleanup)
  .catch(async error => {
    console.error(`SRT loopback FAILED: ${error.message}`);
    await cleanup();
    process.exitCode = 1;
  });
