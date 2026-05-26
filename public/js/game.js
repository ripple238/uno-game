// ==================== GAME CLIENT ====================
let socket = null;
let state = null;
let myId = null;
let isHost = false;
let isSpec = false;
let selectedCard = null;
let soundOn = true;
let musicOn = false;
let timerInterval = null;
let gameStartTime = Date.now();

const DISPLAY = {
  '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  'skip':'⊘','reverse':'⇄','draw2':'+2','wild':'★','wild4':'+4'
};

const SEAT_ORDER = ['seat-top', 'seat-right', 'seat-bottomright', 'seat-bottomleft', 'seat-left'];

function init() {
  const stored = sessionStorage.getItem('gameData');
  const rid = sessionStorage.getItem('roomId');
  myId = sessionStorage.getItem('myId');
  isHost = sessionStorage.getItem('host') === 'true';
  isSpec = sessionStorage.getItem('spectator') === 'true';

  if (!rid || !myId) { window.location.href = '/'; return; }

  const url = window.location.origin;
  socket = io(url, { transports: ['websocket','polling'], reconnection: true, reconnectionAttempts: 10 });

  socket.on('connect', () => {
    socket.emit('join', { roomId: rid, name: 'Reconnected', asSpectator: isSpec }, () => {});
  });

  socket.on('state', data => handleState(data));
  socket.on('chat', msg => addChat(msg));
  socket.on('emoji', data => showEmoji(data));
  socket.on('kicked', () => {
    Anim.toast('Kicked!', 'err');
    setTimeout(() => window.location.href = '/', 1500);
  });

  if (isSpec) document.getElementById('spec-banner').classList.remove('hidden');

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); drawCard(); }
    if (e.code === 'KeyU' && !e.repeat) { e.preventDefault(); sayUno(); }
  });
  document.getElementById('chat-in')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Timer
  timerInterval = setInterval(updateTimer, 1000);

  // Init sound
  document.addEventListener('click', () => Sound.init(), { once: true });

  if (stored) {
    try { handleState(JSON.parse(stored)); sessionStorage.removeItem('gameData'); } catch(e) {}
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  const el = document.getElementById('game-timer');
  if (el) el.textContent = `⏱ ${m}:${s}`;
}

// ==================== STATE HANDLER ====================
function handleState(data) {
  const prev = state;
  state = data;

  // Theme
  if (data.settings?.theme) {
    document.body.className = 'game-body theme-' + data.settings.theme;
  }

  // Round
  const roundEl = document.getElementById('game-round');
  if (roundEl) roundEl.textContent = `⭐ Round ${data.round || 1}`;

  // Update all seats
  updateSeats(data);

  // Update center
  updateCenter(data);

  // Update your hand
  if (!isSpec && data.you) {
    updateHand(data);
  }

  // Pending draw
  const pb = document.getElementById('pending-badge');
  const pt = document.getElementById('pending-text');
  if (data.table?.pendingDraw > 0) {
    pb.classList.remove('hidden');
    pt.textContent = '+' + data.table.pendingDraw;
  } else {
    pb.classList.add('hidden');
  }

  // Direction
  const dl = document.getElementById('dir-left');
  const dr = document.getElementById('dir-right');
  if (data.table?.direction === -1) {
    dl.classList.add('active'); dr.classList.remove('active');
  } else {
    dl.classList.remove('active'); dr.classList.add('active');
  }

  // Check end states
  checkEnd(data, prev);

  // Sounds
  playSounds(data, prev);
}

// ==================== SEATS ====================
function updateSeats(data) {
  // Clear all seats
  SEAT_ORDER.forEach(id => {
    const seat = document.getElementById(id);
    if (seat) seat.innerHTML = '';
  });

  if (!data.players) return;

  // Find my index
  const myIdx = data.players.findIndex(p => p.id === myId);
  if (myIdx === -1 && !isSpec) return;

  // Position others relative to me
  const others = data.players.filter(p => p.id !== myId);
  const maxSeats = SEAT_ORDER.length;

  others.forEach((p, i) => {
    if (i >= maxSeats) return;
    const seatId = SEAT_ORDER[i];
    const seat = document.getElementById(seatId);
    if (!seat) return;

    const isCurrent = p.isCurrent;
    const isUno = p.cardCount === 1 && !p.saidUno;
    const score = p.score || 0;

    seat.innerHTML = `
      <div class="player-badge ${isCurrent ? 'active' : ''} ${isUno ? 'uno' : ''}">
        <div class="badge-avatar" style="background:${p.avatarColor}">${p.name.charAt(0).toUpperCase()}</div>
        <div class="badge-info">
          <div class="badge-name">${p.name}</div>
          <div class="badge-score">🏆 ${score}</div>
        </div>
        <div class="badge-cards">${p.cardCount}</div>
      </div>
      <div class="opp-hand">
        ${Array(Math.min(p.cardCount, 7)).fill(0).map(() => '<div class="opp-card"></div>').join('')}
      </div>
    `;
  });
}

// ==================== CENTER ====================
function updateCenter(data) {
  const top = data.table?.topCard;
  const pile = document.getElementById('top-card');
  const count = document.getElementById('deck-count');

  if (count) count.textContent = data.table?.deckCount || 0;

  if (pile && top) {
    const color = top.chosenColor || top.color;
    const val = DISPLAY[top.value] || top.value;
    pile.className = 'top-card-real tc-' + color;
    pile.innerHTML = `<div class="tc-oval">${val}</div>`;

    // Corner marks for non-wild
    if (top.type !== 'wild') {
      pile.innerHTML = `
        <span class="card-tl">${val}</span>
        <div class="tc-oval">${val}</div>
        <span class="card-br">${val}</span>
      `;
    }
  }
}

// ==================== YOUR HAND ====================
function updateHand(data) {
  const container = document.getElementById('your-cards');
  if (!container) return;

  const isMyTurn = data.you?.isYourTurn;
  const top = data.table?.topCard;
  const pending = data.table?.pendingDraw || 0;
  const hand = data.you?.hand || [];

  container.innerHTML = '';

  hand.forEach((card, i) => {
    const el = createCard(card, isMyTurn, top, pending);
    container.appendChild(el);
  });

  // UNO button
  const unoBtn = document.getElementById('uno-btn');
  if (unoBtn) {
    if (hand.length === 2 && isMyTurn) {
      unoBtn.classList.remove('hidden');
    } else {
      unoBtn.classList.add('hidden');
    }
  }
}

function createCard(card, isMyTurn, top, pending) {
  const el = document.createElement('div');
  const color = card.color;
  const val = DISPLAY[card.value] || card.value;

  el.className = 'uno-card ' + color;
  el.dataset.cid = card.id;

  if (card.type === 'wild') {
    el.innerHTML = `
      <span class="card-tl">${val}</span>
      <div class="card-center">${val}</div>
      <span class="card-br">${val}</span>
    `;
  } else {
    el.innerHTML = `
      <span class="card-tl">${val}</span>
      <div class="card-center">${val}</div>
      <span class="card-br">${val}</span>
    `;
  }

  const valid = isMyTurn && canPlay(card, top, pending);
  if (!valid || !isMyTurn || isSpec) {
    el.classList.add('disabled');
  }

  el.addEventListener('click', () => {
    if (el.classList.contains('disabled')) {
      Anim.shake(el);
      Sound.error();
      return;
    }
    Sound.cardHover();

    if (card.type === 'wild') {
      selectedCard = card;
      document.getElementById('color-modal').classList.remove('hidden');
    } else {
      playCard(card.id);
    }
  });

  el.addEventListener('mouseenter', () => {
    if (!el.classList.contains('disabled')) Sound.cardHover();
  });

  return el;
}

function canPlay(card, top, pending) {
  if (!top) return true;
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

// ==================== ACTIONS ====================
function playCard(cid, color) {
  if (isSpec) return;
  if (!state?.you?.isYourTurn) {
    Anim.toast('Not your turn!', 'err');
    Sound.error();
    return;
  }

  Sound.cardPlay();

  // Determine special sound
  const card = state.you.hand.find(c => c.id === cid);
  if (card) {
    if (card.type === 'wild') Sound.wild();
    else if (card.value === 'skip') Sound.skip();
    else if (card.value === 'reverse') Sound.reverse();
    else if (card.value === 'draw2') Sound.draw2();
    else if (card.value === 'wild4') Sound.draw4();
    else if (['0','7'].includes(card.value)) Sound.special();
  }

  socket.emit('play', { cardId: cid, color }, res => {
    if (!res.ok) {
      Anim.toast(res.err || 'Cannot play', 'err');
      Sound.error();
    }
  });

  hideColor();
  selectedCard = null;
}

function drawCard() {
  if (isSpec) return;
  if (!state?.you?.isYourTurn) {
    Anim.toast('Not your turn!', 'err');
    Sound.error();
    return;
  }

  Sound.cardDraw();
  socket.emit('draw', res => {
    if (!res.ok) {
      Anim.toast(res.err || 'Cannot draw', 'err');
      Sound.error();
    }
  });
}

function sayUno() {
  if (isSpec) return;
  Sound.uno();
  Anim.sparkles(document.getElementById('uno-btn'));
  socket.emit('uno', res => {
    if (res.ok) Anim.toast('UNO! 🔥', 'ok');
    else { Anim.toast('Need 1 card!', 'err'); Sound.error(); }
  });
}

function pickColor(color) {
  if (selectedCard) playCard(selectedCard.id, color);
}

function hideColor() {
  document.getElementById('color-modal').classList.add('hidden');
}

// ==================== CHAT & EMOJI ====================
function toggleChat() {
  document.getElementById('chat-sidebar').classList.toggle('hidden');
  Sound.click();
}

function sendChat() {
  const input = document.getElementById('chat-in');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat', text);
  input.value = '';
  Sound.chat();
}

function addChat(msg) {
  const body = document.getElementById('chat-body');
  if (!body) return;
  const div = document.createElement('div');
  div.className = 'chat-msg ' + (msg.sender === 'SYSTEM' ? 'system' : '');
  if (msg.sender !== 'SYSTEM') {
    div.innerHTML = `<div class="who">${msg.sender}</div>${msg.text}`;
  } else {
    div.textContent = msg.text;
  }
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  if (msg.sender !== 'SYSTEM') Sound.chat();
}

function toggleEmojiBar() {
  document.getElementById('emoji-bar').classList.toggle('hidden');
  Sound.click();
}

function sendEmoji(emoji) {
  socket.emit('emoji', emoji);
  Sound.emoji();
  Anim.floatEmoji(emoji, window.innerWidth / 2, window.innerHeight - 200);
  document.getElementById('emoji-bar').classList.add('hidden');
}

function showEmoji(data) {
  Anim.floatEmoji(data.emoji, window.innerWidth / 2 + (Math.random() * 200 - 100), window.innerHeight / 2);
}

// ==================== MODALS ====================
function showInfo() {
  document.getElementById('info-modal').classList.remove('hidden');
  Sound.click();
}

function showSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
  Sound.click();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function toggleSound() {
  soundOn = Sound.toggleSound();
  const btn = document.getElementById('set-sound');
  btn.textContent = soundOn ? 'ON' : 'OFF';
  btn.classList.toggle('off', !soundOn);
}

function toggleMusic() {
  musicOn = Sound.toggleMusic();
  const btn = document.getElementById('set-music');
  btn.textContent = musicOn ? 'ON' : 'OFF';
  btn.classList.toggle('off', !musicOn);
}

function changeGameTheme() {
  const t = document.getElementById('set-theme').value;
  document.body.className = 'game-body theme-' + t;
  if (isHost) socket.emit('settings', { theme: t }, () => {});
}

function leaveGame() {
  window.location.href = '/';
}

// ==================== GAME END ====================
function checkEnd(data, prev) {
  // Round over
  if (data.state === 'roundover' && prev?.state === 'playing') {
    const winner = data.players?.find(p => p.id === data.winner);
    if (winner) {
      Sound.win();
      const modal = document.getElementById('round-modal');
      document.getElementById('round-winner').textContent = `🏆 ${winner.name} wins the round!`;

      const list = document.getElementById('round-scores');
      list.innerHTML = '';
      const sorted = [...data.players].sort((a, b) => (data.scores?.[b.id] || 0) - (data.scores?.[a.id] || 0));
      sorted.forEach(p => {
        const s = data.scores?.[p.id] || 0;
        list.innerHTML += `
          <div class="score-row">
            <div class="score-name">${p.name}</div>
            <div class="score-pts">${s} pts</div>
          </div>
        `;
      });

      document.getElementById('next-round-btn').style.display = isHost ? 'inline-block' : 'none';
      modal.classList.remove('hidden');
      Anim.confetti();
    }
  }

  // Game over
  if (data.state === 'finished' && prev?.state !== 'finished') {
    const winner = data.players?.find(p => p.id === data.winner);
    if (winner) {
      Sound.win();
      const modal = document.getElementById('over-modal');
      document.getElementById('over-winner').textContent = winner.name;

      const list = document.getElementById('over-scores');
      list.innerHTML = '';
      const sorted = [...data.players].sort((a, b) => (data.scores?.[b.id] || 0) - (data.scores?.[a.id] || 0));
      sorted.forEach((p, i) => {
        const s = data.scores?.[p.id] || 0;
        const rank = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        list.innerHTML += `
          <div class="score-row">
            <div class="score-rank ${rank}">${i + 1}</div>
            <div class="score-name">${p.name}</div>
            <div class="score-pts">${s}</div>
          </div>
        `;
      });

      modal.classList.remove('hidden');
      Anim.confetti();
    }
  }
}

function nextRound() {
  if (!isHost) return;
  socket.emit('nextRound', res => {
    if (res.ok) closeModal('round-modal');
  });
}

function playAgain() {
  if (isHost) socket.emit('nextRound', () => {});
  closeModal('over-modal');
}

function goHome() {
  window.location.href = '/';
}

// ==================== SOUNDS ====================
function playSounds(data, prev) {
  if (!prev) return;
  if (data.you?.isYourTurn && !prev.you?.isYourTurn) {
    Sound.turn();
  }
  // Opponent UNO
  const oppUno = data.players?.find(p => p.saidUno && p.id !== myId);
  const prevOpp = prev.players?.find(p => p.saidUno && p.id !== myId);
  if (oppUno && (!prevOpp || prevOpp.id !== oppUno.id)) {
    Sound.uno();
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', init);
