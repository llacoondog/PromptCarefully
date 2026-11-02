import * as THREE from 'three';
import { VoxelMap, MAP_PRESETS, STAGE_KEYS, generateRandomMap, TILE_INFO } from './map.js?v=14';
import { VoxelRobot } from './robot.js?v=14';
import { RobotAI } from './ai.js?v=14';
import { MultiplayerManager, PLAYER_COLORS } from './multiplayer.js?v=14';
import { soundManager } from './sound.js?v=15';

const BOT_NAMES = ['미니봇', '지나봇', '번개봇', '우당탕봇', '천재봇', '길치봇'];
const BOT_SAMPLE_PROMPTS = {
  stage1: [
    '앞의 가시는 점프로 뛰어넘고 아래로 쭉 내려간 다음 오른쪽 보석까지 달려가!',
    '네가 알아서 적당히 잘 피해 가봐!',
    '오른쪽으로 돌아서 아래로 내려간 다음 가시를 피해 보석까지 달려가!',
    '신나게 춤 한 번 추고 앞만 보고 무작정 돌진!!'
  ],
  stage2: [
    '파란 점프대를 밟고 용암을 뛰어넘어서 보석까지 직진해!',
    '그냥 네 마음대로 알아서 보석까지 가봐!',
    '백덤블링 한 번 하고 파란 발판 점프대를 밟아 용암을 건너서 보석으로 가!'
  ],
  stage3: [
    '아래로 내려가서 벽을 돌아 오른쪽으로 간 다음 다시 아래로 내려가 가시를 피해서 보석까지 가!',
    '알아서 미로 잘 탈출해서 보석 먹어!',
    '오른쪽으로 가다가 아래로 쭉 내려가!'
  ],
  default: [
    '앞의 가시를 점프로 뛰어넘고 아래로 내려간 뒤 오른쪽 보석까지 달려가!',
    '알아서 다 피해서 안전하게 보석까지 골인해!',
    '오른쪽으로 돌아서 가시를 피해 아래쪽 보석으로 달려!'
  ]
};

class GameApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.speechBubble = document.getElementById('speech-bubble');
    this.bubbleText = document.getElementById('bubble-text');
    this.actionBadgesEl = document.getElementById('action-badges');
    this.gameStatusEl = document.getElementById('game-status');
    this.promptInput = document.getElementById('prompt-input');
    this.btnSubmit = document.getElementById('btn-submit');
    this.btnSubmitText = document.getElementById('btn-submit-text');
    this.mapSelect = document.getElementById('map-select');
    this.stageTitleLabel = document.getElementById('stage-title-label');
    this.submissionCounterEl = document.getElementById('submission-counter');
    this.btnReset = document.getElementById('btn-reset');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnToggleSkin = document.getElementById('btn-toggle-skin');
    this.btnToggleSound = document.getElementById('btn-toggle-sound');
    this.modalSettings = document.getElementById('settings-modal');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.btnSaveKey = document.getElementById('btn-save-key');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.toast = document.getElementById('result-toast');
    this.toastTitle = document.getElementById('toast-title');
    this.toastBody = document.getElementById('toast-body');

    // 멀티플레이어 및 HUD 요소
    this.hudFooter = document.getElementById('hud-footer');
    this.roomCodePill = document.getElementById('room-code-pill');
    this.roundBadge = document.getElementById('round-badge');
    this.timerBadge = document.getElementById('timer-badge');
    this.timerSecEl = document.getElementById('timer-sec');
    this.btnOpenLobby = document.getElementById('btn-open-lobby');
    this.scoreboardPanel = document.getElementById('scoreboard-panel');
    this.scoreboardList = document.getElementById('scoreboard-list');
    this.spectateBanner = document.getElementById('spectate-banner');
    this.spectatePlayerTag = document.getElementById('spectate-player-tag');
    this.spectatePromptText = document.getElementById('spectate-prompt-text');

    // 로비 오버레이 요소
    this.lobbyOverlay = document.getElementById('lobby-overlay');
    this.lobbyHomeCard = document.getElementById('lobby-home-card');
    this.lobbyRoomCard = document.getElementById('lobby-room-card');
    this.nicknameInput = document.getElementById('nickname-input');
    this.createMaxRoundsSelect = document.getElementById('create-max-rounds');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.joinCodeInput = document.getElementById('join-code-input');
    this.btnJoinRoom = document.getElementById('btn-join-room');
    this.btnSoloPractice = document.getElementById('btn-solo-practice');
    this.btnSoloRandom = document.getElementById('btn-solo-random');

    this.roomTitleText = document.getElementById('room-title-text');
    this.lobbyRoomCode = document.getElementById('lobby-room-code');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.roomMaxRoundsSelect = document.getElementById('room-max-rounds');
    this.lobbyPlayerCount = document.getElementById('lobby-player-count');
    this.lobbyPlayerList = document.getElementById('lobby-player-list');
    this.btnAddBot = document.getElementById('btn-add-bot');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');
    this.btnStartGame = document.getElementById('btn-start-game');

    // 라운드 정산 모달 요소
    this.roundSummaryModal = document.getElementById('round-summary-modal');
    this.summaryBadge = document.getElementById('summary-badge');
    this.summaryTitle = document.getElementById('summary-title');
    this.summaryDesc = document.getElementById('summary-desc');
    this.summaryScoreList = document.getElementById('summary-score-list');
    this.summaryWaitHost = document.getElementById('summary-wait-host');
    this.btnNextRound = document.getElementById('btn-next-round');

    // API 전용 배너
    this.apiBanner = document.getElementById('api-banner');
    this.apiBannerText = document.getElementById('api-banner-text');
    this.btnCloseBanner = document.getElementById('btn-close-banner');

    // 🔍 3D 마우스 호버 인스펙터 엘리먼트
    this.tileHoverCard = document.getElementById('tile-hover-card');
    this.hoverTileIcon = document.getElementById('hover-tile-icon');
    this.hoverTileName = document.getElementById('hover-tile-name');
    this.hoverTileEn = document.getElementById('hover-tile-en');
    this.hoverTileBadge = document.getElementById('hover-tile-badge');
    this.hoverTileDesc = document.getElementById('hover-tile-desc');
    this.hoverTileTip = document.getElementById('hover-tile-tip');
    this.hoverTileCoords = document.getElementById('hover-tile-coords');

    // 🎲 랜덤 맵 생성 버튼 및 모드 셀렉트
    this.btnRandomMap = document.getElementById('btn-random-map');
    this.btnRandomMapHud = document.getElementById('btn-random-map-hud');
    this.createMapModeSelect = document.getElementById('create-map-mode');
    this.roomMapModeSelect = document.getElementById('room-map-mode');

    // 마우스 레이캐스팅 상태
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.activeMapPreset = null;

    this.ai = new RobotAI();
    this.currentStageId = 'stage1';
    this.clock = new THREE.Clock();
    this.toastTimeout = null;

    // 멀티플레이어 상태
    this.isSoloMode = false;
    this.roomState = {
      roomCode: '',
      hostId: '',
      phase: 'LOBBY', // LOBBY | INPUT | SPECTATE | ROUND_SUMMARY | GAME_OVER
      currentRound: 1,
      maxRounds: 3,
      stageId: 'stage1',
      mapMode: 'random', // 'random' | 'sequential'
      customPreset: null,
      timeLeft: 30,
      players: [], // { id, name, pIndex, colorIdx, score, submitted, isBot, roundOutcome, roundDelta }
      spectateTargetId: null
    };

    // 호스트 전용 관리 데이터
    this.hostSubmissions = new Map(); // playerId -> promptText
    this.hostRoundTimer = null;
    this.spectateAbortToken = 0;

    // UI 동기화 추적용 상태 (호스트/게스트 공통)
    this.lastAppliedPhase = null;
    this.lastAppliedRound = null;

    this.net = new MultiplayerManager({
      onPacket: (packet) => this.handleNetworkPacket(packet),
      onPlayerLeave: (pid) => this.handlePlayerLeave(pid),
      onHostDisconnected: () => {
        this.showToast('연결 종료', '방과의 연결이 끊어졌어.', true);
        this.returnToLobbyHome();
      }
    });

    // 저장된 닉네임 복원
    const savedNick = localStorage.getItem('PCARE_NICKNAME');
    if (savedNick) {
      this.nicknameInput.value = savedNick;
    }

    this.toast.addEventListener('click', () => this.hideToast());

    this.initThree();
    this.initSceneObjects();
    this.initEventListeners();
    this.loadStage(this.currentStageId);

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    // 맑고 화사한 파스텔 스카이블루 배경과 부드러운 하늘빛 안개
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.015);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 5.5;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 100
    );
    this.camera.position.set(12, 14, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 하늘과 잔디의 싱그러운 반사광 (Hemisphere Light)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x86efac, 0.85);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    // 따뜻한 햇살 방향광
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    dirLight.position.set(15, 25, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    const shadowD = 8;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    this.scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 1.2, 20);
    blueLight.position.set(-6, 5, -6);
    this.scene.add(blueLight);

    const pinkLight = new THREE.PointLight(0xf472b6, 1.2, 20);
    pinkLight.position.set(6, 5, 6);
    this.scene.add(pinkLight);
  }

  initSceneObjects() {
    this.map = new VoxelMap(this.scene);
    this.robot = new VoxelRobot(this.scene, this.map);
  }

  loadStage(stageIdOrPreset, customPreset = null) {
    let preset;
    if (customPreset) {
      preset = customPreset;
      this.currentStageId = preset.id || 'custom';
    } else if (typeof stageIdOrPreset === 'object' && stageIdOrPreset !== null) {
      preset = stageIdOrPreset;
      this.currentStageId = preset.id || 'custom';
    } else if (stageIdOrPreset === 'action_random' || stageIdOrPreset === 'random') {
      preset = generateRandomMap();
      this.currentStageId = preset.id;
    } else {
      this.currentStageId = stageIdOrPreset || 'stage1';
      preset = MAP_PRESETS[this.currentStageId] || MAP_PRESETS.stage1;
    }

    MAP_PRESETS[this.currentStageId] = preset;
    this.activeMapPreset = preset;
    this.map.loadStage(preset);
    this.robot.reset(preset.start);

    if (this.stageTitleLabel) {
      this.stageTitleLabel.textContent = `🗺️ ${preset.name}`;
    }
    if (this.mapSelect) {
      if (MAP_PRESETS[this.currentStageId] && this.currentStageId.startsWith('stage')) {
        this.mapSelect.value = this.currentStageId;
      } else {
        this.mapSelect.value = 'action_random';
      }
    }

    this.hideSpeechBubble();
    this.hideToast();
    this.clearActionBadges();
    this.handlePointerLeave();
  }

  // 🎲 무작위 절차적 맵을 생성하여 즉시 로드하고 게임 화면으로 진입
  generateAndLoadRandomMap() {
    // 1. 혹시 로비나 정산 모달에 있었다면 즉시 닫고 연습/플레이 화면 활성화
    this.isSoloMode = true;
    this.lobbyOverlay.classList.add('hidden');
    this.roundSummaryModal.classList.add('hidden');
    this.spectateBanner.classList.add('hidden');
    this.scoreboardPanel.classList.add('hidden');
    this.roomCodePill.classList.add('hidden');
    this.timerBadge.classList.add('hidden');

    this.hudFooter.classList.remove('hidden');
    this.mapSelect.classList.remove('hidden');
    this.btnReset.classList.remove('hidden');
    this.submissionCounterEl.classList.add('hidden');

    this.roundBadge.textContent = '🎲 랜덤 연습 모드';
    this.btnSubmitText.textContent = '명령 전송';
    this.promptInput.disabled = false;
    this.btnSubmit.disabled = false;
    this.promptInput.value = '';
    this.robot.setColorTheme(PLAYER_COLORS[0].body, PLAYER_COLORS[0].accent);
    this.gameStatusEl.textContent = '랜덤 맵 생성됨 - 작전 대기 중';

    // 2. 새 랜덤 맵 생성 및 로드
    const newMap = generateRandomMap();
    MAP_PRESETS[newMap.id] = newMap;
    this.loadStage(newMap);

    // 호스트인 경우 대기실/룸 상태에 즉시 동기화
    if (this.net.isHost) {
      this.roomState.stageId = newMap.id;
      this.roomState.customPreset = newMap;
      this.syncRoomStateToAll();
    }

    soundManager.playPortal();
    this.showToast('🎲 새로운 랜덤 맵 생성 완료!', `${newMap.name}이(가) 펼쳐졌어! 마우스로 기믹들을 확인해봐.`);
  }

  // 🔍 3D 캔버스 마우스 호버 인스펙터 이벤트 처리
  handlePointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.map.raycastTile(this.raycaster);

    if (hit) {
      this.map.setHoverHighlight(hit.gridX, hit.gridZ);

      const info = hit.info;
      if (this.hoverTileIcon) this.hoverTileIcon.textContent = info.icon || '📍';
      if (this.hoverTileName) this.hoverTileName.textContent = info.name || '타일';
      if (this.hoverTileEn) this.hoverTileEn.textContent = info.enName || '';
      if (this.hoverTileBadge) {
        this.hoverTileBadge.textContent = info.badge || '';
        this.hoverTileBadge.className = `hover-tile-badge ${info.badgeClass || ''}`;
      }
      if (this.hoverTileDesc) this.hoverTileDesc.textContent = info.desc || '';
      if (this.hoverTileTip) this.hoverTileTip.textContent = info.tip ? `💡 팁: ${info.tip}` : '';
      if (this.hoverTileCoords) this.hoverTileCoords.textContent = `[X: ${hit.gridX}, Z: ${hit.gridZ}]`;

      const cardWidth = 300;
      const cardHeight = 170;
      let left = e.clientX + 16;
      let top = e.clientY + 16;

      if (left + cardWidth > window.innerWidth) {
        left = e.clientX - cardWidth - 16;
      }
      if (top + cardHeight > window.innerHeight) {
        top = e.clientY - cardHeight - 16;
      }

      if (this.tileHoverCard) {
        this.tileHoverCard.style.left = `${Math.max(10, left)}px`;
        this.tileHoverCard.style.top = `${Math.max(10, top)}px`;
        this.tileHoverCard.classList.remove('hidden');
      }
    } else {
      this.handlePointerLeave();
    }
  }

  handlePointerLeave() {
    this.map.setHoverHighlight(null, null);
    if (this.tileHoverCard) {
      this.tileHoverCard.classList.add('hidden');
    }
  }

  initEventListeners() {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      const d = 5.5;
      this.camera.left = -d * aspect;
      this.camera.right = d * aspect;
      this.camera.top = d;
      this.camera.bottom = -d;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 로비 메뉴 열기
    this.btnOpenLobby.addEventListener('click', () => {
      this.lobbyOverlay.classList.remove('hidden');
    });

    // 방 만들기 (호스트)
    this.btnCreateRoom.addEventListener('click', async () => {
      const nick = this.getAndSaveNickname();
      const maxRounds = parseInt(this.createMaxRoundsSelect.value, 10) || 3;
      this.btnCreateRoom.disabled = true;
      this.btnCreateRoom.textContent = '방 생성 중...';

      try {
        const { roomCode, myId } = await this.net.createRoom(nick);
        this.isSoloMode = false;
        this.roomMaxRoundsSelect.value = String(maxRounds);
        const chosenMapMode = this.createMapModeSelect?.value || 'random';
        if (this.roomMapModeSelect) {
          this.roomMapModeSelect.value = chosenMapMode;
        }

        this.roomState = {
          roomCode,
          hostId: myId,
          phase: 'LOBBY',
          currentRound: 1,
          maxRounds,
          stageId: 'stage1',
          mapMode: chosenMapMode,
          customPreset: null,
          timeLeft: 30,
          players: [
            {
              id: myId,
              name: nick,
              pIndex: 1,
              colorIdx: 0,
              score: 0,
              submitted: false,
              isBot: false,
              roundOutcome: null,
              roundDelta: 0
            }
          ],
          spectateTargetId: null
        };
        this.showWaitingRoomUI();
        this.syncRoomStateToAll();
      } catch (err) {
        this.showToast('방 생성 실패', err.message, true);
      } finally {
        this.btnCreateRoom.disabled = false;
        this.btnCreateRoom.textContent = '방 만들기';
      }
    });

    // 방 찾기 (코드로 입장)
    this.btnJoinRoom.addEventListener('click', () => this.handleJoinRoomClick());
    this.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleJoinRoomClick();
    });

    // 싱글 연습 모드
    this.btnSoloPractice.addEventListener('click', () => {
      this.startSoloPracticeMode();
    });

    // 🎲 싱글 랜덤 맵 바로 시작
    if (this.btnSoloRandom) {
      this.btnSoloRandom.addEventListener('click', () => {
        this.generateAndLoadRandomMap();
      });
    }

    // 방 코드 복사
    const copyRoomCode = () => {
      if (!this.roomState.roomCode) return;
      navigator.clipboard?.writeText(this.roomState.roomCode).catch(() => {});
      this.showToast('방 코드 복사 완료! 📋', `코드 [${this.roomState.roomCode}]를 친구에게 전달해줘!`, false);
    };
    this.btnCopyCode.addEventListener('click', copyRoomCode);
    this.roomCodePill.addEventListener('click', copyRoomCode);

    // 대기실에서 최대 라운드 변경 (호스트만)
    this.roomMaxRoundsSelect.addEventListener('change', (e) => {
      if (!this.net.isHost) return;
      this.roomState.maxRounds = Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 3));
      this.syncRoomStateToAll();
    });

    // AI 봇 플레이어 추가 (호스트만, 최대 8인까지)
    this.btnAddBot.addEventListener('click', () => {
      if (!this.net.isHost) return;
      if (this.roomState.players.length >= 8) {
        this.showToast('최대 인원 초과', '최대 8명까지만 함께 플레이할 수 있어!', true);
        return;
      }
      const pIndex = this.roomState.players.length + 1;
      const botName = BOT_NAMES[(pIndex - 2) % BOT_NAMES.length] || `AI봇${pIndex}`;
      this.roomState.players.push({
        id: `bot_${Date.now()}_${pIndex}`,
        name: botName,
        pIndex,
        colorIdx: (pIndex - 1) % PLAYER_COLORS.length,
        score: 0,
        submitted: false,
        isBot: true,
        roundOutcome: null,
        roundDelta: 0
      });
      this.syncRoomStateToAll();
    });

    // 방 나가기
    this.btnLeaveRoom.addEventListener('click', () => {
      this.net.cleanupPeer();
      this.stopHostTimer();
      this.spectateAbortToken++;
      this.returnToLobbyHome();
    });

    // 게임 시작 버튼 (호스트)
    this.btnStartGame.addEventListener('click', () => {
      if (!this.net.isHost) return;
      this.hostStartMatch();
    });

    // 다음 라운드 / 로비 복귀 버튼 (호스트)
    this.btnNextRound.addEventListener('click', () => {
      if (!this.net.isHost) return;
      if (this.roomState.currentRound >= this.roomState.maxRounds) {
        // 게임 종료 -> 대기실로 복귀
        this.roomState.phase = 'LOBBY';
        this.roundSummaryModal.classList.add('hidden');
        this.lobbyOverlay.classList.remove('hidden');
        this.showWaitingRoomUI();
        this.syncRoomStateToAll();
      } else {
        this.hostStartRound(this.roomState.currentRound + 1);
      }
    });

    // 🔍 3D 캔버스 마우스 호버 인스펙터 이벤트
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerleave', () => this.handlePointerLeave());

    // 🎲 랜덤 맵 생성 버튼
    if (this.btnRandomMap) {
      this.btnRandomMap.addEventListener('click', () => this.generateAndLoadRandomMap());
    }
    if (this.btnRandomMapHud) {
      this.btnRandomMapHud.addEventListener('click', () => this.generateAndLoadRandomMap());
    }

    // 🗺️ 맵 모드 셀렉트 (방 만들기 & 대기실)
    if (this.createMapModeSelect) {
      this.createMapModeSelect.addEventListener('change', (e) => {
        this.roomState.mapMode = e.target.value;
        if (this.roomMapModeSelect) this.roomMapModeSelect.value = e.target.value;
      });
    }
    if (this.roomMapModeSelect) {
      this.roomMapModeSelect.addEventListener('change', (e) => {
        if (!this.net.isHost) return;
        this.roomState.mapMode = e.target.value;
        this.syncRoomStateToAll();
      });
    }

    // 맵 변경 & 초기화 (싱글/자유 연습 및 호스트)
    this.mapSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'action_random' || val === 'random') {
        this.generateAndLoadRandomMap();
      } else {
        this.loadStage(val);
        if (this.net.isHost) {
          this.roomState.stageId = val;
          this.roomState.customPreset = null;
          this.syncRoomStateToAll();
        }
      }
    });

    this.btnReset.addEventListener('click', () => {
      if (this.isSoloMode) {
        if (this.activeMapPreset) {
          this.loadStage(this.activeMapPreset);
        } else {
          this.loadStage(this.currentStageId);
        }
      }
    });

    // 프롬프트 명령 제출
    this.btnSubmit.addEventListener('click', () => this.handlePromptSubmit());
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handlePromptSubmit();
    });

    // BGM & 효과음 토글 버튼
    if (this.btnToggleSound) {
      this.btnToggleSound.addEventListener('click', () => {
        const isPlaying = soundManager.toggleBgm();
        this.btnToggleSound.textContent = isPlaying ? '🎵 BGM: 켬' : '🎵 BGM: 끔';
        this.btnToggleSound.style.borderColor = isPlaying ? 'var(--primary-pink)' : '';
        this.showToast(
          isPlaying ? '🎵 BGM 재생' : '🔇 BGM 정지',
          isPlaying ? '신나는 파티 BGM이 켜졌어!' : 'BGM이 꺼졌어 (효과음은 유지돼).'
        );
      });
    }

    // 캐릭터 스킨 변경 토글 (미니 SD ↔ 클래식 복셀)
    if (this.btnToggleSkin) {
      this.btnToggleSkin.addEventListener('click', () => {
        const skin = this.robot.toggleSkin();
        this.btnToggleSkin.textContent = skin === 'mini' ? '👧 스킨: 미니 SD' : '🤖 스킨: 복셀 로봇';
        this.showToast(
          skin === 'mini' ? '👧 캐릭터 스킨 변경' : '🤖 캐릭터 스킨 변경',
          skin === 'mini' ? '미니(Mini) SD 3D 캐릭터로 변경되었어!' : '클래식 복셀 로봇으로 변경되었어!'
        );
      });
    }

    // API 키 모달 설정
    this.btnSettings.addEventListener('click', () => {
      this.apiKeyInput.value = this.ai.getApiKey();
      this.modalSettings.classList.remove('hidden');
    });

    this.btnCloseModal.addEventListener('click', () => {
      this.modalSettings.classList.add('hidden');
    });

    this.btnSaveKey.addEventListener('click', () => {
      this.ai.setApiKey(this.apiKeyInput.value);
      this.modalSettings.classList.add('hidden');
      this.showToast('설정 완료', 'Gemini API 키가 저장되었어!', false);
    });

    if (this.btnCloseBanner) {
      this.btnCloseBanner.addEventListener('click', () => this.hideApiBanner());
    }

    window.addEventListener('ai-error', (e) => {
      this.showApiBanner(`API 오류: ${e.detail}`, true);
    });

    window.addEventListener('ai-success', (e) => {
      this.showApiBanner(e.detail, false);
      setTimeout(() => this.hideApiBanner(), 3000);
    });
  }

  getAndSaveNickname() {
    const raw = this.nicknameInput.value.trim();
    const nick = raw || `플레이어${Math.floor(Math.random() * 90 + 10)}`;
    this.nicknameInput.value = nick;
    localStorage.setItem('PCARE_NICKNAME', nick);
    return nick;
  }

  async handleJoinRoomClick() {
    const code = this.joinCodeInput.value.trim().toUpperCase();
    if (!code) {
      this.showToast('방 코드 필요', '입장할 방 코드를 입력해줘!', true);
      return;
    }
    const nick = this.getAndSaveNickname();
    this.btnJoinRoom.disabled = true;
    this.btnJoinRoom.textContent = '접속 중...';

    try {
      await this.net.joinRoom(code, nick);
      this.isSoloMode = false;
      this.showWaitingRoomUI();
    } catch (err) {
      this.showToast('방 입장 실패', err.message, true);
    } finally {
      this.btnJoinRoom.disabled = false;
      this.btnJoinRoom.textContent = '방 입장하기';
    }
  }

  returnToLobbyHome() {
    this.lobbyOverlay.classList.remove('hidden');
    this.lobbyHomeCard.classList.remove('hidden');
    this.lobbyRoomCard.classList.add('hidden');
    this.roundSummaryModal.classList.add('hidden');
    this.spectateBanner.classList.add('hidden');
    this.scoreboardPanel.classList.add('hidden');
    this.hudFooter.classList.add('hidden');
    this.roomCodePill.classList.add('hidden');
    this.timerBadge.classList.add('hidden');
    this.gameStatusEl.textContent = '방 대기 중';
  }

  showWaitingRoomUI() {
    this.lobbyOverlay.classList.remove('hidden');
    this.lobbyHomeCard.classList.add('hidden');
    this.lobbyRoomCard.classList.remove('hidden');
    this.renderWaitingRoom();
  }

  renderWaitingRoom() {
    const { roomCode, maxRounds, players } = this.roomState;
    this.lobbyRoomCode.textContent = roomCode || '----';
    this.roomCodePill.textContent = `코드: ${roomCode}`;
    this.roomCodePill.classList.remove('hidden');

    const hostPlayer = players[0];
    this.roomTitleText.textContent = hostPlayer
      ? `${hostPlayer.name}님의 대기실`
      : '대기실';

    this.roomMaxRoundsSelect.value = String(maxRounds);
    this.roomMaxRoundsSelect.disabled = !this.net.isHost;
    this.btnAddBot.classList.toggle('hidden', !this.net.isHost);
    this.btnStartGame.disabled = !this.net.isHost;
    this.btnStartGame.textContent = this.net.isHost
      ? `🚀 게임 시작 (총 ${maxRounds}라운드)`
      : '게임 시작 대기 중...';

    this.lobbyPlayerCount.textContent = String(players.length);
    this.lobbyPlayerList.innerHTML = '';

    players.forEach((p, idx) => {
      const colorInfo = PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length];
      const li = document.createElement('li');
      li.className = 'lobby-player-item';
      const isMe = p.id === this.net.myId;
      li.innerHTML = `
        <div class="score-item-left">
          <span class="player-p-tag" style="background:${colorInfo.hex}">${idx + 1}P</span>
          <span class="player-name-text">${this.escapeHtml(p.name)}${isMe ? ' (나)' : ''}</span>
        </div>
        <span style="font-size:0.76rem; color:var(--text-muted)">
          ${idx === 0 ? '👑 방장' : p.isBot ? '🤖 AI봇' : '참가자'}
        </span>
      `;
      this.lobbyPlayerList.appendChild(li);
    });
  }

  renderScoreboard() {
    this.scoreboardPanel.classList.remove('hidden');
    this.scoreboardList.innerHTML = '';

    this.roomState.players.forEach((p, idx) => {
      const colorInfo = PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length];
      const isWatching =
        this.roomState.phase === 'SPECTATE' && this.roomState.spectateTargetId === p.id;
      const isMe = p.id === this.net.myId;

      let statusIcon = '';
      if (this.roomState.phase === 'INPUT') {
        statusIcon = p.submitted ? '✅' : '✍️';
      } else if (this.roomState.phase === 'SPECTATE') {
        if (isWatching) statusIcon = '👀';
        else if (p.roundOutcome === 'pass') statusIcon = '🎉';
        else if (p.roundOutcome === 'fail') statusIcon = '💥';
      }

      const li = document.createElement('li');
      li.className = `score-item ${isWatching ? 'watching' : ''}`;
      li.innerHTML = `
        <div class="score-item-left">
          <span class="player-p-tag" style="background:${colorInfo.hex}">${idx + 1}P</span>
          <span class="player-name-text">${this.escapeHtml(p.name)}${isMe ? '*' : ''}</span>
        </div>
        <div class="score-item-right">
          <span class="ready-dot">${statusIcon}</span>
          <span class="score-pts">${p.score}점</span>
        </div>
      `;
      this.scoreboardList.appendChild(li);
    });

    const submittedCount = this.roomState.players.filter((p) => p.submitted).length;
    this.submissionCounterEl.textContent = `명령 입력 완료: ${submittedCount} / ${this.roomState.players.length}`;
  }

  // =========================================================================
  // 네트워크 패킷 처리 (Host & Guest)
  // =========================================================================

  syncRoomStateToAll() {
    if (!this.net.isHost) return;
    const packet = {
      type: 'ROOM_STATE',
      _packetId: 'pkt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      state: this.roomState
    };
    this.net.broadcastFromHost(packet);
    this.applyRoomState(this.roomState);
  }

  handlePlayerLeave(playerId) {
    if (!this.net.isHost) return;
    this.roomState.players = this.roomState.players.filter((p) => p.id !== playerId);
    this.roomState.players.forEach((p, idx) => {
      p.pIndex = idx + 1;
    });
    this.syncRoomStateToAll();
  }

  handleNetworkPacket(packet) {
    if (!packet || !packet.type) return;

    // 1. 게스트 -> 호스트 요청 처리
    if (this.net.isHost) {
      if (packet.type === 'JOIN_REQ') {
        const existing = this.roomState.players.find((p) => p.id === packet.senderId);
        if (!existing && this.roomState.players.length < 8) {
          const pIndex = this.roomState.players.length + 1;
          this.roomState.players.push({
            id: packet.senderId,
            name: packet.nickname || `플레이어${pIndex}`,
            pIndex,
            colorIdx: (pIndex - 1) % PLAYER_COLORS.length,
            score: 0,
            submitted: false,
            isBot: false,
            roundOutcome: null,
            roundDelta: 0
          });
        }
        this.syncRoomStateToAll();
        return;
      }

      if (packet.type === 'SUBMIT_PROMPT') {
        if (this.roomState.phase !== 'INPUT') return;
        const player = this.roomState.players.find((p) => p.id === packet.senderId);
        if (!player) return;

        this.hostSubmissions.set(player.id, String(packet.prompt || '').trim());
        player.submitted = true;
        this.syncRoomStateToAll();

        // 모든 플레이어가 입력을 마쳤으면 즉시 30초 대기 종료 후 1P부터 관전 시작!
        const allSubmitted = this.roomState.players.every((p) => p.submitted);
        if (allSubmitted) {
          this.stopHostTimer();
          setTimeout(() => {
            if (this.roomState.phase === 'INPUT') {
              this.hostBeginSpectateSequence();
            }
          }, 400);
        }
        return;
      }
    }

    // 2. 호스트 -> 전체 브로드캐스트 패킷 처리
    if (packet.type === 'ROOM_STATE' && packet.state) {
      this.applyRoomState(packet.state);
      return;
    }

    if (packet.type === 'TIMER_TICK') {
      this.roomState.timeLeft = packet.timeLeft;
      this.updateTimerUI(packet.timeLeft);
      return;
    }

    if (packet.type === 'SPECTATE_RUN') {
      this.playSpectateTurnClient(packet);
      return;
    }
  }

  applyRoomState(newState) {
    const prevStage = this.currentStageId;
    const isNewInputRound =
      newState.phase === 'INPUT' &&
      (this.lastAppliedPhase !== 'INPUT' || this.lastAppliedRound !== newState.currentRound);

    if (this.roomState !== newState) {
      this.roomState = JSON.parse(JSON.stringify(newState));
    }
    this.lastAppliedPhase = this.roomState.phase;
    this.lastAppliedRound = this.roomState.currentRound;

    this.roundBadge.textContent = `ROUND ${this.roomState.currentRound} / ${this.roomState.maxRounds}`;
    this.roomCodePill.textContent = `코드: ${this.roomState.roomCode}`;
    this.roomCodePill.classList.remove('hidden');

    if (this.roomState.customPreset) {
      if (!this.activeMapPreset || this.activeMapPreset.id !== this.roomState.customPreset.id) {
        this.loadStage(this.roomState.customPreset);
      }
    } else if (this.roomState.stageId && this.roomState.stageId !== prevStage) {
      this.loadStage(this.roomState.stageId);
    }

    if (this.roomState.phase === 'LOBBY') {
      this.spectateAbortToken++;
      this.roundSummaryModal.classList.add('hidden');
      this.spectateBanner.classList.add('hidden');
      this.timerBadge.classList.add('hidden');
      this.hudFooter.classList.add('hidden');
      this.showWaitingRoomUI();
      this.renderScoreboard();
      this.gameStatusEl.textContent = '대기실 - 게임 시작 대기 중';
      return;
    }

    // 게임 진행 중이면 로비 오버레이 숨김
    this.lobbyOverlay.classList.add('hidden');
    this.mapSelect.classList.add('hidden');
    this.btnReset.classList.add('hidden');
    this.submissionCounterEl.classList.remove('hidden');
    this.renderScoreboard();

    if (this.roomState.phase === 'INPUT') {
      // 이전 라운드 관전 루프가 혹시 남아있다면 즉시 중단
      this.spectateAbortToken++;
      this.roundSummaryModal.classList.add('hidden');
      this.spectateBanner.classList.add('hidden');
      this.hudFooter.classList.remove('hidden');
      this.timerBadge.classList.remove('hidden');
      this.updateTimerUI(this.roomState.timeLeft);

      if (isNewInputRound) {
        // 라운드 입력 시작 시 내 로봇 색상 및 입력창 초기화
        this.loadStage(this.roomState.customPreset || this.roomState.stageId);
        const me = this.roomState.players.find((p) => p.id === this.net.myId);
        if (me) {
          const c = PLAYER_COLORS[me.colorIdx % PLAYER_COLORS.length];
          this.robot.setColorTheme(c.body, c.accent);
        }
        this.promptInput.value = '';
        this.promptInput.disabled = false;
        this.btnSubmit.disabled = false;
        this.btnSubmitText.textContent = '명령 준비 완료';
        this.clearActionBadges();
        this.promptInput.focus();
      }

      const me = this.roomState.players.find((p) => p.id === this.net.myId);
      if (me && me.submitted) {
        this.promptInput.disabled = true;
        this.btnSubmit.disabled = true;
        this.btnSubmitText.textContent = '제출 완료 ✅';
        this.gameStatusEl.textContent = '다른 플레이어 입력 대기 중...';
      } else {
        this.promptInput.disabled = false;
        this.btnSubmit.disabled = false;
        this.btnSubmitText.textContent = '명령 준비 완료';
        this.gameStatusEl.textContent = '로봇에게 내릴 명령을 입력해!';
      }
      return;
    }

    if (this.roomState.phase === 'SPECTATE') {
      this.timerBadge.classList.add('hidden');
      this.roundSummaryModal.classList.add('hidden');
      this.hudFooter.classList.remove('hidden');
      this.promptInput.disabled = true;
      this.btnSubmit.disabled = true;
      this.btnSubmitText.textContent = '관전 중 👀';
      return;
    }

    if (this.roomState.phase === 'ROUND_SUMMARY' || this.roomState.phase === 'GAME_OVER') {
      this.timerBadge.classList.add('hidden');
      this.spectateBanner.classList.add('hidden');
      this.showRoundSummaryModal();
    }
  }

  updateTimerUI(sec) {
    const prevSec = parseInt(this.timerSecEl.textContent, 10);
    this.timerSecEl.textContent = String(Math.max(0, sec));
    this.timerBadge.classList.toggle('urgent', sec <= 8);
    if (sec <= 5 && sec > 0 && prevSec !== sec) {
      soundManager.playTick(true);
    }
  }

  // =========================================================================
  // 호스트 전용 게임 진행 엔진 (라운드 시작 -> 30초 타이머 -> 1P부터 관전 -> 점수 정산)
  // =========================================================================

  hostStartMatch() {
    if (!this.net.isHost) return;
    const maxR = Math.min(8, Math.max(1, parseInt(this.roomMaxRoundsSelect.value, 10) || 3));
    this.roomState.maxRounds = maxR;
    this.roomState.mapMode = this.roomMapModeSelect?.value || this.createMapModeSelect?.value || 'random';
    this.roomState.players.forEach((p, idx) => {
      p.pIndex = idx + 1;
      p.score = 0;
      p.submitted = false;
      p.roundOutcome = null;
      p.roundDelta = 0;
    });
    this.hostStartRound(1);
  }

  hostStartRound(roundNum) {
    if (!this.net.isHost) return;
    this.stopHostTimer();
    this.spectateAbortToken++;
    this.hostSubmissions.clear();

    let stageId;
    let customPreset = null;
    if (this.roomState.mapMode === 'random') {
      customPreset = generateRandomMap();
      stageId = customPreset.id;
      this.roomState.customPreset = customPreset;
    } else {
      stageId = STAGE_KEYS[(roundNum - 1) % STAGE_KEYS.length];
      this.roomState.customPreset = null;
    }

    this.roomState.currentRound = roundNum;
    this.roomState.stageId = stageId;
    this.roomState.phase = 'INPUT';
    this.roomState.timeLeft = 30;
    this.roomState.spectateTargetId = null;

    this.roomState.players.forEach((p) => {
      p.submitted = false;
      p.roundOutcome = null;
      p.roundDelta = 0;
    });

    this.syncRoomStateToAll();

    // AI 봇들이 있다면 2~4초 사이에 자연어 프롬프트 자동 제출
    this.roomState.players.forEach((p) => {
      if (p.isBot) {
        setTimeout(() => {
          if (this.roomState.phase !== 'INPUT') return;
          const pool = BOT_SAMPLE_PROMPTS[stageId] || BOT_SAMPLE_PROMPTS.default;
          const botPrompt = pool[Math.floor(Math.random() * pool.length)];
          this.hostSubmissions.set(p.id, botPrompt);
          p.submitted = true;
          this.syncRoomStateToAll();
        }, 1800 + Math.random() * 2000);
      }
    });

    // 30초 카운트다운 시작
    this.hostRoundTimer = setInterval(() => {
      this.roomState.timeLeft -= 1;
      this.net.broadcastFromHost({
        type: 'TIMER_TICK',
        timeLeft: this.roomState.timeLeft
      });
      this.updateTimerUI(this.roomState.timeLeft);

      if (this.roomState.timeLeft <= 0) {
        this.stopHostTimer();
        this.hostBeginSpectateSequence();
      }
    }, 1000);
  }

  stopHostTimer() {
    if (this.hostRoundTimer) {
      clearInterval(this.hostRoundTimer);
      this.hostRoundTimer = null;
    }
  }

  /**
   * 30초가 끝났거나 전원 제출 시:
   * 1P부터 마지막 플레이어까지 순서대로 각자의 명령 결과를 다함께 관전!
   */
  async hostBeginSpectateSequence() {
    if (!this.net.isHost) return;
    this.stopHostTimer();
    const myToken = ++this.spectateAbortToken;

    this.roomState.phase = 'SPECTATE';
    this.syncRoomStateToAll();

    const preset =
      this.roomState.customPreset ||
      MAP_PRESETS[this.roomState.stageId] ||
      MAP_PRESETS.stage1;

    for (let i = 0; i < this.roomState.players.length; i++) {
      if (myToken !== this.spectateAbortToken) return;

      const player = this.roomState.players[i];
      const rawPrompt =
        this.hostSubmissions.get(player.id) ||
        (player.id === this.net.myId ? this.promptInput.value.trim() : '') ||
        '보석을 향해 무작정 직진해!';

      this.roomState.spectateTargetId = player.id;
      this.syncRoomStateToAll();

      // 호스트가 해당 플레이어의 프롬프트에 대한 AI 경로(plan)를 생성하여 모든 클라이언트에 동일하게 전송
      const plan = await this.ai.parsePrompt(rawPrompt, preset, {
        x: preset.start.x,
        z: preset.start.z,
        dir: preset.start.dir || 0
      });

      if (myToken !== this.spectateAbortToken) return;

      const spectatePacket = {
        type: 'SPECTATE_RUN',
        _packetId: 'spec_' + Date.now() + '_' + player.id,
        stageId: this.roomState.stageId || this.currentStageId,
        customPreset: this.roomState.customPreset,
        playerId: player.id,
        pIndex: i + 1,
        playerName: player.name,
        colorIdx: player.colorIdx,
        prompt: rawPrompt,
        plan
      };

      // 게스트들에게 관전 시작 브로드캐스트 후 호스트 자신도 동시에 관전 애니메이션 재생
      this.net.broadcastFromHost(spectatePacket);
      const passed = await this.playSpectateTurnClient(spectatePacket, myToken);

      if (myToken !== this.spectateAbortToken) return;

      const targetPlayer = this.roomState.players.find((p) => p.id === player.id);
      if (targetPlayer) {
        targetPlayer.roundOutcome = passed ? 'pass' : 'fail';
      }
      player.roundOutcome = passed ? 'pass' : 'fail';
      this.syncRoomStateToAll();

      // 다음 플레이어 관전으로 넘어가기 전 여운 (2.2초)
      await new Promise((r) => setTimeout(r, 2200));
    }

    if (myToken !== this.spectateAbortToken) return;

    // 모든 플레이어 관전 완료 -> 점수 계산 (통과 +1점, 단독 우승 +2점)
    const winners = this.roomState.players.filter((p) => p.roundOutcome === 'pass');
    const isSoloWinner = winners.length === 1;

    this.roomState.players.forEach((p) => {
      if (p.roundOutcome === 'pass') {
        const delta = isSoloWinner ? 2 : 1;
        p.roundDelta = delta;
        p.score += delta;
      } else {
        p.roundDelta = 0;
      }
    });

    this.roomState.spectateTargetId = null;
    this.roomState.phase =
      this.roomState.currentRound >= this.roomState.maxRounds
        ? 'GAME_OVER'
        : 'ROUND_SUMMARY';

    this.syncRoomStateToAll();
  }

  /**
   * 호스트와 모든 게스트가 동일한 플레이어의 명령과 3D 주행 결과를 실시간 관전
   */
  async playSpectateTurnClient(packet, expectedToken = null) {
    const token = expectedToken !== null ? expectedToken : this.spectateAbortToken;
    const { pIndex, playerName, colorIdx, prompt, plan } = packet;
    const activeStageId = packet.stageId || this.roomState.stageId || this.currentStageId;
    if (packet.customPreset) {
      if (!this.activeMapPreset || this.activeMapPreset.id !== packet.customPreset.id) {
        this.loadStage(packet.customPreset);
      }
    } else if (this.currentStageId !== activeStageId) {
      this.loadStage(activeStageId);
    }
    const preset = packet.customPreset || this.activeMapPreset || MAP_PRESETS[activeStageId] || MAP_PRESETS.stage1;
    const colorInfo = PLAYER_COLORS[colorIdx % PLAYER_COLORS.length];

    // 상단 관전 배너 표시
    this.spectateBanner.classList.remove('hidden');
    this.spectatePlayerTag.textContent = `👀 ${pIndex}P ${playerName}님의 작전 관전 중`;
    this.spectatePlayerTag.style.background = colorInfo.hex;
    this.spectatePlayerTag.style.color = '#0f172a';
    this.spectatePromptText.textContent = `"${prompt}"`;

    this.gameStatusEl.textContent = `${pIndex}P (${playerName}) 로봇 출격!`;
    this.promptInput.value = `[${pIndex}P ${playerName}] ${prompt}`;

    // 로봇 초기 위치 및 플레이어 색상 세팅
    this.hideToast();
    this.robot.reset(preset.start);
    this.robot.setColorTheme(colorInfo.body, colorInfo.accent);

    // 생각 과정 브리핑 (약 0.9초)
    this.robot.setThinking(true);
    this.showThoughtProcess({
      thoughts: plan.thoughts || [],
      thought: plan.thought || '',
      isThinking: true
    });
    this.renderActionBadges(plan.actions || []);
    await new Promise((r) => setTimeout(r, 900));

    if (token !== this.spectateAbortToken || this.roomState.phase !== 'SPECTATE') {
      this.robot.setThinking(false);
      return false;
    }

    this.robot.setThinking(false);
    this.showThoughtProcess({
      thoughts: plan.thoughts || [],
      thought: plan.thought || '',
      isThinking: false
    });

    await this.runManeuverSequence(
      plan.maneuvers || [],
      plan.thoughts || [],
      `${pIndex}P ${playerName}`,
      token,
      plan.rules || {},
      preset
    );
    const isGoalReached =
      this.robot.isGoal ||
      (this.robot.gridPos.x === preset.goal.x && this.robot.gridPos.z === preset.goal.z);
    return Boolean(isGoalReached && !this.robot.isDead);
  }

  showRoundSummaryModal() {
    const isGameOver = this.roomState.phase === 'GAME_OVER';
    const winners = this.roomState.players.filter((p) => p.roundOutcome === 'pass');
    const isSoloWin = winners.length === 1;

    if (isGameOver || winners.length > 0) {
      soundManager.playFanfare();
    }

    this.roundSummaryModal.classList.remove('hidden');
    this.summaryBadge.textContent = isGameOver
      ? `🏆 최종 결과 (${this.roomState.maxRounds}라운드 종료)`
      : `ROUND ${this.roomState.currentRound} / ${this.roomState.maxRounds} 정산`;

    if (isGameOver) {
      const sorted = [...this.roomState.players].sort((a, b) => b.score - a.score);
      const topScore = sorted[0]?.score ?? 0;
      const champions = sorted.filter((p) => p.score === topScore);
      this.summaryTitle.textContent =
        champions.length === 1
          ? `👑 최종 우승: ${champions[0].name}!`
          : `👑 공동 우승: ${champions.map((c) => c.name).join(', ')}!`;
    } else if (isSoloWin) {
      this.summaryTitle.textContent = `🌟 ${winners[0].name}님 단독 통과! (+2점 획득!)`;
    } else if (winners.length > 1) {
      this.summaryTitle.textContent = `🎉 ${winners.length}명 통과! (각 +1점 획득!)`;
    } else {
      this.summaryTitle.textContent = `💥 전원 실패! (아무도 점수를 얻지 못했어)`;
    }

    this.summaryScoreList.innerHTML = '';
    const displayPlayers = isGameOver
      ? [...this.roomState.players].sort((a, b) => b.score - a.score)
      : this.roomState.players;

    displayPlayers.forEach((p) => {
      const colorInfo = PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length];
      const li = document.createElement('li');
      li.className = `summary-row ${p.roundDelta === 2 ? 'solo-winner' : ''}`;

      let deltaBadge = '<span class="summary-delta zero">+0점 (실패)</span>';
      if (p.roundDelta === 2) {
        deltaBadge = '<span class="summary-delta plus2">🌟 단독 우승 +2점!</span>';
      } else if (p.roundDelta === 1) {
        deltaBadge = '<span class="summary-delta plus1">✅ 통과 +1점!</span>';
      }

      li.innerHTML = `
        <div class="score-item-left">
          <span class="player-p-tag" style="background:${colorInfo.hex}">${p.pIndex}P</span>
          <span class="player-name-text">${this.escapeHtml(p.name)}</span>
        </div>
        <div class="score-item-right">
          ${deltaBadge}
          <span class="score-pts" style="min-width:48px; text-align:right">${p.score}점</span>
        </div>
      `;
      this.summaryScoreList.appendChild(li);
    });

    if (this.net.isHost) {
      this.btnNextRound.classList.remove('hidden');
      this.summaryWaitHost.classList.add('hidden');
      this.btnNextRound.textContent = isGameOver
        ? '🏠 대기실로 돌아가기'
        : `다음 라운드 (ROUND ${this.roomState.currentRound + 1}) 시작 ▶`;
    } else {
      this.btnNextRound.classList.add('hidden');
      this.summaryWaitHost.classList.remove('hidden');
    }
  }

  // =========================================================================
  // 싱글 연습 모드 & 프롬프트 제출 핸들러
  // =========================================================================

  startSoloPracticeMode() {
    this.isSoloMode = true;
    this.stopHostTimer();
    this.spectateAbortToken++;

    this.lobbyOverlay.classList.add('hidden');
    this.roundSummaryModal.classList.add('hidden');
    this.spectateBanner.classList.add('hidden');
    this.scoreboardPanel.classList.add('hidden');
    this.roomCodePill.classList.add('hidden');
    this.timerBadge.classList.add('hidden');

    this.hudFooter.classList.remove('hidden');
    this.mapSelect.classList.remove('hidden');
    this.btnReset.classList.remove('hidden');
    this.submissionCounterEl.classList.add('hidden');

    this.roundBadge.textContent = '자유 연습 모드';
    this.btnSubmitText.textContent = '명령 전송';
    this.promptInput.disabled = false;
    this.btnSubmit.disabled = false;
    this.promptInput.value = '';
    this.robot.setColorTheme(PLAYER_COLORS[0].body, PLAYER_COLORS[0].accent);
    this.loadStage(this.currentStageId);
    this.gameStatusEl.textContent = '싱글 연습 - 명령 대기 중';
  }

  async handlePromptSubmit() {
    const prompt = this.promptInput.value.trim();
    if (!prompt) return;

    // 1) 멀티플레이어 입력 단계인 경우 -> 호스트로 내 명령 제출
    if (!this.isSoloMode) {
      if (this.roomState.phase !== 'INPUT') return;
      this.promptInput.disabled = true;
      this.btnSubmit.disabled = true;
      this.btnSubmitText.textContent = '제출 완료 ✅';
      this.net.sendToHost({
        type: 'SUBMIT_PROMPT',
        prompt
      });
      this.showToast('명령 준비 완료! ✅', '다른 플레이어의 입력을 기다리는 중이야.', false);
      return;
    }

    // 2) 싱글 자유 연습 모드인 경우 -> 즉시 실행
    this.btnSubmit.disabled = true;
    this.promptInput.disabled = true;
    this.gameStatusEl.textContent = '생각 공유 중...';
    this.robot.setThinking(true);

    try {
      const preset = this.activeMapPreset || MAP_PRESETS[this.currentStageId] || MAP_PRESETS.stage1;
      const result = await this.ai.parsePrompt(
        prompt,
        preset,
        { x: this.robot.gridPos.x, z: this.robot.gridPos.z, dir: this.robot.dirIndex },
        {
          onStreamUpdate: (partial) => {
            if (partial.thoughts.length > 0 || partial.thought) {
              this.showThoughtProcess({
                thoughts: partial.thoughts,
                thought: partial.thought,
                isThinking: true
              });
            }
            if (partial.actions.length > 0) {
              this.renderActionBadges(partial.actions);
            }
          }
        }
      );

      this.robot.setThinking(false);
      this.showThoughtProcess({
        thoughts: result.thoughts || [],
        thought: result.thought,
        isThinking: false
      });
      this.renderActionBadges(result.actions);
      this.gameStatusEl.textContent = '연속 자율 주행 중!';

      await this.runManeuverSequence(
        result.maneuvers || [],
        result.thoughts || [],
        '연습 로봇',
        null,
        result.rules || {}
      );
    } catch (err) {
      console.error(err);
      this.robot.setThinking(false);
      this.showToast('오류', 'AI 응답 처리 중 문제가 생겼어.', true);
    } finally {
      this.btnSubmit.disabled = false;
      this.promptInput.disabled = false;
    }
  }

  async runManeuverSequence(
    maneuvers,
    thoughts = [],
    actorLabel = '로봇',
    expectedToken = null,
    rules = {},
    targetPreset = null
  ) {
    const queue = [...maneuvers];
    const activeStageId = this.roomState?.stageId || this.currentStageId;
    const preset = targetPreset || MAP_PRESETS[activeStageId] || MAP_PRESETS.stage1;
    let hasReroutedWall = false;

    for (let i = 0; i < queue.length; i++) {
      if (expectedToken !== null && expectedToken !== this.spectateAbortToken) {
        return;
      }
      const m = queue[i];
      const badges = document.querySelectorAll('.action-badge');

      if (badges[i]) badges[i].classList.add('active');

      this.showThoughtProcess({
        thoughts,
        thought: m.thought || m.label,
        isThinking: false
      });

      this.robot.hitWall = false;
      await this.robot.executeManeuver(m);

      if (expectedToken !== null && expectedToken !== this.spectateAbortToken) {
        return;
      }

      if (badges[i]) {
        badges[i].classList.remove('active');
        badges[i].classList.add('done');
      }

      // 만약 로봇의 최종 그리드 좌표가 골인 지점이면 즉시 통과 판정 보정
      if (
        !this.robot.isDead &&
        (this.robot.isGoal ||
          (this.robot.gridPos.x === preset.goal.x && this.robot.gridPos.z === preset.goal.z))
      ) {
        this.robot.isGoal = true;
        this.robot.lastFailReason = null;
      }

      if (this.robot.isGoal) {
        this.showSpeechBubble('야호!! 매끄러운 주행으로 보석에 도착했어! 🎉');
        this.gameStatusEl.textContent = `${actorLabel}: 스테이지 통과!`;
        this.showToast(
          `${actorLabel} - 목적지 통과 성공! 🎉`,
          '완벽한 자연어 지시였어!',
          false
        );
        break;
      }

      // 벽에 막혔을 때 처리:
      // 1) "알아서 가" 같은 대충 명령이면 길찾기 우회 없이 그대로 멈춤!
      // 2) 다음 절 지시가 남아 있으면 그 지시를 바로 이어서 수행!
      // 3) 마지막 절에서 벽에 막혔다면 눈앞 벽 블록 1개만 살짝 비켜감 (맵 전체 자동 길찾기 X)
      if (this.robot.hitWall && !this.robot.isDead && !this.robot.isGoal) {
        this.robot.hitWall = false;

        if (rules.isLazy) {
          this.showThoughtProcess({
            thoughts,
            thought: '아야! 벽에 쿵 박았어! 😵 "알아서 가" 말고 어느 방향으로 돌아갈지 알려줘!',
            isThinking: false
          });
          break;
        }

        if (i < queue.length - 1) {
          this.showThoughtProcess({
            thoughts,
            thought: '앗, 앞에 벽이 있네! 🧱 바로 다음 지시대로 방향을 틀어볼게! 🏃💨',
            isThinking: false
          });
          continue;
        }

        if (!hasReroutedWall) {
          hasReroutedWall = true;
          const detourManeuvers = this.ai.rerouteAfterWallBump(
            preset,
            { x: this.robot.gridPos.x, z: this.robot.gridPos.z, dir: this.robot.dirIndex },
            rules
          );

          if (detourManeuvers.length > 0) {
            thoughts = [...thoughts.slice(0, 3), '눈앞 벽 감지 → 옆 칸으로 살짝 비켜가기!'];
            this.showThoughtProcess({
              thoughts,
              thought: '앗, 앞에 벽이 막고 있네! 🧱 옆으로 살짝 비켜서 가볼게! 🏃💨',
              isThinking: false
            });
            queue.push(...detourManeuvers);
            detourManeuvers.forEach((dm) => {
              const badge = document.createElement('span');
              badge.className = 'action-badge';
              badge.textContent = dm.label;
              this.actionBadgesEl.appendChild(badge);
            });
            continue;
          }
        }
      }

      if (this.robot.isDead) {
        const reason = this.robot.lastFailReason;
        if (reason === 'spike') {
          this.showSpeechBubble('으악! 가시에 찔렸어... 💥 (가시도 피하라고 말해줘!)');
          this.showToast(
            `${actorLabel} - 가시 함정에 걸렸어! 💥`,
            "프롬프트에 '가시를 피하거나 뛰어넘으라'고 자연어로 알려줘!",
            true
          );
        } else if (reason === 'lava') {
          this.showSpeechBubble('앗 뜨거!! 용암에 빠졌어... 🔥');
          this.showToast(
            `${actorLabel} - 용암에 빠졌어! 🔥`,
            "프롬프트에 '파란 점프대를 밟고 용암을 뛰어넘으라'고 지시해봐!",
            true
          );
        } else {
          this.showSpeechBubble('으아아~ 낭떠러지로 떨어졌어! 🕳️');
          this.showToast(
            `${actorLabel} - 낭떠러지 추락! 🕳️`,
            '바닥이 없는 구간을 피해 점프대를 이용하라고 알려줘!',
            true
          );
        }
        this.gameStatusEl.textContent = `${actorLabel}: 파괴됨!`;
        break;
      }
    }

    if (!this.robot.isDead && !this.robot.isGoal && this.robot.lastFailReason !== 'wall') {
      const failBubble = rules.isLazy
        ? '에구, 어디로 가야 할지 몰라서 멈췄어! 😵 방향이랑 장애물 피하는 법을 구체적으로 알려줘!'
        : '어라? 지시한 동작을 마쳤는데 아직 보석까지 안 닿았어!';
      const failToastDesc = rules.isLazy
        ? "'알아서 가' 대신 어느 쪽으로 돌지, 무엇을 뛰어넘을지 순서대로 알려줘!"
        : "'보석(목적지)까지 가라'는 내용과 방향/장애물 대처법을 함께 말해봐!";

      this.showThoughtProcess({
        thoughts,
        thought: failBubble,
        isThinking: false
      });
      this.gameStatusEl.textContent = `${actorLabel}: 목적지 미도달`;
      this.showToast(`${actorLabel} - 미도달!`, failToastDesc, true);
    }
  }

  renderActionBadges(actions) {
    this.actionBadgesEl.innerHTML = '';
    actions.forEach((action) => {
      const badge = document.createElement('span');
      badge.className = 'action-badge';
      badge.textContent = action;
      this.actionBadgesEl.appendChild(badge);
    });
  }

  clearActionBadges() {
    this.actionBadgesEl.innerHTML =
      '<span class="badge-empty">명령을 입력하면 계획이 표시돼.</span>';
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  showThoughtProcess({ thoughts = [], thought = '', isThinking = false }) {
    this.speechBubble.classList.remove('hidden');
    this.speechBubble.classList.toggle('thinking', isThinking);

    const headerHtml = isThinking
      ? `<div class="bubble-header"><span>💭 로봇의 생각 과정 (${thoughts.length}단계)</span><span class="thinking-dots">계획 수립</span></div>`
      : `<div class="bubble-header"><span>🤖 로봇의 행동 계획</span><span>출발!</span></div>`;

    const stepsHtml =
      thoughts.length > 0
        ? `<ul class="thought-steps">${thoughts
            .map(
              (step, idx) =>
                `<li class="thought-step"><span class="thought-step-icon">${idx + 1}.</span><span>${this.escapeHtml(step)}</span></li>`
            )
            .join('')}</ul>`
        : '';

    const finalHtml = thought
      ? `<div class="thought-final"><span>💡</span><span>${this.escapeHtml(thought)}</span></div>`
      : '';

    this.bubbleText.innerHTML = `${headerHtml}${stepsHtml}${finalHtml}`;
  }

  showSpeechBubble(text) {
    this.speechBubble.classList.remove('thinking');
    this.bubbleText.innerHTML = `<div class="bubble-single">${this.escapeHtml(text)}</div>`;
    this.speechBubble.classList.remove('hidden');
  }

  hideSpeechBubble() {
    this.speechBubble.classList.add('hidden');
  }

  showApiBanner(text, isError = true) {
    if (!this.apiBanner) return;
    this.apiBannerText.textContent = text;
    this.apiBanner.className = `api-banner ${isError ? '' : 'success'}`;
    this.apiBanner.classList.remove('hidden');
  }

  hideApiBanner() {
    if (!this.apiBanner) return;
    this.apiBanner.classList.add('hidden');
  }

  showToast(title, body, isFail = false) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTitle.textContent = title;
    this.toastBody.textContent = body;
    this.toast.className = `toast ${isFail ? 'fail' : ''}`;
    this.toast.classList.remove('hidden');

    const duration = isFail ? 5500 : 3500;
    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, duration);
  }

  hideToast() {
    this.toast.classList.add('hidden');
  }

  updateBubblePosition() {
    if (this.speechBubble.classList.contains('hidden')) return;

    const headWorldPos = new THREE.Vector3();
    this.robot.group.getWorldPosition(headWorldPos);
    headWorldPos.y += 1.3;

    headWorldPos.project(this.camera);

    const x = (headWorldPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(headWorldPos.y * 0.5) + 0.5) * window.innerHeight;

    this.speechBubble.style.left = `${x}px`;
    this.speechBubble.style.top = `${y}px`;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    this.map.update(delta);
    this.robot.update(delta);
    this.updateBubblePosition();

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
