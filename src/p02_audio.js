// ================= Ton: Sportplatz-Akustik, Zuschauer, Effekte, Musik, Stadionsprecher =================
// Alles synthetisch (Web Audio). Draußen gibt es kaum Nachhall, nur ein kurzes Echo vom Vereinsheim.
const AUDIO_KEY = 'krl_audio';
const AU = {
  ac: null, on: store.get('krl_sound', true), music: null, exc: 0,
  vol: Object.assign({ master: 0.85, music: 0.5, sfx: 0.9, crowd: 0.5, speaker: false }, store.get(AUDIO_KEY, {})),
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
      this.master = ac.createGain(); this.master.connect(comp); comp.connect(ac.destination);
      // kurzes Echo (Vereinsheim, Bäume): 0,6 s Abklingen
      const len = ac.sampleRate * 0.6, ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4) * (i < ac.sampleRate * 0.03 ? 0 : 1) * (i > ac.sampleRate * 0.11 && i < ac.sampleRate * 0.13 ? 2.5 : 1); } }
      this.verb = ac.createConvolver(); this.verb.buffer = ir; this.verbIn = ac.createGain(); this.verbIn.gain.value = 0.18; this.verbIn.connect(this.verb); this.verb.connect(this.master);
      this.sfx = ac.createGain(); this.sfx.connect(this.master); this.sfx.connect(this.verbIn);
      this.mus = ac.createGain(); this.mus.connect(this.master);
      this.crowdBus = ac.createGain(); this.crowdBus.connect(this.master);
      const nl = ac.sampleRate * 3, nb = ac.createBuffer(1, nl, ac.sampleRate), nd = nb.getChannelData(0);
      let last = 0; for (let i = 0; i < nl; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; nd[i] = last * 3.2 + w * 0.18; }
      this.noise = nb;
      this.crowdReady = false;
      // wenige Zuschauer: lockeres Gemurmel, Jubel, „Uuuh“
      Promise.all([
        renderVoices({ n: 18, dur: 6, lo: 95, hi: 230, rate: [2.5, 5], vowels: 'aeiou', duty: 0.45, amp: 1 }),
        renderVoices({ n: 30, dur: 2.8, lo: 160, hi: 400, rate: [0.4, 0.9], vowels: 'aao', duty: 0.95, amp: 1, swell: true }),
        renderVoices({ n: 24, dur: 1.6, lo: 120, hi: 280, rate: [0.5, 0.6], vowels: 'ou', duty: 1, amp: 1, glide: true }),
      ]).then(([babble, cheer, ooh]) => {
        this.buf = { cheer, ooh };
        this.babble = [0, 1].map(k => { const src = ac.createBufferSource(); src.buffer = babble; src.loop = true; src.playbackRate.value = 1 + k * 0.04;
          const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.crowdBus); src.start(0, k * 2.7); return { src, g }; });
        // Wind draußen: tiefes, gefiltertes Rauschen
        const wind = ac.createBufferSource(); wind.buffer = nb; wind.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
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
    this.mus.gain.setTargetAtTime(v.music * 0.8, t, 0.05); this.crowdBus.gain.setTargetAtTime(v.crowd, t, 0.05);
  },
  setVol(k, val) { this.vol[k] = val; store.set(AUDIO_KEY, this.vol); this.applyVol(); },
  env(node, t0, a, peak, dur, bus) { const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g); g.connect(bus || this.sfx); return g; },
  tone(type, f, dur, vol = 0.1, f2, delay = 0, bus) {
    if (!this.ac) return; const t = this.ac.currentTime + delay, o = this.ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(o, t, 0.004, vol, dur, bus); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(dur, vol, freq = 3000, type = 'highpass', delay = 0, q = 0.7, f2, bus) {
    if (!this.ac) return; const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(); s.buffer = this.noise;
    const f = this.ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); s.connect(f);
    this.env(f, t, 0.003, vol, dur, bus); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  },
  // Pfeife mit Triller. n Pfiffe, long: der letzte lang (Halbzeit, Abpfiff)
  whistle(n = 1, long = false) {
    if (!this.ac) return;
    for (let k = 0; k < n; k++) {
      const t = this.ac.currentTime + k * 0.36, d = long && k === n - 1 ? 0.95 : 0.26;
      const o = this.ac.createOscillator(), lfo = this.ac.createOscillator(), lg = this.ac.createGain();
      o.type = 'triangle'; o.frequency.value = 2900; lfo.frequency.value = 40; lg.gain.value = 240; lfo.connect(lg); lg.connect(o.frequency);
      const bp = this.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2950; bp.Q.value = 2; o.connect(bp);
      this.env(bp, t, 0.012, 0.15, d); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
      this.hiss(d, 0.022, 3000, 'bandpass', k * 0.36, 3);
    }
  },
  // Schuss/Pass: dumpfer Schlag aufs Leder, je fester desto tiefer und lauter
  kick(v = 0.5) { this.tone('sine', 150 - v * 50, 0.09 + v * 0.05, 0.16 + v * 0.18, 55); this.hiss(0.04, 0.05 + v * 0.07, 900 + v * 400, 'bandpass', 0, 1.1); },
  touch() { this.tone('sine', 120, 0.05, 0.05, 80); this.hiss(0.025, 0.025, 700, 'bandpass', 0, 1); },
  header() { this.tone('sine', 190, 0.07, 0.15, 90); this.hiss(0.04, 0.05, 1200, 'bandpass', 0, 1.3); },
  bounce(v = 0.5) { this.tone('sine', 110, 0.06, 0.08 * v, 60); },
  catch() { this.hiss(0.05, 0.07, 800, 'bandpass', 0, 1.2); this.tone('sine', 130, 0.06, 0.08, 80); },
  net() { this.hiss(0.4, 0.09, 2600, 'bandpass', 0, 0.7, 900); this.hiss(0.25, 0.05, 5000, 'highpass', 0.03); },
  post() { [520, 1310, 2750].forEach((f, i) => this.tone('triangle', f * rnd(0.97, 1.03), 0.6 - i * 0.12, 0.08 / (i + 1))); this.tone('sine', 140, 0.12, 0.14, 70); },
  tackle() { this.tone('sine', 90, 0.12, 0.16, 50); this.hiss(0.12, 0.06, 500, 'lowpass', 0, 0.8); },
  slide() { this.hiss(0.32, 0.07, 1200, 'bandpass', 0, 0.6, 400); },
  foul() { this.tone('sine', 85, 0.14, 0.2, 45); },
  select() { this.tone('square', 660, 0.05, 0.03, 990, 0, this.mus); },
  back() { this.tone('square', 520, 0.05, 0.03, 330, 0, this.mus); },
  // Eisspray: zischt
  spray() { this.hiss(0.7, 0.06, 4500, 'highpass', 0, 0.7); },
  bark() { if (!this.ac) return; for (let i = 0; i < 2; i++) { this.tone('sawtooth', 420, 0.09, 0.03, 260, i * 0.22, this.crowdBus); this.hiss(0.08, 0.02, 900, 'bandpass', i * 0.22, 2, null, this.crowdBus); } },
  clap(v = 0.05, delay = 0) { for (let i = 0; i < 5; i++) this.hiss(0.05, v, 1400, 'bandpass', delay + i * 0.011 + Math.random() * 0.01, 1.1, null, this.crowdBus); },
  voice(buf, vol, rate = 1, delay = 0) {
    if (!this.ac || !buf) return; const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); s.connect(g); g.connect(this.crowdBus); s.start(t);
  },
  ooh(v = 0.7) { if (this.buf) this.voice(this.buf.ooh, 0.55 * v, rnd(0.95, 1.05)); },
  cheer(v = 1) {
    if (!this.ac) return;
    if (this.buf) { this.voice(this.buf.cheer, 0.6 * v, 1); this.voice(this.buf.cheer, 0.35 * v, 1.07, 0.2); }
    for (let i = 0; i < 10 * v; i++) this.clap(0.025 * v, 0.3 + Math.random() * 2);
    // Autohupe vom Parkplatz
    if (v > 0.8) [0, 0.35].forEach(d => { this.tone('square', 415, 0.25, 0.018, null, 0.8 + d, this.crowdBus); this.tone('square', 523, 0.25, 0.014, null, 0.8 + d, this.crowdBus); });
  },
  boo() { if (!this.ac) return; if (this.buf) this.voice(this.buf.ooh, 0.3, 0.72); for (let i = 0; i < 3; i++) { const f = rnd(2400, 3300); this.tone('sine', f, rnd(0.4, 0.7), 0.008, f * 0.9, Math.random() * 0.3, this.crowdBus); } },
  crowd(level) { this.exc = Math.max(this.exc, level); },
  setExcite(level) {
    if (!this.ac || !this.crowdReady || !this.ambOn) return;
    this.exc = Math.max(level, this.exc * 0.985);
    const t = this.ac.currentTime, e = clamp(this.exc, 0, 1);
    this.babble[0].g.gain.setTargetAtTime(0.08 + e * 0.2, t, 0.35); this.babble[1].g.gain.setTargetAtTime(0.05 + e * 0.14, t, 0.35);
    this.babble.forEach((b, k) => b.src.playbackRate.setTargetAtTime(1 + k * 0.04 + e * 0.06, t, 0.5));
    this.windG.gain.setTargetAtTime(0.05, t, 0.4);
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
  // ---------- Musik: Chiptune mit Blaskapellen-Bass (Humpta) ----------
  seq(notes, bpm, bus, loop) {
    const ac = this.ac, st = 60 / bpm / 4, hz = m => 440 * Math.pow(2, (m - 69) / 12);
    let step = 0, next = ac.currentTime + 0.08;
    const play = (type, f, d, v, at) => { const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.value = f; e.gain.setValueAtTime(v, at); e.gain.exponentialRampToValueAtTime(0.0001, at + d); o.connect(e); e.connect(bus); o.start(at); o.stop(at + d + 0.02); };
    const nz = (v, d, at, hp) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = this.noise; f.type = hp ? 'highpass' : 'bandpass'; f.frequency.value = hp ? 7000 : 1800; e.gain.setValueAtTime(v, at); e.gain.exponentialRampToValueAtTime(0.0001, at + d); s.connect(f); f.connect(e); e.connect(bus); s.start(at, Math.random()); s.stop(at + d + 0.02); };
    const total = notes.lead.length;
    const tick = () => {
      while (next < ac.currentTime + 0.2) {
        if (!loop && step >= total) { clearInterval(id); return; }
        const i = step % total, l = notes.lead[i], ch = notes.chords[Math.floor(i / 8) % notes.chords.length];
        if (l) play('square', hz(l), st * 1.6, 0.045, next);
        // Humpta: Bass auf 1, Nachschlag-Akkord auf 2
        if (i % 4 === 0) play('triangle', hz(ch[0] - 12 + (i % 8 === 4 ? 7 : 0)), st * 1.8, 0.16, next);
        if (i % 4 === 2) { ch.forEach(n => play('square', hz(n), st * 0.9, 0.014, next)); nz(0.05, 0.05, next, true); }
        if (i % 8 === 0) play('sine', 75, 0.16, 0.3, next);
        if (i % 8 === 4) nz(0.12, 0.1, next);
        next += st; step++;
      }
    };
    const id = setInterval(tick, 40); tick();
    return id;
  },
  startMusic() {
    this.wantMusic = true; if (!this.ac || this.music) return;
    const g = this.ac.createGain(); g.gain.value = 1; g.connect(this.mus);
    const A = [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 71, 0, 74, 0, 72, 0, 76, 0, 79, 0, 84, 0, 83, 81, 79, 77, 76, 0, 0, 0];
    const B = [81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 76, 77, 79, 0, 74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 79, 0, 74, 0, 72, 0, 0, 0];
    const notes = { lead: A.concat(B, A, B), chords: [[60, 64, 67], [60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67], [60, 64, 67], [67, 71, 74], [60, 64, 67],
      [65, 69, 72], [65, 69, 72], [62, 65, 69], [67, 71, 74], [60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]] };
    this.music = { id: this.seq(notes, 132, g, true), g };
  },
  stopMusic() { this.wantMusic = false; if (!this.music) return; clearInterval(this.music.id); try { this.music.g.gain.setTargetAtTime(0, this.ac.currentTime, 0.1); } catch (e) { } this.music = null; },
  jingle(kind) {
    if (!this.ac) return; const g = this.ac.createGain(); g.gain.value = 1; g.connect(this.mus);
    const J = { goal: { lead: [72, 0, 76, 79, 84, 0, 79, 84, 88, 0, 0, 0, 0, 0, 0, 0], chords: [[60, 64, 67], [67, 71, 74]] },
      intro: { lead: [67, 0, 72, 0, 76, 0, 79, 0, 84, 0, 79, 0, 84, 0, 0, 0], chords: [[60, 64, 67], [67, 71, 74]] },
      half: { lead: [79, 76, 72, 76, 79, 0, 84, 0, 0, 0, 0, 0, 0, 0, 0, 0], chords: [[60, 64, 67]] },
      win: { lead: [72, 72, 72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 84, 0, 0, 0, 79, 0, 84, 0, 88, 0, 0, 0], chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74]] } }[kind];
    if (J) this.seq(J, 150, g, false);
  },
  toggle() { this.on = !this.on; store.set('krl_sound', this.on); this.applyVol(); if (!this.on && window.speechSynthesis) speechSynthesis.cancel(); },
};
// Synthetische Menschenstimmen: Sägezahn-Stimmband + zwei Formantfilter je Vokal, Silben als Lautstärke-Hüllkurven
const FORMANTS = { a: [800, 1200], e: [420, 2000], i: [300, 2300], o: [480, 820], u: [330, 700] };
function renderVoices(o) {
  const sr = 22050, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC) return Promise.reject();
  const oc = new OC(1, Math.ceil(sr * o.dur), sr), out = oc.createGain(); out.gain.value = 1.6 / Math.sqrt(o.n); out.connect(oc.destination);
  for (let v = 0; v < o.n; v++) {
    const osc = oc.createOscillator(); osc.type = 'sawtooth';
    const f0 = o.lo * Math.pow(o.hi / o.lo, Math.random()); osc.frequency.setValueAtTime(f0, 0);
    const vib = oc.createOscillator(), vg = oc.createGain(); vib.frequency.value = rnd(4, 6.5); vg.gain.value = f0 * 0.015; vib.connect(vg); vg.connect(osc.frequency); vib.start(0);
    if (o.glide) { osc.frequency.linearRampToValueAtTime(f0 * 1.18, o.dur * 0.35); osc.frequency.linearRampToValueAtTime(f0 * 0.82, o.dur); }
    const amp = oc.createGain(); amp.gain.value = 0;
    const f1 = oc.createBiquadFilter(), f2 = oc.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.Q.value = 7; f2.Q.value = 9;
    const g2 = oc.createGain(); g2.gain.value = 0.55;
    osc.connect(f1); osc.connect(f2); f1.connect(amp); f2.connect(g2); g2.connect(amp); amp.connect(out);
    const pan = 0.3 + Math.random() * 0.7;
    let t = Math.random() * 0.4;
    if (o.swell) { amp.gain.setValueAtTime(0.0001, 0); amp.gain.linearRampToValueAtTime(pan, 0.15 + Math.random() * 0.3); amp.gain.setValueAtTime(pan, o.dur * rnd(0.35, 0.6)); amp.gain.linearRampToValueAtTime(0, o.dur); }
    else if (o.glide) { amp.gain.setValueAtTime(0, 0); amp.gain.linearRampToValueAtTime(pan, 0.25); amp.gain.setValueAtTime(pan, o.dur * 0.55); amp.gain.linearRampToValueAtTime(0, o.dur); }
    while (t < o.dur) {
      const syl = 1 / rnd(o.rate[0], o.rate[1]), vw = FORMANTS[o.vowels[(Math.random() * o.vowels.length) | 0]];
      f1.frequency.setValueAtTime(vw[0] * rnd(0.9, 1.15), t); f2.frequency.setValueAtTime(vw[1] * rnd(0.9, 1.1), t);
      if (!o.swell && !o.glide) {
        if (Math.random() < o.duty) { amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(pan, t + syl * 0.25); amp.gain.linearRampToValueAtTime(pan * 0.6, t + syl * 0.7); amp.gain.linearRampToValueAtTime(0, t + syl * 0.95); }
        if (Math.random() < 0.2) t += rnd(0.4, 1.5);
      }
      t += syl;
    }
    osc.start(0); osc.stop(o.dur);
  }
  return oc.startRendering().then(buf => {
    const d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
    if (pk > 0) { const k = 0.9 / pk; for (let i = 0; i < d.length; i++) d[i] *= k; }
    const fl = Math.floor(sr * 0.05); for (let i = 0; i < fl; i++) { d[i] *= i / fl; d[d.length - 1 - i] *= i / fl; }
    return buf;
  });
}
