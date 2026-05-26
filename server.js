const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// ==================== GAME CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIALS = ['skip', 'reverse', '+2'];
const WILDS = ['wild', 'wild+4'];
const MAX_PLAYERS = 10;
const BOT_DELAY = 1500; // ms before bot acts
const UNO_PENALTY_CARDS = 2;
const WINNING_SCORE = 500;

// ==================== GAME STATE ====================
const rooms = new Map();
const players = new Map(); // socketId -> { roomId, name, isBot, isSpectator }

// ==================== UNO DECK GENERATOR ====================
function createDeck() {
  const deck = [];

  // Number cards (0-9, two of each 1-9, one 0 per color)
  for (const color of COLORS) {
    deck.push({ type: 'number', color, value: 0, id: uuidv4() });
    for (let val = 1; val <= 9; val++) {
      deck.push({ type: 'number', color, value: val, id: uuidv4() });
      deck.push({ type: 'number', color, value: val, id: uuidv4() });
    }
  }

  // Special cards (2 per color)
  for (const color of COLORS) {
    for (let i = 0; i < 2; i++) {
      for (const special of SPECIALS) {
        deck.push({ type: 'special', color, value: special, id: uuidv4() });
      }
    }
  }

  // Wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'wild', color: 'black', value: 'wild', id: uuidv4() });
    deck.push({ type: 'wild', color: 'black', value: 'wild+4', id: uuidv4() });
  }

  return shuffle(deck);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ==================== ROOM MANAGEMENT ====================
function createRoom(roomId, hostName, hostSocketId, settings = {}) {
  const room = {
    id: roomId,
    hostId: hostSocketId,
    players: [], // { id, name, socketId, hand, score, isBot, isSpectator, saidUno, isActive }
    spectators: [],
    deck: [],
    discard: [],
    currentPlayerIndex: 0,
    direction: 1, // 1 = clockwise, -1 = counter-clockwise
    gameState: 'waiting', // waiting, playing, finished
    winner: null,
    round: 0,
    scores: {}, // playerId -> total score
    settings: {
      maxPlayers: settings.maxPlayers || 10,
      botCount: settings.botCount || 0,
      theme: settings.theme || 'classic',
      allowSpectators: true,
      stackDraw2: settings.stackDraw2 !== false,
      jumpIn: settings.jumpIn === true,
      ...settings
    },
    chat: [],
    lastAction: null,
    pendingDraw: 0, // For stacking +2/+4
    pendingWildColor: null,
    turnLock: false, // Prevents double-turn bugs
    botTimer: null
  };
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room && room.botTimer) clearTimeout(room.botTimer);
  rooms.delete(roomId);
}

// ==================== PLAYER MANAGEMENT ====================
function addPlayerToRoom(room, socketId, name, isBot = false) {
  const playerId = isBot ? `bot-${uuidv4()}` : socketId;
  const player = {
    id: playerId,
    name: isBot ? name : (name || `Player ${room.players.length + 1}`),
    socketId: isBot ? null : socketId,
    hand: [],
    score: 0,
    isBot,
    isSpectator: false,
    saidUno: false,
    isActive: true,
    joinedAt: Date.now()
  };

  if (room.players.length < room.settings.maxPlayers) {
    room.players.push(player);
    if (!isBot) {
      players.set(socketId, { roomId: room.id, playerId, isBot: false, isSpectator: false });
    }
    return player;
  }
  return null;
}

function addSpectatorToRoom(room, socketId, name) {
  const spectator = {
    id: socketId,
    name: name || 'Spectator',
    socketId,
    isSpectator: true,
    joinedAt: Date.now()
  };
  room.spectators.push(spectator);
  players.set(socketId, { roomId: room.id, playerId: socketId, isBot: false, isSpectator: true });
  return spectator;
}

function removePlayerFromRoom(room, socketId) {
  const idx = room.players.findIndex(p => p.socketId === socketId);
  if (idx !== -1) {
    const player = room.players[idx];
    room.players.splice(idx, 1);
    players.delete(socketId);

    // If game is running and it's this player's turn, advance turn
    if (room.gameState === 'playing') {
      if (room.currentPlayerIndex >= room.players.length) {
        room.currentPlayerIndex = 0;
      }
      if (room.players.length === 1) {
        endGame(room, room.players[0].id);
      } else if (room.players.length === 0) {
        deleteRoom(room.id);
        return;
      } else {
        broadcastGameState(room);
        scheduleBotTurn(room);
      }
    }
    return player;
  }

  // Check spectators
  const specIdx = room.spectators.findIndex(s => s.socketId === socketId);
  if (specIdx !== -1) {
    room.spectators.splice(specIdx, 1);
    players.delete(socketId);
  }
  return null;
}

// ==================== GAME LOGIC ====================
function startGame(room) {
  if (room.players.length < 2 && room.players.filter(p => !p.isBot).length < 1) return false;

  room.gameState = 'playing';
  room.round++;
  room.deck = createDeck();
  room.discard = [];
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.winner = null;
  room.pendingDraw = 0;
  room.pendingWildColor = null;
  room.turnLock = false;

  // Deal 7 cards to each player
  for (const player of room.players) {
    player.hand = [];
    player.saidUno = false;
    player.isActive = true;
    for (let i = 0; i < 7; i++) {
      player.hand.push(room.deck.pop());
    }
  }

  // Place first card
  let firstCard = room.deck.pop();
  // If first card is wild, pick random color
  if (firstCard.type === 'wild') {
    firstCard = { ...firstCard, chosenColor: COLORS[Math.floor(Math.random() * 4)] };
  }
  room.discard.push(firstCard);

  // Handle first card effects
  applyFirstCardEffect(room, firstCard);

  broadcastGameState(room);
  scheduleBotTurn(room);
  return true;
}

function applyFirstCardEffect(room, card) {
  if (card.value === 'reverse') {
    room.direction = -1;
  } else if (card.value === 'skip') {
    room.currentPlayerIndex = getNextPlayerIndex(room);
  } else if (card.value === '+2') {
    const target = room.players[room.currentPlayerIndex];
    drawCards(room, target, 2);
    room.currentPlayerIndex = getNextPlayerIndex(room);
  } else if (card.value === 'wild+4') {
    // Redraw if wild+4 is first card (house rule)
    room.discard.pop();
    room.deck.unshift(card);
    room.deck = shuffle(room.deck);
    const newCard = room.deck.pop();
    room.discard.push(newCard);
    if (newCard.type === 'wild') {
      newCard.chosenColor = COLORS[Math.floor(Math.random() * 4)];
    }
    applyFirstCardEffect(room, newCard);
  }
}

function getNextPlayerIndex(room) {
  let next = room.currentPlayerIndex + room.direction;
  if (next >= room.players.length) next = 0;
  if (next < 0) next = room.players.length - 1;
  return next;
}

function getPreviousPlayerIndex(room) {
  let prev = room.currentPlayerIndex - room.direction;
  if (prev >= room.players.length) prev = 0;
  if (prev < 0) prev = room.players.length - 1;
  return prev;
}

function drawCards(room, player, count) {
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discard.length <= 1) break;
      // Reshuffle discard into deck
      const topCard = room.discard.pop();
      room.deck = shuffle(room.discard);
      room.discard = [topCard];
    }
    if (room.deck.length > 0) {
      player.hand.push(room.deck.pop());
    }
  }
  player.saidUno = false;
}

function isValidPlay(card, topCard, pendingDraw) {
  // If pending draw from +2 or +4, must play matching stack card or draw
  if (pendingDraw > 0) {
    return (card.value === '+2' && topCard.value === '+2') || 
           (card.value === 'wild+4' && topCard.value === 'wild+4');
  }

  if (card.type === 'wild') return true;
  if (card.color === topCard.color) return true;
  if (topCard.chosenColor && card.color === topCard.chosenColor) return true;
  if (card.value === topCard.value && card.type !== 'wild') return true;

  return false;
}

function playCard(room, playerId, cardId, chosenColor = null) {
  if (room.turnLock) return { success: false, error: 'Turn is locked' };
  if (room.gameState !== 'playing') return { success: false, error: 'Game not in progress' };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { success: false, error: 'Player not found' };
  if (playerIndex !== room.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = room.players[playerIndex];
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { success: false, error: 'Card not in hand' };

  const card = player.hand[cardIndex];
  const topCard = room.discard[room.discard.length - 1];

  if (!isValidPlay(card, topCard, room.pendingDraw)) {
    return { success: false, error: 'Invalid play' };
  }

  // Lock turn to prevent double-play bugs
  room.turnLock = true;

  // Remove card from hand
  player.hand.splice(cardIndex, 1);

  // Set chosen color for wild cards
  if (card.type === 'wild') {
    card.chosenColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
  }

  room.discard.push(card);
  room.lastAction = {
    type: 'play',
    playerId: player.id,
    playerName: player.name,
    card: { ...card },
    timestamp: Date.now()
  };

  // Check for UNO
  if (player.hand.length === 1 && !player.saidUno) {
    // Penalty for not saying UNO
    drawCards(room, player, UNO_PENALTY_CARDS);
    addChatMessage(room, 'system', `${player.name} forgot to say UNO! +2 cards`);
  }

  // Check win condition
  if (player.hand.length === 0) {
    endRound(room, player);
    room.turnLock = false;
    return { success: true, roundEnded: true, winner: player.id };
  }

  // Apply card effects
  let skipNext = false;
  let drawCount = 0;
  let reverseDirection = false;

  if (card.value === 'skip') {
    skipNext = true;
  } else if (card.value === 'reverse') {
    reverseDirection = true;
    room.direction *= -1;
    // In 2-player game, reverse acts like skip
    if (room.players.length === 2) skipNext = true;
  } else if (card.value === '+2') {
    if (room.settings.stackDraw2 && room.pendingDraw > 0) {
      room.pendingDraw += 2;
    } else {
      room.pendingDraw = 2;
    }
  } else if (card.value === 'wild+4') {
    room.pendingDraw = 4;
  }

  // Move to next player
  let nextIndex = getNextPlayerIndex(room);

  if (skipNext) {
    nextIndex = getNextPlayerIndex(room);
    room.currentPlayerIndex = nextIndex;
  } else {
    room.currentPlayerIndex = nextIndex;
  }

  // Handle pending draw
  if (room.pendingDraw > 0) {
    const nextPlayer = room.players[room.currentPlayerIndex];
    // Check if next player can stack
    const canStack = nextPlayer.hand.some(c => 
      (c.value === '+2' && card.value === '+2') || 
      (c.value === 'wild+4' && card.value === 'wild+4')
    );
    if (!canStack || !room.settings.stackDraw2) {
      drawCards(room, nextPlayer, room.pendingDraw);
      addChatMessage(room, 'system', `${nextPlayer.name} draws ${room.pendingDraw} cards`);
      room.pendingDraw = 0;
      room.currentPlayerIndex = getNextPlayerIndex(room);
    }
  }

  room.turnLock = false;
  broadcastGameState(room);
  scheduleBotTurn(room);

  return { success: true, effects: { skipNext, reverseDirection, drawCount } };
}

function drawCardAction(room, playerId) {
  if (room.turnLock) return { success: false, error: 'Turn is locked' };
  if (room.gameState !== 'playing') return { success: false, error: 'Game not in progress' };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { success: false, error: 'Player not found' };
  if (playerIndex !== room.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  room.turnLock = true;
  const player = room.players[playerIndex];

  // If pending draw, must draw that amount
  if (room.pendingDraw > 0) {
    drawCards(room, player, room.pendingDraw);
    addChatMessage(room, 'system', `${player.name} draws ${room.pendingDraw} cards`);
    room.pendingDraw = 0;
  } else {
    drawCards(room, player, 1);
  }

  // After drawing, check if drawn card can be played immediately
  const topCard = room.discard[room.discard.length - 1];
  const drawnCard = player.hand[player.hand.length - 1];

  if (isValidPlay(drawnCard, topCard, 0)) {
    // Player can choose to play it or pass
    room.turnLock = false;
    broadcastGameState(room);
    return { success: true, canPlayDrawn: true, drawnCard };
  }

  // Pass turn
  room.currentPlayerIndex = getNextPlayerIndex(room);
  room.turnLock = false;
  broadcastGameState(room);
  scheduleBotTurn(room);

  return { success: true, canPlayDrawn: false };
}

function sayUno(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;
  if (player.hand.length === 1) {
    player.saidUno = true;
    addChatMessage(room, 'system', `${player.name} says UNO! 🔥`);
    broadcastGameState(room);
    return true;
  }
  return false;
}

function endRound(room, winner) {
  // Calculate scores from other players' hands
  let roundScore = 0;
  for (const player of room.players) {
    if (player.id === winner.id) continue;
    for (const card of player.hand) {
      if (card.type === 'number') roundScore += card.value;
      else if (card.type === 'special') roundScore += 20;
      else if (card.type === 'wild') roundScore += 50;
    }
  }

  winner.score += roundScore;
  if (!room.scores[winner.id]) room.scores[winner.id] = 0;
  room.scores[winner.id] += roundScore;

  room.gameState = 'roundend';
  room.winner = winner.id;

  addChatMessage(room, 'system', `🏆 ${winner.name} wins the round! +${roundScore} points`);

  // Check if game winner
  if (room.scores[winner.id] >= WINNING_SCORE) {
    room.gameState = 'finished';
    addChatMessage(room, 'system', `🎉🎉🎉 ${winner.name} WINS THE GAME! 🎉🎉🎉`);
  }

  broadcastGameState(room);
}

function endGame(room, winnerId) {
  room.gameState = 'finished';
  room.winner = winnerId;
  broadcastGameState(room);
}

function startNextRound(room) {
  if (room.gameState !== 'roundend' && room.gameState !== 'finished') return;
  if (room.gameState === 'finished') {
    // Reset scores for new game
    room.scores = {};
    room.round = 0;
  }
  startGame(room);
}

// ==================== BOT AI ====================
function scheduleBotTurn(room) {
  if (room.botTimer) clearTimeout(room.botTimer);

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot) return;
  if (room.gameState !== 'playing') return;

  room.botTimer = setTimeout(() => {
    botPlayTurn(room);
  }, BOT_DELAY + Math.random() * 1000);
}

function botPlayTurn(room) {
  if (room.gameState !== 'playing') return;
  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot) return;
  if (room.turnLock) {
    // Try again later if turn is locked
    scheduleBotTurn(room);
    return;
  }

  const topCard = room.discard[room.discard.length - 1];
  const playableCards = currentPlayer.hand.filter(c => isValidPlay(c, topCard, room.pendingDraw));

  if (playableCards.length > 0) {
    // Smart bot strategy
    let chosenCard = selectBestBotCard(playableCards, currentPlayer.hand, room);
    let chosenColor = null;

    if (chosenCard.type === 'wild') {
      chosenColor = selectBestBotColor(currentPlayer.hand);
    }

    // Say UNO if needed
    if (currentPlayer.hand.length === 2) {
      sayUno(room, currentPlayer.id);
    }

    playCard(room, currentPlayer.id, chosenCard.id, chosenColor);
  } else {
    // Must draw
    drawCardAction(room, currentPlayer.id);
  }
}

function selectBestBotCard(playable, hand, room) {
  // Priority: wild+4 > +2 > skip > reverse > wild > high numbers > low numbers
  const priority = { 'wild+4': 6, '+2': 5, 'skip': 4, 'reverse': 3, 'wild': 2 };

  playable.sort((a, b) => {
    const pa = priority[a.value] || (a.type === 'number' ? a.value / 10 : 1);
    const pb = priority[b.value] || (b.type === 'number' ? b.value / 10 : 1);
    return pb - pa;
  });

  // If only 2 cards left, prefer non-wild to save for emergency
  if (hand.length === 2) {
    const nonWild = playable.find(c => c.type !== 'wild');
    if (nonWild) return nonWild;
  }

  return playable[0];
}

function selectBestBotColor(hand) {
  const colorCount = {};
  for (const card of hand) {
    if (card.color && card.color !== 'black') {
      colorCount[card.color] = (colorCount[card.color] || 0) + 1;
    }
  }
  let bestColor = COLORS[0];
  let maxCount = 0;
  for (const [color, count] of Object.entries(colorCount)) {
    if (count > maxCount) {
      maxCount = count;
      bestColor = color;
    }
  }
  return bestColor;
}

// ==================== BROADCASTING ====================
function broadcastGameState(room) {
  const topCard = room.discard.length > 0 ? room.discard[room.discard.length - 1] : null;

  for (const player of room.players) {
    if (player.isBot) continue;
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket) continue;

    // Send full state but only this player's hand
    const state = {
      type: 'gameState',
      roomId: room.id,
      gameState: room.gameState,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        score: room.scores[p.id] || 0,
        isBot: p.isBot,
        saidUno: p.saidUno,
        isActive: p.isActive,
        isCurrentPlayer: room.players[room.currentPlayerIndex]?.id === p.id
      })),
      yourPlayerId: player.id,
      yourHand: player.hand,
      currentPlayerId: room.players[room.currentPlayerIndex]?.id || null,
      currentPlayerName: room.players[room.currentPlayerIndex]?.name || null,
      topCard,
      direction: room.direction,
      discardCount: room.discard.length,
      deckCount: room.deck.length,
      round: room.round,
      scores: room.scores,
      winner: room.winner,
      pendingDraw: room.pendingDraw,
      settings: room.settings,
      lastAction: room.lastAction,
      isYourTurn: room.players[room.currentPlayerIndex]?.id === player.id
    };

    socket.emit('gameState', state);
  }

  // Send to spectators (without hands)
  for (const spec of room.spectators) {
    const socket = io.sockets.sockets.get(spec.socketId);
    if (!socket) continue;

    const state = {
      type: 'gameState',
      roomId: room.id,
      gameState: room.gameState,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        score: room.scores[p.id] || 0,
        isBot: p.isBot,
        saidUno: p.saidUno,
        isActive: p.isActive,
        isCurrentPlayer: room.players[room.currentPlayerIndex]?.id === p.id
      })),
      currentPlayerId: room.players[room.currentPlayerIndex]?.id || null,
      currentPlayerName: room.players[room.currentPlayerIndex]?.name || null,
      topCard,
      direction: room.direction,
      discardCount: room.discard.length,
      deckCount: room.deck.length,
      round: room.round,
      scores: room.scores,
      winner: room.winner,
      pendingDraw: room.pendingDraw,
      settings: room.settings,
      lastAction: room.lastAction,
      isSpectator: true
    };

    socket.emit('gameState', state);
  }
}

function broadcastRoomUpdate(room) {
  const update = {
    type: 'roomUpdate',
    roomId: room.id,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      isReady: true
    })),
    spectators: room.spectators.map(s => ({ id: s.id, name: s.name })),
    gameState: room.gameState,
    settings: room.settings
  };

  io.to(room.id).emit('roomUpdate', update);
}

function addChatMessage(room, sender, message, isEmoji = false) {
  const chatMsg = {
    id: uuidv4(),
    sender,
    message,
    isEmoji,
    timestamp: Date.now()
  };
  room.chat.push(chatMsg);
  if (room.chat.length > 100) room.chat.shift();

  io.to(room.id).emit('chatMessage', chatMsg);
}

// ==================== SOCKET HANDLERS ====================
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create room
  socket.on('createRoom', ({ playerName, settings }, callback) => {
    const roomId = generateRoomCode();
    const room = createRoom(roomId, playerName, socket.id, settings);

    socket.join(roomId);
    const player = addPlayerToRoom(room, socket.id, playerName);

    // Add bots if requested
    if (settings && settings.botCount > 0) {
      for (let i = 0; i < settings.botCount && i < 3; i++) {
        addPlayerToRoom(room, null, `Bot ${i + 1}`, true);
      }
    }

    broadcastRoomUpdate(room);

    callback({
      success: true,
      roomId,
      playerId: player.id,
      isHost: true
    });
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName, asSpectator }, callback) => {
    const room = getRoom(roomId.toUpperCase());
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    socket.join(roomId);

    if (asSpectator && room.settings.allowSpectators) {
      addSpectatorToRoom(room, socket.id, playerName);
      broadcastRoomUpdate(room);
      broadcastGameState(room);
      callback({ success: true, roomId, isSpectator: true });
      return;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    if (room.gameState === 'playing') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }

    const player = addPlayerToRoom(room, socket.id, playerName);
    broadcastRoomUpdate(room);

    callback({
      success: true,
      roomId,
      playerId: player.id,
      isHost: false
    });
  });

  // Start game
  socket.on('startGame', (callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.hostId !== socket.id) {
      callback({ success: false, error: 'Only host can start' });
      return;
    }

    if (room.players.length < 2) {
      callback({ success: false, error: 'Need at least 2 players' });
      return;
    }

    const success = startGame(room);
    callback({ success });
  });

  // Play card
  socket.on('playCard', ({ cardId, chosenColor }, callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo || playerInfo.isSpectator) {
      callback({ success: false, error: 'Cannot play' });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const result = playCard(room, playerInfo.playerId, cardId, chosenColor);
    callback(result);
  });

  // Draw card
  socket.on('drawCard', (callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo || playerInfo.isSpectator) {
      callback({ success: false, error: 'Cannot draw' });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const result = drawCardAction(room, playerInfo.playerId);
    callback(result);
  });

  // Say UNO
  socket.on('sayUno', (callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo || playerInfo.isSpectator) {
      callback({ success: false });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room) {
      callback({ success: false });
      return;
    }

    const result = sayUno(room, playerInfo.playerId);
    callback({ success: result });
  });

  // Chat message
  socket.on('chatMessage', (message) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const room = getRoom(playerInfo.roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerInfo.playerId) || 
                   room.spectators.find(s => s.id === socket.id);
    if (!player) return;

    addChatMessage(room, player.name, message);
  });

  // Emoji reaction
  socket.on('emojiReaction', (emoji) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const room = getRoom(playerInfo.roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerInfo.playerId) ||
                   room.spectators.find(s => s.id === socket.id);
    if (!player) return;

    io.to(room.id).emit('emojiReaction', {
      playerId: player.id,
      playerName: player.name,
      emoji,
      timestamp: Date.now()
    });
  });

  // Add bot
  socket.on('addBot', (callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room || room.hostId !== socket.id) {
      callback({ success: false, error: 'Only host can add bots' });
      return;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    const botNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'];
    const botName = botNames.find(n => !room.players.some(p => p.name === n)) || `Bot ${room.players.length}`;
    addPlayerToRoom(room, null, botName, true);
    broadcastRoomUpdate(room);
    callback({ success: true });
  });

  // Remove bot
  socket.on('removeBot', ({ botId }, callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room || room.hostId !== socket.id) {
      callback({ success: false });
      return;
    }

    const idx = room.players.findIndex(p => p.id === botId && p.isBot);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      broadcastRoomUpdate(room);
      callback({ success: true });
    } else {
      callback({ success: false });
    }
  });

  // Update settings
  socket.on('updateSettings', (settings, callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room || room.hostId !== socket.id) {
      callback({ success: false });
      return;
    }

    room.settings = { ...room.settings, ...settings };
    broadcastRoomUpdate(room);
    callback({ success: true });
  });

  // Next round
  socket.on('nextRound', (callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room || room.hostId !== socket.id) {
      callback({ success: false });
      return;
    }

    startNextRound(room);
    callback({ success: true });
  });

  // Kick player
  socket.on('kickPlayer', ({ playerId }, callback) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) {
      callback({ success: false });
      return;
    }

    const room = getRoom(playerInfo.roomId);
    if (!room || room.hostId !== socket.id) {
      callback({ success: false });
      return;
    }

    const target = room.players.find(p => p.id === playerId);
    if (target && !target.isBot) {
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit('kicked');
        targetSocket.leave(room.id);
      }
      removePlayerFromRoom(room, target.socketId);
      broadcastRoomUpdate(room);
      callback({ success: true });
    } else if (target && target.isBot) {
      removePlayerFromRoom(room, target.id);
      broadcastRoomUpdate(room);
      callback({ success: true });
    } else {
      callback({ success: false });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const playerInfo = players.get(socket.id);
    if (playerInfo) {
      const room = getRoom(playerInfo.roomId);
      if (room) {
        removePlayerFromRoom(room, socket.id);
        broadcastRoomUpdate(room);

        // Clean up empty rooms
        if (room.players.filter(p => !p.isBot).length === 0 && room.spectators.length === 0) {
          deleteRoom(room.id);
        }
      }
    }
  });
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 UNO Server running on port ${PORT}`);
});
