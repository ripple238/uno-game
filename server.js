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
const SPECIAL_CARDS = ['skip', 'reverse', 'draw2'];
const WILD_CARDS = ['wild', 'wild4'];
const CARD_VALUES = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'skip': 20, 'reverse': 20, 'draw2': 20, 'wild': 50, 'wild4': 50
};

const THEMES = {
  classic: { name: 'Classic UNO', bg: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  neon: { name: 'Neon Night', bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  ocean: { name: 'Ocean Blue', bg: 'linear-gradient(135deg, #006994, #0096c7, #48cae4)' },
  sunset: { name: 'Sunset Vibes', bg: 'linear-gradient(135deg, #ff6b6b, #feca57, #ff9ff3)' },
  forest: { name: 'Dark Forest', bg: 'linear-gradient(135deg, #1b4332, #2d6a4f, #40916c)' },
  cyberpunk: { name: 'Cyberpunk', bg: 'linear-gradient(135deg, #0a0a0a, #1a1a2e, #e94560)' }
};

const EMOJIS = ['🔥','👏','😂','😱','🤔','👍','🎉','😭','🤯','💀'];

// ===== STATE =====
const rooms = {};

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
    for (const special of SPECIAL_CARDS) {
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
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (topCard && card.color === topCard.color && topCard.color !== 'wild') return true;
  if (topCard && card.value === topCard.value) return true;
  return false;
}

function getNextPlayerIndex(room, skipCount = 1) {
  let next = room.currentPlayerIndex;
  for (let i = 0; i < skipCount; i++) {
    next = (next + room.direction + room.players.length) % room.players.length;
  }
  return next;
}

function calculateHandValue(hand) {
  return hand.reduce((sum, card) => sum + (CARD_VALUES[card.value] || 0), 0);
}

function refillDeck(room) {
  const top = room.discardPile.pop();
  room.deck = shuffle(room.discardPile);
  room.discardPile = [top];
}

function addMessage(room, text, type = 'system') {
  room.messages.push({ text, type, time: Date.now() });
  if (room.messages.length > 100) room.messages.shift();
}

function getPublicRoomState(room) {
  return {
    code: room.code,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id, name: p.name, cardCount: p.hand.length,
      saidUno: p.saidUno, isBot: p.isBot, isSpectator: p.isSpectator,
      avatar: p.avatar, score: p.score, wins: p.wins
    })),
    spectators: room.spectators.map(s => ({ id: s.id, name: s.name, avatar: s.avatar })),
    status: room.status,
    currentPlayerIndex: room.currentPlayerIndex,
    direction: room.direction,
    currentColor: room.currentColor,
    topCard: room.discardPile[room.discardPile.length - 1],
    discardCount: room.discardPile.length,
    deckCount: room.deck.length,
    messages: room.messages,
    winner: room.winner,
    round: room.round,
    theme: room.theme,
    settings: room.settings,
    gameMode: room.gameMode,
    emojis: EMOJIS
  };
}

function broadcastGameState(room) {
  room.players.forEach((player, index) => {
    const personal = {
      ...getPublicRoomState(room),
      yourHand: player.hand,
      yourIndex: index,
      isYourTurn: index === room.currentPlayerIndex && !player.isBot,
      canPlay: index === room.currentPlayerIndex && !player.isBot
    };
    if (!player.isBot) {
      io.to(player.id).emit('game-state', personal);
    }
  });
  room.spectators.forEach(spec => {
    io.to(spec.id).emit('game-state', {
      ...getPublicRoomState(room),
      allHands: room.players.map(p => p.hand),
      isSpectator: true
    });
  });
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
    this.avatar = '🤖';
  }

  choosePlay(hand, topCard, currentColor) {
    const validCards = hand.map((card, idx) => ({ card, idx }))
      .filter(({ card }) => isValidPlay(card, topCard, currentColor));
    if (validCards.length === 0) return null;
    if (this.difficulty === 'easy') return validCards[Math.floor(Math.random() * validCards.length)];
    validCards.sort((a, b) => {
      const valA = CARD_VALUES[a.card.value] || 0;
      const valB = CARD_VALUES[b.card.value] || 0;
      return valB - valA;
    });
    if (this.difficulty === 'hard' && hand.length <= 3) {
      const nonWild = validCards.find(v => v.card.type !== 'wild');
      if (nonWild) return nonWild;
    }
    return validCards[0];
  }

  chooseColor(hand) {
    const colorCounts = {};
    hand.forEach(card => {
      if (card.color !== 'wild') colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
    });
    const colors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    return colors.length > 0 ? colors[0][0] : COLORS[Math.floor(Math.random() * 4)];
  }
}

const BOT_NAMES = ['Robo','Alpha','Beta','Gamma','Delta','Zeta','Omega','Neo','Cyber','Pixel'];

function addBotToRoom(room, difficulty = 'medium') {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' ' + Math.floor(Math.random() * 99);
  const bot = new AIBot(name, difficulty);
  room.players.push(bot);
  return bot;
}

function botPlayTurn(room) {
  const bot = room.players[room.currentPlayerIndex];
  if (!bot || !bot.isBot) return;
  const topCard = room.discardPile[room.discardPile.length - 1];
  const play = bot.choosePlay(bot.hand, topCard, room.currentColor);

  if (play) {
    setTimeout(() => {
      if (room.status !== 'playing') return;
      executePlay(room, room.currentPlayerIndex, play.idx, bot.chooseColor(bot.hand));
    }, 1500);
  } else {
    setTimeout(() => {
      if (room.status !== 'playing') return;
      if (room.deck.length === 0) refillDeck(room);
      if (room.deck.length > 0) {
        bot.hand.push(room.deck.pop());
        addMessage(room, bot.name + ' drew a card');
        const newTop = room.discardPile[room.discardPile.length - 1];
        const canPlay = isValidPlay(bot.hand[bot.hand.length - 1], newTop, room.currentColor);
        if (canPlay && bot.difficulty !== 'easy') {
          setTimeout(() => {
            if (room.status !== 'playing') return;
            executePlay(room, room.currentPlayerIndex, bot.hand.length - 1, bot.chooseColor(bot.hand));
          }, 1000);
        } else {
          room.currentPlayerIndex = getNextPlayerIndex(room);
          broadcastGameState(room);
          checkBotTurn(room);
        }
      }
    }, 1500);
  }
}

function executePlay(room, playerIndex, cardIndex, chosenColor) {
  const player = room.players[playerIndex];
  if (!player || cardIndex >= player.hand.length) return false;
  const card = player.hand[cardIndex];
  const topCard = room.discardPile[room.discardPile.length - 1];
  if (!isValidPlay(card, topCard, room.currentColor)) return false;

  player.hand.splice(cardIndex, 1);
  room.discardPile.push(card);
  room.currentColor = (card.type === 'wild') ? chosenColor : card.color;

  let skipCount = 1;
  let cardsToDraw = 0;
  let nextIdx = getNextPlayerIndex(room, 0);

  if (card.value === 'skip') {
    skipCount = 2;
    addMessage(room, player.name + ' skipped ' + room.players[nextIdx].name + '!');
  } else if (card.value === 'reverse') {
    room.direction *= -1;
    if (room.players.length === 2) skipCount = 2;
    addMessage(room, player.name + ' reversed direction!');
  } else if (card.value === 'draw2') {
    cardsToDraw = 2;
    addMessage(room, player.name + ' made ' + room.players[nextIdx].name + ' draw 2!');
  } else if (card.value === 'wild4') {
    cardsToDraw = 4;
    addMessage(room, player.name + ' made ' + room.players[nextIdx].name + ' draw 4!');
  } else if (card.type === 'wild') {
    addMessage(room, player.name + ' chose ' + chosenColor + '!');
  }

  if (cardsToDraw > 0) {
    for (let i = 0; i < cardsToDraw; i++) {
      if (room.deck.length === 0) refillDeck(room);
      if (room.deck.length > 0) room.players[nextIdx].hand.push(room.deck.pop());
    }
  }

  if (player.hand.length === 0) {
    endRound(room, player);
    return true;
  }

  if (player.hand.length === 1) {
    if (player.isBot || Math.random() > 0.1) {
      player.saidUno = true;
      addMessage(room, 'UNO! ' + player.name + ' has one card left!');
    } else {
      addMessage(room, player.name + ' forgot UNO! Draw 2 penalty!');
      for (let i = 0; i < 2; i++) {
        if (room.deck.length === 0) refillDeck(room);
        if (room.deck.length > 0) player.hand.push(room.deck.pop());
      }
    }
  }

  room.currentPlayerIndex = getNextPlayerIndex(room, skipCount);
  broadcastGameState(room);
  checkBotTurn(room);
  return true;
}

function checkBotTurn(room) {
  const current = room.players[room.currentPlayerIndex];
  if (current && current.isBot && room.status === 'playing') {
    botPlayTurn(room);
  }
}

function endRound(room, winner) {
  room.status = 'round_end';
  winner.wins++;
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
    room.gameWinner = gameWinner;
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
  while (firstCard.type === 'wild') { remaining.unshift(firstCard); firstCard = remaining.pop(); }

  room.deck = remaining;
  room.discardPile = [firstCard];
  room.currentColor = firstCard.color;
  room.status = 'playing';
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.winner = null;

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
  checkBotTurn(room);
}

function getAvatar(name) {
  const avatars = ['Lion','Tiger','Bear','Koala','Panda','Frog','Octopus','Unicorn','Fox','Wolf','Owl','Butterfly','Turtle','Dino','Dragon','Dragon2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatars[Math.abs(hash) % avatars.length];
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create-room', (data, callback) => {
    const { playerName, settings = {} } = data;
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: socket.id, name: playerName, hand: [], saidUno: false,
        score: 0, wins: 0, isBot: false, isSpectator: false,
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
      gameWinner: null,
      round: 1,
      theme: settings.theme || 'classic',
      settings: {
        targetScore: settings.targetScore || 500,
        botDifficulty: settings.botDifficulty || 'medium',
        allowSpectators: settings.allowSpectators !== false,
        ...settings
      },
      gameMode: settings.gameMode || 'classic'
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

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
      score: 0, wins: 0, isBot: false, isSpectator: false,
      avatar: getAvatar(playerName)
    });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    callback({ success: true, theme: room.theme });
    io.to(roomCode).emit('room-update', getPublicRoomState(room));
  });

  socket.on('spectate-room', (data, callback) => {
    const { roomCode, playerName } = data;
    const room = rooms[roomCode];
    if (!room) return callback({ success: false, error: 'Room not found' });
    if (!room.settings.allowSpectators) return callback({ success: false, error: 'Spectators not allowed' });

    room.spectators.push({
      id: socket.id, name: playerName || 'Spectator',
      avatar: getAvatar(playerName || 'Spectator')
    });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isSpectator = true;

    callback({ success: true, theme: room.theme });
    if (room.status === 'playing' || room.status === 'round_end') {
      socket.emit('game-state', {
        ...getPublicRoomState(room),
        allHands: room.players.map(p => p.hand),
        isSpectator: true
      });
    } else {
      io.to(roomCode).emit('room-update', getPublicRoomState(room));
    }
  });

  socket.on('add-bot', (difficulty, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.host !== socket.id) return callback({ success: false, error: 'Not authorized' });
    if (room.status !== 'waiting') return callback({ success: false, error: 'Game started' });
    if (room.players.length >= 10) return callback({ success: false, error: 'Room full' });

    addBotToRoom(room, difficulty);
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
    if (room.players.filter(p => !p.isBot).length < 1 && room.players.length < 2) {
      return callback({ success: false, error: 'Need at least 2 players' });
    }

    room.players.forEach(p => { p.score = 0; p.wins = 0; });
    room.round = 1;

    const deck = createDeck();
    const { hands, deck: remaining } = dealCards(deck, room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; p.saidUno = false; });

    let firstCard = remaining.pop();
    while (firstCard.type === 'wild') { remaining.unshift(firstCard); firstCard = remaining.pop(); }

    room.deck = remaining;
    room.discardPile = [firstCard];
    room.currentColor = firstCard.color;
    room.status = 'playing';
    room.currentPlayerIndex = 0;
    room.direction = 1;
    room.winner = null;
    room.gameWinner = null;

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
    checkBotTurn(room);
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
    if (player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });
    const success = executePlay(room, room.currentPlayerIndex, cardIndex, chosenColor);
    callback({ success });
  });

  socket.on('draw-card', (_, callback) => {
    const room = rooms[socket.roomCode];
    if (!room || room.status !== 'playing') return callback({ success: false, error: 'Game not active' });
    const player = room.players[room.currentPlayerIndex];
    if (player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });
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
    if (player.id !== socket.id) return callback({ success: false, error: 'Not your turn' });
    room.currentPlayerIndex = getNextPlayerIndex(room);
    addMessage(room, player.name + ' passed');
    callback({ success: true });
    broadcastGameState(room);
    checkBotTurn(room);
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
    const player = room.players.find(p => p.id === socket.id) || room.spectators.find(s => s.id === socket.id);
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

  socket.on('play-sound', (sound) => {
    const room = rooms[socket.roomCode];
    if (room) io.to(room.code).emit('sound', sound);
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    const pIdx = room.players.findIndex(p => p.id === socket.id);
    if (pIdx !== -1 && !room.players[pIdx].isBot) {
      const pName = room.players[pIdx].name;
      room.players.splice(pIdx, 1);

      if (room.players.filter(p => !p.isBot).length === 0 && room.spectators.length === 0) {
        delete rooms[socket.roomCode];
        return;
      }

      if (room.status === 'playing') {
        if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;
        if (pIdx < room.currentPlayerIndex) room.currentPlayerIndex--;
        addMessage(room, pName + ' disconnected');
        broadcastGameState(room);
        checkBotTurn(room);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('UNO Ultimate running on port ' + PORT);
});
