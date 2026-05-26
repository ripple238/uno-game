const socket = io();
let currentScreen = 'landing', roomCode = null, playerName = '', gameState = null, selectedCard = null, drawnCard = null, isHost = false, soundOn = true, myIndex = -1;

// ===== AUDIO =====
const AC = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AC(); }
function tone(f, type, dur, vol = 0.12) {
  if (!soundOn || !audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = type; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function chord(freqs, type, dur, vol) { freqs.forEach((f, i) => setTimeout(() => tone(f, type, dur, vol), i * 80)); }
function sfx(type) {
  initAudio();
  switch(type) {
    case 'play': tone(523, 'sine', 0.2, 0.1); setTimeout(() => tone(659, 'sine', 0.2, 0.1), 100); break;
    case 'special': tone(400, 'sawtooth', 0.15, 0.1); setTimeout(() => tone(600, 'sawtooth', 0.2, 0.1), 100); setTimeout(() => tone(800, 'sawtooth', 0.25, 0.1), 200); break;
    case 'wild': chord([523, 659, 784], 'sine', 0.35, 0.1); break;
    case 'draw': tone(300, 'triangle', 0.15, 0.08); setTimeout(() => tone(250, 'triangle', 0.15, 0.06), 80); break;
    case 'uno': tone(880, 'square', 0.15, 0.08); setTimeout(() => tone(1100, 'square', 0.2, 0.08), 120); setTimeout(() => tone(1320, 'square', 0.25, 0.08), 240); break;
    case 'win': chord([523, 659, 784, 1047], 'sine', 0.4, 0.1); setTimeout(() => chord([659, 784, 1047, 1319], 'sine', 0.4, 0.1), 300); setTimeout(() => chord([784, 1047, 1319, 1568], 'sine', 0.5, 0.1), 600); break;
    case 'pass': tone(350, 'sine', 0.2, 0.06); break;
    case 'error': tone(180, 'sawtooth', 0.3, 0.06); break;
    case 'turn': tone(440, 'sine', 0.12, 0.06); break;
  }
}

// ===== NAVIGATION =====
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screen + '-screen').classList.add('active');
  currentScreen = screen;
  if (screen !== 'landing') initAudio();
}

// ===== SEGMENTED CONTROL =====
document.querySelectorAll('#score-seg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#score-seg button').forEach(b => b.classList.remove('a'));
    btn.classList.add('a');
  });
});

// ===== ROOM ACTIONS =====
function createRoom() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { toast('Enter your name', 'err'); sfx('error'); return; }
  const score = parseInt(document.querySelector('#score-seg .a')?.dataset?.v || '500');
  playerName = name;
  socket.emit('create-room', { playerName: name, settings: { targetScore: score } }, res => {
    if (res.success) { roomCode = res.code; isHost = true; goTo('lobby'); updateLobby(); toast('Room created!', 'ok'); sfx('win'); }
    else { toast(res.error || 'Failed', 'err'); sfx('error'); }
  });
}

function joinRoom() {
  const code = document.getElementById('j-code').value.trim().toUpperCase();
  const name = document.getElementById('j-name').value.trim();
  if (!code || !name) { toast('Fill all fields', 'err'); sfx('error'); return; }
  playerName = name;
  socket.emit('join-room', { roomCode: code, playerName: name }, res => {
    if (res.success) { roomCode = code; goTo('lobby'); updateLobby(); sfx('play'); }
    else { toast(res.error || 'Failed', 'err'); sfx('error'); }
  });
}

function spectateRoom() {
  const code = document.getElementById('s-code').value.trim().toUpperCase();
  const name = document.getElementById('s-name').value.trim() || 'Spectator';
  if (!code) { toast('Enter code', 'err'); return; }
  playerName = name;
  socket.emit('spectate-room', { roomCode: code, playerName: name }, res => {
    if (res.success) { roomCode = code; goTo('lobby'); updateLobby(); toast('Spectating', 'inf'); }
    else toast(res.error || 'Failed', 'err');
  });
}

function copyCode() {
  navigator.clipboard.writeText(roomCode).then(() => { toast('Copied!', 'ok'); sfx('play'); });
}

function addBot(diff) {
  socket.emit('add-bot', diff, res => { if (!res.success) toast(res.error, 'err'); });
}

function startGame() {
  socket.emit('start-game', null, res => {
    if (!res.success) { toast(res.error || 'Failed', 'err'); sfx('error'); }
  });
}

function nextRound() {
  document.getElementById('round-modal').classList.remove('on');
  socket.emit('next-round', null, res => { if (!res.success) toast(res.error, 'err'); });
}

function playAgain() {
  document.getElementById('over-modal').classList.remove('on');
  socket.emit('start-game', null, () => {});
}

// ===== GAME ACTIONS =====
function drawCard() {
  socket.emit('draw-card', null, res => {
    if (res.success) {
      drawnCard = res.card; sfx('draw');
      document.getElementById('btn-draw').style.display = 'none';
      document.getElementById('btn-pass').style.display = 'inline-block';
      toast('Card drawn. Play or pass.', 'inf');
    } else { toast(res.error, 'err'); sfx('error'); }
  });
}

function passTurn() {
  socket.emit('pass-turn', null, res => {
    if (res.success) {
      sfx('pass'); drawnCard = null;
      document.getElementById('btn-draw').style.display = 'inline-block';
      document.getElementById('btn-pass').style.display = 'none';
    } else toast(res.error, 'err');
  });
}

function sayUno() {
  socket.emit('say-uno', null, res => {
    if (res.success) sfx('uno');
    else toast(res.error, 'err');
  });
}

function pickColor(color) {
  sfx('wild');
  playCard(selectedCard, color);
  document.getElementById('color-modal').classList.remove('on');
}

function playCard(idx, color) {
  socket.emit('play-card', { cardIndex: idx, chosenColor: color }, res => {
    if (res.success) {
      sfx(res.sound || 'play');
      drawnCard = null;
      document.getElementById('btn-draw').style.display = 'inline-block';
      document.getElementById('btn-pass').style.display = 'none';
    } else { toast(res.error || 'Invalid', 'err'); sfx('error'); }
  });
  selectedCard = null;
}

function sendEmoji(emoji) {
  socket.emit('emoji-reaction', emoji);
  floatEmoji(emoji);
  sfx('play');
}

function toggleSound() {
  soundOn = !soundOn;
  const btn = document.getElementById('snd-btn');
  btn.textContent = soundOn ? '🔊' : '🔇';
  toast(soundOn ? 'Sound ON' : 'Sound OFF', 'inf');
}

function toggleChat() {
  document.getElementById('chat').classList.toggle('open');
}

function sendChat() {
  const inp = document.getElementById('chat-in');
  const msg = inp.value.trim();
  if (msg) { socket.emit('send-message', { message: msg }); inp.value = ''; }
}

document.getElementById('chat-in').addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });

// ===== SOCKET EVENTS =====
socket.on('room-update', room => {
  if (currentScreen === 'lobby') renderLobby(room);
  updateChat(room.messages);
});

socket.on('game-state', state => {
  const wasMyTurn = gameState && gameState.isYourTurn;
  gameState = state; myIndex = state.yourIndex;
  if (currentScreen !== 'game') { goTo('game'); sfx('win'); }
  if (!wasMyTurn && state.isYourTurn) { sfx('turn'); toast('Your turn!', 'inf'); }
  renderGame(state);
});

socket.on('emoji-reaction', data => floatEmoji(data.emoji));
socket.on('sound', sfx);

// ===== RENDER FUNCTIONS =====
function updateLobby() {
  document.getElementById('l-code').textContent = roomCode;
  document.getElementById('g-room').textContent = 'Room: ' + roomCode;
}

function renderLobby(room) {
  const container = document.getElementById('l-players');
  container.innerHTML = '';
  room.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'p-item';
    div.innerHTML = `
      <div class="p-av">${p.avatar ? p.avatar.charAt(0) : p.name.charAt(0)}</div>
      <span class="p-name">${p.name}</span>
      ${p.id === room.host ? '<span class="p-badge host-bg">HOST</span>' : ''}
      ${p.isBot ? '<span class="p-badge bot-bg">BOT</span>' : ''}
      ${p.isBot && room.host === socket.id ? `<button onclick="removeBot('${p.id}')" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:18px;">×</button>` : ''}
    `;
    container.appendChild(div);
  });
  document.getElementById('l-count').textContent = '(' + room.players.length + '/10)';
  const btn = document.getElementById('s-btn');
  if (room.host === socket.id) {
    btn.disabled = room.players.length < 2;
    btn.textContent = room.players.length < 2 ? 'Need 2+ players' : 'Start Game!';
    btn.style.display = 'block';
    document.getElementById('bot-row').style.display = 'flex';
  } else {
    btn.style.display = 'none';
    document.getElementById('bot-row').style.display = 'none';
  }
}

function removeBot(id) {
  socket.emit('remove-bot', id, res => { if (!res.success) toast(res.error, 'err'); });
}

function renderGame(state) {
  // Top bar
  document.getElementById('g-round').textContent = state.round || 1;
  document.getElementById('g-target').textContent = state.settings?.targetScore || 500;

  // Direction
  document.getElementById('dir-icon').textContent = state.direction === 1 ? '↻' : '↺';

  // Table players (circular layout)
  const tpContainer = document.getElementById('table-players');
  tpContainer.innerHTML = '';
  const otherPlayers = state.players.filter((_, i) => i !== state.yourIndex);
  otherPlayers.forEach((p, idx) => {
    const div = document.createElement('div');
    const actualIdx = state.players.findIndex(pl => pl.id === p.id);
    const isActive = actualIdx === state.currentPlayerIndex;
    div.className = 'table-player tp-pos-' + idx + (isActive ? ' active' : '');

    let miniCards = '';
    for (let i = 0; i < Math.min(p.cardCount, 6); i++) {
      miniCards += '<div class="tp-mini-card"></div>';
    }
    if (p.cardCount > 6) miniCards += '<span style="font-size:9px;margin-left:2px">+' + (p.cardCount - 6) + '</span>';

    div.innerHTML = `
      <div class="tp-avatar">${p.avatar ? p.avatar.charAt(0) : '?'}</div>
      <span class="tp-name">${p.name}</span>
      <div class="tp-cards">${miniCards}</div>
      ${p.saidUno ? '<span class="tp-uno">UNO!</span>' : ''}
      <span class="tp-score">${p.score || 0} pts</span>
    `;
    tpContainer.appendChild(div);
  });

  // Discard pile
  const discard = document.getElementById('discard');
  const top = state.topCard;
  if (top) {
    discard.className = 'discard-center ' + (state.currentColor || top.color);
    discard.textContent = getCardSymbol(top.value);
  }

  // Color dot
  const dot = document.getElementById('c-dot');
  dot.className = 'color-dot ' + (state.currentColor || '');
  dot.style.background = state.currentColor ? 'var(--' + state.currentColor + ')' : 'transparent';

  // Deck count
  document.getElementById('d-count').textContent = state.deckCount || 0;

  // Your hand
  const handDiv = document.getElementById('y-hand');
  handDiv.innerHTML = '';
  document.getElementById('y-count').textContent = (state.yourHand?.length || 0) + ' cards';

  if (state.yourHand) {
    state.yourHand.forEach((card, idx) => {
      const div = document.createElement('div');
      const playable = state.isYourTurn && isPlayable(card, top, state.currentColor);
      div.className = 'ycard ' + card.color + (playable ? ' playable' : '');
      div.innerHTML = `
        <span class="yc-corner t">${getCardSymbol(card.value)}</span>
        <span class="yc-center">${getCardSymbol(card.value)}</span>
        <span class="yc-corner b">${getCardSymbol(card.value)}</span>
      `;
      if (playable) div.onclick = () => clickCard(idx, card);
      handDiv.appendChild(div);
    });
  }

  // Controls visibility
  const ctrl = document.getElementById('g-ctrl');
  const ebar = document.getElementById('e-bar');
  if (state.isYourTurn) {
    ctrl.style.display = 'flex';
    ebar.style.display = 'flex';
  } else {
    ctrl.style.display = 'none';
    ebar.style.display = 'none';
  }

  if (!state.isYourTurn) {
    drawnCard = null;
    document.getElementById('btn-draw').style.display = 'inline-block';
    document.getElementById('btn-pass').style.display = 'none';
  }

  // Round end / Game over
  if (state.status === 'round_end') showRoundEnd(state);
  if (state.status === 'finished') showGameOver(state);
}

function getCardSymbol(val) {
  return val === 'wild' ? 'W' : val === 'wild4' ? '+4' : val === 'skip' ? '⊘' : val === 'reverse' ? '⇄' : val === 'draw2' ? '+2' : val;
}

function isPlayable(card, top, color) {
  if (drawnCard && drawnCard !== card) return false;
  if (card.type === 'wild') return true;
  if (card.color === color) return true;
  if (top && top.color !== 'wild' && card.color === top.color) return true;
  if (top && card.value === top.value) return true;
  return false;
}

function clickCard(idx, card) {
  if (!gameState || !gameState.isYourTurn) return;
  selectedCard = idx;
  if (card.type === 'wild') document.getElementById('color-modal').classList.add('on');
  else playCard(idx);
}

function showRoundEnd(state) {
  document.getElementById('rw-name').textContent = (state.winner || 'Someone') + ' wins Round ' + (state.round - 1) + '!';
  const list = document.getElementById('rw-scores');
  list.innerHTML = '';
  state.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'sc-row' + (p.name === state.winner ? ' win' : '');
    div.innerHTML = `<span>${p.name}</span><span>${p.score || 0} pts</span>`;
    list.appendChild(div);
  });
  document.getElementById('nr-btn').style.display = isHost ? 'block' : 'none';
  document.getElementById('round-modal').classList.add('on');
  sfx('win');
}

function showGameOver(state) {
  document.getElementById('gw-name').textContent = state.winner + ' wins the game!';
  const list = document.getElementById('gw-scores');
  list.innerHTML = '';
  const sorted = [...state.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  sorted.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'sc-row' + (i === 0 ? ' win' : '');
    div.innerHTML = `<span>${i + 1}. ${p.name}</span><span>${p.score || 0} pts | ${p.wins || 0} wins</span>`;
    list.appendChild(div);
  });
  document.getElementById('over-modal').classList.add('on');
  sfx('win');
}

function updateChat(msgs) {
  const div = document.getElementById('chat-msgs');
  div.innerHTML = '';
  msgs.forEach(m => {
    const d = document.createElement('div');
    d.className = 'chat-msg' + (m.type === 'system' ? ' sys' : '');
    d.textContent = m.text;
    div.appendChild(d);
  });
  div.scrollTop = div.scrollHeight;
}

function floatEmoji(emoji) {
  const container = document.getElementById('float-emojis');
  const el = document.createElement('div');
  el.className = 'float-emoji';
  el.textContent = emoji;
  el.style.left = (15 + Math.random() * 70) + '%';
  el.style.bottom = '20%';
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function toast(msg, type) {
  const container = document.getElementById('toasts');
  const div = document.createElement('div');
  div.className = 'toast ' + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
    document.getElementById('chat').classList.remove('open');
  }
  if (currentScreen === 'game') {
    if (e.key === 'u' || e.key === 'U') sayUno();
    if (e.key === 'd' || e.key === 'D') drawCard();
    if (e.key === 'p' || e.key === 'P') { const pb = document.getElementById('btn-pass'); if (pb.style.display !== 'none') passTurn(); }
  }
});

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); });
});
