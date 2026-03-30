export class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.7;

    // Music
    this.musicBuffer = null;
    this.musicSource = null;
    this.musicGain = null;
    this.musicVolume = 0.38;
    this._musicLoading = null;
  }

  init() {
    if (this.context) return;

    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.context.destination);
    } catch (error) {
      console.warn('Web Audio API not available:', error);
    }
  }

  async resume() {
    this.init();
    if (!this.context || !this.enabled) return;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // vol: 0 = mute, 0.5 = half, 1 = full
  setVolumeState(vol) {
    const sfxVol = vol * 0.7;
    const musicVol = vol * 0.38;
    if (this.masterGain) this.masterGain.gain.value = sfxVol;
    if (this.musicGain) this.musicGain.gain.value = musicVol;
    this.volume = sfxVol;
    this.musicVolume = musicVol;
    this.enabled = vol > 0;
  }

  playLineClear(result) {
    if (!result || result.linesCleared <= 0) return;

    if (result.isPerfectClear) {
      this._playSequence([640, 960, 1280, 1680], {
        type: 'triangle',
        stepMs: 45,
        durationMs: 280,
        volume: 0.12,
        slide: 1.08
      });
      this._playTone(240, {
        type: 'sine',
        durationMs: 520,
        volume: 0.08,
        slideTo: 480
      });
      return;
    }

    if (result.isTSpin) {
      this._playSequence([380, 520, 760], {
        type: 'square',
        stepMs: 55,
        durationMs: 200,
        volume: 0.11,
        slide: 1.15
      });
      return;
    }

    const normalFrequencies = {
      1: [360, 420],
      2: [380, 500, 620],
      3: [420, 560, 720],
      4: [460, 640, 880]
    };

    this._playSequence(normalFrequencies[result.linesCleared] || [420, 560], {
      type: result.linesCleared >= 4 ? 'sawtooth' : 'square',
      stepMs: 45,
      durationMs: 180,
      volume: 0.1,
      slide: 1.08
    });
  }

  playCombo(combo) {
    if (combo <= 0) return;

    const tones = [];
    const count = Math.min(combo + 1, 5);
    for (let i = 0; i < count; i++) {
      tones.push(540 + i * 90);
    }

    this._playSequence(tones, {
      type: 'triangle',
      stepMs: 35,
      durationMs: 120,
      volume: 0.06
    });
  }

  playBonus(kind) {
    switch (kind) {
      case 'ironWell':
        this._playSequence([220, 280, 340, 420], {
          type: 'square',
          stepMs: 40,
          durationMs: 180,
          volume: 0.1,
          slide: 1.1
        });
        break;
      case 'blackout':
        this._playTone(180, {
          type: 'sawtooth',
          durationMs: 420,
          volume: 0.09,
          slideTo: 90
        });
        this._playTone(960, {
          type: 'square',
          durationMs: 180,
          volume: 0.05
        });
        break;
      case 'phaseShift':
        this._playSequence([320, 480, 720, 960], {
          type: 'sawtooth',
          stepMs: 35,
          durationMs: 220,
          volume: 0.11,
          slide: 1.16
        });
        this._playTone(140, {
          type: 'triangle',
          durationMs: 600,
          volume: 0.05,
          slideTo: 260
        });
        break;
    }
  }

  playGarbageAlert(lines = 1) {
    const intensity = Math.min(1 + lines * 0.12, 1.8);
    this._playTone(110, {
      type: 'sawtooth',
      durationMs: 220,
      volume: 0.07 * intensity,
      slideTo: 80
    });
  }

  playCountdown(value) {
    const freq = value <= 1 ? 960 : 720;
    this._playTone(freq, {
      type: 'square',
      durationMs: 120,
      volume: 0.07
    });
  }

  async playUiConfirm() {
    await this.resume();
    this._playSequence([520, 720], {
      type: 'triangle',
      stepMs: 30,
      durationMs: 100,
      volume: 0.05
    });
  }

  // --- Background Music ---

  async loadMusic() {
    if (this.musicBuffer || this._musicLoading) return;

    this._musicLoading = (async () => {
      try {
        const response = await fetch('/background.mp3');
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        this.init();
        if (!this.context) return;
        this.musicBuffer = await this.context.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn('[Audio] Could not load background music:', e);
      }
    })();

    await this._musicLoading;
  }

  async startMusic() {
    await this.loadMusic();
    if (!this.musicBuffer || !this.context) return;

    this.stopMusic(true); // immediate stop, no fade

    this.musicGain = this.context.createGain();
    this.musicGain.gain.setValueAtTime(0, this.context.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, this.context.currentTime + 1.5);
    this.musicGain.connect(this.context.destination);

    this.musicSource = this.context.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.playbackRate.value = 1.0;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start(0);
  }

  setMusicLevel(level) {
    if (!this.musicSource) return;
    // Speed up like original Tetris: level 1 = 1.0x, level 15 = ~1.5x
    const rate = Math.min(1.0 + (level - 1) * 0.034, 1.5);
    this.musicSource.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.8);
  }

  stopMusic(immediate = false) {
    if (!this.musicSource) return;

    const src = this.musicSource;
    const gain = this.musicGain;
    this.musicSource = null;
    this.musicGain = null;

    if (immediate || !gain) {
      try { src.stop(); } catch (_) {}
      return;
    }

    // Fade out over 1 second
    gain.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
    setTimeout(() => {
      try { src.stop(); } catch (_) {}
    }, 1200);
  }

  _playSequence(frequencies, options = {}) {
    if (!frequencies.length) return;
    const stepMs = options.stepMs ?? 40;
    frequencies.forEach((frequency, index) => {
      this._playTone(frequency, {
        ...options,
        whenMs: (options.whenMs ?? 0) + index * stepMs,
        slideTo: options.slide ? frequency * options.slide : options.slideTo
      });
    });
  }

  _playTone(frequency, options = {}) {
    if (!this.context || !this.masterGain || !this.enabled) return;

    const now = this.context.currentTime + (options.whenMs ?? 0) / 1000;
    const duration = (options.durationMs ?? 140) / 1000;
    const attack = options.attack ?? 0.005;
    const release = options.release ?? 0.14;
    const sustainEnd = now + Math.max(duration - release, attack);
    const stopAt = sustainEnd + release;

    const oscillator = this.context.createOscillator();
    oscillator.type = options.type ?? 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, options.slideTo),
        now + duration
      );
    }

    const gain = this.context.createGain();
    const volume = options.volume ?? 0.08;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.setValueAtTime(volume, sustainEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(stopAt);
  }
}
