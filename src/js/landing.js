// ============================================================
// CAIM — Landing Page JS (S21)
// Interações leves: menu mobile, typewriter, reveal no scroll,
// partículas, easter egg CRT. Sem dependências.
// ============================================================

// ---------- Menu mobile ----------
const burger = document.getElementById('lp-burger');
const nav = document.getElementById('lp-nav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('lp-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', () => {
    nav.classList.remove('lp-open');
    burger.setAttribute('aria-expanded', 'false');
  });
}

// ---------- Typewriter no terminal ----------
const typeEl = document.getElementById('lp-type');
if (typeEl) {
  const phrases = [
    'crie uma landing p/ padaria',
    'refatore o endpoint /login',
    'monte um dashboard em React',
    'teste o deploy do meu MVP',
    'o que mudou neste repo?',
  ];
  let pi = 0;
  let ci = 0;
  let deleting = false;

  function tick() {
    const word = phrases[pi];
    if (!deleting) {
      ci += 1;
      typeEl.textContent = word.slice(0, ci);
      if (ci === word.length) {
        deleting = true;
        setTimeout(tick, 1600);
        return;
      }
      setTimeout(tick, 55);
    } else {
      ci -= 1;
      typeEl.textContent = word.slice(0, ci);
      if (ci === 0) {
        deleting = false;
        pi = (pi + 1) % phrases.length;
      }
      setTimeout(tick, 28);
    }
  }
  setTimeout(tick, 900);
}

// ---------- Reveal no scroll ----------
const revealEls = document.querySelectorAll('.lp-reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('lp-in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('lp-in'));
}

// ---------- Partículas no hero ----------
function makeParticles() {
  const wrap = document.getElementById('lp-particles');
  if (!wrap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#fde047', '#ec4899', '#2dd4bf', '#c084fc', '#4ade80'];
  const spawn = () => {
    const p = document.createElement('span');
    const size = 4 + Math.floor(Math.random() * 4);
    p.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      image-rendering: pixelated;
      left: ${50 + (Math.random() * 60 - 30)}%;
      top: ${30 + Math.random() * 40}%;
      pointer-events: none;
    `;
    const dx = (Math.random() * 60 - 30);
    const dy = -(20 + Math.random() * 40);
    p.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 180 - 90}deg)`, opacity: 0 },
      ],
      { duration: 1200 + Math.random() * 800, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' }
    ).onfinish = () => p.remove();
    wrap.appendChild(p);
  };
  setInterval(spawn, 900);
}
makeParticles();

// ---------- Easter egg: modo CRT ----------
const crtBtn = document.getElementById('lp-crt');
if (crtBtn) {
  crtBtn.addEventListener('click', () => {
    document.body.classList.toggle('crt');
    crtBtn.textContent = document.body.classList.contains('crt')
      ? '🕹️ Desativar modo CRT'
      : '🕹️ Ativar modo CRT';
  });
}

// ---------- Easter egg: Konami code ----------
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIdx = 0;
window.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === konami[konamiIdx]) {
    konamiIdx += 1;
    if (konamiIdx === konami.length) {
      konamiIdx = 0;
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2000;
        background: rgba(0,0,0,0.92); color: #4ade80;
        font-family: 'Press Start 2P', monospace; font-size: 16px;
        display: flex; align-items: center; justify-content: center; text-align: center;
        animation: lp-blink 0.5s steps(2) infinite;
      `;
      overlay.textContent = '🎮 POWER-UP! +100 XP\nOG Gamer desbloqueado';
      overlay.style.whiteSpace = 'pre-line';
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 2000);
    }
  } else {
    konamiIdx = key === 'ArrowUp' ? 1 : 0;
  }
});
