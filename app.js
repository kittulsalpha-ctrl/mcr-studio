/* ==========================================================================
   CLOUD BROADCAST MCR STUDIO - APPLICATION ENGINE
   Pure ES6 Javascript - High Performance Canvas Graphics & Math Simulations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const programOut = document.getElementById('screen-pgm');
  const programSlot = document.getElementById('program-bus-slot');
  const operationsColumn = document.querySelector('body.workspace-operations .controls-container');
  const graphicsEngine = document.querySelector('body.workspace-operations #screen-vod');
  const txControlSlot = document.getElementById('tx-control-slot');
  const pgmActionBar = document.querySelector('body.workspace-operations .pgm-footer-top');
  const operatorLogPanel = document.querySelector('body.workspace-operations .panel-logs');
  const workspace = document.querySelector('body.workspace-operations .mcr-workspace');
  if (programOut && programSlot) programSlot.append(programOut);
  else if (programOut && operationsColumn) operationsColumn.prepend(programOut);
  if (txControlSlot && pgmActionBar) txControlSlot.append(pgmActionBar);
  if (graphicsEngine && operationsColumn) operationsColumn.prepend(graphicsEngine);
  if (operatorLogPanel && workspace) workspace.append(operatorLogPanel);

  const TILE_FEEDS = ['cam1', 'cam2', 'liveu3', 'liveu4'];
  const LIVEU_SOURCE_IDS = ['liveu1', 'liveu2', 'liveu3', 'liveu4'];
  const SOURCE_DETAILS = {
    liveu1: { label: 'LiveU Feed 1', shortLabel: 'LIVEU 1', codec: 'HEVC', color: '#10b981', rttOffset: 0 },
    liveu2: { label: 'LiveU Feed 2', shortLabel: 'LIVEU 2', codec: 'H.264', color: '#00d2ff', rttOffset: 0 },
    liveu3: { label: 'LiveU Feed 3', shortLabel: 'LIVEU 3', codec: 'H.264', color: '#f59e0b', rttOffset: 3 },
    liveu4: { label: 'LiveU Feed 4', shortLabel: 'LIVEU 4', codec: 'H.264', color: '#a78bfa', rttOffset: 6 }
  };
  const NDI_BRIDGE_ENDPOINT = '/api/ndi/sources';
  const DEFAULT_NDI_SOURCES = {
    ndi1: { label: 'NDI-CAM-01 Field TX', shortLabel: 'NDI CAM 1', codec: 'NDI HX3', resolution: '1080p60', bitrate: 7.6, rttOffset: 8, location: 'Stadium Touchline' },
    ndi2: { label: 'NDI-CAM-02 Interview RF', shortLabel: 'NDI CAM 2', codec: 'NDI HX2', resolution: '1080p30', bitrate: 5.8, rttOffset: 14, location: 'Mixed Zone' },
    ndi3: { label: 'NDI-GFX-01 Scorebug', shortLabel: 'NDI GFX', codec: 'NDI Full', resolution: '1080p60', bitrate: 11.2, rttOffset: 4, location: 'Graphics Node' }
  };
  const NDI_SOURCES = JSON.parse(JSON.stringify(DEFAULT_NDI_SOURCES));
  const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
  const WORKSPACE_STATE_KEY = 'mcr-studio-workspace-state-v1';
  const MEDIA_DB_NAME = 'mcr-studio-media-store';
  const MEDIA_DB_VERSION = 1;
  const MEDIA_STORE_NAME = 'localVideos';
  const REGION_PRESETS = {
    'eu-west-1': { code: 'eu-west-1', label: 'Ireland', encoder: 'Dublin contribution encoder', ingest: 'EU ingest gateway' },
    'eu-west-2': { code: 'eu-west-2', label: 'London', encoder: 'London contribution encoder', ingest: 'UK ingest gateway' },
    'ap-south-1': { code: 'ap-south-1', label: 'Mumbai', encoder: 'Mumbai contribution encoder', ingest: 'India ingest gateway' },
    'us-east-1': { code: 'us-east-1', label: 'Virginia', encoder: 'Virginia contribution encoder', ingest: 'US East ingest gateway' }
  };
  const DEMO_PRESETS = {
    clean: {
      label: 'Clean Startup',
      tileSourceIds: { cam1: 'webcam', cam2: 'localVideo', liveu3: 'liveu3', liveu4: 'liveu4' },
      sourceBaseStates: { liveu1: 'ONLINE', liveu2: 'STANDBY', liveu3: 'ONLINE', liveu4: 'ONLINE' },
      sourceDetections: {},
      customSources: {},
      previewFeed: null,
      activeSource: null,
      programSourceOverride: null,
      mutedFeeds: {},
      primaryFailed: false
    },
    football: {
      label: 'Football MCR Demo',
      tileSourceIds: { cam1: 'liveu1', cam2: 'liveu2', liveu3: 'liveu3', liveu4: 'liveu4' },
      sourceBaseStates: { liveu1: 'ONLINE', liveu2: 'STANDBY', liveu3: 'ONLINE', liveu4: 'ONLINE' },
      sourceDetections: {},
      customSources: {},
      previewFeed: 'liveu3',
      activeSource: 'cam1',
      programSourceOverride: 'liveu1',
      mutedFeeds: {},
      primaryFailed: false
    },
    youtube: {
      label: 'YouTube Live Demo',
      tileSourceIds: { cam1: 'custom', cam2: 'liveu2', liveu3: 'liveu3', liveu4: 'liveu4' },
      sourceBaseStates: { liveu1: 'ONLINE', liveu2: 'STANDBY', liveu3: 'ONLINE', liveu4: 'ONLINE' },
      sourceDetections: {},
      customSources: { cam1: { type: 'youtube', url: DEFAULT_YOUTUBE_URL } },
      previewFeed: null,
      activeSource: 'cam1',
      programSourceOverride: null,
      mutedFeeds: {},
      primaryFailed: false
    },
    failover: {
      label: 'Failover Drill',
      tileSourceIds: { cam1: 'liveu1', cam2: 'liveu2', liveu3: 'liveu3', liveu4: 'liveu4' },
      sourceBaseStates: { liveu1: 'ALARM', liveu2: 'ONLINE', liveu3: 'ONLINE', liveu4: 'ONLINE' },
      sourceDetections: {},
      customSources: {},
      previewFeed: null,
      activeSource: 'cam2',
      programSourceOverride: 'liveu2',
      mutedFeeds: {},
      primaryFailed: true
    },
    adcue: {
      label: 'Ad Cue Drill',
      tileSourceIds: { cam1: 'liveu1', cam2: 'liveu2', liveu3: 'liveu3', liveu4: 'liveu4' },
      sourceBaseStates: { liveu1: 'ONLINE', liveu2: 'STANDBY', liveu3: 'ONLINE', liveu4: 'ONLINE' },
      sourceDetections: {},
      customSources: {},
      previewFeed: 'vod',
      activeSource: 'cam1',
      programSourceOverride: 'liveu1',
      mutedFeeds: {},
      primaryFailed: false
    }
  };

  // ==========================================================================
  // 1. STATE MANAGEMENT
  // ==========================================================================
  const state = {
    // Clock Systems
    localDrift: 0,
    onAirStartedAt: null,
    alarmStartedAt: null,
    regionPreset: localStorage.getItem('mcr-region-preset') || 'us-east-1',
    
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
    backend: {
      enabled: new URLSearchParams(window.location.search).get('backend') === '1',
      connected: false,
      lastState: null,
      eventSource: null,
      applyingRemoteState: false
    },
    cloudTelemetry: null,
    agent: null,

    // Preview / Program state
    previewFeed: null,
    programSourceOverride: null,
    graphicsPreview: null,
    activeGraphics: null,
    tickerOn: false,
    bugOn: false,
    systemModel: {
      chain: ['sources', 'ingest', 'switcher', 'audio', 'cg', 'replay', 'playout', 'encoder', 'packaging', 'distribution'],
      services: {
        sources: { label: 'Contribution Sources', role: 'LiveU / NDI / SRT / WebRTC', instance: 'edge/source-net', status: 'ONLINE', load: 31, latency: 25 },
        ingest: { label: 'Cloud Ingest Gateway', role: 'Receiver / demux / preview proxy', instance: 'ec2-ingest-a', status: 'ONLINE', load: 42, latency: 38 },
        switcher: { label: 'Video Switcher', role: 'Preview/Program router', instance: 'ec2-switcher-gpu-a', status: 'ONLINE', load: 48, latency: 46 },
        audio: { label: 'Audio Mixer', role: 'PGM bus / faders / AFV', instance: 'ec2-audio-a', status: 'ONLINE', load: 26, latency: 18 },
        cg: { label: 'CG Keyer', role: 'Lower-third / ticker / bug', instance: 'ec2-cg-a', status: 'STANDBY', load: 18, latency: 12 },
        replay: { label: 'Replay Server', role: 'ISO record / clip playback', instance: 'ec2-replay-a', status: 'STANDBY', load: 22, latency: 30 },
        playout: { label: 'Playout Server', role: 'Slate / filler / ad loop', instance: 'ec2-playout-a', status: 'STANDBY', load: 16, latency: 24 },
        encoder: { label: 'Program Encoder', role: 'PGM A/V encode', instance: 'ec2-encoder-a', status: 'ONLINE', load: 54, latency: 72 },
        packaging: { label: 'MediaPackage Origin', role: 'HLS / DASH ABR packaging', instance: 'aws-mediapackage-a', status: 'READY', load: 24, latency: 98 },
        distribution: { label: 'CloudFront CDN', role: 'Origin / edge delivery', instance: 'aws-cloudfront-global', status: 'ONLINE', load: 37, latency: 110 }
      }
    },
    audioMixer: {
      audioFollowVideo: true,
      programBus: null,
      channels: {
        cam1: { label: 'MV1 / LiveU 1', fader: 0.82, mute: false, solo: false, pfl: false },
        cam2: { label: 'MV2 / Backup', fader: 0.76, mute: false, solo: false, pfl: false },
        liveu3: { label: 'MV3 / LiveU 3', fader: 0.74, mute: false, solo: false, pfl: false },
        liveu4: { label: 'MV4 / LiveU 4', fader: 0.72, mute: false, solo: false, pfl: false },
        replay: { label: 'Replay EC2', fader: 0.7, mute: true, solo: false, pfl: false },
        playout: { label: 'Playout EC2', fader: 0.68, mute: true, solo: false, pfl: false }
      }
    },
    txSafety: {
      sourceLock: false,
      programProtection: true,
      cleanFeed: false,
      failoverMode: 'AUTO',
      recording: true
    },
    replayPlayout: {
      returnLiveSource: 'cam1',
      replay: {
        source: 'cam1',
        markIn: null,
        markOut: null,
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
      }
    },

    // LiveU Video Source State
    webcamStream: null,
    webcamReady: false,
    cam1VideoReady: false,
    cam2VideoReady: false,
    cam2FileURL: null,
    cam2FileName: null,
    localVideos: {},

    // Media assignments for dynamic source targeting
    mediaAssignments: {
      webcam: 'cam1',
      localVideo: null
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
    // Per-tile custom sources (e.g., RTSP/OBS/HTTP/YouTube URL attachments)
    customSources: {
      // feedId: { type: string, url: string, embedUrl?: string, videoEl?: HTMLVideoElement, frameEl?: HTMLIFrameElement, ready: boolean }
    },
    ndiBridge: {
      discovered: false,
      selectedSourceId: 'ndi1',
      sourceStates: {
        ndi1: 'ONLINE',
        ndi2: 'STANDBY',
        ndi3: 'ONLINE'
      },
      assignments: {}
    },
    programEmbedFrame: null,
    activeEditFeed: null,
    
    // SCTE-35 Ad Splice
    adActive: false,
    adTimeRemaining: 0.0, // seconds
    adIntervalId: null,
    preAdRoute: null,
    
    // Multi-Viewer Settings
    previewFeed: null,
    inspectedFeed: 'cam1',
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
  let isRestoringWorkspaceState = false;
  let isApplyingPreset = false;

  // ==========================================================================
  // 2. DOM ELEMENTS
  // ==========================================================================
  function createMissingElement(id) {
    const noop = () => {};
    const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
    return {
      id,
      __missing: true,
      value: "",
      textContent: "",
      innerHTML: "",
      checked: false,
      disabled: false,
      files: null,
      children: [],
      style: {},
      classList,
      dataset: {},
      parentNode: { getBoundingClientRect: () => ({ width: 0, height: 0 }) },
      addEventListener: noop,
      removeEventListener: noop,
      appendChild: noop,
      append: noop,
      prepend: noop,
      click: noop,
      focus: noop,
      play: () => Promise.resolve(),
      load: noop,
      getContext: () => null,
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      setAttribute: noop,
      removeAttribute: noop
    };
  }

  function byId(id) {
    return document.getElementById(id) || createMissingElement(id);
  }

  function hasElement(element) {
    return element && !element.__missing;
  }

  const el = {
    utcClock: byId("utc-clock"),
    localClock: byId("local-clock"),
    
    totalBw: byId("total-bw-value"),
    txRoute: byId("tx-route-value"),
    matrixAlarm: byId("matrix-alarm-value"),
    systemHealth: byId("system-health-value"),
    onAirValue: byId("on-air-value"),
    onAirTimerValue: byId("on-air-timer-value"),
    controlApiValue: byId("control-api-value"),
    operatingModeValue: byId("operating-mode-value"),
    obsControlStatus: byId("obs-control-status"),
    obsProgramScene: byId("obs-program-scene"),
    obsSceneSelect: byId("obs-scene-select"),
    btnObsTakeScene: byId("btn-obs-take-scene"),
    obsFollowMcrTake: byId("obs-follow-mcr-take"),
    obsMapSource: byId("obs-map-source"),
    obsMapScene: byId("obs-map-scene"),
    btnSaveObsMap: byId("btn-save-obs-map"),
    obsRoutingSummary: byId("obs-routing-summary"),
    
    // Timecodes
    tcCam1: byId("tc-cam1"),
    tcCam2: byId("tc-cam2"),
    tcLiveu3: byId("tc-liveu3"),
    tcLiveu4: byId("tc-liveu4"),
    tcVod: byId("tc-vod"),
    tcPgm: byId("tc-pgm"),
    
    // Screen alarm overlays
    alarmOverlayCam1: byId("alarm-overlay-cam1"),
    adBreakBanner: byId("ad-break-banner"),
    adCountdownVal: byId("ad-countdown-val"),
    pgmActiveSource: byId("pgm-active-source"),
    pgmLatencyVal: byId("pgm-latency-val"),
    
    // Sliders & Telemetry UI
    slideLoss: byId("slide-loss"),
    slideJitter: byId("slide-jitter"),
    slideRtt: byId("slide-rtt"),
    slideBuffer: byId("slide-buffer"),
    
    valLoss: byId("val-loss"),
    valJitter: byId("val-jitter"),
    valRtt: byId("val-rtt"),
    valBuffer: byId("val-buffer"),
    
    overlayCam1Bw: byId("overlay-cam1-bw"),
    overlayCam1Rtt: byId("overlay-cam1-rtt"),
    overlayCam2Bw: byId("overlay-cam2-bw"),
    overlayCam2Rtt: byId("overlay-cam2-rtt"),
    overlayCam1Codec: byId("overlay-cam1-codec"),
    overlayCam1Src: byId("overlay-cam1-src"),
    overlayCam1Res: byId("overlay-cam1-res"),
    overlayCam2Codec: byId("overlay-cam2-codec"),
    overlayCam2Src: byId("overlay-cam2-src"),
    overlayCam2Res: byId("overlay-cam2-res"),
    overlayLiveu3Codec: byId("overlay-liveu3-codec"),
    overlayLiveu3Src: byId("overlay-liveu3-src"),
    overlayLiveu3Res: byId("overlay-liveu3-res"),
    overlayLiveu4Codec: byId("overlay-liveu4-codec"),
    overlayLiveu4Src: byId("overlay-liveu4-src"),
    overlayLiveu4Res: byId("overlay-liveu4-res"),
    btnStartWebcam: byId("btn-start-webcam"),
    btnStopWebcam: byId("btn-stop-webcam"),
    btnLoadLocalVideo: byId("btn-load-local-video"),
    btnEjectVideo: byId("btn-eject-video"),
    selectDemoPreset: byId("select-demo-preset"),
    btnLoadPreset: byId("btn-load-preset"),
    btnCopyPresetLink: byId("btn-copy-preset-link"),
    btnExportScenario: byId("btn-export-scenario"),
    btnImportScenario: byId("btn-import-scenario"),
    scenarioImportInput: byId("scenario-import-input"),
    presetLinkStatus: byId("preset-link-status"),
    selectWebcamTarget: byId("select-webcam-target"),
    selectVideoTarget: byId("select-video-target"),
    localVideoFileInput: byId("local-video-file-input"),
    actionStatus: byId("action-status"),
    cam1Video: byId("video-cam1"),
    cam2Video: byId("video-cam2"),
    btnTake: byId("btn-take"),
    btnCut: byId("btn-cut"),
    btnFadeBlack: byId("btn-fade-black"),
    btnClearProgram: byId("btn-clear-program"),
    btnEmergencyBackup: byId("btn-emergency-backup"),
    btnPreviewLowerThird: byId("btn-preview-lower-third"),
    btnTakeGraphics: byId("btn-take-graphics"),
    btnToggleTicker: byId("btn-toggle-ticker"),
    btnToggleBug: byId("btn-toggle-bug"),
    btnClearGraphics: byId("btn-clear-graphics"),
    cgEngineLayer: byId("cg-engine-layer"),
    badgeStateCam1: byId("badge-state-cam1"),
    badgeStateCam2: byId("badge-state-cam2"),
    badgeStateLiveu3: byId("badge-state-liveu3"),
    badgeStateLiveu4: byId("badge-state-liveu4"),
    overlayLiveu3Bw: byId("overlay-liveu3-bw"),
    overlayLiveu3Rtt: byId("overlay-liveu3-rtt"),
    overlayLiveu4Bw: byId("overlay-liveu4-bw"),
    overlayLiveu4Rtt: byId("overlay-liveu4-rtt"),
    
    recoBox: byId("reco-box"),
    recoIcon: byId("reco-icon"),
    recoText: byId("reco-text"),
    chartAlarmOverlay: byId("chart-alarm-overlay"),
    
    // Buttons
    btnFailPrimary: byId("btn-fail-primary"),
    btnRestorePrimary: byId("btn-restore-primary"),
    btnInjectScte: byId("btn-inject-scte"),
    btnCancelScte: byId("btn-cancel-scte"),
    
    // Logs
    consoleLogs: byId("console-logs"),
    btnClearLogs: byId("btn-clear-logs"),
    filterAll: byId("filter-all"),
    filterInfo: byId("filter-info"),
    filterWarning: byId("filter-warning"),
    filterAlarm: byId("filter-alarm"),
    logTagFilter: byId("log-tag-filter"),
    logSearchInput: byId("log-search-input"),
    sourceUrlModal: byId("source-url-modal"),
    sourceUrlInput: byId("source-url-input"),
    sourceUrlAttach: byId("source-url-attach"),
    sourceUrlClose: byId("source-url-close"),
    sourceUrlTarget: byId("source-url-target"),
    btnScanNdi: byId("btn-scan-ndi"),
    ndiSourceSelect: byId("ndi-source-select"),
    ndiBridgeStatus: byId("ndi-bridge-status"),
    ndiBridgeHint: byId("ndi-bridge-hint"),
    
    // Node SVG elements
    rectSwitcher: byId("rect-switcher"),
    rectMediaLive: byId("rect-medialive"),
    rectCdn: byId("rect-cdn"),
    textSwitcherStatus: byId("text-switcher-status"),
    pathCam1: byId("path-cam1"),
    pathCam2: byId("path-cam2"),
    pathLiveu3: byId("path-liveu3"),
    pathLiveu4: byId("path-liveu4"),
    pathVod: byId("path-vod"),
    pathSwitchToTrans: byId("path-switch-to-trans"),
    pathTransToCdn: byId("path-trans-to-cdn"),
    dotCam1: byId("dot-cam1"),
    dotCam2: byId("dot-cam2"),
    dotLiveu3: byId("dot-liveu3"),
    dotLiveu4: byId("dot-liveu4"),
    dotVod: byId("dot-vod"),
    dotSwitch: byId("dot-switch"),
    dotTrans: byId("dot-trans"),
    inspectorText: byId("inspector-text"),
    sourceInspectorTile: byId("source-inspector-tile"),
    sourceInspectorRoute: byId("source-inspector-route"),
    sourceInspectorState: byId("source-inspector-state"),
    sourceInspectorPreview: byId("source-inspector-preview"),
    sourceInspectorProgram: byId("source-inspector-program"),
    sourceInspectorAudio: byId("source-inspector-audio"),
    sourceInspectorSignal: byId("source-inspector-signal"),
    sourceInspectorMeta: byId("source-inspector-meta"),
    aiOpsSummary: byId("ai-ops-summary"),
    aiOpsList: byId("ai-ops-list"),
    incidentStatusBadge: byId("incident-status-badge"),
    incidentCurrentState: byId("incident-current-state"),
    incidentCurrentDetail: byId("incident-current-detail"),
    incidentRecommendation: byId("incident-recommendation"),
    btnIncidentPreviewBackup: byId("btn-incident-preview-backup"),
    btnIncidentTakeBackup: byId("btn-incident-take-backup"),
    btnIncidentResolve: byId("btn-incident-resolve"),
    btnIncidentSummary: byId("btn-incident-summary"),
    activeAlarmState: byId("active-alarm-state"),
    activeAlarmCount: byId("active-alarm-count"),
    activeAlarmSummary: byId("active-alarm-summary"),
    alarmCriticalCount: byId("alarm-critical-count"),
    alarmWarningCount: byId("alarm-warning-count"),
    alarmInfoCount: byId("alarm-info-count"),
    alarmAffectedService: byId("alarm-affected-service"),
    alarmDuration: byId("alarm-duration"),
    alarmRecommendedAction: byId("alarm-recommended-action"),
    audioMixerChannels: byId("audio-mixer-channels"),
    audioAfvToggle: byId("audio-afv-toggle"),
    audioPgmBus: byId("audio-pgm-bus"),
    audioPgmStatus: byId("audio-pgm-status"),
    audioPgmMeterL: byId("audio-pgm-meter-l"),
    audioPgmMeterR: byId("audio-pgm-meter-r"),
    cloudTopologyBody: byId("cloud-topology-body"),
    replayServerStatus: byId("replay-server-status"),
    replaySourceSelect: byId("replay-source-select"),
    replayClipSelect: byId("replay-clip-select"),
    btnReplayMarkIn: byId("btn-replay-mark-in"),
    btnReplayMarkOut: byId("btn-replay-mark-out"),
    btnReplayCreate: byId("btn-replay-create"),
    btnPreviewReplay: byId("btn-preview-replay"),
    btnTakeReplay: byId("btn-take-replay"),
    btnReturnLiveReplay: byId("btn-return-live-replay"),
    playoutServerStatus: byId("playout-server-status"),
    playoutAssetSelect: byId("playout-asset-select"),
    playoutAssetStatus: byId("playout-asset-status"),
    btnPreviewPlayout: byId("btn-preview-playout"),
    btnTakePlayout: byId("btn-take-playout"),
    btnReturnLivePlayout: byId("btn-return-live-playout"),
    engInputStatus: byId("eng-input-status"),
    engInputDetail: byId("eng-input-detail"),
    engTelemetrySource: byId("eng-telemetry-source"),
    engGatewayStatus: byId("eng-gateway-status"),
    engGatewayDetail: byId("eng-gateway-detail"),
    engObsStatus: byId("eng-obs-status"),
    engObsDetail: byId("eng-obs-detail"),
    engAgentStatus: byId("eng-agent-status"),
    engAgentDetail: byId("eng-agent-detail"),
    engMediaConnectStatus: byId("eng-mediaconnect-status"),
    engMediaConnectDetail: byId("eng-mediaconnect-detail"),
    engMediaLiveStatus: byId("eng-medialive-status"),
    engMediaLiveDetail: byId("eng-medialive-detail"),
    engMediaPackageStatus: byId("eng-mediapackage-status"),
    engMediaPackageDetail: byId("eng-mediapackage-detail"),
    engCdnStatus: byId("eng-cdn-status"),
    engCdnDetail: byId("eng-cdn-detail"),
    engPathStatus: byId("eng-path-status"),
    engPathDetail: byId("eng-path-detail"),
    engNetworkStatus: byId("eng-network-status"),
    engNetworkDetail: byId("eng-network-detail"),
    engRegionStatus: byId("eng-region-status"),
    engRegionDetail: byId("eng-region-detail"),
    svcSrtStatus: byId("svc-srt-status"),
    svcSrtMetric: byId("svc-srt-metric"),
    svcMediaConnectStatus: byId("svc-mediaconnect-status"),
    svcMediaConnectMetric: byId("svc-mediaconnect-metric"),
    svcMediaLiveStatus: byId("svc-medialive-status"),
    svcMediaLiveMetric: byId("svc-medialive-metric"),
    svcMediaPackageStatus: byId("svc-mediapackage-status"),
    svcMediaPackageMetric: byId("svc-mediapackage-metric"),
    svcOriginStatus: byId("svc-origin-status"),
    svcOriginMetric: byId("svc-origin-metric"),
    svcCdnStatus: byId("svc-cdn-status"),
    svcCdnMetric: byId("svc-cdn-metric"),
    svcEncoderStatus: byId("svc-encoder-status"),
    svcEncoderMetric: byId("svc-encoder-metric"),
    svcProbeStatus: byId("svc-probe-status"),
    svcProbeMetric: byId("svc-probe-metric"),
    drPrimaryMonitor: byId("dr-primary-monitor"),
    drBackupMonitor: byId("dr-backup-monitor"),
    scteNextMonitor: byId("scte-next-monitor"),
    scteWindowMonitor: byId("scte-window-monitor"),
    signalFlowSource: byId("signal-flow-source"),
    signalFlowTransport: byId("signal-flow-transport"),
    signalFlowMediaConnect: byId("signal-flow-mediaconnect"),
    signalFlowSwitcher: byId("signal-flow-switcher"),
    signalFlowMediaLive: byId("signal-flow-medialive"),
    signalFlowMediaPackage: byId("signal-flow-mediapackage"),
    signalFlowCdn: byId("signal-flow-cdn"),
    routeSummaryProgram: byId("route-summary-program"),
    routeSummaryPreview: byId("route-summary-preview"),
    routeSummaryPath: byId("route-summary-path"),
    opRouteSource: byId("op-route-source"),
    opRoutePreview: byId("op-route-preview"),
    opRouteIngest: byId("op-route-ingest"),
    opRouteEncoder: byId("op-route-encoder"),
    opRouteCdn: byId("op-route-cdn"),
    opRoutePath: byId("op-route-path"),
    opRouteRegion: byId("op-route-region"),
    workflowConfiguredCount: byId("workflow-configured-count"),
    workflowPreviewSource: byId("workflow-preview-source"),
    workflowProgramSource: byId("workflow-program-source"),
    workflowMonitorState: byId("workflow-monitor-state"),
    workflowLastEvent: byId("workflow-last-event"),
    setupSummaryCam1: byId("setup-summary-cam1"),
    setupSummaryCam1State: byId("setup-summary-cam1-state"),
    setupSummaryCam2: byId("setup-summary-cam2"),
    setupSummaryCam2State: byId("setup-summary-cam2-state"),
    setupSummaryLiveu3: byId("setup-summary-liveu3"),
    setupSummaryLiveu3State: byId("setup-summary-liveu3-state"),
    setupSummaryLiveu4: byId("setup-summary-liveu4"),
    setupSummaryLiveu4State: byId("setup-summary-liveu4-state"),
    regionValue: byId("region-value"),
    regionPresetSelect: byId("region-preset-select"),
    setupRegionLabel: byId("setup-region-label"),
    deliveryStatus: byId("delivery-status"),
    deliveryDetail: byId("delivery-detail"),
    tcPreview: byId("tc-preview"),
    previewActiveSource: byId("preview-active-source"),
    previewStatus: byId("preview-status"),
    previewEmptyState: byId("preview-empty-state"),
    txControlState: byId("tx-control-state"),
    txPathStatus: byId("tx-path-status"),
    txFailoverMode: byId("tx-failover-mode"),
    txRecordingStatus: byId("tx-recording-status"),
    txEncoderLadder: byId("tx-encoder-ladder"),
    toggleSourceLock: byId("toggle-source-lock"),
    toggleProgramProtect: byId("toggle-program-protect"),
    toggleAfvPanel: byId("toggle-afv-panel"),
    btnToggleCleanFeed: byId("btn-toggle-clean-feed"),
    btnToggleFailoverMode: byId("btn-toggle-failover-mode"),
    btnToggleRecording: byId("btn-toggle-recording"),
    scteTimelineProgress: byId("scte-timeline-progress"),
    scteTimelineLabel: byId("scte-timeline-label"),
    
    // VU meters
    vu: {
      cam1L: byId("vu-cam1-l"),
      cam1R: byId("vu-cam1-r"),
      cam1LPeak: byId("vu-cam1-l-peak"),
      cam1RPeak: byId("vu-cam1-r-peak"),
      
      cam2L: byId("vu-cam2-l"),
      cam2R: byId("vu-cam2-r"),
      cam2LPeak: byId("vu-cam2-l-peak"),
      cam2RPeak: byId("vu-cam2-r-peak"),
      
      liveu3L: byId("vu-liveu3-l"),
      liveu3R: byId("vu-liveu3-r"),
      liveu3LPeak: byId("vu-liveu3-l-peak"),
      liveu3RPeak: byId("vu-liveu3-r-peak"),
      
      liveu4L: byId("vu-liveu4-l"),
      liveu4R: byId("vu-liveu4-r"),
      liveu4LPeak: byId("vu-liveu4-l-peak"),
      liveu4RPeak: byId("vu-liveu4-r-peak"),
      
      vodL: byId("vu-vod-l"),
      vodR: byId("vu-vod-r"),
      vodLPeak: byId("vu-vod-l-peak"),
      vodRPeak: byId("vu-vod-r-peak"),
      
      pgmL: byId("vu-pgm-l"),
      pgmR: byId("vu-pgm-r"),
      pgmLPeak: byId("vu-pgm-l-peak"),
      pgmRPeak: byId("vu-pgm-r-peak")
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

    if (el.onAirTimerValue) {
      el.onAirTimerValue.textContent = state.onAirStartedAt
        ? formatElapsedTime(now.getTime() - state.onAirStartedAt)
        : '00:00:00';
      el.onAirTimerValue.className = `badge-value ${state.onAirStartedAt ? 'text-red' : 'text-muted'}`;
    }
  }

  function formatElapsedTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
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
    renderOperatorWorkflowStatus();
    renderAIOpsAssistant();
  }

  function updateBackendStatus(connected, label = null) {
    state.backend.connected = connected;
    if (el.controlApiValue) {
      el.controlApiValue.textContent = label || (state.backend.enabled ? connected ? 'LIVE' : 'OFFLINE' : 'SIM');
      el.controlApiValue.className = `badge-value ${connected ? 'text-green' : state.backend.enabled ? 'text-red' : 'text-amber'}`;
    }
    updateOperatingMode();
  }

  function updateOperatingMode() {
    if (!el.operatingModeValue) return;
    const hasLiveTelemetry = state.backend.connected && state.cloudTelemetry?.mode === 'LIVE';
    const value = hasLiveTelemetry ? 'LIVE DATA' : state.backend.connected ? 'DEMO API' : state.backend.enabled ? 'API OFFLINE' : 'DEMO';
    const className = hasLiveTelemetry ? 'text-green' : state.backend.connected ? 'text-blue' : state.backend.enabled ? 'text-red' : 'text-amber';
    el.operatingModeValue.textContent = value;
    el.operatingModeValue.className = `badge-value ${className}`;
  }

  function renderObsControl() {
    const obs = state.obs;
    const connected = obs?.status === 'CONNECTED';
    if (el.obsControlStatus) {
      el.obsControlStatus.textContent = connected ? 'CONNECTED' : obs?.status || 'NOT CONNECTED';
      el.obsControlStatus.className = connected ? 'badge-green font-fira' : 'badge-amber font-fira';
    }
    if (el.obsProgramScene) el.obsProgramScene.textContent = `PROGRAM: ${obs?.programScene || 'NOT CONNECTED'}`;
    if (el.obsSceneSelect) {
      const current = el.obsSceneSelect.value;
      el.obsSceneSelect.replaceChildren(...(obs?.scenes || []).map(scene => new Option(scene, scene)));
      if (!el.obsSceneSelect.options.length) el.obsSceneSelect.add(new Option('No OBS scenes available', ''));
      if ((obs?.scenes || []).includes(current)) el.obsSceneSelect.value = current;
      else if (obs?.programScene) el.obsSceneSelect.value = obs.programScene;
      el.obsSceneSelect.disabled = !connected;
    }
    if (el.btnObsTakeScene) el.btnObsTakeScene.disabled = !connected;
    if (el.obsFollowMcrTake) {
      el.obsFollowMcrTake.checked = !!obs?.followMcrTake;
      el.obsFollowMcrTake.disabled = !connected;
    }
    if (el.obsMapScene) {
      const source = el.obsMapSource?.value || 'cam1';
      const mappedScene = obs?.mappings?.[source] || '';
      el.obsMapScene.replaceChildren(new Option('No OBS scene mapped', ''), ...(obs?.scenes || []).map(scene => new Option(scene, scene)));
      el.obsMapScene.value = mappedScene;
      el.obsMapScene.disabled = !connected;
    }
    if (el.btnSaveObsMap) el.btnSaveObsMap.disabled = !connected;
    if (el.obsRoutingSummary) {
      const mapped = Object.entries(obs?.mappings || {}).filter(([, scene]) => scene).length;
      el.obsRoutingSummary.textContent = `MCR to OBS follow: ${obs?.followMcrTake ? 'ARMED' : 'DISARMED'} · ${mapped} MAP${mapped === 1 ? '' : 'S'}`;
      el.obsRoutingSummary.className = obs?.followMcrTake ? 'font-fira text-amber' : 'font-fira';
    }
  }

  function hydratePageSwitcherLinks() {
    const suffix = `${window.location.search || ''}${window.location.hash || ''}`;
    document.getElementById('nav-operations')?.setAttribute('href', `index.html${suffix}`);
    document.getElementById('nav-monitoring')?.setAttribute('href', `monitoring.html${suffix}`);
    document.getElementById('nav-setup')?.setAttribute('href', `setup.html${suffix}`);
  }

  async function backendCommand(endpoint, payload = {}) {
    if (!state.backend.enabled) return null;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      updateBackendStatus(response.ok);
      if (!response.ok) {
        addLog('warning', 'API', `Backend command failed: ${json.error || endpoint}.`);
      }
      if (response.ok && json.state) applyBackendState(json.state);
      return json;
    } catch (error) {
      updateBackendStatus(false);
      addLog('warning', 'API', `Backend unavailable: ${error.message}.`);
      return null;
    }
  }

  function formatBackendTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp || '--:--:-- UTC';
    return [
      String(date.getUTCHours()).padStart(2, '0'),
      String(date.getUTCMinutes()).padStart(2, '0'),
      String(date.getUTCSeconds()).padStart(2, '0')
    ].join(':') + ' UTC';
  }

  function mapBackendLog(entry) {
    return {
      timestamp: formatBackendTimestamp(entry.timestamp),
      severity: entry.severity || 'info',
      tag: entry.area || entry.tag || 'API',
      message: entry.operatorAction ? `${entry.message} (${entry.operatorAction})` : entry.message
    };
  }

  function updatePreviewClassesFromState() {
    document.querySelectorAll('.btn-solo').forEach(button => button.classList.remove('btn-active-solo'));
    document.querySelectorAll('.screen-card').forEach(card => card.classList.remove('preview-active'));
    if (!state.previewFeed) return;
    document.getElementById(`btn-solo-${state.previewFeed}`)?.classList.add('btn-active-solo');
    document.getElementById(`screen-${state.previewFeed}`)?.classList.add('preview-active');
  }

  function applyBackendState(remoteState) {
    if (!remoteState || state.backend.applyingRemoteState) return;
    state.backend.applyingRemoteState = true;
    state.backend.lastState = remoteState;

    state.previewFeed = remoteState.routing?.preview || null;
    state.activeSource = remoteState.routing?.program || null;
    state.programSourceOverride = null;
    state.replayPlayout.returnLiveSource = remoteState.routing?.returnLive || state.replayPlayout.returnLiveSource;
    state.cloudTelemetry = remoteState.telemetry || state.cloudTelemetry;
    state.obs = remoteState.obs || state.obs;
    state.agent = remoteState.agent || state.agent;
    renderObsControl();
    updateOperatingMode();

    if (remoteState.audio) {
      state.audioMixer.audioFollowVideo = !!remoteState.audio.followVideo;
      state.audioMixer.programBus = remoteState.audio.programBus || null;
      Object.entries(remoteState.audio.channels || {}).forEach(([feed, channel]) => {
        if (!state.audioMixer.channels[feed]) return;
        state.audioMixer.channels[feed] = { ...state.audioMixer.channels[feed], ...channel };
      });
    }

    if (remoteState.graphics) {
      state.graphicsPreview = remoteState.graphics.preview || null;
      state.activeGraphics = remoteState.graphics.active || null;
      state.tickerOn = !!remoteState.graphics.ticker;
      state.bugOn = !!remoteState.graphics.bug;
    }

    if (remoteState.replay) {
      state.replayPlayout.replay.selectedClip = remoteState.replay.selectedClip || state.replayPlayout.replay.selectedClip;
      state.replayPlayout.replay.clips = Array.isArray(remoteState.replay.clips)
        ? remoteState.replay.clips
        : state.replayPlayout.replay.clips;
    }
    if (remoteState.playout) {
      state.replayPlayout.playout.selectedAsset = remoteState.playout.selectedAsset || state.replayPlayout.playout.selectedAsset;
      state.replayPlayout.playout.assets = Array.isArray(remoteState.playout.assets)
        ? remoteState.playout.assets
        : state.replayPlayout.playout.assets;
    }

    const sourceMap = {
      cam1: 'liveu1',
      cam2: 'liveu2',
      liveu3: 'liveu3',
      liveu4: 'liveu4'
    };
    Object.entries(sourceMap).forEach(([remoteId, localId]) => {
      const remoteSource = remoteState.sources?.[remoteId];
      if (remoteSource?.state) {
        state.sourceBaseStates[localId] = remoteSource.state === 'READY' ? 'ONLINE' : remoteSource.state;
        state.sourceStates[localId] = deriveSourceState(localId);
      }
    });
    Object.entries(remoteState.detections || {}).forEach(([sourceId, detections]) => {
      if (!state.sourceDetections[sourceId]) return;
      state.sourceDetections[sourceId] = { ...state.sourceDetections[sourceId], ...detections };
      state.sourceStates[sourceId] = deriveSourceState(sourceId);
    });

    if (Array.isArray(remoteState.logs)) {
      state.logs = remoteState.logs.slice(-100).map(mapBackendLog);
    }

    updatePreviewClassesFromState();
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
    updateGraphicsUI();
    updateSourceStateControls();
    updateDetectionControls();
    updateSourceOverlays();
    updateOrchestratorRouting();
    syncProgramEmbed();
    updateSourceInspector();
    renderReplayPlayoutServers();
    renderAudioMixer();
    renderLogs();
    renderAIOpsAssistant();
    if (el.pgmActiveSource) {
      el.pgmActiveSource.textContent = `SOURCE: ${state.activeSource ? getProgramRouteLabel(state.activeSource) : 'NONE'}`;
    }

    state.backend.applyingRemoteState = false;
  }

  async function connectBackendOrchestrator() {
    if (!state.backend.enabled) {
      updateBackendStatus(false, 'SIM');
      return;
    }
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      applyBackendState(await response.json());
      updateBackendStatus(true);
      addLog('info', 'API', 'Control Orchestrator backend connected.');
      state.backend.eventSource = new EventSource('/api/events');
      state.backend.eventSource.addEventListener('state', event => {
        applyBackendState(JSON.parse(event.data));
        updateBackendStatus(true);
      });
      state.backend.eventSource.onerror = () => updateBackendStatus(false);
    } catch (error) {
      updateBackendStatus(false);
      addLog('warning', 'API', `Control Orchestrator backend not connected: ${error.message}.`);
    }
  }

  function logMatchesTimelineFilter(log, filter) {
    if (filter === 'all') return true;
    if (filter === 'alarm') return log.severity === 'alarm';
    if (filter === 'operator') return ['MIX', 'MUX', 'ROUTE', 'WEB', 'VIDEO', 'NDI', 'INSP', 'CG', 'AUDIO', 'REPLAY', 'PLYT', 'API'].includes(log.tag);
    if (filter === 'cloud') return ['SRT', 'SWT', 'TRANS', 'CDN', 'SRC'].includes(log.tag);
    if (filter === 'ai') return log.tag === 'AI';
    if (filter === 'scte') return log.tag === 'SCTE' || log.tag === 'PLYT';
    return log.severity === filter;
  }

  function renderLogs() {
    const activeFilter = document.querySelector('.logs-filter-group .btn-filter.filter-active')?.getAttribute('data-filter') || 'all';
    const activeTag = el.logTagFilter?.value || 'all';
    const searchTerm = (el.logSearchInput?.value || '').trim().toLowerCase();
    el.consoleLogs.innerHTML = '';
    let visibleCount = 0;
    
    state.logs.forEach(log => {
      if (!logMatchesTimelineFilter(log, activeFilter)) return;
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
  document.querySelectorAll('.logs-filter-group .btn-filter[data-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.logs-filter-group .btn-filter[data-filter]').forEach(f => f.classList.remove('filter-active'));
      e.target.classList.add('filter-active');
      renderLogs();
    });
  });

  el.btnClearLogs?.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
    renderOperatorWorkflowStatus();
  });

  el.logTagFilter?.addEventListener('change', renderLogs);
  el.logSearchInput?.addEventListener('input', renderLogs);

  el.audioAfvToggle?.addEventListener('change', event => {
    state.audioMixer.audioFollowVideo = event.target.checked;
    addLog('info', 'AUDIO', `Audio Follow Video ${state.audioMixer.audioFollowVideo ? 'enabled' : 'disabled'}.`);
    syncAudioFollowVideo('Follow Video enabled');
    backendCommand('/api/audio-afv', { enabled: state.audioMixer.audioFollowVideo });
    renderAudioMixer();
    renderTxSafety();
    renderEngineeringDashboard();
  });

  el.audioMixerChannels?.addEventListener('input', event => {
    const row = event.target.closest('[data-audio-feed]');
    const feed = row?.dataset.audioFeed;
    if (!feed || event.target.dataset.audioAction !== 'fader') return;
    state.audioMixer.channels[feed].fader = Number(event.target.value);
    backendCommand('/api/audio-fader', { source: feed, value: state.audioMixer.channels[feed].fader });
    renderAudioMixer();
  });

  el.audioMixerChannels?.addEventListener('click', event => {
    const button = event.target.closest('[data-audio-action]');
    const row = event.target.closest('[data-audio-feed]');
    const feed = row?.dataset.audioFeed;
    if (!button || !feed) return;
    const channel = state.audioMixer.channels[feed];
    const action = button.dataset.audioAction;
    if (action === 'pgm') {
      state.audioMixer.audioFollowVideo = false;
      setProgramAudioFeed(feed, 'manual mixer');
      addLog('info', 'AUDIO', `Manual PGM audio selected: ${channel.label}.`);
    }
    if (action === 'mute') {
      channel.mute = !channel.mute;
      addLog('info', 'AUDIO', `${channel.label} ${channel.mute ? 'muted' : 'unmuted'} in audio mixer.`);
    }
    if (action === 'solo') {
      channel.solo = !channel.solo;
      addLog('info', 'AUDIO', `${channel.label} ${channel.solo ? 'soloed' : 'solo cleared'} in audio mixer.`);
    }
    if (action === 'pfl') {
      channel.pfl = !channel.pfl;
      addLog('info', 'AUDIO', `${channel.label} ${channel.pfl ? 'PFL enabled' : 'PFL cleared'}.`);
    }
    renderAudioMixer();
    renderEngineeringDashboard();
  });

  function getRequestedWorkspace() {
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('setup.html')) {
      return 'setup';
    }
    if (path.endsWith('monitoring.html')) {
      return 'monitoring';
    }
    return 'operations';
  }

  function setWorkspaceView(view = 'operations') {
    const activeView = ['operations', 'monitoring', 'setup'].includes(view) ? view : 'operations';
    document.querySelectorAll('.operator-view-tab').forEach(button => {
      button.classList.toggle('view-tab-active', button.dataset.workspace === activeView);
    });
    document.querySelectorAll('[data-workspace-panel]').forEach(panel => {
      panel.classList.toggle('panel-hidden', activeView !== 'setup' && panel.dataset.workspacePanel !== activeView);
    });
    document.body.classList.toggle('workspace-monitoring', activeView === 'monitoring');
    document.body.classList.toggle('workspace-operations', activeView === 'operations');
    document.body.classList.toggle('workspace-setup', activeView === 'setup');
  }

  document.querySelectorAll('.operator-view-tab').forEach(button => {
    button.addEventListener('click', event => {
      const href = button.getAttribute('href');
      if (href && !href.startsWith('#')) return;
      event.preventDefault();
      setWorkspaceView(button.dataset.workspace || 'operations');
    });
  });

  function handleRundownCue(action, source) {
    if (action === 'preview') {
      setPreview(source);
      addLog('info', 'ROUTE', `Rundown cue previewed: ${getTileName(source)}.`);
      return;
    }
    if (action === 'take') {
      setPreview(source);
      routePreviewToProgram('RUNDOWN TAKE');
      return;
    }
    if (action === 'graphics') {
      if (!state.graphicsPreview) previewGraphic('lowerThird');
      takeGraphic();
      addLog('info', 'CG', 'Rundown keyed lower-third graphics over Program.');
      return;
    }
    if (action === 'preview-graphic') {
      previewGraphic('lowerThird');
      addLog('info', 'CG', 'Rundown previewed lower-third graphics.');
      return;
    }
    if (action === 'scte') {
      el.btnInjectScte?.click();
      addLog('info', 'SCTE', 'Rundown triggered SCTE/ad break marker.');
      return;
    }
    if (action === 'backup') {
      routeEmergencyBackup();
    }
  }

  document.querySelectorAll('[data-cue-action]').forEach(button => {
    button.addEventListener('click', event => {
      const cue = event.target.closest('.rundown-cue');
      handleRundownCue(button.dataset.cueAction, cue?.dataset.cueSource || 'vod');
    });
  });

  function teardownLocalVideo(feed) {
    const local = state.localVideos[feed];
    if (!local) return false;
    local.videoEl.pause();
    local.videoEl.removeAttribute('src');
    local.videoEl.load();
    local.videoEl.remove();
    URL.revokeObjectURL(local.url);
    delete state.localVideos[feed];
    if (state.mediaAssignments.localVideo === feed) state.mediaAssignments.localVideo = null;
    if (feed === 'cam2') {
      state.cam2VideoReady = false;
      state.cam2FileURL = null;
      state.cam2FileName = null;
    }
    return true;
  }

  function teardownAllLocalVideos() {
    Object.keys(state.localVideos).forEach(feed => teardownLocalVideo(feed));
  }

  function openMediaStore() {
    if (!window.indexedDB) return Promise.reject(new Error('IndexedDB is not available'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'feed' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open media store'));
    });
  }

  async function savePersistedLocalVideo(feed, file) {
    try {
      const db = await openMediaStore();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
        tx.objectStore(MEDIA_STORE_NAME).put({
          feed,
          fileName: file.name,
          type: file.type || 'video/mp4',
          savedAt: new Date().toISOString(),
          blob: file
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Unable to save local video'));
      });
      db.close();
    } catch (error) {
      addLog('warning', 'VIDEO', `Local file assigned, but browser media persistence failed: ${error.message}`);
    }
  }

  async function getPersistedLocalVideo(feed) {
    try {
      const db = await openMediaStore();
      const entry = await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
        const request = tx.objectStore(MEDIA_STORE_NAME).get(feed);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Unable to read local video'));
      });
      db.close();
      return entry;
    } catch (error) {
      addLog('warning', 'VIDEO', `Unable to restore persisted local video: ${error.message}`);
      return null;
    }
  }

  async function deletePersistedLocalVideo(feed) {
    try {
      const db = await openMediaStore();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
        tx.objectStore(MEDIA_STORE_NAME).delete(feed);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Unable to clear local video'));
      });
      db.close();
    } catch (error) {
      console.warn('Unable to clear persisted local video', error);
    }
  }

  function attachLocalVideoBlob(feed, blob, fileName, { persistFile = null, restored = false } = {}) {
    if (!feed || !blob) return;
    if (!restored && getFeedAssignment(feed) === 'localVideo') {
      handleConfiguredSourceChange(feed, state.tileSourceIds[feed], state.tileSourceIds[feed], 'its local file changed', { force: true });
    }
    teardownLocalVideo(feed);
    const url = URL.createObjectURL(blob);
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.className = 'hidden-video';
    videoEl.src = url;
    document.body.appendChild(videoEl);
    state.localVideos[feed] = { fileName, url, videoEl, ready: false };
    if (feed === 'cam2') {
      state.cam2FileName = fileName;
      state.cam2FileURL = url;
      state.cam2VideoReady = false;
    }
    videoEl.addEventListener('loadedmetadata', () => {
      if (!state.localVideos[feed]) return;
      state.localVideos[feed].ready = true;
      if (feed === 'cam2') state.cam2VideoReady = true;
      updateSourceOverlays();
      updateTAKEButton();
      updateBadges();
      updateOrchestratorRouting();
      renderOperatorWorkflowStatus();
    }, { once: true });
    videoEl.load();
    videoEl.play().catch(() => {});
    assignMediaTarget('localVideo', feed);
    if (persistFile) savePersistedLocalVideo(feed, persistFile);
    updateSourceOverlays();
    addLog('info', 'VIDEO', `${restored ? 'Restored' : 'Local file loaded to'} ${getTileName(feed)}: ${fileName}`);
  }

  async function restorePersistedLocalVideosIfNeeded() {
    const restoreTargets = TILE_FEEDS.filter(feed => getFeedAssignment(feed) === 'localVideo' && !state.localVideos[feed]);
    await Promise.all(restoreTargets.map(async feed => {
      const entry = await getPersistedLocalVideo(feed);
      if (entry?.blob) {
        attachLocalVideoBlob(feed, entry.blob, entry.fileName || 'Restored local video', { restored: true });
      } else {
        addLog('warning', 'VIDEO', `${getTileName(feed)} is assigned to Local File, but no browser-stored file is available. Reload it in Setup.`);
      }
    }));
  }

  function getVideoResolution(video) {
    return (video && video.videoWidth && video.videoHeight)
      ? `${video.videoWidth}x${video.videoHeight}`
      : 'N/A';
  }

  function getCanvasWrapper(feed) {
    return document.querySelector(`#screen-${feed} .canvas-wrapper`);
  }

  function isYouTubeHost(hostname) {
    return /(^|\.)youtube\.com$/i.test(hostname) || /(^|\.)youtu\.be$/i.test(hostname) || /(^|\.)youtube-nocookie\.com$/i.test(hostname);
  }

  function buildYouTubeEmbedUrl(rawUrl) {
    let parsed;
    try {
      parsed = new URL(rawUrl.trim());
    } catch (error) {
      return null;
    }

    if (!isYouTubeHost(parsed.hostname)) return null;

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let videoId = '';
    let channelId = '';

    if (parsed.hostname.includes('youtu.be')) {
      videoId = pathParts[0] || '';
    } else if (parsed.searchParams.get('v')) {
      videoId = parsed.searchParams.get('v');
    } else if (pathParts[0] === 'embed' && pathParts[1]) {
      videoId = pathParts[1];
    } else if ((pathParts[0] === 'live' || pathParts[0] === 'shorts') && pathParts[1]) {
      videoId = pathParts[1];
    } else if (pathParts[0] === 'channel' && pathParts[1]?.startsWith('UC')) {
      channelId = pathParts[1];
    }

    const params = new URLSearchParams({
      autoplay: '1',
      mute: '0',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1',
      origin: window.location.origin
    });

    if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
    if (channelId) return `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&${params.toString()}`;
    return null;
  }

  function teardownCustomSource(feed) {
    const src = state.customSources?.[feed];
    if (!src) return false;

    try {
      if (src.videoEl) {
        src.videoEl.srcObject?.getTracks?.().forEach(track => track.stop());
        src.videoEl.pause();
        src.videoEl.removeAttribute('src');
        src.videoEl.load();
        if (src.videoEl.parentNode) src.videoEl.parentNode.removeChild(src.videoEl);
      }
      if (src.frameEl?.parentNode) src.frameEl.parentNode.removeChild(src.frameEl);
    } catch (error) {}

    delete state.customSources[feed];
    syncProgramEmbed();
    return true;
  }

  function sendYouTubeCommand(frame, command) {
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: command,
      args: []
    }), '*');
  }

  function applyYouTubeMute(feed) {
    const src = state.customSources[feed];
    if (src?.type !== 'youtube' || !src.frameEl) return;
    sendYouTubeCommand(src.frameEl, state.mutedFeeds[feed] ? 'mute' : 'unMute');
  }

  function createYouTubeFrame(feed, url, embedUrl) {
    const wrapper = getCanvasWrapper(feed);
    if (!wrapper) return null;

    const frame = document.createElement('iframe');
    frame.className = 'tile-embed-frame';
    frame.title = `${getTileName(feed)} YouTube source`;
    frame.src = embedUrl;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    frame.addEventListener('load', () => applyYouTubeMute(feed));
    wrapper.appendChild(frame);

    state.customSources[feed] = {
      type: 'youtube',
      url,
      embedUrl,
      frameEl: frame,
      ready: true
    };
    setTileSource(feed, 'custom');
    return frame;
  }

  function attachCustomSourceFromUrl(feed, rawUrl) {
    const url = rawUrl.trim();
    if (!feed || !url) return false;

    if (state.customSources[feed]) {
      handleConfiguredSourceChange(feed, state.tileSourceIds[feed], state.tileSourceIds[feed], 'its custom URL changed', { force: true });
    }
    teardownCustomSource(feed);

    const youtubeEmbedUrl = buildYouTubeEmbedUrl(url);
    if (youtubeEmbedUrl) {
      const frame = createYouTubeFrame(feed, url, youtubeEmbedUrl);
      if (!frame) {
        addLog('alarm', 'ROUTE', `Unable to attach YouTube source to ${feed.toUpperCase()}.`);
        return false;
      }
      addLog('info', 'ROUTE', `YouTube source attached to ${feed.toUpperCase()}.`);
      updateSourceOverlays();
      syncProgramEmbed();
      return true;
    }

    const v = document.createElement('video');
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    v.className = 'hidden-video';
    v.src = url;
    v.addEventListener('loadedmetadata', () => {
      state.customSources[feed] = { type: 'video', url, videoEl: v, ready: true };
      setTileSource(feed, 'custom');
      addLog('info', 'ROUTE', `Custom source loaded for ${feed.toUpperCase()}.`);
      updateSourceOverlays();
    });
    v.addEventListener('error', () => {
      addLog('alarm', 'ROUTE', `Failed to load custom source for ${feed.toUpperCase()}.`);
    });
    document.body.appendChild(v);
    v.play().catch(() => {});
    addLog('info', 'ROUTE', `Attempting to attach custom source to ${feed.toUpperCase()}...`);
    return true;
  }

  function openSourceUrlEditor(feed) {
    state.activeEditFeed = feed;
    if (el.sourceUrlTarget) el.sourceUrlTarget.textContent = `TARGET: ${getTileName(feed)}`;
    el.sourceUrlModal?.classList.add('modal-open');
    el.sourceUrlModal?.setAttribute('aria-hidden', 'false');
    if (el.sourceUrlInput) {
      el.sourceUrlInput.value = state.customSources[feed]?.url || '';
      el.sourceUrlInput.focus();
      el.sourceUrlInput.select();
    }
  }

  function closeSourceUrlEditor() {
    state.activeEditFeed = null;
    el.sourceUrlModal?.classList.remove('modal-open');
    el.sourceUrlModal?.setAttribute('aria-hidden', 'true');
  }

  function submitSourceUrlEditor() {
    const feed = state.activeEditFeed;
    const url = el.sourceUrlInput?.value || '';
    if (!feed || !url.trim()) return;
    if (attachCustomSourceFromUrl(feed, url)) closeSourceUrlEditor();
  }

  function resetScenarioMedia() {
    Object.keys(state.customSources).forEach(feed => teardownCustomSource(feed));
    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach(track => track.stop());
      state.webcamStream = null;
    }
    el.cam1Video.srcObject = null;
    state.webcamReady = false;
    state.cam1VideoReady = false;
    teardownAllLocalVideos();
    state.cam2VideoReady = false;
    state.cam2FileName = null;
    state.mediaAssignments.webcam = null;
    state.mediaAssignments.localVideo = null;
  }

  function normalizePresetId(presetId) {
    return DEMO_PRESETS[presetId] ? presetId : 'clean';
  }

  function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (select) select.value = value;
  }

  function getSelectValueForSourceId(sourceId) {
    if (sourceId === 'localVideo') return 'local';
    if (sourceId === 'custom') return 'none';
    if (isNdiSourceId(sourceId)) return 'ndi';
    return sourceId;
  }

  function applyDemoPreset(presetId, { updateUrl = false } = {}) {
    const id = normalizePresetId(presetId);
    const preset = DEMO_PRESETS[id];

    if (state.adIntervalId) clearInterval(state.adIntervalId);
    state.adActive = false;
    state.adTimeRemaining = 0;
    state.preAdRoute = null;
    if (el.adBreakBanner) el.adBreakBanner.style.display = 'none';
    if (el.btnInjectScte) el.btnInjectScte.disabled = false;
    if (el.btnCancelScte) el.btnCancelScte.disabled = true;
    resetScenarioMedia();
    state.ndiBridge = {
      ...state.ndiBridge,
      ...preset.ndiBridge,
      sourceStates: { ...state.ndiBridge.sourceStates, ...preset.ndiBridge?.sourceStates },
      assignments: { ...preset.ndiBridge?.assignments }
    };
    renderNdiBridge();

    isApplyingPreset = true;
    TILE_FEEDS.forEach(feed => {
      const sourceId = preset.tileSourceIds?.[feed] || 'none';
      setTileSource(feed, sourceId);
      setSelectValue(`select-source-${feed}`, getSelectValueForSourceId(sourceId));
      clearCanvas(feed);
    });
    isApplyingPreset = false;

    LIVEU_SOURCE_IDS.forEach(sourceId => {
      const nextState = preset.sourceBaseStates?.[sourceId] || 'ONLINE';
      state.sourceBaseStates[sourceId] = nextState;
      state.sourceDetections[sourceId] = { black: false, silence: false, frozen: false, ...preset.sourceDetections?.[sourceId] };
      state.sourceStates[sourceId] = deriveSourceState(sourceId);
    });

    Object.entries(preset.customSources || {}).forEach(([feed, customSource]) => {
      if (customSource?.url) attachCustomSourceFromUrl(feed, customSource.url);
    });

    state.previewFeed = preset.previewFeed || null;
    state.activeSource = preset.activeSource || null;
    state.programSourceOverride = preset.programSourceOverride || null;
    state.primaryFailed = !!preset.primaryFailed;
    state.mutedFeeds = { cam1: false, cam2: false, liveu3: false, liveu4: false, vod: false, pgm: false, ...preset.mutedFeeds };
    state.audioMixer.audioFollowVideo = true;
    state.audioMixer.programBus = state.activeSource && state.audioMixer.channels[state.activeSource] ? state.activeSource : null;
    state.replayPlayout.returnLiveSource = ['cam1', 'cam2', 'liveu3', 'liveu4'].includes(state.activeSource) ? state.activeSource : 'cam1';
    state.replayPlayout.replay.selectedClip = state.replayPlayout.replay.clips[0]?.id || '';
    state.replayPlayout.playout.selectedAsset = 'slate-live';

    if (el.btnFailPrimary) el.btnFailPrimary.disabled = state.primaryFailed;
    if (el.btnRestorePrimary) el.btnRestorePrimary.disabled = !state.primaryFailed;
    el.alarmOverlayCam1?.classList.toggle('alarm-active', state.primaryFailed);

    document.querySelectorAll('.btn-solo').forEach(button => button.classList.remove('btn-active-solo'));
    document.querySelectorAll('.screen-card').forEach(card => card.classList.remove('preview-active', 'program-active'));
    if (state.previewFeed) {
      document.getElementById(`btn-solo-${state.previewFeed}`)?.classList.add('btn-active-solo');
      document.getElementById(`screen-${state.previewFeed}`)?.classList.add('preview-active');
    }

    Object.entries(state.mutedFeeds).forEach(([feed, muted]) => {
      document.getElementById(`btn-mute-${feed}`)?.classList.toggle('btn-active-mute', !!muted);
      applyYouTubeMute(feed);
    });

    if (el.selectDemoPreset && id !== 'imported') el.selectDemoPreset.value = id;
    if (el.pgmActiveSource) el.pgmActiveSource.textContent = state.activeSource ? `SOURCE: ${getProgramRouteLabel(state.activeSource)}` : 'SOURCE: NONE';
    updateSourceStateControls();
    updateDetectionControls();
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
    updateSourceOverlays();
    updateOrchestratorRouting();
    renderAudioMixer();
    renderCloudTopology();
    renderReplayPlayoutServers();
    syncProgramEmbed();
    addLog('info', 'DEMO', `${preset.label} preset loaded.`);
    saveWorkspaceState();

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('preset', id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  function serializeCurrentScenario() {
    const customSources = {};
    Object.entries(state.customSources).forEach(([feed, src]) => {
      if (!src?.url) return;
      customSources[feed] = {
        type: src.type || 'video',
        url: src.url
      };
    });

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      label: 'MCR Studio Custom Scenario',
      tileSourceIds: { ...state.tileSourceIds },
      sourceBaseStates: { ...state.sourceBaseStates },
      sourceDetections: JSON.parse(JSON.stringify(state.sourceDetections)),
      customSources,
      ndiBridge: {
        discovered: state.ndiBridge.discovered,
        selectedSourceId: state.ndiBridge.selectedSourceId,
        sourceStates: { ...state.ndiBridge.sourceStates },
        assignments: { ...state.ndiBridge.assignments }
      },
      previewFeed: state.previewFeed,
      activeSource: state.activeSource,
      programSourceOverride: state.programSourceOverride,
      mutedFeeds: { ...state.mutedFeeds },
      primaryFailed: state.primaryFailed
    };
  }

  function saveWorkspaceState() {
    if (isRestoringWorkspaceState) return;
    try {
      const snapshot = serializeCurrentScenario();
      snapshot.savedAt = new Date().toISOString();
      snapshot.regionPreset = state.regionPreset;
      snapshot.mediaAssignments = { ...state.mediaAssignments };
      localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Unable to save MCR workspace state', error);
    }
  }

  function loadWorkspaceState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(WORKSPACE_STATE_KEY) || 'null');
    } catch (error) {
      console.warn('Unable to read saved MCR workspace state', error);
      return;
    }
    if (!saved || typeof saved !== 'object' || !saved.tileSourceIds) return;

    isRestoringWorkspaceState = true;
    try {
      if (REGION_PRESETS[saved.regionPreset]) state.regionPreset = saved.regionPreset;
      state.mediaAssignments = { ...state.mediaAssignments, ...saved.mediaAssignments };

      TILE_FEEDS.forEach(feed => {
        const sourceId = saved.tileSourceIds?.[feed] || state.tileSourceIds[feed] || 'none';
        setTileSource(feed, sourceId);
        setSelectValue(`select-source-${feed}`, getSelectValueForSourceId(sourceId));
        if (sourceId === 'webcam') state.mediaAssignments.webcam = feed;
        if (sourceId === 'localVideo') state.mediaAssignments.localVideo = feed;
      });

      LIVEU_SOURCE_IDS.forEach(sourceId => {
        state.sourceBaseStates[sourceId] = saved.sourceBaseStates?.[sourceId] || state.sourceBaseStates[sourceId];
        state.sourceDetections[sourceId] = { ...state.sourceDetections[sourceId], ...saved.sourceDetections?.[sourceId] };
        state.sourceStates[sourceId] = deriveSourceState(sourceId);
      });

      state.ndiBridge = {
        ...state.ndiBridge,
        ...saved.ndiBridge,
        sourceStates: { ...state.ndiBridge.sourceStates, ...saved.ndiBridge?.sourceStates },
        assignments: { ...saved.ndiBridge?.assignments }
      };
      renderNdiBridge();

      Object.keys(state.customSources).forEach(feed => {
        if (!saved.customSources?.[feed]) teardownCustomSource(feed);
      });

      Object.entries(saved.customSources || {}).forEach(([feed, customSource]) => {
        if (customSource?.url) attachCustomSourceFromUrl(feed, customSource.url);
      });

      state.previewFeed = saved.previewFeed || null;
      state.activeSource = saved.activeSource || null;
      state.programSourceOverride = saved.programSourceOverride || null;
      state.primaryFailed = !!saved.primaryFailed;
      state.mutedFeeds = { ...state.mutedFeeds, ...saved.mutedFeeds };
      document.querySelectorAll('.btn-solo').forEach(button => button.classList.remove('btn-active-solo'));
      document.querySelectorAll('.screen-card').forEach(card => card.classList.remove('preview-active'));
      if (state.previewFeed) {
        document.getElementById(`btn-solo-${state.previewFeed}`)?.classList.add('btn-active-solo');
        document.getElementById(`screen-${state.previewFeed}`)?.classList.add('preview-active');
      }
      Object.entries(state.mutedFeeds).forEach(([feed, muted]) => {
        document.getElementById(`btn-mute-${feed}`)?.classList.toggle('btn-active-mute', !!muted);
      });
    } finally {
      isRestoringWorkspaceState = false;
    }
  }

  function refreshWorkspaceUiAfterStateLoad(syncMessage = '') {
    updateSourceStateControls();
    updateDetectionControls();
    updateSourceOverlays();
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    renderNdiBridge();
    renderReplayPlayoutServers();
    renderAudioMixer();
    renderCloudTopology();
    renderTxSafety();
    syncProgramEmbed();
    updateSourceInspector();
    if (el.pgmActiveSource) el.pgmActiveSource.textContent = state.activeSource ? `SOURCE: ${getProgramRouteLabel(state.activeSource)}` : 'SOURCE: NONE';
    if (syncMessage) addLog('info', 'SYNC', syncMessage);
  }

  async function resumePersistedWebcamIfNeeded() {
    const assignedFeed = state.mediaAssignments.webcam;
    if (!assignedFeed || getFeedAssignment(assignedFeed) !== 'webcam' || state.webcamReady) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      addLog('warning', 'WEB', 'Webcam is assigned, but this browser cannot reopen camera automatically.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      el.cam1Video.srcObject = stream;
      state.webcamStream = stream;
      state.webcamReady = true;
      state.cam1VideoReady = true;
      await el.cam1Video.play().catch(() => {});
      addLog('info', 'WEB', `Webcam resumed for ${getTileName(assignedFeed)} from saved Setup state.`);
      updateSourceOverlays();
      updateOrchestratorRouting();
      updateTAKEButton();
    } catch (error) {
      addLog('warning', 'WEB', `Webcam is assigned to ${getTileName(assignedFeed)}, but browser permission is needed to reopen it.`);
    }
  }

  function downloadScenarioJson() {
    const scenario = serializeCurrentScenario();
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `mcr-studio-scenario-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    addLog('info', 'DEMO', 'Scenario exported as JSON.');
  }

  function importScenarioFromObject(scenario) {
    if (!scenario || typeof scenario !== 'object' || !scenario.tileSourceIds) {
      addLog('alarm', 'DEMO', 'Scenario import failed: invalid JSON structure.');
      return;
    }

    DEMO_PRESETS.imported = {
      label: scenario.label || 'Imported Scenario',
      tileSourceIds: scenario.tileSourceIds,
      sourceBaseStates: scenario.sourceBaseStates || {},
      sourceDetections: scenario.sourceDetections || {},
      customSources: scenario.customSources || {},
      ndiBridge: {
        ...state.ndiBridge,
        ...scenario.ndiBridge,
        sourceStates: { ...state.ndiBridge.sourceStates, ...scenario.ndiBridge?.sourceStates },
        assignments: { ...scenario.ndiBridge?.assignments }
      },
      previewFeed: scenario.previewFeed || null,
      activeSource: scenario.activeSource || null,
      programSourceOverride: scenario.programSourceOverride || null,
      mutedFeeds: scenario.mutedFeeds || {},
      primaryFailed: !!scenario.primaryFailed
    };
    applyDemoPreset('imported', { updateUrl: false });
    if (el.presetLinkStatus) el.presetLinkStatus.textContent = 'Imported scenario JSON loaded';
  }

  function importScenarioFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        importScenarioFromObject(JSON.parse(reader.result));
      } catch (error) {
        addLog('alarm', 'DEMO', `Scenario import failed: ${error.message}`);
      }
    });
    reader.readAsText(file);
  }

  function copyPresetLink() {
    const id = normalizePresetId(el.selectDemoPreset?.value || 'clean');
    const url = new URL(window.location.href);
    url.searchParams.set('preset', id);
    const link = url.toString();
    navigator.clipboard?.writeText(link)
      .then(() => {
        if (el.presetLinkStatus) el.presetLinkStatus.textContent = `Copied: ?preset=${id}`;
        addLog('info', 'DEMO', `Shareable preset link copied: ${id}.`);
      })
      .catch(() => {
        if (el.presetLinkStatus) el.presetLinkStatus.textContent = link;
        addLog('warning', 'DEMO', 'Clipboard unavailable. Preset link shown in the preset bar.');
      });
  }

  function isNdiSourceId(sourceId) {
    return typeof sourceId === 'string' && sourceId.startsWith('ndi:');
  }

  function getNdiSourceId(sourceId) {
    return isNdiSourceId(sourceId) ? sourceId.slice(4) : null;
  }

  function getTileNdiSourceId(feed) {
    return getNdiSourceId(state.tileSourceIds[feed]);
  }

  function normalizeNdiBridgeSource(source, index) {
    const id = String(source.id || source.name || `ndi${index + 1}`).replace(/^ndi:/, '');
    return {
      id,
      label: source.label || source.name || `NDI Source ${index + 1}`,
      shortLabel: source.shortLabel || source.short_label || source.name || `NDI ${index + 1}`,
      codec: source.codec || 'NDI HX',
      resolution: source.resolution || source.format || '1080p60',
      bitrate: Number(source.bitrate || source.bitrateMbps || source.bitrate_mbps || 6.5),
      rttOffset: Number(source.rttOffset || source.rtt_offset || source.latencyMs || source.latency_ms || 10),
      location: source.location || source.group || 'NDI Bridge',
      previewUrl: source.previewUrl || source.preview_url || source.webrtcUrl || source.webrtc_url || null,
      state: source.state || source.status || 'ONLINE'
    };
  }

  function applyNdiBridgeSources(sources, { fromBackend = false } = {}) {
    Object.keys(NDI_SOURCES).forEach(sourceId => delete NDI_SOURCES[sourceId]);
    sources.forEach((source, index) => {
      const normalized = normalizeNdiBridgeSource(source, index);
      NDI_SOURCES[normalized.id] = normalized;
      state.ndiBridge.sourceStates[normalized.id] = normalized.state;
    });
    const firstSourceId = Object.keys(NDI_SOURCES)[0] || '';
    if (!NDI_SOURCES[state.ndiBridge.selectedSourceId]) {
      state.ndiBridge.selectedSourceId = firstSourceId;
    }
    state.ndiBridge.discovered = !!firstSourceId;
    state.ndiBridge.backendConnected = fromBackend;
  }

  async function fetchNdiBridgeSources() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    try {
      const response = await fetch(NDI_BRIDGE_ENDPOINT, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const sources = Array.isArray(payload) ? payload : payload.sources;
      if (!Array.isArray(sources)) throw new Error('missing sources array');
      return sources;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function renderNdiBridge() {
    const discoveredIds = state.ndiBridge.discovered ? Object.keys(NDI_SOURCES) : [];
    if (el.ndiBridgeStatus) {
      el.ndiBridgeStatus.textContent = state.ndiBridge.discovered
        ? `${discoveredIds.length} SOURCES ${state.ndiBridge.backendConnected ? 'FROM BRIDGE' : 'SIMULATED'}`
        : 'NOT SCANNED';
    }
    if (el.ndiBridgeHint) {
      const selected = NDI_SOURCES[state.ndiBridge.selectedSourceId];
      el.ndiBridgeHint.textContent = selected
        ? `${selected.label} · ${selected.codec} · ${selected.resolution} · ${selected.location}`
        : 'Browser preview expects an NDI-to-WebRTC/HLS bridge at /api/ndi/sources.';
    }
    if (!el.ndiSourceSelect) return;
    el.ndiSourceSelect.innerHTML = '';
    if (!discoveredIds.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No NDI sources discovered';
      el.ndiSourceSelect.appendChild(option);
      return;
    }
    discoveredIds.forEach(sourceId => {
      const source = NDI_SOURCES[sourceId];
      const option = document.createElement('option');
      option.value = sourceId;
      option.textContent = `${source.shortLabel} · ${state.ndiBridge.sourceStates[sourceId] || 'OFFLINE'}`;
      el.ndiSourceSelect.appendChild(option);
    });
    el.ndiSourceSelect.value = state.ndiBridge.selectedSourceId;
  }

  async function scanNdiBridge() {
    if (el.ndiBridgeStatus) el.ndiBridgeStatus.textContent = 'SCANNING...';
    try {
      const bridgeSources = await fetchNdiBridgeSources();
      applyNdiBridgeSources(bridgeSources, { fromBackend: true });
      renderNdiBridge();
      addLog('info', 'NDI', `NDI bridge API connected. ${Object.keys(NDI_SOURCES).length} sources discovered.`);
    } catch (error) {
      applyNdiBridgeSources(Object.values(DEFAULT_NDI_SOURCES), { fromBackend: false });
      renderNdiBridge();
      addLog('warning', 'NDI', `NDI bridge API unavailable (${error.message}). Using simulated discovery sources.`);
    }
  }

  async function attachNdiSource(feed) {
    if (!state.ndiBridge.discovered) await scanNdiBridge();
    const sourceId = el.ndiSourceSelect?.value || state.ndiBridge.selectedSourceId;
    const source = NDI_SOURCES[sourceId];
    if (!source) {
      addLog('warning', 'NDI', `No NDI source selected for ${getTileName(feed)}.`);
      return;
    }
    state.ndiBridge.selectedSourceId = sourceId;
    state.ndiBridge.assignments[sourceId] = feed;
    setTileSource(feed, `ndi:${sourceId}`);
    addLog('info', 'NDI', `${source.label} attached to ${getTileName(feed)} through NDI bridge.`);
    updateSourceOverlays();
    updateOrchestratorRouting();
    renderNdiBridge();
  }

  function getFeedAssignment(feed) {
    // Custom per-tile source takes precedence
    if (state.customSources && state.customSources[feed]) return 'custom';
    const sourceId = state.tileSourceIds[feed];
    if (isNdiSourceId(sourceId)) return 'ndi';
    if (sourceId === 'custom') return 'none';
    if (LIVEU_SOURCE_IDS.includes(sourceId)) return 'simulated';
    if (sourceId === 'none') return 'none';
    return state.tileSources[feed] || 'simulated';
  }

  function getLocalVideo(feed) {
    return state.localVideos[feed] || null;
  }

  async function attachObsVirtualCamera(feed) {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      addLog('alarm', 'OBS', 'This browser cannot access the OBS Virtual Camera.');
      return;
    }
    try {
      // Camera permission reveals device labels, including OBS Virtual Camera on macOS.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const obsDevice = devices.find(device => device.kind === 'videoinput' && /obs.*virtual|virtual.*obs/i.test(device.label));
      permissionStream.getTracks().forEach(track => track.stop());
      if (!obsDevice) {
        addLog('alarm', 'OBS', 'OBS Virtual Camera was not found. Start it in OBS, then retry.');
        return;
      }
      if (state.customSources[feed]) {
        handleConfiguredSourceChange(feed, state.tileSourceIds[feed], state.tileSourceIds[feed], 'its OBS mapping changed', { force: true });
      }
      teardownCustomSource(feed);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: obsDevice.deviceId } }, audio: false });
      const videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = stream;
      state.customSources[feed] = { type: 'obs', label: 'OBS Virtual Camera', videoEl, ready: false };
      setTileSource(feed, 'custom');
      videoEl.addEventListener('loadeddata', () => {
        if (!state.customSources[feed]) return;
        state.customSources[feed].ready = true;
        updateSourceOverlays();
        updateOrchestratorRouting();
      }, { once: true });
      await videoEl.play().catch(() => {});
      addLog('info', 'OBS', `OBS Virtual Camera attached to ${getTileName(feed)}.`, 'obs-attach');
      updateSourceOverlays();
    } catch (error) {
      addLog('alarm', 'OBS', `Unable to attach OBS Virtual Camera: ${error.message}`);
    }
  }

  function setTileSource(feed, sourceId) {
    if (!state.tileSources[feed]) return;
    const nextSourceId = sourceId || 'none';
    const previousSourceId = state.tileSourceIds[feed] || 'none';
    state.tileSourceIds[feed] = nextSourceId;
    state.tileSources[feed] = LIVEU_SOURCE_IDS.includes(nextSourceId) ? 'simulated' : isNdiSourceId(nextSourceId) ? 'ndi' : nextSourceId;
    handleConfiguredSourceChange(feed, previousSourceId, nextSourceId);
    saveWorkspaceState();
  }

  function handleConfiguredSourceChange(feed, previousSourceId, nextSourceId, reason = 'its source configuration changed', { force = false } = {}) {
    if (isRestoringWorkspaceState || isApplyingPreset) return;
    if (!force && previousSourceId === nextSourceId) return;
    const wasPreview = state.previewFeed === feed;
    const wasProgram = state.activeSource === feed;
    if (!wasPreview && !wasProgram) return;

    if (wasPreview) {
      clearPreviewUI();
      addLog('warning', 'MUX', `${getTileName(feed)} removed from Preview because ${reason}.`);
    }
    if (wasProgram) {
      clearProgramOut(`${getTileName(feed)} removed from PROGRAM because ${reason}.`);
    }
  }

  function clearTileSource(feed) {
    if (!state.tileSources[feed]) return;
    const wasLocalVideo = getFeedAssignment(feed) === 'localVideo';
    setTileSource(feed, feed === 'vod' ? 'vod' : 'none');
    if (wasLocalVideo) {
      teardownLocalVideo(feed);
      deletePersistedLocalVideo(feed);
    }
    if (state.previewFeed === feed) clearPreviewUI();
    if (state.activeSource === feed) {
      clearProgramOut(`${getTileName(feed)} removed from PROGRAM because its source was cleared.`);
    }
    saveWorkspaceState();
  }

  function clearProgramOut(message = 'Program Out cleared to black.') {
    const previousSource = state.activeSource;
    if (state.adIntervalId) clearInterval(state.adIntervalId);
    state.adIntervalId = null;
    state.adActive = false;
    state.adTimeRemaining = 0;
    state.preAdRoute = null;
    state.activeSource = null;
    state.onAirStartedAt = null;
    state.programSourceOverride = null;
    setProgramAudioFeed(null, 'program off air');
    if (el.adBreakBanner) el.adBreakBanner.style.display = 'none';
    if (el.btnInjectScte) el.btnInjectScte.disabled = false;
    if (el.btnCancelScte) el.btnCancelScte.disabled = true;
    if (el.pgmActiveSource) el.pgmActiveSource.textContent = 'SOURCE: NONE';
    if (state.activeGraphics || state.tickerOn || state.bugOn) {
      clearGraphics('Graphics cleared with Program Off Air.');
    }
    addLog(previousSource ? 'info' : 'warning', 'MIX', message);
    updateOrchestratorRouting();
    updateBadges();
    updatePGMFooter();
    renderTxSafety();
    syncProgramEmbed();
    updateSourceInspector();
    saveWorkspaceState();
    backendCommand('/api/off-air');
  }

  function getProgramSourceId() {
    if (!state.activeSource) return null;
    if (state.programSourceOverride) return state.programSourceOverride;
    if (state.activeSource === 'ad') return 'ad';
    return state.tileSourceIds[state.activeSource] || state.activeSource;
  }

  function getSourceState(sourceId) {
    if (LIVEU_SOURCE_IDS.includes(sourceId)) return state.sourceStates[sourceId] || 'OFFLINE';
    if (isNdiSourceId(sourceId)) return state.ndiBridge.sourceStates[getNdiSourceId(sourceId)] || 'OFFLINE';
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
    renderAIOpsAssistant();
    saveWorkspaceState();
    backendCommand('/api/source-state', { source: sourceId, state: nextState });
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
    renderAIOpsAssistant();
    saveWorkspaceState();
    backendCommand('/api/source-detection', { source: sourceId, detection: detectionName, active });
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
    if (feed === 'replay') return state.activeSource === 'replay' ? 'ON AIR' : state.previewFeed === 'replay' ? 'CUED' : 'READY';
    if (feed === 'playout') return state.activeSource === 'playout' ? 'ON AIR' : state.previewFeed === 'playout' ? 'CUED' : 'READY';
    const assignment = getFeedAssignment(feed);
    if (assignment === 'none') return 'NO SOURCE';
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return getSourceState(state.tileSourceIds[feed]);
    if (assignment === 'webcam') return state.webcamReady ? 'ONLINE' : 'OFFLINE';
    if (assignment === 'localVideo') return getLocalVideo(feed)?.ready ? 'PLAYING' : 'OFFLINE';
    if (assignment === 'custom') return state.customSources[feed]?.ready ? 'ONLINE' : 'OFFLINE';
    if (assignment === 'ndi') return getSourceState(state.tileSourceIds[feed]);
    if (assignment === 'vod') return state.activeGraphics || state.tickerOn || state.bugOn ? 'KEYING' : 'READY';
    return 'SIMULATED';
  }

  function getAssignmentLabel(feed) {
    if (feed === 'replay') return getSelectedReplayClip()?.label || 'Replay Server';
    if (feed === 'playout') return getSelectedPlayoutAsset()?.label || 'Playout Server';
    const assignment = getFeedAssignment(feed);
    if (assignment === 'webcam') return 'Browser Cam';
    if (assignment === 'localVideo') return getLocalVideo(feed)?.fileName || 'Local File';
    if (assignment === 'custom') return state.customSources[feed]?.type === 'youtube' ? 'YouTube Live' : state.customSources[feed]?.type === 'obs' ? 'OBS Virtual Camera' : 'Custom Source';
    if (assignment === 'ndi') return NDI_SOURCES[getTileNdiSourceId(feed)]?.label || 'NDI Bridge';
    if (feed === 'vod') return 'CG Key/Fill Engine';
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return SOURCE_DETAILS[state.tileSourceIds[feed]].label;
    return 'SIMULATED';
  }

  function getFeedMetadata(feed) {
    if (feed === 'replay') {
      const clip = getSelectedReplayClip();
      return {
        codec: 'REPLAY CLIP',
        source: clip?.label || 'Replay Server',
        resolution: '1080p60',
        bitrate: '6.0 Mbps',
        rtt: 'EC2'
      };
    }
    if (feed === 'playout') {
      const asset = getSelectedPlayoutAsset();
      return {
        codec: asset?.type || 'PLAYOUT',
        source: asset?.label || 'Playout Server',
        resolution: '1080p60',
        bitrate: '5.0 Mbps',
        rtt: 'EC2'
      };
    }
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
      const local = getLocalVideo(feed);
      return {
        codec: 'Local File',
        source: local?.fileName || 'No File',
        resolution: local?.ready ? getVideoResolution(local.videoEl) : 'N/A',
        bitrate: local?.ready ? `${(4.3 + Math.random() * 1.3).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: local?.ready ? `${state.rttMs}ms` : '--'
      };
    }

    if (assignment === 'custom') {
      const src = state.customSources[feed];
      if (src?.type === 'youtube') {
        return {
          codec: 'YOUTUBE',
          source: 'YouTube Live',
          resolution: 'Embedded Player',
          bitrate: 'Adaptive',
          rtt: 'HTTP'
        };
      }
      return {
        codec: 'CUSTOM',
        source: src?.url || 'Custom Source',
        resolution: src?.ready ? getVideoResolution(src.videoEl) : 'N/A',
        bitrate: src?.ready ? `${(3.8 + Math.random() * 2.2).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: src?.ready ? `${state.rttMs}ms` : '--'
      };
    }

    if (assignment === 'ndi') {
      const ndiId = getTileNdiSourceId(feed);
      const details = NDI_SOURCES[ndiId];
      const sourceState = getSourceState(state.tileSourceIds[feed]);
      const hasSignal = sourceHasSignal(state.tileSourceIds[feed]);
      return {
        codec: hasSignal ? details?.codec || 'NDI' : 'NO LOCK',
        source: details?.label || 'NDI Bridge',
        resolution: hasSignal ? details?.resolution || '1080p60' : 'N/A',
        bitrate: hasSignal ? `${((details?.bitrate || 6.4) + Math.random() * 0.5).toFixed(1)} Mbps` : '0.0 Mbps',
        rtt: hasSignal ? `${state.rttMs + (details?.rttOffset || 10)}ms` : sourceState
      };
    }

    if (assignment === 'vod') {
      return {
        codec: 'CG KEY/FILL',
        source: state.activeGraphics || state.tickerOn || state.bugOn ? 'Graphics On Air' : 'Graphics Standby',
        resolution: '1080p60 Alpha',
        bitrate: '0.0 Mbps',
        rtt: 'LOCAL'
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

  function parseMbps(value) {
    const parsed = parseFloat(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getEstimatedFeedBandwidth(feed) {
    if (!feedHasActiveSignal(feed)) return 0;
    const assignment = getFeedAssignment(feed);
    if (assignment === 'custom') {
      return state.customSources[feed]?.type === 'youtube' ? 5.0 : 4.2;
    }
    if (assignment === 'ndi') return NDI_SOURCES[getTileNdiSourceId(feed)]?.bitrate || 6.5;
    if (assignment === 'vod') return 0;
    return parseMbps(getFeedMetadata(feed).bitrate);
  }

  function getAudioLabel(feed) {
    if (!feed) return 'NONE';
    const channel = state.audioMixer.channels[feed];
    if (channel) return channel.label;
    if (feed === 'ad') return 'SCTE Ad Loop';
    return getTileName(feed);
  }

  function getSelectedReplayClip() {
    return state.replayPlayout.replay.clips.find(clip => clip.id === state.replayPlayout.replay.selectedClip) || state.replayPlayout.replay.clips[0];
  }

  function getSelectedPlayoutAsset() {
    return state.replayPlayout.playout.assets.find(asset => asset.id === state.replayPlayout.playout.selectedAsset) || state.replayPlayout.playout.assets[0];
  }

  function captureReturnLiveSource() {
    if (['cam1', 'cam2', 'liveu3', 'liveu4'].includes(state.activeSource)) {
      state.replayPlayout.returnLiveSource = state.activeSource;
    }
  }

  function renderReplayPlayoutServers() {
    const replaySourceReady = feedHasActiveSignal(state.replayPlayout.replay.source);
    const hasReplayClip = !!getSelectedReplayClip();
    const hasPlayoutAsset = !!getSelectedPlayoutAsset();
    const replayCued = state.previewFeed === 'replay';
    const playoutCued = state.previewFeed === 'playout';
    const canReturnLive = ['replay', 'playout'].includes(state.activeSource) && feedHasActiveSignal(state.replayPlayout.returnLiveSource || 'cam1');

    if (el.replayClipSelect) {
      const current = state.replayPlayout.replay.selectedClip;
      el.replayClipSelect.innerHTML = state.replayPlayout.replay.clips.map(clip => (
        `<option value="${clip.id}">${clip.label} · ${clip.duration}</option>`
      )).join('');
      el.replayClipSelect.value = current;
    }
    if (el.playoutAssetSelect) {
      const current = state.replayPlayout.playout.selectedAsset;
      el.playoutAssetSelect.innerHTML = state.replayPlayout.playout.assets.map(asset => (
        `<option value="${asset.id}">${asset.label} · ${asset.duration}</option>`
      )).join('');
      el.playoutAssetSelect.value = current;
    }
    if (el.replaySourceSelect) el.replaySourceSelect.value = state.replayPlayout.replay.source;
    setMetricText(el.replayServerStatus, state.activeSource === 'replay' ? 'ON AIR' : state.previewFeed === 'replay' ? 'CUED' : 'STANDBY', state.activeSource === 'replay' ? 'text-red' : state.previewFeed === 'replay' ? 'text-amber' : 'text-green');
    setMetricText(el.playoutServerStatus, state.activeSource === 'playout' ? 'ON AIR' : state.previewFeed === 'playout' ? 'CUED' : 'READY', state.activeSource === 'playout' ? 'text-red' : state.previewFeed === 'playout' ? 'text-amber' : 'text-green');
    if (el.playoutAssetStatus) {
      const asset = getSelectedPlayoutAsset();
      el.playoutAssetStatus.textContent = `${asset.label} · ${asset.type} · ${asset.duration}`;
    }
    [el.btnReplayMarkIn, el.btnReplayMarkOut, el.btnReplayCreate].forEach(button => {
      setControlEnabled(
        button,
        replaySourceReady,
        'Mark or save a replay clip from the selected healthy source.',
        'Select a replay source with signal before marking clips.'
      );
    });
    setControlEnabled(el.btnPreviewReplay, replaySourceReady && hasReplayClip, 'Cue the selected replay clip in Preview.', 'Replay source or clip is not ready.');
    setControlEnabled(el.btnTakeReplay, replayCued, 'Take the cued replay clip to Program.', 'Cue a replay clip to Preview before taking it to air.');
    setControlEnabled(el.btnReturnLiveReplay, canReturnLive, 'Return Program to the remembered live source.', 'Return Live is available only while replay/playout is on air.');
    setControlEnabled(el.btnPreviewPlayout, hasPlayoutAsset, 'Cue the selected playout asset in Preview.', 'No playout asset is selected.');
    setControlEnabled(el.btnTakePlayout, playoutCued, 'Take the cued playout asset to Program.', 'Cue a playout asset to Preview before taking it to air.');
    setControlEnabled(el.btnReturnLivePlayout, canReturnLive, 'Return Program to the remembered live source.', 'Return Live is available only while replay/playout is on air.');
  }

  function markReplayPoint(point) {
    const timecode = getSMPTETimecode(framesCount);
    state.replayPlayout.replay[point] = timecode;
    addLog('info', 'REPLAY', `${point === 'markIn' ? 'Mark In' : 'Mark Out'} set at ${timecode} from ${getTileName(state.replayPlayout.replay.source)}.`);
    renderReplayPlayoutServers();
  }

  function createReplayClip() {
    const source = state.replayPlayout.replay.source;
    const clipNumber = String(state.replayPlayout.replay.clips.length + 1).padStart(3, '0');
    const clip = {
      id: `replay-${clipNumber}`,
      label: `Replay ${clipNumber} - ${getTileName(source)} clip`,
      source,
      duration: '00:00:10'
    };
    state.replayPlayout.replay.clips.push(clip);
    state.replayPlayout.replay.selectedClip = clip.id;
    addLog('info', 'REPLAY', `${clip.label} created from ${getTileName(source)}.`);
    backendCommand('/api/replay-create', { source, duration: clip.duration });
    renderReplayPlayoutServers();
  }

  function previewServerSource(feed) {
    if (feed === 'replay' && !feedHasActiveSignal(state.replayPlayout.replay.source)) {
      addLog('warning', 'REPLAY', `Replay cannot be cued because ${getTileName(state.replayPlayout.replay.source)} has no usable signal.`);
      renderReplayPlayoutServers();
      return;
    }
    captureReturnLiveSource();
    setPreview(feed);
    addLog('info', feed === 'replay' ? 'REPLAY' : 'PLYT', `${getProgramRouteLabel(feed)} cued to Preview.`);
    renderReplayPlayoutServers();
  }

  function takeServerSource(feed) {
    if (state.previewFeed !== feed) setPreview(feed);
    routePreviewToProgram(feed === 'replay' ? 'TAKE REPLAY' : 'TAKE PLAYOUT');
    if (feed === 'replay') backendCommand('/api/replay-take');
    if (feed === 'playout') backendCommand('/api/playout-take', { assetId: state.replayPlayout.playout.selectedAsset });
    renderReplayPlayoutServers();
  }

  function returnToLiveFromServer() {
    const target = state.replayPlayout.returnLiveSource || 'cam1';
    if (!feedHasActiveSignal(target)) {
      addLog('warning', 'ROUTE', `Return Live blocked because ${getProgramRouteLabel(target)} has no usable signal.`);
      renderReplayPlayoutServers();
      return;
    }
    setPreview(target);
    routePreviewToProgram('RETURN LIVE');
    addLog('info', 'ROUTE', `Returned to live source ${getProgramRouteLabel(target)}.`);
    backendCommand('/api/return-live');
    renderReplayPlayoutServers();
  }

  function setProgramAudioFeed(feed, reason = 'manual') {
    const nextFeed = feed && state.audioMixer.channels[feed] ? feed : null;
    if (state.audioMixer.programBus === nextFeed) return;
    state.audioMixer.programBus = nextFeed;
    renderAudioMixer();
    addLog(nextFeed ? 'info' : 'warning', 'AUDIO', nextFeed ? `PGM audio routed to ${getAudioLabel(nextFeed)} (${reason}).` : `PGM audio cleared (${reason}).`);
    if (reason.includes('manual')) backendCommand('/api/audio-program', { source: nextFeed, reason });
  }

  function syncAudioFollowVideo(reason = 'AFV') {
    if (!state.audioMixer.audioFollowVideo) return;
    setProgramAudioFeed(state.activeSource, reason);
  }

  function deriveServiceStatus(serviceId) {
    const alarms = getActiveAlarmSummary();
    const delivery = getDeliveryHealthSnapshot();
    if (serviceId === 'sources') return alarms.some(a => a.includes('INPUT LOSS') || a.includes('QC ALARM')) ? 'ALARM' : delivery.hasProgram ? 'ONLINE' : 'READY';
    if (serviceId === 'ingest') return state.primaryFailed ? 'BACKUP' : state.rttMs >= 160 || state.lossPercent >= 5 ? 'DEGRADED' : delivery.hasProgram ? 'RECEIVING' : 'READY';
    if (serviceId === 'switcher') return delivery.hasProgram ? delivery.programHealthy ? 'ROUTING' : 'ALARM' : delivery.hasPreview ? 'PREVIEW' : 'IDLE';
    if (serviceId === 'audio') return state.audioMixer.programBus ? 'PGM' : 'IDLE';
    if (serviceId === 'cg') return state.activeGraphics || state.tickerOn || state.bugOn ? 'KEYING' : 'STANDBY';
    if (serviceId === 'replay') return state.activeSource === 'replay' ? 'ON AIR' : state.previewFeed === 'replay' ? 'CUED' : 'STANDBY';
    if (serviceId === 'playout') return state.activeSource === 'playout' || state.activeSource === 'ad' ? 'ON AIR' : state.previewFeed === 'playout' ? 'CUED' : 'STANDBY';
    if (serviceId === 'encoder') return delivery.hasProgram ? delivery.programHealthy ? 'ENCODING' : 'INPUT WAIT' : 'READY';
    if (serviceId === 'packaging') return delivery.deliveryDegraded ? 'DEGRADED' : delivery.hasProgram && delivery.programHealthy ? 'PACKAGING' : 'READY';
    if (serviceId === 'distribution') return delivery.deliveryDegraded ? 'DEGRADED' : delivery.hasProgram && delivery.programHealthy ? 'DISTRIBUTING' : 'READY';
    return 'ONLINE';
  }

  function syncBackendModel() {
    Object.entries(state.systemModel.services).forEach(([serviceId, service]) => {
      service.status = deriveServiceStatus(serviceId);
      const jitter = Math.round(Math.sin((framesCount + serviceId.length * 13) * 0.03) * 4);
      if (serviceId === 'ingest') service.latency = Math.max(10, state.rttMs + state.jitterMs + jitter);
      if (serviceId === 'encoder') service.load = state.activeSource ? 54 + Math.round(state.calculatedBw * 2) : 28;
      if (serviceId === 'packaging') service.load = state.activeSource ? 24 + Math.round(state.calculatedBw) : 12;
      if (serviceId === 'switcher') service.load = state.activeSource ? 48 : 20;
      if (serviceId === 'audio') service.load = state.audioMixer.programBus ? 28 : 12;
      if (serviceId === 'cg') service.load = state.activeGraphics || state.tickerOn || state.bugOn ? 36 : 18;
      if (serviceId === 'distribution') service.latency = 90 + state.rttMs + Math.round(state.lossPercent * 4);
    });
  }

  function setMetricText(node, value, className = '') {
    if (!node) return;
    node.textContent = value;
    node.className = className;
  }

  function setControlEnabled(button, enabled, titleWhenEnabled = '', titleWhenDisabled = '') {
    if (!button) return;
    button.disabled = !enabled;
    button.style.opacity = enabled ? '1.0' : '0.45';
    button.classList.toggle('btn-disabled', !enabled);
    if (titleWhenEnabled || titleWhenDisabled) {
      button.title = enabled ? titleWhenEnabled : titleWhenDisabled;
    }
  }

  function getSelectedRegion() {
    return REGION_PRESETS[state.regionPreset] || REGION_PRESETS['us-east-1'];
  }

  function renderRegionPreset() {
    const region = getSelectedRegion();
    if (el.regionValue) el.regionValue.textContent = region.code.toUpperCase();
    if (el.opRouteRegion) el.opRouteRegion.textContent = region.code.toUpperCase();
    if (el.regionPresetSelect && el.regionPresetSelect.value !== region.code) el.regionPresetSelect.value = region.code;
    if (el.setupRegionLabel) el.setupRegionLabel.textContent = `${region.code} ${region.label}`;
  }

  function renderOperateRouteCard() {
    const region = getSelectedRegion();
    const hasProgram = !!state.activeSource;
    const cdnDegraded = state.isUnderflow || state.lossPercent >= 8;
    setMetricText(el.opRouteSource, hasProgram ? getProgramRouteLabel(state.activeSource) : 'OFF AIR', hasProgram ? 'text-red' : 'text-muted');
    setMetricText(el.opRoutePreview, state.previewFeed ? getProgramRouteLabel(state.previewFeed) : '—', state.previewFeed ? 'text-blue' : 'text-muted');
    setMetricText(el.opRouteIngest, hasProgram ? 'LIVE' : 'READY', hasProgram ? 'text-green' : 'text-blue');
    setMetricText(el.opRouteEncoder, hasProgram ? 'ENCODING' : 'READY', hasProgram ? 'text-green' : 'text-blue');
    setMetricText(el.opRouteCdn, cdnDegraded ? 'DEGRADED' : hasProgram ? 'READY' : 'IDLE', cdnDegraded ? 'text-red' : hasProgram ? 'text-green' : 'text-muted');
    if (el.opRoutePath) {
      el.opRoutePath.textContent = `${state.primaryFailed ? 'BACKUP ACTIVE' : 'PRIMARY + BACKUP READY'} · ${region.code.toUpperCase()}`;
      el.opRoutePath.className = `operate-route-footer font-fira ${state.primaryFailed ? 'text-amber' : 'text-green'}`;
    }
  }

  function renderOperatorWorkflowStatus() {
    const configuredCount = TILE_FEEDS.filter(feed => state.tileSourceIds[feed] && state.tileSourceIds[feed] !== 'none').length;
    const previewLabel = state.previewFeed ? getProgramRouteLabel(state.previewFeed) : '—';
    const programLabel = state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR';
    const delivery = getDeliveryHealthSnapshot();
    const lastOperatorEvent = [...state.logs].reverse().find(log => ['MIX', 'MUX', 'ROUTE', 'WEB', 'VIDEO', 'NDI', 'INSP', 'CG', 'AUDIO', 'REPLAY', 'PLYT', 'API', 'DEMO', 'SCTE'].includes(log.tag));
    const lastEventLabel = lastOperatorEvent ? `${lastOperatorEvent.tag}: ${lastOperatorEvent.message}` : 'NO EVENTS';
    setMetricText(el.workflowConfiguredCount, `${configuredCount} SOURCE${configuredCount === 1 ? '' : 'S'}`, configuredCount ? 'text-green' : 'text-muted');
    setMetricText(el.workflowPreviewSource, previewLabel, state.previewFeed ? 'text-blue' : 'text-muted');
    setMetricText(el.workflowProgramSource, programLabel, state.activeSource ? 'text-red' : 'text-muted');
    setMetricText(el.workflowMonitorState, delivery.status, delivery.statusClass);
    setMetricText(el.workflowLastEvent, lastEventLabel, lastOperatorEvent ? 'text-blue' : 'text-muted');
  }

  function renderSetupAssignmentSummary() {
    const summaryMap = {
      cam1: [el.setupSummaryCam1, el.setupSummaryCam1State],
      cam2: [el.setupSummaryCam2, el.setupSummaryCam2State],
      liveu3: [el.setupSummaryLiveu3, el.setupSummaryLiveu3State],
      liveu4: [el.setupSummaryLiveu4, el.setupSummaryLiveu4State]
    };
    Object.entries(summaryMap).forEach(([feed, nodes]) => {
      const [sourceNode, stateNode] = nodes;
      const metadata = getFeedMetadata(feed);
      const status = getFeedStatus(feed);
      const hasSignal = feedHasActiveSignal(feed);
      setMetricText(sourceNode, metadata.source || 'No Input', hasSignal ? 'text-green' : status === 'NO SOURCE' ? 'text-muted' : 'text-amber');
      setMetricText(stateNode, status, hasSignal ? 'text-green' : status === 'NO SOURCE' ? 'text-muted' : 'text-amber');
    });
  }

  function inspectFeed(feed) {
    if (!feed || !state.tileSources[feed]) return;
    state.inspectedFeed = feed;
    updateSourceInspector();
  }

  function updateSourceInspector() {
    const feed = state.inspectedFeed || state.previewFeed || state.activeSource || 'cam1';
    const metadata = getFeedMetadata(feed);
    const status = getFeedStatus(feed);
    const hasSignal = feedHasActiveSignal(feed);
    const isPreview = state.previewFeed === feed;
    const isProgram = state.activeSource === feed;
    const muted = !!state.mutedFeeds[feed];
    const sourceId = state.tileSourceIds[feed];
    const routeLabel = sourceId === 'none' ? metadata.source : SOURCE_DETAILS[sourceId]?.label || getAssignmentLabel(feed);
    const statusClass = status === 'ONLINE' || status === 'PLAYING' || status === 'READY' || status === 'ON AIR'
      ? 'text-green'
      : status === 'STANDBY' || status === 'SIMULATED' || status === 'CUED'
        ? 'text-amber'
        : 'text-red';

    setMetricText(el.sourceInspectorTile, getTileName(feed), isProgram ? 'text-red' : isPreview ? 'text-amber' : 'text-blue');
    setMetricText(el.sourceInspectorRoute, routeLabel || 'No Input', hasSignal ? 'text-green' : 'text-red');
    setMetricText(el.sourceInspectorState, status, statusClass);
    setMetricText(el.sourceInspectorPreview, isPreview ? 'YES' : 'NO', isPreview ? 'text-amber' : '');
    setMetricText(el.sourceInspectorProgram, isProgram ? 'ON AIR' : 'NO', isProgram ? 'text-red' : '');
    setMetricText(el.sourceInspectorAudio, muted ? 'MUTED' : 'OPEN', muted ? 'text-amber' : 'text-green');
    setMetricText(el.sourceInspectorSignal, hasSignal ? 'LOCKED' : 'NO SIGNAL', hasSignal ? 'text-green' : 'text-red');

    if (el.sourceInspectorMeta) {
      el.sourceInspectorMeta.textContent = `TECHNICAL: ${metadata.codec} · ${metadata.resolution} · ${metadata.bitrate} · RTT ${metadata.rtt}`;
    }
    renderAIOpsAssistant();
    renderEngineeringDashboard();
  }

  function getActiveAlarmSummary() {
    const alarms = [];
    LIVEU_SOURCE_IDS.forEach(sourceId => {
      const sourceState = getSourceState(sourceId);
      if (sourceState === 'OFFLINE') alarms.push(`${SOURCE_DETAILS[sourceId].shortLabel} INPUT LOSS`);
      if (sourceState === 'ALARM') alarms.push(`${SOURCE_DETAILS[sourceId].shortLabel} QC ALARM`);
      const detections = getActiveDetections(sourceId);
      detections.forEach(detection => alarms.push(`${SOURCE_DETAILS[sourceId].shortLabel} ${detection}`));
    });
    if (state.rttMs >= 160) alarms.push('HIGH RTT');
    if (state.lossPercent >= 5) alarms.push('PACKET LOSS');
    if (state.primaryFailed) alarms.push('PRIMARY PATH FAILED');
    if (state.isUnderflow) alarms.push('SRT UNDERFLOW');
    if (state.isUnderflow || state.lossPercent >= 8) alarms.push('CDN DEGRADED');
    return alarms;
  }

  function getAlarmSeverity(alarm) {
    if (/INPUT LOSS|QC ALARM|PRIMARY PATH FAILED|SRT UNDERFLOW|CDN DEGRADED/i.test(alarm)) return 'critical';
    if (/HIGH RTT|PACKET LOSS|BLACK|SILENCE|FREEZE/i.test(alarm)) return 'warning';
    return 'info';
  }

  function getAlarmAffectedArea(alarm) {
    if (/CDN/i.test(alarm)) return 'CDN Edge';
    if (/PRIMARY PATH|SRT|RTT|PACKET/i.test(alarm)) return 'Contribution transport';
    if (/LiveU/i.test(alarm)) return alarm.split(' ').slice(0, 2).join(' ');
    return 'Cloud chain';
  }

  function renderActiveAlarmHero() {
    if (!el.activeAlarmCount) return;
    const alarms = getActiveAlarmSummary();
    if (alarms.length && !state.alarmStartedAt) state.alarmStartedAt = Date.now();
    if (!alarms.length) state.alarmStartedAt = null;

    const critical = alarms.filter(alarm => getAlarmSeverity(alarm) === 'critical').length;
    const warning = alarms.filter(alarm => getAlarmSeverity(alarm) === 'warning').length;
    const info = Math.max(0, alarms.length - critical - warning);
    const primaryAlarm = alarms[0] || null;
    const incident = getIncidentSnapshot();

    el.activeAlarmCount.textContent = String(alarms.length);
    el.activeAlarmSummary.textContent = primaryAlarm || 'No active alarm conditions.';
    setMetricText(el.alarmCriticalCount, String(critical), critical ? 'text-red' : 'text-muted');
    setMetricText(el.alarmWarningCount, String(warning), warning ? 'text-amber' : 'text-muted');
    setMetricText(el.alarmInfoCount, String(info), info ? 'text-blue' : 'text-muted');
    setMetricText(el.alarmAffectedService, primaryAlarm ? getAlarmAffectedArea(primaryAlarm) : 'Cloud chain ready', primaryAlarm ? critical ? 'text-red' : 'text-amber' : 'text-green');
    setMetricText(el.alarmDuration, state.alarmStartedAt ? formatElapsedTime(Date.now() - state.alarmStartedAt) : '00:00', alarms.length ? 'text-amber' : 'text-muted');
    setMetricText(el.alarmRecommendedAction, incident.hasIncident ? incident.deliveryHealth.action : 'Continue monitoring contribution, encode, and CDN health.', incident.hasIncident ? 'text-amber' : 'text-green');
    if (el.activeAlarmState) {
      el.activeAlarmState.textContent = alarms.length ? critical ? 'CRITICAL' : 'WARNING' : 'NOMINAL';
      el.activeAlarmState.className = alarms.length ? critical ? 'badge-red font-fira' : 'badge-amber font-fira' : 'badge-green font-fira';
    }
  }

  function getRecommendedBackupFeed() {
    const current = state.activeSource;
    return ['cam2', 'liveu3', 'liveu4', 'cam1'].find(feed => feed !== current && feedHasActiveSignal(feed)) || null;
  }

  function getIncidentSnapshot() {
    const alarms = getActiveAlarmSummary();
    const programUnhealthy = state.activeSource && !feedHasActiveSignal(state.activeSource);
    const deliveryHealth = getDeliveryHealthSnapshot();
    const backupFeed = getRecommendedBackupFeed();
    const primaryCondition = programUnhealthy
      ? `PROGRAM SOURCE UNAVAILABLE: ${getProgramRouteLabel(state.activeSource)}`
      : deliveryHealth.requiresAttention
        ? deliveryHealth.condition
      : alarms[0] || null;

    return {
      alarms,
      hasIncident: !!primaryCondition,
      primaryCondition,
      programUnhealthy,
      deliveryHealth,
      backupFeed,
      backupLabel: backupFeed ? getProgramRouteLabel(backupFeed) : 'No healthy backup source available'
    };
  }

  function getDeliveryHealthSnapshot() {
    const hasProgram = !!state.activeSource;
    const hasPreview = !!state.previewFeed;
    const programHealthy = hasProgram ? feedHasActiveSignal(state.activeSource) : false;
    const networkWarning = state.rttMs >= 160 || state.lossPercent >= 5;
    const deliveryDegraded = state.isUnderflow || state.lossPercent >= 8;
    const transportStatus = state.primaryFailed ? 'BACKUP ACTIVE' : 'PRIMARY PROTECTED';
    const transportClass = state.primaryFailed ? 'text-amber' : 'text-green';
    const mediaConnectStatus = state.primaryFailed ? 'FAILOVER FLOW' : hasProgram ? 'ACTIVE FLOW' : 'READY';
    const mediaLiveStatus = hasProgram && programHealthy ? 'ENCODING PGM' : hasProgram ? 'INPUT WAIT' : 'READY';
    const packageStatus = hasProgram && programHealthy ? 'PACKAGING ABR' : 'READY';
    const cdnStatus = deliveryDegraded ? 'EDGE DEGRADED' : hasProgram && programHealthy ? 'DISTRIBUTING' : 'READY';

    let status = 'STANDBY';
    let statusClass = 'text-amber';
    let condition = 'No Program route is currently on air.';
    let action = hasPreview
      ? 'Preview is ready. TAKE only after confirming Program intent.'
      : 'Cue a healthy source to Preview before taking Program to air.';

    if (hasProgram && programHealthy && !networkWarning && !deliveryDegraded && !state.primaryFailed) {
      status = 'DELIVERING';
      statusClass = 'text-green';
      condition = `${getProgramRouteLabel(state.activeSource)} is flowing through the protected cloud chain.`;
      action = 'Continue monitoring source confidence, encoder ladder, and CDN edge health.';
    } else if (hasProgram && programHealthy) {
      status = 'DEGRADED';
      statusClass = deliveryDegraded ? 'text-red' : 'text-amber';
      condition = deliveryDegraded
        ? 'Program is on air, but delivery/QoS is degraded.'
        : 'Program is on air with transport or network warnings.';
      action = state.primaryFailed
        ? 'Confirm backup path stability and restore primary contribution when safe.'
        : 'Check packet loss, RTT, encoder buffer, and CDN edge metrics.';
    } else if (hasProgram) {
      status = 'PROGRAM RISK';
      statusClass = 'text-red';
      condition = `${getProgramRouteLabel(state.activeSource)} is routed to Program without a usable signal.`;
      action = 'Preview a healthy backup source, then TAKE BACKUP or go OFF AIR.';
    }

    return {
      hasProgram,
      hasPreview,
      programHealthy,
      networkWarning,
      deliveryDegraded,
      requiresAttention: hasProgram && (!programHealthy || networkWarning || deliveryDegraded || state.primaryFailed),
      status,
      statusClass,
      condition,
      action,
      transportStatus,
      transportClass,
      mediaConnectStatus,
      mediaLiveStatus,
      packageStatus,
      cdnStatus
    };
  }

  function renderIncidentResponse() {
    if (!el.incidentStatusBadge || !el.incidentCurrentState || !el.incidentRecommendation) return;
    const incident = getIncidentSnapshot();
    const delivery = incident.deliveryHealth;
    el.incidentStatusBadge.closest('.panel-incident-response')?.classList.toggle('is-nominal', !incident.hasIncident);
    const badgeClass = incident.hasIncident ? 'badge-amber font-fira text-amber' : 'badge-green font-fira text-green';
    el.incidentStatusBadge.className = badgeClass;
    el.incidentStatusBadge.textContent = incident.hasIncident ? 'ACTIVE INCIDENT' : 'NOMINAL';

    el.incidentCurrentState.textContent = incident.hasIncident ? incident.primaryCondition : 'No active incident';
    if (el.incidentCurrentDetail) {
      el.incidentCurrentDetail.textContent = incident.hasIncident
        ? `${incident.alarms.length} condition${incident.alarms.length === 1 ? '' : 's'} active. Delivery: ${delivery.status}. Program: ${state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR'}.`
        : delivery.hasProgram
          ? 'Program path, cloud encode, origin, and CDN delivery are nominal.'
          : 'No active incident. Program is OFF AIR and cloud chain is ready.';
    }
    el.incidentRecommendation.textContent = incident.hasIncident
      ? incident.programUnhealthy && incident.backupFeed
        ? `Preview ${incident.backupLabel}, confirm signal lock, then TAKE BACKUP if Program is affected.`
        : delivery.action
      : 'Continue monitoring contribution, cloud routing, and CDN health.';

    const enableBackup = !!incident.backupFeed;
    [el.btnIncidentPreviewBackup, el.btnIncidentTakeBackup].forEach(button => {
      if (!button) return;
      button.disabled = !enableBackup;
      button.style.opacity = enableBackup ? '1' : '0.45';
    });
    if (el.btnIncidentResolve) {
      el.btnIncidentResolve.disabled = !incident.hasIncident;
      el.btnIncidentResolve.style.opacity = incident.hasIncident ? '1' : '0.45';
    }
    if (el.btnIncidentSummary) {
      el.btnIncidentSummary.disabled = !incident.hasIncident;
      el.btnIncidentSummary.style.opacity = incident.hasIncident ? '1' : '0.45';
    }
  }

  function renderAIOpsAssistant() {
    if (!el.aiOpsList || !el.aiOpsSummary) return;
    const alarms = getActiveAlarmSummary();
    const incident = getIncidentSnapshot();
    const recommendations = [];
    const activeProgramHasSignal = state.activeSource && feedHasActiveSignal(state.activeSource);
    const programLabel = state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR';
    const previewLabel = state.previewFeed ? getProgramRouteLabel(state.previewFeed) : 'NONE';
    const delivery = incident.deliveryHealth;

    if (incident.hasIncident) {
      recommendations.push({
        label: 'INCIDENT',
        level: 'alarm',
        text: incident.primaryCondition
      });
      recommendations.push({
        label: 'IMPACT',
        level: activeProgramHasSignal ? 'warning' : 'alarm',
        text: delivery.condition
      });
      recommendations.push({
        label: 'NEXT ACTION',
        level: 'warning',
        text: incident.programUnhealthy && incident.backupFeed
          ? `Preview ${incident.backupLabel}, verify signal lock, then TAKE BACKUP if Program is affected.`
          : delivery.action
      });
    } else {
      recommendations.push({
        label: 'SHOW STATE',
        level: delivery.hasProgram ? 'info' : 'warning',
        text: `Program: ${programLabel}. Preview: ${previewLabel}. Delivery: ${delivery.status}.`
      });
      recommendations.push({
        label: 'WATCH',
        level: 'info',
        text: delivery.action
      });
    }

    if (state.rttMs >= 160 || state.lossPercent >= 5) {
      recommendations.push({
        label: 'NETWORK',
        level: 'warning',
        text: `RTT ${state.rttMs}ms · loss ${state.lossPercent.toFixed(1)}%. Increase latency buffer and avoid nonessential route changes.`
      });
    }

    el.aiOpsSummary.textContent = incident.hasIncident
      ? `${alarms.length} active condition${alarms.length === 1 ? '' : 's'}. ${delivery.status}: ${programLabel}.`
      : `Program: ${programLabel}. Preview: ${previewLabel}. Delivery: ${delivery.status}.`;
    el.aiOpsList.innerHTML = recommendations.slice(0, 3).map(item => (
      `<div class="ai-ops-item ai-${item.level}"><span>${item.label}</span><strong>${item.text}</strong></div>`
    )).join('');
    renderIncidentResponse();
  }

  function renderEngineeringDashboard() {
    syncBackendModel();
    renderRegionPreset();
    renderOperateRouteCard();
    const delivery = getDeliveryHealthSnapshot();
    const onlineInputs = TILE_FEEDS.filter(feed => feedHasActiveSignal(feed)).length;
    const alarms = getActiveAlarmSummary();
    const telemetry = state.cloudTelemetry;
    const hasLiveTelemetry = state.backend.enabled && telemetry?.mode === 'LIVE';
    const telemetryService = serviceId => hasLiveTelemetry ? telemetry.services?.[serviceId] : null;
    const applyTelemetryService = (serviceId, statusElement, detailElement, fallbackStatus, fallbackClass, fallbackDetail) => {
      const service = telemetryService(serviceId);
      if (!service) {
        setMetricText(statusElement, fallbackStatus, fallbackClass);
        if (detailElement) detailElement.textContent = fallbackDetail;
        return;
      }
      setMetricText(statusElement, service.status || 'UNKNOWN', serviceStatusClass(service.status));
      if (detailElement) detailElement.textContent = service.detail || `${service.region || 'unknown region'} collector telemetry`;
    };

    if (el.engTelemetrySource) {
      el.engTelemetrySource.textContent = hasLiveTelemetry ? 'LIVE COLLECTOR' : 'SIMULATION';
      el.engTelemetrySource.className = hasLiveTelemetry ? 'badge-green font-fira' : 'badge-blue font-fira';
    }
    setMetricText(el.engInputStatus, `${onlineInputs}/4 ${onlineInputs >= 3 ? 'READY' : 'AVAILABLE'}`, onlineInputs >= 3 ? 'text-green' : onlineInputs >= 2 ? 'text-amber' : 'text-red');
    if (el.engInputDetail) el.engInputDetail.textContent = onlineInputs >= 3
      ? 'Contribution pool is available for Preview and Program routing.'
      : 'Investigate offline contribution sources before taking them to air.';
    const gatewayState = state.ndiBridge.backendConnected ? 'BRIDGE CONNECTED' : state.ndiBridge.discovered ? 'SIMULATION' : 'NO TELEMETRY';
    setMetricText(el.engGatewayStatus, gatewayState, state.ndiBridge.backendConnected ? 'text-green' : state.ndiBridge.discovered ? 'text-amber' : 'text-muted');
    if (el.engGatewayDetail) el.engGatewayDetail.textContent = state.ndiBridge.backendConnected
      ? 'Live source discovery is available through the connected gateway.'
      : state.ndiBridge.discovered
        ? 'Demo sources are available. Connect a bridge for live discovery.'
        : 'Connect an NDI/SRT/WebRTC bridge to receive live gateway health.';
    const obs = state.obs;
    const obsConnected = obs?.status === 'CONNECTED';
    setMetricText(el.engObsStatus, obsConnected ? 'CONNECTED' : obs?.status || 'NOT CONNECTED', obsConnected ? 'text-green' : obs?.enabled ? 'text-red' : 'text-muted');
    if (el.engObsDetail) el.engObsDetail.textContent = obsConnected ? `Program: ${obs.programScene || 'none'}` : obs?.detail || 'Local OBS connector is not configured.';
    const agent = state.agent;
    const agentConnected = state.backend.enabled && state.backend.connected && agent?.mode === 'LOCAL';
    setMetricText(el.engAgentStatus, agentConnected ? 'ONLINE' : 'NOT CONNECTED', agentConnected ? 'text-green' : 'text-muted');
    if (el.engAgentDetail) {
      const obsCapability = agent?.capabilities?.obsWebSocket || 'UNKNOWN';
      const sceneCount = obs?.scenes?.length || 0;
      el.engAgentDetail.textContent = agentConnected
        ? `${agent.label || 'MCR Edge Agent'} · OBS ${obsCapability} · ${sceneCount} scenes.`
        : 'Run the local Edge Agent to connect on-prem broadcast equipment.';
    }
    applyTelemetryService('mediaConnect', el.engMediaConnectStatus, el.engMediaConnectDetail, delivery.mediaConnectStatus, state.primaryFailed ? 'text-amber' : delivery.hasProgram ? 'text-green' : 'text-blue', state.primaryFailed ? 'Path A failed. Path B is carrying contribution.' : delivery.hasProgram ? 'Contribution flow is carrying the active Program route.' : 'MediaConnect flow is armed and waiting for Program.');
    applyTelemetryService('mediaLive', el.engMediaLiveStatus, el.engMediaLiveDetail, delivery.mediaLiveStatus, delivery.hasProgram && delivery.programHealthy ? 'text-green' : delivery.hasProgram ? 'text-red' : 'text-blue', delivery.hasProgram && delivery.programHealthy ? 'Program route is encoding for distribution.' : delivery.hasProgram ? 'MediaLive is waiting for a healthy Program input.' : 'Waiting for a Program route to begin encoding.');
    applyTelemetryService('mediaPackage', el.engMediaPackageStatus, el.engMediaPackageDetail, delivery.packageStatus, delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue', delivery.hasProgram && delivery.programHealthy ? 'ABR origin is packaging the active Program output.' : 'ABR origin endpoints are ready for Program.');
    applyTelemetryService('cloudFront', el.engCdnStatus, el.engCdnDetail, delivery.cdnStatus, delivery.deliveryDegraded ? 'text-red' : delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue', delivery.deliveryDegraded ? 'Delivery is affected. Check contribution loss, encoder buffer, and CDN edge metrics.' : delivery.hasProgram && delivery.programHealthy ? 'Program is available to the configured edge distribution.' : 'Origin and edge delivery are ready for Program.');
    applyTelemetryService('directConnect', el.engPathStatus, el.engPathDetail, delivery.transportStatus, delivery.transportClass, state.primaryFailed ? 'Primary transport is unavailable. Backup transport is active.' : 'Primary and backup transport paths are armed.');

    const telemetryNetwork = hasLiveTelemetry ? telemetry.network || {} : null;
    const rttMs = typeof telemetryNetwork?.rttMs === 'number' ? telemetryNetwork.rttMs : state.rttMs;
    const lossPercent = typeof telemetryNetwork?.lossPercent === 'number' ? telemetryNetwork.lossPercent : state.lossPercent;
    const jitterMs = typeof telemetryNetwork?.jitterMs === 'number' ? telemetryNetwork.jitterMs : state.jitterMs;
    setMetricText(el.engNetworkStatus, `RTT ${rttMs}ms`, rttMs >= 160 ? 'text-red' : rttMs >= 90 ? 'text-amber' : 'text-green');
    if (el.engNetworkDetail) el.engNetworkDetail.textContent = `${lossPercent.toFixed(1)}% loss · ${jitterMs}ms jitter · ${alarms.length ? `${alarms.length} active alarm${alarms.length === 1 ? '' : 's'}` : 'no active alarms'}`;

    const encoderTelemetry = telemetryService('encoder');
    const selectedRegion = getSelectedRegion();
    const encoderRegion = encoderTelemetry?.region || selectedRegion.code;
    setMetricText(el.engRegionStatus, encoderRegion, encoderTelemetry ? serviceStatusClass(encoderTelemetry.status) : state.primaryFailed ? 'text-amber' : 'text-green');
    if (el.engRegionDetail) el.engRegionDetail.textContent = encoderTelemetry?.detail || (state.activeSource ? `${selectedRegion.encoder} is processing Program.` : `${selectedRegion.encoder} is ready.`);
    setMetricText(el.signalFlowSource, state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR', state.activeSource ? delivery.programHealthy ? 'text-green' : 'text-red' : 'text-amber');
    const directConnectTelemetry = telemetryService('directConnect');
    const mediaConnectTelemetry = telemetryService('mediaConnect');
    const mediaLiveTelemetry = telemetryService('mediaLive');
    const mediaPackageTelemetry = telemetryService('mediaPackage');
    const cloudFrontTelemetry = telemetryService('cloudFront');
    setMetricText(el.signalFlowTransport, directConnectTelemetry?.status || delivery.transportStatus, directConnectTelemetry ? serviceStatusClass(directConnectTelemetry.status) : delivery.transportClass);
    setMetricText(el.signalFlowMediaConnect, mediaConnectTelemetry?.status || delivery.mediaConnectStatus, mediaConnectTelemetry ? serviceStatusClass(mediaConnectTelemetry.status) : state.primaryFailed ? 'text-amber' : delivery.hasProgram ? 'text-green' : 'text-blue');
    setMetricText(el.signalFlowSwitcher, delivery.hasProgram ? delivery.programHealthy ? 'ACTIVE ROUTE' : 'ROUTE AT RISK' : 'IDLE', delivery.hasProgram ? delivery.programHealthy ? 'text-green' : 'text-red' : 'text-amber');
    setMetricText(el.signalFlowMediaLive, mediaLiveTelemetry?.status || delivery.mediaLiveStatus, mediaLiveTelemetry ? serviceStatusClass(mediaLiveTelemetry.status) : delivery.hasProgram && delivery.programHealthy ? 'text-green' : delivery.hasProgram ? 'text-red' : 'text-blue');
    setMetricText(el.signalFlowMediaPackage, mediaPackageTelemetry?.status || delivery.packageStatus, mediaPackageTelemetry ? serviceStatusClass(mediaPackageTelemetry.status) : delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue');
    setMetricText(el.signalFlowCdn, cloudFrontTelemetry?.status || delivery.cdnStatus, cloudFrontTelemetry ? serviceStatusClass(cloudFrontTelemetry.status) : delivery.deliveryDegraded ? 'text-red' : delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue');
    if (el.routeSummaryProgram) el.routeSummaryProgram.textContent = `ON AIR: ${state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR'}`;
    if (el.routeSummaryPreview) el.routeSummaryPreview.textContent = `PREVIEW: ${state.previewFeed ? getProgramRouteLabel(state.previewFeed) : '—'}`;
    if (el.routeSummaryPath) el.routeSummaryPath.textContent = `RESILIENCE: ${state.primaryFailed ? 'PRIMARY FAILED / BACKUP ACTIVE' : 'PRIMARY + BACKUP READY'}`;
    setMetricText(el.svcSrtStatus, state.primaryFailed ? 'BACKUP' : state.rttMs >= 160 || state.lossPercent >= 5 ? 'DEGRADED' : 'HEALTHY', state.primaryFailed || state.rttMs >= 160 || state.lossPercent >= 5 ? 'text-amber' : 'text-green');
    if (el.svcSrtMetric) el.svcSrtMetric.textContent = `RTT ${state.rttMs}ms · ${state.lossPercent.toFixed(1)}% loss · ${state.primaryFailed ? 'Backup' : 'Primary'}`;
    setMetricText(el.svcMediaConnectStatus, mediaConnectTelemetry?.status || delivery.mediaConnectStatus, mediaConnectTelemetry ? serviceStatusClass(mediaConnectTelemetry.status) : state.primaryFailed ? 'text-amber' : delivery.hasProgram ? 'text-green' : 'text-blue');
    if (el.svcMediaConnectMetric) el.svcMediaConnectMetric.textContent = `${state.primaryFailed ? 'Flow B active' : 'Flow A/B ready'} · ${selectedRegion.code}`;
    setMetricText(el.svcMediaLiveStatus, mediaLiveTelemetry?.status || delivery.mediaLiveStatus, mediaLiveTelemetry ? serviceStatusClass(mediaLiveTelemetry.status) : delivery.hasProgram && delivery.programHealthy ? 'text-green' : delivery.hasProgram ? 'text-red' : 'text-blue');
    if (el.svcMediaLiveMetric) el.svcMediaLiveMetric.textContent = `${selectedRegion.encoder} · ${delivery.hasProgram ? 'Program input' : 'Ready'}`;
    setMetricText(el.svcMediaPackageStatus, mediaPackageTelemetry?.status || delivery.packageStatus, mediaPackageTelemetry ? serviceStatusClass(mediaPackageTelemetry.status) : delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue');
    if (el.svcMediaPackageMetric) el.svcMediaPackageMetric.textContent = `ABR origin · ${state.primaryFailed ? 'Backup protected' : 'Primary protected'}`;
    setMetricText(el.svcOriginStatus, delivery.deliveryDegraded ? 'DEGRADED' : 'READY', delivery.deliveryDegraded ? 'text-red' : 'text-green');
    if (el.svcOriginMetric) el.svcOriginMetric.textContent = `${delivery.packageStatus} · HLS/DASH`;
    setMetricText(el.svcCdnStatus, cloudFrontTelemetry?.status || delivery.cdnStatus, cloudFrontTelemetry ? serviceStatusClass(cloudFrontTelemetry.status) : delivery.deliveryDegraded ? 'text-red' : delivery.hasProgram && delivery.programHealthy ? 'text-green' : 'text-blue');
    if (el.svcCdnMetric) el.svcCdnMetric.textContent = `Edge ${90 + state.rttMs}ms · ${delivery.deliveryDegraded ? 'QoS warning' : 'Healthy'}`;
    setMetricText(el.svcEncoderStatus, delivery.hasProgram ? delivery.programHealthy ? 'ENCODING' : 'INPUT WAIT' : 'READY', delivery.hasProgram ? delivery.programHealthy ? 'text-green' : 'text-red' : 'text-blue');
    if (el.svcEncoderMetric) el.svcEncoderMetric.textContent = `Ladder 1080/720/540 · ${state.calculatedBw.toFixed(1)} Mbps`;
    setMetricText(el.svcProbeStatus, alarms.length ? 'ALARMING' : 'WATCHING', alarms.length ? 'text-amber' : 'text-green');
    if (el.svcProbeMetric) el.svcProbeMetric.textContent = `${alarms.length} alarm${alarms.length === 1 ? '' : 's'} · Simulated probe`;
    setMetricText(el.drPrimaryMonitor, state.primaryFailed ? 'FAILED' : 'PROTECTED', state.primaryFailed ? 'text-red' : 'text-green');
    setMetricText(el.drBackupMonitor, state.primaryFailed ? 'ACTIVE' : 'HOT STANDBY', state.primaryFailed ? 'text-amber' : 'text-blue');
    setMetricText(el.scteNextMonitor, state.adActive ? 'AD CUE ACTIVE' : 'NONE ARMED', state.adActive ? 'text-amber' : 'text-muted');
    setMetricText(el.scteWindowMonitor, state.adActive ? 'SPLICE OPEN' : 'CLEAR', state.adActive ? 'text-amber' : 'text-green');
    renderActiveAlarmHero();
    const deliveryStages = [directConnectTelemetry, mediaConnectTelemetry, mediaLiveTelemetry, mediaPackageTelemetry, cloudFrontTelemetry].filter(Boolean);
    const telemetryFault = deliveryStages.some(service => ['DEGRADED', 'ALARM', 'FAILED'].includes(service.status));
    const deliveryState = telemetryFault ? 'ATTENTION REQUIRED' : delivery.status;
    setMetricText(el.deliveryStatus, deliveryState, telemetryFault ? 'text-red' : delivery.statusClass);
    if (el.deliveryDetail) {
      el.deliveryDetail.textContent = telemetryFault
        ? 'A transport, origin, or delivery telemetry stage is reporting degraded state.'
        : delivery.condition;
    }
    renderCloudTopology();
    renderAudioMixer();
    renderReplayPlayoutServers();
  }

  function serviceStatusClass(status) {
    if (['ALARM', 'FAILED', 'DEGRADED'].includes(status)) return 'text-red';
    if (['STANDBY', 'READY', 'IDLE', 'PREVIEW', 'INPUT WAIT', 'BACKUP'].includes(status)) return 'text-amber';
    return 'text-green';
  }

  function renderCloudTopology() {
    if (!el.cloudTopologyBody) return;
    const chain = state.systemModel.chain;
    if (!el.cloudTopologyBody.children.length) {
      el.cloudTopologyBody.innerHTML = chain.map((serviceId, index) => {
        const service = state.systemModel.services[serviceId];
        const arrow = index < chain.length - 1 ? '<div class="topology-arrow">→</div>' : '';
        return `
          <div class="topology-node" data-service="${serviceId}">
            <span>${service.label}</span>
            <strong class="topology-status">${service.status}</strong>
            <small class="topology-role">${service.role}</small>
            <div class="topology-meta font-fira"><b class="topology-instance">${service.instance}</b><em class="topology-load">${service.load}% CPU/GPU</em><em class="topology-latency">${service.latency}ms</em></div>
          </div>
          ${arrow}
        `;
      }).join('');
    }
    chain.forEach(serviceId => {
      const service = state.systemModel.services[serviceId];
      const node = el.cloudTopologyBody.querySelector(`[data-service="${serviceId}"]`);
      if (!node) return;
      node.classList.toggle('topology-active', ['ROUTING', 'PGM', 'KEYING', 'ENCODING', 'PACKAGING', 'ON AIR', 'CUED'].includes(service.status));
      node.classList.toggle('topology-alarm', ['ALARM', 'FAILED', 'DEGRADED'].includes(service.status));
      const status = node.querySelector('.topology-status');
      if (status) {
        status.textContent = service.status;
        status.className = `topology-status ${serviceStatusClass(service.status)}`;
      }
      const load = node.querySelector('.topology-load');
      const latency = node.querySelector('.topology-latency');
      if (load) load.textContent = `${service.load}% CPU/GPU`;
      if (latency) latency.textContent = `${service.latency}ms`;
    });
  }

  function renderAudioMixer() {
    if (!el.audioMixerChannels) return;
    const channelEntries = Object.entries(state.audioMixer.channels);
    if (!el.audioMixerChannels.children.length) {
      el.audioMixerChannels.innerHTML = channelEntries.map(([feed, channel]) => `
        <div class="audio-channel" data-audio-feed="${feed}">
          <div class="audio-channel-head">
            <span>${channel.label}</span>
            <strong class="audio-route-state">ISO</strong>
          </div>
          <div class="audio-channel-meter"><div class="audio-meter-l"></div><div class="audio-meter-r"></div></div>
          <input type="range" min="0" max="1" step="0.01" value="${channel.fader}" class="audio-fader" data-audio-action="fader" />
          <div class="audio-channel-controls">
            <button class="btn-filter" data-audio-action="pgm" title="Route this channel to on-air audio.">SEND TO AIR</button>
            <button class="btn-filter" data-audio-action="mute">MUTE</button>
            <button class="btn-filter" data-audio-action="solo">SOLO</button>
            <button class="btn-filter" data-audio-action="pfl" title="Listen before taking this channel to air.">LISTEN (PFL)</button>
          </div>
        </div>
      `).join('');
    }
    if (el.audioAfvToggle) el.audioAfvToggle.checked = state.audioMixer.audioFollowVideo;
    if (el.audioPgmBus) el.audioPgmBus.textContent = `ON-AIR AUDIO: ${getAudioLabel(state.audioMixer.programBus)}`;
    if (el.audioPgmStatus) el.audioPgmStatus.textContent = state.audioMixer.audioFollowVideo ? 'FOLLOWING VIDEO' : 'MANUAL AUDIO ROUTE';
    channelEntries.forEach(([feed, channel]) => {
      const row = el.audioMixerChannels.querySelector(`[data-audio-feed="${feed}"]`);
      if (!row) return;
      const vu = vuState[feed] || { l: 0, r: 0 };
      row.classList.toggle('audio-channel-pgm', state.audioMixer.programBus === feed);
      row.classList.toggle('audio-channel-muted', channel.mute);
      row.classList.toggle('audio-channel-solo', channel.solo);
      const route = row.querySelector('.audio-route-state');
      if (route) route.textContent = state.audioMixer.programBus === feed ? 'ON AIR' : channel.pfl ? 'PFL LISTEN' : 'ISO';
      const fader = row.querySelector('.audio-fader');
      if (fader && document.activeElement !== fader) fader.value = channel.fader;
      const meterL = row.querySelector('.audio-meter-l');
      const meterR = row.querySelector('.audio-meter-r');
      if (meterL) meterL.style.height = `${vu.l * channel.fader * 100}%`;
      if (meterR) meterR.style.height = `${vu.r * channel.fader * 100}%`;
      row.querySelector('[data-audio-action="mute"]')?.classList.toggle('filter-active', channel.mute);
      row.querySelector('[data-audio-action="solo"]')?.classList.toggle('filter-active', channel.solo);
      row.querySelector('[data-audio-action="pfl"]')?.classList.toggle('filter-active', channel.pfl);
      row.querySelector('[data-audio-action="pgm"]')?.classList.toggle('filter-active', state.audioMixer.programBus === feed);
    });
    if (el.audioPgmMeterL) el.audioPgmMeterL.style.height = `${vuState.pgm.l * 100}%`;
    if (el.audioPgmMeterR) el.audioPgmMeterR.style.height = `${vuState.pgm.r * 100}%`;
  }

  function renderTxSafety() {
    if (el.toggleSourceLock) el.toggleSourceLock.checked = state.txSafety.sourceLock;
    if (el.toggleProgramProtect) el.toggleProgramProtect.checked = state.txSafety.programProtection;
    if (el.toggleAfvPanel) el.toggleAfvPanel.checked = state.audioMixer.audioFollowVideo;
    if (el.btnToggleCleanFeed) {
      el.btnToggleCleanFeed.textContent = state.txSafety.cleanFeed ? 'CLEAN FEED' : 'DIRTY FEED';
      el.btnToggleCleanFeed.classList.toggle('filter-active', state.txSafety.cleanFeed);
    }
    if (el.btnToggleFailoverMode) {
      el.btnToggleFailoverMode.textContent = `${state.txSafety.failoverMode} FAILOVER`;
      el.btnToggleFailoverMode.classList.toggle('filter-active', state.txSafety.failoverMode === 'AUTO');
    }
    if (el.btnToggleRecording) {
      el.btnToggleRecording.textContent = state.txSafety.recording ? 'REC ARMED' : 'REC OFF';
      el.btnToggleRecording.classList.toggle('filter-active', state.txSafety.recording);
    }
    if (el.txControlState) {
      el.txControlState.textContent = state.txSafety.programProtection ? 'PROTECTED' : 'OPEN';
      el.txControlState.className = `${state.txSafety.programProtection ? 'badge-red' : 'badge-amber'} font-fira`;
    }
    if (el.txPathStatus) {
      el.txPathStatus.textContent = state.primaryFailed ? 'BACKUP ACTIVE' : 'PRIMARY + BACKUP';
      el.txPathStatus.className = state.primaryFailed ? 'text-amber' : 'text-green';
    }
    if (el.txFailoverMode) {
      el.txFailoverMode.textContent = state.txSafety.failoverMode;
      el.txFailoverMode.className = state.txSafety.failoverMode === 'AUTO' ? 'text-green' : 'text-amber';
    }
    if (el.txRecordingStatus) {
      el.txRecordingStatus.textContent = state.txSafety.recording && state.activeSource ? 'REC LIVE' : state.txSafety.recording ? 'REC ARMED' : 'REC OFF';
      el.txRecordingStatus.className = state.txSafety.recording ? 'text-red' : 'text-muted';
    }
    if (el.txEncoderLadder) {
      el.txEncoderLadder.textContent = state.activeSource ? '1080/720/540/360' : 'IDLE';
      el.txEncoderLadder.className = state.activeSource ? 'text-green' : 'text-muted';
    }
    const backupFeed = getRecommendedBackupFeed() || (!state.activeSource ? TILE_FEEDS.find(feed => feedHasActiveSignal(feed)) : null);
    if (el.btnEmergencyBackup) {
      el.btnEmergencyBackup.disabled = !backupFeed;
      el.btnEmergencyBackup.style.opacity = backupFeed ? '1.0' : '0.45';
      el.btnEmergencyBackup.classList.toggle('btn-disabled', !backupFeed);
      el.btnEmergencyBackup.title = backupFeed
        ? `Route ${getProgramRouteLabel(backupFeed)} to Program immediately.`
        : 'No healthy backup source is available.';
    }
    if (el.scteTimelineProgress) {
      const pct = state.adActive ? Math.max(0, Math.min(100, ((30 - state.adTimeRemaining) / 30) * 100)) : 0;
      el.scteTimelineProgress.style.width = `${pct}%`;
    }
    if (el.scteTimelineLabel) {
      el.scteTimelineLabel.textContent = state.adActive ? `SPLICE ACTIVE ${state.adTimeRemaining.toFixed(1)}s` : 'NO ACTIVE MARKER';
      el.scteTimelineLabel.className = state.adActive ? 'text-pink' : '';
    }
  }

  function getAlertSummary() {
    const alarms = [];
    const warnings = [];

    if (state.primaryFailed) alarms.push('Primary path failed');
    if (state.isUnderflow) alarms.push('SRT underflow');

    LIVEU_SOURCE_IDS.forEach(sourceId => {
      const stateName = getSourceState(sourceId);
      const label = SOURCE_DETAILS[sourceId].shortLabel;
      if (stateName === 'ALARM') alarms.push(`${label} alarm`);
      else if (stateName === 'OFFLINE') warnings.push(`${label} offline`);
    });

    const programSource = getProgramSourceId();
    if (state.activeSource && !feedHasActiveSignal(state.activeSource) && programSource !== 'ad') {
      alarms.push('Program source unavailable');
    }

    return { alarms, warnings };
  }

  function setMetricClass(metric, className) {
    if (metric) metric.className = `badge-value ${className}`;
  }

  function updateHeaderMetrics() {
    if (state.activeSource && !state.onAirStartedAt) state.onAirStartedAt = Date.now();
    const totalBandwidth = TILE_FEEDS.reduce((sum, feed) => sum + getEstimatedFeedBandwidth(feed), 0) + getEstimatedFeedBandwidth('vod');
    el.totalBw.textContent = `${totalBandwidth.toFixed(1)} Mbps`;

    const { alarms, warnings } = getAlertSummary();
    if (alarms.length) {
      el.matrixAlarm.textContent = `${alarms.length} ALARM${alarms.length > 1 ? 'S' : ''}`;
      setMetricClass(el.matrixAlarm, 'text-red pulse-red');
    } else if (warnings.length) {
      el.matrixAlarm.textContent = `${warnings.length} WARN${warnings.length > 1 ? 'S' : ''}`;
      setMetricClass(el.matrixAlarm, 'text-amber');
    } else {
      el.matrixAlarm.textContent = 'OK';
      setMetricClass(el.matrixAlarm, 'text-green');
    }

    if (el.onAirValue) {
      el.onAirValue.textContent = state.activeSource ? 'LIVE' : 'OFF';
      setMetricClass(el.onAirValue, state.activeSource ? 'text-red pulse-red' : 'text-muted');
    }

    if (!el.systemHealth) return;
    if (alarms.length) {
      el.systemHealth.textContent = 'ALARM';
      setMetricClass(el.systemHealth, 'text-red pulse-red');
    } else if (state.adActive) {
      el.systemHealth.textContent = 'AD BREAK';
      setMetricClass(el.systemHealth, 'text-pink');
    } else if (warnings.length || state.primaryFailed) {
      el.systemHealth.textContent = 'DEGRADED';
      setMetricClass(el.systemHealth, 'text-amber');
    } else if (state.activeSource) {
      el.systemHealth.textContent = 'ON AIR';
      setMetricClass(el.systemHealth, 'text-green');
    } else if (state.previewFeed) {
      el.systemHealth.textContent = 'PREVIEW';
      setMetricClass(el.systemHealth, 'text-blue');
    } else {
      el.systemHealth.textContent = 'READY';
      setMetricClass(el.systemHealth, 'text-green');
    }
    renderAIOpsAssistant();
    renderEngineeringDashboard();
    renderTxSafety();
    renderOperatorWorkflowStatus();
  }

  function feedHasActiveSignal(feed) {
    if (feed === 'replay' || feed === 'playout') return true;
    const assignment = getFeedAssignment(feed);
    if (assignment === 'none') return false;
    if (LIVEU_SOURCE_IDS.includes(state.tileSourceIds[feed])) return sourceHasSignal(state.tileSourceIds[feed]);
    if (assignment === 'ndi') return sourceHasSignal(state.tileSourceIds[feed]);
    if (assignment === 'webcam') return state.webcamReady && el.cam1Video.readyState >= 2;
    if (assignment === 'localVideo') {
      const local = getLocalVideo(feed);
      return !!local?.ready && local.videoEl.readyState >= 2;
    }
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

  function drawEmbeddedSourceSlate(ctx, width, height, title, subtitle) {
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.fillStyle = 'rgba(0, 210, 255, 0.12)';
    ctx.fillRect(18, 18, width - 36, height - 36);
    ctx.fillStyle = '#00d2ff';
    ctx.font = 'bold 18px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height / 2 - 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px Fira Code';
    ctx.fillText(subtitle, width / 2, height / 2 + 12);
    ctx.textAlign = 'left';
  }

  function drawNdiBridgeStream(ctx, width, height, frames, source = {}) {
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, width, height);

    const sweepX = (frames * 2.2) % width;
    const colors = ['#00d2ff', '#10b981', '#ec4899'];
    for (let i = 0; i < 9; i += 1) {
      ctx.strokeStyle = `${colors[i % colors.length]}33`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const y = (height / 10) * (i + 1);
      for (let x = 0; x <= width; x += 12) {
        const wave = Math.sin((x + frames * 3 + i * 18) * 0.025) * 8;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 210, 255, 0.12)';
    ctx.fillRect(sweepX - 18, 0, 36, height);
    ctx.strokeStyle = '#00d2ff';
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.fillStyle = '#00d2ff';
    ctx.font = 'bold 13px Outfit';
    ctx.fillText('NDI BRIDGE PREVIEW', 18, 32);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px Fira Code';
    ctx.fillText(source.label || 'NDI source', 18, 50);
    ctx.fillText(`${source.codec || 'NDI'} · ${source.resolution || '1080p60'} · ${source.location || 'Bridge'}`, 18, 66);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.font = '9px Fira Code';
    ctx.fillText('DISCOVERED BY MCR NDI GATEWAY', 18, height - 22);
  }

  function drawFeedCanvas(feed, ctx, w, h, frames) {
    const assignment = getFeedAssignment(feed);
    if (!feedHasActiveSignal(feed) && feed !== 'vod') {
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (assignment === 'custom') {
      const src = state.customSources[feed];
      if (src?.type === 'youtube') {
        drawEmbeddedSourceSlate(ctx, w, h, 'YOUTUBE LIVE', 'EMBEDDED PLAYER ACTIVE');
        return;
      }
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
      const local = getLocalVideo(feed);
      if (local?.ready && drawVideoFrame(local.videoEl, ctx, w, h)) return;
      drawStreamLossStatic(ctx, w, h);
      return;
    }

    if (assignment === 'ndi') {
      const ndiId = getTileNdiSourceId(feed);
      drawNdiBridgeStream(ctx, w, h, frames, NDI_SOURCES[ndiId]);
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

  function reconcileRouteAvailability() {
    if (state.previewFeed && !feedHasActiveSignal(state.previewFeed)) {
      const previousPreview = state.previewFeed;
      clearPreviewUI();
      addLog('warning', 'MUX', `${getProgramRouteLabel(previousPreview)} removed from Preview because the signal is unavailable.`);
    }
    if (state.activeSource && state.activeSource !== 'ad' && !feedHasActiveSignal(state.activeSource)) {
      const previousProgram = state.activeSource;
      clearProgramOut(`${getProgramRouteLabel(previousProgram)} removed from Program because the signal is unavailable.`);
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

      const previewButton = document.getElementById(`btn-solo-${feed}`);
      const hasSignal = feedHasActiveSignal(feed);
      const assignment = getFeedAssignment(feed);
      if (previewButton) {
        previewButton.disabled = !hasSignal;
        previewButton.classList.toggle('btn-disabled', !hasSignal);
        previewButton.title = assignment === 'none'
          ? 'Configure this source in Setup before sending it to Preview.'
          : hasSignal
            ? 'Send this source to the Preview bus.'
            : 'This source has no usable signal.';
      }
    });

    el.badgeStateCam1.textContent = getFeedStatus('cam1');
    el.badgeStateCam2.textContent = getFeedStatus('cam2');
    el.badgeStateLiveu3.textContent = getFeedStatus('liveu3');
    el.badgeStateLiveu4.textContent = getFeedStatus('liveu4');

    reconcileRouteAvailability();

    const statusParts = [];
    statusParts.push(`Webcam ➜ ${String(state.mediaAssignments.webcam ?? 'NONE').toUpperCase()}`);
    statusParts.push(`Video ➜ ${String(state.mediaAssignments.localVideo ?? 'NONE').toUpperCase()}`);
    if (state.webcamReady) statusParts.unshift('Webcam ONLINE');
    if (Object.values(state.localVideos).some(local => local.ready)) statusParts.unshift('Local video PLAYING');
    if (el.actionStatus) el.actionStatus.textContent = statusParts.length ? statusParts.join(' · ') : 'No source routed yet';
    renderSetupAssignmentSummary();
    updateSourceInspector();
    updateHeaderMetrics();
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

  el.btnStartWebcam?.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('warning', 'WEB', 'Webcam capture is not supported in this browser.');
      if (el.actionStatus) el.actionStatus.textContent = 'Webcam unsupported';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (el.cam1Video) el.cam1Video.srcObject = stream;
      state.webcamStream = stream;
      state.webcamReady = true;
      state.cam1VideoReady = true;
      await el.cam1Video?.play().catch(() => {});
      assignMediaTarget('webcam', el.selectWebcamTarget?.value || 'cam1');
      updateSourceOverlays();
      addLog('info', 'WEB', 'Browser webcam started and assigned to LiveU source.');
      addLog('info', 'MIX', `Webcam available at ${String(state.mediaAssignments.webcam ?? 'NONE').toUpperCase()}.`);
    } catch (error) {
      addLog('alarm', 'WEB', `Unable to access webcam: ${error.message}`);
      if (el.actionStatus) el.actionStatus.textContent = 'Webcam access denied';
    }
  });

  el.btnLoadLocalVideo?.addEventListener('click', () => {
    pendingLocalAssignTarget = el.selectVideoTarget?.value || 'cam2';
    el.localVideoFileInput?.click();
  });

  el.localVideoFileInput?.addEventListener('change', () => {
    const file = el.localVideoFileInput.files?.[0];
    if (!file) return;
    const target = pendingLocalAssignTarget || el.selectVideoTarget.value || 'cam2';
    attachLocalVideoBlob(target, file, file.name, { persistFile: file });
    pendingLocalAssignTarget = null;
    updateSourceOverlays();
    el.localVideoFileInput.value = '';
  });

  el.cam2Video?.addEventListener('loadedmetadata', () => {
    state.cam2VideoReady = true;
    updateSourceOverlays();
  });

  el.cam1Video?.addEventListener('loadedmetadata', () => {
    state.webcamReady = true;
    state.cam1VideoReady = true;
    updateSourceOverlays();
  });

  function assignMediaTarget(mediaType, target) {
    const otherType = mediaType === 'webcam' ? 'localVideo' : 'webcam';
    const existingAssignment = getFeedAssignment(target);
    const shouldClearTarget = state.mediaAssignments[otherType] === target || (existingAssignment !== 'none' && existingAssignment !== mediaType);
    if (shouldClearTarget) {
      clearTileSource(target);
    }

    const previousTarget = state.mediaAssignments[mediaType];
    if (mediaType === 'webcam' && previousTarget && previousTarget !== target && getFeedAssignment(previousTarget) === mediaType) {
      clearTileSource(previousTarget);
    }

    state.mediaAssignments[mediaType] = target;
    setTileSource(target, mediaType);
    addLog('info', 'ROUTE', `${mediaType === 'webcam' ? 'Webcam' : 'Local Video'} assigned to ${target.toUpperCase()}.`);
    updateSourceOverlays();
  }

  el.selectWebcamTarget?.addEventListener('change', () => {
    assignMediaTarget('webcam', el.selectWebcamTarget.value);
  });

  el.selectVideoTarget?.addEventListener('change', () => {
    assignMediaTarget('localVideo', el.selectVideoTarget.value);
  });

  function stopWebcam() {
    const assignedFeed = state.mediaAssignments.webcam;

    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach(track => track.stop());
      state.webcamStream = null;
    }
    if (el.cam1Video) el.cam1Video.srcObject = null;
    state.webcamReady = false;
    state.cam1VideoReady = false;
    addLog('info', 'WEB', 'Webcam stopped and removed from assigned source.');

    if (assignedFeed) clearTileSource(assignedFeed);
    state.mediaAssignments.webcam = null;

    updateSourceOverlays();
    clearCanvas(assignedFeed);
    saveWorkspaceState();
  }

  function ejectLocalVideo(feed = el.selectVideoTarget.value || state.mediaAssignments.localVideo) {
    if (!feed || !state.localVideos[feed]) {
      addLog('warning', 'VIDEO', 'No local video loaded on the selected route.');
      return;
    }

    const fileName = state.localVideos[feed].fileName;
    teardownLocalVideo(feed);
    deletePersistedLocalVideo(feed);
    clearTileSource(feed);
    if (state.mediaAssignments.localVideo === feed) state.mediaAssignments.localVideo = null;
    addLog('info', 'VIDEO', `Local video cleared from ${getTileName(feed)}: ${fileName}.`);

    updateSourceOverlays();
    clearCanvas(feed);
    saveWorkspaceState();
  }

  el.btnStopWebcam?.addEventListener('click', stopWebcam);
  el.btnEjectVideo?.addEventListener('click', ejectLocalVideo);

  // Pending assignment target when user selects "Local Video" for a specific tile
  let pendingLocalAssignTarget = null;

  function setPreview(feed) {
    if (!feedHasActiveSignal(feed)) {
      const assignment = getFeedAssignment(feed);
      const sourceId = state.tileSourceIds[feed];
      const label = assignment === 'none' ? getTileName(feed) : SOURCE_DETAILS[sourceId]?.label || getAssignmentLabel(feed);
      addLog('warning', 'MUX', `${label} cannot be sent to Preview because it has no usable signal.`);
      updateSourceOverlays();
      return false;
    }
    state.inspectedFeed = feed;
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
    updateSourceInspector();
    addLog('info', 'MUX', `Preview set to ${getTileName(feed)}.`);
    saveWorkspaceState();
    backendCommand('/api/preview', { source: feed });
    return true;
  }

  function getTileName(feed) {
    if (feed === 'replay') return 'REPLAY SERVER';
    if (feed === 'playout') return 'PLAYOUT SERVER';
    return feed === 'cam1' ? 'MULTIVIEW 1' : feed === 'cam2' ? 'MULTIVIEW 2' : feed === 'liveu3' ? 'MULTIVIEW 3' : feed === 'liveu4' ? 'MULTIVIEW 4' : feed === 'vod' ? 'GRAPHICS OVERLAY' : feed.toUpperCase();
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
    const previewReady = !!state.previewFeed && feedHasActiveSignal(state.previewFeed);
    [el.btnTake, el.btnCut].forEach(button => {
      setControlEnabled(
        button,
        previewReady,
        'Send the current Preview source to Program Out.',
        'Select a healthy source in Preview before taking Program.'
      );
    });
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
    const currentLine = document.getElementById('pgm-status-current');
    const nextLine = document.getElementById('pgm-status-next');
    
    if (currentLine) {
      currentLine.textContent = state.activeSource ? `CURRENT / PROGRAM: ${getProgramRouteLabel(state.activeSource)}` : 'CURRENT / PROGRAM: OFF AIR';
    }
    if (nextLine) {
      nextLine.textContent = state.previewFeed ? `NEXT / PREVIEW: ${getProgramRouteLabel(state.previewFeed)}` : 'NEXT / PREVIEW: —';
    }
    const graphicsLine = document.getElementById('pgm-status-graphics');
    if (graphicsLine) {
      const layers = [];
      if (state.activeGraphics) layers.push(graphicsLabel(state.activeGraphics));
      if (state.tickerOn) layers.push('Ticker');
      if (state.bugOn) layers.push('Bug');
      graphicsLine.textContent = layers.length ? `GRAPHICS: ${layers.join(' + ')} ON AIR` : state.graphicsPreview ? `GRAPHICS PREVIEW: ${graphicsLabel(state.graphicsPreview)}` : 'GRAPHICS: CLEAR';
    }
    if (el.btnClearProgram) {
      setControlEnabled(el.btnClearProgram, !!state.activeSource, 'Take Program off air.', 'Program is already off air.');
    }
    if (el.btnFadeBlack) {
      setControlEnabled(el.btnFadeBlack, !!state.activeSource, 'Fade Program Out to black.', 'Program is already off air.');
    }
    renderAIOpsAssistant();
    renderEngineeringDashboard();
  }

  function graphicsLabel(type) {
    const labels = {
      lowerThird: 'Lower Third',
      ticker: 'Ticker',
      bug: 'Score Bug'
    };
    return labels[type] || 'Graphic';
  }

  function updateGraphicsUI() {
    const previewBadge = document.getElementById('preview-badge-vod');
    const programBadge = document.getElementById('program-badge-vod');
    const card = document.getElementById('screen-vod');
    const badge = document.getElementById('badge-state-vod');
    const layers = [];
    if (state.activeGraphics) layers.push(graphicsLabel(state.activeGraphics));
    if (state.tickerOn) layers.push('Ticker');
    if (state.bugOn) layers.push('Bug');

    if (previewBadge) previewBadge.style.display = state.graphicsPreview ? 'block' : 'none';
    if (programBadge) programBadge.style.display = layers.length ? 'block' : 'none';
    if (card) {
      card.classList.toggle('preview-active', !!state.graphicsPreview);
      card.classList.toggle('program-active', layers.length > 0);
    }
    if (badge) {
      badge.textContent = layers.length ? 'OVERLAY ON AIR' : state.graphicsPreview ? 'OVERLAY PREVIEW' : 'OVERLAY STBY';
      badge.classList.toggle('text-red', layers.length > 0);
      badge.classList.toggle('text-pink', layers.length === 0);
    }
    if (el.cgEngineLayer) {
      el.cgEngineLayer.textContent = layers.length ? layers.join(' + ').toUpperCase() : state.graphicsPreview ? `${graphicsLabel(state.graphicsPreview).toUpperCase()} PVW` : 'STANDBY';
    }
    el.btnTakeGraphics?.classList.toggle('btn-active-graphics', !!state.graphicsPreview);
    el.btnToggleTicker?.classList.toggle('btn-active-graphics', state.tickerOn);
    el.btnToggleBug?.classList.toggle('btn-active-graphics', state.bugOn);
    setControlEnabled(el.btnTakeGraphics, !!state.activeSource && !!state.graphicsPreview, 'Key the previewed graphic over Program.', 'Program must be on air and a graphic must be previewed first.');
    setControlEnabled(el.btnToggleTicker, !!state.activeSource, 'Toggle the ticker graphic over Program Out.', 'Program must be on air before keying ticker graphics.');
    setControlEnabled(el.btnToggleBug, !!state.activeSource, 'Toggle the live/score bug over Program Out.', 'Program must be on air before keying bug graphics.');
    setControlEnabled(el.btnClearGraphics, !!state.graphicsPreview || layers.length > 0, 'Clear previewed and on-air graphics.', 'No graphics are currently previewed or on air.');
    updatePGMFooter();
  }

  function previewGraphic(type = 'lowerThird') {
    state.graphicsPreview = type;
    updateGraphicsUI();
    addLog('info', 'CG', `${graphicsLabel(type)} loaded to CG preview.`);
    backendCommand('/api/cg-preview', { layer: type });
  }

  function takeGraphic() {
    if (!state.activeSource) {
      addLog('warning', 'CG', 'Graphics take blocked: Program is off air.');
      updateGraphicsUI();
      return;
    }
    if (!state.graphicsPreview) {
      addLog('warning', 'CG', 'Graphics take blocked: preview a graphic before taking it to air.');
      updateGraphicsUI();
      return;
    }
    const graphic = state.graphicsPreview || 'lowerThird';
    state.activeGraphics = graphic;
    state.graphicsPreview = null;
    updateGraphicsUI();
    addLog('info', 'CG', `${graphicsLabel(graphic)} keyed over Program.`);
    backendCommand('/api/cg-take', { layer: graphic });
  }

  function clearGraphics(message = 'All graphics cleared from Program.') {
    const hadGraphics = !!state.activeGraphics || state.tickerOn || state.bugOn || !!state.graphicsPreview;
    state.activeGraphics = null;
    state.graphicsPreview = null;
    state.tickerOn = false;
    state.bugOn = false;
    updateGraphicsUI();
    if (hadGraphics) addLog('info', 'CG', message);
    backendCommand('/api/cg-clear');
  }

  function toggleGraphicsLayer(layer) {
    if (!state.activeSource) {
      addLog('warning', 'CG', `${graphicsLabel(layer)} blocked: Program is off air.`);
      updateGraphicsUI();
      return;
    }
    if (layer === 'ticker') state.tickerOn = !state.tickerOn;
    if (layer === 'bug') state.bugOn = !state.bugOn;
    updateGraphicsUI();
    const isOn = layer === 'ticker' ? state.tickerOn : state.bugOn;
    addLog('info', 'CG', `${graphicsLabel(layer)} ${isOn ? 'keyed over Program' : 'cleared from Program'}.`);
  }

  function syncProgramEmbed() {
    state.programEmbedFrame = null;

    Object.entries(state.customSources).forEach(([feed, src]) => {
      if (src?.type !== 'youtube' || !src.frameEl) return;

      const isProgramSource = state.activeSource === feed;
      const targetWrapper = getCanvasWrapper(isProgramSource ? 'pgm' : feed);
      if (!targetWrapper) return;

      if (src.frameEl.parentNode !== targetWrapper) {
        targetWrapper.appendChild(src.frameEl);
      }

      src.frameEl.classList.toggle('tile-embed-frame-pgm', isProgramSource);
      src.frameEl.title = isProgramSource
        ? 'PROGRAM OUT YouTube source'
        : `${getTileName(feed)} YouTube source`;

      if (isProgramSource) state.programEmbedFrame = src.frameEl;
      applyYouTubeMute(feed);
    });
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
    const activeAssignment = state.activeSource ? getFeedAssignment(state.activeSource) : 'none';
    const activeCustomSource = state.activeSource ? state.customSources[state.activeSource] : null;
    const isCustomProgram = activeAssignment === 'custom';
    const isLiveu1 = source === 'cam1';
    const isLiveu1Source = source === 'liveu1';
    const isLiveu2 = source === 'cam2';
    const isLiveu2Source = source === 'liveu2';
    const isLiveu3 = source === 'liveu3';
    const isLiveu4 = source === 'liveu4';
    const hasGraphicsLayer = !!state.activeGraphics || state.tickerOn || state.bugOn;
    const isReplay = source === 'replay';
    const isPlayout = source === 'vod' || source === 'ad' || source === 'playout';
    const hasProgram = !!source;
    const routeColor = isReplay ? '#f59e0b' : isCustomProgram ? '#00d2ff' : isLiveu2 || isLiveu2Source ? '#00d2ff' : isLiveu3 ? '#f59e0b' : isLiveu4 ? '#a78bfa' : isPlayout ? '#ec4899' : '#10b981';
    const sourceLinkState = (sourceId, isActive, activeState = 'active') => {
      if (!sourceHasSignal(sourceId)) return 'broken';
      return isActive ? activeState : 'standby';
    };

    setSvgLinkState(el.pathCam1, state.primaryFailed ? 'broken' : sourceLinkState('liveu1', isLiveu1 || isLiveu1Source), '#10b981');
    setSvgLinkState(el.pathCam2, sourceLinkState('liveu2', isLiveu2 || isLiveu2Source, 'active-blue'), '#00d2ff');
    setSvgLinkState(el.pathLiveu3, sourceLinkState('liveu3', isLiveu3), '#f59e0b');
    setSvgLinkState(el.pathLiveu4, sourceLinkState('liveu4', isLiveu4), '#a78bfa');
    setSvgLinkState(el.pathVod, isPlayout || hasGraphicsLayer ? 'active' : 'standby', '#ec4899');
    setSvgLinkState(el.pathSwitchToTrans, hasProgram ? (isLiveu2 ? 'active-blue' : 'active') : 'standby', routeColor);
    setSvgLinkState(el.pathTransToCdn, hasProgram ? (isLiveu2 ? 'active-blue' : 'active') : 'standby', routeColor);

    setSvgDotState(el.dotCam1, (isLiveu1 || isLiveu1Source) && !state.primaryFailed && sourceHasSignal('liveu1'), '#10b981');
    setSvgDotState(el.dotCam2, (isLiveu2 || isLiveu2Source) && sourceHasSignal('liveu2'), '#00d2ff');
    setSvgDotState(el.dotLiveu3, isLiveu3 && sourceHasSignal('liveu3'), '#f59e0b');
    setSvgDotState(el.dotLiveu4, isLiveu4 && sourceHasSignal('liveu4'), '#a78bfa');
    setSvgDotState(el.dotVod, isPlayout || hasGraphicsLayer, '#ec4899');
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
      routeLabel = 'GRAPHICS';
      switcherLabel = 'GRAPHICS';
    } else if (source === 'ad') {
      routeLabel = 'AD CUE';
      switcherLabel = 'SCTE-35';
    } else if (source === 'replay') {
      routeLabel = 'REPLAY';
      switcherLabel = 'REPLAY SERVER';
    } else if (source === 'playout') {
      routeLabel = 'PLAYOUT';
      switcherLabel = 'PLAYOUT SERVER';
    } else if (isCustomProgram) {
      routeLabel = activeCustomSource?.type === 'youtube' ? 'YOUTUBE' : 'CUSTOM';
      switcherLabel = routeLabel;
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
      const sourceLabel = SOURCE_DETAILS[source]?.label || getProgramRouteLabel(state.activeSource);
      el.inspectorText.innerHTML = `<strong class="text-green">Active Program Route</strong>: ${sourceLabel} via ${getTileName(state.activeSource)} → ST 2022-7 Switcher → AWS MediaLive → CDN Edge.`;
    } else if (state.primaryFailed) {
      el.inspectorText.innerHTML = '<strong class="text-red">Path A failure detected</strong>: LiveU 1 contribution is unavailable. Route backup or restore primary.';
    } else {
      el.inspectorText.innerHTML = '<strong class="text-green">ST 2022-7 Switcher</strong>: Waiting for PREVIEW/TAKE route selection.';
    }
    updateHeaderMetrics();
    renderAIOpsAssistant();
  }

  function clearPreviewUI() {
    state.previewFeed = null;
    document.querySelectorAll('.btn-solo').forEach(b => b.classList.remove('btn-active-solo'));
    document.querySelectorAll('.screen-card').forEach(c => c.classList.remove('preview-active'));
    updateTAKEButton();
    updateBadges();
    updatePGMFooter();
    updateSourceInspector();
    saveWorkspaceState();
  }

  function routePreviewToProgram(actionLabel = 'TAKE') {
    const isEmergencyAction = /EMERGENCY|BACKUP|AI OPS/i.test(actionLabel);
    if (state.txSafety.sourceLock && state.activeSource && !isEmergencyAction) {
      addLog('warning', 'MIX', `TAKE blocked by Source Lock. Current Program remains ${getProgramRouteLabel(state.activeSource)}.`);
      renderTxSafety();
      return false;
    }
    if (!state.previewFeed) {
      addLog('warning', 'MIX', 'No preview source selected to take.');
      return false;
    }
    if (!feedHasActiveSignal(state.previewFeed)) {
      const sourceId = state.tileSourceIds[state.previewFeed];
      const sourceLabel = SOURCE_DETAILS[sourceId]?.label || getTileName(state.previewFeed);
      addLog('warning', 'MIX', `TAKE blocked: ${sourceLabel} is not available.`);
      return false;
    }
    state.activeSource = state.previewFeed;
    if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
    state.programSourceOverride = null;
    syncAudioFollowVideo(actionLabel);
    clearPreviewUI();
    if (el.pgmActiveSource) el.pgmActiveSource.textContent = `SOURCE: ${getProgramRouteLabel(state.activeSource)}`;
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    renderTxSafety();
    syncProgramEmbed();
    updateSourceInspector();
    addLog('info', 'MIX', `${actionLabel} executed. Program switched to ${getTileName(state.activeSource)}.`);
    saveWorkspaceState();
    backendCommand('/api/take', { source: state.activeSource, action: actionLabel });
    return true;
  }

  function routeEmergencyBackup() {
    if (!window.confirm('Emergency Backup will immediately route the healthiest backup source to Program. Continue?')) {
      addLog('warning', 'MIX', 'Emergency backup cancelled by operator.');
      return;
    }
    const backupFeed = getRecommendedBackupFeed() || (!state.activeSource ? TILE_FEEDS.find(feed => feedHasActiveSignal(feed)) : null);
    if (!backupFeed) {
      clearProgramOut('Emergency backup failed: no healthy contribution source available.');
      addLog('alarm', 'MIX', 'Emergency backup unavailable. No healthy contribution source found.');
      return;
    }
    setPreview(backupFeed);
    routePreviewToProgram('EMERGENCY BACKUP');
    addLog('alarm', 'MIX', `Emergency backup routed: ${getProgramRouteLabel(backupFeed)}.`);
  }

  function previewIncidentBackup() {
    const backupFeed = getRecommendedBackupFeed();
    if (!backupFeed) {
      addLog('alarm', 'AI', 'AI Ops found no healthy backup source to preview.');
      renderIncidentResponse();
      return;
    }
    setPreview(backupFeed);
    addLog('warning', 'AI', `AI Ops recommended backup preview: ${getProgramRouteLabel(backupFeed)}.`);
    renderIncidentResponse();
  }

  function takeIncidentBackup() {
    const backupFeed = getRecommendedBackupFeed();
    if (!backupFeed) {
      addLog('alarm', 'AI', 'AI Ops backup take blocked: no healthy backup source available.');
      renderIncidentResponse();
      return;
    }
    setPreview(backupFeed);
    routePreviewToProgram('AI OPS BACKUP TAKE');
    addLog('alarm', 'AI', `AI Ops backup action executed: ${getProgramRouteLabel(backupFeed)} is now Program.`);
    renderIncidentResponse();
  }

  function resolveIncident() {
    const incident = getIncidentSnapshot();
    if (!incident.hasIncident) {
      addLog('info', 'AI', 'Incident resolve requested, but no active incident is present.');
      return;
    }
    state.primaryFailed = false;
    state.isUnderflow = false;
    state.unrecoveredLoss = 0;
    state.lossPercent = Math.min(state.lossPercent, 1.5);
    if (el.slideLoss) el.slideLoss.value = state.lossPercent;
    LIVEU_SOURCE_IDS.forEach(sourceId => {
      if (state.sourceBaseStates[sourceId] === 'OFFLINE' || state.sourceBaseStates[sourceId] === 'ALARM') {
        state.sourceBaseStates[sourceId] = sourceId === 'liveu2' ? 'STANDBY' : 'ONLINE';
      }
      state.sourceDetections[sourceId] = { black: false, silence: false, frozen: false };
      state.sourceStates[sourceId] = deriveSourceState(sourceId);
    });
    syncSourceControlInputs();
    updateSourceInspector();
    updatePGMFooter();
    updateOrchestratorRouting();
    renderVideo();
    addLog('info', 'AI', `Incident marked resolved by operator. Cleared: ${incident.alarms.join(', ') || incident.primaryCondition}.`);
  }

  function generateIncidentSummary() {
    const incident = getIncidentSnapshot();
    if (!incident.hasIncident) {
      addLog('info', 'AI', 'AI Ops summary: no active incident. System nominal.');
      return;
    }
    const program = state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR';
    const recommendation = incident.backupFeed
      ? `Recommended backup ${incident.backupLabel}.`
      : 'No healthy backup available; prepare playout slate or OFF AIR workflow.';
    addLog('warning', 'AI', `Incident summary: ${incident.alarms.join(', ')}. Program=${program}. ${recommendation}`);
  }

  // TAKE button: route preview to program
  el.btnTake?.addEventListener('click', () => routePreviewToProgram('TAKE'));
  el.btnCut?.addEventListener('click', () => routePreviewToProgram('CUT'));
  el.btnFadeBlack?.addEventListener('click', () => {
    if (state.txSafety.programProtection && !window.confirm('Program Protection is enabled. Fade Program to black?')) {
      addLog('warning', 'MIX', 'Fade to black cancelled by Program Protection.');
      return;
    }
    clearProgramOut('Program Out faded to black by operator.');
  });
  el.btnEmergencyBackup?.addEventListener('click', routeEmergencyBackup);
  el.btnIncidentPreviewBackup?.addEventListener('click', previewIncidentBackup);
  el.btnIncidentTakeBackup?.addEventListener('click', takeIncidentBackup);
  el.btnIncidentResolve?.addEventListener('click', resolveIncident);
  el.btnIncidentSummary?.addEventListener('click', generateIncidentSummary);

  el.btnClearProgram?.addEventListener('click', () => {
    if (state.txSafety.programProtection && !window.confirm('Program Protection is enabled. Take Program off air?')) {
      addLog('warning', 'MIX', 'Off Air cancelled by Program Protection.');
      return;
    }
    clearProgramOut('Program Out cleared to black by operator.');
  });

  el.toggleSourceLock?.addEventListener('change', event => {
    state.txSafety.sourceLock = event.target.checked;
    addLog('info', 'MIX', `Source Lock ${state.txSafety.sourceLock ? 'enabled' : 'disabled'}.`);
    renderTxSafety();
  });

  el.toggleProgramProtect?.addEventListener('change', event => {
    state.txSafety.programProtection = event.target.checked;
    addLog('info', 'MIX', `Program Protection ${state.txSafety.programProtection ? 'enabled' : 'disabled'}.`);
    renderTxSafety();
  });

  el.toggleAfvPanel?.addEventListener('change', event => {
    state.audioMixer.audioFollowVideo = event.target.checked;
    if (el.audioAfvToggle) el.audioAfvToggle.checked = event.target.checked;
    addLog('info', 'AUDIO', `Audio Follow Video ${state.audioMixer.audioFollowVideo ? 'enabled' : 'disabled'} from TX Control.`);
    syncAudioFollowVideo('TX Control AFV toggle');
    backendCommand('/api/audio-afv', { enabled: state.audioMixer.audioFollowVideo });
    renderAudioMixer();
    renderTxSafety();
  });

  el.btnToggleCleanFeed?.addEventListener('click', () => {
    state.txSafety.cleanFeed = !state.txSafety.cleanFeed;
    addLog('info', 'ROUTE', `${state.txSafety.cleanFeed ? 'Clean' : 'Dirty'} Program feed selected for operator output.`);
    renderTxSafety();
  });

  el.btnToggleFailoverMode?.addEventListener('click', () => {
    state.txSafety.failoverMode = state.txSafety.failoverMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    addLog('info', 'SWT', `${state.txSafety.failoverMode} failover mode selected.`);
    renderTxSafety();
  });

  el.btnToggleRecording?.addEventListener('click', () => {
    state.txSafety.recording = !state.txSafety.recording;
    addLog('info', 'REC', `Program recording ${state.txSafety.recording ? 'armed' : 'stopped'} in simulation.`);
    renderTxSafety();
  });

  el.regionPresetSelect?.addEventListener('change', event => {
    state.regionPreset = REGION_PRESETS[event.target.value] ? event.target.value : 'us-east-1';
    localStorage.setItem('mcr-region-preset', state.regionPreset);
    const region = getSelectedRegion();
    addLog('info', 'API', `Cloud region preset selected: ${region.code} ${region.label}.`);
    renderRegionPreset();
    renderEngineeringDashboard();
  });

  el.btnObsTakeScene?.addEventListener('click', async () => {
    const sceneName = el.obsSceneSelect?.value;
    if (!sceneName) return;
    if (!window.confirm(`Take OBS scene "${sceneName}" to the OBS Program output?`)) return;
    const result = await backendCommand('/api/obs-take', { sceneName });
    if (result?.ok) addLog('info', 'OBS', `Operator took OBS scene: ${sceneName}.`);
  });

  el.obsMapSource?.addEventListener('change', renderObsControl);
  el.btnSaveObsMap?.addEventListener('click', async () => {
    const source = el.obsMapSource?.value;
    const sceneName = el.obsMapScene?.value || '';
    if (!source) return;
    const result = await backendCommand('/api/obs-routing-config', {
      followMcrTake: !!el.obsFollowMcrTake?.checked,
      mappings: { [source]: sceneName }
    });
    if (result?.ok) addLog('info', 'OBS', `${getTileName(source)} mapped to ${sceneName || 'no OBS scene'}.`);
  });

  el.obsFollowMcrTake?.addEventListener('change', async event => {
    if (event.target.checked && !window.confirm('Arm OBS follow mode? Normal MCR TAKE actions will also take their configured OBS Program scene.')) {
      event.target.checked = false;
      return;
    }
    const result = await backendCommand('/api/obs-routing-config', {
      followMcrTake: event.target.checked,
      mappings: {}
    });
    if (result?.ok) addLog('info', 'OBS', `OBS follow-MCR routing ${event.target.checked ? 'armed' : 'disarmed'}.`);
  });

  // Per-tile attach/eject/solo wiring
  TILE_FEEDS.forEach(feed => {
    const attachBtn = document.getElementById(`btn-attach-${feed}`);
    const ejectBtn = document.getElementById(`btn-eject-${feed}`);
    const soloBtn = document.getElementById(`btn-solo-${feed}`);
    const selectEl = document.getElementById(`select-source-${feed}`);

    if (attachBtn && selectEl) {
      attachBtn.addEventListener('click', async () => {
        state.inspectedFeed = feed;
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
          if (state.localVideos[feed]) {
            assignMediaTarget('localVideo', feed);
            updateSourceOverlays();
            return;
          }

          pendingLocalAssignTarget = feed;
          el.localVideoFileInput.click();
          addLog('info', 'VIDEO', `Select a local file to attach to ${feed.toUpperCase()}.`);
          return;
        }

        if (val === 'ndi') {
          await attachNdiSource(feed);
          return;
        }

        if (val === 'obs') {
          await attachObsVirtualCamera(feed);
          return;
        }

        // For simulated/other network sources, assign logically
        if (val.startsWith('liveu') || val === 'rtsp') {
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
        if (state.mediaAssignments.webcam === feed && getFeedAssignment(feed) === 'webcam') {
          stopWebcam();
          state.mediaAssignments.webcam = null;
          addLog('info', 'ROUTE', `Webcam unassigned from ${feed.toUpperCase()}.`);
        }
        if (getFeedAssignment(feed) === 'localVideo') {
          ejectLocalVideo(feed);
          addLog('info', 'ROUTE', `Local video unassigned from ${feed.toUpperCase()}.`);
        }
        const hadCustomSource = teardownCustomSource(feed);
        if (hadCustomSource) {
          addLog('info', 'ROUTE', `Custom source detached from ${feed.toUpperCase()}.`);
          clearTileSource(feed);
        }
        Object.entries(state.ndiBridge.assignments).forEach(([sourceId, assignedFeed]) => {
          if (assignedFeed === feed) {
            delete state.ndiBridge.assignments[sourceId];
            addLog('info', 'NDI', `${NDI_SOURCES[sourceId]?.label || sourceId} detached from ${feed.toUpperCase()}.`);
          }
        });
        if (!hadCustomSource && state.mediaAssignments.webcam !== feed && state.mediaAssignments.localVideo !== feed && !state.customSources[feed]) {
          clearTileSource(feed);
        }
        clearCanvas(feed);
        updateSourceOverlays();
        saveWorkspaceState();
      });
    }

    if (soloBtn) {
      soloBtn.addEventListener('click', () => setPreview(feed));
    }
    document.getElementById(`screen-${feed}`)?.addEventListener('click', () => inspectFeed(feed));
    selectEl?.addEventListener('change', () => inspectFeed(feed));
    // Mute toggle
    const muteBtn = document.getElementById(`btn-mute-${feed}`);
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const cur = !!state.mutedFeeds[feed];
        state.mutedFeeds[feed] = !cur;
        muteBtn.classList.toggle('btn-active-mute', !cur);
        applyYouTubeMute(feed);
        updateSourceInspector();
        addLog('info', 'AUDIO', `${feed.toUpperCase()} ${!cur ? 'muted' : 'unmuted'}.`);
        saveWorkspaceState();
      });
    }
    // Edit / custom source attach
    const editBtn = document.getElementById(`btn-edit-${feed}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => openSourceUrlEditor(feed));
    }
  });

  el.btnPreviewLowerThird?.addEventListener('click', () => previewGraphic('lowerThird'));
  el.btnTakeGraphics?.addEventListener('click', takeGraphic);
  el.btnToggleTicker?.addEventListener('click', () => toggleGraphicsLayer('ticker'));
  el.btnToggleBug?.addEventListener('click', () => toggleGraphicsLayer('bug'));
  el.btnClearGraphics?.addEventListener('click', () => clearGraphics());
  document.getElementById('screen-vod')?.addEventListener('click', () => inspectFeed('vod'));
  el.replaySourceSelect?.addEventListener('change', event => {
    state.replayPlayout.replay.source = event.target.value;
    addLog('info', 'REPLAY', `Replay ISO source selected: ${getTileName(event.target.value)}.`);
    renderReplayPlayoutServers();
  });
  el.replayClipSelect?.addEventListener('change', event => {
    state.replayPlayout.replay.selectedClip = event.target.value;
    addLog('info', 'REPLAY', `Replay clip selected: ${getSelectedReplayClip()?.label}.`);
    renderReplayPlayoutServers();
  });
  el.playoutAssetSelect?.addEventListener('change', event => {
    state.replayPlayout.playout.selectedAsset = event.target.value;
    addLog('info', 'PLYT', `Playout asset selected: ${getSelectedPlayoutAsset()?.label}.`);
    renderReplayPlayoutServers();
  });
  el.btnReplayMarkIn?.addEventListener('click', () => markReplayPoint('markIn'));
  el.btnReplayMarkOut?.addEventListener('click', () => markReplayPoint('markOut'));
  el.btnReplayCreate?.addEventListener('click', createReplayClip);
  el.btnPreviewReplay?.addEventListener('click', () => previewServerSource('replay'));
  el.btnTakeReplay?.addEventListener('click', () => takeServerSource('replay'));
  el.btnReturnLiveReplay?.addEventListener('click', returnToLiveFromServer);
  el.btnPreviewPlayout?.addEventListener('click', () => previewServerSource('playout'));
  el.btnTakePlayout?.addEventListener('click', () => takeServerSource('playout'));
  el.btnReturnLivePlayout?.addEventListener('click', returnToLiveFromServer);

  el.sourceUrlAttach?.addEventListener('click', submitSourceUrlEditor);
  el.sourceUrlClose?.addEventListener('click', closeSourceUrlEditor);
  el.btnScanNdi?.addEventListener('click', scanNdiBridge);
  el.ndiSourceSelect?.addEventListener('change', () => {
    state.ndiBridge.selectedSourceId = el.ndiSourceSelect.value || state.ndiBridge.selectedSourceId;
    renderNdiBridge();
  });
  el.sourceUrlModal?.addEventListener('click', event => {
    if (event.target === el.sourceUrlModal) closeSourceUrlEditor();
  });
  el.sourceUrlInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') submitSourceUrlEditor();
    if (event.key === 'Escape') closeSourceUrlEditor();
  });
  el.btnLoadPreset?.addEventListener('click', () => {
    applyDemoPreset(el.selectDemoPreset?.value || 'clean', { updateUrl: true });
  });
  el.btnCopyPresetLink?.addEventListener('click', copyPresetLink);
  el.btnExportScenario?.addEventListener('click', downloadScenarioJson);
  el.btnImportScenario?.addEventListener('click', () => el.scenarioImportInput?.click());
  el.scenarioImportInput?.addEventListener('change', () => {
    importScenarioFile(el.scenarioImportInput.files?.[0]);
    el.scenarioImportInput.value = '';
  });

  window.addEventListener('storage', event => {
    if (event.key !== WORKSPACE_STATE_KEY || !event.newValue || isRestoringWorkspaceState) return;
    loadWorkspaceState();
    refreshWorkspaceUiAfterStateLoad('Workspace state synced from another MCR page.');
    resumePersistedWebcamIfNeeded();
    restorePersistedLocalVideosIfNeeded();
  });

  loadWorkspaceState();
  restorePersistedLocalVideosIfNeeded();
  updateSourceOverlays();
  hydratePageSwitcherLinks();
  updateTAKEButton();
  updateBadges();
  updatePGMFooter();
  updateSourceStateControls();
  updateDetectionControls();
  updateOrchestratorRouting();
  renderNdiBridge();
  renderReplayPlayoutServers();
  connectBackendOrchestrator();
  setWorkspaceView(getRequestedWorkspace());
  resumePersistedWebcamIfNeeded();

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
  addLog('info', 'CG', 'CG graphics engine active. Key/fill overlay layers ready.');
  addLog('info', 'TRANS', 'AWS MediaLive active-active transcoders initialized (Output: AVC 1080p60 8.0Mbps HLS/DASH).');
  addLog('info', 'CDN', 'Edge CDN cache validation complete. Latency buffer optimal at edge locations.');

  // Ensure pgm label reflects initial active source
  if (el.pgmActiveSource) el.pgmActiveSource.textContent = state.activeSource ? `SOURCE: ${getProgramRouteLabel(state.activeSource)}` : 'SOURCE: NONE';

  // ==========================================================================
  // 5. CANVAS VIDEO STREAM RENDERING ENGINE
  // ==========================================================================
  const canvases = {};
  ['cam1', 'cam2', 'liveu3', 'liveu4', 'vod', 'pgm'].forEach(feed => {
    const canvas = document.getElementById(`canvas-${feed}`);
    if (canvas) canvases[feed] = { element: canvas, ctx: canvas.getContext('2d') };
  });
  const previewCanvas = document.getElementById('canvas-preview');
  if (previewCanvas) canvases.preview = { element: previewCanvas, ctx: previewCanvas.getContext('2d') };

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

  const requestedPreset = new URLSearchParams(window.location.search).get('preset');
  if (requestedPreset) applyDemoPreset(requestedPreset);

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
    // CG engine preview: key/fill style operator monitor.
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, w, h);
    const grid = 24;
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(236, 72, 153, 0.16)';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#fbcfe8';
    ctx.font = 'bold 10px Outfit';
    ctx.fillText('GRAPHICS OVERLAY / KEY + FILL PREVIEW', 14, 16);

    drawGraphicsOverlay(ctx, w, h, {
      lowerThird: state.graphicsPreview === 'lowerThird' || state.activeGraphics === 'lowerThird',
      ticker: state.tickerOn,
      bug: state.bugOn,
      preview: state.graphicsPreview
    }, frames);

    if (!state.graphicsPreview && !state.activeGraphics && !state.tickerOn && !state.bugOn) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
      ctx.font = 'bold 13px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('NO GRAPHICS KEYED', w / 2, h / 2);
      ctx.font = '9px Fira Code';
      ctx.fillText('PREVIEW CG OR TAKE A RUNDOWN GRAPHIC', w / 2, h / 2 + 18);
      ctx.textAlign = 'left';
    }
  }

  function drawGraphicsOverlay(ctx, w, h, layers, frames) {
    if (layers.bug) {
      ctx.save();
      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.fillRect(w - 92, 14, 76, 24);
      ctx.strokeStyle = '#fecaca';
      ctx.strokeRect(w - 90, 16, 72, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('LIVE', w - 54, 30);
      ctx.restore();
    }

    if (layers.lowerThird) {
      const y = h - 62;
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(18, y, Math.min(w - 36, 340), 44);
      ctx.fillStyle = 'rgba(0, 210, 255, 0.88)';
      ctx.fillRect(18, y, 5, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Outfit';
      ctx.fillText('FIELD REPORTER', 32, y + 18);
      ctx.fillStyle = '#bae6fd';
      ctx.font = '10px Fira Code';
      ctx.fillText('Live from Stadium Touchline', 32, y + 34);
      if (layers.preview) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.fillRect(250, y + 8, 70, 18);
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 8px Outfit';
        ctx.fillText('PREVIEW', 262, y + 20);
      }
      ctx.restore();
    }

    if (layers.ticker) {
      const tickerY = h - 20;
      const tickerText = 'MATCH CONTROL • PRIMARY CONTRIBUTION STABLE • CLOUD MCR DEMO • LOWER THIRD READY • ';
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(0, tickerY - 2, w, 22);
      ctx.fillStyle = '#fbcfe8';
      ctx.font = 'bold 9px Fira Code';
      const textWidth = ctx.measureText(tickerText).width;
      const scrollX = (frames * 1.4) % textWidth;
      ctx.fillText(tickerText, -scrollX, tickerY + 12);
      ctx.fillText(tickerText, -scrollX + textWidth, tickerY + 12);
      ctx.restore();
    }
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

  function drawStreamReplay(ctx, w, h, frames) {
    const clip = getSelectedReplayClip();
    ctx.fillStyle = '#080612';
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.5 + Math.sin(frames * 0.08) * 0.25;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.24 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      ctx.strokeRect(20 + i * 12, 20 + i * 9, w - 40 - i * 24, h - 40 - i * 18);
    }
    ctx.fillStyle = 'rgba(245, 158, 11, 0.92)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px Outfit';
    ctx.fillText('REPLAY SERVER ON AIR', 16, 19);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(clip?.label || 'Replay Clip', w / 2, h / 2 - 8);
    ctx.font = '10px Fira Code';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`${getTileName(clip?.source || 'cam1')} · ${clip?.duration || '00:00:10'} · EC2 replay-a`, w / 2, h / 2 + 14);
    ctx.textAlign = 'left';
  }

  function drawStreamPlayout(ctx, w, h, frames) {
    const asset = getSelectedPlayoutAsset();
    const isEmergency = asset?.type === 'BACKUP';
    ctx.fillStyle = isEmergency ? '#160609' : '#07111d';
    ctx.fillRect(0, 0, w, h);
    const stripeW = 32;
    for (let x = -stripeW; x < w + stripeW; x += stripeW) {
      ctx.fillStyle = isEmergency ? 'rgba(239, 68, 68, 0.16)' : 'rgba(0, 210, 255, 0.1)';
      ctx.fillRect(x + (frames % stripeW), 0, stripeW / 2, h);
    }
    ctx.fillStyle = isEmergency ? 'rgba(239, 68, 68, 0.86)' : 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(24, h / 2 - 42, w - 48, 84);
    ctx.strokeStyle = isEmergency ? '#fecaca' : '#7dd3fc';
    ctx.strokeRect(30, h / 2 - 36, w - 60, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(asset?.label || 'Playout Asset', w / 2, h / 2 - 5);
    ctx.font = '10px Fira Code';
    ctx.fillStyle = isEmergency ? '#fee2e2' : '#bae6fd';
    ctx.fillText(`${asset?.type || 'PLAYOUT'} · ${asset?.duration || 'LOOP'} · ec2-playout-a`, w / 2, h / 2 + 18);
    ctx.textAlign = 'left';
  }

  function drawStreamLossStatic(ctx, w, h) {
    if (!ctx || w < 1 || h < 1) return;
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

    // CG graphics are key/fill overlays and do not contribute program audio.
    vuState.vod.l = 0;
    vuState.vod.r = 0;
    vuState.vod.lp = Math.max(0, vuState.vod.lp - 0.008);
    vuState.vod.rp = Math.max(0, vuState.vod.rp - 0.008);
    
    // PGM audio follows the audio mixer's Program bus, which may follow video or be manually assigned.
    const pgmAudioFeed = state.audioMixer.programBus;
    const pgmChannel = pgmAudioFeed ? state.audioMixer.channels[pgmAudioFeed] : null;
    let pgmActive = !!pgmAudioFeed && feedHasActiveSignal(pgmAudioFeed);
    let pgmMuted = state.mutedFeeds.pgm;
    if (pgmChannel?.mute) pgmMuted = true;
    
    if (pgmAudioFeed === 'cam1' && state.primaryFailed) {
      pgmActive = false; // No audio if source is failed and no backup configured
    }
    
    if (!pgmActive || pgmMuted) {
      vuState.pgm.l = 0;
      vuState.pgm.r = 0;
      vuState.pgm.lp = Math.max(0, vuState.pgm.lp - 0.008);
      vuState.pgm.rp = Math.max(0, vuState.pgm.rp - 0.008);
    } else {
      let activeSourceVU = vuState.cam1;
      if (pgmAudioFeed === 'cam2') activeSourceVU = vuState.cam2;
      else if (pgmAudioFeed === 'liveu3') activeSourceVU = vuState.liveu3;
      else if (pgmAudioFeed === 'liveu4') activeSourceVU = vuState.liveu4;
      else if (pgmAudioFeed === 'replay' || pgmAudioFeed === 'playout') {
        const serverL = 0.58 + Math.sin(framesCount * 0.07) * 0.18 + Math.random() * 0.08;
        const serverR = 0.58 + Math.cos(framesCount * 0.065) * 0.18 + Math.random() * 0.08;
        const fader = pgmChannel?.fader ?? 1;
        vuState.pgm.l = Math.min(0.99, serverL * fader);
        vuState.pgm.r = Math.min(0.99, serverR * fader);
        vuState.pgm.lp = Math.max(vuState.pgm.l, vuState.pgm.lp - 0.006);
        vuState.pgm.rp = Math.max(vuState.pgm.r, vuState.pgm.rp - 0.006);
      } else if (state.activeSource === 'ad') {
        // Custom active ad audio
        const adL = 0.7 + Math.sin(framesCount * 0.1) * 0.1 + Math.random() * 0.1;
        const adR = 0.7 + Math.cos(framesCount * 0.1) * 0.1 + Math.random() * 0.1;
        vuState.pgm.l = Math.min(0.99, adL);
        vuState.pgm.r = Math.min(0.99, adR);
        vuState.pgm.lp = Math.max(vuState.pgm.l, vuState.pgm.lp - 0.006);
        vuState.pgm.rp = Math.max(vuState.pgm.r, vuState.pgm.rp - 0.006);
      }
      
      if (state.activeSource !== 'ad' && pgmAudioFeed !== 'replay' && pgmAudioFeed !== 'playout') {
        const fader = pgmChannel?.fader ?? 1;
        vuState.pgm.l = activeSourceVU.l * fader;
        vuState.pgm.r = activeSourceVU.r * fader;
        vuState.pgm.lp = activeSourceVU.lp * fader;
        vuState.pgm.rp = activeSourceVU.rp * fader;
      }
    }

    // Apply UI rendering updates
    function renderVUChannel(lEl, rEl, lpEl, rpEl, feedVU) {
      if (!lEl || !rEl || !lpEl || !rpEl) return;
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
    renderAudioMixer();
  }

  // ==========================================================================
  // 7. CORE TICK RENDER LOOP
  // ==========================================================================
  function renderLoop() {
    framesCount++;
    angle += 0.05;

    // Timecode Updates
    if (el.tcCam1) el.tcCam1.textContent = state.primaryFailed ? "00:00:00:00" : getSMPTETimecode(framesCount);
    // Standby has a small simulated sync drift (-2 frames)
    if (el.tcCam2) el.tcCam2.textContent = getSMPTETimecode(framesCount - 2);
    // LiveU 3 & 4 with varied network drift
    if (el.tcLiveu3) el.tcLiveu3.textContent = getSMPTETimecode(framesCount - 3);
    if (el.tcLiveu4) el.tcLiveu4.textContent = getSMPTETimecode(framesCount - 4);
    // Graphics is an overlay keyer, not a timed video source.
    if (el.tcVod) el.tcVod.textContent = 'KEY / FILL';
    
    // PGM timecode reflects currently routed active source
    if (el.tcPgm) {
      if (state.activeSource === 'cam1') el.tcPgm.textContent = el.tcCam1?.textContent || getSMPTETimecode(framesCount);
      else if (state.activeSource === 'cam2') el.tcPgm.textContent = el.tcCam2?.textContent || getSMPTETimecode(framesCount - 2);
      else if (state.activeSource === 'liveu3') el.tcPgm.textContent = el.tcLiveu3?.textContent || getSMPTETimecode(framesCount - 3);
      else if (state.activeSource === 'liveu4') el.tcPgm.textContent = el.tcLiveu4?.textContent || getSMPTETimecode(framesCount - 4);
      else if (state.activeSource === 'vod') el.tcPgm.textContent = el.tcVod?.textContent || 'KEY / FILL';
      else if (state.activeSource === 'ad') el.tcPgm.textContent = getSMPTETimecode(framesCount);
      else if (state.activeSource === 'replay' || state.activeSource === 'playout') el.tcPgm.textContent = getSMPTETimecode(framesCount);
      else el.tcPgm.textContent = '--:--:--:--';
    }

    ['cam1', 'cam2', 'liveu3', 'liveu4', 'vod'].forEach(feed => {
      const canvas = canvases[feed];
      if (canvas) drawFeedCanvas(feed, canvas.ctx, canvas.element.width, canvas.element.height, framesCount);
    });

    // Preview bus mirrors the cued source before it is taken to Program.
    if (canvases.preview) {
      const previewW = canvases.preview.element.width;
      const previewH = canvases.preview.element.height;
      const previewCtx = canvases.preview.ctx;
      const previewFeed = state.previewFeed;
      if (el.tcPreview) el.tcPreview.textContent = previewFeed ? getSMPTETimecode(framesCount) : '--:--:--:--';
      if (el.previewActiveSource) el.previewActiveSource.textContent = previewFeed ? getProgramRouteLabel(previewFeed) : 'None selected';
      if (el.previewStatus) {
        el.previewStatus.textContent = previewFeed ? (feedHasActiveSignal(previewFeed) ? 'READY' : 'NO SIGNAL') : 'IDLE';
        el.previewStatus.className = previewFeed ? (feedHasActiveSignal(previewFeed) ? 'text-blue' : 'text-red') : '';
      }
      if (el.previewEmptyState) el.previewEmptyState.style.display = previewFeed ? 'none' : 'grid';
      previewCtx.clearRect(0, 0, previewW, previewH);
      if (previewFeed === 'replay') {
        drawStreamReplay(previewCtx, previewW, previewH, framesCount);
      } else if (previewFeed === 'playout') {
        drawStreamPlayout(previewCtx, previewW, previewH, framesCount);
      } else if (previewFeed && canvases[previewFeed]) {
        try {
          previewCtx.drawImage(canvases[previewFeed].element, 0, 0, previewW, previewH);
        } catch (error) {
          drawStreamLossStatic(previewCtx, previewW, previewH);
        }
      } else {
        previewCtx.fillStyle = '#020408';
        previewCtx.fillRect(0, 0, previewW, previewH);
      }
    }

    // 6. Draw Feed 6 (Program Out / PGM)
    if (canvases.pgm) {
      const pgmW = canvases.pgm.element.width;
      const pgmH = canvases.pgm.element.height;
      const pgmCtx = canvases.pgm.ctx;
      if (state.activeSource === 'ad') {
        drawStreamAdBreak(pgmCtx, pgmW, pgmH, framesCount);
      } else if (state.activeSource === 'replay') {
        drawStreamReplay(pgmCtx, pgmW, pgmH, framesCount);
      } else if (state.activeSource === 'playout') {
        drawStreamPlayout(pgmCtx, pgmW, pgmH, framesCount);
      } else if (state.activeSource) {
        try {
          pgmCtx.clearRect(0, 0, pgmW, pgmH);
          pgmCtx.drawImage(canvases[state.activeSource].element, 0, 0, pgmW, pgmH);
        } catch (e) {
          if (state.activeSource === 'cam1') drawStreamCam1(pgmCtx, pgmW, pgmH, framesCount, state.unrecoveredLoss);
          else if (state.activeSource === 'cam2' || state.activeSource === 'liveu3' || state.activeSource === 'liveu4') drawStreamCam2(pgmCtx, pgmW, pgmH, framesCount);
          else if (state.activeSource === 'vod') drawStreamVOD(pgmCtx, pgmW, pgmH, framesCount);
          else if (state.activeSource === 'replay') drawStreamReplay(pgmCtx, pgmW, pgmH, framesCount);
          else if (state.activeSource === 'playout') drawStreamPlayout(pgmCtx, pgmW, pgmH, framesCount);
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

      if (state.activeGraphics || state.tickerOn || state.bugOn) {
        drawGraphicsOverlay(pgmCtx, pgmW, pgmH, {
          lowerThird: state.activeGraphics === 'lowerThird',
          ticker: state.tickerOn,
          bug: state.bugOn
        }, framesCount);
      }
    }
    syncProgramEmbed();

    // 5. Update Stereo VU meters
    updateVUMeters();

    // Operator telemetry updates once per second; faster canvas rendering stays independent.
    if (framesCount % 60 === 0) {
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
  const chartCtx = chartCanvas?.getContext('2d');
  
  // Rolling historical arrays
  const chartHistory = {
    bw: Array(60).fill(6.2),
    loss: Array(60).fill(0.0),
    jitter: Array(60).fill(5)
  };

  function updateSRTSimulation() {
    // Read current slider inputs
    if (![el.slideLoss, el.slideJitter, el.slideRtt, el.slideBuffer].every(hasElement)) return;
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
    updateHeaderMetrics();
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
    if (!chartCanvas || !chartCtx) return;
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
  el.btnFailPrimary?.addEventListener('click', () => {
    state.primaryFailed = true;
    setSourceState('liveu1', 'ALARM');
    if (el.btnFailPrimary) el.btnFailPrimary.disabled = true;
    if (el.btnRestorePrimary) el.btnRestorePrimary.disabled = false;
    
    // Activate Alarm overlays on screen and node graph
    el.alarmOverlayCam1?.classList.add('alarm-active');
    
    // Update quick badges
    if (el.matrixAlarm) {
      el.matrixAlarm.textContent = "ALARM: FAIL";
      el.matrixAlarm.className = "badge-value text-red pulse-red";
    }
    
    updateOrchestratorRouting();

    // Log failure
    addLog('alarm', 'SRT', 'Primary contribution encoder connection lost! SRT Socket connection timeout.');
    addLog('warning', 'SWT', 'ST 2022-7 Switcher detected packet flatline on Path A (us-east-1).');

    if (state.txSafety.failoverMode === 'MANUAL') {
      addLog('warning', 'SWT', 'Manual failover mode is active. Backup is healthy but operator must TAKE BACKUP.');
      renderTxSafety();
      updateSRTSimulation();
      return;
    }

    // Trigger seamless failover switch inside 350ms
    setTimeout(() => {
      if (state.primaryFailed) { // Double check if already restored
        setSourceState('liveu2', 'ONLINE');
        state.activeSource = 'cam2'; // Route backup Cam
        if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
        state.programSourceOverride = 'liveu2';
        if (el.pgmActiveSource) el.pgmActiveSource.textContent = "SOURCE: LiveU 2 (DR FAILOVER)";
        updateBadges();
        updatePGMFooter();
        updateOrchestratorRouting();
        renderTxSafety();
        
        // Log switch
        addLog('alarm', 'SWT', 'Switcher input switched automatically: Path A (failed) ➔ Path B (active backup).');
        addLog('info', 'ROUTE', 'Program out seamless failover successful. No visual frame drop (glitch-free).');
      }
    }, 350);

    updateSRTSimulation();
    renderTxSafety();
  });

  // Restore Primary contribution path
  el.btnRestorePrimary?.addEventListener('click', () => {
    state.primaryFailed = false;
    setSourceState('liveu1', 'ONLINE');
    if (el.btnFailPrimary) el.btnFailPrimary.disabled = false;
    if (el.btnRestorePrimary) el.btnRestorePrimary.disabled = true;
    
    // Remove alarm overlays
    el.alarmOverlayCam1?.classList.remove('alarm-active');
    
    updateOrchestratorRouting();
    renderTxSafety();

    addLog('info', 'SRT', 'SRT Contribution Socket re-established. Port 9001 handshake complete.');
    addLog('info', 'SRT', 'Camera-01 stream restored (Bitrate: 6.2 Mbps, Codec: HEVC).');

    // Return switcher back to Primary source (with 1.5s stabilization delay)
    setTimeout(() => {
      if (!state.primaryFailed) {
        setSourceState('liveu2', 'STANDBY');
        state.activeSource = 'cam1';
        if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
        state.programSourceOverride = 'liveu1';
        if (el.pgmActiveSource) el.pgmActiveSource.textContent = "SOURCE: LiveU 1";
        updateBadges();
        updatePGMFooter();
        updateOrchestratorRouting();
        
        addLog('info', 'SWT', 'Stabilization window complete. Switcher reverted back: Path B ➔ Path A (Primary).');
      }
    }, 1500);

    updateSRTSimulation();
  });

  // SCTE-35 Cue ad insertion injector
  el.btnInjectScte?.addEventListener('click', () => {
    if (state.adActive) return;
    
    state.adActive = true;
    state.adTimeRemaining = 30.0;
    state.preAdRoute = {
      activeSource: state.activeSource,
      programSourceOverride: state.programSourceOverride,
      label: el.pgmActiveSource?.textContent || null
    };
    if (el.btnInjectScte) el.btnInjectScte.disabled = true;
    if (el.btnCancelScte) el.btnCancelScte.disabled = false;
    
    // Update active source to ad break loop
    state.activeSource = 'ad';
    if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
    state.programSourceOverride = 'ad';
    if (el.pgmActiveSource) el.pgmActiveSource.textContent = "SOURCE: AD-LOOP (SCTE-35)";
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    syncProgramEmbed();
    
    // Show countdown banner on PGM screen
    if (el.adBreakBanner) el.adBreakBanner.style.display = 'block';
    
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
        if (el.adCountdownVal) el.adCountdownVal.textContent = `AD BREAK: ${state.adTimeRemaining.toFixed(1)}s`;
        renderTxSafety();
      }
    }, 100);
  });

  // Cancel SCTE splice
  el.btnCancelScte?.addEventListener('click', () => {
    if (!state.adActive) return;
    
    clearInterval(state.adIntervalId);
    addLog('warning', 'SCTE', 'SCTE-35 splice countdown aborted manually by Master Engineer.');
    endAdBreak();
  });

  function endAdBreak() {
    state.adActive = false;
    state.adTimeRemaining = 0.0;
    if (el.btnInjectScte) el.btnInjectScte.disabled = false;
    if (el.btnCancelScte) el.btnCancelScte.disabled = true;
    
    // Hide overlay
    if (el.adBreakBanner) el.adBreakBanner.style.display = 'none';
    
    // Restore the exact route that was on air before SCTE interrupted it.
    if (state.preAdRoute?.activeSource) {
      state.activeSource = state.preAdRoute.activeSource;
      state.programSourceOverride = state.preAdRoute.programSourceOverride;
      if (el.pgmActiveSource) el.pgmActiveSource.textContent = state.preAdRoute.label || `SOURCE: ${getProgramRouteLabel(state.activeSource)}`;
    } else if (state.primaryFailed) {
      state.activeSource = 'cam2';
      if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
      state.programSourceOverride = 'liveu2';
      if (el.pgmActiveSource) el.pgmActiveSource.textContent = "SOURCE: LiveU 2 (DR FAILOVER)";
    } else {
      state.activeSource = 'cam1';
      if (!state.onAirStartedAt) state.onAirStartedAt = Date.now();
      state.programSourceOverride = 'liveu1';
      if (el.pgmActiveSource) el.pgmActiveSource.textContent = "SOURCE: LiveU 1";
    }
    state.preAdRoute = null;
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    renderTxSafety();
    syncProgramEmbed();
    
    addLog('info', 'SCTE', 'SCTE-35 Splice-Out command injected. Event ID: 4092 (Out-of-Network complete).');
    addLog('info', 'PLYT', 'Program routing returned successfully to Contribution feed.');
  }

  // ==========================================================================
  // 10. ORCHESTRATOR NODE INSPECTOR
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

  function removePageSection(selector) {
    document.querySelectorAll(selector).forEach(node => node.remove());
  }

  function pruneWorkspaceDomForPage() {
    const view = getRequestedWorkspace();
    if (view === 'operations') {
      removePageSection('[data-workspace-panel="monitoring"], [data-workspace-panel="setup"]');
      removePageSection('.source-setup-drawer, .demo-setup, .assign-controls');
      removePageSection('#source-url-modal');
      return;
    }

    if (view === 'monitoring') {
      removePageSection('.multiviewer-container');
      removePageSection('[data-workspace-panel="operations"], [data-workspace-panel="setup"]');
      removePageSection('#source-url-modal');
      return;
    }

    if (view === 'setup') {
      removePageSection('#screen-pgm, #screen-vod');
      removePageSection('[data-workspace-panel="operations"]');
      removePageSection('.panel-ai-ops, .panel-incident-response, .panel-cloud-topology, .panel-telemetry, .panel-dr-playout, .panel-logs');
    }
  }

  pruneWorkspaceDomForPage();

});
