/* ==========================================================================
   CLOUD BROADCAST MCR STUDIO - APPLICATION ENGINE
   Pure ES6 Javascript - High Performance Canvas Graphics & Math Simulations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const TILE_FEEDS = ['cam1', 'cam2', 'liveu3', 'liveu4'];
  const LIVEU_SOURCE_IDS = ['liveu1', 'liveu2', 'liveu3', 'liveu4'];
  const SOURCE_DETAILS = {
    liveu1: { label: 'LiveU Feed 1', shortLabel: 'LIVEU 1', codec: 'HEVC', color: '#10b981', rttOffset: 0 },
    liveu2: { label: 'LiveU Feed 2', shortLabel: 'LIVEU 2', codec: 'H.264', color: '#00d2ff', rttOffset: 0 },
    liveu3: { label: 'LiveU Feed 3', shortLabel: 'LIVEU 3', codec: 'H.264', color: '#f59e0b', rttOffset: 3 },
    liveu4: { label: 'LiveU Feed 4', shortLabel: 'LIVEU 4', codec: 'H.264', color: '#a78bfa', rttOffset: 6 }
  };

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
    activeSource: null, // null when no program source is on-air, otherwise 'cam1','cam2','liveu3','liveu4','vod','ad'
    primaryFailed: false,

    // Preview / Program state
    previewFeed: null,
    programSourceOverride: null,

    // LiveU Video Source State
    webcamStream: null,
    webcamReady: false,
    cam1VideoReady: false,
    cam2VideoReady: false,
    cam2FileURL: null,
    cam2FileName: null,

    // Media assignments for dynamic source targeting
    mediaAssignments: {
      webcam: 'cam1',
      localVideo: 'cam2'
    },
    tileSources: {
      cam1: 'webcam',
      cam2: 'localVideo',
      liveu3: 'simulated',
      liveu4: 'simulated',
      vod: 'vod'
    },
    tileSourceIds: {
      cam1: 'webcam',
      cam2: 'localVideo',
      liveu3: 'liveu3',
      liveu4: 'liveu4',
      vod: 'vod'
    },
    sourceStates: {
      liveu1: 'ONLINE',
      liveu2: 'STANDBY',
      liveu3: 'ONLINE',
      liveu4: 'ONLINE'
    },
    sourceBaseStates: {
      liveu1: 'ONLINE',
      liveu2: 'STANDBY',
      liveu3: 'ONLINE',
      liveu4: 'ONLINE'
    },
    sourceDetections: {
      liveu1: { black: false, silence: false, frozen: false },
      liveu2: { black: false, silence: false, frozen: false },
      liveu3: { black: false, silence: false, frozen: false },
      liveu4: { black: false, silence: false, frozen: false }
    },
    // Per-tile custom sources (e.g., RTSP/OBS/HTTP URL attachments)
    customSources: {
      // feedId: { url: string, videoEl: HTMLVideoElement, ready: boolean }
    },
    
    // SCTE-35 Ad Splice
    adActive: false,
    adTimeRemaining: 0.0, // seconds
    adIntervalId: null,
    
    // Multi-Viewer Settings
    previewFeed: null,
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
    overlayCam1Codec: document.getElementById('overlay-cam1-codec'),
    overlayCam1Src: document.getElementById('overlay-cam1-src'),
    overlayCam1Res: document.getElementById('overlay-cam1-res'),
    overlayCam2Codec: document.getElementById('overlay-cam2-codec'),
    overlayCam2Src: document.getElementById('overlay-cam2-src'),
    overlayCam2Res: document.getElementById('overlay-cam2-res'),
    overlayLiveu3Codec: document.getElementById('overlay-liveu3-codec'),
    overlayLiveu3Src: document.getElementById('overlay-liveu3-src'),
    overlayLiveu3Res: document.getElementById('overlay-liveu3-res'),
    overlayLiveu4Codec: document.getElementById('overlay-liveu4-codec'),
    overlayLiveu4Src: document.getElementById('overlay-liveu4-src'),
    overlayLiveu4Res: document.getElementById('overlay-liveu4-res'),
    btnStartWebcam: document.getElementById('btn-start-webcam'),
    btnStopWebcam: document.getElementById('btn-stop-webcam'),
    btnLoadLocalVideo: document.getElementById('btn-load-local-video'),
    btnEjectVideo: document.getElementById('btn-eject-video'),
    selectWebcamTarget: document.getElementById('select-webcam-target'),
    selectVideoTarget: document.getElementById('select-video-target'),
    localVideoFileInput: document.getElementById('local-video-file-input'),
    actionStatus: document.getElementById('action-status'),
    cam1Video: document.getElementById('video-cam1'),
    cam2Video: document.getElementById('video-cam2'),
    btnTake: document.getElementById('btn-take'),
    badgeStateCam1: document.getElementById('badge-state-cam1'),
    badgeStateCam2: document.getElementById('badge-state-cam2'),
    badgeStateLiveu3: document.getElementById('badge-state-liveu3'),
    badgeStateLiveu4: document.getElementById('badge-state-liveu4'),
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
    logTagFilter: document.getElementById('log-tag-filter'),
    logSearchInput: document.getElementById('log-search-input'),
    
    // Node SVG elements
    rectSwitcher: document.getElementById('rect-switcher'),
    rectMediaLive: document.getElementById('rect-medialive'),
    rectCdn: document.getElementById('rect-cdn'),
    textSwitcherStatus: document.getElementById('text-switcher-status'),
    pathCam1: document.getElementById('path-cam1'),
    pathCam2: document.getElementById('path-cam2'),
    pathLiveu3: document.getElementById('path-liveu3'),
    pathLiveu4: document.getElementById('path-liveu4'),
    pathVod: document.getElementById('path-vod'),
    pathSwitchToTrans: document.getElementById('path-switch-to-trans'),
    pathTransToCdn: document.getElementById('path-trans-to-cdn'),
    dotCam1: document.getElementById('dot-cam1'),
    dotCam2: document.getElementById('dot-cam2'),
    dotLiveu3: document.getElementById('dot-liveu3'),
    dotLiveu4: document.getElementById('dot-liveu4'),
    dotVod: document.getElementById('dot-vod'),
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
    const activeTag = el.logTagFilter?.value || 'all';
    const searchTerm = (el.logSearchInput?.value || '').trim().toLowerCase();
    el.consoleLogs.innerHTML = '';
    let visibleCount = 0;
    
    state.logs.forEach(log => {
      if (activeFilter !== 'all' && log.severity !== activeFilter) return;
      if (activeTag !== 'all' && log.tag !== activeTag) return;
      if (searchTerm) {
        const haystack = `${log.timestamp} ${log.severity} ${log.tag} ${log.message}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return;
      }
      
      const logDiv = document.createElement('div');
      logDiv.className = `log-entry log-${log.severity}`;
      
      logDiv.innerHTML = `
        <span class="log-timestamp">[${log.timestamp}]</span>
        <span class="log-tag">${log.tag}:</span>
        <span class="log-msg">${log.message}</span>
      `;
      
      el.consoleLogs.appendChild(logDiv);
      visibleCount++;
    });

    if (!visibleCount) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'log-entry log-empty';
      emptyDiv.textContent = 'No log entries match the current filters.';
      el.consoleLogs.appendChild(emptyDiv);
    }
    
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

  el.logTagFilter?.addEventListener('change', renderLogs);
  el.logSearchInput?.addEventListener('input', renderLogs);

  function safeRevokeVideoURL() {
    if (state.cam2FileURL) {
      URL.revokeObjectURL(state.cam2FileURL);
      state.cam2FileURL = null;
      state.cam2FileName = null;
    }
  }

  function getVideoResolution(video) {
    return (video && video.videoWidth && video.videoHeight)
      ? `${video.videoWidth}x${video.videoHeight}`
      : 'N/A';
  }

  function getFeedAssignment(feed) {
    // Custom per-tile source takes precedence
    if (state.customSources && state.customSources[feed]) return 'custom';
    const sourceId = state.tileSourceIds[feed];
    if (LIVEU_SOURCE_IDS.includes(sourceId)) return 'simulated';
    if (sourceId === 'none') return 'none';
    return state.tileSources[feed] || 'simulated';
  }

  function setTileSource(feed, sourceId) {
    if (!state.tileSources[feed]) return;
    const nextSourceId = sourceId || 'none';
    state.tileSourceIds[feed] = nextSourceId;
    state.tileSources[feed] = LIVEU_SOURCE_IDS.includes(nextSourceId) ? 'simulated' : nextSourceId;
  }

  function clearTileSource(feed) {
    if (!state.tileSources[feed]) return;
    setTileSource(feed, feed === 'vod' ? 'vod' : 'none');
    if (state.previewFeed === feed) clearPreviewUI();
    if (state.activeSource === feed) {
      state.activeSource = null;
      state.programSourceOverride = null;
      el.pgmActiveSource.textContent = 'SOURCE: NONE';
      addLog('info', 'ROUTE', `${getTileName(feed)} removed from PROGRAM because its source was cleared.`);
      updateOrchestratorRouting();
    }
  }

  function getProgramSourceId() {
    if (!state.activeSource) return null;
    if (state.programSourceOverride) return state.programSourceOverride;
    if (state.activeSource === 'ad') return 'ad';
    return state.tileSourceIds[state.activeSource] || state.activeSource;
  }

  function getSourceState(sourceId) {
    if (LIVEU_SOURCE_IDS.includes(sourceId)) return state.sourceStates[sourceId] || 'OFFLINE';
    return sourceId === 'none' ? 'OFFLINE' : 'ONLINE';
  }

  function getActiveDetections(sourceId) {
    const detections = state.sourceDetections[sourceId] || {};
    return Object.entries(detections)
      .filter(([, active]) => active)
      .map(([name]) => name.toUpperCase());
  }

  function deriveSourceState(sourceId) {
    if (getActiveDetections(sourceId).length > 0) return 'ALARM';
    return state.sourceBaseStates[sourceId] || 'OFFLINE';
  }

  function setSourceState(sourceId, nextState) {
    if (!LIVEU_SOURCE_IDS.includes(sourceId)) return;
    const previousState = state.sourceStates[sourceId];
    state.sourceBaseStates[sourceId] = nextState;
    state.sourceStates[sourceId] = deriveSourceState(sourceId);
    if (previousState !== state.sourceStates[sourceId]) {
      const severity = state.sourceStates[sourceId] === 'ALARM' || state.sourceStates[sourceId] === 'OFFLINE' ? 'alarm' : state.sourceStates[sourceId] === 'STANDBY' ? 'warning' : 'info';
      addLog(severity, 'SRC', `${SOURCE_DETAILS[sourceId].label} state changed: ${previousState} → ${state.sourceStates[sourceId]}.`);
    }
    updateSourceStateControls();
    updateDetectionControls();
    updateSourceOverlays();
    updateOrchestratorRouting();
  }

  function setSourceDetection(sourceId, detectionName, active) {
    if (!LIVEU_SOURCE_IDS.includes(sourceId)) return;
    const detections = state.sourceDetections[sourceId];
    if (!detections || detections[detectionName] === active) return;
    detections[detectionName] = active;
    const previousState = state.sourceStates[sourceId];
    state.sourceStates[sourceId] = deriveSourceState(sourceId);
    addLog(active ? 'alarm' : 'info', 'QC', `${SOURCE_DETAILS[sourceId].label} ${detectionName.toUpperCase()} detection ${active ? 'triggered' : 'cleared'}.`);
    if (previousState !== state.sourceStates[sourceId]) {
      const severity = state.sourceStates[sourceId] === 'ALARM' || state.sourceStates[sourceId] === 'OFFLINE' ? 'alarm' : state.sourceStates[sourceId] === 'STANDBY' ? 'warning' : 'info';
      addLog(severity, 'SRC', `${SOURCE_DETAILS[sourceId].label} state changed: ${previousState} → ${state.sourceStates[sourceId]}.`);
    }
    updateSourceStateControls();
    updateDetectionControls();
    updateSourceOverlays();
    updateOrchestratorRouting();
  }

  function updateSourceStateControls() {
    LIVEU_SOURCE_IDS.forEach(sourceId => {
      const select = document.getElementById(`source-state-${sourceId}`);
      if (select) select.value = getSourceState(sourceId);
    });
  }

  function updateDetectionControls() {
    LIVEU_SOURCE_IDS.forEach(sourceId => {
      ['black', 'silence', 'frozen'].forEach(detectionName => {
        const input = document.getElementById(`detect-${detectionName}-${sourceId}`);
        if (input) input.checked = !!state.sourceDetections[sourceId]?.[detectionName];
      });
    });
  }

  function sourceHasSignal(sourceId) {
    const sourceState = getSourceState(sourceId);
    return sourceState === 'ONLINE' || sourceState === 'STANDBY';
  }

  function getFeedStatus(feed) {
    const assignment = getFeedAssignment(feed);
    if (assignment === 'none') return 'OFFLINE';
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return getSourceState(state.tileSourceIds[feed]);
    if (assignment === 'webcam') return state.webcamReady ? 'ONLINE' : 'OFFLINE';
    if (assignment === 'localVideo') return state.cam2VideoReady ? 'PLAYING' : 'OFFLINE';
    if (assignment === 'vod') return 'PLAYING';
    return 'SIMULATED';
  }

  function getAssignmentLabel(feed) {
    const assignment = getFeedAssignment(feed);
    if (assignment === 'webcam') return 'Browser Cam';
    if (assignment === 'localVideo') return state.cam2VideoReady ? (state.cam2FileName || 'Local File') : 'Local File';
    if (feed === 'vod') return 'PLAYOUT';
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return SOURCE_DETAILS[state.tileSourceIds[feed]].label;
    return 'SIMULATED';
  }

  function getFeedMetadata(feed) {
    const assignment = getFeedAssignment(feed);
    const sourceId = state.tileSourceIds[feed];

    if (assignment === 'none') {
      return {
        codec: 'NO INPUT',
        source: 'No Input',
        resolution: 'N/A',
        bitrate: '0.0 Mbps',
        rtt: '--'
      };
    }

    if (assignment === 'webcam') {
      return {
        codec: 'Browser Cam',
        source: state.webcamReady ? 'Browser Cam' : 'No Input',
        resolution: state.webcamReady ? getVideoResolution(el.cam1Video) : 'N/A',
        bitrate: state.webcamReady ? `${(4.8 + Math.random() * 1.2).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: state.webcamReady ? `${state.rttMs}ms` : '--'
      };
    }

    if (assignment === 'localVideo') {
      return {
        codec: 'Local File',
        source: state.cam2VideoReady ? (state.cam2FileName || 'Local File') : 'No File',
        resolution: state.cam2VideoReady ? getVideoResolution(el.cam2Video) : 'N/A',
        bitrate: state.cam2VideoReady ? `${(4.3 + Math.random() * 1.3).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: state.cam2VideoReady ? `${state.rttMs}ms` : '--'
      };
    }

    if (assignment === 'custom') {
      const src = state.customSources[feed];
      return {
        codec: 'CUSTOM',
        source: src?.url || 'Custom Source',
        resolution: src?.ready ? getVideoResolution(src.videoEl) : 'N/A',
        bitrate: src?.ready ? `${(3.8 + Math.random() * 2.2).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: src?.ready ? `${state.rttMs}ms` : '--'
      };
    }

    if (LIVEU_SOURCE_IDS.includes(sourceId)) {
      const details = SOURCE_DETAILS[sourceId];
      const sourceState = getSourceState(sourceId);
      const hasSignal = sourceHasSignal(sourceId);
      const activeDetections = getActiveDetections(sourceId);
      return {
        codec: hasSignal ? details.codec : 'NO LOCK',
        source: activeDetections.length ? `${details.label} ${activeDetections.join('/')}` : details.label,
        resolution: hasSignal ? '1080p60' : 'N/A',
        bitrate: hasSignal ? `${(sourceId === 'liveu1' ? 5.4 : 4.7 + Math.random() * 1.1).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: hasSignal ? `${state.rttMs + details.rttOffset}ms` : sourceState
      };
    }

    return {
      codec: feed === 'cam1' ? 'HEVC' : 'H.264',
      source: 'Simulated Input',
      resolution: '1080p60',
      bitrate: `${(feed === 'cam1' ? 5.4 : 4.7 + Math.random() * 1.1).toFixed(1)} Mbps`,
      rtt: `${feed === 'liveu3' ? state.rttMs + 3 : feed === 'liveu4' ? state.rttMs + 6 : state.rttMs}ms`
    };
  }

  function feedHasActiveSignal(feed) {
    const assignment = getFeedAssignment(feed);
    if (assignment === 'none') return false;
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return sourceHasSignal(state.tileSourceIds[feed]);
    if (assignment === 'webcam') return state.webcamReady && el.cam1Video.readyState >= 2;
    if (assignment === 'localVideo') return state.cam2VideoReady && el.cam2Video.readyState >= 2;
    if (assignment === 'custom') return !!state.customSources[feed]?.ready;
    if (assignment === 'vod') return true;
    return true;
  }

  function clearCanvas(feed) {
    const canvas = canvases[feed]?.element;
    if (!canvas) return;
    const ctx = canvases[feed].ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawFeedCanvas(feed, ctx, w, h, frames) {
    const assignment = getFeedAssignment(feed);
    if (!feedHasActiveSignal(feed) && feed !== 'vod') {
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (assignment === 'custom') {
      const src = state.customSources[feed];
      if (src && src.ready && drawVideoFrame(src.videoEl, ctx, w, h)) return;
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (assignment === 'webcam') {
      if (state.webcamReady && drawVideoFrame(el.cam1Video, ctx, w, h)) return;
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (assignment === 'localVideo') {
      if (state.cam2VideoReady && drawVideoFrame(el.cam2Video, ctx, w, h)) return;
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (feed === 'cam1') {
      drawStreamCam1(ctx, w, h, frames, state.unrecoveredLoss);
    } else if (feed === 'cam2' || feed === 'liveu3' || feed === 'liveu4') {
      drawStreamCam2(ctx, w, h, frames);
    } else if (feed === 'vod') {
      drawStreamVOD(ctx, w, h, frames);
    }
  }

  function updateSourceOverlays() {
    const overlayFields = {
      cam1: {
        codec: el.overlayCam1Codec,
        source: el.overlayCam1Src,
        resolution: el.overlayCam1Res,
        bitrate: el.overlayCam1Bw,
        rtt: el.overlayCam1Rtt
      },
      cam2: {
        codec: el.overlayCam2Codec,
        source: el.overlayCam2Src,
        resolution: el.overlayCam2Res,
        bitrate: el.overlayCam2Bw,
        rtt: el.overlayCam2Rtt
      },
      liveu3: {
        codec: el.overlayLiveu3Codec,
        source: el.overlayLiveu3Src,
        resolution: el.overlayLiveu3Res,
        bitrate: el.overlayLiveu3Bw,
        rtt: el.overlayLiveu3Rtt
      },
      liveu4: {
        codec: el.overlayLiveu4Codec,
        source: el.overlayLiveu4Src,
        resolution: el.overlayLiveu4Res,
        bitrate: el.overlayLiveu4Bw,
        rtt: el.overlayLiveu4Rtt
      }
    };

    TILE_FEEDS.forEach(feed => {
      const metadata = getFeedMetadata(feed);
      const fields = overlayFields[feed];
      if (!fields) return;
      fields.codec.textContent = metadata.codec;
      fields.source.textContent = metadata.source;
      fields.resolution.textContent = metadata.resolution;
      fields.bitrate.textContent = metadata.bitrate;
      fields.rtt.textContent = metadata.rtt;
    });

    el.badgeStateCam1.textContent = getFeedStatus('cam1');
    el.badgeStateCam2.textContent = getFeedStatus('cam2');
    el.badgeStateLiveu3.textContent = getFeedStatus('liveu3');
    el.badgeStateLiveu4.textContent = getFeedStatus('liveu4');

    const statusParts = [];
    statusParts.push(`Webcam ➜ ${String(state.mediaAssignments.webcam ?? 'NONE').toUpperCase()}`);
    statusParts.push(`Video ➜ ${String(state.mediaAssignments.localVideo ?? 'NONE').toUpperCase()}`);
    if (state.webcamReady) statusParts.unshift('Webcam ONLINE');
    if (state.cam2VideoReady) statusParts.unshift('Local video PLAYING');
    el.actionStatus.textContent = statusParts.length ? statusParts.join(' · ') : 'Waiting for source...';
  }

  function drawVideoFrame(video, ctx, width, height) {
    if (!video || video.readyState < 2) return false;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;

    const canvasAspect = width / height;
    const videoAspect = vw / vh;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    if (videoAspect > canvasAspect) {
      sw = vh * canvasAspect;
      sx = (vw - sw) / 2;
    } else if (videoAspect < canvasAspect) {
      sh = vw / canvasAspect;
      sy = (vh - sh) / 2;
    }

    try {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
      return true;
    } catch (error) {
      return false;
    }
  }

  el.btnStartWebcam.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('warning', 'WEB', 'Webcam capture is not supported in this browser.');
      el.actionStatus.textContent = 'Webcam unsupported';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      el.cam1Video.srcObject = stream;
      state.webcamStream = stream;
      state.webcamReady = true;
      state.cam1VideoReady = true;
      await el.cam1Video.play().catch(() => {});
      assignMediaTarget('webcam', el.selectWebcamTarget.value);
      updateSourceOverlays();
      addLog('info', 'WEB', 'Browser webcam started and assigned to LiveU source.');
      addLog('info', 'MIX', `Webcam available at ${String(state.mediaAssignments.webcam ?? 'NONE').toUpperCase()}.`);
    } catch (error) {
      addLog('alarm', 'WEB', `Unable to access webcam: ${error.message}`);
      el.actionStatus.textContent = 'Webcam access denied';
    }
  });

  el.btnLoadLocalVideo.addEventListener('click', () => {
    pendingLocalAssignTarget = el.selectVideoTarget.value;
    el.localVideoFileInput.click();
  });

  el.localVideoFileInput.addEventListener('change', () => {
    const file = el.localVideoFileInput.files?.[0];
    if (!file) return;
    safeRevokeVideoURL();
    state.cam2FileName = file.name;
    state.cam2FileURL = URL.createObjectURL(file);
    el.cam2Video.src = state.cam2FileURL;
    state.cam2VideoReady = false;
    el.cam2Video.load();
    el.cam2Video.play().catch(() => {});
    // If a tile requested this local file attach, assign it now
    if (pendingLocalAssignTarget) {
      assignMediaTarget('localVideo', pendingLocalAssignTarget);
      pendingLocalAssignTarget = null;
    }
    updateSourceOverlays();
    addLog('info', 'VIDEO', `Local file selected: ${file.name}`);
    el.localVideoFileInput.value = '';
  });

  el.cam2Video.addEventListener('loadedmetadata', () => {
    state.cam2VideoReady = true;
    updateSourceOverlays();
  });

  el.cam1Video.addEventListener('loadedmetadata', () => {
    state.webcamReady = true;
    state.cam1VideoReady = true;
    updateSourceOverlays();
  });

  function assignMediaTarget(mediaType, target) {
    const otherType = mediaType === 'webcam' ? 'localVideo' : 'webcam';
    if (state.mediaAssignments[otherType] === target) {
      addLog('warning', 'ROUTE', `${mediaType === 'webcam' ? 'Webcam' : 'Local Video'} cannot be assigned to ${target.toUpperCase()} because it is already occupied.`);
      if (mediaType === 'webcam') el.selectWebcamTarget.value = state.mediaAssignments.webcam;
      else el.selectVideoTarget.value = state.mediaAssignments.localVideo;
      return;
    }

    const previousTarget = state.mediaAssignments[mediaType];
    if (previousTarget && previousTarget !== target && getFeedAssignment(previousTarget) === mediaType) {
      clearTileSource(previousTarget);
    }

    state.mediaAssignments[mediaType] = target;
    setTileSource(target, mediaType);
    addLog('info', 'ROUTE', `${mediaType === 'webcam' ? 'Webcam' : 'Local Video'} assigned to ${target.toUpperCase()}.`);
    updateSourceOverlays();
  }

  el.selectWebcamTarget.addEventListener('change', () => {
    assignMediaTarget('webcam', el.selectWebcamTarget.value);
  });

  el.selectVideoTarget.addEventListener('change', () => {
    assignMediaTarget('localVideo', el.selectVideoTarget.value);
  });

  function stopWebcam() {
    const assignedFeed = state.mediaAssignments.webcam;

    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach(track => track.stop());
      state.webcamStream = null;
    }
    el.cam1Video.srcObject = null;
    state.webcamReady = false;
    state.cam1VideoReady = false;
    addLog('info', 'WEB', 'Webcam stopped and removed from assigned source.');

    if (assignedFeed) clearTileSource(assignedFeed);
    state.mediaAssignments.webcam = null;

    updateSourceOverlays();
    clearCanvas(assignedFeed);
  }

  function ejectLocalVideo() {
    if (!state.cam2FileURL) {
      addLog('warning', 'VIDEO', 'No local video loaded to eject.');
      return;
    }

    const assignedFeed = state.mediaAssignments.localVideo;

    el.cam2Video.pause();
    el.cam2Video.removeAttribute('src');
    el.cam2Video.load();
    safeRevokeVideoURL();
    state.cam2VideoReady = false;

    addLog('info', 'VIDEO', 'Local video ejected from assigned source.');

    if (assignedFeed) clearTileSource(assignedFeed);
    state.mediaAssignments.localVideo = null;

    updateSourceOverlays();
    clearCanvas(assignedFeed);
  }

  el.btnStopWebcam.addEventListener('click', stopWebcam);
  el.btnEjectVideo.addEventListener('click', ejectLocalVideo);

  // Pending assignment target when user selects "Local Video" for a specific tile
  let pendingLocalAssignTarget = null;

  function setPreview(feed) {
    state.previewFeed = feed;
    document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
    const btn = document.getElementById(`btn-solo-${feed}`);
    if (btn) btn.classList.add('btn-active-solo');
    document.querySelectorAll('.screen-card').forEach(c => c.classList.remove('preview-active'));
    const card = document.getElementById(`screen-${feed}`);
    if (card) card.classList.add('preview-active');
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
    addLog('info', 'MUX', `Preview set to ${getTileName(feed)}.`);
  }

  function getTileName(feed) {
    return feed === 'cam1' ? 'MULTIVIEW 1' : feed === 'cam2' ? 'MULTIVIEW 2' : feed === 'liveu3' ? 'MULTIVIEW 3' : feed === 'liveu4' ? 'MULTIVIEW 4' : feed === 'vod' ? 'PLAYOUT' : feed.toUpperCase();
  }

  function getProgramRouteLabel(feed) {
    if (!feed) return 'NONE';
    if (feed === 'ad') return 'AD-LOOP (SCTE-35)';
    const sourceId = state.tileSourceIds[feed];
    const sourceLabel = SOURCE_DETAILS[sourceId]?.label || getAssignmentLabel(feed);
    return sourceLabel && sourceLabel !== getTileName(feed)
      ? `${sourceLabel} (${getTileName(feed)})`
      : getTileName(feed);
  }

  function updateTAKEButton() {
    if (state.previewFeed) {
      el.btnTake.textContent = `TAKE: ${getTileName(state.previewFeed)}`;
      el.btnTake.disabled = false;
      el.btnTake.style.opacity = '1.0';
    } else {
      el.btnTake.textContent = 'TAKE';
      el.btnTake.disabled = true;
      el.btnTake.style.opacity = '0.5';
    }
  }

  function updateBadges() {
    const tileFeeds = ['cam1', 'cam2', 'liveu3', 'liveu4'];
    tileFeeds.forEach(feed => {
      const previewBadge = document.getElementById(`preview-badge-${feed}`);
      const programBadge = document.getElementById(`program-badge-${feed}`);
      const screenCard = document.getElementById(`screen-${feed}`);
      
      if (state.previewFeed === feed && previewBadge) {
        previewBadge.style.display = 'block';
      } else if (previewBadge) {
        previewBadge.style.display = 'none';
      }
      
      if (state.activeSource === feed && programBadge) {
        programBadge.style.display = 'block';
        if (screenCard) screenCard.classList.add('program-active');
      } else {
        if (programBadge) programBadge.style.display = 'none';
        if (screenCard) screenCard.classList.remove('program-active');
      }
    });
  }

  function updatePGMFooter() {
    const previewLine = document.getElementById('pgm-status-preview');
    const programLine = document.getElementById('pgm-status-program');
    
    if (previewLine) {
      previewLine.textContent = state.previewFeed ? `PREVIEW: ${getTileName(state.previewFeed)}` : 'PREVIEW: —';
    }
    if (programLine) {
      programLine.textContent = state.activeSource ? `PROGRAM: ${getTileName(state.activeSource)}` : 'PROGRAM: —';
    }
  }

  function setSvgLinkState(path, stateName, color) {
    if (!path) return;
    path.classList.remove('link-active', 'link-active-blue', 'link-standby', 'link-broken');
    path.style.stroke = color || '';
    path.style.strokeWidth = stateName === 'active' || stateName === 'active-blue' ? '2.5px' : '1.5px';

    if (stateName === 'broken') path.classList.add('link-broken');
    else if (stateName === 'active-blue') path.classList.add('link-active-blue');
    else if (stateName === 'active') path.classList.add('link-active');
    else path.classList.add('link-standby');
  }

  function setSvgDotState(dot, visible, color) {
    if (!dot) return;
    dot.style.display = visible ? 'block' : 'none';
    if (color) dot.setAttribute('fill', color);
  }

  function updateOrchestratorRouting() {
    const source = getProgramSourceId();
    const isLiveu1 = source === 'cam1';
    const isLiveu1Source = source === 'liveu1';
    const isLiveu2 = source === 'cam2';
    const isLiveu2Source = source === 'liveu2';
    const isLiveu3 = source === 'liveu3';
    const isLiveu4 = source === 'liveu4';
    const isPlayout = source === 'vod' || source === 'ad';
    const hasProgram = !!source;
    const routeColor = isLiveu2 || isLiveu2Source ? '#00d2ff' : isLiveu3 ? '#f59e0b' : isLiveu4 ? '#a78bfa' : isPlayout ? '#ec4899' : '#10b981';
    const sourceLinkState = (sourceId, isActive, activeState = 'active') => {
      if (!sourceHasSignal(sourceId)) return 'broken';
      return isActive ? activeState : 'standby';
    };

    setSvgLinkState(el.pathCam1, state.primaryFailed ? 'broken' : sourceLinkState('liveu1', isLiveu1 || isLiveu1Source), '#10b981');
    setSvgLinkState(el.pathCam2, sourceLinkState('liveu2', isLiveu2 || isLiveu2Source, 'active-blue'), '#00d2ff');
    setSvgLinkState(el.pathLiveu3, sourceLinkState('liveu3', isLiveu3), '#f59e0b');
    setSvgLinkState(el.pathLiveu4, sourceLinkState('liveu4', isLiveu4), '#a78bfa');
    setSvgLinkState(el.pathVod, isPlayout ? 'active' : 'standby', '#ec4899');
    setSvgLinkState(el.pathSwitchToTrans, hasProgram ? (isLiveu2 ? 'active-blue' : 'active') : 'standby', routeColor);
    setSvgLinkState(el.pathTransToCdn, hasProgram ? (isLiveu2 ? 'active-blue' : 'active') : 'standby', routeColor);

    setSvgDotState(el.dotCam1, (isLiveu1 || isLiveu1Source) && !state.primaryFailed && sourceHasSignal('liveu1'), '#10b981');
    setSvgDotState(el.dotCam2, (isLiveu2 || isLiveu2Source) && sourceHasSignal('liveu2'), '#00d2ff');
    setSvgDotState(el.dotLiveu3, isLiveu3 && sourceHasSignal('liveu3'), '#f59e0b');
    setSvgDotState(el.dotLiveu4, isLiveu4 && sourceHasSignal('liveu4'), '#a78bfa');
    setSvgDotState(el.dotVod, isPlayout, '#ec4899');
    setSvgDotState(el.dotSwitch, hasProgram, routeColor);
    setSvgDotState(el.dotTrans, hasProgram, routeColor);

    let routeLabel = 'IDLE';
    let switcherLabel = 'IDLE';
    if (state.primaryFailed && (isLiveu2 || isLiveu2Source)) {
      routeLabel = 'BACKUP';
      switcherLabel = 'BACKUP PATH';
    } else if (isLiveu1 || isLiveu1Source) {
      routeLabel = 'PRIMARY';
      switcherLabel = 'PRIMARY';
    } else if (isLiveu2 || isLiveu2Source) {
      routeLabel = 'LIVEU 2';
      switcherLabel = 'LIVEU 2';
    } else if (source === 'liveu3') {
      routeLabel = 'LIVEU 3';
      switcherLabel = 'LIVEU 3';
    } else if (source === 'liveu4') {
      routeLabel = 'LIVEU 4';
      switcherLabel = 'LIVEU 4';
    } else if (source === 'vod') {
      routeLabel = 'PLAYOUT';
      switcherLabel = 'PLAYOUT';
    } else if (source === 'ad') {
      routeLabel = 'AD CUE';
      switcherLabel = 'SCTE-35';
    } else if (state.primaryFailed) {
      routeLabel = 'ALARM';
      switcherLabel = 'PATH A FAIL';
    }

    el.txRoute.textContent = routeLabel;
    el.txRoute.className = `badge-value ${routeColor === '#00d2ff' ? 'text-blue' : routeColor === '#ec4899' ? 'text-pink' : routeColor === '#f59e0b' ? 'text-amber' : routeColor === '#a78bfa' ? 'text-purple' : 'text-green'}`;
    el.textSwitcherStatus.textContent = switcherLabel;
    el.textSwitcherStatus.setAttribute('fill', state.primaryFailed && !(isLiveu2 || isLiveu2Source) ? '#ef4444' : routeColor);
    el.rectSwitcher.setAttribute('stroke', state.primaryFailed && !(isLiveu2 || isLiveu2Source) ? '#ef4444' : routeColor);
    el.rectMediaLive?.setAttribute('stroke', hasProgram ? routeColor : '#3b82f6');
    el.rectCdn?.setAttribute('stroke', hasProgram ? routeColor : '#8b5cf6');

    if (hasProgram) {
      const sourceLabel = SOURCE_DETAILS[source]?.label || getTileName(state.activeSource);
      el.inspectorText.innerHTML = `<strong class="text-green">Active Program Route</strong>: ${sourceLabel} via ${getTileName(state.activeSource)} → ST 2022-7 Switcher → AWS MediaLive → CDN Edge.`;
    } else if (state.primaryFailed) {
      el.inspectorText.innerHTML = '<strong class="text-red">Path A failure detected</strong>: LiveU 1 contribution is unavailable. Route backup or restore primary.';
    } else {
      el.inspectorText.innerHTML = '<strong class="text-green">ST 2022-7 Switcher</strong>: Waiting for PREVIEW/TAKE route selection.';
    }
  }

  function clearPreviewUI() {
    state.previewFeed = null;
    document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
    document.querySelectorAll('.screen-card').forEach(c => c.classList.remove('preview-active'));
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
  }

  // TAKE button: route preview to program
  el.btnTake.addEventListener('click', () => {
    if (!state.previewFeed) {
      addLog('warning', 'MIX', 'No preview source selected to take.');
      return;
    }
    if (!feedHasActiveSignal(state.previewFeed)) {
      const sourceId = state.tileSourceIds[state.previewFeed];
      const sourceLabel = SOURCE_DETAILS[sourceId]?.label || getTileName(state.previewFeed);
      addLog('warning', 'MIX', `TAKE blocked: ${sourceLabel} is not available.`);
      return;
    }
    state.activeSource = state.previewFeed;
    state.programSourceOverride = null;
    clearPreviewUI();
    el.pgmActiveSource.textContent = `SOURCE: ${getProgramRouteLabel(state.activeSource)}`;
  updateBadges();
  updatePGMFooter();
  updateOrchestratorRouting();
  addLog('info', 'MIX', `TAKE executed. Program switched to ${getTileName(state.activeSource)}.`);
  });

  // Per-tile attach/eject/solo wiring
  TILE_FEEDS.forEach(feed => {
    const attachBtn = document.getElementById(`btn-attach-${feed}`);
    const ejectBtn = document.getElementById(`btn-eject-${feed}`);
    const soloBtn = document.getElementById(`btn-solo-${feed}`);
    const selectEl = document.getElementById(`select-source-${feed}`);

    if (attachBtn && selectEl) {
      attachBtn.addEventListener('click', async () => {
        const val = selectEl.value;
        if (val === 'none') {
          clearTileSource(feed);
          clearCanvas(feed);
          updateSourceOverlays();
          addLog('info', 'ROUTE', `${getTileName(feed)} cleared.`);
          return;
        }

        if (val === 'webcam') {
          // ensure webcam is started
          if (!state.webcamReady) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
              el.cam1Video.srcObject = stream;
              state.webcamStream = stream;
              state.webcamReady = true;
              state.cam1VideoReady = true;
              await el.cam1Video.play().catch(() => {});
              addLog('info', 'WEB', 'Browser webcam started.');
            } catch (err) {
              addLog('alarm', 'WEB', `Unable to access webcam: ${err.message}`);
              return;
            }
          }
          assignMediaTarget('webcam', feed);
          addLog('info', 'ROUTE', `Webcam assigned to ${feed.toUpperCase()}.`);
          updateSourceOverlays();
          return;
        }

        if (val === 'local') {
          if (state.cam2FileURL) {
            assignMediaTarget('localVideo', feed);
            updateSourceOverlays();
            return;
          }

          pendingLocalAssignTarget = feed;
          el.localVideoFileInput.click();
          addLog('info', 'VIDEO', `Select a local file to attach to ${feed.toUpperCase()}.`);
          return;
        }

        // For simulated/other network sources, assign logically
        if (val.startsWith('liveu') || val === 'obs' || val === 'rtsp') {
          // Assign the selected source identity to this monitor tile.
          state.mediaAssignments[val] = feed; // best-effort mapping
          setTileSource(feed, val);
          addLog('info', 'ROUTE', `${val.toUpperCase()} attached to ${feed.toUpperCase()}.`);
          updateSourceOverlays();
          return;
        }
      });
    }

    if (ejectBtn) {
      ejectBtn.addEventListener('click', () => {
        // If this feed currently has webcam assigned
        if (state.mediaAssignments.webcam === feed) {
          stopWebcam();
          state.mediaAssignments.webcam = null;
          addLog('info', 'ROUTE', `Webcam unassigned from ${feed.toUpperCase()}.`);
        }
        if (state.mediaAssignments.localVideo === feed) {
          ejectLocalVideo();
          state.mediaAssignments.localVideo = null;
          addLog('info', 'ROUTE', `Local video unassigned from ${feed.toUpperCase()}.`);
        }
        // If a custom source is attached to this feed, remove it
        if (state.customSources && state.customSources[feed]) {
          try {
            const src = state.customSources[feed];
            src.videoEl.pause();
            src.videoEl.removeAttribute('src');
            src.videoEl.load();
            if (src.videoEl.parentNode) src.videoEl.parentNode.removeChild(src.videoEl);
          } catch (e) {}
          delete state.customSources[feed];
          addLog('info', 'ROUTE', `Custom source detached from ${feed.toUpperCase()}.`);
        }
        if (state.mediaAssignments.webcam !== feed && state.mediaAssignments.localVideo !== feed && !state.customSources[feed]) {
          clearTileSource(feed);
        }
        clearCanvas(feed);
        updateSourceOverlays();
      });
    }

    if (soloBtn) {
      soloBtn.addEventListener('click', () => setPreview(feed));
    }
    // Mute toggle
    const muteBtn = document.getElementById(`btn-mute-${feed}`);
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const cur = !!state.mutedFeeds[feed];
        state.mutedFeeds[feed] = !cur;
        muteBtn.classList.toggle('btn-active-mute', !cur);
        addLog('info', 'AUDIO', `${feed.toUpperCase()} ${!cur ? 'muted' : 'unmuted'}.`);
      });
    }
    // Edit / custom source attach
    const editBtn = document.getElementById(`btn-edit-${feed}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const url = prompt(`Enter media URL for ${feed.toUpperCase()} (http/https/rtsp/obs):`);
        if (!url) return;
        // create hidden video element
        const v = document.createElement('video');
        v.autoplay = true; v.muted = true; v.playsInline = true; v.className = 'hidden-video';
        v.src = url;
        v.addEventListener('loadedmetadata', () => {
          state.customSources[feed] = { url, videoEl: v, ready: true };
          addLog('info', 'ROUTE', `Custom source loaded for ${feed.toUpperCase()}.`);
          updateSourceOverlays();
        });
        v.addEventListener('error', () => {
          addLog('alarm', 'ROUTE', `Failed to load custom source for ${feed.toUpperCase()}.`);
        });
        document.body.appendChild(v);
        // attempt play
        v.play().catch(() => {});
        addLog('info', 'ROUTE', `Attempting to attach custom source to ${feed.toUpperCase()}...`);
      });
    }
  });

  updateSourceOverlays();
  updateTAKEButton();
  updateBadges();
  updatePGMFooter();
  updateSourceStateControls();
  updateDetectionControls();
  updateOrchestratorRouting();

  LIVEU_SOURCE_IDS.forEach(sourceId => {
    const select = document.getElementById(`source-state-${sourceId}`);
    if (!select) return;
    select.addEventListener('change', () => setSourceState(sourceId, select.value));

    ['black', 'silence', 'frozen'].forEach(detectionName => {
      const input = document.getElementById(`detect-${detectionName}-${sourceId}`);
      if (input) {
        input.addEventListener('change', () => setSourceDetection(sourceId, detectionName, input.checked));
      }
    });
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

  // Ensure pgm label reflects initial active source
  el.pgmActiveSource.textContent = state.activeSource ? `SOURCE: ${getProgramRouteLabel(state.activeSource)}` : 'SOURCE: NONE';

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
    ctx.fillText(`LiveU 1 / contribution`, 15, 25);
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
    ctx.fillText(`LiveU 2 / standby path`, 15, 25);
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

    // Multi-view sources only generate audio when the assigned source has signal.
    generateVUValues('cam1', feedHasActiveSignal('cam1') && !state.primaryFailed, state.mutedFeeds.cam1);
    generateVUValues('cam2', feedHasActiveSignal('cam2'), state.mutedFeeds.cam2);
    generateVUValues('liveu3', feedHasActiveSignal('liveu3'), state.mutedFeeds.liveu3);
    generateVUValues('liveu4', feedHasActiveSignal('liveu4'), state.mutedFeeds.liveu4);

    // VOD status
    generateVUValues('vod', true, state.mutedFeeds.vod);
    
    // PGM status follows the active playout source
    let pgmActive = !!state.activeSource && feedHasActiveSignal(state.activeSource);
    let pgmMuted = state.mutedFeeds.pgm;
    
    if (state.activeSource === 'cam1' && state.primaryFailed) {
      pgmActive = false; // No audio if source is failed and no backup configured
    }
    
    if (!pgmActive || pgmMuted) {
      vuState.pgm.l = 0;
      vuState.pgm.r = 0;
      vuState.pgm.lp = Math.max(0, vuState.pgm.lp - 0.008);
      vuState.pgm.rp = Math.max(0, vuState.pgm.rp - 0.008);
    } else {
      let activeSourceVU = vuState.cam1;
      if (state.activeSource === 'cam2') activeSourceVU = vuState.cam2;
      else if (state.activeSource === 'liveu3') activeSourceVU = vuState.liveu3;
      else if (state.activeSource === 'liveu4') activeSourceVU = vuState.liveu4;
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
    else if (state.activeSource === 'liveu3') el.tcPgm.textContent = el.tcLiveu3.textContent;
    else if (state.activeSource === 'liveu4') el.tcPgm.textContent = el.tcLiveu4.textContent;
    else if (state.activeSource === 'vod') el.tcPgm.textContent = el.tcVod.textContent;
    else if (state.activeSource === 'ad') el.tcPgm.textContent = getSMPTETimecode(framesCount);
    else el.tcPgm.textContent = '--:--:--:--';

    // 1. Draw Feed 1 (Cam 1 / Primary)
    drawFeedCanvas('cam1', canvases.cam1.ctx, canvases.cam1.element.width, canvases.cam1.element.height, framesCount);

    // 2. Draw Feed 2 (Cam 2 / Backup)
    drawFeedCanvas('cam2', canvases.cam2.ctx, canvases.cam2.element.width, canvases.cam2.element.height, framesCount);

    // 3. Draw Feed 3 (LiveU 3)
    drawFeedCanvas('liveu3', canvases.liveu3.ctx, canvases.liveu3.element.width, canvases.liveu3.element.height, framesCount);

    // 4. Draw Feed 4 (LiveU 4)
    drawFeedCanvas('liveu4', canvases.liveu4.ctx, canvases.liveu4.element.width, canvases.liveu4.element.height, framesCount);

    // 5. Draw Feed 5 (VOD Playout)
    drawFeedCanvas('vod', canvases.vod.ctx, canvases.vod.element.width, canvases.vod.element.height, framesCount);

    // 6. Draw Feed 6 (Program Out / PGM)
    const pgmW = canvases.pgm.element.width;
    const pgmH = canvases.pgm.element.height;
    const pgmCtx = canvases.pgm.ctx;
    if (state.activeSource === 'ad') {
      drawStreamAdBreak(pgmCtx, pgmW, pgmH, framesCount);
    } else if (state.activeSource) {
      try {
        pgmCtx.clearRect(0, 0, pgmW, pgmH);
        pgmCtx.drawImage(canvases[state.activeSource].element, 0, 0, pgmW, pgmH);
      } catch (e) {
        if (state.activeSource === 'cam1') drawStreamCam1(pgmCtx, pgmW, pgmH, framesCount, state.unrecoveredLoss);
        else if (state.activeSource === 'cam2' || state.activeSource === 'liveu3' || state.activeSource === 'liveu4') drawStreamCam2(pgmCtx, pgmW, pgmH, framesCount);
        else if (state.activeSource === 'vod') drawStreamVOD(pgmCtx, pgmW, pgmH, framesCount);
        else drawStreamLossStatic(pgmCtx, pgmW, pgmH);
      }
    } else {
      pgmCtx.clearRect(0, 0, pgmW, pgmH);
      pgmCtx.fillStyle = '#020408';
      pgmCtx.fillRect(0, 0, pgmW, pgmH);
      pgmCtx.fillStyle = '#ffffff';
      pgmCtx.font = 'bold 14px Outfit';
      pgmCtx.textAlign = 'center';
      pgmCtx.fillText('NO PROGRAM SOURCE', pgmW / 2, pgmH / 2);
      pgmCtx.textAlign = 'left';
    }

    // 5. Update Stereo VU meters
    updateVUMeters();

    if (framesCount % 15 === 0) {
      updateSourceOverlays();
    }

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
      el.recoText.textContent = "ALERT: Primary contribution path failed. Active-Active failover triggered. Inspect LiveU 1 hardware logs.";
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
    setSourceState('liveu1', 'ALARM');
    el.btnFailPrimary.disabled = true;
    el.btnRestorePrimary.disabled = false;
    
    // Activate Alarm overlays on screen and node graph
    el.alarmOverlayCam1.classList.add('alarm-active');
    
    // Update quick badges
    el.matrixAlarm.textContent = "ALARM: FAIL";
    el.matrixAlarm.className = "badge-value text-red pulse-red";
    
    updateOrchestratorRouting();

    // Log failure
    addLog('alarm', 'SRT', 'Primary contribution encoder connection lost! SRT Socket connection timeout.');
    addLog('warning', 'SWT', 'ST 2022-7 Switcher detected packet flatline on Path A (us-east-1).');

    // Trigger seamless failover switch inside 350ms
    setTimeout(() => {
      if (state.primaryFailed) { // Double check if already restored
        setSourceState('liveu2', 'ONLINE');
        state.activeSource = 'cam2'; // Route backup Cam
        state.programSourceOverride = 'liveu2';
        el.pgmActiveSource.textContent = "SOURCE: LiveU 2 (DR FAILOVER)";
        updateBadges();
        updatePGMFooter();
        updateOrchestratorRouting();
        
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
    setSourceState('liveu1', 'ONLINE');
    el.btnFailPrimary.disabled = false;
    el.btnRestorePrimary.disabled = true;
    
    // Remove alarm overlays
    el.alarmOverlayCam1.classList.remove('alarm-active');
    
    updateOrchestratorRouting();

    addLog('info', 'SRT', 'SRT Contribution Socket re-established. Port 9001 handshake complete.');
    addLog('info', 'SRT', 'Camera-01 stream restored (Bitrate: 6.2 Mbps, Codec: HEVC).');

    // Return switcher back to Primary source (with 1.5s stabilization delay)
    setTimeout(() => {
      if (!state.primaryFailed) {
        setSourceState('liveu2', 'STANDBY');
        state.activeSource = 'cam1';
        state.programSourceOverride = 'liveu1';
        el.pgmActiveSource.textContent = "SOURCE: LiveU 1";
        updateBadges();
        updatePGMFooter();
        updateOrchestratorRouting();
        
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
    state.programSourceOverride = 'ad';
    el.pgmActiveSource.textContent = "SOURCE: AD-LOOP (SCTE-35)";
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    
    // Show countdown banner on PGM screen
    el.adBreakBanner.style.display = 'block';
    
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
      state.programSourceOverride = 'liveu2';
      el.pgmActiveSource.textContent = "SOURCE: LiveU 2 (DR FAILOVER)";
    } else {
      state.activeSource = 'cam1';
      state.programSourceOverride = 'liveu1';
      el.pgmActiveSource.textContent = "SOURCE: LiveU 1";
    }
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    
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
    { id: 'node-card-liveu3', text: '<strong class="text-amber">Camera-03 Source</strong>: Remote LiveU contribution feed. Simulated path reserved for future SRT/WebRTC ingest telemetry.' },
    { id: 'node-card-liveu4', text: '<strong class="text-purple">Camera-04 Source</strong>: Remote LiveU contribution feed. Simulated path reserved for future SRT/WebRTC ingest telemetry.' },
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

  return; // Solo & Mute Buttons in screen card footers
  const feeds = ['cam1', 'cam2', 'liveu3', 'liveu4', 'vod'];
  feeds.forEach(feed => {
    const soloBtn = document.getElementById(`btn-solo-${feed}`);
    const muteBtn = document.getElementById(`btn-mute-${feed}`);
    
    // Solo/Preview action: first click -> PREVIEW, then use TAKE to move to PROGRAM
    soloBtn.addEventListener('click', () => {
      const alreadyPreview = state.previewFeed === feed;

      // Clear previous preview visuals
      document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
      document.querySelectorAll('.screen-card').forEach(c => c.classList.remove('preview-active'));

      if (!alreadyPreview) {
        // Check availability for cams
        if (feed === 'cam1' && !state.cam1VideoReady) {
          addLog('warning', 'MIX', 'Preview request failed: LiveU 1 is OFFLINE/Unavailable.');
          return;
        }
        if (feed === 'cam2' && !state.cam2VideoReady) {
          addLog('warning', 'MIX', 'Preview request failed: LiveU 2 has no file loaded.');
          return;
        }

        // Mark preview
        state.previewFeed = feed;
        soloBtn.classList.add('btn-active-solo');
        const screen = document.getElementById(`screen-${feed}`);
        if (screen) screen.classList.add('preview-active');

        // Dim non-preview screens but keep PGM bright
        feeds.forEach(f => {
          const screenEl = document.getElementById(`screen-${f}`);
          if (!screenEl) return;
          if (f === feed) {
            screenEl.style.opacity = '1.0';
            screenEl.style.boxShadow = '0 0 18px rgba(245, 158, 11, 0.25)';
          } else {
            screenEl.style.opacity = '0.5';
            screenEl.style.boxShadow = 'none';
          }
        });

        addLog('info', 'MIX', `Preview assigned to feed: ${feed.toUpperCase()}. Use TAKE to route to PROGRAM.`);
      } else {
        // Clear preview
        state.previewFeed = null;
        addLog('info', 'MIX', `Preview cleared for feed: ${feed.toUpperCase()}.`);

        // Restore all screens opacity
        feeds.forEach(f => {
          const screen = document.getElementById(`screen-${f}`);
          if (screen) {
            screen.style.opacity = '1.0';
            screen.style.boxShadow = 'none';
            screen.classList.remove('preview-active');
          }
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

  // TAKE button: move preview to PROGRAM
  if (el.btnTake) {
    el.btnTake.addEventListener('click', () => {
      const preview = state.previewFeed;
      if (!preview) {
        addLog('warning', 'MIX', 'TAKE requested but no preview source selected.');
        return;
      }

      // Availability checks
      if (preview === 'cam1' && !state.cam1VideoReady) {
        addLog('warning', 'MIX', 'Cannot TAKE: LiveU 1 is OFFLINE.');
        return;
      }
      if (preview === 'cam2' && !state.cam2VideoReady) {
        addLog('warning', 'MIX', 'Cannot TAKE: LiveU 2 has no file loaded.');
        return;
      }

      // Route preview to program out
      state.activeSource = preview === 'vod' ? 'vod' : preview;

      // Update PGM label
      let label = '';
      if (state.activeSource === 'cam1') label = 'LiveU 1';
      else if (state.activeSource === 'cam2') label = 'LiveU 2';
      else if (state.activeSource === 'liveu3') label = 'LiveU 3';
      else if (state.activeSource === 'liveu4') label = 'LiveU 4';
      else if (state.activeSource === 'vod') label = 'PLAYOUT';
      else label = state.activeSource.toUpperCase();
      el.pgmActiveSource.textContent = `SOURCE: ${label}`;

      addLog('info', 'MIX', `TAKE executed. PROGRAM routed to: ${label}.`);

      // Clear preview visuals
      state.previewFeed = null;
      document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
      document.querySelectorAll('.screen-card').forEach(c => { c.classList.remove('preview-active'); c.style.opacity = '1.0'; c.style.boxShadow = 'none'; });
    });
  }

});
