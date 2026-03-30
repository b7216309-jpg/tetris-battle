import { TetrisEngine } from './TetrisEngine.js';
import { GarbageSystem } from './GarbageSystem.js';
import {
  SERVER_TICK_MS,
  BOARD_WIDTH,
  GARBAGE_DELAY,
  LOCK_DELAY,
  BONUS_IRON_WELL_LINES,
  BONUS_BLACKOUT_DURATION_MS,
  BONUS_PHASE_SHIFT_DURATION_MS,
  BONUS_LOCK_DELAY_BOOST_MS,
  BONUS_GARBAGE_DELAY_BOOST_MS,
  DEFAULT_ROOM_OPTIONS,
  GARBAGE_DELAY_VALUES
} from '@tetris/shared';

const COUNTDOWN_MS = 3000;
const DISCONNECT_TIMEOUT = 10000;
const STATE_BROADCAST_INTERVAL = 50; // ~20Hz for opponent board

export class GameRoom {
  constructor(roomId, socket1, socket2, io, options = {}) {
    this.roomId = roomId;
    this.io = io;
    this.options = { ...DEFAULT_ROOM_OPTIONS, ...options };
    this.seed = Date.now() + Math.floor(Math.random() * 100000);

    this.players = new Map();
    this.players.set(socket1.id, {
      socket: socket1,
      engine: null,
      garbage: null,
      effects: this._createEffectState(),
      lastSequence: -1,
      disconnected: false,
      disconnectTimer: null
    });
    this.players.set(socket2.id, {
      socket: socket2,
      engine: null,
      garbage: null,
      effects: this._createEffectState(),
      lastSequence: -1,
      disconnected: false,
      disconnectTimer: null
    });

    this.state = 'INIT'; // INIT, COUNTDOWN, PLAYING, FINISHED
    this.tickInterval = null;
    this.broadcastInterval = null;
    this.lastTick = 0;
    this.startTime = 0;
    this.countdownTimeout = null;
    this.onDestroy = null;
  }

  _createEffectState() {
    return {
      stableGarbageLines: 0,
      stableGapColumn: null,
      previewMaskedUntil: 0,
      phaseShiftUntil: 0
    };
  }

  _getPhaseShiftRemainingMs(player, now) {
    return Math.max(0, player.effects.phaseShiftUntil - now);
  }

  _serializeEffects(player, now) {
    const phaseShiftMs = this._getPhaseShiftRemainingMs(player, now);
    return {
      stableGarbageLines: player.effects.stableGarbageLines,
      previewMaskedMs: Math.max(0, player.effects.previewMaskedUntil - now),
      phaseShiftMs,
      lockDelayBoostMs: phaseShiftMs > 0 ? BONUS_LOCK_DELAY_BOOST_MS : 0,
      incomingDelayBoostMs: phaseShiftMs > 0 ? BONUS_GARBAGE_DELAY_BOOST_MS : 0
    };
  }

  _syncPlayerEffects(player, now) {
    const phaseShiftMs = this._getPhaseShiftRemainingMs(player, now);
    player.engine.setLockDelayMs(LOCK_DELAY + (phaseShiftMs > 0 ? BONUS_LOCK_DELAY_BOOST_MS : 0));

    if (player.effects.stableGarbageLines <= 0) {
      player.effects.stableGapColumn = null;
    }
  }

  _emitBonus(socket, payload) {
    socket.emit('game:bonus', payload);
  }

  _extendTimedEffect(currentUntil, now, durationMs, maxDurationMs = durationMs * 2) {
    const nextUntil = Math.max(currentUntil, now) + durationMs;
    return Math.min(nextUntil, now + maxDurationMs);
  }

  _queueOutgoingGarbage(attacker, opponent, lines, currentTime) {
    if (lines <= 0) return;

    const phaseShiftMs = this._getPhaseShiftRemainingMs(opponent, currentTime);
    const baseDelay = GARBAGE_DELAY_VALUES[this.options.garbageDelay] || GARBAGE_DELAY;
    const delayMs = baseDelay + (phaseShiftMs > 0 ? BONUS_GARBAGE_DELAY_BOOST_MS : 0);

    let remaining = lines;
    if (attacker.effects.stableGarbageLines > 0) {
      if (attacker.effects.stableGapColumn === null) {
        attacker.effects.stableGapColumn = Math.floor(Math.random() * BOARD_WIDTH);
      }

      const stableLines = Math.min(attacker.effects.stableGarbageLines, remaining);
      opponent.garbage.queueGarbage(stableLines, currentTime, {
        gapColumn: attacker.effects.stableGapColumn,
        delayMs
      });
      attacker.effects.stableGarbageLines -= stableLines;
      remaining -= stableLines;

      if (attacker.effects.stableGarbageLines <= 0) {
        attacker.effects.stableGapColumn = null;
      }
    }

    if (remaining > 0) {
      opponent.garbage.queueGarbage(remaining, currentTime, { delayMs });
    }
  }

  _applyExploitBonuses(socketId, result, currentTime) {
    if (!result) return;
    if (!this.options.bonusesEnabled) return;

    const player = this.players.get(socketId);
    const opponentId = this._getOpponentId(socketId);
    const opponent = this.players.get(opponentId);

    if (!player || !opponent) return;

    if (result.clearType === 'tetris') {
      player.effects.stableGarbageLines = Math.min(
        player.effects.stableGarbageLines + BONUS_IRON_WELL_LINES,
        BONUS_IRON_WELL_LINES * 2
      );

      this._emitBonus(player.socket, {
        kind: 'ironWell',
        title: 'IRON WELL',
        subtitle: `HOLE LOCKED FOR ${BONUS_IRON_WELL_LINES} LINES`,
        positive: true,
        stableGarbageLines: player.effects.stableGarbageLines
      });
    }

    if (result.isPerfectClear) {
      opponent.effects.previewMaskedUntil = this._extendTimedEffect(
        opponent.effects.previewMaskedUntil,
        currentTime,
        BONUS_BLACKOUT_DURATION_MS
      );

      const previewMaskedMs = Math.max(0, opponent.effects.previewMaskedUntil - currentTime);

      this._emitBonus(player.socket, {
        kind: 'blackout',
        title: 'BLACKOUT SENT',
        subtitle: 'OPPONENT PREVIEW JAMMED',
        positive: true
      });

      this._emitBonus(opponent.socket, {
        kind: 'blackout',
        title: 'PREVIEW JAMMED',
        subtitle: 'NEXT QUEUE HIDDEN',
        positive: false,
        durationMs: previewMaskedMs,
        previewMaskedMs
      });
    }

    if (result.clearType === 'tSpinDouble' || result.clearType === 'tSpinTriple') {
      player.effects.phaseShiftUntil = this._extendTimedEffect(
        player.effects.phaseShiftUntil,
        currentTime,
        BONUS_PHASE_SHIFT_DURATION_MS
      );

      const phaseShiftMs = Math.max(0, player.effects.phaseShiftUntil - currentTime);

      this._emitBonus(player.socket, {
        kind: 'phaseShift',
        title: 'PHASE SHIFT',
        subtitle: `+${BONUS_LOCK_DELAY_BOOST_MS}MS LOCK / +${BONUS_GARBAGE_DELAY_BOOST_MS}MS BUFFER`,
        positive: true,
        durationMs: phaseShiftMs,
        lockDelayBoostMs: BONUS_LOCK_DELAY_BOOST_MS,
        incomingDelayBoostMs: BONUS_GARBAGE_DELAY_BOOST_MS
      });
    }
  }

  start() {
    // Initialize engines for both players
    for (const [id, player] of this.players) {
      player.engine = new TetrisEngine(this.seed, {
        startingLevel: this.options.startingLevel
      });
      player.engine.spawnPiece();
      player.garbage = new GarbageSystem(this.seed + id.charCodeAt(0));
    }

    // Send game start to both players
    this.io.to(this.roomId).emit('game:start', {
      roomId: this.roomId,
      seed: this.seed,
      countdown: COUNTDOWN_MS,
      options: this.options
    });

    this.state = 'COUNTDOWN';
    console.log(`[Room ${this.roomId}] Countdown started`);

    // Start game after countdown (store handle for cleanup)
    this.countdownTimeout = setTimeout(() => {
      if (this.state === 'COUNTDOWN') {
        this.state = 'PLAYING';
        this.startTime = Date.now();
        this._startTickLoop();
        console.log(`[Room ${this.roomId}] Game started`);
      }
    }, COUNTDOWN_MS);
  }

  _startTickLoop() {
    this.lastTick = performance.now();

    // Game logic tick at 60Hz
    this.tickInterval = setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this._tick(delta);
    }, SERVER_TICK_MS);

    // State broadcast at ~20Hz
    this.broadcastInterval = setInterval(() => {
      this._broadcastState();
    }, STATE_BROADCAST_INTERVAL);
  }

  _tick(deltaMs) {
    if (this.state !== 'PLAYING') return;

    const currentTime = Date.now();

    for (const [id, player] of this.players) {
      if (player.disconnected || !player.engine.isAlive) continue;

      this._syncPlayerEffects(player, currentTime);

      // Update gravity (fast curve = 2x speed)
      const gravityDelta = this.options.speedCurve === 'fast' ? deltaMs * 2 : deltaMs;
      player.engine.updateGravity(gravityDelta);

      // Update lock delay
      const lockResult = player.engine.updateLockDelay(deltaMs);
      if (lockResult) {
        this._handleLockResult(id, lockResult, currentTime);
      }

      // Process garbage queue
      const readyGarbage = player.garbage.processGarbage(currentTime);
      for (const g of readyGarbage) {
        player.engine.applyGarbage(g.lines, g.gapColumn);
      }

      // Check game over
      if (!player.engine.isAlive) {
        const winnerId = this._getOpponentId(id);
        this._endGame(winnerId);
        return;
      }
    }
  }

  handleInput(socketId, action) {
    if (this.state !== 'PLAYING') return;

    const player = this.players.get(socketId);
    if (!player || !player.engine.isAlive) return;

    // Track sequence for client reconciliation
    if (action.sequence !== undefined) {
      player.lastSequence = action.sequence;
    }

    const engine = player.engine;
    let lockResult = null;

    switch (action.type) {
      case 'move':
        engine.movePiece(action.dx, 0);
        break;

      case 'moveToWall': {
        let moved = true;
        let safety = 0;
        while (moved && safety < BOARD_WIDTH) {
          moved = engine.movePiece(action.dx, 0);
          safety++;
        }
        break;
      }

      case 'rotate':
        engine.rotatePiece(action.direction);
        break;

      case 'hardDrop':
        lockResult = engine.hardDrop();
        break;

      case 'hold':
        engine.holdSwap();
        break;

      case 'softDrop':
        engine.setSoftDrop(action.active || false);
        break;
    }

    if (lockResult) {
      this._handleLockResult(socketId, lockResult, Date.now());
    }
  }

  _handleLockResult(socketId, result, currentTime) {
    this._applyExploitBonuses(socketId, result, currentTime);

    // Check lines-to-win condition
    if (this.options.linesToWin > 0 && result && result.linesCleared > 0) {
      const player = this.players.get(socketId);
      if (player && player.engine.linesCleared >= this.options.linesToWin) {
        this._endGame(socketId);
        return;
      }
    }

    if (!result || result.attack <= 0) return;

    const player = this.players.get(socketId);
    const opponentId = this._getOpponentId(socketId);
    const opponent = this.players.get(opponentId);

    if (!opponent) return;

    // Offset garbage first (cancel incoming garbage with attack)
    const netAttack = player.garbage.offsetGarbage(result.attack);

    // Send remaining attack to opponent
    if (netAttack > 0) {
      this._queueOutgoingGarbage(player, opponent, netAttack, currentTime);

      // Notify opponent about incoming garbage
      opponent.socket.emit('game:garbage', {
        lines: netAttack,
        totalPending: opponent.garbage.getPendingLines()
      });
    }

    // Notify attacker about their attack and updated pending
    player.socket.emit('game:garbage', {
      totalPending: player.garbage.getPendingLines()
    });

    // Send attack event info
    player.socket.emit('game:attack', {
      ...result,
      target: opponentId
    });
  }

  _broadcastState() {
    if (this.state !== 'PLAYING') return;

    const playerIds = [...this.players.keys()];

    for (const id of playerIds) {
      const player = this.players.get(id);
      const opponentId = this._getOpponentId(id);
      const opponent = this.players.get(opponentId);

      if (!player || player.disconnected) continue;

      player.socket.emit('game:state', {
        self: {
          lastSequence: player.lastSequence,
          pendingGarbage: player.garbage.getPendingLines(),
          score: player.engine.score,
          level: player.engine.level,
          lines: player.engine.linesCleared,
          isAlive: player.engine.isAlive,
          effects: this._serializeEffects(player, Date.now())
        },
        opponent: opponent ? {
          ...opponent.engine.getBoardSnapshot(),
          score: opponent.engine.score,
          level: opponent.engine.level,
          lines: opponent.engine.linesCleared
        } : null
      });
    }
  }

  _endGame(winnerId) {
    if (this.state === 'FINISHED') return;
    this.state = 'FINISHED';

    console.log(`[Room ${this.roomId}] Game over. Winner: ${winnerId}`);

    // Collect stats
    const stats = {};
    for (const [id, player] of this.players) {
      stats[id] = {
        score: player.engine.score,
        linesCleared: player.engine.linesCleared,
        level: player.engine.level,
        piecesPlaced: player.engine.piecesPlaced
      };
    }

    this.io.to(this.roomId).emit('game:over', {
      winner: winnerId,
      stats
    });

    this._cleanup();
  }

  handleDisconnect(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    player.disconnected = true;

    if (this.state === 'PLAYING') {
      const opponentId = this._getOpponentId(socketId);
      const opponent = this.players.get(opponentId);

      if (opponent && !opponent.disconnected) {
        opponent.socket.emit('game:opponent_disconnect', {
          timeout: DISCONNECT_TIMEOUT
        });
      }

      // Start disconnect timeout
      player.disconnectTimer = setTimeout(() => {
        if (this.state === 'PLAYING') {
          const winnerId = this._getOpponentId(socketId);
          this._endGame(winnerId);
        }
      }, DISCONNECT_TIMEOUT);
    } else {
      // Not in game yet, just end the room
      const opponentId = this._getOpponentId(socketId);
      if (opponentId) {
        this._endGame(opponentId);
      } else {
        this._cleanup();
      }
    }
  }

  handleReconnect(socket) {
    const player = this.players.get(socket.id);
    if (!player) return;

    player.disconnected = false;
    player.socket = socket;

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    socket.join(this.roomId);

    // Send full state sync
    socket.emit('game:reconnect', {
      state: this.state,
      self: player.engine.getState(),
      seed: this.seed
    });
  }

  _getOpponentId(socketId) {
    for (const id of this.players.keys()) {
      if (id !== socketId) return id;
    }
    return null;
  }

  _cleanup() {
    if (this.countdownTimeout) clearTimeout(this.countdownTimeout);
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);

    for (const player of this.players.values()) {
      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    }

    // Delay room destruction to allow clients to process game:over
    setTimeout(() => {
      if (this.onDestroy) this.onDestroy();
    }, 5000);
  }
}
