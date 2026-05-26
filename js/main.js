// ==================== LOBBY CLIENT ====================
let socket = null;
let roomId = null;
let myId = null;
let host = false;

function init() {
  const url = window.location.origin;
  socket = io(url, { transports: ['websocket','polling'], reconnection: true, reconnectionAttempts: 5 });

  socket.on('connect', () => {});
  socket.on('disconnect', () => Anim.toast('Disconnected', 'err'));

  socket.on('room', data => updateWaiting(data));
  socket.on('state', data => {
    sessionStorage.setItem('gameData', JSON.stringify(data));
    sessionStorage.setItem('roomId', data.roomId);
    sessionStorage.setItem('myId', myId);
    sessionStorage.setItem('host', host);
    window.location.href = '/game.html';
  });
  socket.on('kicked', () => {
    Anim.toast('You were kicked', 'err');
    setTimeout(() => window.location.href = '/', 1500);
  });

  // Clear old session
  sessionStorage.removeItem('roomId');
}

function goTo(page) { Anim.go(page); }

function createRoom() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { Anim.toast('Enter your name', 'err'); Anim.shake(document.getElementById('c-name')); return; }
  Sound.init();

  const settings = {
    maxPlayers: parseInt(document.getElementById('c-max').value),
    botCount: parseInt(document.getElementById('c-bots').value),
    theme: document.getElementById('c-theme').value,
    stackDraw2: document.getElementById('c-stack').value === 'true'
  };

  showLoad(true);
  socket.emit('create', { name, settings }, res => {
    showLoad(false);
    if (res.ok) {
      roomId = res.roomId; myId = res.playerId; host = true;
      document.getElementById('w-code').textContent = res.roomId;
      Anim.go('waiting');
      Sound.join();
      document.body.className = 'theme-' + settings.theme;
    } else {
      Anim.toast(res.err || 'Failed', 'err');
    }
  });
}

function joinRoom() {
  const name = document.getElementById('j-name').value.trim();
  const code = document.getElementById('j-code').value.trim().toUpperCase();
  const spec = document.getElementById('j-spec').checked;

  if (!name && !spec) { Anim.toast('Enter your name', 'err'); return; }
  if (!code) { Anim.toast('Enter room code', 'err'); return; }
  Sound.init();

  showLoad(true);
  socket.emit('join', { roomId: code, name: name || 'Spectator', asSpectator: spec }, res => {
    showLoad(false);
    if (res.ok) {
      roomId = res.roomId; myId = res.playerId;
      if (res.isSpectator) {
        sessionStorage.setItem('roomId', res.roomId);
        sessionStorage.setItem('myId', res.playerId);
        sessionStorage.setItem('spectator', 'true');
        window.location.href = '/game.html';
      } else {
        document.getElementById('w-code').textContent = res.roomId;
        Anim.go('waiting');
        Sound.join();
      }
    } else {
      Anim.toast(res.err || 'Failed', 'err');
    }
  });
}

function startPractice() {
  const name = document.getElementById('p-name').value.trim() || 'Player';
  const bots = parseInt(document.getElementById('p-bots').value);
  const theme = document.getElementById('p-theme').value;
  Sound.init();

  showLoad(true);
  socket.emit('create', {
    name,
    settings: { maxPlayers: bots + 1, botCount: bots, theme, stackDraw2: true }
  }, res => {
    showLoad(false);
    if (res.ok) {
      roomId = res.roomId; myId = res.playerId; host = true;
      document.getElementById('w-code').textContent = res.roomId;
      Anim.go('waiting');
      Sound.join();
      setTimeout(() => startGame(), 800);
    }
  });
}

function updateWaiting(data) {
  const list = document.getElementById('w-players');
  if (!list) return;
  list.innerHTML = '';

  data.players.forEach(p => {
    const isH = p.id === data.hostId;
    const tag = p.isBot ? '<span class="p-tag bot">BOT</span>' : isH ? '<span class="p-tag host">HOST</span>' : '';
    const div = document.createElement('div');
    div.className = 'p-item';
    div.innerHTML = `
      <div class="p-info">
        <div class="p-avatar" style="background:${p.avatarColor}">${p.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="p-name">${p.name} ${tag}</div>
        </div>
      </div>
      ${host && !p.isBot && p.id !== myId ? `<button class="btn-sec" style="padding:4px 10px;font-size:11px;" onclick="kick('${p.id}')">Kick</button>` : ''}
      ${host && p.isBot ? `<button class="btn-sec" style="padding:4px 10px;font-size:11px;" onclick="rmBot('${p.id}')">Remove</button>` : ''}
    `;
    list.appendChild(div);
  });

  document.getElementById('w-addbot').style.display = host ? 'inline-block' : 'none';
  document.getElementById('w-start').style.display = host ? 'inline-block' : 'none';
  document.getElementById('w-hostonly').style.display = host ? 'block' : 'none';
}

function copyCode() {
  const code = document.getElementById('w-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    Anim.toast('Copied!', 'ok');
    Sound.click();
  });
}

function addBot() {
  if (!host) return;
  socket.emit('addBot', res => {
    if (!res.ok) Anim.toast('Room full', 'err');
  });
}

function rmBot(id) {
  if (!host) return;
  socket.emit('removeBot', { botId: id }, () => {});
}

function kick(id) {
  if (!host) return;
  socket.emit('kick', { playerId: id }, () => {});
}

function changeTheme() {
  if (!host) return;
  const t = document.getElementById('w-themeselect').value;
  socket.emit('settings', { theme: t }, () => {});
  document.body.className = 'theme-' + t;
}

function startGame() {
  if (!host) { Anim.toast('Host only', 'err'); return; }
  showLoad(true);
  socket.emit('start', res => {
    showLoad(false);
    if (!res.ok) Anim.toast(res.err || 'Cannot start', 'err');
  });
}

function showLoad(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

document.addEventListener('DOMContentLoaded', init);
