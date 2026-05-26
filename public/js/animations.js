// ==================== ANIMATION ENGINE ====================
const Animations = {

  // Create floating particles
  createParticles(containerId, count = 50) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDuration = (10 + Math.random() * 20) + 's';
      particle.style.animationDelay = (Math.random() * 15) + 's';
      particle.style.width = (2 + Math.random() * 4) + 'px';
      particle.style.height = particle.style.width;
      particle.style.opacity = 0.2 + Math.random() * 0.5;
      container.appendChild(particle);
    }
  },

  // Page transition
  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });
    const page = document.getElementById(pageId);
    if (page) {
      page.classList.add('active');
      SoundEngine.cardSelect();
    }
  },

  // Toast notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (type === 'error') {
      toast.style.borderColor = 'rgba(255, 68, 68, 0.5)';
      toast.style.background = 'rgba(255, 68, 68, 0.1)';
    } else if (type === 'success') {
      toast.style.borderColor = 'rgba(68, 204, 68, 0.5)';
      toast.style.background = 'rgba(68, 204, 68, 0.1)';
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  },

  // Shake element
  shake(element) {
    if (!element) return;
    element.classList.remove('shake');
    void element.offsetWidth; // Trigger reflow
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 400);
  },

  // Pop animation
  pop(element) {
    if (!element) return;
    element.classList.remove('pop');
    void element.offsetWidth;
    element.classList.add('pop');
    setTimeout(() => element.classList.remove('pop'), 300);
  },

  // Card play animation
  animateCardPlay(cardElement, fromRect, toRect) {
    if (!cardElement) return;

    const clone = cardElement.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = fromRect.left + 'px';
    clone.style.top = fromRect.top + 'px';
    clone.style.width = fromRect.width + 'px';
    clone.style.height = fromRect.height + 'px';
    clone.style.zIndex = '9999';
    clone.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    clone.style.pointerEvents = 'none';

    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      clone.style.left = toRect.left + 'px';
      clone.style.top = toRect.top + 'px';
      clone.style.width = toRect.width + 'px';
      clone.style.height = toRect.height + 'px';
      clone.style.transform = 'rotate(360deg)';
    });

    setTimeout(() => {
      clone.remove();
    }, 450);
  },

  // Card draw animation
  animateCardDraw(fromRect, toRect, cardData) {
    const card = document.createElement('div');
    card.className = `game-card ${cardData.color}`;
    card.style.position = 'fixed';
    card.style.left = fromRect.left + 'px';
    card.style.top = fromRect.top + 'px';
    card.style.width = fromRect.width + 'px';
    card.style.height = fromRect.height + 'px';
    card.style.zIndex = '9999';
    card.style.pointerEvents = 'none';

    document.body.appendChild(card);

    requestAnimationFrame(() => {
      card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.left = toRect.left + 'px';
      card.style.top = toRect.top + 'px';
      card.style.width = toRect.width + 'px';
      card.style.height = toRect.height + 'px';
    });

    setTimeout(() => {
      card.remove();
    }, 450);
  },

  // Floating emoji
  showFloatingEmoji(emoji, x, y) {
    const overlay = document.getElementById('emoji-overlay');
    if (!overlay) return;

    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    overlay.appendChild(el);

    setTimeout(() => el.remove(), 3000);
  },

  // Confetti effect
  confetti() {
    const colors = ['#ff4444', '#4488ff', '#44cc44', '#ffcc00', '#ff66ff'];
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.top = '-10px';
        el.style.width = (8 + Math.random() * 8) + 'px';
        el.style.height = (8 + Math.random() * 8) + 'px';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        el.style.zIndex = '9999';
        el.style.pointerEvents = 'none';
        el.style.transition = `top ${2 + Math.random() * 2}s linear, transform ${2 + Math.random() * 2}s linear`;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
          el.style.top = '110vh';
          el.style.transform = `rotate(${Math.random() * 720}deg)`;
        });

        setTimeout(() => el.remove(), 4000);
      }, i * 30);
    }
  },

  // Sparkle effect on element
  sparkle(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('div');
      spark.style.position = 'fixed';
      spark.style.left = (rect.left + rect.width / 2) + 'px';
      spark.style.top = (rect.top + rect.height / 2) + 'px';
      spark.style.width = '4px';
      spark.style.height = '4px';
      spark.style.background = '#fff';
      spark.style.borderRadius = '50%';
      spark.style.zIndex = '9999';
      spark.style.pointerEvents = 'none';
      spark.style.transition = 'all 0.6s ease-out';
      document.body.appendChild(spark);

      const angle = (Math.PI * 2 * i) / 8;
      const dist = 50 + Math.random() * 50;

      requestAnimationFrame(() => {
        spark.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
        spark.style.opacity = '0';
      });

      setTimeout(() => spark.remove(), 600);
    }
  },

  // Pulse border animation
  pulseBorder(element, color = '#44cc44') {
    if (!element) return;
    element.style.animation = 'none';
    element.style.borderColor = color;
    element.style.boxShadow = `0 0 20px ${color}40`;

    setTimeout(() => {
      element.style.borderColor = '';
      element.style.boxShadow = '';
    }, 1000);
  }
};

// Initialize particles on load
document.addEventListener('DOMContentLoaded', () => {
  Animations.createParticles('particles', 40);
  Animations.createParticles('game-particles', 30);
});
