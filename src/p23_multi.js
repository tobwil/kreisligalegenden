// ================= Zu zweit an einem Gerät: miteinander gegen die CPU oder gegeneinander (wie bei Korb-Legenden) =================
// Jeder Mensch hat einen Platz (Slot) mit eigener Eingabe, eigenem gesteuerten Spieler und eigener Eingabe-Struktur. Die Steuerung
// läuft für jeden Platz einzeln durch dieselbe humanControl wie allein: Vor dem Aufruf werden IN, G.ctrl und G.human auf den Platz
// umgestellt (withSlot), danach zurück. Zwei Menschen in einer Mannschaft steuern nie denselben Spieler.
// Eingaben: Tastatur geteilt (links WASD, rechts Pfeile), Tastatur + Gamepad, zwei Gamepads.
const MP_SRC = {
  keyL: { n: 'Tastatur links', move: ['KeyW', 'KeyS', 'KeyA', 'KeyD'], a: ['KeyF'], b: ['KeyG'], c: ['KeyH'], k: ['KeyR'], f: ['KeyT'], s: ['ShiftLeft'],
    help: 'WASD laufen · F Pass · G Schuss · H Flanke · R Steil · T Haken · linkes Shift Sprint' },
  keyR: { n: 'Tastatur rechts', move: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], a: ['KeyJ', 'Numpad1'], b: ['KeyK', 'Numpad2'], c: ['KeyL', 'Numpad3'], k: ['KeyI', 'Numpad5'], f: ['KeyU', 'Numpad4'], s: ['ShiftRight', 'Numpad0'],
    help: 'Pfeile laufen · J Pass · K Schuss · L Flanke · I Steil · U Haken · rechtes Shift Sprint' },
  key: { n: 'Tastatur', help: 'wie allein (Belegung aus den Optionen)' },
  pad0: { n: 'Gamepad 1', help: 'A Pass · B Schuss · X Flanke · Y Steil · LB Haken · RT Sprint' },
  pad1: { n: 'Gamepad 2', help: 'A Pass · B Schuss · X Flanke · Y Steil · LB Haken · RT Sprint' },
};
const MP_PRESETS = [['keyL', 'keyR', 'TASTATUR GETEILT'], ['key', 'pad0', 'TASTATUR + GAMEPAD'], ['pad0', 'pad1', 'ZWEI GAMEPADS']];
const MP_COL = ['#ffc83a', '#ff8bd1'];
const newSlotIN = () => ({ x: 0, y: 0, s: false, a: false, b: false, c: false, k: false, f: false, pa: false, pb: false, pc: false, pk: false, pf: false, ra: false, rb: false, rc: false, rk: false, bHeld: 0, aHeld: 0, any: false });
function setupMulti(mode, preset) {
  const P = MP_PRESETS[preset] || MP_PRESETS[0];
  G.pl = [0, 1].map(i => ({ i, team: mode === 'vs' ? i : 0, src: P[i], ctrl: null, IN: newSlotIN(), prev: {}, idleT: 0, manT: 0, lastSwitch: null }));
  G.mpMode = mode; G.human = 0;
  if (mode === 'vs') G.diff = Object.assign({}, DIFF[1], { cpu: 0 });
  mpReset(G.sp ? G.sp.team : 0, G.sp ? G.sp.taker : null);
  G.mpHint = 6;   // Hinweis zu Beginn: wer welche Farbe hat
}
const slotOfP = p => G && G.pl ? G.pl.find(s => s.ctrl === p) || null : null;
const slotOfTeam = t => G && G.pl ? G.pl.find(s => s.team === t) || null : null;
const inOf = p => { const s = slotOfP(p); return s ? s.IN : IN; };
// Eingabe eines Platzes lesen (mit Druck- und Loslass-Kanten wie readInput)
function readSlot(s, dt) {
  let x = 0, y = 0, a = false, b = false, c = false, k = false, f = false, sp = false;
  if (s.src === 'key') { const L = LAY(), [mu, md, ml, mr] = L.move; if (K(ml)) x -= 1; if (K(mr)) x += 1; if (K(mu)) y -= 1; if (K(md)) y += 1; a = K(...L.a); b = K(...L.b); c = K(...L.c); k = K(...L.k); f = K(...L.f); sp = K(...L.s); }
  else if (s.src.startsWith('key')) { const M = MP_SRC[s.src], [mu, md, ml, mr] = M.move; if (K(ml)) x -= 1; if (K(mr)) x += 1; if (K(mu)) y -= 1; if (K(md)) y += 1; a = K(...M.a); b = K(...M.b); c = K(...M.c); k = K(...M.k); f = K(...M.f); sp = K(...M.s); }
  else if (navigator.getGamepads) {
    const pads = [...navigator.getGamepads()].filter(Boolean), gp = pads[+s.src.slice(3)];
    if (gp) { const bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.25) { x += ax; y += ay; } if (bt(14)) x -= 1; if (bt(15)) x += 1; if (bt(12)) y -= 1; if (bt(13)) y += 1;
      a = bt(0); b = bt(1); c = bt(2); k = bt(3); f = bt(4); sp = bt(5) || bt(7) || bt(6); }
  }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  const I = s.IN, P = s.prev;
  Object.assign(I, { x, y, s: sp, pa: a && !P.a, pb: b && !P.b, pc: c && !P.c, pk: k && !P.k, pf: f && !P.f, ra: !a && P.a, rb: !b && P.b, rc: !c && P.c, rk: !k && P.k });
  I.bHeld = b ? I.bHeld + dt : (I.rb ? I.bHeld : 0); I.a = a; I.b = b; I.c = c; I.k = k; I.f = f; I.any = I.pa || I.pb || I.pc || I.pk;
  Object.assign(P, { a, b, c, k, f });
}
function readSlots(dt) { if (!G || !G.pl) return; for (const s of G.pl) readSlot(s, dt); if (G.pl.some(s => s.IN.any)) IN.any = true; }
// Steuerung für einen Platz ausführen: IN, G.ctrl, G.human und die Wechsel-Zeiten gehören dann diesem Platz
function withSlot(s, fn) {
  const keep = { ...IN }, ctrl = G.ctrl, human = G.human, idleT = G.idleT, manT = G.manT, ls = G.lastSwitch, li = LASTIN, prevCtrl = s.ctrl;
  Object.assign(IN, s.IN); G.ctrl = s.ctrl; G.human = s.team; G.idleT = s.idleT; G.manT = s.manT; G.lastSwitch = s.lastSwitch; G.slot = s; LASTIN = s.src.startsWith('pad') ? 'pad' : 'key';
  try { return fn(); }
  finally {
    s.ctrl = G.ctrl; s.idleT = G.idleT; s.manT = G.manT; s.lastSwitch = G.lastSwitch;
    if (G.pl.some(o => o !== s && o.ctrl === s.ctrl)) s.ctrl = prevCtrl;   // nie denselben Spieler wie der andere Mensch
    Object.assign(IN, keep); G.ctrl = ctrl; G.human = human; G.idleT = idleT; G.manT = manT; G.lastSwitch = ls; G.slot = null; LASTIN = li;
  }
}
// Kontrolle nach einem Zuspiel: wer gepasst hat, übernimmt den Empfänger (außer der andere Mensch steuert ihn schon)
function mpTake(t, q, from) {
  if (G.pl.some(s => s.ctrl === q)) return;
  const S = G.pl.filter(s => s.team === t); if (!S.length) return;
  const s = S.find(s => s.ctrl === from) || S.slice().sort((a, b) => (a.ctrl ? dist(a.ctrl.x, a.ctrl.y, q.x, q.y) : 99) - (b.ctrl ? dist(b.ctrl.x, b.ctrl.y, q.x, q.y) : 99))[0];
  s.ctrl = q; if (G.slot === s) G.ctrl = q;
}
const toCtrl = (t, q, from) => { if (!q || G.demo || G.watch || !isHumanTeam(t)) return; if (G.pl) mpTake(t, q, from); else G.ctrl = q; };
// nach Anstoß und Standards: Schütze an den Menschen seiner Mannschaft, sonst nächster freier Spieler
function mpReset(team, taker) {
  if (!G.pl) return;
  for (const s of G.pl) s.ctrl = null;
  if (taker) { const s = slotOfTeam(team); if (s && taker.team === s.team) s.ctrl = taker; }
  mpFix();
}
function mpFix() {
  for (const s of G.pl) {
    if (s.ctrl && !s.ctrl.off && s.ctrl.team === s.team && !G.pl.some(o => o !== s && o.ctrl === s.ctrl)) continue;
    const used = new Set(G.pl.filter(o => o !== s).map(o => o.ctrl));
    s.ctrl = teamP(s.team).filter(p => !isGK(p) && !used.has(p)).sort((a, b) => dist(a.x, a.y, G.ball.x, G.ball.y) - dist(b.x, b.y, G.ball.x, G.ball.y))[0] || null;
  }
  G.ctrl = G.pl[0].ctrl;
}
function mpHumanControl(dt) { for (const s of G.pl) withSlot(s, () => humanControl(dt)); mpFix(); }
// Bewegung: der gesteuerte Spieler eines Platzes läuft mit dessen Stick
function mpMove(p, dt) { const s = slotOfP(p); if (!s) return movePlayer(p, dt); withSlot(s, () => movePlayer(p, dt)); }
function mpSetPiece(dt) {
  const sp = G.sp; if (!sp) return stepSetPiece(dt);
  const s = slotOfTeam(sp.team);
  if (!s) { const k = slotOfTeam(1 - sp.team); return k ? withSlot(k, () => stepSetPiece(dt)) : stepSetPiece(dt); }
  if (sp.taker && !G.pl.some(o => o.ctrl === sp.taker)) s.ctrl = sp.taker;
  const owner = G.pl.find(o => o.ctrl === sp.taker) || s;
  withSlot(owner, () => stepSetPiece(dt));
}
Object.assign(ACT, {
  qmp(a) { QUICK.mp = a; renderQuick(`[data-act="qmp"][data-arg="${a}"]`); },
  qmpIn(a) { QUICK.mpIn = +a; renderQuick(`[data-act="qmpIn"][data-arg="${a}"]`); },
});
