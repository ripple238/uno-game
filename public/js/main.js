// ==================== MAIN CLIENT ====================
let socket = null;
let currentRoom = null;
let myPlayerId = null;
let isHost = false;

// Initialize
function init() {
  // Connect to server (auto-detect URL for Render deployment)
  const serverUrl = window.location.origin;
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    Animations.showToast('Connected!', 'success');
  });

  socket.on('disconnect', () => {
    Animations.showToast('Disconnected. Trying to reconnect...', 'error');
  });

  socket.on('roomUpdate', (data) => {
    updateWaitingRoom(data);
  });

  socket.on('gameState', (data) => {
    // Redirect to game page if not already there
    if (!window.location.pathname.includes('game.html')) {
      sessionStorage.setItem('gameState', JSON.stringify(data));
      sessionStorage.setItem('roomId', data.roomId);
      sessionStorage.setItem('playerId', myPlayerId);
      sessionStorage.setItem('isHost', isHost);
      window.location.href = '/game.html';
    }
  });

  socket.on('kicked', () => {
    Animations.showToast('You were kicked from the room', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  });

  socket.on('chatMessage', (msg) => {
    // Handled in game page
  });

  // Check for stored session
  const storedRoom = sessionStorage.getItem('roomId');
  if (storedRoom && !window.location.pathname.includes('game.html')) {
    sessionStorage.removeItem('roomId');
  }
}

// ==================== PAGE NAVIGATION ====================
function showPage(pageId) {
  Animations.showPage(pageId);
}

// ==================== CREATE ROOM ====================
function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  if (!name) {
    Animations.showToast('Please enter your name', 'error');
    Animations.shake(document.getElementById('create-name'));
    return;
  }

  SoundEngine.init();

  const settings = {
    maxPlayers: parseInt(document.getElementById('max-players').value),
    botCount: parseInt(document.getElementById('bot-count').value),
    theme: document.getElementById('card-theme').value,
    stackDraw2: document.getElementById('stack-draw2').value === 'true'
  };

  document.getElementById('loading-overlay').classList.remove('hidden');

  socket.emit('createRoom', { playerName: name, settings }, (response) => {
    document.getElementById('loading-overlay').classList.add('hidden');

    if (response.success) {
      currentRoom = response.roomId;
      myPlayerId = response.playerId;
      isHost = true;

      document.getElementById('display-room-code').textContent = response.roomId;
      showPage('waiting-page');
      SoundEngine.join();

      // Apply theme
      document.body.className = `theme-${settings.theme}`;
    } else {
      Animations.showToast(response.error || 'Failed to create room', 'error');
    }
  });
}

// ==================== JOIN ROOM ====================
function joinRoom() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  const asSpectator = document.getElementById('spectator-mode').checked;

  if (!name && !asSpectator) {
    Animations.showToast('Please enter your name', 'error');
    Animations.shake(document.getElementById('join-name'));
    return;
  }
  if (!code) {
    Animations.showToast('Please enter room code', 'error');
    Animations.shake(document.getElementById('room-code'));
    return;
  }

  SoundEngine.init();

  document.getElementById('loading-overlay').classList.remove('hidden');

  socket.emit('joinRoom', { 
    roomId: code, 
    playerName: name || 'Spectator', 
    asSpectator 
  }, (response) => {
    document.getElementById('loading-overlay').classList.add('hidden');

    if (response.success) {
      currentRoom = response.roomId;
      myPlayerId = response.playerId;

      if (response.isSpectator) {
        sessionStorage.setItem('roomId', response.roomId);
        sessionStorage.setItem('playerId', response.playerId);
        sessionStorage.setItem('isSpectator', 'true');
        window.location.href = '/game.html';
      } else {
        document.getElementById('display-room-code').textContent = response.roomId;
        showPage('waiting-page');
        SoundEngine.join();
      }
    } else {
      Animations.showToast(response.error || 'Failed to join room', 'error');
    }
  });
}

// ==================== PRACTICE MODE ====================
function startPractice() {
  const name = document.getElementById('practice-name').value.trim() || 'Player';
  const botCount = parseInt(document.getElementById('practice-bots').value);
  const theme = document.getElementById('practice-theme').value;

  SoundEngine.init();

  const settings = {
    maxPlayers: botCount + 1,
    botCount: botCount,
    theme: theme,
    stackDraw2: true
  };

  document.getElementById('loading-overlay').classList.remove('hidden');

  socket.emit('createRoom', { playerName: name, settings }, (response) => {
    document.getElementById('loading-overlay').classList.add('hidden');

    if (response.success) {
      currentRoom = response.roomId;
      myPlayerId = response.playerId;
      isHost = true;

      document.getElementById('display-room-code').textContent = response.roomId;
      showPage('waiting-page');
      SoundEngine.join();

      // Auto-start after short delay
      setTimeout(() => {
        startGame();
      }, 1000);
    }
  });
}

// ==================== WAITING ROOM ====================
function updateWaitingRoom(data) {
  const list = document.getElementById('players-list');
  if (!list) return;

  list.innerHTML = '';

  data.players.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'player-item';

    const isHostPlayer = player.id === data.hostId;
    const badgeClass = player.isBot ? 'bot' : (isHostPlayer ? 'host' : '');
    const badgeText = player.isBot ? 'BOT' : (isHostPlayer ? 'HOST' : '');

    item.innerHTML = `
      <div class="player-info">
        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="player-name">${player.name}</div>
          ${badgeText ? `<span class="player-badge ${badgeClass}">${badgeText}</span>` : ''}
        </div>
      </div>
      ${isHost && !player.isBot && player.id !== myPlayerId ? 
        `<button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="kickPlayer('${player.id}')">Kick</button>` : ''}
      ${isHost && player.isBot ? 
        `<button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="removeBot('${player.id}')">Remove</button>` : ''}
    `;

    list.appendChild(item);
  });

  // Show/hide host controls
  const hostControls = document.getElementById('host-controls');
  const addBotBtn = document.getElementById('add-bot-btn');
  const startBtn = document.getElementById('start-game-btn');

  if (hostControls) hostControls.style.display = isHost ? 'block' : 'none';
  if (addBotBtn) addBotBtn.style.display = isHost ? 'inline-block' : 'none';
  if (startBtn) startBtn.style.display = isHost ? 'inline-block' : 'none';

  // Update theme selector
  const themeSelect = document.getElementById('waiting-theme');
  if (themeSelect && data.settings.theme) {
    themeSelect.value = data.settings.theme;
  }
}

function copyRoomCode() {
  const code = document.getElementById('display-room-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    Animations.showToast('Room code copied!', 'success');
    SoundEngine.cardSelect();
  });
}

function addBot() {
  if (!isHost) return;
  socket.emit('addBot', (response) => {
    if (!response.success) {
      Animations.showToast('Cannot add more bots', 'error');
    }
  });
}

function removeBot(botId) {
  if (!isHost) return;
  socket.emit('removeBot', { botId }, (response) => {
    if (!response.success) {
      Animations.showToast('Cannot remove bot', 'error');
    }
  });
}

function kickPlayer(playerId) {
  if (!isHost) return;
  socket.emit('kickPlayer', { playerId }, (response) => {
    if (!response.success) {
      Animations.showToast('Cannot kick player', 'error');
    }
  });
}

function updateTheme() {
  if (!isHost) return;
  const theme = document.getElementById('waiting-theme').value;
  socket.emit('updateSettings', { theme }, () => {});
  document.body.className = `theme-${theme}`;
}

function startGame() {
  if (!isHost) {
    Animations.showToast('Only host can start', 'error');
    return;
  }

  document.getElementById('loading-overlay').classList.remove('hidden');

  socket.emit('startGame', (response) => {
    document.getElementById('loading-overlay').classList.add('hidden');

    if (!response.success) {
      Animations.showToast(response.error || 'Cannot start game', 'error');
    }
  });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', init);
