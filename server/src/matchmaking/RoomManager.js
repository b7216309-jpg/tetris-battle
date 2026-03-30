import { GameRoom } from '../game/GameRoom.js';
import {
  ROOM_CODE_LENGTH,
  ROOM_CODE_CHARS,
  DEFAULT_ROOM_OPTIONS
} from '@tetris/shared';

const STALE_ROOM_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000;    // 1 minute

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();          // code -> room data
    this.socketToRoom = new Map();   // socketId -> code

    // Periodically clean up stale empty rooms
    this._cleanupInterval = setInterval(() => this._cleanupStaleRooms(), CLEANUP_INTERVAL);
  }

  _generateCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  _validateOptions(raw) {
    const opts = { ...DEFAULT_ROOM_OPTIONS };
    if (raw.startingLevel !== undefined) {
      opts.startingLevel = Math.max(1, Math.min(15, Math.floor(Number(raw.startingLevel)) || 1));
    }
    if (['short', 'normal', 'long'].includes(raw.garbageDelay)) {
      opts.garbageDelay = raw.garbageDelay;
    }
    if (typeof raw.bonusesEnabled === 'boolean') {
      opts.bonusesEnabled = raw.bonusesEnabled;
    }
    if (['normal', 'fast'].includes(raw.speedCurve)) {
      opts.speedCurve = raw.speedCurve;
    }
    if ([0, 40, 100, 150].includes(Number(raw.linesToWin))) {
      opts.linesToWin = Number(raw.linesToWin);
    }
    return opts;
  }

  createRoom(socket) {
    // Don't allow if already in a room
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('room:error', { message: 'Already in a room' });
      return;
    }

    const code = this._generateCode();
    if (!code) {
      socket.emit('room:error', { message: 'Could not generate room code' });
      return;
    }

    const room = {
      code,
      hostId: socket.id,
      hostSocket: socket,
      guestId: null,
      guestSocket: null,
      options: { ...DEFAULT_ROOM_OPTIONS },
      hostReady: false,
      guestReady: false,
      state: 'WAITING',
      gameRoom: null,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);

    socket.emit('room:created', {
      code,
      options: room.options,
      isHost: true
    });

    console.log(`[RoomManager] Room ${code} created by ${socket.id}`);
  }

  joinRoom(socket, code) {
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('room:error', { message: 'Already in a room' });
      return;
    }

    const upperCode = (code || '').toUpperCase().trim();
    const room = this.rooms.get(upperCode);

    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    if (room.state !== 'WAITING') {
      socket.emit('room:error', { message: 'Room is not available' });
      return;
    }

    if (room.guestId) {
      socket.emit('room:error', { message: 'Room is full' });
      return;
    }

    room.guestId = socket.id;
    room.guestSocket = socket;
    room.state = 'READY';

    this.socketToRoom.set(socket.id, upperCode);

    // Notify joiner
    socket.emit('room:joined', {
      code: upperCode,
      options: room.options,
      isHost: false,
      hostReady: room.hostReady,
      guestReady: room.guestReady
    });

    // Notify host
    room.hostSocket.emit('room:player_joined', {
      hostReady: room.hostReady,
      guestReady: room.guestReady
    });

    console.log(`[RoomManager] ${socket.id} joined room ${upperCode}`);
  }

  leaveRoom(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) {
      this.socketToRoom.delete(socket.id);
      return;
    }

    if (socket.id === room.hostId) {
      // Host leaves -> destroy room
      if (room.guestSocket) {
        room.guestSocket.emit('room:player_left', { reason: 'host_left' });
        this.socketToRoom.delete(room.guestId);
      }
      this.socketToRoom.delete(socket.id);
      this.rooms.delete(code);
      console.log(`[RoomManager] Room ${code} destroyed (host left)`);
    } else {
      // Guest leaves -> back to waiting
      room.guestId = null;
      room.guestSocket = null;
      room.guestReady = false;
      room.state = 'WAITING';
      this.socketToRoom.delete(socket.id);

      room.hostSocket.emit('room:player_left', {
        reason: 'guest_left',
        hostReady: room.hostReady,
        guestReady: false
      });

      console.log(`[RoomManager] ${socket.id} left room ${code}`);
    }
  }

  updateOptions(socket, rawOptions) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    // Only host can change options
    if (socket.id !== room.hostId) {
      socket.emit('room:error', { message: 'Only the host can change options' });
      return;
    }

    if (room.state === 'PLAYING') return;

    room.options = this._validateOptions(rawOptions);

    // Un-ready guest when options change
    room.guestReady = false;

    // Notify both
    const payload = {
      options: room.options,
      hostReady: room.hostReady,
      guestReady: room.guestReady
    };

    room.hostSocket.emit('room:options_updated', payload);
    if (room.guestSocket) {
      room.guestSocket.emit('room:options_updated', payload);
    }
  }

  toggleReady(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room || room.state === 'PLAYING') return;

    if (socket.id === room.hostId) {
      room.hostReady = !room.hostReady;
    } else if (socket.id === room.guestId) {
      room.guestReady = !room.guestReady;
    }

    const payload = {
      hostReady: room.hostReady,
      guestReady: room.guestReady
    };

    room.hostSocket.emit('room:ready_updated', payload);
    if (room.guestSocket) {
      room.guestSocket.emit('room:ready_updated', payload);
    }
  }

  startGame(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    // Only host can start
    if (socket.id !== room.hostId) {
      socket.emit('room:error', { message: 'Only the host can start' });
      return;
    }

    // Both must be ready and guest must be present
    if (!room.guestSocket || !room.hostReady || !room.guestReady) {
      socket.emit('room:error', { message: 'Both players must be ready' });
      return;
    }

    room.state = 'PLAYING';

    // Create Socket.IO room and GameRoom
    const roomId = `private_${code}`;
    room.hostSocket.join(roomId);
    room.guestSocket.join(roomId);

    room.gameRoom = new GameRoom(
      roomId,
      room.hostSocket,
      room.guestSocket,
      this.io,
      room.options
    );

    room.gameRoom.onDestroy = () => {
      // Clean up after game ends
      if (room.hostSocket) this.socketToRoom.delete(room.hostId);
      if (room.guestSocket) this.socketToRoom.delete(room.guestId);
      this.rooms.delete(code);
      console.log(`[RoomManager] Room ${code} cleaned up after game`);
    };

    room.gameRoom.start();
    console.log(`[RoomManager] Room ${code} game started`);
  }

  findGameRoomForSocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room || !room.gameRoom || room.state !== 'PLAYING') return null;

    return room.gameRoom;
  }

  handleDisconnect(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) {
      this.socketToRoom.delete(socket.id);
      return;
    }

    // If game is in progress, let GameRoom handle the disconnect
    if (room.gameRoom && room.state === 'PLAYING') {
      room.gameRoom.handleDisconnect(socket.id);
      return;
    }

    // Otherwise, treat as a leave
    this.leaveRoom(socket);
  }

  getStats() {
    let waiting = 0;
    let ready = 0;
    let playing = 0;
    for (const room of this.rooms.values()) {
      if (room.state === 'WAITING') waiting++;
      else if (room.state === 'READY') ready++;
      else if (room.state === 'PLAYING') playing++;
    }
    return { privateRooms: { waiting, ready, playing } };
  }

  _cleanupStaleRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      // Only clean up rooms that are waiting with no guest and are old
      if (room.state === 'WAITING' && !room.guestId && (now - room.createdAt) > STALE_ROOM_TTL) {
        room.hostSocket.emit('room:error', { message: 'Room expired' });
        this.socketToRoom.delete(room.hostId);
        this.rooms.delete(code);
        console.log(`[RoomManager] Stale room ${code} cleaned up`);
      }
    }
  }
}
