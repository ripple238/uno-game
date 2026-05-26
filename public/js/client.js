
// ===================== AUDIO ENGINE =====================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.volume = 0.3;
    this.musicNodes = [];
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch(e) {
      console.warn('Web Audio not supported');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 1, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  playNoise(duration, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  // Card hover sound - subtle tick
  playHover() {
    this.playTone(800, 'sine', 0.04, 0.15);
  }

  // Card select/click sound
  playSelect() {
    this.playTone(600, 'sine', 0.06, 0.3);
    this.playTone(900, 'sine', 0.08, 0.2, 0.04);
  }

  // Normal card play
  playPlay() {
    this.playTone(523, 'triangle', 0.12, 0.5);
    this.playTone(784, 'triangle', 0.15, 0.3, 0.08);
  }

  // Draw card sound
  playDraw() {
    this.playTone(440, 'sine', 0.08, 0.4);
    this.playTone(660, 'sine', 0.08, 0.25, 0.05);
    this.playTone(880, 'sine', 0.1, 0.2, 0.1);
  }

  // Skip - abrupt stop sound
  playSkip() {
    this.playTone(400, 'square', 0.1, 0.4);
    this.playTone(200, 'square', 0.15, 0.4, 0.1);
    this.playNoise(0.1, 0.2);
  }

  // Reverse - whoosh sound
  playReverse() {
    this.playTone(500, 'sawtooth', 0.15, 0.3);
    this.playTone(350, 'sawtooth', 0.15, 0.3, 0.08);
    this.playTone(600, 'sawtooth', 0.2, 0.3, 0.16);
  }

  // +2 - double hit
  playDraw2() {
    this.playTone(500, 'square', 0.08, 0.5);
    this.playTone(500, 'square', 0.08, 0.5, 0.1);
    this.playTone(700, 'square', 0.12, 0.5, 0.2);
    this.playTone(900, 'square', 0.15, 0.4, 0.3);
  }

  // +4 - dramatic four-tone
  playDraw4() {
    [400, 550, 700, 950].forEach((f, i) => {
      this.playTone(f, 'square', 0.1, 0.5, i * 0.08);
    });
    this.playNoise(0.2, 0.15);
  }

  // Wild - magical shimmer
  playWild() {
    [300, 450, 600, 800, 1000, 1200].forEach((f, i) => {
      this.playTone(f, 'sine', 0.15, 0.3, i * 0.05);
    });
  }

  // UNO - triumphant
  playUno() {
    this.playTone(880, 'triangle', 0.15, 0.6);
    this.playTone(1100, 'triangle', 0.2, 0.6, 0.12);
    this.playTone(1320, 'triangle', 0.3, 0.5, 0.3);
  }

  // Win - celebration
  playWin() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      this.playTone(f, 'sine', 0.25, 0.4, i * 0.1);
    });
  }

  // Lose - sad
  playLose() {
    this.playTone(400, 'sawtooth', 0.3, 0.4);
    this.playTone(350, 'sawtooth', 0.3, 0.4, 0.2);
    this.playTone(300, 'sawtooth', 0.4, 0.4, 0.4);
  }

  // Error - buzz
  playError() {
    this.playTone(150, 'sawtooth', 0.25, 0.5);
    this.playTone(100, 'sawtooth', 0.2, 0.4, 0.15);
  }

  // Chat - gentle ping
  playChat() {
    this.playTone(1200, 'sine', 0.04, 0.2);
  }

  // Reaction - pop
  playReaction() {
    this.playTone(800, 'sine', 0.06, 0.25);
    this.playTone(1100, 'sine', 0.08, 0.2, 0.05);
  }

  // Penalty - bad sound
  playPenalty() {
    this.playTone(200, 'sawtooth', 0.2, 0.5);
    this.playTone(150, 'sawtooth', 0.25, 0.5, 0.15);
  }

  // Your turn - alert
  playYourTurn() {
    this.playTone(600, 'sine', 0.1, 0.4);
    this.playTone(800, 'sine', 0.1, 0.4, 0.12);
    this.playTone(1000, 'sine', 0.15, 0.4, 0.24);
  }

  startMusic() {
    if (!this.musicEnabled || !this.ctx) return;
    this.stopMusic();
    const freqs = [220, 330, 440, 550];
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.value = 0.012 * this.volume;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
  }

  stopMusic() {
    this.musicNodes.forEach(({ osc }) => {
      try { osc.stop(); } catch(e){}
    });
    this.musicNodes = [];
  }

  setVolume(v) {
    this.volume = v;
    this.musicNodes.forEach(({ gain }) => {
      gain.gain.value = 0.012 * v;
    });
  }
}

// ===================== PARTICLES =====================
class ParticleSystem {
  constructor(containerId, color = 'rgba(255,255,255,0.3)') {
    this.container = document.getElementById(containerId);
    this.color = color;
    this.particles = [];
    this.init();
  }

  init() {
    if (!this.container) return;
    for (let i = 0; i < 30; i++) {
      this.createParticle();
    }
  }

  createParticle() {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 15 + 's';
    p.style.animationDuration = (10 + Math.random() * 10) + 's';
    p.style.width = (2 + Math.random() * 4) + 'px';
    p.style.height = p.style.width;
    this.container.appendChild(p);
  }
}

// ===================== MAIN CLIENT =====================
class UnoClient {
  constructor() {
    this.socket = null;
    this.sound = new SoundEngine();
    this.state = {
      screen: 'lobby',
      room: null,
      player: null,
      spectator: false,
      game: null,
      players: [],
      chat: [],
      hand: [],
      isMyTurn: false,
      turnDeadline: null,
      selectedCard: null,
      theme: 'classic',
      animations: true
    };
    this.timers = {};
    this.init();
  }

  init() {
    this.setupSocket();
    this.setupUI();
    this.setupAudioTrigger();
    this.loadSettings();
    new ParticleSystem('lobby-particles');
    new ParticleSystem('room-particles');
  }

  setupAudioTrigger() {
    const trigger = () => {
      this.sound.init();
      this.sound.resume();
      document.removeEventListener('click', trigger);
      document.removeEventListener('touchstart', trigger);
    };
    document.addEventListener('click', trigger);
    document.addEventListener('touchstart', trigger);
  }

  setupSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected');
      this.socket.emit('getRooms');
    });

    this.socket.on('roomList', (rooms) => {
      this.renderRoomList(rooms);
    });

    this.socket.on('joinedRoom', ({ room, player, spectator }) => {
      this.state.room = room;
      this.state.player = player;
      this.state.spectator = spectator || false;
      this.state.players = room.players;
      this.state.theme = room.theme;
      this.applyTheme(room.theme);
      this.showScreen(spectator ? 'room' : 'room');
      this.renderRoom();
      if (room.status === 'playing') {
        this.showScreen('game');
        this.state.game = room.game;
        this.state.hand = player?.hand || [];
        this.renderGame();
      }
    });

    this.socket.on('playerJoined', ({ player }) => {
      if (!this.state.players.find(p => p.socketId === player.socketId)) {
        this.state.players.push(player);
      }
      this.renderRoom();
      if (this.state.screen === 'game') this.renderPlayers();
    });

    this.socket.on('playerLeft', ({ socketId }) => {
      this.state.players = this.state.players.filter(p => p.socketId !== socketId);
      this.renderRoom();
      if (this.state.screen === 'game') this.renderPlayers();
    });

    this.socket.on('playerBecameBot', ({ socketId, name }) => {
      const p = this.state.players.find(p => p.socketId === socketId);
      if (p) { p.isBot = true; p.name = name; }
      this.renderRoom();
      if (this.state.screen === 'game') this.renderPlayers();
      this.showToast(`${name} disconnected. Bot took over.`);
    });

    this.socket.on('gameStarted', (roomState) => {
      this.state.room = roomState;
      this.state.players = roomState.players;
      this.state.game = roomState.game;
      this.state.hand = roomState.you?.hand || [];
      this.state.spectator = roomState.you?.isSpectator || false;
      this.showScreen('game');
      this.renderGame();
      this.sound.startMusic();
      this.showToast('🎮 Game started!', 2000);
      this.animateScreenTransition();
    });

    this.socket.on('turnStarted', ({ playerSocketId, playerName, deadline, drawStack }) => {
      this.state.turnDeadline = deadline;
      this.state.game.currentPlayerSocketId = playerSocketId;
      this.state.game.drawStack = drawStack;
      this.state.isMyTurn = playerSocketId === this.socket.id;

      this.renderTurnIndicator();
      this.renderHand();
      this.updateTimer();

      if (this.state.isMyTurn) {
        this.sound.playYourTurn();
        this.showToast('⚡ Your turn!', 2000);
        if (drawStack > 0) {
          this.showToast(`Draw ${drawStack} cards or stack!`, 2500);
        }
      }
    });

    this.socket.on('cardPlayed', ({ socketId, card, nextPlayerSocketId, nextPlayerName }) => {
      this.state.game.topCard = card;
      this.state.game.currentPlayerSocketId = nextPlayerSocketId;
      this.state.game.wildColor = card.chosenColor || null;

      if (socketId === this.socket.id) {
        this.state.hand = this.state.hand.filter(c => c.id !== card.id);
      }
      const p = this.state.players.find(p => p.socketId === socketId);
      if (p) p.cardCount = Math.max(0, (p.cardCount || 1) - 1);

      this.playCardSound(card);
      this.animateCardPlay(socketId, card);
      this.renderDiscardPile();
      this.renderPlayers();
      this.renderHand();
    });

    this.socket.on('playerDrewCards', ({ socketId, count, reason }) => {
      const p = this.state.players.find(p => p.socketId === socketId);
      if (p) p.cardCount = (p.cardCount || 0) + count;
      this.sound.playDraw();
      this.renderPlayers();
      this.renderDeckCount();
    });

    this.socket.on('saidUno', ({ socketId, name, silent }) => {
      const p = this.state.players.find(p => p.socketId === socketId);
      if (p) p.saidUno = true;
      if (!silent) this.sound.playUno();
      this.showToast(`${name} said UNO!`, 2000, socketId === this.socket.id ? 'uno' : '');
      this.renderPlayers();
    });

    this.socket.on('unoPenalty', ({ socketId, name, count }) => {
      this.sound.playPenalty();
      this.showToast(`❌ ${name} forgot UNO! +${count} cards`, 3000);
      const p = this.state.players.find(p => p.socketId === socketId);
      if (p) p.cardCount = (p.cardCount || 0) + count;
      this.renderPlayers();
    });

    this.socket.on('gameUpdate', (roomState) => {
      this.state.room = roomState;
      this.state.players = roomState.players;
      this.state.game = roomState.game;
      if (roomState.you?.hand) {
        this.state.hand = roomState.you.hand;
      }
      this.state.spectator = roomState.you?.isSpectator || false;
      this.state.isMyTurn = roomState.game?.currentPlayerSocketId === this.socket.id;
      if (this.state.screen === 'game') {
        this.renderGame();
      }
    });

    this.socket.on('roundEnded', ({ winner, players, round }) => {
      this.sound.playWin();
      this.state.game.round = round;
      this.state.players = players.map(p => ({
        ...this.state.players.find(op => op.socketId === p.socketId),
        score: p.score,
        hand: p.hand
      }));
      this.showScoreboard(winner, players, true);
    });

    this.socket.on('roundStarted', (roomState) => {
      this.state.room = roomState;
      this.state.players = roomState.players;
      this.state.game = roomState.game;
      this.state.hand = roomState.you?.hand || [];
      this.state.isMyTurn = roomState.game?.currentPlayerSocketId === this.socket.id;
      this.hideOverlay('overlay-scoreboard');
      this.renderGame();
      this.showToast(`🔄 Round ${roomState.game.round} started!`);
    });

    this.socket.on('matchEnded', ({ winner, finalScores }) => {
      this.sound.playWin();
      this.showMatchEnd(winner, finalScores);
    });

    this.socket.on('chatMessage', (msg) => {
      this.state.chat.push(msg);
      this.renderChat();
      if (!document.getElementById('overlay-chat').classList.contains('hidden')) {
        this.sound.playChat();
      }
    });

    this.socket.on('reaction', ({ socketId, name, emoji }) => {
      this.showFloatingEmoji(socketId, emoji);
      this.sound.playReaction();
    });

    this.socket.on('themeChanged', ({ theme }) => {
      this.state.theme = theme;
      this.applyTheme(theme);
    });

    this.socket.on('chooseColor', ({ cardId }) => {
      this.state.selectedCard = cardId;
      this.showOverlay('overlay-color');
    });

    this.socket.on('error', ({ message }) => {
      this.sound.playError();
      this.showToast('❌ ' + message, 3000, 'error');
    });

    this.socket.on('disconnect', () => {
      this.showToast('🔌 Disconnected. Reconnecting...', 5000);
    });
  }

  // ===================== UI SETUP =====================
  setupUI() {
    // Lobby tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.lobby-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.tab}`).classList.remove('hidden');
      });
    });

    // Lobby actions
    document.getElementById('btn-create').addEventListener('click', () => this.createRoom());
    document.getElementById('btn-join').addEventListener('click', () => this.joinRoom());
    document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
      this.socket.emit('getRooms');
    });

    // Room actions
    document.getElementById('btn-start-game').addEventListener('click', () => {
      if (this.state.room) this.socket.emit('startGame', { roomCode: this.state.room.code });
    });
    document.getElementById('btn-add-bot').addEventListener('click', () => {
      if (this.state.room) this.socket.emit('addBot', { roomCode: this.state.room.code });
    });
    document.getElementById('btn-room-leave').addEventListener('click', () => this.leaveRoom());

    // Game actions
    document.getElementById('btn-draw').addEventListener('click', () => this.drawCard());
    document.getElementById('btn-uno').addEventListener('click', () => this.sayUno());
    document.getElementById('btn-leave-game').addEventListener('click', () => this.leaveRoom());
    document.getElementById('btn-chat').addEventListener('click', () => {
      this.showOverlay('overlay-chat');
      document.getElementById('chat-input').focus();
    });
    document.getElementById('btn-settings').addEventListener('click', () => this.showOverlay('overlay-settings'));
    document.getElementById('btn-info').addEventListener('click', () => this.showOverlay('overlay-info'));
    document.getElementById('btn-send-chat').addEventListener('click', () => this.sendChat());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChat();
    });

    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (this.state.selectedCard) {
          this.socket.emit('playCard', {
            roomCode: this.state.room.code,
            cardId: this.state.selectedCard,
            chosenColor: color
          });
          this.state.selectedCard = null;
          this.hideOverlay('overlay-color');
        }
      });
    });

    // Settings
    document.getElementById('toggle-sound').addEventListener('click', (e) => {
      this.sound.enabled = !this.sound.enabled;
      e.target.classList.toggle('active');
      e.target.textContent = this.sound.enabled ? 'ON' : 'OFF';
      this.saveSettings();
    });
    document.getElementById('toggle-music').addEventListener('click', (e) => {
      this.sound.musicEnabled = !this.sound.musicEnabled;
      e.target.classList.toggle('active');
      e.target.textContent = this.sound.musicEnabled ? 'ON' : 'OFF';
      if (this.sound.musicEnabled) this.sound.startMusic();
      else this.sound.stopMusic();
      this.saveSettings();
    });
    document.getElementById('volume-music').addEventListener('input', (e) => {
      this.sound.setVolume(e.target.value / 100);
      this.saveSettings();
    });
    document.getElementById('game-theme-select').addEventListener('change', (e) => {
      this.applyTheme(e.target.value);
      if (this.state.room && this.state.room.players[0]?.socketId === this.socket.id) {
        this.socket.emit('changeTheme', { roomCode: this.state.room.code, theme: e.target.value });
      }
    });
    document.getElementById('toggle-animations').addEventListener('click', (e) => {
      this.state.animations = !this.state.animations;
      e.target.classList.toggle('active');
      e.target.textContent = this.state.animations ? 'ON' : 'OFF';
      this.saveSettings();
    });

    // Emoji bar
    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.state.room) {
          this.socket.emit('sendReaction', { roomCode: this.state.room.code, emoji: btn.dataset.emoji });
        }
      });
    });

    // Close overlays
    document.querySelectorAll('.close-overlay').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.overlay').classList.add('hidden');
      });
    });

    // Match end buttons
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.hideOverlay('overlay-matchend');
      if (this.state.room) this.socket.emit('startGame', { roomCode: this.state.room.code });
    });
    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      this.hideOverlay('overlay-matchend');
      this.leaveRoom();
    });

    // Deck click to draw
    document.getElementById('deck-pile').addEventListener('click', () => this.drawCard());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.state.screen !== 'game') return;
      if (e.key === 'u' || e.key === 'U') this.sayUno();
      if (e.key === 'd' || e.key === 'D') this.drawCard();
      if (e.key === 'Escape') {
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
      }
    });
  }

  // ===================== ACTIONS =====================
  createRoom() {
    const name = document.getElementById('create-name').value.trim();
    if (!name) return this.showToast('Enter your name', 2000);
    const settings = {
      maxPlayers: parseInt(document.getElementById('setting-max-players').value),
      targetScore: parseInt(document.getElementById('setting-target-score').value),
      turnTimeLimit: parseInt(document.getElementById('setting-timer').value),
      theme: document.getElementById('setting-theme').value,
      allowStacking: document.getElementById('setting-stacking').checked
    };
    this.socket.emit('createRoom', { name, settings });
  }

  joinRoom() {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!name) return this.showToast('Enter your name', 2000);
    if (!code) return this.showToast('Enter room code', 2000);
    this.socket.emit('joinRoom', { code, name });
  }

  leaveRoom() {
    this.socket.emit('leaveRoom');
    this.state.room = null;
    this.state.game = null;
    this.state.hand = [];
    this.state.players = [];
    this.sound.stopMusic();
    this.showScreen('lobby');
    this.socket.emit('getRooms');
  }

  playCard(cardId) {
    if (!this.state.isMyTurn || this.state.spectator) {
      this.sound.playError();
      return;
    }
    const card = this.state.hand.find(c => c.id === cardId);
    if (!card) return;
    this.sound.playSelect();
    if (card.type === 'wild' || card.type === '+4') {
      this.state.selectedCard = cardId;
      this.showOverlay('overlay-color');
    } else {
      this.socket.emit('playCard', {
        roomCode: this.state.room.code,
        cardId: cardId
      });
    }
  }

  drawCard() {
    if (!this.state.isMyTurn || this.state.spectator) {
      this.sound.playError();
      return;
    }
    this.socket.emit('drawCard', { roomCode: this.state.room.code });
  }

  sayUno() {
    if (this.state.hand.length !== 1) {
      this.showToast('You can only say UNO with 1 card left!', 2000);
      return;
    }
    this.socket.emit('sayUno', { roomCode: this.state.room.code });
  }

  sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !this.state.room) return;
    this.socket.emit('sendChat', { roomCode: this.state.room.code, message: msg });
    input.value = '';
  }

  // ===================== RENDERING =====================
  showScreen(name) {
    this.state.screen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
  }

  animateScreenTransition() {
    const screen = document.getElementById('game-screen');
    screen.style.opacity = '0';
    screen.style.transform = 'scale(0.95)';
    setTimeout(() => {
      screen.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      screen.style.opacity = '1';
      screen.style.transform = 'scale(1)';
    }, 50);
  }

  showOverlay(id) {
    const overlay = document.getElementById(id);
    overlay.classList.remove('hidden');
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '1';
    }, 10);
  }

  hideOverlay(id) {
    const overlay = document.getElementById(id);
    overlay.style.opacity = '0';
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }

  applyTheme(theme) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    if (theme !== 'classic') document.body.classList.add(`theme-${theme}`);
    document.getElementById('game-theme-select').value = theme;
    document.getElementById('setting-theme').value = theme;
  }

  renderRoomList(rooms) {
    const container = document.getElementById('available-rooms');
    if (!rooms || rooms.length === 0) {
      container.innerHTML = '<div class="room-item" style="opacity:0.5"><span>No active rooms</span></div>';
      return;
    }
    container.innerHTML = rooms.map(r => `
      <div class="room-item" onclick="window.unoClient.joinRoomByCode('${r.code}')">
        <div>
          <div class="room-item-code">${r.code}</div>
          <div class="room-item-info">${r.playerCount}/${r.maxPlayers} players</div>
        </div>
        <span style="font-size:12px;color:${r.status === 'playing' ? '#ff4444' : '#44ff88'}">${r.status === 'playing' ? 'Playing' : 'Open'}</span>
      </div>
    `).join('');
  }

  joinRoomByCode(code) {
    const name = document.getElementById('join-name').value.trim() || 'Player';
    this.socket.emit('joinRoom', { code, name });
  }

  renderRoom() {
    if (!this.state.room) return;
    document.getElementById('room-code-display').textContent = this.state.room.code;
    document.getElementById('room-theme-indicator').textContent = this.state.room.theme.charAt(0).toUpperCase() + this.state.room.theme.slice(1) + ' Theme';

    const isHost = this.state.room.players[0]?.socketId === this.socket.id;
    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-add-bot').style.display = isHost ? 'block' : 'none';
    document.querySelector('.room-hint').style.display = isHost ? 'none' : 'block';

    const grid = document.getElementById('room-players');
    grid.innerHTML = this.state.players.map((p, i) => `
      <div class="room-player-card ${p.socketId === this.state.room.host ? 'host' : ''}" style="animation-delay:${i*0.1}s">
        ${p.isBot && isHost ? `<button class="remove-bot-btn" onclick="window.unoClient.removeBot('${p.socketId}')">×</button>` : ''}
        <div class="room-player-avatar" style="background: hsl(${p.avatar.hue}, 70%, 60%)">${p.avatar.text}</div>
        <div class="room-player-name">${p.name}</div>
        <div class="room-player-tag">${p.isBot ? '🤖 Bot' : (p.socketId === this.state.room.host ? '👑 Host' : '👤 Player')}</div>
      </div>
    `).join('');
  }

  removeBot(socketId) {
    if (this.state.room) {
      this.socket.emit('removeBot', { roomCode: this.state.room.code, botSocketId: socketId });
    }
  }

  // ===================== GAME RENDERING =====================
  renderGame() {
    if (!this.state.game) return;

    document.getElementById('game-round').textContent = `Round ${this.state.game.round} / ${this.state.room.totalRounds}`;
    document.getElementById('deck-count').textContent = this.state.game.deckCount;
    document.getElementById('spectator-banner').classList.toggle('hidden', !this.state.spectator);

    this.renderDiscardPile();
    this.renderPlayers();
    this.renderHand();
    this.renderTurnIndicator();
    this.updateTimer();
    this.renderChat();
  }

  renderDiscardPile() {
    const pile = document.getElementById('discard-pile');
    const topCard = this.state.game.topCard;
    if (!topCard) {
      pile.innerHTML = '<div class="card card-placeholder">+</div>';
      return;
    }
    pile.innerHTML = '';
    const cardEl = this.createCardElement(topCard, { scale: 1, playable: false });
    cardEl.style.position = 'absolute';
    cardEl.classList.add('card-play-anim');
    pile.appendChild(cardEl);
  }

  renderPlayers() {
    const ring = document.getElementById('players-ring');
    const yourSocketId = this.socket.id;
    const others = this.state.players.filter(p => p.socketId !== yourSocketId);

    const positions = this.getPositionsForCount(others.length);

    ring.innerHTML = others.map((p, i) => {
      const isCurrent = this.state.game.currentPlayerSocketId === p.socketId;
      const pos = positions[i] || 'top';
      return `
        <div class="player-spot ${isCurrent ? 'active-turn' : ''} ${p.isSpectator ? 'spectator' : ''} pos-${pos}" data-socket-id="${p.socketId}">
          <div class="player-info-panel">
            <div class="player-avatar-wrap" style="background: hsl(${p.avatar.hue}, 70%, 60%)">
              ${p.avatar.text}
            </div>
            <div class="player-meta">
              <div class="player-name">${p.name} ${p.isBot ? '🤖' : ''}</div>
              <div class="player-score-row">
                <span class="trophy">🏆</span>
                <span>${p.score}</span>
              </div>
            </div>
            <div class="player-card-count">${p.cardCount || 0}</div>
          </div>
          <div class="player-hand-preview">
            ${Array(Math.min(p.cardCount || 0, 6)).fill(0).map(() => '<div class="mini-card"></div>').join('')}
          </div>
        </div>
      `;
    }).join('');

    const dir = document.getElementById('turn-direction');
    dir.classList.toggle('reverse', this.state.game.direction === -1);
  }

  getPositionsForCount(count) {
    const map = {
      1: ['top'],
      2: ['top-left', 'top-right'],
      3: ['top', 'left', 'right'],
      4: ['top', 'left', 'right', 'bottom-left'],
      5: ['top', 'left', 'right', 'bottom-left', 'bottom-right'],
      6: ['top', 'top-left', 'top-right', 'left', 'right', 'bottom-left'],
      7: ['top', 'top-left', 'top-right', 'left', 'right', 'bottom-left', 'bottom-right']
    };
    return map[count] || map[7];
  }

  renderHand() {
    const container = document.getElementById('hand-cards');
    container.innerHTML = '';

    if (this.state.spectator) {
      container.innerHTML = '<div style="color:var(--text-secondary);font-weight:700;padding:20px;">👁 Spectator Mode</div>';
      return;
    }

    const cards = this.state.hand || [];
    if (cards.length === 0) {
      container.innerHTML = '<div style="color:var(--text-secondary);font-weight:700;">No cards</div>';
      return;
    }

    const isMobile = window.innerWidth < 768;
    const cardWidth = isMobile ? 70 : 100;
    const containerWidth = container.offsetWidth || window.innerWidth;
    const maxWidth = containerWidth * 0.9;
    const totalCardsWidth = cards.length * cardWidth;
    const overlap = totalCardsWidth > maxWidth ? (totalCardsWidth - maxWidth) / (cards.length - 1) : 0;
    const startX = (containerWidth - (cards.length * cardWidth - overlap * (cards.length - 1))) / 2;

    const topCard = this.state.game?.topCard;
    const wildColor = this.state.game?.wildColor;
    const drawStack = this.state.game?.drawStack || 0;

    cards.forEach((card, i) => {
      const playable = this.state.isMyTurn && this.canPlay(card, topCard, wildColor, drawStack);
      const cardEl = this.createCardElement(card, { scale: 1, playable });

      const angle = (i - (cards.length - 1) / 2) * (cards.length > 8 ? 2 : 3);
      const x = startX + i * (cardWidth - overlap);
      const y = Math.abs(angle) * 0.8;

      cardEl.style.position = 'absolute';
      cardEl.style.left = `${x}px`;
      cardEl.style.bottom = `${y}px`;
      cardEl.style.transform = `rotate(${angle}deg)`;
      cardEl.style.zIndex = i;

      // Hover sound
      cardEl.addEventListener('mouseenter', () => {
        if (playable) this.sound.playHover();
      });

      cardEl.addEventListener('click', () => this.playCard(card.id));
      container.appendChild(cardEl);
    });

    // Update UNO button
    const unoBtn = document.getElementById('btn-uno');
    unoBtn.disabled = cards.length !== 1 || !this.state.isMyTurn;
    if (cards.length === 1 && this.state.isMyTurn) {
      unoBtn.style.animation = 'unoPulse 1s ease-in-out infinite';
    } else {
      unoBtn.style.animation = 'none';
    }

    // Update draw button
    const drawBtn = document.getElementById('btn-draw');
    drawBtn.textContent = drawStack > 0 ? `Draw ${drawStack}` : 'Draw';
    drawBtn.disabled = !this.state.isMyTurn;
  }

  createCardElement(card, options = {}) {
    const { playable = false } = options;
    const el = document.createElement('div');

    let colorClass = `card-${card.color}`;
    if (card.color === 'wild' && card.chosenColor) {
      colorClass = `card-wild-${card.chosenColor}`;
    }

    let typeClass = '';
    if (card.type === 'skip') typeClass = 'card-skip';
    else if (card.type === 'reverse') typeClass = 'card-reverse';
    else if (card.type === '+2') typeClass = 'card-draw2';
    else if (card.type === 'wild') typeClass = 'card-wild';
    else if (card.type === '+4') typeClass = 'card-wild4';

    const specialClass = (card.type !== 'number') ? 'card-special' : '';

    el.className = `card ${colorClass} ${typeClass} ${specialClass} ${playable ? 'playable' : 'not-playable'}`;

    let ovalContent = '';
    if (card.type === 'number') ovalContent = `<span class="oval-text">${card.value}</span>`;
    else if (card.type === 'skip') ovalContent = `<span class="oval-text"></span>`;
    else if (card.type === 'reverse') ovalContent = `<span class="oval-text"></span>`;
    else if (card.type === '+2') ovalContent = `<span class="oval-text"></span>`;
    else if (card.type === 'wild') ovalContent = `<span class="oval-text"></span>`;
    else if (card.type === '+4') ovalContent = `<span class="oval-text"></span>`;

    const cornerText = card.type === 'number' ? card.value : (card.type === '+4' ? '+4' : card.type[0].toUpperCase());

    el.innerHTML = `
      <div class="card-face">
        <div class="card-color-bar"></div>
        <div class="card-white-area">
          <div class="card-oval">${ovalContent}</div>
        </div>
        <div class="card-corner top-left">${cornerText}</div>
        <div class="card-corner bottom-right">${cornerText}</div>
      </div>
    `;

    return el;
  }

  canPlay(card, topCard, wildColor, drawStack) {
    if (!this.state.room?.settings?.allowStacking && drawStack > 0) return false;
    if (drawStack > 0) {
      return card.type === '+2' || card.type === '+4';
    }
    if (card.type === 'wild' || card.type === '+4') return true;

    const effectiveColor = wildColor || topCard?.color;
    if (card.color === effectiveColor) return true;
    if (topCard && card.type === topCard.type && card.type !== 'number' && card.value === topCard.value) return true;
    if (card.type === 'number' && topCard?.type === 'number' && card.value === topCard.value) return true;
    return false;
  }

  renderTurnIndicator() {
    const currentId = this.state.game?.currentPlayerSocketId;
    document.querySelectorAll('.player-spot').forEach(el => {
      el.classList.toggle('active-turn', el.dataset.socketId === currentId);
    });
  }

  updateTimer() {
    const timerEl = document.getElementById('game-timer');
    const timerBox = document.getElementById('timer-box');
    if (this.timers.countdown) clearInterval(this.timers.countdown);

    if (!this.state.turnDeadline) {
      timerEl.textContent = '00:00';
      timerBox.classList.remove('warning');
      return;
    }

    this.timers.countdown = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.state.turnDeadline - Date.now()) / 1000));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (remaining <= 5 && this.state.isMyTurn) {
        timerBox.classList.add('warning');
      } else {
        timerBox.classList.remove('warning');
      }

      if (remaining <= 0) {
        clearInterval(this.timers.countdown);
      }
    }, 1000);
  }

  renderDeckCount() {
    document.getElementById('deck-count').textContent = this.state.game?.deckCount || 0;
  }

  // ===================== ANIMATIONS =====================
  animateCardPlay(socketId, card) {
    // Animate the player spot
    const spot = document.querySelector(`.player-spot[data-socket-id="${socketId}"]`);
    if (spot) {
      spot.style.transform = 'scale(1.15)';
      setTimeout(() => spot.style.transform = '', 300);
    }

    // Create flying card animation
    const fromRect = socketId === this.socket.id
      ? document.getElementById('hand-cards').getBoundingClientRect()
      : (spot ? spot.getBoundingClientRect() : null);

    const toRect = document.getElementById('discard-pile').getBoundingClientRect();

    if (fromRect && this.state.animations) {
      const flyCard = document.createElement('div');
      flyCard.className = 'flying-card';
      flyCard.style.left = fromRect.left + 'px';
      flyCard.style.top = fromRect.top + 'px';
      flyCard.style.background = this.getCardColor(card);
      flyCard.style.border = '2px solid white';
      flyCard.style.borderRadius = '10px';
      flyCard.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
      document.getElementById('card-fly-container').appendChild(flyCard);

      requestAnimationFrame(() => {
        flyCard.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        flyCard.style.left = (toRect.left + toRect.width/2 - 40) + 'px';
        flyCard.style.top = (toRect.top + toRect.height/2 - 60) + 'px';
        flyCard.style.transform = 'scale(0.8) rotate(360deg)';
        flyCard.style.opacity = '0';
      });

      setTimeout(() => flyCard.remove(), 600);
    }
  }

  getCardColor(card) {
    const colors = {
      red: '#ff5555', yellow: '#ffaa00', green: '#55aa55', blue: '#5555ff', wild: '#222'
    };
    return colors[card.chosenColor || card.color] || colors.wild;
  }

  showFloatingEmoji(socketId, emoji) {
    const container = document.getElementById('reaction-container');
    let rect;

    if (socketId === this.socket.id) {
      rect = document.getElementById('hand-area').getBoundingClientRect();
    } else {
      const spot = document.querySelector(`.player-spot[data-socket-id="${socketId}"]`);
      if (spot) rect = spot.getBoundingClientRect();
    }

    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ===================== CHAT =====================
  renderChat() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = this.state.chat.map(msg => `
      <div class="chat-msg">
        <div class="chat-msg-name">${msg.name}</div>
        <div class="chat-msg-text">${this.escapeHtml(msg.message)}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===================== OVERLAYS =====================
  showScoreboard(winner, players, isRound = true) {
    const list = document.getElementById('scoreboard-list');
    const sorted = [...players].sort((a, b) => b.score - a.score);

    list.innerHTML = sorted.map((p, i) => `
      <div class="scoreboard-item ${p.socketId === winner.socketId ? 'winner' : ''}">
        <span class="scoreboard-rank">#${i + 1}</span>
        <span class="scoreboard-name">${p.name}</span>
        <span class="scoreboard-points">+${p.socketId === winner.socketId ? winner.points : 0}</span>
        <span class="scoreboard-total">${p.score}</span>
      </div>
    `).join('');

    this.showOverlay('overlay-scoreboard');

    let count = 5;
    const countEl = document.getElementById('next-round-count');
    countEl.textContent = count;
    const interval = setInterval(() => {
      count--;
      countEl.textContent = count;
      if (count <= 0) clearInterval(interval);
    }, 1000);
  }

  showMatchEnd(winner, scores) {
    document.getElementById('match-winner-name').textContent = `${winner.name} Wins!`;
    const list = document.getElementById('final-scores');
    const sorted = [...scores].sort((a, b) => b.score - a.score);

    list.innerHTML = sorted.map((p, i) => `
      <div class="final-score-item ${p.socketId === winner.socketId ? 'winner' : ''}">
        <span>${i + 1}. ${p.name}</span>
        <span>${p.score} pts</span>
      </div>
    `).join('');

    this.showOverlay('overlay-matchend');
  }

  // ===================== UTILS =====================
  showToast(message, duration = 3000, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  playCardSound(card) {
    switch (card.type) {
      case 'skip': this.sound.playSkip(); break;
      case 'reverse': this.sound.playReverse(); break;
      case '+2': this.sound.playDraw2(); break;
      case '+4': this.sound.playDraw4(); break;
      case 'wild': this.sound.playWild(); break;
      default: this.sound.playPlay(); break;
    }
  }

  saveSettings() {
    const settings = {
      sound: this.sound.enabled,
      music: this.sound.musicEnabled,
      volume: document.getElementById('volume-music').value,
      theme: document.getElementById('game-theme-select').value,
      animations: this.state.animations
    };
    localStorage.setItem('unoSettings', JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('unoSettings'));
      if (!s) return;

      this.sound.enabled = s.sound !== false;
      document.getElementById('toggle-sound').textContent = this.sound.enabled ? 'ON' : 'OFF';
      document.getElementById('toggle-sound').classList.toggle('active', this.sound.enabled);

      this.sound.musicEnabled = s.music !== false;
      document.getElementById('toggle-music').textContent = this.sound.musicEnabled ? 'ON' : 'OFF';
      document.getElementById('toggle-music').classList.toggle('active', this.sound.musicEnabled);

      if (s.volume) {
        document.getElementById('volume-music').value = s.volume;
        this.sound.setVolume(s.volume / 100);
      }

      if (s.theme) {
        document.getElementById('game-theme-select').value = s.theme;
        document.getElementById('setting-theme').value = s.theme;
      }

      this.state.animations = s.animations !== false;
      const animToggle = document.getElementById('toggle-animations');
      animToggle.classList.toggle('active', this.state.animations);
      animToggle.textContent = this.state.animations ? 'ON' : 'OFF';
    } catch(e) {}
  }
}

// Initialize
window.unoClient = new UnoClient();
