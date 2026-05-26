// ==================== GAME CLIENT ====================
let socket = null;
let gameState = null;
let myPlayerId = null;
let isHost = false;
let isSpectator = false;
let selectedCard = null;
let soundEnabled = true;
let musicEnabled = false;
let currentTheme = 'classic';

// Card value display mapping
const CARD_DISPLAY = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'skip': '⊘', 'reverse': '⇄', '+2': '+2',
  'wild': '★', 'wild+4': '+4'
};

// Initialize game page
function initGame() {
  // Retrieve session data
  const storedState = sessionStorage.getItem('gameState');
  const roomId = sessionStorage.getItem('roomId');
  myPlayerId = sessionStorage.getItem('playerId');
  isHost = sessionStorage.getItem('isHost') === 'true';
  isSpectator = sessionStorage.getItem('isSpectator') === 'true';

  if (!roomId || !myPlayerId) {
    window.location.href = '/';
    return;
  }

  // Connect socket
  const serverUrl = window.location.origin;
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10
  });

  socket.on('connect', () => {
    console.log('Game socket connected');
    // Re-join room
    socket.emit('joinRoom', { roomId, playerName: 'Reconnected', asSpectator: isSpectator }, () => {});
  });

  socket.on('gameState', (state) => {
    handleGameState(state);
  });

  socket.on('chatMessage', (msg) => {
    addChatMessage(msg);
  });

  socket.on('emojiReaction', (data) => {
    showEmojiReaction(data);
  });

  socket.on('kicked', () => {
    Animations.showToast('You were kicked', 'error');
    setTimeout(() => window.location.href = '/', 2000);
  });

  // Initialize UI
  document.getElementById('game-room-code').textContent = roomId;

  if (isSpectator) {
    document.getElementById('spectator-banner').classList.remove('hidden');
    document.getElementById('your-hand-area').style.display = 'none';
  }

  // Sound init on first interaction
  document.addEventListener('click', () => SoundEngine.init(), { once: true });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      drawCard();
    }
    if (e.code === 'KeyU' && !e.repeat) {
      e.preventDefault();
      sayUno();
    }
  });

  // Chat input enter key
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // Initial render from stored state
  if (storedState) {
    try {
      const state = JSON.parse(storedState);
      handleGameState(state);
      sessionStorage.removeItem('gameState');
    } catch(e) {}
  }
}

// ==================== GAME STATE HANDLER ====================
function handleGameState(state) {
  const prevState = gameState;
  gameState = state;

  // Update theme
  if (state.settings?.theme && state.settings.theme !== currentTheme) {
    currentTheme = state.settings.theme;
    document.body.className = `game-body theme-${currentTheme}`;
  }

  // Update round
  document.getElementById('round-number').textContent = state.round || 1;

  // Update turn indicator
  updateTurnIndicator(state);

  // Update opponents
  updateOpponents(state);

  // Update discard pile
  updateDiscardPile(state);

  // Update deck
  updateDeck(state);

  // Update your hand
  if (!isSpectator) {
    updateYourHand(state);
  }

  // Update pending draw
  updatePendingDraw(state);

  // Update direction
  updateDirection(state);

  // Update scores sidebar
  updateScoresTab(state);

  // Update players sidebar
  updatePlayersTab(state);

  // Check for round/game end
  checkGameEnd(state, prevState);

  // Play sounds for state changes
  playStateSounds(state, prevState);
}

function updateTurnIndicator(state) {
  const indicator = document.getElementById('turn-indicator');
  const text = document.getElementById('current-turn-text');
  const currentPlayer = state.players?.find(p => p.id === state.currentPlayerId);

  if (!currentPlayer) {
    text.textContent = 'Waiting...';
    indicator.classList.remove('my-turn');
    return;
  }

  const isMyTurn = state.isYourTurn;
  text.textContent = isMyTurn ? 'Your Turn!' : `${currentPlayer.name}'s Turn`;

  if (isMyTurn) {
    indicator.classList.add('my-turn');
    // Remove any disabled states from cards
    document.querySelectorAll('.game-card.disabled').forEach(c => c.classList.remove('disabled'));
  } else {
    indicator.classList.remove('my-turn');
    // Disable all cards when not your turn
    document.querySelectorAll('.game-card').forEach(c => c.classList.add('disabled'));
  }
}

function updateOpponents(state) {
  const container = document.getElementById('opponents-area');
  if (!container) return;

  container.innerHTML = '';

  state.players?.forEach((player, index) => {
    if (player.id === myPlayerId) return;

    const isCurrent = player.id === state.currentPlayerId;
    const isUno = player.cardCount === 1;

    const opponent = document.createElement('div');
    opponent.className = `opponent ${isCurrent ? 'active' : ''} ${isUno ? 'uno' : ''}`;
    opponent.innerHTML = `
      <div class="opponent-avatar">${player.name.charAt(0).toUpperCase()}</div>
      <div class="opponent-name">${player.name}</div>
      <div class="opponent-cards">
        ${Array(Math.min(player.cardCount, 5)).fill(0).map(() => 
          '<div class="mini-card"></div>'
        ).join('')}
      </div>
      <div class="opponent-count">${player.cardCount} cards</div>
    `;

    container.appendChild(opponent);
  });
}

function updateDiscardPile(state) {
  const pile = document.getElementById('top-card');
  if (!pile || !state.topCard) return;

  const card = state.topCard;
  const color = card.chosenColor || card.color;
  const value = CARD_DISPLAY[card.value] || card.value;

  pile.className = `discard-card ${color}`;
  pile.innerHTML = `
    <span class="card-corner top-left">${value}</span>
    <div class="card-inner">${value}</div>
    <span class="card-corner bottom-right">${value}</span>
  `;

  // Animate if card changed
  if (state.lastAction && state.lastAction.type === 'play') {
    Animations.pop(pile);
  }
}

function updateDeck(state) {
  const count = document.getElementById('deck-count');
  if (count) count.textContent = state.deckCount || 0;
}

function updateYourHand(state) {
  const container = document.getElementById('your-cards');
  if (!container) return;

  const isMyTurn = state.isYourTurn;
  const topCard = state.topCard;
  const pendingDraw = state.pendingDraw;

  container.innerHTML = '';

  state.yourHand?.forEach((card, index) => {
    const cardEl = createCardElement(card, isMyTurn, topCard, pendingDraw);
    container.appendChild(cardEl);
  });

  // Update UNO button visibility
  const unoBtn = document.getElementById('uno-btn');
  if (unoBtn) {
    const myHand = state.yourHand || [];
    if (myHand.length === 2 && isMyTurn) {
      unoBtn.classList.remove('hidden');
    } else {
      unoBtn.classList.add('hidden');
    }
  }

  // Update draw button
  const drawBtn = document.getElementById('draw-btn');
  if (drawBtn) {
    if (isMyTurn) {
      drawBtn.classList.remove('disabled');
      drawBtn.style.opacity = '1';
    } else {
      drawBtn.classList.add('disabled');
      drawBtn.style.opacity = '0.5';
    }
  }
}

function createCardElement(card, isMyTurn, topCard, pendingDraw) {
  const el = document.createElement('div');
  const color = card.color;
  const value = CARD_DISPLAY[card.value] || card.value;

  el.className = `game-card ${color}`;
  el.dataset.cardId = card.id;

  el.innerHTML = `
    <span class="card-corner top-left">${value}</span>
    <div class="card-inner">${value}</div>
    <span class="card-corner bottom-right">${value}</span>
  `;

  // Check if playable
  if (isMyTurn && !isSpectator) {
    const isValid = isValidPlay(card, topCard, pendingDraw);
    if (!isValid) {
      el.classList.add('disabled');
    }

    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) {
        Animations.shake(el);
        SoundEngine.error();
        return;
      }

      SoundEngine.cardSelect();

      if (card.type === 'wild') {
        selectedCard = card;
        showColorPicker();
      } else {
        playCard(card.id);
      }
    });

    // Hover sound
    el.addEventListener('mouseenter', () => {
      if (!el.classList.contains('disabled')) {
        SoundEngine.cardSelect();
      }
    });
  } else {
    el.classList.add('disabled');
  }

  return el;
}

function isValidPlay(card, topCard, pendingDraw) {
  if (!topCard) return true;

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

function updatePendingDraw(state) {
  const el = document.getElementById('pending-draw');
  const count = document.getElementById('pending-count');

  if (state.pendingDraw > 0) {
    el.classList.remove('hidden');
    count.textContent = `+${state.pendingDraw}`;
  } else {
    el.classList.add('hidden');
  }
}

function updateDirection(state) {
  const el = document.getElementById('direction-indicator');
  if (el) {
    el.textContent = state.direction === 1 ? '➡️' : '⬅️';
    if (state.direction === -1) {
      el.classList.add('reverse');
    } else {
      el.classList.remove('reverse');
    }
  }
}

// ==================== ACTIONS ====================
function playCard(cardId, color = null) {
  if (isSpectator) return;
  if (!gameState?.isYourTurn) {
    Animations.showToast('Not your turn!', 'error');
    SoundEngine.error();
    return;
  }

  SoundEngine.cardPlay();

  // Determine sound based on card type
  const card = gameState.yourHand?.find(c => c.id === cardId);
  if (card) {
    if (card.type === 'wild') {
      SoundEngine.wildCard();
    } else if (card.value === 'skip') {
      SoundEngine.skip();
    } else if (card.value === 'reverse') {
      SoundEngine.reverse();
    } else if (card.value === '+2') {
      SoundEngine.drawTwo();
    } else if (card.value === 'wild+4') {
      SoundEngine.drawFour();
    } else if (['0','7'].includes(card.value)) {
      SoundEngine.specialCard();
    }
  }

  socket.emit('playCard', { cardId, chosenColor: color }, (response) => {
    if (!response.success) {
      Animations.showToast(response.error || 'Cannot play card', 'error');
      SoundEngine.error();
      Animations.shake(document.getElementById('discard-pile'));
    }
  });

  hideColorPicker();
  selectedCard = null;
}

function drawCard() {
  if (isSpectator) return;
  if (!gameState?.isYourTurn) {
    Animations.showToast('Not your turn!', 'error');
    SoundEngine.error();
    return;
  }

  SoundEngine.cardDraw();

  socket.emit('drawCard', (response) => {
    if (!response.success) {
      Animations.showToast(response.error || 'Cannot draw', 'error');
      SoundEngine.error();
    } else if (response.canPlayDrawn && response.drawnCard) {
      // Auto-highlight the drawn card
      setTimeout(() => {
        const cardEl = document.querySelector(`[data-card-id="${response.drawnCard.id}"]`);
        if (cardEl) {
          cardEl.classList.add('selected');
          setTimeout(() => cardEl.classList.remove('selected'), 1000);
        }
      }, 100);
    }
  });
}

function sayUno() {
  if (isSpectator) return;

  SoundEngine.uno();
  Animations.sparkle(document.getElementById('uno-btn'));

  socket.emit('sayUno', (response) => {
    if (response.success) {
      Animations.showToast('UNO! 🔥', 'success');
    } else {
      Animations.showToast('You need exactly 1 card!', 'error');
      SoundEngine.error();
    }
  });
}

// ==================== COLOR PICKER ====================
function showColorPicker() {
  const picker = document.getElementById('color-picker');
  if (picker) picker.classList.remove('hidden');
}

function hideColorPicker() {
  const picker = document.getElementById('color-picker');
  if (picker) picker.classList.add('hidden');
}

function pickColor(color) {
  if (selectedCard) {
    playCard(selectedCard.id, color);
  }
}

// ==================== CHAT & REACTIONS ====================
function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  socket.emit('chatMessage', message);
  input.value = '';
  SoundEngine.chat();
}

function sendEmoji(emoji) {
  socket.emit('emojiReaction', emoji);
  SoundEngine.emoji();

  // Show locally too
  const overlay = document.getElementById('emoji-overlay');
  if (overlay) {
    Animations.showFloatingEmoji(emoji, window.innerWidth / 2, window.innerHeight / 2);
  }
}

function addChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `chat-message ${msg.sender === 'system' ? 'system' : ''}`;

  if (msg.sender !== 'system') {
    div.innerHTML = `<div class="sender">${msg.sender}</div>${msg.message}`;
  } else {
    div.textContent = msg.message;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Play sound for non-system messages
  if (msg.sender !== 'system') {
    SoundEngine.chat();
  }
}

function showEmojiReaction(data) {
  const overlay = document.getElementById('emoji-overlay');
  if (!overlay) return;

  // Find player position or use random
  const playerEl = document.querySelector(`[data-player-id="${data.playerId}"]`);
  let x = Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1;
  let y = Math.random() * window.innerHeight * 0.5 + window.innerHeight * 0.2;

  if (playerEl) {
    const rect = playerEl.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top;
  }

  Animations.showFloatingEmoji(data.emoji, x, y);
}

// ==================== SIDEBAR & TABS ====================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
  SoundEngine.cardSelect();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  SoundEngine.cardSelect();
}

function updatePlayersTab(state) {
  const container = document.getElementById('players-detail');
  if (!container) return;

  container.innerHTML = '';

  state.players?.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-detail-item';
    div.dataset.playerId = player.id;

    const status = player.isCurrentPlayer ? '🟢 Playing' : (player.saidUno ? '🔥 UNO!' : '⏳ Waiting');

    div.innerHTML = `
      <div class="player-detail-avatar">${player.name.charAt(0).toUpperCase()}</div>
      <div class="player-detail-info">
        <div class="player-detail-name">${player.name} ${player.isBot ? '🤖' : ''}</div>
        <div class="player-detail-meta">${player.cardCount} cards • ${status}</div>
      </div>
    `;

    container.appendChild(div);
  });
}

function updateScoresTab(state) {
  const container = document.getElementById('scores-detail');
  if (!container) return;

  container.innerHTML = '';

  const sorted = [...(state.players || [])].sort((a, b) => {
    const scoreA = state.scores?.[a.id] || 0;
    const scoreB = state.scores?.[b.id] || 0;
    return scoreB - scoreA;
  });

  sorted.forEach((player, index) => {
    const score = state.scores?.[player.id] || 0;
    const rankClass = index === 0 ? 'gold' : (index === 1 ? 'silver' : (index === 2 ? 'bronze' : ''));

    const div = document.createElement('div');
    div.className = 'score-item';
    div.innerHTML = `
      <div class="score-rank ${rankClass}">${index + 1}</div>
      <div class="score-name">${player.name}</div>
      <div class="score-value">${score}</div>
    `;

    container.appendChild(div);
  });
}

// ==================== SCORES MODAL ====================
function showScores() {
  if (!gameState) return;

  const modal = document.getElementById('score-modal');
  const table = document.getElementById('score-table');

  table.innerHTML = '';

  const sorted = [...(gameState.players || [])].sort((a, b) => {
    const scoreA = gameState.scores?.[a.id] || 0;
    const scoreB = gameState.scores?.[b.id] || 0;
    return scoreB - scoreA;
  });

  sorted.forEach((player, index) => {
    const score = gameState.scores?.[player.id] || 0;
    const row = document.createElement('div');
    row.className = 'score-item';
    row.style.marginBottom = '10px';
    row.innerHTML = `
      <div class="score-rank ${index < 3 ? ['gold','silver','bronze'][index] : ''}">${index + 1}</div>
      <div class="score-name">${player.name}</div>
      <div class="score-value">${score} pts</div>
    `;
    table.appendChild(row);
  });

  modal.classList.remove('hidden');
  SoundEngine.cardSelect();
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// ==================== GAME END ====================
function checkGameEnd(state, prevState) {
  // Round end
  if (state.gameState === 'roundend' && prevState?.gameState === 'playing') {
    const winner = state.players?.find(p => p.id === state.winner);
    if (winner) {
      SoundEngine.win();

      const modal = document.getElementById('round-modal');
      document.getElementById('round-winner').textContent = `🏆 ${winner.name} wins the round!`;

      const scoresDiv = document.getElementById('round-scores');
      scoresDiv.innerHTML = '';

      state.players?.forEach(p => {
        const score = state.scores?.[p.id] || 0;
        const div = document.createElement('div');
        div.className = 'score-item';
        div.innerHTML = `
          <div class="score-name">${p.name}</div>
          <div class="score-value">${score} pts</div>
        `;
        scoresDiv.appendChild(div);
      });

      // Show next round button only for host
      const nextBtn = document.getElementById('next-round-btn');
      if (nextBtn) {
        nextBtn.style.display = isHost ? 'inline-block' : 'none';
      }

      modal.classList.remove('hidden');
      Animations.confetti();
    }
  }

  // Game over
  if (state.gameState === 'finished' && prevState?.gameState !== 'finished') {
    const winner = state.players?.find(p => p.id === state.winner);
    if (winner) {
      SoundEngine.win();

      const modal = document.getElementById('gameover-modal');
      document.getElementById('game-winner-name').textContent = winner.name;

      const finalDiv = document.getElementById('final-scores');
      finalDiv.innerHTML = '';

      const sorted = [...(state.players || [])].sort((a, b) => {
        const scoreA = state.scores?.[a.id] || 0;
        const scoreB = state.scores?.[b.id] || 0;
        return scoreB - scoreA;
      });

      sorted.forEach((p, i) => {
        const score = state.scores?.[p.id] || 0;
        const div = document.createElement('div');
        div.className = 'score-item';
        div.innerHTML = `
          <div class="score-rank ${i < 3 ? ['gold','silver','bronze'][i] : ''}">${i + 1}</div>
          <div class="score-name">${p.name}</div>
          <div class="score-value">${score}</div>
        `;
        finalDiv.appendChild(div);
      });

      modal.classList.remove('hidden');
      Animations.confetti();
    }
  }
}

function nextRound() {
  if (!isHost) return;

  socket.emit('nextRound', (response) => {
    if (response.success) {
      closeModal('round-modal');
    }
  });
}

function playAgain() {
  if (isHost) {
    socket.emit('nextRound', () => {});
  }
  closeModal('gameover-modal');
}

function goHome() {
  window.location.href = '/';
}

// ==================== SOUND CONTROLS ====================
function toggleSound() {
  soundEnabled = SoundEngine.toggleSound();
  const btn = document.getElementById('sound-btn');
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  btn.classList.toggle('muted', !soundEnabled);
  Animations.showToast(soundEnabled ? 'Sound On' : 'Sound Off');
}

function toggleMusic() {
  musicEnabled = SoundEngine.toggleMusic();
  const btn = document.getElementById('music-btn');
  btn.classList.toggle('muted', !musicEnabled);
  Animations.showToast(musicEnabled ? 'Music On' : 'Music Off');
}

// ==================== SOUND TRIGGERS ====================
function playStateSounds(state, prevState) {
  if (!prevState) return;

  // Turn change
  if (state.currentPlayerId !== prevState.currentPlayerId) {
    if (state.isYourTurn) {
      SoundEngine.turnStart();
    }
  }

  // Opponent UNO
  const prevUno = prevState.players?.find(p => p.saidUno);
  const currUno = state.players?.find(p => p.saidUno && p.id !== myPlayerId);
  if (currUno && (!prevUno || prevUno.id !== currUno.id)) {
    SoundEngine.uno();
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', initGame);
