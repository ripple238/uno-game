// ==================== SOUND ENGINE ====================
const SoundEngine = {
  ctx: null,
  enabled: true,
  musicEnabled: false,
  musicOsc: null,
  musicGain: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  playSlide(startFreq, endFreq, duration, volume = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  playNoise(duration, volume = 0.2) {
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
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  },

  // ==================== GAME SOUNDS ====================

  cardSelect() {
    this.init();
    this.playTone(600, 0.08, 'sine', 0.15);
    setTimeout(() => this.playTone(800, 0.08, 'sine', 0.15), 50);
  },

  cardPlay() {
    this.init();
    // Satisfying "whoosh" + "thwack"
    this.playSlide(400, 200, 0.15, 0.25);
    setTimeout(() => this.playTone(150, 0.1, 'triangle', 0.2), 120);
  },

  cardDraw() {
    this.init();
    // Paper slide sound
    this.playNoise(0.1, 0.08);
    this.playSlide(800, 1200, 0.15, 0.15);
  },

  specialCard() {
    this.init();
    // Dramatic special card sound
    this.playTone(440, 0.1, 'sine', 0.3);
    setTimeout(() => this.playTone(554, 0.1, 'sine', 0.3), 100);
    setTimeout(() => this.playTone(659, 0.2, 'sine', 0.3), 200);
    setTimeout(() => this.playTone(880, 0.3, 'triangle', 0.25), 350);
  },

  wildCard() {
    this.init();
    // Magical wild sound
    this.playSlide(300, 900, 0.4, 0.3);
    setTimeout(() => this.playSlide(900, 300, 0.3, 0.2), 400);
  },

  skip() {
    this.init();
    this.playTone(800, 0.1, 'square', 0.15);
    setTimeout(() => this.playTone(400, 0.2, 'sawtooth', 0.1), 100);
  },

  reverse() {
    this.init();
    this.playSlide(600, 300, 0.2, 0.2);
    setTimeout(() => this.playSlide(300, 600, 0.2, 0.2), 250);
  },

  drawTwo() {
    this.init();
    this.playTone(300, 0.15, 'triangle', 0.25);
    setTimeout(() => this.playTone(300, 0.15, 'triangle', 0.25), 180);
  },

  drawFour() {
    this.init();
    this.playTone(200, 0.2, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.2), 220);
    setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.2), 440);
    setTimeout(() => this.playTone(200, 0.3, 'sawtooth', 0.2), 660);
  },

  uno() {
    this.init();
    // Exciting UNO sound
    this.playTone(523, 0.15, 'sine', 0.3);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.3), 150);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.3), 300);
    setTimeout(() => this.playTone(1047, 0.4, 'triangle', 0.25), 450);
  },

  win() {
    this.init();
    // Victory fanfare
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.25), i * 150);
    });
  },

  lose() {
    this.init();
    // Sad trombone-ish
    this.playSlide(300, 200, 0.4, 0.2);
    setTimeout(() => this.playSlide(200, 150, 0.4, 0.2), 450);
  },

  error() {
    this.init();
    this.playTone(150, 0.3, 'sawtooth', 0.15);
  },

  turnStart() {
    this.init();
    this.playTone(500, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(700, 0.15, 'sine', 0.15), 100);
  },

  chat() {
    this.init();
    this.playTone(1200, 0.05, 'sine', 0.08);
  },

  emoji() {
    this.init();
    this.playTone(900, 0.08, 'sine', 0.12);
    setTimeout(() => this.playTone(1200, 0.08, 'sine', 0.12), 60);
  },

  join() {
    this.init();
    this.playTone(440, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(660, 0.15, 'sine', 0.15), 100);
  },

  leave() {
    this.init();
    this.playTone(660, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(440, 0.15, 'sine', 0.15), 100);
  },

  // ==================== MUSIC ====================

  toggleMusic() {
    if (this.musicEnabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    this.musicEnabled = !this.musicEnabled;
    return this.musicEnabled;
  },

  startMusic() {
    this.init();
    if (this.musicOsc) return;

    // Ambient background drone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(222, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();

    this.musicOsc = [osc1, osc2];
    this.musicGain = gain;
  },

  stopMusic() {
    if (this.musicOsc) {
      this.musicOsc.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      this.musicOsc = null;
    }
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.musicGain = null;
    }
  },

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
};

// Auto-init on first user interaction
document.addEventListener('click', () => SoundEngine.init(), { once: true });
document.addEventListener('touchstart', () => SoundEngine.init(), { once: true });
