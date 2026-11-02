// Web Audio API 기반의 절차적 사운드 효과 & BGM 엔진
// 외부 mp3 파일 없이도 즉각적이고 귀여운 레트로 파티 사운드를 재생합니다.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.bgmEnabled = false;
    this.masterVolume = 0.5;
    this.bgmInterval = null;
    this.bgmGain = null;
    this.isBgmPlaying = false;

    // Stable Audio 기반 고품질 오디오 버퍼 캐시
    this.audioBuffers = new Map();
    this.soundFiles = {
      jump: 'assets/sounds/jump.wav',
      land: 'assets/sounds/land.wav',
      bonk: 'assets/sounds/bonk.wav',
      iceslide: 'assets/sounds/iceslide.wav',
      mine: 'assets/sounds/mine.wav',
      portal: 'assets/sounds/portal.wav',
      goal: 'assets/sounds/goal.wav',
      fall: 'assets/sounds/fall.wav',
      conveyor: 'assets/sounds/conveyor.wav',
      crumble: 'assets/sounds/crumble.wav',
      spike: 'assets/sounds/spike.wav',
      lava: 'assets/sounds/lava.wav',
      fanfare: 'assets/sounds/fanfare.wav',
    };
    this._preloadStarted = false;

    // 첫 인터랙션 시 자동 AudioContext resume 및 에셋 프리로드
    this._initOnInteraction = this._initOnInteraction.bind(this);
    window.addEventListener('click', this._initOnInteraction, { once: true });
    window.addEventListener('keydown', this._initOnInteraction, { once: true });
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.ctx && !this._preloadStarted) {
      this.preloadSounds();
    }
  }

  _initOnInteraction() {
    this._initContext();
  }

  async preloadSounds() {
    if (!this.ctx || this._preloadStarted) return;
    this._preloadStarted = true;
    for (const [key, url] of Object.entries(this.soundFiles)) {
      this._loadSound(key, url);
    }
  }

  async _loadSound(key, url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      const arrayBuf = await resp.arrayBuffer();
      if (!this.ctx) return;
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.audioBuffers.set(key, audioBuf);
    } catch (e) {
      // 로드 실패 시 무시하고 신디사이저 사운드로 폴백
    }
  }

  playBuffer(key, volumeScale = 1.0, playbackRate = 1.0) {
    if (!this.sfxEnabled) return false;
    this._initContext();
    if (!this.ctx) return false;
    const buf = this.audioBuffers.get(key);
    if (!buf) return false;

    try {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buf;
      source.playbackRate.value = playbackRate;
      gain.gain.setValueAtTime(volumeScale * this.masterVolume, this.ctx.currentTime);
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainValue = 0.3, pitchSlide = 0) {
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchSlide !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchSlide), now + duration);
      }

      gain.gain.setValueAtTime(gainValue * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // 오디오 에러 무시
    }
  }

  // 발걸음 (통통 튀는 귀여운 팝)
  playFootstep() {
    if (this.playBuffer('land', 0.12, 1.4 + Math.random() * 0.4)) return;
    const pitch = 220 + Math.random() * 80;
    this.playTone(pitch, 'triangle', 0.08, 0.15, -60);
  }

  // 점프 (피요옹~!)
  playJump() {
    if (this.playBuffer('jump', 0.65, 0.95 + Math.random() * 0.1)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.22);

      gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  // 점프대 팡!
  playJumpPad() {
    if (this.playBuffer('jump', 0.85, 1.35)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);

      gain.gain.setValueAtTime(0.45 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {}
  }

  // 착지 (톡!)
  playLand() {
    if (this.playBuffer('land', 0.5, 0.95 + Math.random() * 0.1)) return;
    this.playTone(180, 'sine', 0.1, 0.25, -70);
  }

  // 얼음 미끄러짐 (샤아악~!)
  playIceSlide() {
    if (this.playBuffer('iceslide', 0.6)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.28);

      gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {}
  }

  // 워프 포탈 (뾰로롱~ 순간이동)
  playPortal() {
    if (this.playBuffer('portal', 0.7)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.32);

      gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // 컨베이어 벨트 (위잉~ 밀림)
  playConveyor() {
    if (this.playBuffer('conveyor', 0.6)) return;
    this.playTone(280, 'sawtooth', 0.18, 0.2, 100);
  }

  // 바닥 무너짐 (와르르)
  playCrumble() {
    if (this.playBuffer('crumble', 0.7)) return;
    this.playTone(110, 'triangle', 0.22, 0.4, -60);
  }

  // 지뢰 폭발 (삐- 쾅!)
  playMine() {
    if (this.playBuffer('mine', 0.85)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. 경고 비프
      const oscWarn = this.ctx.createOscillator();
      const gainWarn = this.ctx.createGain();
      oscWarn.type = 'square';
      oscWarn.frequency.setValueAtTime(1100, now);
      gainWarn.gain.setValueAtTime(0.3 * this.masterVolume, now);
      gainWarn.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      oscWarn.connect(gainWarn);
      gainWarn.connect(this.ctx.destination);
      oscWarn.start(now);
      oscWarn.stop(now + 0.08);

      // 2. 폭발 저음
      const oscBoom = this.ctx.createOscillator();
      const gainBoom = this.ctx.createGain();
      oscBoom.type = 'sawtooth';
      oscBoom.frequency.setValueAtTime(150, now + 0.08);
      oscBoom.frequency.exponentialRampToValueAtTime(35, now + 0.45);
      gainBoom.gain.setValueAtTime(0.55 * this.masterVolume, now + 0.08);
      gainBoom.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      oscBoom.connect(gainBoom);
      gainBoom.connect(this.ctx.destination);
      oscBoom.start(now + 0.08);
      oscBoom.stop(now + 0.45);
    } catch (e) {}
  }

  // 벽 부딪힘 (콩!)
  playBonk() {
    if (this.playBuffer('bonk', 0.65, 0.9 + Math.random() * 0.2)) return;
    this.playTone(160, 'triangle', 0.14, 0.35, -40);
  }

  // 가시 찔림 (카툰풍 삐용!)
  playSpike() {
    if (this.playBuffer('spike', 0.7)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

      gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // 용암 풍덩/화염 (치이익)
  playLava() {
    if (this.playBuffer('lava', 0.7)) return;
    this.playTone(120, 'sawtooth', 0.35, 0.3, -80);
  }

  // 낭떠러지 추락 (휘우우~)
  playFall() {
    if (this.playBuffer('fall', 0.75)) return;
    if (!this.sfxEnabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);

      gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch (e) {}
  }

  // 골인/보석 획득 (챠라라랑~ 영롱한 아르페지오)
  playGoal() {
    if (this.playBuffer('goal', 0.8)) return;
    if (!this.sfxEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.28);
      }, idx * 75);
    });
  }

  // 타이머 째깍째깍 (마지막 5초 카운트다운)
  playTick(isAlert = false) {
    if (isAlert) {
      this.playTone(880, 'sine', 0.12, 0.3);
    } else {
      this.playTone(440, 'triangle', 0.06, 0.15);
    }
  }

  // 라운드 승리 팡파레
  playFanfare() {
    if (this.playBuffer('fanfare', 0.85)) return;
    if (!this.sfxEnabled) return;
    const melody = [
      { note: 523.25, delay: 0, dur: 0.12 },
      { note: 523.25, delay: 140, dur: 0.12 },
      { note: 523.25, delay: 280, dur: 0.12 },
      { note: 659.25, delay: 420, dur: 0.24 },
      { note: 523.25, delay: 680, dur: 0.14 },
      { note: 783.99, delay: 840, dur: 0.45 }
    ];
    melody.forEach(m => {
      setTimeout(() => {
        this.playTone(m.note, 'triangle', m.dur, 0.35);
      }, m.delay);
    });
  }

  // 귀여운 칩튠 BGM 루퍼
  toggleBgm() {
    this._initContext();
    this.bgmEnabled = !this.bgmEnabled;

    if (this.bgmEnabled) {
      this.startBgm();
      return true;
    } else {
      this.stopBgm();
      return false;
    }
  }

  startBgm() {
    if (!this.ctx || this.isBgmPlaying) return;
    this.isBgmPlaying = true;

    // 밝고 아기자기한 120BPM 칩튠 아르페지오 멜로디 시퀀스
    // C - G - Am - F 풍의 귀여운 루프
    const pattern = [
      261.63, 329.63, 392.00, 523.25,
      196.00, 246.94, 293.66, 392.00,
      220.00, 261.63, 329.63, 440.00,
      174.61, 220.00, 261.63, 349.23
    ];
    let step = 0;
    const stepDuration = 180; // ms

    this.bgmInterval = setInterval(() => {
      if (!this.bgmEnabled || !this.ctx) return;
      try {
        const freq = pattern[step % pattern.length];
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 부드러운 칩튠 펄스/트라이앵글
        osc.type = (step % 4 === 0) ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq * 1.5, now);

        // 아주 편안한 배경 볼륨 (0.05)
        gain.gain.setValueAtTime(0.05 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}

      step++;
    }, stepDuration);
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundManager = new SoundManager();
