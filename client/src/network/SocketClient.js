import { io } from 'socket.io-client';

export class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = null;

    // Callbacks (set by GameManager)
    this.onGameStart = null;
    this.onStateUpdate = null;
    this.onGarbageIncoming = null;
    this.onGameOver = null;
    this.onOpponentDisconnect = null;
    this.onWaiting = null;
    this.onBonus = null;
    this.onAttack = null;

    // Room callbacks
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onOptionsUpdated = null;
    this.onReadyUpdated = null;
    this.onRoomError = null;
  }

  connect() {
    if (this.socket) return;

    this._pendingActions = [];

    this.socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket] Connected:', this.socket.id);
      // Flush any actions queued before connection
      for (const fn of this._pendingActions) fn();
      this._pendingActions = [];
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('waiting', () => {
      if (this.onWaiting) this.onWaiting();
    });

    this.socket.on('game:start', (data) => {
      this.roomId = data.roomId;
      if (this.onGameStart) this.onGameStart(data);
    });

    this.socket.on('game:state', (data) => {
      if (this.onStateUpdate) this.onStateUpdate(data);
    });

    this.socket.on('game:garbage', (data) => {
      if (this.onGarbageIncoming) this.onGarbageIncoming(data);
    });

    this.socket.on('game:over', (data) => {
      if (this.onGameOver) this.onGameOver(data);
    });

    this.socket.on('game:bonus', (data) => {
      if (this.onBonus) this.onBonus(data);
    });

    this.socket.on('game:attack', (data) => {
      if (this.onAttack) this.onAttack(data);
    });

    this.socket.on('game:opponent_disconnect', () => {
      if (this.onOpponentDisconnect) this.onOpponentDisconnect();
    });

    // Room events
    this.socket.on('room:created', (data) => {
      if (this.onRoomCreated) this.onRoomCreated(data);
    });

    this.socket.on('room:joined', (data) => {
      if (this.onRoomJoined) this.onRoomJoined(data);
    });

    this.socket.on('room:player_joined', (data) => {
      if (this.onPlayerJoined) this.onPlayerJoined(data);
    });

    this.socket.on('room:player_left', (data) => {
      if (this.onPlayerLeft) this.onPlayerLeft(data);
    });

    this.socket.on('room:options_updated', (data) => {
      if (this.onOptionsUpdated) this.onOptionsUpdated(data);
    });

    this.socket.on('room:ready_updated', (data) => {
      if (this.onReadyUpdated) this.onReadyUpdated(data);
    });

    this.socket.on('room:error', (data) => {
      if (this.onRoomError) this.onRoomError(data);
    });
  }

  _emitWhenReady(fn) {
    if (this.connected) {
      fn();
    } else {
      this._pendingActions.push(fn);
    }
  }

  // Quick match
  joinLobby() {
    this._emitWhenReady(() => this.socket.emit('lobby:join'));
  }

  cancelMatchmaking() {
    if (this.socket) this.socket.emit('lobby:cancel');
  }

  // Room management
  createRoom() {
    this._emitWhenReady(() => this.socket.emit('room:create'));
  }

  joinRoom(code) {
    this._emitWhenReady(() => this.socket.emit('room:join', code));
  }

  leaveRoom() {
    if (this.socket) this.socket.emit('room:leave');
  }

  updateRoomOptions(options) {
    if (this.socket) this.socket.emit('room:options', options);
  }

  toggleReady() {
    if (this.socket) this.socket.emit('room:ready');
  }

  startRoom() {
    if (this.socket) this.socket.emit('room:start');
  }

  // Gameplay
  sendInput(action) {
    if (!this.socket) return;
    this.socket.emit('game:input', action);
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}
