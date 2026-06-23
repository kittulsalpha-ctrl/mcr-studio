/* ==========================================================================
   CLOUD BROADCAST MCR STUDIO - APPLICATION ENGINE
   Pure ES6 Javascript - High Performance Canvas Graphics & Math Simulations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const programOut = document.getElementById('screen-pgm');
  const operationsColumn = document.querySelector('body.workspace-operations .controls-container');
  if (programOut && operationsColumn) operationsColumn.prepend(programOut);

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

    // Preview / Program state
    previewFeed: null,
    programSourceOverride: null,
    graphicsPreview: null,
    activeGraphics: null,
    tickerOn: false,
    bugOn: false,
    systemModel: {
      chain: ['sources', 'ingest', 'switcher', 'audio', 'cg', 'replay', 'playout', 'encoder', 'distribution'],
      services: {
        sources: { label: 'Contribution Sources', role: 'LiveU / NDI / SRT / WebRTC', instance: 'edge/source-net', status: 'ONLINE', load: 31, latency: 25 },
        ingest: { label: 'Cloud Ingest Gateway', role: 'Receiver / demux / preview proxy', instance: 'ec2-ingest-a', status: 'ONLINE', load: 42, latency: 38 },
        switcher: { label: 'Video Switcher', role: 'Preview/Program router', instance: 'ec2-switcher-gpu-a', status: 'ONLINE', load: 48, latency: 46 },
        audio: { label: 'Audio Mixer', role: 'PGM bus / faders / AFV', instance: 'ec2-audio-a', status: 'ONLINE', load: 26, latency: 18 },
        cg: { label: 'CG Keyer', role: 'Lower-third / ticker / bug', instance: 'ec2-cg-a', status: 'STANDBY', load: 18, latency: 12 },
        replay: { label: 'Replay Server', role: 'ISO record / clip playback', instance: 'ec2-replay-a', status: 'STANDBY', load: 22, latency: 30 },
        playout: { label: 'Playout Server', role: 'Slate / filler / ad loop', instance: 'ec2-playout-a', status: 'STANDBY', load: 16, latency: 24 },
        encoder: { label: 'Program Encoder', role: 'PGM A/V encode', instance: 'ec2-encoder-a', status: 'ONLINE', load: 54, latency: 72 },
        distribution: { label: 'MediaLive / CDN', role: 'Package / origin / edge', instance: 'aws-us-east-1', status: 'ONLINE', load: 37, latency: 110 }
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

  // ==========================================================================
  // 2. DOM ELEMENTS
  // ==========================================================================
  const el = {
    utcClock: document.getElementById('utc-clock'),
    localClock: document.getElementById('local-clock'),
    
    totalBw: document.getElementById('total-bw-value'),
    txRoute: document.getElementById('tx-route-value'),
    matrixAlarm: document.getElementById('matrix-alarm-value'),
    systemHealth: document.getElementById('system-health-value'),
    onAirValue: document.getElementById('on-air-value'),
    controlApiValue: document.getElementById('control-api-value'),
    operatingModeValue: document.getElementById('operating-mode-value'),
    obsControlStatus: document.getElementById('obs-control-status'),
    obsProgramScene: document.getElementById('obs-program-scene'),
    obsSceneSelect: document.getElementById('obs-scene-select'),
    btnObsTakeScene: document.getElementById('btn-obs-take-scene'),
    obsFollowMcrTake: document.getElementById('obs-follow-mcr-take'),
    obsMapSource: document.getElementById('obs-map-source'),
    obsMapScene: document.getElementById('obs-map-scene'),
    btnSaveObsMap: document.getElementById('btn-save-obs-map'),
    obsRoutingSummary: document.getElementById('obs-routing-summary'),
    
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
    selectDemoPreset: document.getElementById('select-demo-preset'),
    btnLoadPreset: document.getElementById('btn-load-preset'),
    btnCopyPresetLink: document.getElementById('btn-copy-preset-link'),
    btnExportScenario: document.getElementById('btn-export-scenario'),
    btnImportScenario: document.getElementById('btn-import-scenario'),
    scenarioImportInput: document.getElementById('scenario-import-input'),
    presetLinkStatus: document.getElementById('preset-link-status'),
    selectWebcamTarget: document.getElementById('select-webcam-target'),
    selectVideoTarget: document.getElementById('select-video-target'),
    localVideoFileInput: document.getElementById('local-video-file-input'),
    actionStatus: document.getElementById('action-status'),
    cam1Video: document.getElementById('video-cam1'),
    cam2Video: document.getElementById('video-cam2'),
    btnTake: document.getElementById('btn-take'),
    btnCut: document.getElementById('btn-cut'),
    btnFadeBlack: document.getElementById('btn-fade-black'),
    btnClearProgram: document.getElementById('btn-clear-program'),
    btnEmergencyBackup: document.getElementById('btn-emergency-backup'),
    btnPreviewLowerThird: document.getElementById('btn-preview-lower-third'),
    btnTakeGraphics: document.getElementById('btn-take-graphics'),
    btnToggleTicker: document.getElementById('btn-toggle-ticker'),
    btnToggleBug: document.getElementById('btn-toggle-bug'),
    btnClearGraphics: document.getElementById('btn-clear-graphics'),
    cgEngineLayer: document.getElementById('cg-engine-layer'),
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
    sourceUrlModal: document.getElementById('source-url-modal'),
    sourceUrlInput: document.getElementById('source-url-input'),
    sourceUrlAttach: document.getElementById('source-url-attach'),
    sourceUrlClose: document.getElementById('source-url-close'),
    sourceUrlTarget: document.getElementById('source-url-target'),
    btnScanNdi: document.getElementById('btn-scan-ndi'),
    ndiSourceSelect: document.getElementById('ndi-source-select'),
    ndiBridgeStatus: document.getElementById('ndi-bridge-status'),
    ndiBridgeHint: document.getElementById('ndi-bridge-hint'),
    
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
    sourceInspectorTile: document.getElementById('source-inspector-tile'),
    sourceInspectorRoute: document.getElementById('source-inspector-route'),
    sourceInspectorState: document.getElementById('source-inspector-state'),
    sourceInspectorPreview: document.getElementById('source-inspector-preview'),
    sourceInspectorProgram: document.getElementById('source-inspector-program'),
    sourceInspectorAudio: document.getElementById('source-inspector-audio'),
    sourceInspectorSignal: document.getElementById('source-inspector-signal'),
    sourceInspectorMeta: document.getElementById('source-inspector-meta'),
    aiOpsSummary: document.getElementById('ai-ops-summary'),
    aiOpsList: document.getElementById('ai-ops-list'),
    incidentStatusBadge: document.getElementById('incident-status-badge'),
    incidentCurrentState: document.getElementById('incident-current-state'),
    incidentCurrentDetail: document.getElementById('incident-current-detail'),
    incidentRecommendation: document.getElementById('incident-recommendation'),
    btnIncidentPreviewBackup: document.getElementById('btn-incident-preview-backup'),
    btnIncidentTakeBackup: document.getElementById('btn-incident-take-backup'),
    btnIncidentResolve: document.getElementById('btn-incident-resolve'),
    btnIncidentSummary: document.getElementById('btn-incident-summary'),
    audioMixerChannels: document.getElementById('audio-mixer-channels'),
    audioAfvToggle: document.getElementById('audio-afv-toggle'),
    audioPgmBus: document.getElementById('audio-pgm-bus'),
    audioPgmStatus: document.getElementById('audio-pgm-status'),
    audioPgmMeterL: document.getElementById('audio-pgm-meter-l'),
    audioPgmMeterR: document.getElementById('audio-pgm-meter-r'),
    cloudTopologyBody: document.getElementById('cloud-topology-body'),
    replayServerStatus: document.getElementById('replay-server-status'),
    replaySourceSelect: document.getElementById('replay-source-select'),
    replayClipSelect: document.getElementById('replay-clip-select'),
    btnReplayMarkIn: document.getElementById('btn-replay-mark-in'),
    btnReplayMarkOut: document.getElementById('btn-replay-mark-out'),
    btnReplayCreate: document.getElementById('btn-replay-create'),
    btnPreviewReplay: document.getElementById('btn-preview-replay'),
    btnTakeReplay: document.getElementById('btn-take-replay'),
    btnReturnLiveReplay: document.getElementById('btn-return-live-replay'),
    playoutServerStatus: document.getElementById('playout-server-status'),
    playoutAssetSelect: document.getElementById('playout-asset-select'),
    playoutAssetStatus: document.getElementById('playout-asset-status'),
    btnPreviewPlayout: document.getElementById('btn-preview-playout'),
    btnTakePlayout: document.getElementById('btn-take-playout'),
    btnReturnLivePlayout: document.getElementById('btn-return-live-playout'),
    engInputStatus: document.getElementById('eng-input-status'),
    engInputDetail: document.getElementById('eng-input-detail'),
    engTelemetrySource: document.getElementById('eng-telemetry-source'),
    engGatewayStatus: document.getElementById('eng-gateway-status'),
    engGatewayDetail: document.getElementById('eng-gateway-detail'),
    engObsStatus: document.getElementById('eng-obs-status'),
    engObsDetail: document.getElementById('eng-obs-detail'),
    engMediaConnectStatus: document.getElementById('eng-mediaconnect-status'),
    engMediaConnectDetail: document.getElementById('eng-mediaconnect-detail'),
    engMediaLiveStatus: document.getElementById('eng-medialive-status'),
    engMediaLiveDetail: document.getElementById('eng-medialive-detail'),
    engCdnStatus: document.getElementById('eng-cdn-status'),
    engCdnDetail: document.getElementById('eng-cdn-detail'),
    engPathStatus: document.getElementById('eng-path-status'),
    engPathDetail: document.getElementById('eng-path-detail'),
    engNetworkStatus: document.getElementById('eng-network-status'),
    engNetworkDetail: document.getElementById('eng-network-detail'),
    engRegionStatus: document.getElementById('eng-region-status'),
    engRegionDetail: document.getElementById('eng-region-detail'),
    signalFlowSource: document.getElementById('signal-flow-source'),
    signalFlowGateway: document.getElementById('signal-flow-gateway'),
    signalFlowSwitcher: document.getElementById('signal-flow-switcher'),
    signalFlowMediaLive: document.getElementById('signal-flow-medialive'),
    signalFlowCdn: document.getElementById('signal-flow-cdn'),
    routeSummaryProgram: document.getElementById('route-summary-program'),
    routeSummaryPreview: document.getElementById('route-summary-preview'),
    routeSummaryPath: document.getElementById('route-summary-path'),
    
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

  el.btnClearLogs.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });

  el.logTagFilter?.addEventListener('change', renderLogs);
  el.logSearchInput?.addEventListener('input', renderLogs);

  el.audioAfvToggle?.addEventListener('change', event => {
    state.audioMixer.audioFollowVideo = event.target.checked;
    addLog('info', 'AUDIO', `Audio Follow Video ${state.audioMixer.audioFollowVideo ? 'enabled' : 'disabled'}.`);
    syncAudioFollowVideo('Follow Video enabled');
    backendCommand('/api/audio-afv', { enabled: state.audioMixer.audioFollowVideo });
    renderAudioMixer();
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
    if (window.location.pathname.toLowerCase().endsWith('monitoring.html')) {
      return 'monitoring';
    }
    return 'operations';
  }

  function setWorkspaceView(view = 'operations') {
    const activeView = view === 'monitoring' ? 'monitoring' : 'operations';
    document.querySelectorAll('.operator-view-tab').forEach(button => {
      button.classList.toggle('view-tab-active', button.dataset.workspace === activeView);
    });
    document.querySelectorAll('[data-workspace-panel]').forEach(panel => {
      panel.classList.toggle('panel-hidden', panel.dataset.workspacePanel !== activeView);
    });
    document.body.classList.toggle('workspace-monitoring', activeView === 'monitoring');
    document.body.classList.toggle('workspace-operations', activeView === 'operations');
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

    TILE_FEEDS.forEach(feed => {
      const sourceId = preset.tileSourceIds?.[feed] || 'none';
      setTileSource(feed, sourceId);
      setSelectValue(`select-source-${feed}`, getSelectValueForSourceId(sourceId));
      clearCanvas(feed);
    });

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
    el.pgmActiveSource.textContent = state.activeSource ? `SOURCE: ${getProgramRouteLabel(state.activeSource)}` : 'SOURCE: NONE';
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
    state.tileSourceIds[feed] = nextSourceId;
    state.tileSources[feed] = LIVEU_SOURCE_IDS.includes(nextSourceId) ? 'simulated' : isNdiSourceId(nextSourceId) ? 'ndi' : nextSourceId;
  }

  function clearTileSource(feed) {
    if (!state.tileSources[feed]) return;
    const wasLocalVideo = getFeedAssignment(feed) === 'localVideo';
    setTileSource(feed, feed === 'vod' ? 'vod' : 'none');
    if (wasLocalVideo) teardownLocalVideo(feed);
    if (state.previewFeed === feed) clearPreviewUI();
    if (state.activeSource === feed) {
      clearProgramOut(`${getTileName(feed)} removed from PROGRAM because its source was cleared.`);
    }
  }

  function clearProgramOut(message = 'Program Out cleared to black.') {
    const previousSource = state.activeSource;
    if (state.adIntervalId) clearInterval(state.adIntervalId);
    state.adIntervalId = null;
    state.adActive = false;
    state.adTimeRemaining = 0;
    state.preAdRoute = null;
    state.activeSource = null;
    state.programSourceOverride = null;
    setProgramAudioFeed(null, 'program off air');
    if (el.adBreakBanner) el.adBreakBanner.style.display = 'none';
    if (el.btnInjectScte) el.btnInjectScte.disabled = false;
    if (el.btnCancelScte) el.btnCancelScte.disabled = true;
    el.pgmActiveSource.textContent = 'SOURCE: NONE';
    if (state.activeGraphics || state.tickerOn || state.bugOn) {
      clearGraphics('Graphics cleared with Program Off Air.');
    }
    addLog(previousSource ? 'info' : 'warning', 'MIX', message);
    updateOrchestratorRouting();
    updateBadges();
    updatePGMFooter();
    syncProgramEmbed();
    updateSourceInspector();
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
    if (assignment === 'none') return 'OFFLINE';
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
    if (serviceId === 'sources') return alarms.some(a => a.includes('INPUT LOSS') || a.includes('QC ALARM')) ? 'ALARM' : 'ONLINE';
    if (serviceId === 'ingest') return state.rttMs >= 160 || state.lossPercent >= 5 ? 'DEGRADED' : 'ONLINE';
    if (serviceId === 'switcher') return state.activeSource ? 'ROUTING' : 'IDLE';
    if (serviceId === 'audio') return state.audioMixer.programBus ? 'PGM' : 'IDLE';
    if (serviceId === 'cg') return state.activeGraphics || state.tickerOn || state.bugOn ? 'KEYING' : 'STANDBY';
    if (serviceId === 'replay') return state.activeSource === 'replay' ? 'ON AIR' : state.previewFeed === 'replay' ? 'CUED' : 'STANDBY';
    if (serviceId === 'playout') return state.activeSource === 'playout' || state.activeSource === 'ad' ? 'ON AIR' : state.previewFeed === 'playout' ? 'CUED' : 'STANDBY';
    if (serviceId === 'encoder') return state.activeSource ? 'ENCODING' : 'IDLE';
    if (serviceId === 'distribution') return state.isUnderflow || state.lossPercent >= 8 ? 'DEGRADED' : state.activeSource ? 'ONLINE' : 'READY';
    return 'ONLINE';
  }

  function syncBackendModel() {
    Object.entries(state.systemModel.services).forEach(([serviceId, service]) => {
      service.status = deriveServiceStatus(serviceId);
      const jitter = Math.round(Math.sin((framesCount + serviceId.length * 13) * 0.03) * 4);
      if (serviceId === 'ingest') service.latency = Math.max(10, state.rttMs + state.jitterMs + jitter);
      if (serviceId === 'encoder') service.load = state.activeSource ? 54 + Math.round(state.calculatedBw * 2) : 28;
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
    return alarms;
  }

  function getRecommendedBackupFeed() {
    const current = state.activeSource;
    return ['cam2', 'liveu3', 'liveu4', 'cam1'].find(feed => feed !== current && feedHasActiveSignal(feed)) || null;
  }

  function getIncidentSnapshot() {
    const alarms = getActiveAlarmSummary();
    const programUnhealthy = state.activeSource && !feedHasActiveSignal(state.activeSource);
    const backupFeed = getRecommendedBackupFeed();
    const primaryCondition = programUnhealthy
      ? `PROGRAM SOURCE UNAVAILABLE: ${getProgramRouteLabel(state.activeSource)}`
      : alarms[0] || null;

    return {
      alarms,
      hasIncident: !!primaryCondition,
      primaryCondition,
      programUnhealthy,
      backupFeed,
      backupLabel: backupFeed ? getProgramRouteLabel(backupFeed) : 'No healthy backup source available'
    };
  }

  function renderIncidentResponse() {
    if (!el.incidentStatusBadge || !el.incidentCurrentState || !el.incidentRecommendation) return;
    const incident = getIncidentSnapshot();
    const badgeClass = incident.hasIncident ? 'badge-amber font-fira text-amber' : 'badge-green font-fira text-green';
    el.incidentStatusBadge.className = badgeClass;
    el.incidentStatusBadge.textContent = incident.hasIncident ? 'ACTIVE INCIDENT' : 'NOMINAL';

    el.incidentCurrentState.textContent = incident.hasIncident ? incident.primaryCondition : 'No active incident';
    if (el.incidentCurrentDetail) {
      el.incidentCurrentDetail.textContent = incident.hasIncident
        ? `${incident.alarms.length} condition${incident.alarms.length === 1 ? '' : 's'} active. Program: ${state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR'}.`
        : 'Signal path and cloud distribution are nominal.';
    }
    el.incidentRecommendation.textContent = incident.hasIncident
      ? incident.backupFeed
        ? `Preview ${incident.backupLabel}, confirm signal lock, then TAKE BACKUP if Program is affected.`
        : 'No healthy backup detected. Prepare OFF AIR, playout slate, or field recovery workflow.'
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

    if (incident.hasIncident) {
      recommendations.push({
        label: 'INCIDENT',
        level: 'alarm',
        text: alarms.slice(0, 3).join(' · ') || incident.primaryCondition
      });
      recommendations.push({
        label: 'IMPACT',
        level: activeProgramHasSignal ? 'warning' : 'alarm',
        text: activeProgramHasSignal
          ? `Program remains on ${programLabel}; confirm source health before the next transition.`
          : `Program route ${programLabel} is at risk or unavailable.`
      });
      recommendations.push({
        label: 'NEXT ACTION',
        level: 'warning',
        text: incident.backupFeed
          ? `Preview ${incident.backupLabel}, verify signal lock, then TAKE BACKUP if Program is affected.`
          : 'No healthy backup is available. Prepare a playout slate or OFF AIR workflow.'
      });
    } else {
      recommendations.push({
        label: 'SHOW STATE',
        level: 'info',
        text: `Program: ${programLabel}. Preview: ${previewLabel}.`
      });
      recommendations.push({
        label: 'WATCH',
        level: 'info',
        text: activeProgramHasSignal
          ? 'Program path is healthy. Continue watching contribution and delivery health.'
          : 'Program is off air. Cue a source to Preview before taking it to air.'
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
      ? `${alarms.length} active condition${alarms.length === 1 ? '' : 's'}. Program: ${programLabel}.`
      : `Program: ${programLabel}. Preview: ${previewLabel}. No active incident.`;
    el.aiOpsList.innerHTML = recommendations.slice(0, 3).map(item => (
      `<div class="ai-ops-item ai-${item.level}"><span>${item.label}</span><strong>${item.text}</strong></div>`
    )).join('');
    renderIncidentResponse();
  }

  function renderEngineeringDashboard() {
    syncBackendModel();
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
    applyTelemetryService('mediaConnect', el.engMediaConnectStatus, el.engMediaConnectDetail, state.primaryFailed ? 'FAILOVER ACTIVE' : 'PROTECTED', state.primaryFailed ? 'text-amber' : 'text-green', state.primaryFailed ? 'Path A failed. Path B is carrying contribution.' : 'Path A is carrying contribution. Path B is hot standby.');
    applyTelemetryService('mediaLive', el.engMediaLiveStatus, el.engMediaLiveDetail, state.activeSource ? 'ENCODING' : 'READY', state.activeSource ? 'text-green' : 'text-amber', state.activeSource ? 'Program route is encoding for distribution.' : 'Waiting for a Program route to begin encoding.');
    applyTelemetryService('cloudFront', el.engCdnStatus, el.engCdnDetail, state.isUnderflow || state.lossPercent >= 8 ? 'DEGRADED' : state.activeSource ? 'DISTRIBUTING' : 'READY', state.isUnderflow || state.lossPercent >= 8 ? 'text-red' : 'text-green', state.isUnderflow || state.lossPercent >= 8 ? 'Delivery is affected. Check contribution loss and encoder buffer.' : state.activeSource ? 'Program is available to the configured edge distribution.' : 'Origin and edge delivery are ready for Program.');
    applyTelemetryService('directConnect', el.engPathStatus, el.engPathDetail, state.primaryFailed ? 'FAILOVER ACTIVE' : 'PROTECTED', state.primaryFailed ? 'text-red' : 'text-green', state.primaryFailed ? 'Primary transport is unavailable. Backup transport is active.' : 'Primary and backup transport paths are armed.');

    const telemetryNetwork = hasLiveTelemetry ? telemetry.network || {} : null;
    const rttMs = typeof telemetryNetwork?.rttMs === 'number' ? telemetryNetwork.rttMs : state.rttMs;
    const lossPercent = typeof telemetryNetwork?.lossPercent === 'number' ? telemetryNetwork.lossPercent : state.lossPercent;
    const jitterMs = typeof telemetryNetwork?.jitterMs === 'number' ? telemetryNetwork.jitterMs : state.jitterMs;
    setMetricText(el.engNetworkStatus, `RTT ${rttMs}ms`, rttMs >= 160 ? 'text-red' : rttMs >= 90 ? 'text-amber' : 'text-green');
    if (el.engNetworkDetail) el.engNetworkDetail.textContent = `${lossPercent.toFixed(1)}% loss · ${jitterMs}ms jitter · ${alarms.length ? `${alarms.length} active alarm${alarms.length === 1 ? '' : 's'}` : 'no active alarms'}`;

    const encoderTelemetry = telemetryService('encoder');
    const encoderRegion = encoderTelemetry?.region || (state.primaryFailed ? 'us-east-2' : 'us-east-1');
    setMetricText(el.engRegionStatus, encoderRegion, encoderTelemetry ? serviceStatusClass(encoderTelemetry.status) : state.primaryFailed ? 'text-amber' : 'text-green');
    if (el.engRegionDetail) el.engRegionDetail.textContent = encoderTelemetry?.detail || (state.activeSource ? 'Primary contribution encoder is processing Program.' : 'Primary contribution encoder is ready.');
    setMetricText(el.signalFlowSource, state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR', state.activeSource ? 'text-green' : 'text-amber');
    setMetricText(el.signalFlowGateway, state.ndiBridge.backendConnected ? 'NDI BRIDGE LIVE' : 'NDI/SRT/WebRTC', state.ndiBridge.backendConnected ? 'text-green' : 'text-blue');
    setMetricText(el.signalFlowSwitcher, state.activeSource ? 'ACTIVE ROUTE' : 'IDLE', state.activeSource ? 'text-green' : 'text-amber');
    setMetricText(el.signalFlowMediaLive, state.activeSource ? 'ENCODING' : 'READY', state.activeSource ? 'text-green' : 'text-blue');
    setMetricText(el.signalFlowCdn, state.isUnderflow || state.lossPercent >= 8 ? 'DEGRADED' : 'READY', state.isUnderflow || state.lossPercent >= 8 ? 'text-red' : 'text-green');
    if (el.routeSummaryProgram) el.routeSummaryProgram.textContent = `ON AIR: ${state.activeSource ? getProgramRouteLabel(state.activeSource) : 'OFF AIR'}`;
    if (el.routeSummaryPreview) el.routeSummaryPreview.textContent = `PREVIEW: ${state.previewFeed ? getProgramRouteLabel(state.previewFeed) : '—'}`;
    if (el.routeSummaryPath) el.routeSummaryPath.textContent = `RESILIENCE: ${state.primaryFailed ? 'PRIMARY FAILED / BACKUP ACTIVE' : 'PRIMARY + BACKUP READY'}`;
    renderCloudTopology();
    renderAudioMixer();
    renderReplayPlayoutServers();
  }

  function serviceStatusClass(status) {
    if (['ALARM', 'FAILED', 'DEGRADED'].includes(status)) return 'text-red';
    if (['STANDBY', 'READY', 'IDLE'].includes(status)) return 'text-amber';
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
      node.classList.toggle('topology-active', ['ROUTING', 'PGM', 'KEYING', 'ENCODING', 'ON AIR', 'CUED'].includes(service.status));
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
    if (Object.values(state.localVideos).some(local => local.ready)) statusParts.unshift('Local video PLAYING');
    el.actionStatus.textContent = statusParts.length ? statusParts.join(' · ') : 'No source routed yet';
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
    const target = pendingLocalAssignTarget || el.selectVideoTarget.value || 'cam2';
    teardownLocalVideo(target);
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.className = 'hidden-video';
    videoEl.src = url;
    document.body.appendChild(videoEl);
    state.localVideos[target] = { fileName: file.name, url, videoEl, ready: false };
    if (target === 'cam2') {
      state.cam2FileName = file.name;
      state.cam2FileURL = url;
      state.cam2VideoReady = false;
    }
    videoEl.addEventListener('loadedmetadata', () => {
      state.localVideos[target].ready = true;
      if (target === 'cam2') state.cam2VideoReady = true;
      updateSourceOverlays();
    }, { once: true });
    videoEl.load();
    videoEl.play().catch(() => {});
    assignMediaTarget('localVideo', target);
    pendingLocalAssignTarget = null;
    updateSourceOverlays();
    addLog('info', 'VIDEO', `Local file loaded to ${getTileName(target)}: ${file.name}`);
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

  function ejectLocalVideo(feed = el.selectVideoTarget.value || state.mediaAssignments.localVideo) {
    if (!feed || !state.localVideos[feed]) {
      addLog('warning', 'VIDEO', 'No local video loaded on the selected route.');
      return;
    }

    const fileName = state.localVideos[feed].fileName;
    teardownLocalVideo(feed);
    clearTileSource(feed);
    addLog('info', 'VIDEO', `Local video cleared from ${getTileName(feed)}: ${fileName}.`);

    updateSourceOverlays();
    clearCanvas(feed);
  }

  el.btnStopWebcam.addEventListener('click', stopWebcam);
  el.btnEjectVideo.addEventListener('click', ejectLocalVideo);

  // Pending assignment target when user selects "Local Video" for a specific tile
  let pendingLocalAssignTarget = null;

  function setPreview(feed) {
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
    backendCommand('/api/preview', { source: feed });
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
    if (state.previewFeed) {
      el.btnTake.textContent = 'TAKE TO AIR';
      el.btnTake.disabled = false;
      el.btnTake.style.opacity = '1.0';
    } else {
      el.btnTake.textContent = 'TAKE TO AIR';
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
      el.btnClearProgram.disabled = !state.activeSource;
      el.btnClearProgram.style.opacity = state.activeSource ? '1.0' : '0.5';
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
    updatePGMFooter();
  }

  function previewGraphic(type = 'lowerThird') {
    state.graphicsPreview = type;
    updateGraphicsUI();
    addLog('info', 'CG', `${graphicsLabel(type)} loaded to CG preview.`);
    backendCommand('/api/cg-preview', { layer: type });
  }

  function takeGraphic() {
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
  }

  function routePreviewToProgram(actionLabel = 'TAKE') {
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
    state.programSourceOverride = null;
    syncAudioFollowVideo(actionLabel);
    clearPreviewUI();
    el.pgmActiveSource.textContent = `SOURCE: ${getProgramRouteLabel(state.activeSource)}`;
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    syncProgramEmbed();
    updateSourceInspector();
    addLog('info', 'MIX', `${actionLabel} executed. Program switched to ${getTileName(state.activeSource)}.`);
    backendCommand('/api/take', { source: state.activeSource, action: actionLabel });
    return true;
  }

  function routeEmergencyBackup() {
    const backupFeed = ['cam2', 'liveu3', 'liveu4', 'cam1'].find(feed => feedHasActiveSignal(feed));
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
  el.btnTake.addEventListener('click', () => routePreviewToProgram('TAKE'));
  el.btnCut?.addEventListener('click', () => routePreviewToProgram('CUT'));
  el.btnFadeBlack?.addEventListener('click', () => {
    clearProgramOut('Program Out faded to black by operator.');
  });
  el.btnEmergencyBackup?.addEventListener('click', routeEmergencyBackup);
  el.btnIncidentPreviewBackup?.addEventListener('click', previewIncidentBackup);
  el.btnIncidentTakeBackup?.addEventListener('click', takeIncidentBackup);
  el.btnIncidentResolve?.addEventListener('click', resolveIncident);
  el.btnIncidentSummary?.addEventListener('click', generateIncidentSummary);

  el.btnClearProgram?.addEventListener('click', () => {
    clearProgramOut('Program Out cleared to black by operator.');
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
    el.tcCam1.textContent = state.primaryFailed ? "00:00:00:00" : getSMPTETimecode(framesCount);
    // Standby has a small simulated sync drift (-2 frames)
    el.tcCam2.textContent = getSMPTETimecode(framesCount - 2);
    // LiveU 3 & 4 with varied network drift
    el.tcLiveu3.textContent = getSMPTETimecode(framesCount - 3);
    el.tcLiveu4.textContent = getSMPTETimecode(framesCount - 4);
    // Graphics is an overlay keyer, not a timed video source.
    el.tcVod.textContent = 'KEY / FILL';
    
    // PGM timecode reflects currently routed active source
    if (state.activeSource === 'cam1') el.tcPgm.textContent = el.tcCam1.textContent;
    else if (state.activeSource === 'cam2') el.tcPgm.textContent = el.tcCam2.textContent;
    else if (state.activeSource === 'liveu3') el.tcPgm.textContent = el.tcLiveu3.textContent;
    else if (state.activeSource === 'liveu4') el.tcPgm.textContent = el.tcLiveu4.textContent;
    else if (state.activeSource === 'vod') el.tcPgm.textContent = el.tcVod.textContent;
    else if (state.activeSource === 'ad') el.tcPgm.textContent = getSMPTETimecode(framesCount);
    else if (state.activeSource === 'replay' || state.activeSource === 'playout') el.tcPgm.textContent = getSMPTETimecode(framesCount);
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
    state.preAdRoute = {
      activeSource: state.activeSource,
      programSourceOverride: state.programSourceOverride,
      label: el.pgmActiveSource.textContent
    };
    el.btnInjectScte.disabled = true;
    el.btnCancelScte.disabled = false;
    
    // Update active source to ad break loop
    state.activeSource = 'ad';
    state.programSourceOverride = 'ad';
    el.pgmActiveSource.textContent = "SOURCE: AD-LOOP (SCTE-35)";
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
    syncProgramEmbed();
    
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
    
    // Restore the exact route that was on air before SCTE interrupted it.
    if (state.preAdRoute?.activeSource) {
      state.activeSource = state.preAdRoute.activeSource;
      state.programSourceOverride = state.preAdRoute.programSourceOverride;
      el.pgmActiveSource.textContent = state.preAdRoute.label || `SOURCE: ${getProgramRouteLabel(state.activeSource)}`;
    } else if (state.primaryFailed) {
      state.activeSource = 'cam2';
      state.programSourceOverride = 'liveu2';
      el.pgmActiveSource.textContent = "SOURCE: LiveU 2 (DR FAILOVER)";
    } else {
      state.activeSource = 'cam1';
      state.programSourceOverride = 'liveu1';
      el.pgmActiveSource.textContent = "SOURCE: LiveU 1";
    }
    state.preAdRoute = null;
    updateBadges();
    updatePGMFooter();
    updateOrchestratorRouting();
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

});
