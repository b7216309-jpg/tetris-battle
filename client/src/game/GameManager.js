import * as THREE from 'three';
import { TetrisEngine } from '@server/game/TetrisEngine.js';
import { BoardRenderer } from '../scene/BoardRenderer.js';
import { InputHandler } from './InputHandler.js';
import { SocketClient } from '../network/SocketClient.js';
import { Effects } from '../scene/Effects.js';
import { AudioManager } from '../audio/AudioManager.js';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BUFFER_ZONE,
  LOCK_DELAY,
  BONUS_LOCK_DELAY_BOOST_MS,
  BONUS_GARBAGE_DELAY_BOOST_MS,
  DEFAULT_ROOM_OPTIONS
} from '@shared/constants.js';

const SOLO_BOARD_OFFSET_X = 6;
const VERSUS_BOARD_OFFSET_X = 13;
const SOLO_CAMERA_Z = 28;
const VERSUS_CAMERA_Z = 46;

const PLAYER_NEON = 0x00f0f0;
const OPPONENT_NEON = 0xf040a0;

export class GameManager {
  constructor(scene, camera, renderer, groundMaterial) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.groundMaterial = groundMaterial || null;

    // State machine: MENU, ONLINE_MENU, WAITING, ROOM_LOBBY, COUNTDOWN, PLAYING, GAME_OVER
    this.state = 'MENU';

    // Local engine
    this.localEngine = null;

    // Renderers for both boards
    this.playerBoard = null;
    this.opponentBoard = null;

    // Accent lights
    this.accentLights = [];

    // Effects
    this.effects = new Effects(scene);
    this.audio = new AudioManager();

    // Input
    this.inputHandler = new InputHandler();

    // Network
    this.socketClient = new SocketClient();
    this._setupNetworkCallbacks();

    // Multiplayer state
    this.isMultiplayer = false;
    this.pendingInputs = [];
    this.inputSequence = 0;
    this.opponentState = null;
    this.opponentEffects = null;
    this.pendingGarbage = 0;
    this.effectState = this._createEffectState();

    // Room state
    this.roomCode = null;
    this.isHost = false;
    this.roomOptions = { ...DEFAULT_ROOM_OPTIONS };
    this.hostReady = false;
    this.guestReady = false;
    this.hasGuest = false;

    // UI callbacks
    this.onStateChange = null;
    this.onAttack = null;
    this.onBonusEvent = null;
    this.onEffectsUpdate = null;
    this.onGameOver = null;
    this.onStatsUpdate = null;
    this.onOpponentStatsUpdate = null;
    this.onHudPositionUpdate = null;

    // Countdown
    this.countdownTimer = 0;
    this.countdownValue = 3;

    // Stats cache
    this._lastStats = null;
    this._lastEffectSnapshot = '';
  }

  // --- Game Start ---

  startSolo() {
    void this.audio.resume();
    void this.audio.playUiConfirm();
    void this.audio.loadMusic();
    this.isMultiplayer = false;
    this._setCameraLayout(false);
    this._resetEffectState();
    this.inputHandler.detach();
    this._initGame(Date.now());
    this.state = 'PLAYING';
    this.inputHandler.attach();
    void this.audio.startMusic();
    this._notifyStateChange();
    this._emitHudPositions();
  }

  showOnlineMenu() {
    void this.audio.resume();
    void this.audio.playUiConfirm();
    void this.audio.loadMusic(); // preload while user is in menu
    this.state = 'ONLINE_MENU';
    this._notifyStateChange();
  }

  startQuickMatch() {
    void this.audio.playUiConfirm();
    this.isMultiplayer = true;
    this._setCameraLayout(true);
    this._resetEffectState();
    this.inputHandler.detach();
    this.state = 'WAITING';
    this.socketClient.connect();
    this.socketClient.joinLobby();
    this._notifyStateChange();
  }

  startMultiplayer() {
    this.startQuickMatch();
  }

  createRoom() {
    void this.audio.playUiConfirm();
    this.isMultiplayer = true;
    this.isHost = true;
    this.roomCode = null;
    this.roomOptions = { ...DEFAULT_ROOM_OPTIONS };
    this.hostReady = false;
    this.guestReady = false;
    this.hasGuest = false;
    this.socketClient.connect();
    this.socketClient.createRoom();
  }

  joinRoom(code) {
    void this.audio.playUiConfirm();
    this.isMultiplayer = true;
    this.isHost = false;
    this.roomCode = null;
    this.roomOptions = { ...DEFAULT_ROOM_OPTIONS };
    this.hostReady = false;
    this.guestReady = false;
    this.hasGuest = false;
    this.socketClient.connect();
    this.socketClient.joinRoom(code);
  }

  leaveRoom() {
    this.socketClient.leaveRoom();
    this.socketClient.disconnect();
    this._resetRoomState();
    this.state = 'ONLINE_MENU';
    this._notifyStateChange();
  }

  cancelGame() {
    this.inputHandler.detach();
    this.socketClient.cancelMatchmaking();
    this.socketClient.disconnect();
    this._setCameraLayout(false);
    this._resetRoomState();
    this.state = 'ONLINE_MENU';
    this._notifyStateChange();
  }

  returnToMenu() {
    this.destroy();
    this._setCameraLayout(false);
    this._resetRoomState();
    this.state = 'MENU';
    this._notifyStateChange();
  }

  _resetRoomState() {
    this.roomCode = null;
    this.isHost = false;
    this.roomOptions = { ...DEFAULT_ROOM_OPTIONS };
    this.hostReady = false;
    this.guestReady = false;
    this.hasGuest = false;
  }

  _initGame(seed, options = {}) {
    if (this.playerBoard) this.playerBoard.dispose();
    if (this.opponentBoard) this.opponentBoard.dispose();
    this._removeAccentLights();

    this.localEngine = new TetrisEngine(seed, {
      startingLevel: options.startingLevel || this.roomOptions.startingLevel || 1
    });
    this.localEngine.spawnPiece();

    const boardOffsetX = this.isMultiplayer ? VERSUS_BOARD_OFFSET_X : SOLO_BOARD_OFFSET_X;
    this.playerBoard = new BoardRenderer(this.scene, -boardOffsetX, false, this.isMultiplayer);

    if (this.isMultiplayer) {
      this.opponentBoard = new BoardRenderer(this.scene, boardOffsetX, true, true);
    } else {
      this.opponentBoard = null;
    }

    this._createAccentLights(boardOffsetX);

    this.pendingInputs = [];
    this.inputSequence = 0;
    this.opponentState = null;
    this.opponentEffects = null;
    this.pendingGarbage = 0;
    this._lastStats = null;
    this._syncLocalEffects();
    this._emitEffectsUpdate(true);
  }

  _createAccentLights(boardOffsetX) {
    // Player accent — cyan glow behind board
    const playerLight = new THREE.PointLight(PLAYER_NEON, 0.9, 35, 1.5);
    playerLight.position.set(-boardOffsetX + BOARD_WIDTH / 2, BOARD_HEIGHT / 2, -4);
    this.scene.add(playerLight);
    this.accentLights.push(playerLight);

    if (this.isMultiplayer) {
      // Opponent accent — magenta glow
      const opponentLight = new THREE.PointLight(OPPONENT_NEON, 0.9, 35, 1.5);
      opponentLight.position.set(boardOffsetX + BOARD_WIDTH / 2, BOARD_HEIGHT / 2, -4);
      this.scene.add(opponentLight);
      this.accentLights.push(opponentLight);
    }
  }

  _removeAccentLights() {
    for (const light of this.accentLights) {
      this.scene.remove(light);
      light.dispose();
    }
    this.accentLights = [];
  }

  _setCameraLayout(isMultiplayer) {
    const z = isMultiplayer ? VERSUS_CAMERA_Z : SOLO_CAMERA_Z;
    const x = isMultiplayer ? BOARD_WIDTH / 2 : 0;
    this.camera.position.set(x, 10, z);
    this.camera.lookAt(x, 10, 0);
  }

  _createEffectState() {
    return {
      stableGarbageLines: 0,
      previewMaskedUntil: 0,
      phaseShiftUntil: 0,
      lockDelayBoostMs: BONUS_LOCK_DELAY_BOOST_MS,
      incomingDelayBoostMs: BONUS_GARBAGE_DELAY_BOOST_MS
    };
  }

  _resetEffectState() {
    this.effectState = this._createEffectState();
    this._lastEffectSnapshot = '';
    this._syncLocalEffects();
    this._emitEffectsUpdate(true);
  }

  _getEffectSnapshot() {
    const now = Date.now();
    const quantizeMs = (value) => {
      if (value <= 0) return 0;
      return Math.ceil(value / 100) * 100;
    };
    const phaseShiftMs = Math.max(0, this.effectState.phaseShiftUntil - now);

    return {
      stableGarbageLines: this.effectState.stableGarbageLines,
      previewMaskedMs: quantizeMs(Math.max(0, this.effectState.previewMaskedUntil - now)),
      phaseShiftMs: quantizeMs(phaseShiftMs),
      lockDelayBoostMs: phaseShiftMs > 0 ? this.effectState.lockDelayBoostMs : 0,
      incomingDelayBoostMs: phaseShiftMs > 0 ? this.effectState.incomingDelayBoostMs : 0
    };
  }

  _emitEffectsUpdate(force = false) {
    if (!this.onEffectsUpdate) return;

    const snapshot = this._getEffectSnapshot();
    const key = JSON.stringify(snapshot);
    if (!force && key === this._lastEffectSnapshot) return;

    this._lastEffectSnapshot = key;
    this.onEffectsUpdate(snapshot);
  }

  _applyEffectsPayload(effects = {}) {
    const now = Date.now();
    this.effectState.stableGarbageLines = effects.stableGarbageLines ?? 0;
    this.effectState.previewMaskedUntil = now + (effects.previewMaskedMs ?? 0);
    this.effectState.phaseShiftUntil = now + (effects.phaseShiftMs ?? 0);
    this.effectState.lockDelayBoostMs =
      effects.lockDelayBoostMs ?? BONUS_LOCK_DELAY_BOOST_MS;
    this.effectState.incomingDelayBoostMs =
      effects.incomingDelayBoostMs ?? BONUS_GARBAGE_DELAY_BOOST_MS;

    this._syncLocalEffects();
    this._emitEffectsUpdate();
  }

  _applyBonusEvent(event) {
    const now = Date.now();

    if (event.stableGarbageLines !== undefined) {
      this.effectState.stableGarbageLines = event.stableGarbageLines;
    }

    if (event.previewMaskedMs) {
      this.effectState.previewMaskedUntil = Math.max(
        this.effectState.previewMaskedUntil,
        now + event.previewMaskedMs
      );
    }

    if (event.durationMs && (event.lockDelayBoostMs || event.incomingDelayBoostMs)) {
      this.effectState.phaseShiftUntil = Math.max(
        this.effectState.phaseShiftUntil,
        now + event.durationMs
      );
      this.effectState.lockDelayBoostMs =
        event.lockDelayBoostMs ?? this.effectState.lockDelayBoostMs;
      this.effectState.incomingDelayBoostMs =
        event.incomingDelayBoostMs ?? this.effectState.incomingDelayBoostMs;
    }

    this._syncLocalEffects();
    this._emitEffectsUpdate(true);

    if (this.onBonusEvent) {
      this.onBonusEvent(event);
    }

    this.audio.playBonus(event.kind);
    this._spawnBonusFeedback(event.kind, event.positive !== false);
  }

  _syncLocalEffects() {
    if (!this.localEngine) return;

    const phaseShiftActive = Date.now() < this.effectState.phaseShiftUntil;
    const lockDelayMs = LOCK_DELAY + (phaseShiftActive ? this.effectState.lockDelayBoostMs : 0);
    this.localEngine.setLockDelayMs(lockDelayMs);
  }

  _isPreviewMasked() {
    return Date.now() < this.effectState.previewMaskedUntil;
  }

  _isOpponentPreviewMasked() {
    return Boolean(this.opponentEffects && this.opponentEffects.previewMaskedMs > 0);
  }

  // --- HUD Positioning ---

  getHudPositions() {
    if (!this.playerBoard) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const project = (worldX, worldY) => {
      const v = new THREE.Vector3(worldX, worldY, 0);
      v.project(this.camera);
      return {
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h
      };
    };

    const pOff = this.playerBoard.offsetX;
    const playerLeft = project(pOff, BOARD_HEIGHT);
    const playerRight = project(pOff + BOARD_WIDTH, BOARD_HEIGHT);
    const playerBottom = project(pOff, 0);

    const result = {
      isVersus: this.isMultiplayer,
      player: {
        left: playerLeft.x,
        right: playerRight.x,
        top: playerLeft.y,
        bottom: playerBottom.y
      }
    };

    if (this.opponentBoard) {
      const oOff = this.opponentBoard.offsetX;
      const oppLeft = project(oOff, BOARD_HEIGHT);
      const oppRight = project(oOff + BOARD_WIDTH, BOARD_HEIGHT);
      const oppBottom = project(oOff, 0);
      result.opponent = {
        left: oppLeft.x,
        right: oppRight.x,
        top: oppLeft.y,
        bottom: oppBottom.y
      };
    }

    return result;
  }

  _emitHudPositions() {
    if (this.onHudPositionUpdate) {
      const pos = this.getHudPositions();
      if (pos) this.onHudPositionUpdate(pos);
    }
  }

  // --- Main Update Loop ---

  update(time, deltaMs) {
    // Animate ground shader
    if (this.groundMaterial && this.groundMaterial.uniforms) {
      this.groundMaterial.uniforms.uTime.value = time * 0.001;
    }

    switch (this.state) {
      case 'COUNTDOWN':
        this._updateCountdown(deltaMs);
        break;

      case 'PLAYING':
        this._updatePlaying(deltaMs);
        break;
    }

    this.effects.update(deltaMs);
    this._renderBoards();
  }

  _updateCountdown(deltaMs) {
    this.countdownTimer -= deltaMs;
    const newValue = Math.ceil(this.countdownTimer / 1000);
    if (newValue !== this.countdownValue) {
      this.countdownValue = newValue;
      this.audio.playCountdown(Math.max(1, newValue));
      this._notifyStateChange();
    }
    if (this.countdownTimer <= 0) {
      this.state = 'PLAYING';
      this.inputHandler.attach();
      void this.audio.startMusic();
      this._notifyStateChange();
      this._emitHudPositions();
    }
  }

  _updatePlaying(deltaMs) {
    if (!this.localEngine || !this.localEngine.isAlive) return;

    this._syncLocalEffects();
    this._emitEffectsUpdate();

    this.inputHandler.update(deltaMs);
    const actions = this.inputHandler.getActions();

    for (const action of actions) {
      this._processAction(action);
    }

    this.localEngine.updateGravity(deltaMs);

    const lockResult = this.localEngine.updateLockDelay(deltaMs);
    if (lockResult) {
      this._handleLockResult(lockResult);
    }

    if (!this.localEngine.isAlive) {
      this.state = 'GAME_OVER';
      this.inputHandler.detach();
      if (this.onGameOver) this.onGameOver(false);
      this._notifyStateChange();
    }

    if (this.onStatsUpdate) {
      const s = this.localEngine;
      const stats = {
        score: s.score,
        level: s.level,
        lines: s.linesCleared,
        combo: s.combo,
        backToBack: s.backToBack
      };

      if (!this._lastStats ||
          this._lastStats.score !== stats.score ||
          this._lastStats.level !== stats.level ||
          this._lastStats.lines !== stats.lines ||
          this._lastStats.combo !== stats.combo) {
        if (!this._lastStats || this._lastStats.level !== stats.level) {
          this.audio.setMusicLevel(stats.level);
        }
        this._lastStats = stats;
        this.onStatsUpdate(stats);
      }
    }
  }

  _processAction(action, options = {}) {
    if (!this.localEngine || !this.localEngine.isAlive) return;
    const {
      sendNetwork = this.isMultiplayer,
      emitFeedback = true,
      resumeAudio = true
    } = options;

    if (resumeAudio) {
      void this.audio.resume();
    }

    let lockResult = null;

    switch (action.type) {
      case 'move':
        this.localEngine.movePiece(action.dx, 0);
        if (sendNetwork) this._sendInput(action);
        break;

      case 'moveToWall': {
        let moved = true;
        while (moved) {
          moved = this.localEngine.movePiece(action.dx, 0);
        }
        if (sendNetwork) this._sendInput(action);
        break;
      }

      case 'rotate':
        this.localEngine.rotatePiece(action.direction);
        if (sendNetwork) this._sendInput(action);
        break;

      case 'hardDrop':
        lockResult = this.localEngine.hardDrop();
        if (sendNetwork) this._sendInput(action);
        break;

      case 'hold':
        this.localEngine.holdSwap();
        if (sendNetwork) this._sendInput(action);
        break;

      case 'softDrop':
        this.localEngine.setSoftDrop(action.active);
        if (sendNetwork) this._sendInput(action);
        break;
    }

    if (lockResult && emitFeedback) {
      this._handleLockResult(lockResult);
    }
  }

  _handleLockResult(result) {
    this._playLockFeedback(result);
    this._spawnLockFeedback(result);

    if (!this.isMultiplayer) {
      const localBonus = this._inferLocalBonusEvent(result);
      if (localBonus && this.onBonusEvent) {
        this.onBonusEvent(localBonus);
        this.audio.playBonus(localBonus.kind);
        this._spawnBonusFeedback(localBonus.kind, true);
      }
    }

    if (!this.isMultiplayer && result.attack > 0 && this.onAttack) {
      this.onAttack(result);
    }
  }

  _reconcileLocalState(snapshot, lastSequence = -1) {
    if (!this.localEngine || !snapshot) return;

    this.localEngine.loadState(snapshot);
    this.pendingInputs = this.pendingInputs.filter(
      input => input.sequence > lastSequence
    );

    for (const pending of this.pendingInputs) {
      this._processAction(pending.action, {
        sendNetwork: false,
        emitFeedback: false,
        resumeAudio: false
      });
    }
  }

  _playLockFeedback(result) {
    if (!result) return;

    this.audio.playLineClear(result);
    if (result.combo > 0) {
      this.audio.playCombo(result.combo);
    }
  }

  _spawnLockFeedback(result) {
    if (!result || !this.playerBoard) return;

    const palettes = {
      line: [0x00f0f0, 0x00f000, 0xffffff],
      tetris: [0x00f0f0, 0xf0f000, 0xffffff],
      tSpin: [0xa000f0, 0xff66cc, 0xffffff],
      perfect: [0xffffff, 0x00f0f0, 0xff99ff]
    };

    const palette = result.isPerfectClear
      ? palettes.perfect
      : result.isTSpin
        ? palettes.tSpin
        : result.linesCleared === 4
          ? palettes.tetris
          : palettes.line;

    for (const row of result.clearedRows || []) {
      if (row < BUFFER_ZONE) continue;
      const visibleRow = BOARD_HEIGHT - 1 - (row - BUFFER_ZONE);
      this.effects.spawnLineClearParticles(
        visibleRow,
        this.playerBoard.offsetX,
        palette,
        30 + result.linesCleared * 10
      );
    }

    if (result.linesCleared > 0) {
      this.effects.shakeBoard(
        this.playerBoard.group,
        0.12 + result.linesCleared * 0.04 + (result.isTSpin ? 0.05 : 0),
        220 + result.linesCleared * 40
      );
    }

    if (this.isMultiplayer && this.opponentBoard && result.attack > 0) {
      this.effects.spawnAttackEffect(
        this.playerBoard.offsetX,
        this.opponentBoard.offsetX,
        Math.max(result.attack, 1)
      );
      this.effects.spawnAttackBeam(
        this.playerBoard.offsetX,
        this.opponentBoard.offsetX,
        Math.min(result.attack / 4, 1.5)
      );
      this.effects.shakeBoard(
        this.opponentBoard.group,
        0.14 + Math.min(result.attack, 6) * 0.04,
        260
      );

      if (result.attack >= 4) {
        this.effects.shakeCamera(this.camera, 0.008, 300);
      }
    }
  }

  _inferLocalBonusEvent(result) {
    if (!result) return null;

    if (result.isPerfectClear) {
      return {
        kind: 'blackout',
        title: 'PERFECT CLEAR',
        subtitle: 'BLACKOUT CHARGED',
        positive: true
      };
    }

    if (result.clearType === 'tetris') {
      return {
        kind: 'ironWell',
        title: 'IRON WELL',
        subtitle: 'STABLE GARBAGE READY',
        positive: true
      };
    }

    if (result.clearType === 'tSpinDouble' || result.clearType === 'tSpinTriple') {
      return {
        kind: 'phaseShift',
        title: 'PHASE SHIFT',
        subtitle: 'LOCK + BUFFER BOOST',
        positive: true
      };
    }

    return null;
  }

  _spawnBonusFeedback(kind, positive = true) {
    if (!this.playerBoard) return;

    const palettes = {
      ironWell: [0xff9900, 0xffdd55, 0xff5500],
      blackout: [0xff3366, 0xa000f0, 0xffffff],
      phaseShift: [0x00f0f0, 0xa000f0, 0xffffff]
    };

    const intensity = positive ? 0.28 : 0.35;
    const palette = palettes[kind] || [0xffffff];

    this.effects.spawnBonusBurst(
      this.playerBoard.offsetX + 5,
      BOARD_HEIGHT * 0.58,
      palette,
      42
    );
    this.effects.shakeBoard(this.playerBoard.group, intensity, 320);
  }

  _sendInput(action) {
    const seq = this.inputSequence++;
    this.pendingInputs.push({ action, sequence: seq });
    this.socketClient.sendInput({ ...action, sequence: seq });
  }

  // --- Rendering ---

  _renderBoards() {
    if (this.playerBoard && this.localEngine) {
      const engine = this.localEngine;
      this.playerBoard.update(
        engine.getVisibleBoard(),
        engine.currentPiece ? {
          ...engine.currentPiece,
          row: engine.currentPiece.row - BUFFER_ZONE
        } : null,
        engine.currentPiece ? engine.getGhostY() - BUFFER_ZONE : undefined,
        engine.holdPiece,
        engine.getNextQueue(),
        this.pendingGarbage,
        this._isPreviewMasked()
      );
    }

    if (this.opponentBoard && this.opponentState) {
      this.opponentBoard.update(
        this.opponentState.board,
        this.opponentState.currentPiece,
        this.opponentState.ghostY,
        this.opponentState.holdPiece,
        this.opponentState.nextQueue,
        0,
        this._isOpponentPreviewMasked()
      );
    }
  }

  // --- Network Callbacks ---

  _setupNetworkCallbacks() {
    this.socketClient.onGameStart = (data) => {
      this._setCameraLayout(true);
      this._resetEffectState();
      this._initGame(data.seed, data.options || {});
      this.countdownTimer = 3000;
      this.countdownValue = 3;
      this.state = 'COUNTDOWN';
      this._notifyStateChange();
      this._emitHudPositions();
    };

    this.socketClient.onStateUpdate = (data) => {
      if (!this.isMultiplayer) return;

      this.opponentState = data.opponent;
      this.opponentEffects = data.opponent?.effects || null;

      if (data.opponent && this.onOpponentStatsUpdate) {
        this.onOpponentStatsUpdate({
          score: data.opponent.score || 0,
          level: data.opponent.level || 1,
          lines: data.opponent.lines || 0,
          combo: data.opponent.combo ?? -1
        });
      }

      if (data.self) {
        if (data.self.snapshot) {
          this._reconcileLocalState(data.self.snapshot, data.self.lastSequence);
        } else if (data.self.lastSequence !== undefined) {
          this.pendingInputs = this.pendingInputs.filter(
            i => i.sequence > data.self.lastSequence
          );
        }

        this.pendingGarbage = data.self.pendingGarbage || 0;
        if (data.self.effects) {
          this._applyEffectsPayload(data.self.effects);
        }
      }
    };

    this.socketClient.onGarbageIncoming = (data) => {
      this.pendingGarbage = data.totalPending || 0;
      if (data.lines > 0) {
        this.audio.playGarbageAlert(data.lines);
        if (this.playerBoard) {
          this.effects.shakeBoard(this.playerBoard.group, 0.18, 220);
        }
      }
    };

    this.socketClient.onBonus = (data) => {
      this._applyBonusEvent(data);
    };

    this.socketClient.onAttack = (data) => {
      if (this.onAttack) {
        this.onAttack(data);
      }
    };

    this.socketClient.onGameOver = (data) => {
      if (this.state === 'GAME_OVER') return;
      this.state = 'GAME_OVER';
      this.inputHandler.detach();
      const isWinner = data.winner === this.socketClient.getSocketId();
      if (this.onGameOver) this.onGameOver(isWinner);
      this._notifyStateChange();
    };

    this.socketClient.onOpponentDisconnect = () => {
      if (this.onStateChange) {
        this.onStateChange('OPPONENT_DISCONNECT', {});
      }
    };

    // Room callbacks
    this.socketClient.onRoomCreated = (data) => {
      this.roomCode = data.code;
      this.isHost = true;
      this.roomOptions = data.options;
      this.hasGuest = false;
      this.hostReady = false;
      this.guestReady = false;
      this.state = 'ROOM_LOBBY';
      this._notifyStateChange();
    };

    this.socketClient.onRoomJoined = (data) => {
      this.roomCode = data.code;
      this.isHost = false;
      this.roomOptions = data.options;
      this.hasGuest = true;
      this.hostReady = data.hostReady || false;
      this.guestReady = data.guestReady || false;
      this.state = 'ROOM_LOBBY';
      this._notifyStateChange();
    };

    this.socketClient.onPlayerJoined = (data) => {
      this.hasGuest = true;
      this.hostReady = data.hostReady || false;
      this.guestReady = data.guestReady || false;
      this._notifyStateChange();
    };

    this.socketClient.onPlayerLeft = (data) => {
      if (data.reason === 'host_left') {
        // Host left, back to online menu
        this.socketClient.disconnect();
        this._resetRoomState();
        this.state = 'ONLINE_MENU';
        this._notifyStateChange();
        return;
      }
      this.hasGuest = false;
      this.guestReady = false;
      this.hostReady = data.hostReady || false;
      this._notifyStateChange();
    };

    this.socketClient.onOptionsUpdated = (data) => {
      this.roomOptions = data.options;
      this.hostReady = data.hostReady || false;
      this.guestReady = data.guestReady || false;
      this._notifyStateChange();
    };

    this.socketClient.onReadyUpdated = (data) => {
      this.hostReady = data.hostReady || false;
      this.guestReady = data.guestReady || false;
      this._notifyStateChange();
    };

    this.socketClient.onRoomError = (data) => {
      if (this.onStateChange) {
        this.onStateChange('ROOM_ERROR', { message: data.message });
      }
    };
  }

  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.state, {
        countdown: this.countdownValue,
        roomCode: this.roomCode,
        isHost: this.isHost,
        roomOptions: this.roomOptions,
        hostReady: this.hostReady,
        guestReady: this.guestReady,
        hasGuest: this.hasGuest
      });
    }
  }

  // --- Cleanup ---

  destroy() {
    this.inputHandler.detach();
    this.socketClient.disconnect();
    this.audio.stopMusic();
    this._setCameraLayout(false);
    this._removeAccentLights();
    if (this.playerBoard) this.playerBoard.dispose();
    if (this.opponentBoard) this.opponentBoard.dispose();
    this.playerBoard = null;
    this.opponentBoard = null;
    this.localEngine = null;
    this.opponentState = null;
    this.opponentEffects = null;
    this.pendingInputs = [];
    this.pendingGarbage = 0;
    this._resetEffectState();
  }
}
