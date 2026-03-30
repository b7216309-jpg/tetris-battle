import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Lobby } from './matchmaking/Lobby.js';
import { RoomManager } from './matchmaking/RoomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

const corsOrigins = IS_PRODUCTION
  ? false
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

const io = new Server(httpServer, {
  cors: corsOrigins ? { origin: corsOrigins, methods: ['GET', 'POST'] } : undefined
});

const lobby = new Lobby(io);
const roomManager = new RoomManager(io);

// Production: serve built client
if (IS_PRODUCTION) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: io.engine.clientsCount,
    ...lobby.getStats(),
    ...roomManager.getStats()
  });
});

// SPA fallback (must be after /health)
if (IS_PRODUCTION) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id}`);

  // --- Quick Match ---
  socket.on('lobby:join', () => {
    lobby.addToQueue(socket);
  });

  socket.on('lobby:cancel', () => {
    lobby.removeFromQueue(socket);
  });

  // --- Private Rooms ---
  socket.on('room:create', () => {
    roomManager.createRoom(socket);
  });

  socket.on('room:join', (code) => {
    roomManager.joinRoom(socket, code);
  });

  socket.on('room:leave', () => {
    roomManager.leaveRoom(socket);
  });

  socket.on('room:options', (options) => {
    roomManager.updateOptions(socket, options);
  });

  socket.on('room:ready', () => {
    roomManager.toggleReady(socket);
  });

  socket.on('room:start', () => {
    roomManager.startGame(socket);
  });

  // --- In-game input ---
  socket.on('game:input', (action) => {
    const room = lobby.findRoomForSocket(socket.id)
      || roomManager.findGameRoomForSocket(socket.id);
    if (room) room.handleInput(socket.id, action);
  });

  // Reconnection
  socket.on('game:reconnect', (roomId) => {
    const room = lobby.activeRooms.get(roomId);
    if (room) room.handleReconnect(socket);
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[-] Player disconnected: ${socket.id} (${reason})`);
    lobby.handleDisconnect(socket);
    roomManager.handleDisconnect(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Tetris Battle server running on port ${PORT}`);
});
