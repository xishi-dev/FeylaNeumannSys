/* All audio is synthesized with Web Audio: UI sounds plus a small looping
   "cyber lullaby" (arpeggio + pad through a delay), so the site ships no audio files. */
window.Sound = (() => {
  let ctx, master, fx, on = false;
  let music = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5 * vol;
    master.connect(ctx.destination);
    // feedback delay shared by the music
    fx = ctx.createDelay(1);
    fx.delayTime.value = 0.326;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    fx.connect(lp); lp.connect(fb); fb.connect(fx); lp.connect(master);
  }

  function env(node, t, a, peak, d, dest = master) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); g.connect(dest);
    return g;
  }
  function tone(f, type, a, peak, d, when = 0, dest) {
    if (!on) return null;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(o, t, a, peak, d, dest);
    o.start(t); o.stop(t + a + d + 0.05);
    return { o, t };
  }
  function noise(dur, type, f, q, peak, when = 0) {
    if (!on) return null;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
    s.connect(flt); env(flt, t, 0.004, peak, dur); s.start(t);
    return { s, flt, t };
  }

  /* ---------- the lullaby ---------- */
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  // Am  F  C  Em, two bars each
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 55, 59]];
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
  function startMusic() {
    if (music) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master); bus.connect(fx);
    bus.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3);
    const step = 60 / 92 / 2; // eighth notes at 92 bpm
    let next = ctx.currentTime + 0.1, i = 0;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.2) {
        const bar = Math.floor(i / 8) % 8;
        const chord = CHORDS[Math.floor(bar / 2)];
        const n = chord[ARP[i % 8]] + 12 + (i % 16 >= 8 && i % 8 === 7 ? 12 : 0);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = N(n);
        env(o, next, 0.005, 0.09, step * 1.6, bus); o.start(next); o.stop(next + step * 2);
        if (i % 16 === 0) { // pad + bass at each new chord
          chord.forEach((m, k) => {
            const p = ctx.createOscillator(); p.type = 'sawtooth'; p.frequency.value = N(m); p.detune.value = (k - 1) * 8;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
            p.connect(lp); env(lp, next, 0.8, 0.025, step * 15, bus); p.start(next); p.stop(next + step * 17);
          });
          const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = N(chord[0] - 12);
          env(b, next, 0.02, 0.16, step * 7, bus); b.start(next); b.stop(next + step * 8);
        }
        if (i % 4 === 2) { // soft hat
          const len = Math.floor(ctx.sampleRate * 0.04), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
          for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
          const s = ctx.createBufferSource(); s.buffer = buf;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
          s.connect(hp); env(hp, next, 0.002, 0.03, 0.04, bus); s.start(next);
        }
        next += step; i++;
      }
    }, 25);
    music = { bus, timer };
  }
  function stopMusic() {
    if (!music) return;
    const { bus, timer } = music;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => clearInterval(timer), 700);
    music = null;
  }

  /* ---------- soundtrack file: <audio> -> lowpass -> gain (replaces the lullaby when set) ---------- */
  let songEl = null, song = null, muffled = false;
  const SONG_VOL = 0.65;
  let vol = 0.8; // user volume, 0..1, scales everything
  function startSong() {
    if (!song) {
      const src = ctx.createMediaElementSource(songEl);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.Q.value = 0.8;
      filter.frequency.value = muffled ? 600 : 20000;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      song = { filter, gain };
    }
    const g = song.gain.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(SONG_VOL * vol, t + 3);
    songEl.play().catch(() => {});
  }
  function stopSong() {
    if (!song) return;
    const g = song.gain.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.7);
    setTimeout(() => { if (!on) songEl.pause(); }, 750);
  }

  return {
    get on() { return on; },
    useSong(el) { songEl = el; },
    enable() { init(); ctx.resume(); on = true; songEl ? startSong() : startMusic(); },
    disable() { if (ctx) { stopMusic(); stopSong(); } on = false; },
    // lowpass the song, as if heard through the terminal
    muffle(state, seconds = 1.2) {
      muffled = state;
      if (song) song.filter.frequency.setTargetAtTime(state ? 600 : 20000, ctx.currentTime, seconds / 3);
    },
    // brief drop-out for glitches and denials
    dropout(ms = 350) {
      if (!song || !on) return;
      const g = song.gain.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.05, t + 0.03); g.setValueAtTime(0.05, t + ms / 1000);
      g.linearRampToValueAtTime(SONG_VOL * vol, t + ms / 1000 + 0.5);
    },
    get volume() { return vol; },
    setVolume(v) {
      vol = Math.min(1, Math.max(0, v));
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(0.5 * vol, t, 0.05);
      if (song && on) {
        song.gain.gain.cancelScheduledValues(t);
        song.gain.gain.setTargetAtTime(SONG_VOL * vol, t, 0.05);
      }
    },
    pauseSong() { if (songEl && on) songEl.pause(); },
    resumeSong() { if (songEl && on) songEl.play().catch(() => {}); },
    key() { noise(0.018, 'bandpass', 2400 + Math.random() * 1600, 2, 0.06); },
    ok() { tone(1046.5, 'square', 0.002, 0.03, 0.06); tone(1568, 'square', 0.002, 0.03, 0.1, 0.06); },
    open() { tone(523.3, 'triangle', 0.004, 0.08, 0.18); tone(784, 'triangle', 0.004, 0.07, 0.22, 0.07); tone(1046.5, 'triangle', 0.004, 0.06, 0.4, 0.14); },
    chat() { tone(1318.5, 'sine', 0.003, 0.05, 0.12); tone(1760, 'sine', 0.003, 0.04, 0.18, 0.05); },
    glitch() {
      for (let k = 0; k < 5; k++) noise(0.03 + Math.random() * 0.05, 'bandpass', 500 + Math.random() * 5000, 5, 0.2, k * 0.06);
      tone(80, 'square', 0.004, 0.08, 0.2);
    },
    deny() { tone(220, 'square', 0.004, 0.07, 0.14); tone(164.8, 'square', 0.004, 0.07, 0.3, 0.14); },
    purr() {
      if (!on) return;
      const t = ctx.currentTime;
      const n = noise(1.2, 'lowpass', 180, 1, 0.22);
      if (!n) return;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 24;
      const lg = ctx.createGain(); lg.gain.value = 120;
      lfo.connect(lg); lg.connect(n.flt.frequency); lfo.start(t); lfo.stop(t + 1.25);
      tone(1760, 'sine', 0.01, 0.03, 0.3, 0.2); tone(2093, 'sine', 0.01, 0.03, 0.3, 0.32);
    },
    petals() { const n = noise(0.9, 'bandpass', 900, 0.8, 0.07); if (n) n.flt.frequency.exponentialRampToValueAtTime(3800, n.t + 0.8); },
    boom() { const r = tone(110, 'sine', 0.01, 0.4, 1.2); if (r) r.o.frequency.exponentialRampToValueAtTime(36, r.t + 1); noise(0.6, 'lowpass', 500, 0.7, 0.16); },
  };
})();
