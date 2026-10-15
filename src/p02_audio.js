// ================= Ton: Sportplatz-Akustik, Zuschauer, Effekte, Musik, Stadionsprecher =================
// Alles synthetisch (Web Audio). Zuschauer aus gefiltertem Rauschen (Raunen, Jubel, „Uuuh“) statt künstlicher Stimmen,
// Schuss als dumpfer Schlag mit Klick, Schiedsrichterpfeife mit Kugel-Triller. Draußen kaum Nachhall, nur ein kurzes Echo.
const AUDIO_KEY = 'krl_audio2';
const AU = {
  ac: null, on: store.get('krl_sound', true), music: null, exc: 0,
  vol: Object.assign({ master: 0.85, music: 0.35, sfx: 0.9, crowd: 0.6, speaker: false }, store.get(AUDIO_KEY, {})),
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
      this.master = ac.createGain(); this.master.connect(comp); comp.connect(ac.destination);
      // kurzes, dunkles Echo vom Vereinsheim
      const len = ac.sampleRate * 0.5, ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * 0.25; d[i] = lp * Math.pow(1 - t, 3) * (i < ac.sampleRate * 0.04 ? 0 : 1); } }
      this.verb = ac.createConvolver(); this.verb.buffer = ir; this.verbIn = ac.createGain(); this.verbIn.gain.value = 0.12; this.verbIn.connect(this.verb); this.verb.connect(this.master);
      this.sfx = ac.createGain(); this.sfx.connect(this.master); this.sfx.connect(this.verbIn);
      // Musik durch einen Tiefpass: keine schrillen Rechteck-Obertöne
      this.musLP = ac.createBiquadFilter(); this.musLP.type = 'lowpass'; this.musLP.frequency.value = 2600; this.musLP.Q.value = 0.5;
      this.mus = ac.createGain(); this.mus.connect(this.musLP); this.musLP.connect(this.master);
      this.crowdBus = ac.createGain(); this.crowdBus.connect(this.master);
      // Rauschen: weiß (für Klicks) und rosa-braun (für Wind und Zuschauer)
      const nl = ac.sampleRate * 3, nb = ac.createBuffer(1, nl, ac.sampleRate), nd = nb.getChannelData(0), wb = ac.createBuffer(1, nl, ac.sampleRate), wd = wb.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < nl; i++) { const w = Math.random() * 2 - 1; wd[i] = w; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
      this.noise = nb; this.white = wb;
      this.crowdReady = false;
      Promise.all([
        renderCrowd({ dur: 8, kind: 'murmur' }),
        renderCrowd({ dur: 3.2, kind: 'cheer' }),
        renderCrowd({ dur: 1.7, kind: 'ooh' }),
      ]).then(([murmur, cheer, ooh]) => {
        this.buf = { cheer, ooh };
        this.babble = [0, 1].map(k => { const src = ac.createBufferSource(); src.buffer = murmur; src.loop = true; src.playbackRate.value = 1 - k * 0.07;
          const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.crowdBus); src.start(0, k * 3.7); return { src, g }; });
        const wind = ac.createBufferSource(); wind.buffer = nb; wind.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        this.windG = ac.createGain(); this.windG.gain.value = 0; wind.connect(lp); lp.connect(this.windG); this.windG.connect(this.crowdBus); wind.start();
        this.crowdReady = true; if (this.wantAmb) this.ambience(true);
      }).catch(() => { });
      this.applyVol();
      if (this.wantMusic) this.startMusic();
    } catch (e) { this.ac = null; }
  },
  applyVol() {
    if (!this.ac) return; const v = this.vol, on = this.on ? 1 : 0, t = this.ac.currentTime;
    this.master.gain.setTargetAtTime(v.master * on, t, 0.05); this.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
    this.mus.gain.setTargetAtTime(v.music * 0.7, t, 0.05); this.crowdBus.gain.setTargetAtTime(v.crowd, t, 0.05);
  },
  setVol(k, val) { this.vol[k] = val; store.set(AUDIO_KEY, this.vol); this.applyVol(); },
  env(node, t0, a, peak, dur, bus) { const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g); g.connect(bus || this.sfx); return g; },
  tone(type, f, dur, vol = 0.1, f2, delay = 0, bus) {
    if (!this.ac) return; const t = this.ac.currentTime + delay, o = this.ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(o, t, 0.003, vol, dur, bus); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(dur, vol, freq = 3000, type = 'highpass', delay = 0, q = 0.7, f2, bus, white) {
    if (!this.ac) return; const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(); s.buffer = white ? this.white : this.noise;
    const f = this.ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); s.connect(f);
    this.env(f, t, 0.002, vol, dur, bus); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  },
  // Schiedsrichterpfeife: Grundton um 2,8 kHz, die Kugel in der Pfeife trillert (Amplitude und Tonhöhe wackeln ~30 Hz), etwas Atem
  whistle(n = 1, long = false) {
    if (!this.ac) return;
    for (let k = 0; k < n; k++) {
      const t = this.ac.currentTime + k * 0.34, d = long && k === n - 1 ? 0.9 : 0.24, f0 = 2750 * rnd(0.99, 1.01);
      const out = this.ac.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.11, t + 0.02); out.gain.setValueAtTime(0.11, t + d - 0.05); out.gain.exponentialRampToValueAtTime(0.0001, t + d); out.connect(this.sfx);
      const am = this.ac.createGain(); am.gain.value = 0.6; am.connect(out);
      const lfo = this.ac.createOscillator(), lg = this.ac.createGain(), fg = this.ac.createGain(); lfo.frequency.value = rnd(27, 33); lg.gain.value = 0.4; fg.gain.value = 45;
      lfo.connect(lg); lg.connect(am.gain); lfo.connect(fg);
      for (const [mul, v] of [[1, 1], [1.006, 0.6], [2, 0.08]]) { const o = this.ac.createOscillator(), og = this.ac.createGain(); o.type = 'sine'; o.frequency.value = f0 * mul; fg.connect(o.frequency); og.gain.value = v; o.connect(og); og.connect(am); o.start(t); o.stop(t + d + 0.05); }
      lfo.start(t); lfo.stop(t + d + 0.05);
      this.hiss(d, 0.012, 2800, 'bandpass', k * 0.34, 4, null, null, true);
    }
  },
  // Schuss/Pass: Klick des Spanns, dumpfer Schlag aufs Leder, je fester desto tiefer und lauter
  kick(v = 0.5) {
    this.hiss(0.012, 0.05 + v * 0.06, 3500, 'highpass', 0, 0.7, null, null, true);
    this.tone('sine', 120 - v * 30, 0.1 + v * 0.06, 0.22 + v * 0.22, 45);
    this.hiss(0.05, 0.06 + v * 0.06, 700, 'bandpass', 0, 1.4, 350);
  },
  touch() { this.tone('sine', 100, 0.05, 0.08, 60); this.hiss(0.02, 0.03, 900, 'bandpass', 0, 1.2); },
  header() { this.tone('sine', 160, 0.07, 0.18, 80); this.hiss(0.03, 0.05, 1500, 'bandpass', 0, 1.3, null, null, true); },
  bounce(v = 0.5) { this.tone('sine', 90, 0.06, 0.08 * v, 55); },
  catch() { this.hiss(0.05, 0.08, 900, 'bandpass', 0, 1.2); this.tone('sine', 110, 0.06, 0.1, 70); },
  // Netz: Rascheln, das schnell abklingt
  net() { this.hiss(0.35, 0.06, 2200, 'bandpass', 0, 0.8, 900); this.hiss(0.18, 0.03, 5000, 'highpass', 0.02, 0.7, null, null, true); this.tone('sine', 80, 0.12, 0.06, 50); },
  // Pfosten: metallischer Klang (unharmonische Teiltöne) mit Schlag
  post() { [[540, 0.5], [1290, 0.35], [2140, 0.22], [3310, 0.15]].forEach(([f, d], i) => this.tone('sine', f * rnd(0.98, 1.02), d, 0.06 / (i + 1))); this.tone('sine', 130, 0.1, 0.18, 60); },
  tackle() { this.tone('sine', 80, 0.12, 0.18, 45); this.hiss(0.1, 0.05, 400, 'lowpass', 0, 0.8); },
  slide() { this.hiss(0.32, 0.05, 900, 'bandpass', 0, 0.7, 300); },
  foul() { this.tone('sine', 75, 0.14, 0.2, 40); },
  select() { this.tone('triangle', 880, 0.05, 0.05, 1320, 0, this.mus); },
  back() { this.tone('triangle', 660, 0.05, 0.05, 440, 0, this.mus); },
  spray() { this.hiss(0.7, 0.04, 5000, 'highpass', 0, 0.7, null, null, true); },
  bark() { if (!this.ac) return; for (let i = 0; i < 2; i++) { this.tone('triangle', 380, 0.08, 0.04, 240, i * 0.22, this.crowdBus); this.hiss(0.07, 0.025, 800, 'bandpass', i * 0.22, 2, null, this.crowdBus); } },
  clap(v = 0.05, delay = 0) { this.hiss(0.03, v, 1600, 'bandpass', delay, 1.2, null, this.crowdBus, true); },
  voice(buf, vol, rate = 1, delay = 0) {
    if (!this.ac || !buf) return; const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); s.connect(g); g.connect(this.crowdBus); s.start(t);
  },
  ooh(v = 0.7) { if (this.buf) this.voice(this.buf.ooh, 0.6 * v, rnd(0.94, 1.06)); },
  cheer(v = 1) {
    if (!this.ac) return;
    if (this.buf) { this.voice(this.buf.cheer, 0.75 * v, 1); this.voice(this.buf.cheer, 0.4 * v, 0.93, 0.15); }
    for (let i = 0; i < 26 * v; i++) this.clap(0.02 * v, 0.4 + Math.random() * 2.4);
    // Autohupe vom Parkplatz
    if (v > 0.8) [0, 0.35].forEach(d => { this.tone('triangle', 415, 0.24, 0.025, null, 1 + d, this.crowdBus); this.tone('triangle', 523, 0.24, 0.02, null, 1 + d, this.crowdBus); });
  },
  boo() { if (this.buf) this.voice(this.buf.ooh, 0.35, 0.75); },
  crowd(level) { this.exc = Math.max(this.exc, level); },
  setExcite(level) {
    if (!this.ac || !this.crowdReady || !this.ambOn) return;
    this.exc = Math.max(level, this.exc * 0.985);
    const t = this.ac.currentTime, e = clamp(this.exc, 0, 1);
    this.babble[0].g.gain.setTargetAtTime(0.16 + e * 0.3, t, 0.4); this.babble[1].g.gain.setTargetAtTime(0.1 + e * 0.22, t, 0.4);
    this.windG.gain.setTargetAtTime(0.06, t, 0.4);
  },
  ambience(on) {
    this.wantAmb = on; if (!this.crowdReady) return; this.ambOn = on; const t = this.ac.currentTime;
    if (!on) { this.babble.forEach(b => b.g.gain.setTargetAtTime(0, t, 0.3)); this.windG.gain.setTargetAtTime(0, t, 0.3); } else { this.exc = 0; this.setExcite(0.1); }
  },
  // Sprecher über die Sprachausgabe des Browsers (standardmäßig aus)
  say(text, opts = {}) {
    if (!this.on || !this.vol.speaker || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = opts.rate || 1.02; u.pitch = opts.pitch || 0.85; u.volume = clamp(this.vol.master * 0.9, 0, 1);
      const v = speechSynthesis.getVoices().filter(x => x.lang && x.lang.toLowerCase().startsWith('de')); if (v.length) u.voice = v[0];
      if (opts.interrupt !== false) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { }
  },
  // ---------- Musik: entspannter Chiptune-Groove (weiche Pulswelle, Dreiecksbass, leise Hi-Hats) ----------
  seq(notes, bpm, bus, loop) {
    const ac = this.ac, st = 60 / bpm / 4, hz = m => 440 * Math.pow(2, (m - 69) / 12);
    let step = 0, next = ac.currentTime + 0.08;
    const play = (type, f, d, v, at, att = 0.008) => { const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.value = f; e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(v, at + att); e.gain.exponentialRampToValueAtTime(0.0001, at + d); o.connect(e); e.connect(bus); o.start(at); o.stop(at + d + 0.05); };
    const nz = (v, d, at, f) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = this.white; fl.type = 'highpass'; fl.frequency.value = f; e.gain.setValueAtTime(v, at); e.gain.exponentialRampToValueAtTime(0.0001, at + d); s.connect(fl); fl.connect(e); e.connect(bus); s.start(at, Math.random()); s.stop(at + d + 0.05); };
    const total = notes.lead.length;
    const tick = () => {
      while (next < ac.currentTime + 0.2) {
        if (!loop && step >= total) { clearInterval(id); return; }
        const i = step % total, l = notes.lead[i], ch = notes.chords[Math.floor(i / 16) % notes.chords.length];
        if (l) { play('triangle', hz(l), st * 2.4, 0.11, next); play('square', hz(l), st * 1.6, 0.012, next, 0.02); }
        if (i % 4 === 0) play('triangle', hz(ch[0] - 24), st * 3.2, 0.22, next);
        if (i % 8 === 6) play('triangle', hz(ch[0] - 17), st * 1.4, 0.14, next);
        if (i % 16 === 0 || i % 16 === 8) ch.forEach(n => play('sine', hz(n), st * 7, 0.03, next, 0.06));
        if (i % 2 === 0) nz(i % 4 === 2 ? 0.035 : 0.018, 0.04, next, 8000);
        if (i % 8 === 0) play('sine', 70, 0.14, 0.32, next, 0.003);
        if (i % 8 === 4) nz(0.05, 0.09, next, 1800);
        next += st; step++;
      }
    };
    const id = setInterval(tick, 40); tick();
    return id;
  },
  startMusic() {
    this.wantMusic = true; if (!this.ac || this.music) return;
    const g = this.ac.createGain(); g.gain.value = 1; g.connect(this.mus);
    // Melodie in C-Dur, Akkorde C – Am – F – G
    const A = [76, 0, 0, 79, 0, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 76, 0, 0, 72, 0, 69, 0, 0, 0, 0, 0, 0, 0,
      72, 0, 0, 74, 0, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0, 71, 0, 0, 72, 0, 0, 74, 0, 79, 0, 0, 0, 0, 0, 0, 0];
    const notes = { lead: A.concat(A), chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] };
    this.music = { id: this.seq(notes, 104, g, true), g };
  },
  stopMusic() { this.wantMusic = false; if (!this.music) return; clearInterval(this.music.id); try { this.music.g.gain.setTargetAtTime(0, this.ac.currentTime, 0.1); } catch (e) { } this.music = null; },
  jingle(kind) {
    if (!this.ac) return; const g = this.ac.createGain(); g.gain.value = 1.3; g.connect(this.mus);
    const J = { goal: { lead: [72, 0, 76, 0, 79, 0, 84, 0, 0, 0, 0, 0, 0, 0, 0, 0], chords: [[60, 64, 67]] },
      intro: { lead: [67, 0, 72, 0, 76, 0, 79, 0, 0, 0, 0, 0, 0, 0, 0, 0], chords: [[60, 64, 67]] },
      half: { lead: [79, 0, 76, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], chords: [[60, 64, 67]] },
      win: { lead: [72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 84, 0, 0, 0, 0, 0], chords: [[60, 64, 67]] } }[kind];
    if (J) this.seq(J, 150, g, false);
  },
  toggle() { this.on = !this.on; store.set('krl_sound', this.on); this.applyVol(); if (!this.on && window.speechSynthesis) speechSynthesis.cancel(); },
};
// Zuschauer aus Rauschen: viele kurze, weiche „Stimmen-Blasen“ in zwei Frequenzbändern (Raunen), ein anschwellender Jubel
// mit hellen Rufen, und ein „Uuuh“ als resonantes Band, das hoch und wieder runter gleitet
function renderCrowd(o) {
  const sr = 22050, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC) return Promise.reject();
  const oc = new OC(1, Math.ceil(sr * o.dur), sr), n = Math.ceil(sr * o.dur), nb = oc.createBuffer(1, n, sr), d = nb.getChannelData(0);
  let b0 = 0, b1 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.1; b1 = 0.9 * b1 + w * 0.3; d[i] = b0 + b1 + w * 0.1; }
  const band = (f, q, gain) => { const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const g = oc.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start(0, Math.random() * 0.5); return { s, fl, g }; };
  if (o.kind === 'murmur') {
    for (const [f, q] of [[450, 1.2], [900, 1.4], [1600, 1.6], [650, 2]]) {
      const B = band(f * rnd(0.9, 1.1), q, 0); let t = 0;
      while (t < o.dur) { const l = rnd(0.15, 0.5), v = rnd(0.2, 1); B.g.gain.setTargetAtTime(v, t, l * 0.3); B.g.gain.setTargetAtTime(v * 0.25, t + l, l * 0.4); t += l * rnd(0.6, 1.4); }
    }
  } else if (o.kind === 'cheer') {
    for (const [f, q, v] of [[600, 1, 1], [1200, 1.2, 0.8], [2400, 2, 0.35]]) {
      const B = band(f, q, 0); B.g.gain.setValueAtTime(0.0001, 0); B.g.gain.exponentialRampToValueAtTime(v, 0.35); B.g.gain.setValueAtTime(v, o.dur * 0.45); B.g.gain.exponentialRampToValueAtTime(0.001, o.dur);
      B.fl.frequency.setValueAtTime(f * 0.8, 0); B.fl.frequency.linearRampToValueAtTime(f * 1.15, 0.5); B.fl.frequency.linearRampToValueAtTime(f, o.dur);
    }
  } else {
    const B = band(380, 4, 0); B.g.gain.setValueAtTime(0.0001, 0); B.g.gain.exponentialRampToValueAtTime(2.2, 0.25); B.g.gain.setValueAtTime(2.2, o.dur * 0.55); B.g.gain.exponentialRampToValueAtTime(0.001, o.dur);
    B.fl.frequency.setValueAtTime(330, 0); B.fl.frequency.linearRampToValueAtTime(560, o.dur * 0.4); B.fl.frequency.linearRampToValueAtTime(300, o.dur);
    const C = band(900, 3, 0); C.g.gain.setValueAtTime(0.0001, 0); C.g.gain.exponentialRampToValueAtTime(0.6, 0.3); C.g.gain.exponentialRampToValueAtTime(0.001, o.dur);
  }
  return oc.startRendering().then(buf => {
    const x = buf.getChannelData(0); let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
    if (pk > 0) { const k = 0.9 / pk; for (let i = 0; i < x.length; i++) x[i] *= k; }
    const fl = Math.floor(sr * 0.08); for (let i = 0; i < fl; i++) { x[i] *= i / fl; x[x.length - 1 - i] *= i / fl; }
    return buf;
  });
}
