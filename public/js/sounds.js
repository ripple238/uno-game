// ==================== SOUND ENGINE ====================
const Sound = {
  ctx: null,
  on: true,
  musicOn: false,
  musicNodes: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type='sine', vol=0.25) {
    if (!this.on || !this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },

  slide(f1, f2, dur, vol=0.25) {
    if (!this.on || !this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f1, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },

  noise(dur, vol=0.15) {
    if (!this.on || !this.ctx) return;
    const s = this.ctx.sampleRate * dur;
    const b = this.ctx.createBuffer(1, s, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < s; i++) d[i] = Math.random() * 2 - 1;
    const n = this.ctx.createBufferSource();
    n.buffer = b;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    n.connect(g); g.connect(this.ctx.destination);
    n.start();
  },

  // ===== GAME SOUNDS =====
  cardHover() {
    this.init();
    this.tone(520, 0.06, 'sine', 0.12);
    setTimeout(() => this.tone(680, 0.06, 'sine', 0.1), 40);
  },

  cardPlay() {
    this.init();
    this.slide(380, 180, 0.12, 0.22);
    setTimeout(() => this.tone(140, 0.08, 'triangle', 0.18), 100);
  },

  cardDraw() {
    this.init();
    this.noise(0.08, 0.06);
    this.slide(900, 1300, 0.12, 0.12);
  },

  special() {
    this.init();
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.12, 'sine', 0.25), i * 90);
    });
  },

  wild() {
    this.init();
    this.slide(280, 880, 0.35, 0.28);
    setTimeout(() => this.slide(880, 280, 0.25, 0.18), 380);
  },

  skip() {
    this.init();
    this.tone(800, 0.08, 'square', 0.12);
    setTimeout(() => this.tone(350, 0.15, 'sawtooth', 0.1), 90);
  },

  reverse() {
    this.init();
    this.slide(550, 280, 0.15, 0.18);
    setTimeout(() => this.slide(280, 550, 0.15, 0.18), 200);
  },

  draw2() {
    this.init();
    this.tone(280, 0.12, 'triangle', 0.22);
    setTimeout(() => this.tone(280, 0.12, 'triangle', 0.22), 160);
  },

  draw4() {
    this.init();
    [200, 200, 200, 200].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.18, 'sawtooth', 0.18), i * 200);
    });
  },

  uno() {
    this.init();
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.14, 'sine', 0.28), i * 130);
    });
  },

  win() {
    this.init();
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.28, 'sine', 0.22), i * 130);
    });
  },

  lose() {
    this.init();
    this.slide(280, 180, 0.35, 0.18);
    setTimeout(() => this.slide(180, 130, 0.4, 0.15), 400);
  },

  error() {
    this.init();
    this.tone(130, 0.25, 'sawtooth', 0.12);
  },

  turn() {
    this.init();
    this.tone(480, 0.08, 'sine', 0.14);
    setTimeout(() => this.tone(720, 0.12, 'sine', 0.14), 80);
  },

  chat() {
    this.init();
    this.tone(1100, 0.04, 'sine', 0.07);
  },

  emoji() {
    this.init();
    this.tone(880, 0.06, 'sine', 0.1);
    setTimeout(() => this.tone(1200, 0.06, 'sine', 0.1), 50);
  },

  join() {
    this.init();
    this.tone(420, 0.08, 'sine', 0.14);
    setTimeout(() => this.tone(640, 0.12, 'sine', 0.14), 90);
  },

  click() {
    this.init();
    this.tone(600, 0.04, 'sine', 0.08);
  },

  // ===== MUSIC =====
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
    return this.musicOn;
  },

  startMusic() {
    this.init();
    if (this.musicNodes) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o1.type = 'sine'; o1.frequency.setValueAtTime(220, this.ctx.currentTime);
    o2.type = 'triangle'; o2.frequency.setValueAtTime(222, this.ctx.currentTime);
    g.gain.setValueAtTime(0.025, this.ctx.currentTime);
    o1.connect(g); o2.connect(g); g.connect(this.ctx.destination);
    o1.start(); o2.start();
    this.musicNodes = [o1, o2, g];
  },

  stopMusic() {
    if (this.musicNodes) {
      this.musicNodes.forEach(n => { try { n.stop(); } catch(e) {} });
      this.musicNodes = null;
    }
  },

  toggleSound() {
    this.on = !this.on;
    if (!this.on) this.stopMusic();
    return this.on;
  }
};

// Auto-init on interaction
document.addEventListener('click', () => Sound.init(), { once: true });
document.addEventListener('touchstart', () => Sound.init(), { once: true });
