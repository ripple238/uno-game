import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { UnoGame } from './gameLogic.js';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const games = new Map(); // RoomCode -> UnoGame instance

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ playerName, avatar, theme }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const game = new UnoGame(roomCode, io, theme);
    games.set(roomCode, game);
    
    socket.join(roomCode);
    game.addPlayer(socket.id, playerName, avatar, false);
    
    socket.emit('roomCreated', { roomCode, theme });
    game.broadcastGameState();
  });

  socket.on('joinRoom', ({ roomCode, playerName, avatar }) => {
    const game = games.get(roomCode);
    if (game) {
      if (game.gameState === 'playing') {
        // Join as spectator
        socket.join(roomCode);
        game.addSpectator(socket.id, playerName);
        socket.emit('joinedAsSpectator', { roomCode });
      } else {
        socket.join(roomCode);
        game.addPlayer(socket.id, playerName, avatar, false);
        socket.emit('joinedRoom', { roomCode });
      }
      game.broadcastGameState();
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('addBot', ({ roomCode }) => {
    const game = games.get(roomCode);
    if (game && game.gameState === 'waiting') {
      const botId = 'BOT_' + Math.random().toString(36).substring(2, 6);
      game.addPlayer(botId, 'Bot ' + botId.substring(4), 'bot_avatar', true);
      game.broadcastGameState();
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const game = games.get(roomCode);
    if (game && game.players.length >= 2) {
      game.startGame();
    }
  });

  socket.on('playCard', ({ roomCode, cardIndex, color }) => {
    const game = games.get(roomCode);
    if (game) {
      game.playCard(socket.id, cardIndex, color);
    }
  });

  socket.on('drawCard', ({ roomCode }) => {
    const game = games.get(roomCode);
    if (game) {
      game.drawCard(socket.id);
    }
  });

  socket.on('keepPlaying', ({ roomCode }) => {
     // Called when one player wins but the rest want to keep playing
     const game = games.get(roomCode);
     if (game) {
       game.keepPlaying();
     }
  });

  socket.on('sendEmoji', ({ roomCode, emoji }) => {
    io.to(roomCode).emit('receiveEmoji', { emoji, x: Math.random() * 80 + 10 });
  });

  socket.on('sendChat', ({ roomCode, text }) => {
    const game = games.get(roomCode);
    if (game) {
      const player = game.players.find(p => p.id === socket.id) || game.spectators.find(s => s.id === socket.id);
      if (player) {
        io.to(roomCode).emit('receiveChat', { text, playerName: player.name });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomCode, game] of games.entries()) {
      if (game.removePlayer(socket.id)) {
        if (game.players.length === 0) {
          games.delete(roomCode);
        } else {
          game.broadcastGameState();
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
