const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

// ===================== GAME CONSTANTS =====================
const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_VALUES = {
  red: '#ff5555',
  yellow: '#ffaa00',
  green: '#55aa55',
  blue: '#5555ff'
};

const CARD_TYPES = {
  NUMBER: 'number',
  SKIP: 'skip',
  REVERSE: 'reverse',
  DRAW_TWO: '+2',
  WILD: 'wild',
  WILD_DRAW_FOUR: '+4'
};

const POINTS = {
  number: (n) => parseInt(n),
  skip: 20,
  reverse: 20,
  '+2': 20,
  wild: 50,
  '+4': 50
};

// ===================== DECK GENERATOR =====================
function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    // One zero per color
    deck.push({ color, type: CARD_TYPES.NUMBER, value: '0', id: `${color}-0-1` });
    // Two of each 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, type: CARD_TYPES.NUMBER, value: String(i), id: `${color}-${i}-1` });
      deck.push({ color, type: CARD_TYPES.NUMBER, value: String(i), id: `${color}-${i}-2` });
    }
    // Two of each action per color
    for (let i = 0; i < 2; i++) {
      deck.push({ color, type: CARD_TYPES.SKIP, value: 'skip', id: `${color}-skip-${i}` });
      deck.push({ color, type: CARD_TYPES.REVERSE, value: 'reverse', id: `${color}-reverse-${i}` });
      deck.push({ color, type: CARD_TYPES.DRAW_TWO, value: '+2', id: `${color}-+2-${i}` });
    }
  }
  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: CARD_TYPES.WILD, value: 'wild', id: `wild-${i}` });
    deck.push({ color: 'wild', type: CARD_TYPES.WILD_DRAW_FOUR, value: '+4', id: `wild-+4-${i}` });
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

function drawCards(deck, discard, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      const top = discard.pop();
      deck.push(...shuffle(discard));
      discard.length = 0;
      discard.push(top);
    }
    if (deck.length > 0) drawn.push(deck.pop());
  }
  return drawn;
}

// ===================== ROOM / GAME MANAGER =====================
const rooms = new Map();
const ROOM_TTL = 1000 * 60 * 60 * 4; // 4 hours

class UnoRoom {
  constructor(code, hostSocketId, settings = {}) {
    this.code = code;
    this.host = hostSocketId;
    this.createdAt = Date.now();

    // Settings
    this.maxPlayers = Math.min(Math.max(settings.maxPlayers || 6, 2), 8);
    this.totalRounds = settings.totalRounds || 7;
    this.targetScore = settings.targetScore || 500;
    this.turnTimeLimit = settings.turnTimeLimit || 30000;
    this.allowStacking = settings.allowStacking !== false;
    this.allowJumpIn = settings.allowJumpIn === true;
    this.theme = settings.theme || 'classic';

    // State
    this.status = 'lobby'; // lobby, playing, roundover, matchend
    this.players = [];     // { socketId, name, avatar, isBot, isSpectator, connected }
    this.spectators = [];  // sockets watching
    this.game = null;      // active game state
    this.chat = [];
    this.reactions = [];
    this.botTimer = null;
    this.turnTimer = null;
    this.turnDeadline = null;
  }

  addPlayer(socketId, name, isBot = false) {
    if (this.players.length >= this.maxPlayers && !isBot) return false;
    const avatar = this.generateAvatar(name);
    const player = {
      socketId: isBot ? `bot-${Date.now()}-${Math.random()}` : socketId,
      name: name || (isBot ? `Bot ${this.players.filter(p => p.isBot).length + 1}` : 'Player'),
      avatar,
      isBot,
      isSpectator: false,
      connected: true,
      hand: [],
      score: 0,
      saidUno: false,
      hasDrawnThisTurn: false
    };
    this.players.push(player);
    return player;
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) {
      this.spectators = this.spectators.filter(s => s !== socketId);
      return;
    }
    const player = this.players[idx];
    if (this.status === 'playing' && !player.isBot) {
      // Convert to bot so game can continue
      player.isBot = true;
      player.connected = false;
      player.name = player.name + ' (Bot)';
      this.broadcast('playerBecameBot', { socketId: player.socketId, name: player.name });
      if (this.isCurrentPlayer(player.socketId)) {
        this.scheduleBotTurn();
      }
    } else {
      this.players.splice(idx, 1);
    }
    this.checkEmpty();
  }

  addSpectator(socketId) {
    if (!this.spectators.includes(socketId)) {
      this.spectators.push(socketId);
    }
  }

  generateAvatar(name) {
    const hue = Math.floor(((name.charCodeAt(0) || 65) * 137) % 360);
    return { type: 'initial', text: name?.[0]?.toUpperCase() || '?', hue };
  }

  isCurrentPlayer(socketId) {
    if (!this.game) return false;
    const current = this.players[this.game.currentPlayerIndex];
    return current && current.socketId === socketId;
  }

  getPlayerBySocket(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  getPublicState(forSocketId = null) {
    const player = this.getPlayerBySocket(forSocketId);
    return {
      code: this.code,
      status: this.status,
      theme: this.theme,
      settings: {
        maxPlayers: this.maxPlayers,
        totalRounds: this.totalRounds,
        targetScore: this.targetScore,
        turnTimeLimit: this.turnTimeLimit,
        allowStacking: this.allowStacking
      },
      players: this.players.map(p => ({
        socketId: p.socketId,
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        isSpectator: p.isSpectator,
        connected: p.connected,
        cardCount: p.hand?.length || 0,
        score: p.score || 0,
        saidUno: p.saidUno || false
      })),
      spectatorsCount: this.spectators.length,
      you: player ? {
        socketId: player.socketId,
        hand: player.hand || [],
        saidUno: player.saidUno || false,
        isSpectator: false
      } : (this.spectators.includes(forSocketId) ? { isSpectator: true } : null),
      game: this.game ? {
        round: this.game.round,
        direction: this.game.direction,
        currentPlayerSocketId: this.players[this.game.currentPlayerIndex]?.socketId || null,
        currentPlayerName: this.players[this.game.currentPlayerIndex]?.name || null,
        topCard: this.game.discard[this.game.discard.length - 1] || null,
        wildColor: this.game.wildColor || null,
        drawStack: this.game.drawStack || 0,
        deckCount: this.game.deck.length,
        discardCount: this.game.discard.length,
        lastAction: this.game.lastAction || null
      } : null,
      chat: this.chat.slice(-50),
      turnDeadline: this.turnDeadline
    };
  }

  broadcast(event, data, excludeSocketId = null) {
    const room = io.sockets.adapter.rooms.get(this.code);
    if (!room) return;
    for (const socketId of room) {
      if (excludeSocketId && socketId === excludeSocketId) continue;
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit(event, data);
    }
  }

  emitTo(socketId, event, data) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.emit(event, data);
  }

  checkEmpty() {
    const activeHumans = this.players.filter(p => !p.isBot && p.connected).length;
    if (activeHumans === 0 && this.spectators.length === 0) {
      rooms.delete(this.code);
    }
  }

  // ===================== GAME LOGIC =====================
  startGame() {
    if (this.players.length < 2) return false;
    this.status = 'playing';
    this.game = {
      round: 1,
      deck: createDeck(),
      discard: [],
      direction: 1,
      currentPlayerIndex: 0,
      drawStack: 0,
      wildColor: null,
      lastAction: null,
      roundWinner: null
    };

    // Reset players
    for (const p of this.players) {
      p.hand = [];
      p.saidUno = false;
      p.hasDrawnThisTurn = false;
    }

    // Deal 7 cards
    for (const p of this.players) {
      p.hand = drawCards(this.game.deck, this.game.discard, 7);
    }

    // Initial discard
    let starter = drawCards(this.game.deck, this.game.discard, 1)[0];
    // If wild, random color
    if (starter.type === CARD_TYPES.WILD || starter.type === CARD_TYPES.WILD_DRAW_FOUR) {
      starter = { ...starter, chosenColor: COLORS[Math.floor(Math.random() * 4)] };
      this.game.wildColor = starter.chosenColor;
    }
    this.game.discard.push(starter);

    // Handle initial action card effects
    this.resolveInitialCard(starter);

    this.broadcast('gameStarted', this.getPublicState());
    this.startTurnTimer();
    return true;
  }

  resolveInitialCard(card) {
    if (card.type === CARD_TYPES.REVERSE && this.players.length === 2) {
      // In 2-player, reverse acts as skip
      this.advanceTurn();
    } else if (card.type === CARD_TYPES.REVERSE) {
      this.game.direction = -1;
    } else if (card.type === CARD_TYPES.SKIP) {
      this.advanceTurn();
    } else if (card.type === CARD_TYPES.DRAW_TWO) {
      this.game.drawStack = 2;
    } else if (card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      // Illegal to start with +4, but if it happens, treat as wild
      this.game.drawStack = 0;
    }
  }

  startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.botTimer) clearTimeout(this.botTimer);
    this.turnDeadline = Date.now() + this.turnTimeLimit;

    const current = this.players[this.game.currentPlayerIndex];
    if (!current) return;

    this.broadcast('turnStarted', {
      playerSocketId: current.socketId,
      playerName: current.name,
      deadline: this.turnDeadline,
      drawStack: this.game.drawStack
    });

    if (current.isBot) {
      this.scheduleBotTurn();
    } else {
      this.turnTimer = setTimeout(() => {
        this.handleTimeout();
      }, this.turnTimeLimit);
    }
  }

  scheduleBotTurn() {
    if (this.botTimer) clearTimeout(this.botTimer);
    const delay = 1200 + Math.random() * 1500;
    this.botTimer = setTimeout(() => this.executeBotTurn(), delay);
  }

  handleTimeout() {
    const current = this.players[this.game.currentPlayerIndex];
    if (!current || current.isBot) return;

    // Auto-draw if draw stack exists, else auto-draw 1 and skip
    if (this.game.drawStack > 0) {
      const drawn = drawCards(this.game.deck, this.game.discard, this.game.drawStack);
      current.hand.push(...drawn);
      this.game.drawStack = 0;
      this.game.lastAction = { type: 'timeoutDraw', player: current.name, count: drawn.length };
      this.broadcast('playerDrewCards', { socketId: current.socketId, count: drawn.length, reason: 'timeout' });
    } else {
      const drawn = drawCards(this.game.deck, this.game.discard, 1);
      if (drawn.length > 0) current.hand.push(...drawn);
      this.game.lastAction = { type: 'timeoutDraw', player: current.name, count: drawn.length };
      this.broadcast('playerDrewCards', { socketId: current.socketId, count: drawn.length, reason: 'timeout' });
    }
    current.hasDrawnThisTurn = false;
    this.advanceTurn();
    this.broadcast('gameUpdate', this.getPublicState());
    this.startTurnTimer();
  }

  advanceTurn() {
    if (!this.game) return;
    let steps = 1;
    // Skip handling: if top card is skip and just played, we already advance in playCard
    // But we need to handle reverse direction
    this.game.currentPlayerIndex = (this.game.currentPlayerIndex + this.game.direction + this.players.length) % this.players.length;

    // Reset per-turn flags
    const current = this.players[this.game.currentPlayerIndex];
    if (current) {
      current.hasDrawnThisTurn = false;
      current.saidUno = current.hand.length === 1 ? current.saidUno : false;
    }
  }

  canPlay(card, topCard, wildColor, drawStack) {
    // If draw stack exists, must play +2 or +4 (if stacking enabled)
    if (drawStack > 0 && this.allowStacking) {
      return card.type === CARD_TYPES.DRAW_TWO || card.type === CARD_TYPES.WILD_DRAW_FOUR;
    }
    if (drawStack > 0 && !this.allowStacking) {
      return false; // must draw, handled separately
    }

    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      // +4 can only be played if no matching color in hand (rule enforcement optional)
      return true;
    }

    const effectiveColor = wildColor || topCard?.color;
    if (card.color === effectiveColor) return true;
    if (topCard && card.type === topCard.type && card.type !== CARD_TYPES.NUMBER && card.value === topCard.value) return true;
    if (card.type === CARD_TYPES.NUMBER && topCard?.type === CARD_TYPES.NUMBER && card.value === topCard.value) return true;

    return false;
  }

  playCard(socketId, cardId, chosenColor = null) {
    if (this.status !== 'playing') return { error: 'Game not active' };
    if (!this.isCurrentPlayer(socketId)) return { error: 'Not your turn' };

    const player = this.getPlayerBySocket(socketId);
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const topCard = this.game.discard[this.game.discard.length - 1];

    if (!this.canPlay(card, topCard, this.game.wildColor, this.game.drawStack)) {
      return { error: 'Invalid play' };
    }

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    // Handle wild color
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      if (!chosenColor || !COLORS.includes(chosenColor)) {
        // Put card back and ask for color
        player.hand.splice(cardIndex, 0, card);
        return { needsColor: true, cardId };
      }
      card.chosenColor = chosenColor;
      this.game.wildColor = chosenColor;
    } else {
      this.game.wildColor = null;
    }

    this.game.discard.push(card);
    this.game.lastAction = { type: 'play', player: player.name, card };

    // UNO penalty check: if 1 card left and didn't say UNO before playing
    if (player.hand.length === 1 && !player.saidUno) {
      // Penalty: draw 2
      const penalty = drawCards(this.game.deck, this.game.discard, 2);
      player.hand.push(...penalty);
      this.broadcast('unoPenalty', { socketId: player.socketId, name: player.name, count: penalty.length });
    }
    player.saidUno = false;

    // Check win
    if (player.hand.length === 0) {
      this.endRound(player);
      return { success: true, roundEnded: true };
    }

    // Apply card effects
    this.applyCardEffects(card);

    // Advance turn
    this.advanceTurn();

    this.broadcast('cardPlayed', {
      socketId: player.socketId,
      card,
      nextPlayerSocketId: this.players[this.game.currentPlayerIndex]?.socketId,
      nextPlayerName: this.players[this.game.currentPlayerIndex]?.name
    });
    this.broadcast('gameUpdate', this.getPublicState());
    this.startTurnTimer();
    return { success: true };
  }

  applyCardEffects(card) {
    switch (card.type) {
      case CARD_TYPES.SKIP:
        this.advanceTurn();
        break;
      case CARD_TYPES.REVERSE:
        this.game.direction *= -1;
        if (this.players.length === 2) {
          this.advanceTurn(); // acts as skip in 2-player
        }
        break;
      case CARD_TYPES.DRAW_TWO:
        this.game.drawStack += 2;
        break;
      case CARD_TYPES.WILD_DRAW_FOUR:
        this.game.drawStack += 4;
        break;
    }
  }

  drawCard(socketId) {
    if (this.status !== 'playing') return { error: 'Game not active' };
    if (!this.isCurrentPlayer(socketId)) return { error: 'Not your turn' };

    const player = this.getPlayerBySocket(socketId);

    // If draw stack exists, must draw the stack
    if (this.game.drawStack > 0) {
      const drawn = drawCards(this.game.deck, this.game.discard, this.game.drawStack);
      player.hand.push(...drawn);
      this.game.drawStack = 0;
      this.game.lastAction = { type: 'drawStack', player: player.name, count: drawn.length };
      this.broadcast('playerDrewCards', { socketId: player.socketId, count: drawn.length, reason: 'stack' });
      player.hasDrawnThisTurn = true;
      this.advanceTurn();
      this.broadcast('gameUpdate', this.getPublicState());
      this.startTurnTimer();
      return { success: true, drawn };
    }

    // Normal draw
    if (player.hasDrawnThisTurn) {
      // Already drew, must skip
      player.hasDrawnThisTurn = false;
      this.advanceTurn();
      this.broadcast('gameUpdate', this.getPublicState());
      this.startTurnTimer();
      return { success: true, skipped: true };
    }

    const drawn = drawCards(this.game.deck, this.game.discard, 1);
    if (drawn.length === 0) {
      // No cards left, skip
      this.advanceTurn();
      this.broadcast('gameUpdate', this.getPublicState());
      this.startTurnTimer();
      return { success: true, skipped: true };
    }

    player.hand.push(...drawn);
    player.hasDrawnThisTurn = true;
    this.game.lastAction = { type: 'draw', player: player.name, count: drawn.length };

    // Check if drawn card is playable
    const topCard = this.game.discard[this.game.discard.length - 1];
    const canPlayDrawn = this.canPlay(drawn[0], topCard, this.game.wildColor, this.game.drawStack);

    this.broadcast('playerDrewCards', { socketId: player.socketId, count: drawn.length, reason: 'normal', autoPlay: canPlayDrawn });
    this.broadcast('gameUpdate', this.getPublicState());

    // If not playable, auto-advance after short delay (or let player click skip)
    if (!canPlayDrawn) {
      // Auto-skip after 2 seconds if they don't play
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = setTimeout(() => {
        if (this.isCurrentPlayer(socketId)) {
          player.hasDrawnThisTurn = false;
          this.advanceTurn();
          this.broadcast('gameUpdate', this.getPublicState());
          this.startTurnTimer();
        }
      }, 2000);
    }

    return { success: true, drawn, canPlay: canPlayDrawn };
  }

  sayUno(socketId) {
    const player = this.getPlayerBySocket(socketId);
    if (!player || player.hand.length !== 1) return { error: 'Cannot say UNO now' };
    player.saidUno = true;
    this.broadcast('saidUno', { socketId, name: player.name });
    this.broadcast('gameUpdate', this.getPublicState());
    return { success: true };
  }

  endRound(winner) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.botTimer) clearTimeout(this.botTimer);

    // Calculate points
    let roundPoints = 0;
    for (const p of this.players) {
      for (const c of p.hand) {
        if (c.type === CARD_TYPES.NUMBER) roundPoints += POINTS.number(c.value);
        else roundPoints += POINTS[c.type] || 0;
      }
    }
    winner.score += roundPoints;
    this.game.roundWinner = { socketId: winner.socketId, name: winner.name, points: roundPoints, totalScore: winner.score };

    this.broadcast('roundEnded', {
      winner: this.game.roundWinner,
      players: this.players.map(p => ({ socketId: p.socketId, name: p.name, score: p.score, hand: p.hand })),
      round: this.game.round
    });

    // Check match end
    if (winner.score >= this.targetScore || this.game.round >= this.totalRounds) {
      const matchWinner = this.players.reduce((a, b) => (a.score > b.score ? a : b));
      this.status = 'matchend';
      this.broadcast('matchEnded', {
        winner: { socketId: matchWinner.socketId, name: matchWinner.name, score: matchWinner.score },
        finalScores: this.players.map(p => ({ socketId: p.socketId, name: p.name, score: p.score }))
      });
      return;
    }

    // Next round
    this.status = 'roundover';
    setTimeout(() => this.startNextRound(), 5000);
  }

  startNextRound() {
    this.game.round++;
    this.game.deck = createDeck();
    this.game.discard = [];
    this.game.direction = 1;
    this.game.currentPlayerIndex = (this.game.round - 1) % this.players.length;
    this.game.drawStack = 0;
    this.game.wildColor = null;
    this.game.lastAction = null;
    this.game.roundWinner = null;

    for (const p of this.players) {
      p.hand = drawCards(this.game.deck, this.game.discard, 7);
      p.saidUno = false;
      p.hasDrawnThisTurn = false;
    }

    let starter = drawCards(this.game.deck, this.game.discard, 1)[0];
    if (starter.type === CARD_TYPES.WILD || starter.type === CARD_TYPES.WILD_DRAW_FOUR) {
      starter = { ...starter, chosenColor: COLORS[Math.floor(Math.random() * 4)] };
      this.game.wildColor = starter.chosenColor;
    }
    this.game.discard.push(starter);
    this.resolveInitialCard(starter);

    this.status = 'playing';
    this.broadcast('roundStarted', this.getPublicState());
    this.startTurnTimer();
  }

  // ===================== BOT AI =====================
  executeBotTurn() {
    if (this.status !== 'playing') return;
    const bot = this.players[this.game.currentPlayerIndex];
    if (!bot || !bot.isBot) return;

    const topCard = this.game.discard[this.game.discard.length - 1];
    const playable = bot.hand.filter(c => this.canPlay(c, topCard, this.game.wildColor, this.game.drawStack));

    if (playable.length > 0) {
      // Strategy: prefer action cards, then by color matching
      playable.sort((a, b) => {
        const score = (card) => {
          if (card.type === CARD_TYPES.WILD_DRAW_FOUR) return 5;
          if (card.type === CARD_TYPES.DRAW_TWO) return 4;
          if (card.type === CARD_TYPES.SKIP || card.type === CARD_TYPES.REVERSE) return 3;
          if (card.type === CARD_TYPES.WILD) return 2;
          return 1;
        };
        return score(b) - score(a);
      });

      const card = playable[0];
      let chosenColor = null;
      if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
        // Choose color based on majority in remaining hand
        const colorCounts = {};
        for (const c of bot.hand) {
          if (COLORS.includes(c.color)) colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
        chosenColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || COLORS[0];
      }

      // Say UNO if will have 1 card
      if (bot.hand.length === 2) {
        bot.saidUno = true;
        this.broadcast('saidUno', { socketId: bot.socketId, name: bot.name, silent: true });
      }

      this.playCard(bot.socketId, card.id, chosenColor);
    } else {
      // Draw
      this.drawCard(bot.socketId);
    }
  }

  addBot(name) {
    if (this.players.length >= this.maxPlayers) return null;
    const bot = this.addPlayer(null, name || `Bot ${this.players.filter(p => p.isBot).length + 1}`, true);
    this.broadcast('playerJoined', { player: { socketId: bot.socketId, name: bot.name, avatar: bot.avatar, isBot: true, cardCount: 0, score: 0 } });
    this.broadcast('gameUpdate', this.getPublicState());
    return bot;
  }

  removeBot(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId && p.isBot);
    if (idx > -1) {
      this.players.splice(idx, 1);
      this.broadcast('playerLeft', { socketId });
      this.broadcast('gameUpdate', this.getPublicState());
    }
  }
}

// ===================== SOCKET HANDLERS =====================
function getRoomList() {
  return Array.from(rooms.values()).map(r => ({
    code: r.code,
    status: r.status,
    playerCount: r.players.filter(p => !p.isSpectator).length,
    maxPlayers: r.maxPlayers,
    hasPassword: false
  }));
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let currentRoom = null;

  socket.on('getRooms', () => {
    socket.emit('roomList', getRoomList());
  });

  socket.on('createRoom', ({ name, settings }) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new UnoRoom(code, socket.id, settings);
    rooms.set(code, room);

    socket.join(code);
    const player = room.addPlayer(socket.id, name);
    currentRoom = room;

    socket.emit('joinedRoom', { room: room.getPublicState(socket.id), player });
    socket.to(code).emit('playerJoined', { player: { socketId: player.socketId, name: player.name, avatar: player.avatar, isBot: false, cardCount: 0, score: 0 } });
  });

  socket.on('joinRoom', ({ code, name }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.status !== 'lobby') {
      // Join as spectator
      socket.join(code);
      room.addSpectator(socket.id);
      currentRoom = room;
      socket.emit('joinedRoom', { room: room.getPublicState(socket.id), spectator: true });
      socket.to(code).emit('spectatorJoined', { socketId: socket.id });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    socket.join(code);
    const player = room.addPlayer(socket.id, name);
    currentRoom = room;

    socket.emit('joinedRoom', { room: room.getPublicState(socket.id), player });
    socket.to(code).emit('playerJoined', { player: { socketId: player.socketId, name: player.name, avatar: player.avatar, isBot: false, cardCount: 0, score: 0 } });
    io.to(code).emit('gameUpdate', room.getPublicState());
  });

  socket.on('addBot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.addBot();
  });

  socket.on('removeBot', ({ roomCode, botSocketId }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.removeBot(botSocketId);
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    if (room.players.filter(p => !p.isBot).length < 1 && room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }
    room.startGame();
  });

  socket.on('playCard', ({ roomCode, cardId, chosenColor }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const result = room.playCard(socket.id, cardId, chosenColor);
    if (result.error) {
      socket.emit('error', { message: result.error });
    } else if (result.needsColor) {
      socket.emit('chooseColor', { cardId });
    } else if (result.roundEnded) {
      io.to(roomCode).emit('gameUpdate', room.getPublicState());
    } else {
      // gameUpdate broadcasted inside playCard
    }
  });

  socket.on('drawCard', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const result = room.drawCard(socket.id);
    if (result.error) {
      socket.emit('error', { message: result.error });
    }
  });

  socket.on('sayUno', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.sayUno(socket.id);
  });

  socket.on('sendChat', ({ roomCode, message, type = 'chat' }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    const chatMsg = {
      id: Date.now() + Math.random(),
      name: player ? player.name : 'Spectator',
      message,
      type,
      time: Date.now()
    };
    room.chat.push(chatMsg);
    io.to(roomCode).emit('chatMessage', chatMsg);
  });

  socket.on('sendReaction', ({ roomCode, emoji }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    const reaction = {
      socketId: socket.id,
      name: player ? player.name : 'Spectator',
      emoji,
      time: Date.now()
    };
    io.to(roomCode).emit('reaction', reaction);
  });

  socket.on('changeTheme', ({ roomCode, theme }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.theme = theme;
    io.to(roomCode).emit('themeChanged', { theme });
  });

  socket.on('leaveRoom', () => {
    if (currentRoom) {
      socket.leave(currentRoom.code);
      currentRoom.removePlayer(socket.id);
      if (rooms.has(currentRoom.code)) {
        io.to(currentRoom.code).emit('gameUpdate', currentRoom.getPublicState());
      }
      currentRoom = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      if (rooms.has(currentRoom.code)) {
        io.to(currentRoom.code).emit('gameUpdate', currentRoom.getPublicState());
      }
    }
  });
});

// Cleanup old rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL) {
      rooms.delete(code);
    }
  }
}, 1000 * 60 * 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`UNO Server running on port ${PORT}`);
});
