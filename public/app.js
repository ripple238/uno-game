const socket = io();

// ===== STATE =====
let currentScreen = 'landing';
let roomCode = null;
let playerName = '';
let gameState = null;
let selectedCardIndex = null;
let drawnCard = null;
let isHost = false;
let soundEnabled = true;
let currentTheme = 'classic';
let myPlayerIndex = -1;

// ===== AUDIO ENGINE =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, type, duration, volume = 0.15) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function playChord(freqs, type, duration, volume = 0.12) {
  if (!soundEnabled || !audioCtx) return;
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(freq, type, duration, volume), i * 80);
  });
}

function playSound(type) {
  initAudio();
  switch(type) {
    case 'play':
      playTone(523, 'sine', 0.25, 0.12);
      setTimeout(() => playTone(659, 'sine', 0.25, 0.12), 100);
      break;
    case 'special':
      playTone(400, 'sawtooth', 0.15, 0.1);
      setTimeout(() => playTone(600, 'sawtooth', 0.2, 0.1), 100);
      setTimeout(() => playTone(800, 'sawtooth', 0.3, 0.1), 200);
      break;
    case 'wild':
      playChord([523, 659, 784], 'sine', 0.4, 0.1);
      break;
    case 'draw':
      playTone(300, 'triangle', 0.15, 0.1);
      setTimeout(() => playTone(250, 'triangle', 0.15, 0.08), 80);
      break;
    case 'uno':
      playTone(880, 'square', 0.15, 0.08);
      setTimeout(() => playTone(1100, 'square', 0.2, 0.08), 120);
      setTimeout(() => playTone(1320, 'square', 0.3, 0.08), 240);
      break;
    case 'win':
      playChord([523, 659, 784, 1047], 'sine', 0.5, 0.1);
      setTimeout(() => playChord([659, 784, 1047, 1319], 'sine', 0.5, 0.1), 300);
      setTimeout(() => playChord([784, 1047, 1319, 1568], 'sine', 0.6, 0.1), 600);
      break;
    case 'pass':
      playTone(350, 'sine', 0.2, 0.08);
      break;
    case 'error':
      playTone(200, 'sawtooth', 0.3, 0.08);
      break;
    case 'turn':
      playTone(440, 'sine', 0.15, 0.08);
      break;
  }
}

// ===== DOM =====
const screens = {
  landing: document.getElementById('landing-screen'),
  create: document.getElementById('create-screen'),
  join: document.getElementById('join-screen'),
  spectate: document.getElementById('spectate-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  currentScreen = name;
  document.body.className = 'theme-' + currentTheme;
}

// ===== PARTICLES =====
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (5 + Math.random() * 5) + 's';
    container.appendChild(p);
  }
}

// ===== EVENT LISTENERS =====
document.getElementById('btn-create').addEventListener('click', () => { initAudio(); showScreen('create'); });
document.getElementById('btn-join').addEventListener('click', () => { initAudio(); showScreen('join'); });
document.getElementById('btn-spectate').addEventListener('click', () => { initAudio(); showScreen('spectate'); });

document.querySelectorAll('.btn-back').forEach(btn => {
  btn.addEventListener('click', () => showScreen('landing'));
});

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTheme = btn.dataset.theme;
  });
});

document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Create Room
document.getElementById('btn-create-confirm').addEventListener('click', () => {
  const name = document.getElementById('create-name').value.trim();
  if (!name) { showToast('Enter your name', 'error'); playSound('error'); return; }

  const targetScore = parseInt(document.querySelector('.seg-btn.active')?.dataset.score || '500');
  const theme = currentTheme;
  const allowSpectators = document.getElementById('allow-spectators').checked;

  playerName = name;
  socket.emit('create-room', { playerName: name, settings: { targetScore, theme, allowSpectators } }, (res) => {
    if (res.success) {
      roomCode = res.roomCode;
      currentTheme = res.theme || 'classic';
      isHost = true;
      showScreen('lobby');
      updateLobby(roomCode);
      showToast('Room created! Share the code', 'success');
      playSound('win');
    } else {
      showToast(res.error || 'Failed', 'error');
      playSound('error');
    }
  });
});

// Join Room
document.getElementById('btn-join-confirm').addEventListener('click', () => {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();
  if (!code || !name) { showToast('Fill all fields', 'error'); playSound('error'); return; }

  playerName = name;
  socket.emit('join-room', { roomCode: code, playerName: name }, (res) => {
    if (res.success) {
      roomCode = code;
      currentTheme = res.theme || 'classic';
      showScreen('lobby');
      updateLobby(code);
      playSound('play');
    } else {
      showToast(res.error || 'Failed', 'error');
      playSound('error');
    }
  });
});

// Spectate
document.getElementById('btn-spectate-confirm').addEventListener('click', () => {
  const code = document.getElementById('spectate-code').value.trim().toUpperCase();
  const name = document.getElementById('spectate-name').value.trim() || 'Spectator';
  if (!code) { showToast('Enter room code', 'error'); return; }

  playerName = name;
  socket.emit('spectate-room', { roomCode: code, playerName: name }, (res) => {
    if (res.success) {
      roomCode = code;
      currentTheme = res.theme || 'classic';
      showScreen('lobby');
      updateLobby(code);
      showToast('Spectating...', 'info');
    } else {
      showToast(res.error || 'Failed', 'error');
    }
  });
});

// Copy code
document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    showToast('Copied!', 'success');
    playSound('play');
  });
});

// Add bots
document.querySelectorAll('.btn-bot').forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = btn.dataset.difficulty;
    socket.emit('add-bot', diff, (res) => {
      if (!res.success) showToast(res.error, 'error');
    });
  });
});

// Start game
document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('start-game', null, (res) => {
    if (!res.success) {
      showToast(res.error || 'Failed', 'error');
      playSound('error');
    }
  });
});

// Next round
document.getElementById('btn-next-round').addEventListener('click', () => {
  document.getElementById('roundend-modal').classList.remove('active');
  socket.emit('next-round', null, (res) => {
    if (!res.success) showToast(res.error, 'error');
  });
});

// Leave
document.getElementById('btn-leave-lobby').addEventListener('click', () => location.reload());

// Draw card
document.getElementById('btn-draw').addEventListener('click', () => {
  socket.emit('draw-card', null, (res) => {
    if (res.success) {
      drawnCard = res.card;
      playSound('draw');
      document.getElementById('btn-draw').style.display = 'none';
      document.getElementById('btn-pass').style.display = 'inline-flex';
      showToast('Card drawn. Play or pass.', 'info');
    } else {
      showToast(res.error, 'error');
      playSound('error');
    }
  });
});

// Pass
document.getElementById('btn-pass').addEventListener('click', () => {
  socket.emit('pass-turn', null, (res) => {
    if (res.success) {
      playSound('pass');
      drawnCard = null;
      document.getElementById('btn-draw').style.display = 'inline-flex';
      document.getElementById('btn-pass').style.display = 'none';
    } else {
      showToast(res.error, 'error');
      playSound('error');
    }
  });
});

// UNO
document.getElementById('btn-uno').addEventListener('click', () => {
  socket.emit('say-uno', null, (res) => {
    if (res.success) playSound('uno');
    else showToast(res.error, 'error');
  });
});

// Color picker
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playSound('wild');
    playSelectedCard(btn.dataset.color);
    document.getElementById('color-modal').classList.remove('active');
  });
});

// Chat
document.getElementById('btn-game-menu').addEventListener('click', () => {
  document.getElementById('chat-panel').classList.add('active');
});
document.getElementById('btn-close-chat').addEventListener('click', () => {
  document.getElementById('chat-panel').classList.remove('active');
});

// Sound toggle
document.getElementById('btn-sound-toggle').addEventListener('click', function() {
  soundEnabled = !soundEnabled;
  this.classList.toggle('muted', !soundEnabled);
  this.textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Sound ON' : 'Sound OFF', 'info');
});

// Chat send
document.getElementById('btn-send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (msg) {
    socket.emit('send-message', { message: msg }, () => {});
    input.value = '';
  }
}

// Emoji reactions
document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.emoji;
    socket.emit('emoji-reaction', emoji);
    showFloatingEmoji(emoji);
    playSound('play');
  });
});

// Game over
document.getElementById('btn-play-again').addEventListener('click', () => {
  document.getElementById('gameover-modal').classList.remove('active');
  socket.emit('start-game', null, () => {});
});
document.getElementById('btn-back-lobby').addEventListener('click', () => location.reload());

// ===== SOCKET EVENTS =====
socket.on('room-update', (room) => {
  if (currentScreen === 'lobby') updateLobbyPlayers(room);
  updateChat(room.messages);
});

socket.on('game-state', (state) => {
  const wasMyTurn = gameState && gameState.isYourTurn;
  gameState = state;
  myPlayerIndex = state.yourIndex;

  if (currentScreen !== 'game') {
    showScreen('game');
    document.getElementById('game-room-code').textContent = 'Room: ' + roomCode;
    playSound('win');
  }

  // Play turn sound when it becomes your turn
  if (!wasMyTurn && state.isYourTurn) {
    playSound('turn');
    showToast('Your turn!', 'info');
  }

  renderGame(state);
});

socket.on('theme-changed', (theme) => {
  currentTheme = theme;
  document.body.className = 'theme-' + theme;
});

socket.on('emoji-reaction', (data) => {
  showFloatingEmoji(data.emoji);
});

socket.on('sound', (sound) => {
  playSound(sound);
});

// ===== UPDATE FUNCTIONS =====
function updateLobby(code) {
  document.getElementById('lobby-code').textContent = code;
}

function updateLobbyPlayers(room) {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';

  room.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <div class="player-avatar">${player.avatar ? player.avatar.charAt(0) : player.name.charAt(0)}</div>
      <div class="player-info">
        <div class="player-name">${player.name}</div>
        <div class="player-status">${player.isBot ? 'AI Bot' : 'Ready'}</div>
      </div>
      ${player.id === room.host ? '<span class="host-badge">HOST</span>' : ''}
      ${player.isBot ? '<span class="bot-badge">BOT</span>' : ''}
      ${player.isBot && room.host === socket.id ? `<button class="remove-bot" data-bot="${player.id}">×</button>` : ''}
    `;
    container.appendChild(div);
  });

  document.querySelectorAll('.remove-bot').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('remove-bot', btn.dataset.bot, (res) => {
        if (!res.success) showToast(res.error, 'error');
      });
    });
  });

  const specSection = document.getElementById('spectators-section');
  const specList = document.getElementById('lobby-spectators');
  if (room.spectators && room.spectators.length > 0) {
    specSection.style.display = 'block';
    specList.innerHTML = room.spectators.map(s => `
      <div class="spectator-item">${s.avatar ? s.avatar.charAt(0) : '👁'} ${s.name}</div>
    `).join('');
  } else {
    specSection.style.display = 'none';
  }

  document.getElementById('player-count').textContent = '(' + room.players.length + '/10)';
  document.getElementById('lobby-theme').textContent = (room.theme || 'classic').charAt(0).toUpperCase() + (room.theme || 'classic').slice(1);

  const startBtn = document.getElementById('btn-start-game');
  if (room.host === socket.id) {
    startBtn.disabled = room.players.length < 2;
    startBtn.textContent = room.players.length < 2 ? 'Start Game (need 2+)' : 'Start Game!';
    startBtn.style.display = 'flex';
    document.getElementById('bot-controls').style.display = 'block';
  } else {
    startBtn.style.display = 'none';
    document.getElementById('bot-controls').style.display = 'none';
  }
}

function renderGame(state) {
  // Turn indicator
  const turnInd = document.getElementById('turn-indicator');
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (state.isYourTurn) {
    turnInd.textContent = 'YOUR TURN!';
    turnInd.className = 'turn-badge your-turn';
    document.getElementById('game-controls').style.display = 'flex';
    document.getElementById('emoji-bar').style.display = 'flex';
  } else {
    turnInd.textContent = currentPlayer ? currentPlayer.name + "'s turn" : 'Waiting...';
    turnInd.className = 'turn-badge waiting';
    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('emoji-bar').style.display = 'none';
  }

  // Round info
  document.getElementById('round-number').textContent = state.round || 1;
  document.getElementById('target-score').textContent = state.settings?.targetScore || 500;

  // Scoreboard
  const scoreboard = document.getElementById('scoreboard');
  scoreboard.innerHTML = '';
  state.players.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'score-item' + (i === state.currentPlayerIndex ? ' active' : '');
    div.innerHTML = `
      <span class="s-name">${p.name}</span>
      <span class="s-score">${p.score || 0}</span>
      <span class="s-wins">${p.wins || 0} wins</span>
    `;
    scoreboard.appendChild(div);
  });

  // Other players with card backs
  const otherDiv = document.getElementById('other-players');
  otherDiv.innerHTML = '';
  state.players.forEach((player, index) => {
    if (index === state.yourIndex) return;
    const div = document.createElement('div');
    div.className = 'other-player' + (index === state.currentPlayerIndex ? ' active' : '');

    // Show card backs
    let cardBacks = '';
    for (let i = 0; i < Math.min(player.cardCount, 7); i++) {
      cardBacks += '<div class="mini-card-back"></div>';
    }
    if (player.cardCount > 7) cardBacks += '<span style="font-size:10px;margin-left:2px;">+' + (player.cardCount - 7) + '</span>';

    div.innerHTML = `
      <span class="other-player-avatar">${player.avatar ? player.avatar.charAt(0) : '?'}</span>
      <span class="other-player-name">${player.name}</span>
      <div style="display:flex;gap:1px;margin:2px 0;">${cardBacks}</div>
      <span class="other-player-cards">${player.cardCount} cards</span>
      ${player.saidUno ? '<span class="other-player-uno">UNO!</span>' : ''}
    `;
    otherDiv.appendChild(div);
  });

  // Deck
  document.getElementById('deck-count').textContent = state.deckCount || 0;

  // Discard pile with animation
  const discardPile = document.getElementById('discard-pile');
  const topCard = state.topCard;
  if (topCard) {
    const oldClass = discardPile.className;
    discardPile.className = 'discard-card ' + (state.currentColor || topCard.color);
    discardPile.innerHTML = getCardDisplay(topCard);

    // Add play animation if card changed
    if (oldClass !== discardPile.className) {
      discardPile.style.animation = 'none';
      discardPile.offsetHeight; // trigger reflow
      discardPile.style.animation = 'cardPlayed 0.4s ease-out';
    }
  }

  // Color indicator
  const colorInd = document.getElementById('current-color');
  const colorLabel = document.getElementById('color-label');
  colorInd.className = 'current-color ' + (state.currentColor || '');
  colorLabel.textContent = state.currentColor || '';

  // Player hand
  const handDiv = document.getElementById('player-hand');
  handDiv.innerHTML = '';
  document.getElementById('hand-count').textContent = (state.yourHand ? state.yourHand.length : 0) + ' cards';

  if (state.yourHand) {
    state.yourHand.forEach((card, index) => {
      const cardDiv = document.createElement('div');
      const isPlayable = state.isYourTurn && isCardPlayable(card, topCard, state.currentColor);
      cardDiv.className = 'player-card ' + card.color + (isPlayable ? ' playable' : '');
      cardDiv.innerHTML = getCardDisplay(card);
      if (isPlayable) {
        cardDiv.addEventListener('click', () => handleCardClick(index, card));
      }
      handDiv.appendChild(cardDiv);
    });
  }

  // Round end
  if (state.status === 'round_end') {
    showRoundEnd(state);
  }

  // Game over
  if (state.status === 'finished') {
    showGameOver(state);
  }

  // Reset buttons when not your turn
  if (!state.isYourTurn) {
    drawnCard = null;
    document.getElementById('btn-draw').style.display = 'inline-flex';
    document.getElementById('btn-pass').style.display = 'none';
  }
}

function getCardDisplay(card) {
  const value = card.value;
  const display = value === 'wild' ? 'W' : value === 'wild4' ? '+4' : value === 'skip' ? '⊘' : 
    value === 'reverse' ? '⇄' : value === 'draw2' ? '+2' : value;
  return `
    <span class="card-corner top">${display}</span>
    <span class="card-center">${display}</span>
    <span class="card-corner bottom">${display}</span>
  `;
}

function isCardPlayable(card, topCard, currentColor) {
  if (drawnCard && drawnCard !== card) return false;
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (topCard && topCard.color !== 'wild' && card.color === topCard.color) return true;
  if (topCard && card.value === topCard.value) return true;
  return false;
}

function handleCardClick(index, card) {
  if (!gameState || !gameState.isYourTurn) return;
  selectedCardIndex = index;
  if (card.type === 'wild') {
    document.getElementById('color-modal').classList.add('active');
  } else {
    playSelectedCard();
  }
}

function playSelectedCard(chosenColor) {
  socket.emit('play-card', { cardIndex: selectedCardIndex, chosenColor }, (res) => {
    if (res.success) {
      drawnCard = null;
      document.getElementById('btn-draw').style.display = 'inline-flex';
      document.getElementById('btn-pass').style.display = 'none';
    } else {
      showToast(res.error || 'Invalid play', 'error');
      playSound('error');
    }
  });
  selectedCardIndex = null;
}

function updateChat(messages) {
  const chatDiv = document.getElementById('chat-messages');
  if (!chatDiv) return;
  chatDiv.innerHTML = '';
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'chat-message';
    if (msg.type === 'system') div.classList.add('system');
    if (msg.type === 'emoji') div.classList.add('emoji-msg');
    div.textContent = msg.text;
    chatDiv.appendChild(div);
  });
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function showRoundEnd(state) {
  const modal = document.getElementById('roundend-modal');
  document.getElementById('round-winner-name').textContent = (state.winner || 'Someone') + ' wins!';
  document.getElementById('round-winner-points').textContent = 'Round ' + (state.round - 1);

  const scoresDiv = document.getElementById('round-scores');
  scoresDiv.innerHTML = '';
  state.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'score-row' + (p.name === state.winner ? ' winner' : '');
    div.innerHTML = `<span>${p.name}</span><span>${p.score || 0} pts</span>`;
    scoresDiv.appendChild(div);
  });

  const nextBtn = document.getElementById('btn-next-round');
  nextBtn.style.display = isHost ? 'flex' : 'none';

  modal.classList.add('active');
  playSound('win');
}

function showGameOver(state) {
  const modal = document.getElementById('gameover-modal');
  document.getElementById('winner-text').textContent = (state.winner || 'Winner') + '!';

  const scoresDiv = document.getElementById('final-scores');
  scoresDiv.innerHTML = '';
  const sorted = [...state.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  sorted.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'final-score-item' + (i === 0 ? ' champion' : '');
    div.innerHTML = `
      <span>${i + 1}. ${p.name} ${p.id === socket.id ? '(You)' : ''}</span>
      <span>${p.score || 0} pts | ${p.wins || 0} wins</span>
    `;
    scoresDiv.appendChild(div);
  });

  modal.classList.add('active');
  playSound('win');
}

function showFloatingEmoji(emoji) {
  const container = document.getElementById('floating-emojis');
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = (15 + Math.random() * 70) + '%';
  el.style.bottom = '15%';
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== KEYBOARD =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('color-modal').classList.remove('active');
    document.getElementById('chat-panel').classList.remove('active');
    document.getElementById('roundend-modal').classList.remove('active');
  }
  if ((e.key === 'u' || e.key === 'U') && currentScreen === 'game') {
    document.getElementById('btn-uno').click();
  }
  if ((e.key === 'd' || e.key === 'D') && currentScreen === 'game') {
    document.getElementById('btn-draw').click();
  }
  if ((e.key === 'p' || e.key === 'P') && currentScreen === 'game') {
    const passBtn = document.getElementById('btn-pass');
    if (passBtn.style.display !== 'none') passBtn.click();
  }
});

// ===== INIT =====
createParticles();
showScreen('landing');
