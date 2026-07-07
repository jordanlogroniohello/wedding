// ============================================
// Magical Wedding Storybook
// ============================================

(function () {
  'use strict';

  // ---- Particle System ----
  const COLORS = ['#C9A96E', '#E8D5A3', '#F5F0E8', '#A8D5A2'];

  class Particle {
    constructor(x, y, opts = {}) {
      this.x = x;
      this.y = y;
      this.vx = opts.vx ?? (Math.random() - 0.5) * 1.5;
      this.vy = opts.vy ?? -(Math.random() * 1.5 + 0.3);
      this.size = opts.size ?? Math.random() * 2.5 + 0.8;
      this.color = opts.color ?? COLORS[Math.floor(Math.random() * COLORS.length)];
      this.alpha = 1;
      this.life = 0;
      this.maxLife = opts.maxLife ?? (80 + Math.random() * 80);
      this.gravity = opts.gravity ?? 0;
      this.twinkle = opts.twinkle ?? false;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.life++;
      const progress = this.life / this.maxLife;
      this.alpha = progress < 0.1 ? progress * 10 : 1 - ((progress - 0.1) / 0.9);
      if (this.twinkle) {
        this.alpha *= 0.55 + 0.45 * Math.sin(this.life * 0.12);
      }
      return this.life < this.maxLife;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.alpha * 0.25;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class ParticleSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.mouse = { x: -1000, y: -1000 };
      this.lastTrail = 0;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });
      this.spawnAmbient();
      this.loop();
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    spawnAmbient() {
      const count = Math.min(35, Math.floor(window.innerWidth / 30));
      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(
          Math.random() * this.canvas.width,
          Math.random() * this.canvas.height,
          {
            vx: (Math.random() - 0.5) * 0.3,
            vy: -(Math.random() * 0.4 + 0.1),
            size: Math.random() * 2 + 0.5,
            maxLife: 200 + Math.random() * 300,
            twinkle: true,
          }
        ));
      }
    }

    addTrail() {
      const now = performance.now();
      if (now - this.lastTrail < 60) return;
      this.lastTrail = now;
      this.particles.push(new Particle(
        this.mouse.x + (Math.random() - 0.5) * 8,
        this.mouse.y + (Math.random() - 0.5) * 8,
        {
          vx: (Math.random() - 0.5) * 0.6,
          vy: Math.random() * 0.5 + 0.2,
          size: Math.random() * 1.5 + 0.5,
          maxLife: 40 + Math.random() * 30,
          gravity: 0.02,
        }
      ));
    }

    burst(x, y, count = 35) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 1.5 + Math.random() * 2.5;
        this.particles.push(new Particle(x, y, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.5 + 0.8,
          maxLife: 50 + Math.random() * 40,
          gravity: 0.02,
        }));
      }
    }

    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.mouse.x > 0) this.addTrail();

      // Respawn ambient when count drops
      const ambientCount = this.particles.filter(p => p.twinkle).length;
      if (ambientCount < 15) this.spawnAmbient();

      this.particles = this.particles.filter((p) => {
        const alive = p.update();
        if (alive) p.draw(this.ctx);
        return alive;
      });

      requestAnimationFrame(() => this.loop());
    }
  }

  // ---- Sound Engine (Web Audio API) ----
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.initialized = false;
      this.toggleBtn = document.getElementById('sound-toggle');
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    init() {
      if (this.initialized) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    }

    toggle() {
      this.muted = !this.muted;
      this.toggleBtn.classList.toggle('muted', this.muted);
    }

    // Realistic paper page-turn sound (3 layers)
    playPageTurn() {
      this.init();
      if (this.muted) return;
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const now = ctx.currentTime;

      // --- Layer 1: Main paper sweep / whoosh ---
      const sweepLen = Math.floor(sr * 0.55);
      const sweepBuf = ctx.createBuffer(1, sweepLen, sr);
      const sweep = sweepBuf.getChannelData(0);
      for (let i = 0; i < sweepLen; i++) {
        const t = i / sr;
        // Bell curve envelope peaking at ~0.18s
        const env = Math.exp(-Math.pow((t - 0.18) / 0.1, 2));
        sweep[i] = (Math.random() * 2 - 1) * env;
      }
      const sweepSrc = ctx.createBufferSource();
      sweepSrc.buffer = sweepBuf;

      const sweepBP = ctx.createBiquadFilter();
      sweepBP.type = 'bandpass';
      sweepBP.Q.value = 0.5;
      // Sweep frequency upward then back down (mimics page arc)
      sweepBP.frequency.setValueAtTime(1800, now);
      sweepBP.frequency.linearRampToValueAtTime(5500, now + 0.2);
      sweepBP.frequency.linearRampToValueAtTime(2200, now + 0.5);

      const sweepGain = ctx.createGain();
      sweepGain.gain.value = 0.2;

      sweepSrc.connect(sweepBP);
      sweepBP.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      sweepSrc.start(now);

      // --- Layer 2: High-freq crinkle / texture ---
      const crinkleLen = Math.floor(sr * 0.25);
      const crinkleBuf = ctx.createBuffer(1, crinkleLen, sr);
      const crinkle = crinkleBuf.getChannelData(0);
      for (let i = 0; i < crinkleLen; i++) {
        const t = i / sr;
        const env = Math.exp(-t / 0.05) * 0.6;
        // Sparse crackle: only some samples have signal
        crinkle[i] = (Math.random() < 0.35 ? (Math.random() * 2 - 1) : 0) * env;
      }
      const crinkleSrc = ctx.createBufferSource();
      crinkleSrc.buffer = crinkleBuf;

      const crinkleHP = ctx.createBiquadFilter();
      crinkleHP.type = 'highpass';
      crinkleHP.frequency.value = 3500;

      const crinkleGain = ctx.createGain();
      crinkleGain.gain.value = 0.1;

      crinkleSrc.connect(crinkleHP);
      crinkleHP.connect(crinkleGain);
      crinkleGain.connect(ctx.destination);
      crinkleSrc.start(now + 0.04);

      // --- Layer 3: Soft low thump (page landing) ---
      const thumpLen = Math.floor(sr * 0.15);
      const thumpBuf = ctx.createBuffer(1, thumpLen, sr);
      const thump = thumpBuf.getChannelData(0);
      for (let i = 0; i < thumpLen; i++) {
        const t = i / sr;
        thump[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.025);
      }
      const thumpSrc = ctx.createBufferSource();
      thumpSrc.buffer = thumpBuf;

      const thumpLP = ctx.createBiquadFilter();
      thumpLP.type = 'lowpass';
      thumpLP.frequency.value = 600;

      const thumpGain = ctx.createGain();
      thumpGain.gain.value = 0.18;

      thumpSrc.connect(thumpLP);
      thumpLP.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thumpSrc.start(now + 0.32);
    }

    // Magical chime — ascending arpeggio
    playChime(direction = 1) {
      this.init();
      if (this.muted) return;
      const ctx = this.ctx;
      // C5, E5, G5, C6 — major arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const sequence = direction > 0 ? notes : [...notes].reverse();

      sequence.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        // Add a subtle harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        const gain = ctx.createGain();
        const startTime = ctx.currentTime + i * 0.09;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.06, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.4);

        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(0.015, startTime + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(ctx.destination);
        gain2.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 1.5);
        osc2.start(startTime);
        osc2.stop(startTime + 1);
      });
    }

    // Soft shimmer — for ambient sparkle moments
    playShimmer() {
      this.init();
      if (this.muted) return;
      const ctx = this.ctx;
      const freq = 1200 + Math.random() * 1800;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  }

  // ---- Book Controller ----
  class MagicalBook {
    constructor(bookEl, particleSystem, soundEngine) {
      this.book = bookEl;
      this.ps = particleSystem;
      this.sound = soundEngine;
      this.pages = [...bookEl.querySelectorAll('.page')];
      this.total = this.pages.length;
      this.current = 0;
      this.animating = false;

      this.prevBtn = document.getElementById('prev-btn');
      this.nextBtn = document.getElementById('next-btn');
      this.indicator = document.getElementById('page-indicator');

      this.init();
    }

    init() {
      // Set initial z-index stacking
      this.pages.forEach((page, i) => {
        page.style.zIndex = this.total - i;
      });

      // Mark first page as active
      this.pages[0].classList.add('active');

      // Click on book
      this.book.addEventListener('click', (e) => {
        const rect = this.book.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width * 0.35) this.next();
        else this.prev();
      });

      // Navigation buttons
      this.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
      this.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.next();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.prev();
      });

      // Touch swipe
      let touchX = 0;
      this.book.addEventListener('touchstart', (e) => {
        touchX = e.touches[0].clientX;
      }, { passive: true });
      this.book.addEventListener('touchend', (e) => {
        const diff = touchX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) this.next();
          else this.prev();
        }
      });

      // RSVP toggle buttons
      document.querySelectorAll('.rsvp-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.rsvp-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Prevent form inputs from triggering page turn
      document.querySelectorAll('.rsvp-input, .rsvp-submit').forEach((el) => {
        el.addEventListener('click', (e) => e.stopPropagation());
      });

      this.updateUI();
    }

    next() {
      if (this.animating || this.current >= this.total - 1) return;
      this.animating = true;

      const page = this.pages[this.current];
      page.classList.remove('active');
      page.classList.add('flipped');

      // Sound effects
      this.sound.playPageTurn();
      this.sound.playChime(1);

      // Particle burst from the spine
      const rect = this.book.getBoundingClientRect();
      this.ps.burst(rect.left, rect.top + rect.height / 2, 30);

      this.current++;
      this.updateUI();

      // After animation, lower flipped page z-index and activate new page
      const onEnd = () => {
        page.style.zIndex = 0;
        this.pages[this.current].classList.add('active');
        this.animating = false;
        page.removeEventListener('transitionend', onEnd);
      };
      page.addEventListener('transitionend', onEnd);
    }

    prev() {
      if (this.animating || this.current <= 0) return;
      this.animating = true;

      this.pages[this.current].classList.remove('active');
      this.current--;

      const page = this.pages[this.current];
      page.style.zIndex = this.total - this.current;
      page.classList.remove('flipped');

      // Sound effects
      this.sound.playPageTurn();
      this.sound.playChime(-1);

      // Particle burst
      const rect = this.book.getBoundingClientRect();
      this.ps.burst(rect.left, rect.top + rect.height / 2, 25);

      this.updateUI();

      const onEnd = () => {
        page.classList.add('active');
        this.animating = false;
        page.removeEventListener('transitionend', onEnd);
      };
      page.addEventListener('transitionend', onEnd);
    }

    updateUI() {
      this.indicator.textContent = `${this.current + 1} / ${this.total}`;
      this.prevBtn.disabled = this.current === 0;
      this.nextBtn.disabled = this.current === this.total - 1;
    }
  }

  // ---- Init ----
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('particle-canvas');
    const ps = new ParticleSystem(canvas);
    const sound = new SoundEngine();
    const bookEl = document.getElementById('book');
    new MagicalBook(bookEl, ps, sound);
  });
})();
