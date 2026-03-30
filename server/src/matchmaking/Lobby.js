import { GameRoom } from '../game/GameRoom.js';

let roomCounter = 0;

export class Lobby {
  constructor(io) {
    this.io = io;
    this.waitingQueue = []; // sockets waiting for a match
    this.activeRooms = new Map(); // roomId -> GameRoom
    this.socketToRoom = new Map(); // socketId -> roomId
  }

  addToQueue(socket) {
    // Don't add if already in queue or in a game
    if (this.waitingQueue.find(s => s.id === socket.id)) return;
    if (this.socketToRoom.has(socket.id)) return;

    if (this.waitingQueue.length > 0) {
      const opponent = this.waitingQueue.shift();

      // Verify opponent is still connected
      if (!opponent.connected) {
        this.addToQueue(socket);
        return;
      }

      this._createRoom(socket, opponent);
    } else {
      this.waitingQueue.push(socket);
      socket.emit('waiting');
      console.log(`[Lobby] ${socket.id} added to queue (${this.waitingQueue.length} waiting)`);
    }
  }

  removeFromQueue(socket) {
    this.waitingQueue = this.waitingQueue.filter(s => s.id !== socket.id);
  }

  _createRoom(socket1, socket2) {
    const roomId = `room_${++roomCounter}`;
    console.log(`[Lobby] Creating room ${roomId}: ${socket1.id} vs ${socket2.id}`);

    socket1.join(roomId);
    socket2.join(roomId);

    const room = new GameRoom(roomId, socket1, socket2, this.io);
    this.activeRooms.set(roomId, room);
    this.socketToRoom.set(socket1.id, roomId);
    this.socketToRoom.set(socket2.id, roomId);

    room.onDestroy = () => {
      this.activeRooms.delete(roomId);
      this.socketToRoom.delete(socket1.id);
      this.socketToRoom.delete(socket2.id);
    };

    room.start();
  }

  findRoomForSocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.activeRooms.get(roomId) || null;
  }

  handleDisconnect(socket) {
    this.removeFromQueue(socket);

    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      const room = this.activeRooms.get(roomId);
      if (room) {
        room.handleDisconnect(socket.id);
      }
    }
  }

  getStats() {
    return {
      waiting: this.waitingQueue.length,
      activeGames: this.activeRooms.size
    };
  }
}
