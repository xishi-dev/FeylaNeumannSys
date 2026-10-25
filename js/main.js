(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const html = document.documentElement;
  html.classList.add('js');
  gsap.registerPlugin(ScrollTrigger, Draggable);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  /* ---------- Thai-safe text tools ---------- */
  const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const graphemes = t => seg ? [...seg.segment(t)].map(s => s.segment) : Array.from(t);
  const GLYPHS = '01アイウエオ#$%&*<>/\\▒░▓¦'.split('');

  // reveal `text` in el by resolving random glyphs left to right
  function scramble(el, text = el.dataset.text || el.textContent, duration = 0.9) {
    el.dataset.text = text;
    const g = graphemes(text);
    if (reduce) { el.textContent = text; return Promise.resolve(); }
    return new Promise(res => {
      const o = { p: 0 };
      gsap.to(o, {
        p: 1, duration, ease: 'none', overwrite: true,
        onUpdate: () => {
          const n = Math.floor(o.p * g.length);
          el.innerHTML = g.map((c, i) => i < n || c === ' ' ? c : `<span class="x">${pick(GLYPHS)}</span>`).join('');
        },
        onComplete: () => { el.textContent = text; res(); },
      });
    });
  }

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const unlock = () => {
    document.body.classList.remove('is-locked');
    window.scrollTo(0, 0);
    if (lenis) { lenis.start(); lenis.scrollTo(0, { immediate: true, force: true }); }
    ScrollTrigger.refresh();
  };

  /* ---------- HD image system (same idea as the ORV site) ---------- */
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function loadHD(img) {
    if (img.dataset.hdDone) return;
    img.dataset.hdDone = '1';
    const r = img.getBoundingClientRect();
    const size = Math.max(r.width, innerWidth * 0.6) * dpr > 1500 ? 3840 : 1920;
    const pre = new Image();
    pre.src = `${img.dataset.hd}-${size}.webp`;
    pre.decode().then(() => { img.src = pre.src; img.classList.add('hd-in'); }).catch(() => {});
  }
  $$('img[data-hd]').forEach(loadHD);

  /* ---------- rose petals (global canvas) ---------- */
  const Petals = (() => {
    const c = $('#petals');
    const ctx = c.getContext('2d');
    let w, h, d;
    const list = [];
    const mouse = { x: -999, y: -999 };
    const COLORS = [['#7A0F22', '#E3263F'], ['#9C1430', '#FF4D6A'], ['#5E0A1A', '#C81E3A']];
    function make(x, y, burst) {
      const [dark, light] = pick(COLORS);
      const s = rand(7, 15) * d;
      return {
        x, y, s, dark, light, burst,
        vx: burst ? rand(-5, 5) * d : rand(-0.3, 0.3) * d,
        vy: burst ? rand(-7, -1.5) * d : rand(0.35, 1.1) * d,
        r: rand(0, 6.28), vr: rand(-0.04, 0.04),
        f: rand(0, 6.28), vf: rand(0.03, 0.08),
        a: burst ? 1 : rand(0.55, 0.9),
      };
    }
    function resize() {
      d = Math.min(devicePixelRatio || 1, 1.5);
      w = c.width = Math.floor(innerWidth * d);
      h = c.height = Math.floor(innerHeight * d);
    }
    resize();
    addEventListener('resize', resize);
    const ambient = reduce ? 0 : (innerWidth < 700 ? 12 : 24);
    for (let i = 0; i < ambient; i++) list.push(make(Math.random() * w, Math.random() * h, false));
    // petals only dodge a moving cursor; a resting one would trap them in a ring
    addEventListener('pointermove', e => { mouse.x = e.clientX * d; mouse.y = e.clientY * d; mouse.t = performance.now(); });

    function petal(p) {
      const s = p.s, k = Math.cos(p.f);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(k, 1);
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, p.light); g.addColorStop(1, p.dark);
      ctx.fillStyle = g;
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(s * 0.95, s * 0.35, s * 0.8, -s * 0.9, s * 0.18, -s * 0.85);
      ctx.quadraticCurveTo(0, -s * 0.6, -s * 0.18, -s * 0.85);
      ctx.bezierCurveTo(-s * 0.8, -s * 0.9, -s * 0.95, s * 0.35, 0, s);
      ctx.fill();
      ctx.restore();
    }
    if (!reduce) gsap.ticker.add(() => {
      ctx.clearRect(0, 0, w, h);
      const moving = performance.now() - (mouse.t || 0) < 200;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.burst) { p.vy += 0.12 * d; p.vx *= 0.985; p.vy = Math.min(p.vy, 2.4 * d); }
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dist = Math.hypot(dx, dy);
        if (moving && dist < 110 * d && dist > 0) { p.vx += (dx / dist) * 0.35; p.vy += (dy / dist) * 0.2; }
        if (!p.burst) { p.vx *= 0.97; p.vx += Math.sin(p.f * 0.5) * 0.02 * d; p.vy = Math.max(p.vy * 0.99, 0.35 * d); }
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.f += p.vf;
        if (p.y > h + 30 || p.x < -60 || p.x > w + 60) {
          if (p.burst) { list.splice(i, 1); continue; }
          Object.assign(p, make(Math.random() * w, -20, false));
        }
        petal(p);
      }
    });
    return {
      burst(x, y, n = 26) {
        if (reduce) return;
        for (let i = 0; i < n; i++) list.push(make(x * d, y * d, true));
        Sound.petals();
      },
      burstFrom(el, n) { const r = el.getBoundingClientRect(); this.burst(r.left + r.width / 2, r.top + r.height / 2, n); },
    };
  })();

  /* ---------- Neumann's AI copy (chat bubbles) ---------- */
  const chatBox = $('#chat');
  function say(text, kind = '') {
    const b = document.createElement('div');
    b.className = 'bubble' + (kind ? ' bubble--' + kind : '');
    b.innerHTML = `<img src="assets/img/neumann-face.webp" alt=""><p style="margin:0"><span class="bubble__who">neumann.ai #07</span>${text}</p>`;
    chatBox.append(b);
    while (chatBox.children.length > 3) chatBox.firstElementChild.remove();
    Sound.chat();
    gsap.fromTo(b, { y: 20, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: reduce ? 0 : 0.45, ease: 'back.out(2)' });
    gsap.to(b, { autoAlpha: 0, x: 30, delay: 5.2, duration: 0.4, ease: 'power2.in', onComplete: () => b.remove() });
  }
  const sayOnce = (() => { const said = new Set(); return (key, text, kind) => { if (said.has(key)) return; said.add(key); say(text, kind); }; })();

  /* ---------- soundtrack ---------- */
  const song = new Audio('assets/audio/muse.mp3');
  song.loop = true;
  song.preload = 'auto';
  Sound.useSong(song);
  let songAnnounced = false, opened = false;
  document.addEventListener('visibilitychange', () => document.hidden ? Sound.pauseSong() : Sound.resumeSong());
  const announceSong = () => {
    if (songAnnounced) return;
    songAnnounced = true;
    say('กำลังเล่น <b>Muse</b> โดย Isabel LaRosa');
  };

  /* ---------- sound toggle ---------- */
  const soundBtn = $('#soundBtn');
  function setSound(state) {
    state ? Sound.enable() : Sound.disable();
    soundBtn.setAttribute('aria-pressed', String(state));
    $('span', soundBtn).textContent = state ? 'เสียงเปิด' : 'เสียงปิด';
    if (state && opened && !songAnnounced) announceSong();
  }
  soundBtn.addEventListener('click', () => setSound(!Sound.on));

  /* ---------- volume ---------- */
  const volRange = $('#volRange');
  function setVolume(pct, fromUser) {
    pct = Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
    volRange.value = pct;
    volRange.style.setProperty('--pct', pct + '%');
    $('#volVal').textContent = pct;
    Sound.setVolume(pct / 100);
    store.set('feyla.volume', pct);
    // raising the volume while muted turns sound on
    if (fromUser && pct > 0 && !Sound.on && opened) setSound(true);
    if (fromUser) Sound.ok();
  }
  setVolume(store.get('feyla.volume', 80), false);
  volRange.addEventListener('input', () => setVolume(+volRange.value, true));
  $('#volDown').addEventListener('click', () => setVolume(+volRange.value - 10, true));
  $('#volUp').addEventListener('click', () => setVolume(+volRange.value + 10, true));

  /* ---------- crosshair cursor ---------- */
  if (finePointer && !reduce) {
    html.classList.add('has-cursor');
    const cur = $('.cursor'), parts = $$('.cursor__x, .cursor__y'), bit = $('.cursor__bit');
    addEventListener('pointermove', e => gsap.set([...parts, bit], { x: e.clientX, y: e.clientY }));
    document.addEventListener('pointerover', e => cur.classList.toggle('is-hot', !!e.target.closest('a, button, .win__bar')));
    setInterval(() => (bit.textContent = bit.textContent === '0' ? '1' : '0'), 420);
  }

  /* ---------- accent theme from the favourite colours ---------- */
  function setAccent(color, name, announce) {
    html.style.setProperty('--accent', color);
    $$('.swatch').forEach(s => s.classList.toggle('is-on', s.dataset.accent === color));
    store.set('feyla.accent', { color, name });
    if (announce) say(`เปลี่ยนธีมทั้งระบบเป็น<b>สี${name}</b>แล้ว`);
  }
  const savedAccent = store.get('feyla.accent', null);
  if (savedAccent) setAccent(savedAccent.color, savedAccent.name, false);
  else $('.swatch').classList.add('is-on');

  /* ============================================================
     BOOT
     ============================================================ */
  const term = $('#term');
  let skipped = false, shaken = false;

  const BOOT = [
    ['FOREST OF THE GREATS // secure terminal v7.0', 't-rim', 0],
    ['> ssh guest@forest.greats', 't-cmd', 1],
    ['  authenticating ................ [ OK ]', 't-ok', 0],
    ['  rose-key verified .............. [ OK ]', 't-ok', 0],
    ['> run neumann.ai --copy 07', 't-cmd', 1],
    ['  eyes: 0 1  status: calm  wheelchair: online', '', 0],
    ['> decrypt /forest/feyla/', 't-cmd', 1],
  ];

  async function typeInto(el, text, cmd) {
    for (const ch of graphemes(text)) {
      if (skipped) { el.textContent = text; return; }
      el.textContent += ch;
      if (cmd && ch.trim()) Sound.key();
      await wait(cmd ? rand(28, 70) : 6);
    }
  }

  async function runBoot() {
    if (reduce) { showHandshake(); return; }
    await wait(500);
    for (const [text, cls, cmd] of BOOT) {
      if (skipped) return;
      const line = document.createElement('div');
      line.className = cls;
      term.append(line);
      await typeInto(line, text, cmd);
      await wait(cmd ? 260 : 120);
    }
    // progress bar
    const bar = document.createElement('div');
    bar.className = 't-hot';
    term.append(bar);
    for (let p = 0; p <= 100; p += 4) {
      if (skipped) return;
      const n = Math.round(p / 4);
      bar.textContent = `  [${'█'.repeat(n)}${'░'.repeat(25 - n)}] ${p}%`;
      await wait(40);
    }
    await wait(300);
    if (!skipped) showHandshake();
  }

  function showHandshake() {
    if (shaken) return;
    shaken = true;
    gsap.to(term, { autoAlpha: reduce ? 0 : 0.18, duration: 0.5 });
    gsap.to('#skip', { autoAlpha: 0, duration: 0.3 });
    const hs = $('#handshake');
    gsap.timeline()
      .set(hs, { visibility: 'visible' })
      .add(() => Sound.open())
      .fromTo(hs, { clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(49% 0% 49% 0%)', duration: reduce ? 0 : 0.25, ease: 'power3.out' })
      .to(hs, { clipPath: 'inset(-10% -10% -10% -10%)', duration: reduce ? 0 : 0.4, ease: 'power3.inOut' })
      .from('.handshake__face img', { scale: 1.4, filter: 'blur(8px)', duration: 0.8, ease: 'expo.out' }, '<')
      .add(() => $('#openSound').focus({ preventScroll: true }));
  }
  $('#skip').addEventListener('click', () => { skipped = true; showHandshake(); });

  async function openFile(withSound) {
    $$('#handshake button').forEach(b => (b.disabled = true));
    // the song starts muffled behind the terminal and opens up with the hero
    Sound.muffle(true, 0);
    if (withSound) setSound(true);
    Sound.boom();
    const hs = $('#handshake');
    await new Promise(res => {
      if (reduce) { gsap.set('#boot', { display: 'none' }); res(); return; }
      gsap.timeline({ onComplete: res })
        .add(() => Sound.glitch())
        .to(hs, { x: -8, duration: 0.05, repeat: 5, yoyo: true })
        .add(() => Petals.burst(innerWidth / 2, innerHeight / 2, 70))
        .to(hs, { clipPath: 'inset(49% 0% 49% 0%)', duration: 0.25, ease: 'power3.in' })
        .to(hs, { clipPath: 'inset(49% 50% 49% 50%)', duration: 0.18, ease: 'power3.in' })
        .to('#boot', { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' })
        .set('#boot', { display: 'none' });
    });
    startStory();
  }
  $('#openSound').addEventListener('click', () => openFile(true));
  $('#openSilent').addEventListener('click', () => openFile(false));

  /* ============================================================
     HERO
     ============================================================ */
  const wall = $('#wall');
  const mons = [];
  (function buildWall() {
    const count = innerWidth < 700 ? 12 : 26;
    const horns = '<svg viewBox="0 0 64 48"><use href="#horns"/></svg>';
    for (let i = 0; i < count; i++) {
      const m = document.createElement('div');
      m.className = 'mon';
      const wv = rand(7, 17);
      m.style.cssText = `left:${rand(-2, 96)}%;top:${rand(-2, 92)}%;width:${wv}vw;height:${wv * rand(0.6, 0.85)}vw;`;
      const content = pick(['', '', '0', '1', '10', '01', horns]);
      if (content) m.innerHTML = `<span class="mon__bit">${content}</span>`;
      m.dataset.z = rand(-700, 150);
      m.dataset.rx = rand(-14, 14); m.dataset.ry = rand(-30, 30); m.dataset.rz = rand(-12, 12);
      gsap.set(m, { z: +m.dataset.z, rotationX: +m.dataset.rx, rotationY: +m.dataset.ry, rotation: +m.dataset.rz });
      wall.append(m);
      mons.push(m);
    }
  })();

  // a few screens flicker now and then
  if (!reduce) (function flicker() {
    gsap.delayedCall(rand(0.6, 2.2), () => {
      const m = pick(mons);
      gsap.timeline({ onComplete: flicker }).to(m, { opacity: 0.2, duration: 0.05 }).to(m, { opacity: 1, duration: 0.05 }).to(m, { opacity: 0.4, duration: 0.04 }).to(m, { opacity: 1, duration: 0.2 });
    });
  })();

  // mouse parallax on the wall and the main monitor
  if (finePointer && !reduce) {
    const ry = gsap.quickTo(wall, 'rotationY', { duration: 1.2, ease: 'power3' });
    const rx = gsap.quickTo(wall, 'rotationX', { duration: 1.2, ease: 'power3' });
    const mx = gsap.quickTo('#heroMonitor', 'rotationY', { duration: 1, ease: 'power3' });
    const my = gsap.quickTo('#heroMonitor', 'rotationX', { duration: 1, ease: 'power3' });
    addEventListener('pointermove', e => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      ry(nx * 10); rx(-ny * 6);
      mx(-10 + nx * 8); my(4 - ny * 6);
    });
  }

  // ticker
  (function ticker() {
    const items = ['♡ เปิดแฟ้มของเฟย์ล่าแล้ว', 'ROSE-KEY VERIFIED', 'FOREST OF THE GREATS', 'NEUMANN.AI COPY #07 ONLINE', '♠ ระวังจะติดใจ', 'EYES: 0 1'];
    const track = $('.hero__tickerTrack');
    track.innerHTML = [...items, ...items, ...items, ...items].map(t => `<span>${t}</span>`).join('');
  })();

  /* ---------- the eye on the hero monitor ----------
     The client's clip of the opening, cut into a seamless loop (assets/video).
     It plays only while on screen, a little slower for weight, and glitches now and then. */
  (function eyeScreen() {
    const screen = $('#eye');
    const vid = $('#eyeVid');
    let visible = true;
    vid.playbackRate = 0.85;
    vid.addEventListener('loadedmetadata', () => (vid.playbackRate = 0.85));
    if (reduce) { vid.removeAttribute('autoplay'); vid.pause(); return; }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? vid.play().catch(() => {}) : vid.pause();
    }).observe(screen);

    (function glitch() {
      gsap.delayedCall(rand(3.5, 6.5), () => {
        if (visible) {
          screen.classList.remove('is-glitch'); void screen.offsetWidth; screen.classList.add('is-glitch');
          gsap.fromTo($('.eye__flash', screen), { opacity: 0.55 }, { opacity: 0, duration: 0.5, ease: 'power2.out' });
        }
        glitch();
      });
    })();
  })();

  // nicknames cycle
  const ALIASES = ['ไป๋ลั่ว', 'ลั่วซาน', 'ปัง', 'หรงหรง'];
  let aliasI = 0;
  function cycleAlias() {
    aliasI = (aliasI + 1) % ALIASES.length;
    scramble($('#alias'), ALIASES[aliasI], 0.7);
  }

  function glitchName() {
    const n = $('.hero__name');
    n.classList.remove('is-glitch'); void n.offsetWidth; n.classList.add('is-glitch');
    gsap.delayedCall(rand(4, 8), glitchName);
  }

  function startStory() {
    opened = true;
    unlock();
    watchWindows();
    Sound.muffle(false, 2.5);
    if (Sound.on) gsap.delayedCall(3.6, announceSong);
    gsap.to(['#hud', '.dl'], { autoAlpha: 1, duration: 0.8, delay: 0.4 });
    if (reduce) { gsap.set('.win', { visibility: 'visible' }); }
    const tl = gsap.timeline();
    if (!reduce) {
      tl.from(mons, { z: -2600, autoAlpha: 0, duration: 1.6, stagger: { each: 0.035, from: 'random' }, ease: 'expo.out' }, 0)
        .from('#heroMonitor', { z: -900, rotationY: -60, autoAlpha: 0, duration: 1.6, ease: 'expo.out' }, 0.3)
        .from('.hero__kicker', { autoAlpha: 0, x: -20, duration: 0.6 }, 0.6)
        .from('.hero__name', { autoAlpha: 0, y: 60, skewX: -12, duration: 1.1, ease: 'expo.out' }, 0.7)
        .add(() => $('.hero__name').classList.add('is-glitch'), 1.3)
        .from(['.hero__thai', '.hero__line', '.hero__cta'], { autoAlpha: 0, y: 18, stagger: 0.12, duration: 0.7 }, 1.1)
        .from('.hero__ticker', { yPercent: 100, duration: 0.6, ease: 'power3.out' }, 1.4);
      gsap.delayedCall(5, glitchName);
    }
    tl.add(() => say('ยินดีต้อนรับสู่แฟ้มของ<b>เฟย์ล่า</b> ไฟล์นี้จัดเป็นความลับระดับ S... ล้อเล่น เปิดดูได้ตามสบาย'), reduce ? 0 : 2);
    setInterval(cycleAlias, 2800);
    startIdle();
  }

  /* ============================================================
     WINDOWS
     ============================================================ */
  function openWin(win) {
    const tl = gsap.timeline();
    if (reduce) { gsap.set(win, { visibility: 'visible' }); return tl; }
    tl.set(win, { visibility: 'visible', clipPath: 'inset(50% 50% 50% 50%)' })
      .add(() => Sound.open())
      .to(win, { clipPath: 'inset(49% -2% 49% -2%)', duration: 0.25, ease: 'power3.out' })
      .to(win, { clipPath: 'inset(-4% -4% -4% -4%)', duration: 0.4, ease: 'power3.inOut' })
      .to(win, { opacity: 0.4, duration: 0.04, repeat: 3, yoyo: true })
      .set(win, { opacity: 1, clearProps: 'clipPath' })
      .from($$('.win__body > *', win), { autoAlpha: 0, y: 14, stagger: 0.06, duration: 0.4, ease: 'power2.out' }, '-=0.2');
    return tl;
  }

  const onOpen = {
    profile: initProfile,
    firewall: initFirewall,
    food: initFood,
    personality: initPersonality,
    status: () => sayOnce('status', 'ไฟล์นี้ถูกล็อกด้วยสิทธิ์สูงสุด แม้แต่ฉันก็เปิดไม่ได้'),
    ports: () => sayOnce('ports', 'พอร์ตทั้งสามเปิดอยู่ เลือกช่องทางที่สะดวกได้เลย'),
  };

  // created only once the file is opened, so nothing fires behind the boot screen
  function watchWindows() {
    $$('.file').forEach(sec => {
      const win = $('.win', sec);
      ScrollTrigger.create({
        trigger: sec, start: 'top 72%', once: true,
        onEnter: () => openWin(win).add(() => onOpen[sec.id] && onOpen[sec.id]()),
      });
    });
    ScrollTrigger.create({
      trigger: '#end', start: 'top 60%', once: true,
      onEnter: () => {
        if (!reduce) {
          gsap.from('.end__face', { scale: 0.4, rotation: -8, autoAlpha: 0, filter: 'blur(10px)', duration: 1.2, ease: 'back.out(2)' });
          gsap.from('.end__line', { autoAlpha: 0, y: 40, skewX: -12, duration: 1, delay: 0.4, ease: 'expo.out', onComplete: () => {
            Sound.glitch();
            const line = $('.end__line');
            (function again() { line.classList.remove('is-glitch'); void line.offsetWidth; line.classList.add('is-glitch'); gsap.delayedCall(rand(3, 6), again); })();
          } });
        }
        say('ปิดการเชื่อมต่อแล้ว แต่สำเนาของฉันยังอยู่ในโทรศัพท์ของคุณนะ');
      },
    });
  }

  // HUD path + download bar
  $$('[data-file]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: s => { if (s.isActive) $('#hudFile').textContent = sec.dataset.file; },
  }));
  gsap.to('.dl i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // windows can be dragged by their title bar, then spring back into place
  if (finePointer && !reduce) {
    let z = 10;
    $$('.win').forEach(win => Draggable.create(win, {
      trigger: $('.win__bar', win),
      type: 'x,y',
      onPress() { win.style.zIndex = ++z; Sound.key(); },
      onRelease() { gsap.to(win, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, .45)' }); },
    }));
  }

  /* ---------- profile ---------- */
  function nextBirthday() {
    const now = new Date();
    let b = new Date(now.getFullYear(), 1, 17);
    if (b < new Date(now.getFullYear(), now.getMonth(), now.getDate())) b = new Date(now.getFullYear() + 1, 1, 17);
    return b;
  }
  function tickCountdown() {
    const now = new Date();
    const today = now.getMonth() === 1 && now.getDate() === 17;
    const el = $('#countdown');
    if (today) { el.textContent = 'วันนี้! สุขสันต์วันเกิด ♡'; return; }
    const ms = nextBirthday() - now;
    const dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60, ss = Math.floor(ms / 1e3) % 60;
    el.textContent = `${dd} วัน ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  function initProfile() {
    $$('.names li').forEach((li, i) => gsap.delayedCall(i * 0.12, () => scramble(li, li.textContent, 0.6)));
    const now = new Date();
    if (now.getMonth() === 1 && now.getDate() === 17) {
      Petals.burst(innerWidth / 2, innerHeight / 3, 90);
      say('วันนี้วันเกิดของเฟย์ล่า! สุขสันต์วันเกิดนะ ♡');
    } else sayOnce('bday', 'บันทึกวันเกิดไว้แล้ว ถ้าลืม ฉันจะเตือนเอง');
  }
  $$('.names li').forEach(li => li.addEventListener('mouseenter', () => scramble(li, li.dataset.text || li.textContent, 0.5)));

  $$('.swatch').forEach(s => s.addEventListener('click', () => {
    setAccent(s.dataset.accent, s.dataset.name, true);
    Sound.ok();
    Petals.burstFrom(s, 14);
  }));

  // cat.exe
  let pets = store.get('feyla.pets', 0);
  const petLabel = () => ($('#petCount').textContent = pets ? `ถูกลูบไปแล้ว ${pets.toLocaleString()} ครั้ง` : 'ยังไม่มีใครลูบ');
  petLabel();
  const PET_LINES = {
    1: 'แมวตัวนี้ได้รับสิทธิ์ผู้ดูแลระบบแล้ว',
    5: 'ระดับความนุ่มนิ่มเพิ่มขึ้น 5%',
    10: 'แมวเริ่มติดคุณแล้ว ระวังนะ',
    25: 'คุณลูบแมวมากกว่าอ่านแฟ้มอีก',
    50: 'ตรวจพบผู้ใช้ติดแมวขั้นรุนแรง',
  };
  $('#cat').addEventListener('click', e => {
    pets++;
    store.set('feyla.pets', pets);
    petLabel();
    Sound.purr();
    const cat = e.currentTarget;
    cat.classList.remove('is-purr'); void cat.offsetWidth; cat.classList.add('is-purr');
    const r = cat.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const hrt = document.createElement('i');
      hrt.className = 'heart';
      hrt.textContent = '♡';
      document.body.append(hrt);
      gsap.set(hrt, { x: r.left + r.width / 2 + rand(-30, 30), y: r.top + 20 });
      gsap.to(hrt, { y: `-=${rand(60, 120)}`, x: `+=${rand(-40, 40)}`, rotation: rand(-30, 30), autoAlpha: 0, duration: rand(0.9, 1.4), ease: 'power2.out', onComplete: () => hrt.remove() });
    }
    const line = PET_LINES[pets] || (pets > 50 && pets % 50 === 0 ? `ลูบครบ ${pets} ครั้ง แมวตัวนี้เป็นของคุณแล้วในทางเทคนิค` : null);
    if (line) say(line);
  });

  /* ---------- firewall ---------- */
  function initFirewall() {
    $$('[data-attempts]').forEach(b => {
      const o = { v: 0 };
      gsap.to(o, { v: +b.dataset.attempts, duration: 2, ease: 'power3.out', onUpdate: () => (b.textContent = Math.round(o.v).toLocaleString()) });
    });
    const log = $('#fwlog');
    const THREATS = [['กระเทียม', ':จมูก'], ['ไส้เดือน', ':สายตา'], ['กระเทียม', ':จาน'], ['ไส้เดือน', ':สวนหลังบ้าน']];
    let lines = [];
    function add() {
      const [name, port] = pick(THREATS);
      const t = new Date().toTimeString().slice(0, 8);
      lines.push(`[${t}] <span class="r">DENY</span> src=${name} port=${port} rule=ไม่ชอบสุดหัวใจ`);
      lines = lines.slice(-5);
      log.innerHTML = lines.join('\n');
      const b = $$('[data-attempts]')[name === 'กระเทียม' ? 0 : 1];
      b.dataset.attempts = +b.dataset.attempts + 1;
      b.textContent = (+b.dataset.attempts).toLocaleString();
    }
    for (let i = 0; i < 4; i++) add();
    ScrollTrigger.create({
      trigger: '#firewall', start: 'top bottom', end: 'bottom top',
      onToggle: s => { clearInterval(log._t); if (s.isActive) log._t = setInterval(add, 1400); },
    });
    if (ScrollTrigger.isInViewport('#firewall')) log._t = setInterval(add, 1400);
    gsap.delayedCall(1.2, () => sayOnce('fw', 'ตรวจพบ<b>กระเทียม</b>พยายามเข้าระบบอีกแล้ว บล็อกเรียบร้อย', 'deny'));
  }

  /* ---------- food ---------- */
  function initFood() {
    $$('.module').forEach((m, i) => {
      const target = +getComputedStyle(m).getPropertyValue('--p');
      const pct = $('.module__pct', m);
      const o = { v: 0 };
      gsap.to(o, { v: target, duration: 1.4, delay: i * 0.25, ease: 'power2.out', onUpdate: () => { m.style.setProperty('--fill', o.v); pct.textContent = Math.round(o.v) + '%'; } });
    });
    gsap.delayedCall(1.8, () => sayOnce('food', 'ต้มผักกาดดองถูกตั้งเป็นไฟล์ระบบ ลบไม่ได้'));
  }

  /* ---------- personality ---------- */
  async function initPersonality() {
    const lines = $$('[data-decrypt]');
    if (reduce) { $('#encState').textContent = 'ถอดรหัสสำเร็จ ✓'; return; }
    lines.forEach(p => {
      p.dataset.text = p.textContent;
      p.innerHTML = graphemes(p.textContent).map(c => c === ' ' ? ' ' : `<span class="x">${pick(GLYPHS)}</span>`).join('');
    });
    await wait(300);
    for (const p of lines) { Sound.key(); await scramble(p, p.dataset.text, 1.1); }
    $('#encState').textContent = 'ถอดรหัสสำเร็จ ✓';
    Sound.ok();
    say('ถอดรหัสสำเร็จ แต่จะเชื่อหรือไม่ เป็นเรื่องของคุณ');
  }

  /* ---------- relationship lock ---------- */
  let denied = 0;
  const DENY_LINES = [
    'ACCESS DENIED ♡ คำขอถูกปฏิเสธโดยเจ้าของระบบ',
    'ไม่ต้องเข้าหา ไม่ต้องการ ข้อความนี้ชัดเจนพอไหม',
    'ระบบบันทึกความพยายามของคุณไว้แล้ว (น่าสงสาร)',
    'ลองกี่ครั้งก็ไม่ได้หรอก ล็อกนี้ไม่มีรหัสผ่าน',
    'ฉันคำนวณโอกาสสำเร็จแล้ว ได้ 0.00%',
    'ส่งคำขอซ้ำเกินกำหนด ระบบส่งกลีบกุหลาบกลับไปแทน',
  ];
  $('#requestBtn').addEventListener('click', e => {
    denied++;
    Sound.deny();
    Sound.dropout();
    Petals.burstFrom(e.currentTarget, 20);
    const win = e.currentTarget.closest('.win');
    gsap.fromTo(win, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, .25)' });
    $('#denyCount').textContent = `คำขอที่ถูกปฏิเสธ: ${denied} ครั้ง`;
    say(DENY_LINES[(denied - 1) % DENY_LINES.length], 'deny');
  });

  /* ---------- ports + ending ---------- */
  $$('.port').forEach(p => {
    p.addEventListener('mouseenter', () => Sound.key());
    p.addEventListener('click', () => say(`กำลังเชื่อมต่อ <b>${$('.port__name', p).textContent}</b> ในแท็บใหม่`));
  });

  $('#reconnect').addEventListener('click', () => {
    Petals.burst(innerWidth / 2, innerHeight - 80, 40);
    lenis ? lenis.scrollTo(0, { duration: 2.4 }) : scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- easter eggs ---------- */
  let idle;
  function startIdle() {
    const reset = () => {
      clearTimeout(idle);
      idle = setTimeout(() => say('ยังอยู่ไหม? จากการคำนวณ คุณน่าจะติดใจแล้วล่ะ'), 40000);
    };
    ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, reset, { passive: true }));
    reset();
  }

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kp = 0;
  addEventListener('keydown', e => {
    kp = e.key.toLowerCase() === KONAMI[kp].toLowerCase() ? kp + 1 : (e.key === 'ArrowUp' ? 1 : 0);
    if (kp === KONAMI.length) {
      kp = 0;
      html.classList.remove('overload'); void html.offsetWidth; html.classList.add('overload');
      Sound.glitch();
      Sound.dropout(700);
      Petals.burst(innerWidth / 2, innerHeight / 2, 80);
      say('สิทธิ์ผู้ดูแลระบบ? ไม่มีให้หรอก ♡', 'deny');
    }
  });

  console.log('%cneumann.ai #07%c ผู้มาเยือนที่เปิด console... คุณนี่อยากรู้อยากเห็นจริง ๆ\nลอง ↑ ↑ ↓ ↓ ← → ← → B A ดูสิ', 'background:#3B5BFF;color:#F2F26B;padding:2px 6px;font-weight:bold', 'color:#FF6FB5');

  /* ---------- go ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  runBoot();
})();
