// ==================== ANIMATIONS ====================
const Anim = {
  stars(containerId, count=60) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 3) + 's';
      s.style.animationDuration = (2 + Math.random() * 3) + 's';
      s.style.width = (2 + Math.random() * 3) + 'px';
      s.style.height = s.style.width;
      s.style.opacity = 0.3 + Math.random() * 0.7;
      c.appendChild(s);
    }
  },

  go(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + pageId);
    if (el) el.classList.add('active');
    Sound.click();
  },

  toast(msg, type='info') {
    const c = document.getElementById('toasts');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : type === 'ok' ? 'ok' : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  },

  confetti() {
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6', '#E67E22'];
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const e = document.createElement('div');
        e.style.cssText = `
          position:fixed; left:${Math.random()*100}vw; top:-10px;
          width:${6+Math.random()*8}px; height:${6+Math.random()*8}px;
          background:${colors[Math.floor(Math.random()*colors.length)]};
          border-radius:${Math.random()>0.5?'50%':'0'};
          z-index:9999; pointer-events:none;
          transition:top ${2+Math.random()*2}s linear, transform ${2+Math.random()*2}s linear;
        `;
        document.body.appendChild(e);
        requestAnimationFrame(() => {
          e.style.top = '110vh';
          e.style.transform = `rotate(${Math.random()*720}deg)`;
        });
        setTimeout(() => e.remove(), 4500);
      }, i * 25);
    }
  },

  floatEmoji(emoji, x, y) {
    const layer = document.getElementById('float-emojis');
    if (!layer) return;
    const e = document.createElement('div');
    e.className = 'float-emoji';
    e.textContent = emoji;
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    layer.appendChild(e);
    setTimeout(() => e.remove(), 2600);
  },

  sparkles(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.style.cssText = `
        position:fixed; width:4px; height:4px; background:#fff;
        border-radius:50%; z-index:9999; pointer-events:none;
        left:${r.left+r.width/2}px; top:${r.top+r.height/2}px;
        transition:all 0.5s ease-out;
      `;
      document.body.appendChild(s);
      const a = (Math.PI*2*i)/10;
      const d = 40 + Math.random()*40;
      requestAnimationFrame(() => {
        s.style.transform = `translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(0)`;
        s.style.opacity = '0';
      });
      setTimeout(() => s.remove(), 550);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Anim.stars('stars', 50);
});
