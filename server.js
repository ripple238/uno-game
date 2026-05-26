const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== CONSTANTS =====
const COLORS = ['red', 'blue', 'green', 'yellow'];
const CARD_VALUES = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'skip': 20, 'reverse': 20, 'draw2': 20, 'wild': 50, 'wild4': 50
};

// ===== STATE =====
const rooms = {};
const traffic = {
  totalConnections: 0,
  uniqueVisitors: new Set(),
  gamesCreated: 0,
  gamesStarted: 0,
  gamesCompleted: 0,
  peakConcurrent: 0,
  dailyStats: {}
};

// ===== UTILITIES =====
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0', type: 'number', id: generateId() });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: i.toString(), type: 'number', id: generateId() });
      deck.push({ color, value: i.toString(), type: 'number', id: generateId() });
    }
    for (const special of ['skip', 'reverse', 'draw2']) {
      deck.push({ color, value: special, type: 'special', id: generateId() });
      deck.push({ color, value: special, type: 'special', id: generateId() });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild', type: 'wild', id: generateId() });
    deck.push({ color: 'wild', value: 'wild4', type: 'wild', id: generateId() });
  }
  return shuffle(deck);
}
function dealCards(deck, numPlayers) {
  const hands = Array.from({ length: numPlayers }, () => []);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < numPlayers; j++) {
      if (deck.length > 0) hands[j].push(deck.pop());
    }
  }
  return { hands, deck };
}
function isValidPlay(card, topCard, currentColor) {
  if (!card || !topCard) return false;
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (topCard.color !== 'wild' && card.color === topCard.color) return true;
  if (card.value === topCard.value) return true;
  return false;
}
function getNextPlayerIndex(room, skipCount = 1) {
  let next = room.currentPlayerIndex;
  const total = room.players.length;
  for (let i = 0; i < skipCount; i++) {
    next = (next + room.direction + total) % total;
  }
  return next;
}
function calculateHandValue(hand) {
  return hand.reduce((sum, card) => sum + (CARD_VALUES[card.value] || 0), 0);
}
function refillDeck(room) {
  if (room.discardPile.length <= 1) return;
  const top = room.discardPile.pop();
  room.deck = shuffle(room.discardPile);
  room.discardPile = [top];
}
function addMessage(room, text, type = 'system') {
  room.messages.push({ text, type, time: Date.now() });
  if (room.messages.length > 100) room.messages.shift();
}
function getAvatar(name) {
  const avatars = ['Lion','Tiger','Bear','Koala','Panda','Frog','Octopus','Unicorn','Fox','Wolf','Owl','Butterfly','Turtle','Dino','Dragon','Dragon2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatars[Math.abs(hash) % avatars.length];
}

// ===== TRAFFIC TRACKING =====
function getToday() {
  return new Date().toISOString().split('T')[0];
}
function trackConnection(socketId) {
  traffic.totalConnections++;
  traffic.uniqueVisitors.add(socketId);
  const today = getToday();
  if (!traffic.dailyStats[today]) traffic.dailyStats[today] = { visitors: 0, games: 0 };
  traffic.dailyStats[today].visitors++;
  const current = io.engine.clientsCount;
  if (current > traffic.peakConcurrent) traffic.peakConcurrent = current;
}

// ===== AI BOT =====
class AIBot {
  constructor(name, difficulty = 'medium') {
    this.id = 'bot-' + generateId();
    this.name = name;
    this.isBot = true;
    this.difficulty = difficulty;
    this.hand = [];
    this.saidUno = false;
    this.score = 0;
    this.wins = 0;
    this.avatar = 'Bot';
  }
  choosePlay(hand, topCard, currentColor) {
    const validCards = [];
    for (let i = 0; i < hand.length; i++) {
      if (isValidPlay(hand[i], topCard, currentColor)) validCards.push({ card: hand[i], idx: i });
    }
    if (validCards.length === 0) return null;
    if (this.difficulty === 'easy') return validCards[Math.floor(Math.random() * validCards.length)];
    validCards.sort((a, b) => {
      const va = CARD_VALUES[a.card.value] || 0;
      const vb = CARD_VALUES[b.card.value] || 0;
      return vb - va;
    });
    if (this.difficulty === 'hard' && hand.length <= 3) {
      const nonWild = validCards.find(v => v.card.type !== 'wild');
      if (nonWild) return nonWild;
    }
    return validCards[0];
  }
  chooseColor(hand) {
    const counts = {};
    hand.forEach(c => { if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : COLORS[Math.floor(Math.random() * 4)];
  }
}

const BOT_NAMES = ['Robo','Alpha','Beta','Gamma','Delta','Zeta','Omega','Neo','Cyber','Pixel'];

// ===== ROOM STATE =====
function getPublicRoomState(room) {
  return {
    code: room.code,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id, name: p.name, cardCount: p.hand.length,
      saidUno: p.saidUno, isBot: p.isBot,
      avatar: p.avatar, score: p.score, wins: p.wins
    })),
    status: room.status,
    currentPlayerIndex: room.currentPlayerIndex,
    direction: room.direction,
    currentColor: room.currentColor,
    topCard: room.discardPile[room.discardPile.length - 1] || null,
    discardCount: room.discardPile.length,
    deckCount: room.deck.length,
    messages: room.messages,
    winner: room.winner,
    round: room.round,
    theme: room.theme,
    settings: room.settings
  };
}

function broadcastGameState(room) {
  room.players.forEach((player, index) => {
    if (player.isBot) return;
    const personal = {
      ...getPublicRoomState(room),
      yourHand: player.hand,
      yourIndex: index,
      isYourTurn: index === room.currentPlayerIndex,
      canPlay: index === room.currentPlayerIndex
    };
    io.to(player.id).emit('game-state', personal);
  });
}

// ===== GAME LOGIC (FIXED) =====
function executePlay(room, playerIndex, cardIndex, chosenColor) {
  // Validate
  if (room.status !== 'playing') return { success: false, error: 'Game not active' };
  if (playerIndex !== room.currentPlayerIndex) return { success: false, error: 'Not your turn' };
  if (cardIndex < 0 || cardIndex >= room.players[playerIndex].hand.length) return { success: false, error: 'Invalid card' };

  const player = room.players[playerIndex];
  const card = player.hand[cardIndex];
  const topCard = room.discardPile[room.discardPile.length - 1];

  if (!isValidPlay(card, topCard, room.currentColor)) return { success: false, error: 'Invalid play' };

  // Execute the play
  player.hand.splice(cardIndex, 1);
  room.discardPile.push(card);
  room.currentColor = (card.type === 'wild') ? chosenColor : card.color;

  let skipCount = 1;
  let cardsToDraw = 0;
  let nextIdx = getNextPlayerIndex(room, 0);
  let soundType = 'play';

  if (card.value === 'skip') {
    skipCount = 2;
    soundType = 'special';
    addMessage(room, player.name + ' skipped ' + room.players[nextIdx].name + '!');
  } else if (card.value === 'reverse') {
    room.direction *= -1;
    soundType = 'special';
    if (room.players.length === 2) skipCount = 2;
    addMessage(room, player.name + ' reversed direction!');
  } else if (card.value === 'draw2') {
    cardsToDraw = 2;
    soundType = 'special';
    addMessage(room, player.name + ' made ' + room.players[nextIdx].name + ' draw 2!');
  } else if (card.value === 'wild4') {
    cardsToDraw = 4;
    soundType = 'wild';
    addMessage(room, player.name + ' made ' + room.players[nextIdx].name + ' draw 4!');
  } else if (card.type === 'wild') {
    soundType = 'wild';
    addMessage(room, player.name + ' chose ' + chosenColor + '!');
  }

  // Draw cards
  if (cardsToDraw > 0) {
    for (let i = 0; i < cardsToDraw; i++) {
      if (room.deck.length === 0) refillDeck(room);
      if (room.deck.length > 0) room.players[nextIdx].hand.push(room.deck.pop());
    }
  }

  // Check win
  if (player.hand.length === 0) {
    endRound(room, player);
    return { success: true, sound: 'win', gameOver: room.status === 'finished' };
  }

  // Check UNO
  if (player.hand.length === 1) {
    player.saidUno = true;
    addMessage(room, 'UNO! ' + player.name + ' has one card left!');
  }

  // Move to next player - THIS IS THE KEY FIX
  room.currentPlayerIndex = getNextPlayerIndex(room, skipCount);

  // Broadcast immediately
  broadcastGameState(room);

  // Trigger bot if next is bot
  setTimeout(() => checkBotTurn(room), 500);

  return { success: true, sound: soundType };
}

function checkBotTurn(room) {
  if (room.status !== 'playing') return;
  const current = room.players[room.currentPlayerIndex];
  if (!current || !current.isBot) return;

  // Prevent multiple bot turns
  if (room.botThinking) return;
  room.botThinking = true;

  setTimeout(() => {
    if (room.status !== 'playing') { room.botThinking = false; return; }
    botPlayTurn(room);
    room.botThinking = false;
  }, 2000);
}

function botPlayTurn(room) {
  const bot = room.players[room.currentPlayerIndex];
  if (!bot || !bot.isBot || room.status !== 'playing') return;

  const topCard = room.discardPile[room.discardPile.length - 1];
  const play = bot.choosePlay(bot.hand, topCard, room.currentColor);

  if (play) {
    const result = executePlay(room, room.currentPlayerIndex, play.idx, bot.chooseColor(bot.hand));
    if (result.success && !result.gameOver) {
      io.to(room.code).emit('sound', result.sound);
    }
  } else {
    // Draw card
    if (room.deck.length === 0) refillDeck(room);
    if (room.deck.length > 0) {
      bot.hand.push(room.deck.pop());
      addMessage(room, bot.name + ' drew a card');

      // Check if drawn card is playable
      const newTop = room.discardPile[room.discardPile.length - 1];
      const drawnCard = bot.hand[bot.hand.length - 1];
      const canPlay = isValidPlay(drawnCard, newTop, room.currentColor);

      if (canPlay && bot.difficulty !== 'easy') {
        setTimeout(() => {
          if (room.status !== 'playing') return;
          const result = executePlay(room, room.currentPlayerIndex, bot.hand.length - 1, bot.chooseColor(bot.hand));
          if (result.success) io.to(room.code).emit('sound', result.sound);
        }, 1500);
      } else {
        room.currentPlayerIndex = getNextPlayerIndex(room);
        broadcastGameState(room);
        setTimeout(() => checkBotTurn(room), 500);
      }
    }
  }
}

function endRound(room, winner) {
  room.status = 'round_end';
  winner.wins++;
  traffic.gamesCompleted++;

  let roundPoints = 0;
  room.players.forEach(p => {
    if (p !== winner) {
      const points = calculateHandValue(p.hand);
      roundPoints += points;
    }
  });
  winner.score += roundPoints;

  addMessage(room, winner.name + ' wins Round ' + room.round + '! +' + roundPoints + ' points', 'winner');

  const targetScore = room.settings.targetScore || 500;
  const gameWinner = room.players.find(p => p.score >= targetScore);

  if (gameWinner) {
    room.status = 'finished';
    room.winner = gameWinner.name;
    addMessage(room, gameWinner.name + ' WINS THE GAME!', 'winner');
  } else {
    room.round++;
  }

  broadcastGameState(room);
}

function startNewRound(room) {
  const deck = createDeck();
  const { hands, deck: remaining } = dealCards(deck, room.players.length);
  room.players.forEach((p, i) => { p.hand = hands[i]; p.saidUno = false; });

  let firstCard = remaining.pop();
  while (firstCard && firstCard.type === 'wild') {
    remaining.unshift(firstCard);
    firstCard = remaining.pop();
  }

  room.deck = remaining;
  room.discardPile = [firstCard];
  room.currentColor = firstCard.color;
  room.status = 'playing';
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.winner = null;
  room.botThinking = false;

  if (firstCard.value === 'skip') {
    room.currentPlayerIndex = getNextPlayerIndex(room);
  } else if (firstCard.value === 'reverse') {
    room.direction = -1;
  } else if (firstCard.value === 'draw2') {
    const nextP = room.players[getNextPlayerIndex(room, 0)];
    for (let i = 0; i < 2; i++) if (room.deck.length > 0) nextP.hand.push(room.deck.pop());
    room.currentPlayerIndex = getNextPlayerIndex(room);
  }

  addMessage(room, 'Round ' + room.round + ' started! Target: ' + room.settings.targetScore + ' points');
  broadcastGameState(room);
  setTimeout(() => checkBotTurn(room), 1000);
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  trackConnection(socket.id);

  socket.on('create-room', (data, callback) => {
    const { playerName, settings = {} } = data;
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: socket.id, name: playerName, hand: [], saidUno: false,
        score: 0, wins: 0, isBot: false,
        avatar: getAvatar(playerName)
      }],
      spectators: [],
      status: 'waiting',
      deck: [],
      discardPile: [],
      currentPlayerIndex: 0,
      direction: 1,
      currentColor: null,
      messages: [],
      winner: null,
      round: 1,
      theme: settings.theme || 'classic',
      settings: {
        targetScore: settings.targetScore || 500,
        botDifficulty: settings.botDifficulty || 'medium',
        allowSpectators: settings.allowSpectators !== false,
        ...settings
      },
      botThinking: false
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;
    traffic.gamesCreated++;

    callback({ success: true, roomCode, theme: rooms[roomCode].theme });
    io.to(roomCode).emit('room-update', getPublicRoomState(rooms[roomCode]));
  });

  socket.on('join-room', (data, callback) => {
    const { roomCode, playerName } = data;
    const room = rooms[roomCode];
    if (!room) return callback({ success: false, error: 'Room not found' });
    if (room.status !== 'waiting') return callback({ success: false, error: 'Game already started' });
    if (room.players.length >= 10) return callback({ success: false, error: 'Room full' });

    room.players.push({
      id: socket.id, name: playerName, hand: [], saidUno: false,
      score: 0, wins: 0, isBot: false,
      avatar: getAvatar(playerName)
    });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    callback({ success: true, theme: room.theme });
    io.to(roomCode).emit('room-update', getPublicRoomState(room));
  });

  socket.on('add-bot', (difficulty, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    if (room.status !== 'waiting') return callback({ success: false, error: 'Game started' });
    if (room.players.length >= 10) return callback({ success: false, error: 'Room full' });

    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' ' + Math.floor(Math.random() * 99);
    room.players.push(new AIBot(name, difficulty));
    callback({ success: true });
    io.to(room.code).emit('room-update', getPublicRoomState(room));
  });

  socket.on('remove-bot', (botId, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    const idx = room.players.findIndex(p => p.id === botId && p.isBot);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      callback({ success: true });
      io.to(room.code).emit('room-update', getPublicRoomState(room));
    } else {
      callback({ success: false, error: 'Bot not found' });
    }
  });

  socket.on('change-theme', (theme, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    room.theme = theme;
    callback({ success: true });
    io.to(room.code).emit('theme-changed', theme);
    io.to(room.code).emit('room-update', getPublicRoomState(room));
  });

  socket.on('start-game', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    if (room.players.length < 2) return callback({ success: false, error: 'Need at least 2 players' });

    room.players.forEach(p => { p.score = 0; p.wins = 0; });
    room.round = 1;
    traffic.gamesStarted++;

    const deck = createDeck();
    const { hands, deck: remaining } = dealCards(deck, room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; p.saidUno = false; });

    let firstCard = remaining.pop();
    while (firstCard && firstCard.type === 'wild') {
      remaining.unshift(firstCard);
      firstCard = remaining.pop();
    }

    room.deck = remaining;
    room.discardPile = [firstCard];
    room.currentColor = firstCard.color;
    room.status = 'playing';
    room.currentPlayerIndex = 0;
    room.direction = 1;
    room.winner = null;
    room.botThinking = false;

    if (firstCard.value === 'skip') {
      room.currentPlayerIndex = getNextPlayerIndex(room);
    } else if (firstCard.value === 'reverse') {
      room.direction = -1;
    } else if (firstCard.value === 'draw2') {
      const nextP = room.players[getNextPlayerIndex(room, 0)];
      for (let i = 0; i < 2; i++) if (room.deck.length > 0) nextP.hand.push(room.deck.pop());
      room.currentPlayerIndex = getNextPlayerIndex(room);
    }

    addMessage(room, 'Game started! Target: ' + room.settings.targetScore + ' points');
    callback({ success: true });
    broadcastGameState(room);
    setTimeout(() => checkBotTurn(room), 1000);
  });

  socket.on('next-round', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    if (room.status !== 'round_end') return callback({ success: false, error: 'Not round end' });
    startNewRound(room);
    callback({ success: true });
  });

  socket.on('play-card', (data, callback) => {
    const { cardIndex, chosenColor } = data;
    const room = rooms[socket.roomCode];

    if (!room || room.status !== 'playing') return callback({ success: false, error: 'Game not active' });

    const player = room.players[room.currentPlayerIndex];
    if (!player || player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });

    const result = executePlay(room, room.currentPlayerIndex, cardIndex, chosenColor);
    if (result.success) {
      io.to(room.code).emit('sound', result.sound);
    }
    callback(result);
  });

  socket.on('draw-card', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.status !== 'playing') return callback({ success: false, error: 'Game not active' });

    const player = room.players[room.currentPlayerIndex];
    if (!player || player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });

    if (room.deck.length === 0) refillDeck(room);
    if (room.deck.length === 0) return callback({ success: false, error: 'No cards left' });

    const card = room.deck.pop();
    player.hand.push(card);
    addMessage(room, player.name + ' drew a card');

    callback({ success: true, card });
    broadcastGameState(room);
  });

  socket.on('pass-turn', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.status !== 'playing') return callback({ success: false, error: 'Game not active' });

    const player = room.players[room.currentPlayerIndex];
    if (!player || player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });

    room.currentPlayerIndex = getNextPlayerIndex(room);
    addMessage(room, player.name + ' passed');

    callback({ success: true });
    broadcastGameState(room);
    setTimeout(() => checkBotTurn(room), 500);
  });

  socket.on('say-uno', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room) return callback({ success: false, error: 'Not in room' });
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return callback({ success: false, error: 'Player not found' });
    if (player.hand.length === 1) {
      player.saidUno = true;
      addMessage(room, 'UNO! ' + player.name + ' has one card left!');
      io.to(room.code).emit('sound', 'uno');
      callback({ success: true });
      broadcastGameState(room);
    } else {
      callback({ success: false, error: 'You do not have UNO!' });
    }
  });

  socket.on('send-message', (data, callback) => {
    const { message, emoji } = data;
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (emoji) {
      addMessage(room, player.name + ' ' + emoji, 'emoji');
      io.to(room.code).emit('emoji-reaction', { player: player.name, emoji });
    } else {
      addMessage(room, player.name + ': ' + message, 'chat');
    }
    io.to(room.code).emit('room-update', getPublicRoomState(room));
    if (callback) callback({ success: true });
  });

  socket.on('emoji-reaction', (emoji) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      io.to(room.code).emit('emoji-reaction', { player: player.name, emoji, playerId: socket.id });
    }
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    const pIdx = room.players.findIndex(p => p.id === socket.id);
    if (pIdx !== -1 && !room.players[pIdx].isBot) {
      const pName = room.players[pIdx].name;
      room.players.splice(pIdx, 1);

      if (room.players.filter(p => !p.isBot).length === 0) {
        delete rooms[socket.roomCode];
        return;
      }

      if (room.status === 'playing') {
        if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;
        if (pIdx < room.currentPlayerIndex) room.currentPlayerIndex--;
        addMessage(room, pName + ' disconnected');
        broadcastGameState(room);
        setTimeout(() => checkBotTurn(room), 500);
      }

      if (room.host === socket.id && room.players.length > 0) {
        const nextHost = room.players.find(p => !p.isBot);
        if (nextHost) room.host = nextHost.id;
      }
    }

    const sIdx = room.spectators.findIndex(s => s.id === socket.id);
    if (sIdx !== -1) room.spectators.splice(sIdx, 1);

    io.to(room.code).emit('room-update', getPublicRoomState(room));
  });
});

// ===== STATS API =====
app.get('/stats', (req, res) => {
  const today = getToday();
  const todayStats = traffic.dailyStats[today] || { visitors: 0, games: 0 };
  res.json({
    onlineNow: io.engine.clientsCount,
    totalConnections: traffic.totalConnections,
    uniqueVisitors: traffic.uniqueVisitors.size,
    gamesCreated: traffic.gamesCreated,
    gamesStarted: traffic.gamesStarted,
    gamesCompleted: traffic.gamesCompleted,
    peakConcurrent: traffic.peakConcurrent,
    today: { date: today, visitors: todayStats.visitors, games: todayStats.games },
    activeRooms: Object.keys(rooms).length
  });
});

app.get('/stats-dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UNO Ultimate - Live Stats</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
h1 { text-align: center; margin-bottom: 10px; font-size: 28px; }
.subtitle { text-align: center; color: #a0aec0; margin-bottom: 30px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
.card { background: #16213e; padding: 20px; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
.card.live { border-color: #2ecc71; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(46,204,113,0.3); } 50% { box-shadow: 0 0 20px rgba(46,204,113,0.2); } }
.number { font-size: 36px; font-weight: 900; margin: 10px 0; }
.label { font-size: 12px; color: #a0aec0; text-transform: uppercase; letter-spacing: 1px; }
.online { color: #2ecc71; }
.games { color: #f1c40f; }
.players { color: #3498db; }
.visitors { color: #e74c3c; }
.refresh { text-align: center; margin-top: 20px; }
.refresh button { background: #e74c3c; color: white; border: none; padding: 12px 30px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <h1>UNO Ultimate Stats</h1>
  <p class="subtitle">Real-time game analytics</p>
  <div class="grid" id="stats-grid">
    <div class="card live">
      <div class="label">Online Now</div>
      <div class="number online" id="online">-</div>
    </div>
    <div class="card">
      <div class="label">Total Connections</div>
      <div class="number visitors" id="total">-</div>
    </div>
    <div class="card">
      <div class="label">Unique Visitors</div>
      <div class="number visitors" id="unique">-</div>
    </div>
    <div class="card">
      <div class="label">Games Created</div>
      <div class="number games" id="created">-</div>
    </div>
    <div class="card">
      <div class="label">Games Started</div>
      <div class="number games" id="started">-</div>
    </div>
    <div class="card">
      <div class="label">Games Completed</div>
      <div class="number games" id="completed">-</div>
    </div>
    <div class="card">
      <div class="label">Peak Concurrent</div>
      <div class="number players" id="peak">-</div>
    </div>
    <div class="card">
      <div class="label">Today's Visitors</div>
      <div class="number visitors" id="today">-</div>
    </div>
  </div>
  <div class="refresh">
    <button onclick="loadStats()">Refresh Stats</button>
  </div>
  <div class="footer">
    Updates automatically every 5 seconds<br>
    <span id="last-update"></span>
  </div>
</div>
<script>
async function loadStats() {
  try {
    const res = await fetch('/stats');
    const data = await res.json();
    document.getElementById('online').textContent = data.onlineNow;
    document.getElementById('total').textContent = data.totalConnections;
    document.getElementById('unique').textContent = data.uniqueVisitors;
    document.getElementById('created').textContent = data.gamesCreated;
    document.getElementById('started').textContent = data.gamesStarted;
    document.getElementById('completed').textContent = data.gamesCompleted;
    document.getElementById('peak').textContent = data.peakConcurrent;
    document.getElementById('today').textContent = data.today.visitors;
    document.getElementById('last-update').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  } catch(e) { console.error('Failed to load stats', e); }
}
loadStats();
setInterval(loadStats, 5000);
</script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('UNO Ultimate running on port ' + PORT);
});
