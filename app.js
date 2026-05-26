/* ==========================================================================
   CLOUD BROADCAST MCR STUDIO - APPLICATION ENGINE
   Pure ES6 Javascript - High Performance Canvas Graphics & Math Simulations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. STATE MANAGEMENT
  // ==========================================================================
  const state = {
    // Clock Systems
    localDrift: 0,
    
    // Telemetry Sliders
    lossPercent: 0.0,
    jitterMs: 5,
    rttMs: 25,
    bufferMs: 120,
    
    // SRT Metrics (Calculated dynamically)
    calculatedBw: 6.2, // Mbps
    unrecoveredLoss: 0.0, // %
    isUnderflow: false,
    
    // MCR Playout Routing
    activeSource: 'cam1', // 'cam1', 'cam2', 'vod', or 'ad'
    primaryFailed: false,
    
    // SCTE-35 Ad Splice
    adActive: false,
    adTimeRemaining: 0.0, // seconds
    adIntervalId: null,
    
    // Multi-Viewer Settings
    soloFeed: null, // null, or 'cam1', 'cam2', 'liveu3', 'liveu4', 'vod', 'pgm'
    mutedFeeds: {
      cam1: false,
      cam2: false,
      liveu3: false,
      liveu4: false,
      vod: false,
      pgm: false
    },
    
    // Console Logs
    logs: []
  };

  // ==========================================================================
  // 2. DOM ELEMENTS
  // ==========================================================================
  const el = {
    utcClock: document.getElementById('utc-clock'),
    localClock: document.getElementById('local-clock'),
    
    totalBw: document.getElementById('total-bw-value'),
    txRoute: document.getElementById('tx-route-value'),
    matrixAlarm: document.getElementById('matrix-alarm-value'),
    
    // Timecodes
    tcCam1: document.getElementById('tc-cam1'),
    tcCam2: document.getElementById('tc-cam2'),
    tcLiveu3: document.getElementById('tc-liveu3'),
    tcLiveu4: document.getElementById('tc-liveu4'),
    tcVod: document.getElementById('tc-vod'),
    tcPgm: document.getElementById('tc-pgm'),
    
    // Screen alarm overlays
    alarmOverlayCam1: document.getElementById('alarm-overlay-cam1'),
    adBreakBanner: document.getElementById('ad-break-banner'),
    adCountdownVal: document.getElementById('ad-countdown-val'),
    pgmActiveSource: document.getElementById('pgm-active-source'),
    pgmLatencyVal: document.getElementById('pgm-latency-val'),
    
    // Sliders & Telemetry UI
    slideLoss: document.getElementById('slide-loss'),
    slideJitter: document.getElementById('slide-jitter'),
    slideRtt: document.getElementById('slide-rtt'),
    slideBuffer: document.getElementById('slide-buffer'),
    
    valLoss: document.getElementById('val-loss'),
    valJitter: document.getElementById('val-jitter'),
    valRtt: document.getElementById('val-rtt'),
    valBuffer: document.getElementById('val-buffer'),
    
    overlayCam1Bw: document.getElementById('overlay-cam1-bw'),
    overlayCam1Rtt: document.getElementById('overlay-cam1-rtt'),
    overlayCam2Bw: document.getElementById('overlay-cam2-bw'),
    overlayCam2Rtt: document.getElementById('overlay-cam2-rtt'),
    overlayLiveu3Bw: document.getElementById('overlay-liveu3-bw'),
    overlayLiveu3Rtt: document.getElementById('overlay-liveu3-rtt'),
    overlayLiveu4Bw: document.getElementById('overlay-liveu4-bw'),
    overlayLiveu4Rtt: document.getElementById('overlay-liveu4-rtt'),
    
    recoBox: document.getElementById('reco-box'),
    recoIcon: document.getElementById('reco-icon'),
    recoText: document.getElementById('reco-text'),
    chartAlarmOverlay: document.getElementById('chart-alarm-overlay'),
    
    // Buttons
    btnFailPrimary: document.getElementById('btn-fail-primary'),
    btnRestorePrimary: document.getElementById('btn-restore-primary'),
    btnInjectScte: document.getElementById('btn-inject-scte'),
    btnCancelScte: document.getElementById('btn-cancel-scte'),
    
    // Logs
    consoleLogs: document.getElementById('console-logs'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    filterAll: document.getElementById('filter-all'),
    filterInfo: document.getElementById('filter-info'),
    filterWarning: document.getElementById('filter-warning'),
    filterAlarm: document.getElementById('filter-alarm'),
    
    // Node SVG elements
    rectSwitcher: document.getElementById('rect-switcher'),
    textSwitcherStatus: document.getElementById('text-switcher-status'),
    pathCam1: document.getElementById('path-cam1'),
    pathCam2: document.getElementById('path-cam2'),
    dotCam1: document.getElementById('dot-cam1'),
    dotCam2: document.getElementById('dot-cam2'),
    dotSwitch: document.getElementById('dot-switch'),
    dotTrans: document.getElementById('dot-trans'),
    inspectorText: document.getElementById('inspector-text'),
    
    // VU meters
    vu: {
      cam1L: document.getElementById('vu-cam1-l'),
      cam1R: document.getElementById('vu-cam1-r'),
      cam1LPeak: document.getElementById('vu-cam1-l-peak'),
      cam1RPeak: document.getElementById('vu-cam1-r-peak'),
      
      cam2L: document.getElementById('vu-cam2-l'),
      cam2R: document.getElementById('vu-cam2-r'),
      cam2LPeak: document.getElementById('vu-cam2-l-peak'),
      cam2RPeak: document.getElementById('vu-cam2-r-peak'),
      
      liveu3L: document.getElementById('vu-liveu3-l'),
      liveu3R: document.getElementById('vu-liveu3-r'),
      liveu3LPeak: document.getElementById('vu-liveu3-l-peak'),
      liveu3RPeak: document.getElementById('vu-liveu3-r-peak'),
      
      liveu4L: document.getElementById('vu-liveu4-l'),
      liveu4R: document.getElementById('vu-liveu4-r'),
      liveu4LPeak: document.getElementById('vu-liveu4-l-peak'),
      liveu4RPeak: document.getElementById('vu-liveu4-r-peak'),
      
      vodL: document.getElementById('vu-vod-l'),
      vodR: document.getElementById('vu-vod-r'),
      vodLPeak: document.getElementById('vu-vod-l-peak'),
      vodRPeak: document.getElementById('vu-vod-r-peak'),
      
      pgmL: document.getElementById('vu-pgm-l'),
      pgmR: document.getElementById('vu-pgm-r'),
      pgmLPeak: document.getElementById('vu-pgm-l-peak'),
      pgmRPeak: document.getElementById('vu-pgm-r-peak')
    }
  };

  // VU Peak values state helper
  const vuState = {
    cam1: { l: 0, r: 0, lp: 0, rp: 0 },
    cam2: { l: 0, r: 0, lp: 0, rp: 0 },
    liveu3: { l: 0, r: 0, lp: 0, rp: 0 },
    liveu4: { l: 0, r: 0, lp: 0, rp: 0 },
    vod:  { l: 0, r: 0, lp: 0, rp: 0 },
    pgm:  { l: 0, r: 0, lp: 0, rp: 0 }
  };

  // ==========================================================================
  // 3. BROADCAST CLOCKS & TIMECODES
  // ==========================================================================
  function updateClocks() {
    const now = new Date();
    
    // UTC Clock
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
    const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
    el.utcClock.textContent = `${utcHours}:${utcMinutes}:${utcSeconds}`;
    
    // Local Clock
    const localHours = String(now.getHours()).padStart(2, '0');
    const localMinutes = String(now.getMinutes()).padStart(2, '0');
    const localSeconds = String(now.getSeconds()).padStart(2, '0');
    el.localClock.textContent = `${localHours}:${localMinutes}:${localSeconds}`;
  }
  
  setInterval(updateClocks, 1000);
  updateClocks();

  // Timecode counters (SMPTE format HH:MM:SS:FF at 60fps)
  let framesCount = 0;
  function getSMPTETimecode(totalFrames) {
    const fps = 60;
    const f = totalFrames % fps;
    const s = Math.floor(totalFrames / fps) % 60;
    const m = Math.floor(totalFrames / (fps * 60)) % 60;
    const h = Math.floor(totalFrames / (fps * 60 * 60)) % 24;
    
    return [
      String(h).padStart(2, '0'),
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0'),
      String(f).padStart(2, '0')
    ].join(':');
  }

  // ==========================================================================
  // 4. REAL-TIME LOG SYSTEM
  // ==========================================================================
  function addLog(severity, tag, message) {
    const now = new Date();
    const timestamp = [
      String(now.getUTCHours()).padStart(2, '0'),
      String(now.getUTCMinutes()).padStart(2, '0'),
      String(now.getUTCSeconds()).padStart(2, '0')
    ].join(':') + ' UTC';

    const entry = { timestamp, severity, tag, message };
    state.logs.push(entry);
    
    // Keep last 100 logs
    if (state.logs.length > 100) state.logs.shift();
    
    renderLogs();
  }

  function renderLogs() {
    const activeFilter = document.querySelector('.btn-filter.filter-active').getAttribute('data-filter');
    el.consoleLogs.innerHTML = '';
    
    state.logs.forEach(log => {
      if (activeFilter !== 'all' && log.severity !== activeFilter) return;
      
      const logDiv = document.createElement('div');
      logDiv.className = `log-entry log-${log.severity}`;
      
      logDiv.innerHTML = `
        <span class="log-timestamp">[${log.timestamp}]</span>
        <span class="log-tag">${log.tag}:</span>
        <span class="log-msg">${log.message}</span>
      `;
      
      el.consoleLogs.appendChild(logDiv);
    });
    
    // Auto-scroll to bottom
    el.consoleLogs.scrollTop = el.consoleLogs.scrollHeight;
  }

  // Wire up log filters
  [el.filterAll, el.filterInfo, el.filterWarning, el.filterAlarm].forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-filter').forEach(f => f.classList.remove('filter-active'));
      e.target.classList.add('filter-active');
      renderLogs();
    });
  });

  el.btnClearLogs.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });

  // Initialize with typical professional playout console messages
  addLog('info', 'SYSTEM', 'MCR Studio Engine Core initialized successfully.');
  addLog('info', 'ROUTE', 'AWS MediaConnect Flow configuration loaded: Primary=us-east-1, Secondary=us-east-2.');
  addLog('info', 'SRT', 'Primary contribution SRT socket listening on port 9001.');
  addLog('info', 'SRT', 'Secondary contribution SRT socket listening on port 9002.');
  addLog('info', 'SRT', 'Camera-01 stream connected (Bitrate: 6.2 Mbps, Codec: HEVC/H.265 Main10 Profile).');
  addLog('info', 'SRT', 'Camera-02 stream connected (Bitrate: 5.8 Mbps, Codec: AVC/H.264 High Profile).');
  addLog('info', 'PLYT', 'Playout Engine active. Scheduling pool loaded from AWS S3 VOD asset repository.');
  addLog('info', 'TRANS', 'AWS MediaLive active-active transcoders initialized (Output: AVC 1080p60 8.0Mbps HLS/DASH).');
  addLog('info', 'CDN', 'Edge CDN cache validation complete. Latency buffer optimal at edge locations.');

  // ==========================================================================
  // 5. CANVAS VIDEO STREAM RENDERING ENGINE
  // ==========================================================================
  const canvases = {
    cam1: { element: document.getElementById('canvas-cam1'), ctx: document.getElementById('canvas-cam1').getContext('2d') },
    cam2: { element: document.getElementById('canvas-cam2'), ctx: document.getElementById('canvas-cam2').getContext('2d') },
    liveu3: { element: document.getElementById('canvas-liveu3'), ctx: document.getElementById('canvas-liveu3').getContext('2d') },
    liveu4: { element: document.getElementById('canvas-liveu4'), ctx: document.getElementById('canvas-liveu4').getContext('2d') },
    vod:  { element: document.getElementById('canvas-vod'),  ctx: document.getElementById('canvas-vod').getContext('2d') },
    pgm:  { element: document.getElementById('canvas-pgm'),  ctx: document.getElementById('canvas-pgm').getContext('2d') }
  };

  // Adjust canvas size to internal dimensions
  function resizeCanvases() {
    Object.values(canvases).forEach(c => {
      const rect = c.element.parentNode.getBoundingClientRect();
      c.element.width = rect.width;
      c.element.height = rect.height;
    });
  }
  
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  // Canvas Drawing Patterns
  let angle = 0;
  
  function drawStreamCam1(ctx, w, h, frames, loss) {
    // Camera 01 (Primary SRT): Futuristic Wireframe grid & moving components
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, w, h);
    
    // Rotating Wireframe Grid
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle * 0.1);
    
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.lineWidth = 1;
    const gridSpacing = 25;
    const gridBound = Math.max(w, h) * 1.5;
    
    for (let x = -gridBound; x < gridBound; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, -gridBound);
      ctx.lineTo(x, gridBound);
      ctx.stroke();
    }
    for (let y = -gridBound; y < gridBound; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(-gridBound, y);
      ctx.lineTo(gridBound, y);
      ctx.stroke();
    }
    ctx.restore();

    // Central crosshair & tech elements
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40 + Math.sin(frames * 0.05) * 5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, h / 2); ctx.lineTo(w / 2 - 20, h / 2);
    ctx.moveTo(w / 2 + 20, h / 2); ctx.lineTo(w / 2 + 60, h / 2);
    ctx.moveTo(w / 2, h / 2 - 40); ctx.lineTo(w / 2, h / 2 - 15);
    ctx.moveTo(w / 2, h / 2 + 15); ctx.lineTo(w / 2, h / 2 + 40);
    ctx.stroke();

    // Technical diagnostic circles
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 80 + Math.cos(frames * 0.03) * 10, 0, Math.PI * 2);
    ctx.stroke();

    // Dynamic wave representation of "captured stream"
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x += 5) {
      const y = h / 2 + Math.sin(x * 0.02 + frames * 0.1) * 15 * Math.sin(frames * 0.02);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Overlay scanline
    const scanlineY = (frames * 3.5) % h;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
    ctx.fillRect(0, scanlineY, w, 4);

    // Dynamic Text overlays inside video
    ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.font = '10px Fira Code';
    ctx.fillText(`CAM-01 / contribution`, 15, 25);
    ctx.fillText(`TRANSIT: US-EAST-1`, 15, 40);
    
    // Inject visual glitches if packet loss exceeds SRT recoverability
    if (loss > 0) {
      // Draw random glitch bars
      const glitchChance = loss * 0.04;
      if (Math.random() < glitchChance) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 210, 255, 0.5)';
        const glitchY = Math.random() * h;
        const glitchH = Math.random() * 20 + 5;
        const shiftX = (Math.random() - 0.5) * 30;
        
        ctx.drawImage(ctx.canvas, 0, glitchY, w, glitchH, shiftX, glitchY, w, glitchH);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = '12px Fira Code';
        ctx.fillText("SRT PACKET DROP", w / 2 - 50, h / 2 + 70);
      }
    }
  }

  function drawStreamCam2(ctx, w, h, frames) {
    // Camera 02 (Backup SRT): Concentric expanding rings / geometric vectors
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);
    
    // Expanding rings from three focus nodes
    const nodeX = w / 2;
    const nodeY = h / 2;
    
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.15)';
    ctx.lineWidth = 1;
    
    for (let r = 20; r < w * 0.8; r += 40) {
      const radius = (r + frames * 0.6) % (w * 0.8);
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer rotating constellation elements
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-angle * 0.05);
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)';
    ctx.strokeRect(-40, -40, 80, 80);
    ctx.restore();

    // Telemetry text overlay
    ctx.fillStyle = 'rgba(0, 210, 255, 0.8)';
    ctx.font = '10px Fira Code';
    ctx.fillText(`CAM-02 / standby path`, 15, 25);
    ctx.fillText(`TRANSIT: US-EAST-2`, 15, 40);

    // Moving signal vectors (sine curves)
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 8) {
      const y = h / 2 + Math.cos(x * 0.03 - frames * 0.08) * 12;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawStreamVOD(ctx, w, h, frames) {
    // Playout/VOD: Classic SMPTE-style broadcast test bars with scrolling banner
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // SMPTE Color Bars layout (7 columns)
    const colors = [
      '#ffffff', // Gray/White
      '#c0c000', // Yellow
      '#00c0c0', // Cyan
      '#00c000', // Green
      '#c000c0', // Magenta
      '#c00000', // Red
      '#0000c0'  // Blue
    ];
    
    const colW = w / 7;
    
    // Top 75% height colors bars
    const topH = h * 0.7;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(i * colW, 0, colW + 1, topH);
    }

    // Lower 15% height reverse colors or patterns
    const midH = h * 0.85;
    const revColors = [
      '#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#ffffff'
    ];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = revColors[i];
      ctx.fillRect(i * colW, topH, colW + 1, midH - topH);
    }

    // Bottom 15% custom gray gradient and solid black blocks
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, midH, w, h - midH);
    
    // Overlay scrolling ticker in the bottom block
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, midH + 2, w, (h - midH) - 4);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Inter';
    
    const tickerText = "ANTIGRAVITY PLYOUT CORE ENGINE OK • ACTIVE-ACTIVE TRANSIT FLOW • HLS CACHE SYNCED • INJECT SCTE-35 SPLICE TO TEST ADS LOOP • ";
    const textWidth = ctx.measureText(tickerText).width;
    const scrollX = (frames * 1.2) % textWidth;
    
    ctx.fillText(tickerText, -scrollX, midH + 12);
    ctx.fillText(tickerText, -scrollX + textWidth, midH + 12);

    // Overlay text labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 9px Outfit';
    ctx.fillText("MCR_VOD_ASSET_1092", 15, 25);
  }

  function drawStreamAdBreak(ctx, w, h, frames) {
    // Custom beautiful ad break screen representation
    ctx.fillStyle = '#110718';
    ctx.fillRect(0, 0, w, h);
    
    // Outer rotating helix
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle * 0.2);
    
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-50, -50, 100, 100);
    }
    ctx.restore();

    // Pulse core circle
    ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40 + Math.sin(frames * 0.1) * 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'var(--neon-pink)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40 + Math.sin(frames * 0.1) * 8, 0, Math.PI * 2);
    ctx.stroke();

    // Text labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("SPONSOR AD SEGMENT", w / 2, h / 2 + 4);
    
    ctx.font = '9px Fira Code';
    ctx.fillStyle = 'var(--neon-pink)';
    ctx.fillText("COMMERCIAL PLYOUT IN PROGRESS", w / 2, h / 2 + 75);
    ctx.textAlign = 'left'; // Reset alignment
  }

  function drawStreamLossStatic(ctx, w, h) {
    // High-performance television static noise
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    const len = data.length;
    
    for (let i = 0; i < len; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i]     = val; // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 255; // Alpha
    }
    ctx.putImageData(imgData, 0, 0);

    // Large glowing warning block overlay
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.fillRect(w / 2 - 100, h / 2 - 25, 200, 50);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w / 2 - 96, h / 2 - 21, 192, 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("INPUT LOSS DETECTED", w / 2, h / 2 - 2);
    
    ctx.font = '8px Fira Code';
    ctx.fillText("SRT SOCKET TIMEOUT: A-Path Fail", w / 2, h / 2 + 13);
    ctx.textAlign = 'left'; // Reset
  }

  // ==========================================================================
  // 6. REAL-TIME AUDIO VU METER PHYSICS SIMULATION
  // ==========================================================================
  function updateVUMeters() {
    // Simulate stereo volume values with minor random walk
    
    // Active streams generate noise. Failed/Muted streams remain flat (0)
    function generateVUValues(feed, isActive, isMuted) {
      const target = vuState[feed];
      
      if (!isActive || isMuted) {
        target.l = 0;
        target.r = 0;
      } else {
        // Program gets active source audio
        let signalL = 0.5 + Math.sin(framesCount * 0.05) * 0.2 + Math.random() * 0.15;
        let signalR = 0.5 + Math.cos(framesCount * 0.06) * 0.2 + Math.random() * 0.15;
        
        // Random volume fluctuations (dynamics)
        if (feed === 'vod') {
          // VOD represents continuous synthesized music
          signalL = 0.6 + Math.sin(framesCount * 0.02) * 0.25 + Math.random() * 0.1;
          signalR = 0.6 + Math.cos(framesCount * 0.02 + 0.5) * 0.25 + Math.random() * 0.1;
        } else if (feed === 'cam2') {
          // Standby drift
          signalL = 0.4 + Math.sin(framesCount * 0.04) * 0.15 + Math.random() * 0.1;
          signalR = 0.4 + Math.cos(framesCount * 0.04) * 0.15 + Math.random() * 0.1;
        }
        
        // Apply SRT glitch degradation if underflow active
        if (feed === 'cam1' && state.isUnderflow) {
          if (Math.random() < 0.25) {
            signalL = 0; // Audio dropouts!
            signalR = 0;
          }
        }
        
        target.l = Math.max(0.01, Math.min(0.99, signalL));
        target.r = Math.max(0.01, Math.min(0.99, signalR));
      }
      
      // Decay peak indicators slowly
      target.lp = Math.max(target.l, target.lp - 0.006);
      target.rp = Math.max(target.r, target.rp - 0.006);
    }

    // Cam 1 status
    generateVUValues('cam1', !state.primaryFailed, state.mutedFeeds.cam1);
    // Cam 2 status
    generateVUValues('cam2', true, state.mutedFeeds.cam2);
    // VOD status
    generateVUValues('vod', true, state.mutedFeeds.vod);
    
    // PGM status follows the active playout source
    let pgmActive = true;
    let pgmMuted = state.mutedFeeds.pgm;
    
    if (state.activeSource === 'cam1' && state.primaryFailed) {
      pgmActive = false; // No audio if source is failed and no backup configured
    }
    
    if (pgmMuted) {
      vuState.pgm.l = 0;
      vuState.pgm.r = 0;
      vuState.pgm.lp = Math.max(0, vuState.pgm.lp - 0.008);
      vuState.pgm.rp = Math.max(0, vuState.pgm.rp - 0.008);
    } else {
      let activeSourceVU = vuState.cam1;
      if (state.activeSource === 'cam2') activeSourceVU = vuState.cam2;
      else if (state.activeSource === 'vod') activeSourceVU = vuState.vod;
      else if (state.activeSource === 'ad') {
        // Custom active ad audio
        const adL = 0.7 + Math.sin(framesCount * 0.1) * 0.1 + Math.random() * 0.1;
        const adR = 0.7 + Math.cos(framesCount * 0.1) * 0.1 + Math.random() * 0.1;
        vuState.pgm.l = Math.min(0.99, adL);
        vuState.pgm.r = Math.min(0.99, adR);
        vuState.pgm.lp = Math.max(vuState.pgm.l, vuState.pgm.lp - 0.006);
        vuState.pgm.rp = Math.max(vuState.pgm.r, vuState.pgm.rp - 0.006);
      }
      
      if (state.activeSource !== 'ad') {
        vuState.pgm.l = activeSourceVU.l;
        vuState.pgm.r = activeSourceVU.r;
        vuState.pgm.lp = activeSourceVU.lp;
        vuState.pgm.rp = activeSourceVU.rp;
      }
    }

    // Apply UI rendering updates
    function renderVUChannel(lEl, rEl, lpEl, rpEl, feedVU) {
      lEl.style.height = `${feedVU.l * 100}%`;
      rEl.style.height = `${feedVU.r * 100}%`;
      lpEl.style.bottom = `${feedVU.lp * 100}%`;
      rpEl.style.bottom = `${feedVU.rp * 100}%`;
    }

    renderVUChannel(el.vu.cam1L, el.vu.cam1R, el.vu.cam1LPeak, el.vu.cam1RPeak, vuState.cam1);
    renderVUChannel(el.vu.cam2L, el.vu.cam2R, el.vu.cam2LPeak, el.vu.cam2RPeak, vuState.cam2);
    renderVUChannel(el.vu.liveu3L, el.vu.liveu3R, el.vu.liveu3LPeak, el.vu.liveu3RPeak, vuState.liveu3);
    renderVUChannel(el.vu.liveu4L, el.vu.liveu4R, el.vu.liveu4LPeak, el.vu.liveu4RPeak, vuState.liveu4);
    renderVUChannel(el.vu.vodL,  el.vu.vodR,  el.vu.vodLPeak,  el.vu.vodRPeak,  vuState.vod);
    renderVUChannel(el.vu.pgmL,  el.vu.pgmR,  el.vu.pgmLPeak,  el.vu.pgmRPeak,  vuState.pgm);
  }

  // ==========================================================================
  // 7. CORE TICK RENDER LOOP
  // ==========================================================================
  function renderLoop() {
    framesCount++;
    angle += 0.05;

    // Timecode Updates
    el.tcCam1.textContent = state.primaryFailed ? "00:00:00:00" : getSMPTETimecode(framesCount);
    // Standby has a small simulated sync drift (-2 frames)
    el.tcCam2.textContent = getSMPTETimecode(framesCount - 2);
    // LiveU 3 & 4 with varied network drift
    el.tcLiveu3.textContent = getSMPTETimecode(framesCount - 3);
    el.tcLiveu4.textContent = getSMPTETimecode(framesCount - 4);
    // VOD loops
    el.tcVod.textContent = getSMPTETimecode(framesCount % (60 * 60 * 2)); // Loop every 2 minutes
    
    // PGM timecode reflects currently routed active source
    if (state.activeSource === 'cam1') el.tcPgm.textContent = el.tcCam1.textContent;
    else if (state.activeSource === 'cam2') el.tcPgm.textContent = el.tcCam2.textContent;
    else if (state.activeSource === 'vod') el.tcPgm.textContent = el.tcVod.textContent;
    else if (state.activeSource === 'ad') el.tcPgm.textContent = getSMPTETimecode(framesCount);

    // 1. Draw Feed 1 (Cam 1 / Primary)
    if (state.primaryFailed) {
      drawStreamLossStatic(canvases.cam1.ctx, canvases.cam1.element.width, canvases.cam1.element.height);
    } else {
      drawStreamCam1(canvases.cam1.ctx, canvases.cam1.element.width, canvases.cam1.element.height, framesCount, state.unrecoveredLoss);
    }

    // 2. Draw Feed 2 (Cam 2 / Backup)
    drawStreamCam2(canvases.cam2.ctx, canvases.cam2.element.width, canvases.cam2.element.height, framesCount);

    // 3. Draw Feed 3 (LiveU 3)
    drawStreamCam2(canvases.liveu3.ctx, canvases.liveu3.element.width, canvases.liveu3.element.height, framesCount);

    // 4. Draw Feed 4 (LiveU 4)
    drawStreamCam2(canvases.liveu4.ctx, canvases.liveu4.element.width, canvases.liveu4.element.height, framesCount);

    // 5. Draw Feed 5 (VOD Playout)
    drawStreamVOD(canvases.vod.ctx, canvases.vod.element.width, canvases.vod.element.height, framesCount);

    // 6. Draw Feed 6 (Program Out / PGM)
    const pgmW = canvases.pgm.element.width;
    const pgmH = canvases.pgm.element.height;
    const pgmCtx = canvases.pgm.ctx;

    if (state.activeSource === 'ad') {
      drawStreamAdBreak(pgmCtx, pgmW, pgmH, framesCount);
    } else if (state.activeSource === 'cam1') {
      if (state.primaryFailed) {
        // If primary failed and switcher did NOT failover (should not happen normally unless disaster manual override)
        drawStreamLossStatic(pgmCtx, pgmW, pgmH);
      } else {
        drawStreamCam1(pgmCtx, pgmW, pgmH, framesCount, state.unrecoveredLoss);
      }
    } else if (state.activeSource === 'cam2') {
      drawStreamCam2(pgmCtx, pgmW, pgmH, framesCount);
    } else if (state.activeSource === 'vod') {
      drawStreamVOD(pgmCtx, pgmW, pgmH, framesCount);
    }

    // 5. Update Stereo VU meters
    updateVUMeters();

    // 6. Loop
    requestAnimationFrame(renderLoop);
  }

  // Start loop immediately
  requestAnimationFrame(renderLoop);

  // ==========================================================================
  // 8. TELEMETRY & SRT SIMULATION ENGINE
  // ==========================================================================
  
  // Custom rolling line chart configuration
  const chartCanvas = document.getElementById('telemetry-chart');
  const chartCtx = chartCanvas.getContext('2d');
  
  // Rolling historical arrays
  const chartHistory = {
    bw: Array(60).fill(6.2),
    loss: Array(60).fill(0.0),
    jitter: Array(60).fill(5)
  };

  function updateSRTSimulation() {
    // Read current slider inputs
    state.lossPercent = parseFloat(el.slideLoss.value);
    state.jitterMs = parseInt(el.slideJitter.value);
    state.rttMs = parseInt(el.slideRtt.value);
    state.bufferMs = parseInt(el.slideBuffer.value);

    // Update Slider Displays
    el.valLoss.textContent = `${state.lossPercent.toFixed(1)}%`;
    el.valJitter.textContent = `${state.jitterMs}ms`;
    el.valRtt.textContent = `${state.rttMs}ms`;
    el.valBuffer.textContent = `${state.bufferMs}ms`;

    // SRT packet recovery simulation formula:
    // Packet recovery is perfect in SRT ARQ (Automatic Repeat Request) provided the buffer window 
    // is large enough to request retransmission, receive the packet, and process it under jitter constraints.
    // Minimum theoretical buffer required = 4 * RTT + Jitter margin
    const minSafeBuffer = 3.5 * state.rttMs + state.jitterMs * 2.2;
    
    // Simulate bandwidth drop if packet loss gets extremely high
    state.calculatedBw = Math.max(1.8, 6.2 - (state.lossPercent * 0.15) - (state.jitterMs * 0.015));
    
    // Update stream overlay texts
    if (!state.primaryFailed) {
      el.overlayCam1Bw.textContent = `${state.calculatedBw.toFixed(1)} Mbps`;
      el.overlayCam1Rtt.textContent = `${state.rttMs}ms`;
      el.totalBw.textContent = `${(state.calculatedBw + 5.8 + 4.5).toFixed(1)} Mbps`;
    } else {
      el.overlayCam1Bw.textContent = `0.0 Mbps`;
      el.overlayCam1Rtt.textContent = `0ms`;
      el.totalBw.textContent = `${(5.8 + 4.5).toFixed(1)} Mbps`;
    }
    el.overlayCam2Rtt.textContent = `${state.rttMs}ms`;

    if (state.lossPercent === 0) {
      state.unrecoveredLoss = 0.0;
      state.isUnderflow = false;
    } else {
      // If buffer is below the safe threshold, unrecovered loss kicks in exponentially
      if (state.bufferMs < minSafeBuffer) {
        const ratio = (minSafeBuffer - state.bufferMs) / minSafeBuffer;
        state.unrecoveredLoss = state.lossPercent * ratio;
      } else {
        state.unrecoveredLoss = 0.0;
      }
      
      // Buffer underflow alarm triggers if unrecovered loss exceeds 0.4%
      state.isUnderflow = state.unrecoveredLoss > 0.4;
    }

    // Recommendation System UI Updates
    if (state.primaryFailed) {
      el.recoBox.className = "recommendation-box reco-danger";
      el.recoIcon.className = "reco-icon text-red";
      el.recoIcon.textContent = "⚠";
      el.recoText.textContent = "ALERT: Primary contribution path failed. Active-Active failover triggered. Inspect CAM-01 hardware logs.";
    } else if (state.isUnderflow) {
      el.recoBox.className = "recommendation-box reco-danger";
      el.recoIcon.className = "reco-icon text-red";
      el.recoIcon.textContent = "⚠";
      el.recoText.textContent = `CRITICAL UNDERFLOW: SRT buffer underflow detected! Packets are arriving late and being discarded. Re-configure the SRT Latency Buffer to at least ${Math.round(minSafeBuffer)}ms (4x RTT + jitter margin).`;
      el.chartAlarmOverlay.classList.add('alarm-active');
      el.matrixAlarm.textContent = "UNDERFLOW";
      el.matrixAlarm.className = "badge-value text-red pulse-red";
    } else if (state.bufferMs < minSafeBuffer * 1.25) {
      el.recoBox.className = "recommendation-box reco-warning";
      el.recoIcon.className = "reco-icon text-amber";
      el.recoIcon.textContent = "⚠";
      el.recoText.textContent = `WARNING: Latency buffer margin is narrow. Under unstable network conditions, packet dropouts could occur. Recommended minimum buffer: ${Math.round(minSafeBuffer * 1.2)}ms.`;
      el.chartAlarmOverlay.classList.remove('alarm-active');
      el.matrixAlarm.textContent = "STABILITY WARN";
      el.matrixAlarm.className = "badge-value text-amber";
    } else {
      el.recoBox.className = "recommendation-box";
      el.recoIcon.className = "reco-icon text-green";
      el.recoIcon.textContent = "✓";
      el.recoText.textContent = `SRT CONFIG OPTIMAL. Latency buffer (${state.bufferMs}ms) offers a high stability envelope. Packets are fully recovered via SRT ARQ. Minimum safe buffer: ${Math.round(minSafeBuffer)}ms.`;
      el.chartAlarmOverlay.classList.remove('alarm-active');
      el.matrixAlarm.textContent = "OK";
      el.matrixAlarm.className = "badge-value text-green";
    }

    // Trigger underflow logs periodically to prevent spamming
    if (state.isUnderflow && Math.random() < 0.05) {
      addLog('alarm', 'SRT', `Buffer underflow! Unrecovered packets: ${state.unrecoveredLoss.toFixed(1)}%. Late packets dropped.`);
    }
  }

  // Sync sliders to simulation
  [el.slideLoss, el.slideJitter, el.slideRtt, el.slideBuffer].forEach(slider => {
    slider.addEventListener('input', updateSRTSimulation);
  });

  // Roll historical arrays for charts (every 200ms)
  setInterval(() => {
    // BW roll
    chartHistory.bw.shift();
    chartHistory.bw.push(state.primaryFailed ? 0.0 : state.calculatedBw);
    
    // Loss roll
    chartHistory.loss.shift();
    chartHistory.loss.push(state.lossPercent);
    
    // Jitter roll
    chartHistory.jitter.shift();
    chartHistory.jitter.push(state.jitterMs);
    
    drawChart();
  }, 200);

  // Canvas Telemetry Chart Renderer
  function drawChart() {
    const w = chartCanvas.width = chartCanvas.parentNode.getBoundingClientRect().width;
    const h = chartCanvas.height = chartCanvas.parentNode.getBoundingClientRect().height;
    
    chartCtx.clearRect(0, 0, w, h);
    
    // Draw grid lines
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    chartCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(w, y);
      chartCtx.stroke();
    }
    
    // Function to draw a line graph
    function drawLine(data, maxVal, strokeColor) {
      chartCtx.strokeStyle = strokeColor;
      chartCtx.lineWidth = 1.8;
      chartCtx.beginPath();
      
      const len = data.length;
      const stepX = w / (len - 1);
      
      for (let i = 0; i < len; i++) {
        const x = i * stepX;
        // Bound/Map value to canvas height
        const valRatio = Math.min(1, data[i] / maxVal);
        const y = h - (valRatio * (h - 10)) - 5;
        
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();
      
      // Fill gradient underneath
      chartCtx.lineTo(w, h);
      chartCtx.lineTo(0, h);
      chartCtx.closePath();
      const grad = chartCtx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, strokeColor.replace('1)', '0.08)'));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      chartCtx.fillStyle = grad;
      chartCtx.fill();
    }

    // 1. Draw BW line (green) - scale Max 10 Mbps
    drawLine(chartHistory.bw, 10, 'rgba(16, 185, 129, 1)');
    
    // 2. Draw Loss line (red) - scale Max 20%
    drawLine(chartHistory.loss, 20, 'rgba(239, 68, 68, 1)');
    
    // 3. Draw Jitter line (amber) - scale Max 100ms
    drawLine(chartHistory.jitter, 100, 'rgba(245, 158, 11, 1)');
  }

  // Initialize Simulator state
  updateSRTSimulation();

  // ==========================================================================
  // 9. DISASTER RECOVERY & PLayout ACTIONS
  // ==========================================================================
  
  // Fail Primary contribution path
  el.btnFailPrimary.addEventListener('click', () => {
    state.primaryFailed = true;
    el.btnFailPrimary.disabled = true;
    el.btnRestorePrimary.disabled = false;
    
    // Activate Alarm overlays on screen and node graph
    el.alarmOverlayCam1.classList.add('alarm-active');
    
    // Update quick badges
    el.matrixAlarm.textContent = "ALARM: FAIL";
    el.matrixAlarm.className = "badge-value text-red pulse-red";
    
    // Break node link on SVG
    el.pathCam1.classList.remove('link-active');
    el.pathCam1.classList.add('link-broken');
    el.dotCam1.style.display = 'none';

    // Log failure
    addLog('alarm', 'SRT', 'Primary contribution encoder connection lost! SRT Socket connection timeout.');
    addLog('warning', 'SWT', 'ST 2022-7 Switcher detected packet flatline on Path A (us-east-1).');

    // Trigger seamless failover switch inside 350ms
    setTimeout(() => {
      if (state.primaryFailed) { // Double check if already restored
        state.activeSource = 'cam2'; // Route backup Cam
        el.pgmActiveSource.textContent = "SOURCE: CAM-02 (DR FAILOVER)";
        el.txRoute.textContent = "BACKUP";
        el.txRoute.className = "badge-value text-blue";
        
        // Update switcher SVG node badge
        el.textSwitcherStatus.textContent = "BACKUP PATH";
        el.textSwitcherStatus.setAttribute('fill', '#00d2ff');
        el.rectSwitcher.setAttribute('stroke', '#00d2ff');
        
        // Log switch
        addLog('alarm', 'SWT', 'Switcher input switched automatically: Path A (failed) ➔ Path B (active backup).');
        addLog('info', 'ROUTE', 'Program out seamless failover successful. No visual frame drop (glitch-free).');
      }
    }, 350);

    updateSRTSimulation();
  });

  // Restore Primary contribution path
  el.btnRestorePrimary.addEventListener('click', () => {
    state.primaryFailed = false;
    el.btnFailPrimary.disabled = false;
    el.btnRestorePrimary.disabled = true;
    
    // Remove alarm overlays
    el.alarmOverlayCam1.classList.remove('alarm-active');
    
    // Restore SVG links
    el.pathCam1.classList.remove('link-broken');
    el.pathCam1.classList.add('link-active');
    el.dotCam1.style.display = 'block';

    addLog('info', 'SRT', 'SRT Contribution Socket re-established. Port 9001 handshake complete.');
    addLog('info', 'SRT', 'Camera-01 stream restored (Bitrate: 6.2 Mbps, Codec: HEVC).');

    // Return switcher back to Primary source (with 1.5s stabilization delay)
    setTimeout(() => {
      if (!state.primaryFailed) {
        state.activeSource = 'cam1';
        el.pgmActiveSource.textContent = "SOURCE: CAM-01";
        el.txRoute.textContent = "PRIMARY";
        el.txRoute.className = "badge-value text-blue";
        
        el.textSwitcherStatus.textContent = "PRIMARY";
        el.textSwitcherStatus.setAttribute('fill', '#10b981');
        el.rectSwitcher.setAttribute('stroke', '#10b981');
        
        addLog('info', 'SWT', 'Stabilization window complete. Switcher reverted back: Path B ➔ Path A (Primary).');
      }
    }, 1500);

    updateSRTSimulation();
  });

  // SCTE-35 Cue ad insertion injector
  el.btnInjectScte.addEventListener('click', () => {
    if (state.adActive) return;
    
    state.adActive = true;
    state.adTimeRemaining = 30.0;
    el.btnInjectScte.disabled = true;
    el.btnCancelScte.disabled = false;
    
    // Update active source to ad break loop
    state.activeSource = 'ad';
    el.pgmActiveSource.textContent = "SOURCE: AD-LOOP (SCTE-35)";
    
    // Show countdown banner on PGM screen
    el.adBreakBanner.style.display = 'block';
    
    // Animate VOD link dashboard lines
    el.pathCam1.classList.add('link-standby');
    el.pathCam2.classList.add('link-standby');
    
    // Logs
    addLog('info', 'SCTE', 'SCTE-35 Digital Program Insertion triggered. Event ID: 4092. Out-Of-Network Splice=TRUE.');
    addLog('info', 'PLYT', 'Splice-In SCTE Splice received. Swapping Program Out route to ad-insertion engine.');

    // Countdown Interval
    state.adIntervalId = setInterval(() => {
      state.adTimeRemaining -= 0.1;
      
      if (state.adTimeRemaining <= 0) {
        clearInterval(state.adIntervalId);
        endAdBreak();
      } else {
        el.adCountdownVal.textContent = `AD BREAK: ${state.adTimeRemaining.toFixed(1)}s`;
      }
    }, 100);
  });

  // Cancel SCTE splice
  el.btnCancelScte.addEventListener('click', () => {
    if (!state.adActive) return;
    
    clearInterval(state.adIntervalId);
    addLog('warning', 'SCTE', 'SCTE-35 splice countdown aborted manually by Master Engineer.');
    endAdBreak();
  });

  function endAdBreak() {
    state.adActive = false;
    state.adTimeRemaining = 0.0;
    el.btnInjectScte.disabled = false;
    el.btnCancelScte.disabled = true;
    
    // Hide overlay
    el.adBreakBanner.style.display = 'none';
    
    // Restore program route
    if (state.primaryFailed) {
      state.activeSource = 'cam2';
      el.pgmActiveSource.textContent = "SOURCE: CAM-02 (DR FAILOVER)";
    } else {
      state.activeSource = 'cam1';
      el.pgmActiveSource.textContent = "SOURCE: CAM-01";
    }

    el.pathCam1.classList.remove('link-standby');
    el.pathCam2.classList.remove('link-standby');
    
    addLog('info', 'SCTE', 'SCTE-35 Splice-Out command injected. Event ID: 4092 (Out-of-Network complete).');
    addLog('info', 'PLYT', 'Program routing returned successfully to Contribution feed.');
  }

  // ==========================================================================
  // 10. MULTI-VIEWER BUTTONS CONTROL (SOLO / MUTE / CONFIG INTERACTIVE)
  // ==========================================================================
  
  // Interactive Node selection clicks on SVG
  const nodeCards = [
    { id: 'node-card-cam1', text: '<strong class="text-green">Camera-01 Source</strong>: Primary Contribution SRT Feed. Transmitting from on-prem hardware encoder via us-east-1 gateways.' },
    { id: 'node-card-cam2', text: '<strong class="text-blue">Camera-02 Source</strong>: Secondary Contribution SRT Feed. Transmitting from standby cloud encoder via us-east-2 gateways.' },
    { id: 'node-card-switcher', text: '<strong class="text-green">Seamless Switcher (SMPTE ST 2022-7)</strong>: Provides hitless active-active failover protection. Real-time path switching within a 50ms buffer envelope.' },
    { id: 'node-card-transcoder', text: '<strong class="text-blue">AWS MediaLive Transcoder</strong>: Transcodes contribution streams from HEVC/H.265 (High Bitrate contribution) down to H.264 (Distribution Profiles) dynamically.' },
    { id: 'node-card-cdn', text: '<strong class="text-pink">Edge CDN (Amazon CloudFront)</strong>: Packages stream formats into HLS (HTTP Live Streaming) and DASH with multi-region caches for low-latency player delivery.' }
  ];

  nodeCards.forEach(node => {
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
      nodeEl.addEventListener('click', () => {
        // Highlight active card
        nodeCards.forEach(n => {
          const rect = document.getElementById(n.id).querySelector('rect');
          rect.style.strokeWidth = '1.5px';
        });
        nodeEl.querySelector('rect').style.strokeWidth = '3px';
        
        // Update Inspector text
        el.inspectorText.innerHTML = node.text;
        
        // Visual logging
        addLog('info', 'INSP', `Selected SVG Flow Node: ${node.id.split('-').pop().toUpperCase()}`);
      });
    }
  });

  // Solo & Mute Buttons in screen card footers
  const feeds = ['cam1', 'cam2', 'liveu3', 'liveu4', 'vod'];
  feeds.forEach(feed => {
    const soloBtn = document.getElementById(`btn-solo-${feed}`);
    const muteBtn = document.getElementById(`btn-mute-${feed}`);
    
    // Solo action
    soloBtn.addEventListener('click', () => {
      const isSoloed = soloBtn.classList.contains('btn-active-solo');
      
      // Reset all solo buttons first
      document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
      
      if (!isSoloed) {
        soloBtn.classList.add('btn-active-solo');
        state.soloFeed = feed;
        addLog('warning', 'MCR', `Solo mode activated for feed: ${feed.toUpperCase()}. Auditing channel solo.`);
        
        // Visually fade non-soloed screens
        feeds.forEach(f => {
          const screen = document.getElementById(`screen-${f}`);
          if (f === feed) {
            screen.style.opacity = '1.0';
            screen.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.25)';
          } else {
            screen.style.opacity = '0.35';
            screen.style.boxShadow = 'none';
          }
        });
      } else {
        state.soloFeed = null;
        addLog('info', 'MCR', 'Solo mode deactivated. Restoring Multi-Viewer grid matrix.');
        
        // Restore all screens opacity
        feeds.forEach(f => {
          const screen = document.getElementById(`screen-${f}`);
          screen.style.opacity = '1.0';
          screen.style.boxShadow = 'none';
        });
      }
    });

    // Mute action
    muteBtn.addEventListener('click', () => {
      const isMuted = state.mutedFeeds[feed];
      state.mutedFeeds[feed] = !isMuted;
      
      if (state.mutedFeeds[feed]) {
        muteBtn.classList.add('btn-active-mute');
        addLog('warning', 'MCR', `Audio muted for feed: ${feed.toUpperCase()}.`);
      } else {
        muteBtn.classList.remove('btn-active-mute');
        addLog('info', 'MCR', `Audio unmuted for feed: ${feed.toUpperCase()}.`);
      }
    });
  });

});
