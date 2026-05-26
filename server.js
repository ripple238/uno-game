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

// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBER_VALUES = ['0','1','2','3','4','5','6','7','8','9'];
const SPECIAL_VALUES = ['skip', 'reverse', 'draw2'];
const WILD_VALUES = ['wild', 'wild4'];
const WINNING_SCORE = 500;
const BOT_DELAY_MIN = 1200;
const BOT_DELAY_MAX = 2500;
const UNO_PENALTY = 2;
const STARTING_CARDS = 7;

// ==================== STATE ====================
const rooms = new Map();
const socketMap = new Map(); // socketId -> { roomId, playerId, isSpectator }

// ==================== DECK ====================
function createDeck() {
  const deck = [];

  for (const color of COLORS) {
    // One zero per color
    deck.push(makeCard('number', color, '0'));
    // Two of each 1-9
    for (let v = 1; v <= 9; v++) {
      deck.push(makeCard('number', color, String(v)));
      deck.push(makeCard('number', color, String(v)));
    }
    // Two of each special per color
    for (const special of SPECIAL_VALUES) {
      deck.push(makeCard('special', color, special));
      deck.push(makeCard('special', color, special));
    }
  }

  // Four wilds and four wild+4
  for (let i = 0; i < 4; i++) {
    deck.push(makeCard('wild', 'black', 'wild'));
    deck.push(makeCard('wild', 'black', 'wild4'));
  }

  return shuffle(deck);
}

function makeCard(type, color, value) {
  return { id: uuidv4(), type, color, value };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==================== ROOM ====================
function createRoom(id, hostSocketId, hostName, settings = {}) {
  const room = {
    id,
    hostId: hostSocketId,
    players: [], // { id, name, socketId, hand, score, isBot, saidUno, avatarColor }
    spectators: [],
    deck: [],
    discard: [],
    currentIdx: 0,
    direction: 1,
    state: 'waiting', // waiting, playing, roundover, finished
    round: 0,
    totalScores: {}, // playerId -> total
    lastWinner: null,
    settings: {
      maxPlayers: Math.min(settings.maxPlayers || 8, 10),
      stackDraw2: settings.stackDraw2 !== false,
      theme: settings.theme || 'classic',
      jumpIn: false,
      ...settings
    },
    chat: [],
    pendingDraw: 0,
    turnLocked: false,
    botTimer: null,
    createdAt: Date.now()
  };
  rooms.set(id, room);
  return room;
}

function destroyRoom(id) {
  const room = rooms.get(id);
  if (room && room.botTimer) clearTimeout(room.botTimer);
  rooms.delete(id);
}

function addPlayer(room, socketId, name, isBot = false) {
  const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6', '#E67E22', '#1ABC9C', '#FF6B9D'];
  const player = {
    id: isBot ? `bot_${uuidv4().slice(0,8)}` : socketId,
    name: isBot ? name : (name || 'Player'),
    socketId: isBot ? null : socketId,
    hand: [],
    score: 0,
    isBot,
    saidUno: false,
    avatarColor: colors[room.players.length % colors.length]
  };
  room.players.push(player);
  if (!isBot) socketMap.set(socketId, { roomId: room.id, playerId: player.id, isSpectator: false });
  return player;
}

function addSpectator(room, socketId, name) {
  const spec = { id: socketId, name: name || 'Spectator', socketId };
  room.spectators.push(spec);
  socketMap.set(socketId, { roomId: room.id, playerId: socketId, isSpectator: true });
  return spec;
}

function removeFromRoom(room, socketId) {
  const pIdx = room.players.findIndex(p => p.socketId === socketId);
  if (pIdx !== -1) {
    const removed = room.players.splice(pIdx, 1)[0];
    socketMap.delete(socketId);

    if (room.state === 'playing') {
      if (room.players.length === 0) {
        destroyRoom(room.id);
        return removed;
      }
      if (room.players.length === 1) {
        endGame(room, room.players[0].id);
        return removed;
      }
      // Adjust current index if needed
      if (room.currentIdx >= room.players.length) room.currentIdx = 0;
      if (pIdx <= room.currentIdx && room.currentIdx > 0) room.currentIdx--;
      broadcastState(room);
      scheduleBot(room);
    }
    return removed;
  }

  const sIdx = room.spectators.findIndex(s => s.socketId === socketId);
  if (sIdx !== -1) {
    room.spectators.splice(sIdx, 1);
    socketMap.delete(socketId);
  }
  return null;
}

// ==================== GAME FLOW ====================
function startGame(room) {
  if (room.players.length < 2) return false;

  room.state = 'playing';
  room.round++;
  room.deck = createDeck();
  room.discard = [];
  room.currentIdx = 0;
  room.direction = 1;
  room.lastWinner = null;
  room.pendingDraw = 0;
  room.turnLocked = false;

  // Deal cards
  for (const p of room.players) {
    p.hand = [];
    p.saidUno = false;
    for (let i = 0; i < STARTING_CARDS; i++) {
      p.hand.push(room.deck.pop());
    }
  }

  // First card
  let first = room.deck.pop();
  if (first.type === 'wild') {
    first = { ...first, chosenColor: COLORS[Math.floor(Math.random() * 4)] };
  }
  room.discard.push(first);

  // Apply first card effects
  applyFirstCard(room, first);

  broadcastState(room);
  scheduleBot(room);
  return true;
}

function applyFirstCard(room, card) {
  if (card.value === 'reverse') {
    room.direction = -1;
    if (room.players.length === 2) room.currentIdx = getNextIdx(room);
  } else if (card.value === 'skip') {
    room.currentIdx = getNextIdx(room);
  } else if (card.value === 'draw2') {
    const target = room.players[room.currentIdx];
    drawCards(room, target, 2);
    room.currentIdx = getNextIdx(room);
  } else if (card.value === 'wild4') {
    // Illegal first card, reshuffle
    room.discard.pop();
    room.deck.unshift(first);
    room.deck = shuffle(room.deck);
    const next = room.deck.pop();
    room.discard.push(next);
    if (next.type === 'wild') next.chosenColor = COLORS[Math.floor(Math.random() * 4)];
    applyFirstCard(room, next);
  }
}

function getNextIdx(room) {
  let n = room.currentIdx + room.direction;
  if (n >= room.players.length) n = 0;
  if (n < 0) n = room.players.length - 1;
  return n;
}

function drawCards(room, player, count) {
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discard.length <= 1) break;
      const top = room.discard.pop();
      room.deck = shuffle(room.discard);
      room.discard = [top];
    }
    if (room.deck.length > 0) player.hand.push(room.deck.pop());
  }
  player.saidUno = false;
}

function canPlay(card, top, pending) {
  if (pending > 0) {
    return (card.value === 'draw2' && top.value === 'draw2') ||
           (card.value === 'wild4' && top.value === 'wild4');
  }
  if (card.type === 'wild') return true;
  if (card.color === top.color) return true;
  if (top.chosenColor && card.color === top.chosenColor) return true;
  if (card.value === top.value && card.type !== 'wild') return true;
  return false;
}

// ==================== PLAYER ACTIONS ====================
function doPlayCard(room, playerId, cardId, chosenColor) {
  if (room.turnLocked) return { ok: false, err: 'Turn processing' };
  if (room.state !== 'playing') return { ok: false, err: 'Not playing' };

  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return { ok: false, err: 'Not found' };
  if (idx !== room.currentIdx) return { ok: false, err: 'Not your turn' };

  const player = room.players[idx];
  const cIdx = player.hand.findIndex(c => c.id === cardId);
  if (cIdx === -1) return { ok: false, err: 'Card not found' };

  const card = player.hand[cIdx];
  const top = room.discard[room.discard.length - 1];

  if (!canPlay(card, top, room.pendingDraw)) {
    return { ok: false, err: 'Invalid card' };
  }

  // LOCK TURN - prevents all race conditions
  room.turnLocked = true;

  // Remove card
  player.hand.splice(cIdx, 1);

  // Set wild color
  if (card.type === 'wild') {
    card.chosenColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
  }

  room.discard.push({ ...card });

  // Check UNO penalty
  if (player.hand.length === 1 && !player.saidUno) {
    drawCards(room, player, UNO_PENALTY);
    addChat(room, 'SYSTEM', `${player.name} forgot UNO! +${UNO_PENALTY} cards`);
  }

  // Check win
  if (player.hand.length === 0) {
    endRound(room, player);
    room.turnLocked = false;
    return { ok: true, roundOver: true };
  }

  // Apply effects
  let skip = false;
  if (card.value === 'skip') skip = true;
  else if (card.value === 'reverse') {
    room.direction *= -1;
    if (room.players.length === 2) skip = true;
  } else if (card.value === 'draw2') {
    if (room.settings.stackDraw2 && room.pendingDraw > 0) room.pendingDraw += 2;
    else room.pendingDraw = 2;
  } else if (card.value === 'wild4') {
    room.pendingDraw = 4;
  }

  // Advance turn
  room.currentIdx = getNextIdx(room);
  if (skip) room.currentIdx = getNextIdx(room);

  // Resolve pending draw
  if (room.pendingDraw > 0) {
    const nextP = room.players[room.currentIdx];
    const canStack = nextP.hand.some(c =>
      (c.value === 'draw2' && card.value === 'draw2') ||
      (c.value === 'wild4' && card.value === 'wild4')
    );
    if (!canStack || !room.settings.stackDraw2) {
      drawCards(room, nextP, room.pendingDraw);
      addChat(room, 'SYSTEM', `${nextP.name} draws ${room.pendingDraw} cards`);
      room.pendingDraw = 0;
      room.currentIdx = getNextIdx(room);
    }
  }

  room.turnLocked = false;
  broadcastState(room);
  scheduleBot(room);
  return { ok: true };
}

function doDrawCard(room, playerId) {
  if (room.turnLocked) return { ok: false, err: 'Turn processing' };
  if (room.state !== 'playing') return { ok: false, err: 'Not playing' };

  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return { ok: false, err: 'Not found' };
  if (idx !== room.currentIdx) return { ok: false, err: 'Not your turn' };

  room.turnLocked = true;
  const player = room.players[idx];

  if (room.pendingDraw > 0) {
    drawCards(room, player, room.pendingDraw);
    addChat(room, 'SYSTEM', `${player.name} draws ${room.pendingDraw} cards`);
    room.pendingDraw = 0;
  } else {
    drawCards(room, player, 1);
  }

  // Check if drawn card is playable
  const top = room.discard[room.discard.length - 1];
  const drawn = player.hand[player.hand.length - 1];
  const playable = canPlay(drawn, top, 0);

  if (!playable) {
    room.currentIdx = getNextIdx(room);
  }

  room.turnLocked = false;
  broadcastState(room);
  scheduleBot(room);
  return { ok: true, playable, drawn };
}

function doSayUno(room, playerId) {
  const p = room.players.find(p => p.id === playerId);
  if (!p) return false;
  if (p.hand.length === 1) {
    p.saidUno = true;
    addChat(room, 'SYSTEM', `🔥 ${p.name} says UNO!`);
    broadcastState(room);
    return true;
  }
  return false;
}

// ==================== ROUND / GAME END ====================
function endRound(room, winner) {
  let pts = 0;
  for (const p of room.players) {
    if (p.id === winner.id) continue;
    for (const c of p.hand) {
      if (c.type === 'number') pts += parseInt(c.value);
      else if (c.type === 'special') pts += 20;
      else pts += 50;
    }
  }

  winner.score += pts;
  room.totalScores[winner.id] = (room.totalScores[winner.id] || 0) + pts;
  room.lastWinner = winner.id;

  if (room.totalScores[winner.id] >= WINNING_SCORE) {
    room.state = 'finished';
    addChat(room, 'SYSTEM', `🎉 ${winner.name} WINS THE GAME! 🎉`);
  } else {
    room.state = 'roundover';
    addChat(room, 'SYSTEM', `🏆 ${winner.name} wins round! +${pts} pts`);
  }

  broadcastState(room);
}

function endGame(room, winnerId) {
  room.state = 'finished';
  room.lastWinner = winnerId;
  broadcastState(room);
}

function nextRound(room) {
  if (room.state === 'finished') room.totalScores = {};
  startGame(room);
}

// ==================== BOT AI ====================
function scheduleBot(room) {
  if (room.botTimer) clearTimeout(room.botTimer);
  const p = room.players[room.currentIdx];
  if (!p || !p.isBot || room.state !== 'playing') return;

  const delay = BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
  room.botTimer = setTimeout(() => botTurn(room), delay);
}

function botTurn(room) {
  if (room.state !== 'playing') return;
  const p = room.players[room.currentIdx];
  if (!p || !p.isBot) return;
  if (room.turnLocked) { scheduleBot(room); return; }

  const top = room.discard[room.discard.length - 1];
  const valid = p.hand.filter(c => canPlay(c, top, room.pendingDraw));

  if (valid.length > 0) {
    // Smart selection
    const card = pickBotCard(valid, p.hand, room);
    let color = null;
    if (card.type === 'wild') color = pickBotColor(p.hand);
    if (p.hand.length === 2) doSayUno(room, p.id);
    doPlayCard(room, p.id, card.id, color);
  } else {
    doDrawCard(room, p.id);
  }
}

function pickBotCard(valid, hand, room) {
  const weights = { wild4: 10, draw2: 8, skip: 6, reverse: 5, wild: 4 };
  valid.sort((a, b) => {
    const wa = weights[a.value] || (a.type === 'number' ? parseInt(a.value) / 10 : 1);
    const wb = weights[b.value] || (b.type === 'number' ? parseInt(b.value) / 10 : 1);
    return wb - wa;
  });
  if (hand.length === 2) {
    const nw = valid.find(c => c.type !== 'wild');
    if (nw) return nw;
  }
  return valid[0];
}

function pickBotColor(hand) {
  const counts = {};
  for (const c of hand) {
    if (c.color && c.color !== 'black') counts[c.color] = (counts[c.color] || 0) + 1;
  }
  let best = COLORS[0], max = 0;
  for (const [col, cnt] of Object.entries(counts)) {
    if (cnt > max) { max = cnt; best = col; }
  }
  return best;
}

// ==================== BROADCAST ====================
function broadcastState(room) {
  const top = room.discard[room.discard.length - 1];
  const currentPid = room.players[room.currentIdx]?.id;

  // To players
  for (const p of room.players) {
    if (p.isBot) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;

    sock.emit('state', {
      roomId: room.id,
      state: room.state,
      round: room.round,
      you: {
        id: p.id,
        hand: p.hand,
        isYourTurn: p.id === currentPid,
        saidUno: p.saidUno
      },
      players: room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        cardCount: pl.hand.length,
        score: room.totalScores[pl.id] || 0,
        isBot: pl.isBot,
        saidUno: pl.saidUno,
        isCurrent: pl.id === currentPid,
        avatarColor: pl.avatarColor
      })),
      spectators: room.spectators.map(s => ({ id: s.id, name: s.name })),
      table: {
        topCard: top,
        deckCount: room.deck.length,
        discardCount: room.discard.length,
        direction: room.direction,
        pendingDraw: room.pendingDraw
      },
      scores: room.totalScores,
      winner: room.lastWinner,
      settings: room.settings
    });
  }

  // To spectators
  for (const s of room.spectators) {
    const sock = io.sockets.sockets.get(s.socketId);
    if (!sock) continue;

    sock.emit('state', {
      roomId: room.id,
      state: room.state,
      round: room.round,
      isSpectator: true,
      players: room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        cardCount: pl.hand.length,
        score: room.totalScores[pl.id] || 0,
        isBot: pl.isBot,
        saidUno: pl.saidUno,
        isCurrent: pl.id === currentPid,
        avatarColor: pl.avatarColor
      })),
      spectators: room.spectators.map(s => ({ id: s.id, name: s.name })),
      table: {
        topCard: top,
        deckCount: room.deck.length,
        discardCount: room.discard.length,
        direction: room.direction,
        pendingDraw: room.pendingDraw
      },
      scores: room.totalScores,
      winner: room.lastWinner,
      settings: room.settings
    });
  }
}

function broadcastRoom(room) {
  io.to(room.id).emit('room', {
    id: room.id,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot, avatarColor: p.avatarColor
    })),
    spectators: room.spectators.map(s => ({ id: s.id, name: s.name })),
    state: room.state,
    settings: room.settings
  });
}

function addChat(room, sender, text) {
  const msg = { id: uuidv4(), sender, text, time: Date.now() };
  room.chat.push(msg);
  if (room.chat.length > 100) room.chat.shift();
  io.to(room.id).emit('chat', msg);
}

// ==================== SOCKET HANDLERS ====================
function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', socket => {

  socket.on('create', ({ name, settings }, cb) => {
    const rid = genCode();
    const room = createRoom(rid, socket.id, name, settings);
    socket.join(rid);
    const p = addPlayer(room, socket.id, name);

    // Add requested bots
    const botCount = settings?.botCount || 0;
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    for (let i = 0; i < botCount && room.players.length < room.settings.maxPlayers; i++) {
      addPlayer(room, null, botNames[i] || `Bot ${i+1}`, true);
    }

    broadcastRoom(room);
    cb({ ok: true, roomId: rid, playerId: p.id });
  });

  socket.on('join', ({ roomId, name, asSpectator }, cb) => {
    const room = rooms.get(roomId?.toUpperCase());
    if (!room) return cb({ ok: false, err: 'Room not found' });

    socket.join(room.id);

    if (asSpectator) {
      addSpectator(room, socket.id, name);
      broadcastRoom(room);
      broadcastState(room);
      return cb({ ok: true, roomId: room.id, isSpectator: true });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return cb({ ok: false, err: 'Room full' });
    }
    if (room.state === 'playing') {
      return cb({ ok: false, err: 'Game in progress' });
    }

    const p = addPlayer(room, socket.id, name);
    broadcastRoom(room);
    cb({ ok: true, roomId: room.id, playerId: p.id });
  });

  socket.on('start', cb => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false, err: 'Not in room' });
    const room = rooms.get(info.roomId);
    if (!room) return cb({ ok: false, err: 'Room gone' });
    if (room.hostId !== socket.id) return cb({ ok: false, err: 'Host only' });
    if (room.players.length < 2) return cb({ ok: false, err: 'Need 2+ players' });

    const ok = startGame(room);
    cb({ ok });
  });

  socket.on('play', ({ cardId, color }, cb) => {
    const info = socketMap.get(socket.id);
    if (!info || info.isSpectator) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room) return cb({ ok: false });
    const res = doPlayCard(room, info.playerId, cardId, color);
    cb(res);
  });

  socket.on('draw', cb => {
    const info = socketMap.get(socket.id);
    if (!info || info.isSpectator) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room) return cb({ ok: false });
    const res = doDrawCard(room, info.playerId);
    cb(res);
  });

  socket.on('uno', cb => {
    const info = socketMap.get(socket.id);
    if (!info || info.isSpectator) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room) return cb({ ok: false });
    cb({ ok: doSayUno(room, info.playerId) });
  });

  socket.on('chat', text => {
    const info = socketMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomId);
    if (!room) return;
    const sender = room.players.find(p => p.id === info.playerId)?.name ||
                   room.spectators.find(s => s.id === socket.id)?.name || 'Unknown';
    addChat(room, sender, text);
  });

  socket.on('emoji', emoji => {
    const info = socketMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomId);
    if (!room) return;
    const p = room.players.find(p => p.id === info.playerId) ||
              room.spectators.find(s => s.id === socket.id);
    if (!p) return;
    io.to(room.id).emit('emoji', { from: p.name, emoji });
  });

  socket.on('addBot', cb => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room || room.hostId !== socket.id) return cb({ ok: false });
    if (room.players.length >= room.settings.maxPlayers) return cb({ ok: false, err: 'Full' });
    const names = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Omega'];
    const used = room.players.map(p => p.name);
    const name = names.find(n => !used.includes(n)) || `Bot ${room.players.length}`;
    addPlayer(room, null, name, true);
    broadcastRoom(room);
    cb({ ok: true });
  });

  socket.on('removeBot', ({ botId }, cb) => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room || room.hostId !== socket.id) return cb({ ok: false });
    const idx = room.players.findIndex(p => p.id === botId && p.isBot);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      if (room.currentIdx >= room.players.length) room.currentIdx = 0;
      broadcastRoom(room);
      if (room.state === 'playing') broadcastState(room);
    }
    cb({ ok: true });
  });

  socket.on('kick', ({ playerId }, cb) => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room || room.hostId !== socket.id) return cb({ ok: false });
    const target = room.players.find(p => p.id === playerId && !p.isBot);
    if (target) {
      const sock = io.sockets.sockets.get(target.socketId);
      if (sock) { sock.emit('kicked'); sock.leave(room.id); }
      removeFromRoom(room, target.socketId);
      broadcastRoom(room);
    }
    cb({ ok: true });
  });

  socket.on('nextRound', cb => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room || room.hostId !== socket.id) return cb({ ok: false });
    nextRound(room);
    cb({ ok: true });
  });

  socket.on('settings', (newSettings, cb) => {
    const info = socketMap.get(socket.id);
    if (!info) return cb({ ok: false });
    const room = rooms.get(info.roomId);
    if (!room || room.hostId !== socket.id) return cb({ ok: false });
    Object.assign(room.settings, newSettings);
    broadcastRoom(room);
    cb({ ok: true });
  });

  socket.on('disconnect', () => {
    const info = socketMap.get(socket.id);
    if (info) {
      const room = rooms.get(info.roomId);
      if (room) {
        removeFromRoom(room, socket.id);
        broadcastRoom(room);
        const humans = room.players.filter(p => !p.isBot).length + room.spectators.length;
        if (humans === 0) destroyRoom(room.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 UNO Server on port ${PORT}`));
