// ================= Training: Lektionen zum Lernen der Steuerung =================
// Ein normales Spiel mit wenigen Spielern, ohne Uhr. Jede Lektion stellt die Spieler auf, zählt Erfolge und setzt nach Tor, Aus oder Ballverlust neu an.
const TUT_KEY = 'krl_tut';
const tutKeys = () => LASTIN === 'touch'
  ? { move: 'den Stick links', sprint: 'Stick weit ziehen', pass: 'PASS', through: 'PASS wischen', cross: 'PASS nach oben ziehen', shot: 'SCHUSS halten und loslassen', aim: 'Stick hoch/runter', tackle: 'TACKLING tippen', slide: 'TACKLING drücken und ziehen', sw: 'WECHSEL' }
  : LASTIN === 'pad'
    ? { move: 'den linken Stick', sprint: 'RT', pass: 'A', through: 'Y', cross: 'X', shot: 'B halten und loslassen', aim: 'Stick hoch/runter', tackle: 'B', slide: 'X', sw: 'A' }
    : (N => ({ move: LAY().moveN, sprint: N.s === 'SHIFT' ? 'Shift' : N.s, pass: N.a, through: N.k, cross: N.c, shot: `${N.b === 'LEER' ? 'Leertaste' : N.b} halten und loslassen`, aim: LAY().move[0] === 'KeyW' ? 'W/S' : 'Pfeil hoch/runter', tackle: (N[(LAY().def || {}).tk || 'b']), slide: (s => s === 'LEER' ? 'Leertaste' : s)(N[(LAY().def || {}).sl || 'c']), sw: N.a }))(LAY().keyN);
const LESSONS = [
  { t: 'LAUFEN', need: 3, txt: k => `Lauf mit ${k.move} zu den gelben Markierungen. ${k.sprint} = Sprint (kostet Kraft).`,
    setup(T) { const p = tutUse(0, 'ST', CW / 2, MY); T.marks = [[CW / 2 + 12, MY - 10], [CW / 2 - 8, MY + 14], [CW / 2 + 22, MY + 6]]; G.ctrl = p; } },
  { t: 'PASSEN', need: 4, txt: k => `${k.pass} spielt einen Pass in Laufrichtung – das blaue Dreieck zeigt, wer ihn bekommt. Antippen = kurz, halten = fester und weiter. Spiel ${4} Pässe.`,
    setup(T) { const p = tutUse(0, 'MF', CW / 2, MY); giveBall(p, true); tutHold(tutUse(0, 'MF', CW / 2 + 14, MY - 10, 1)); tutHold(tutUse(0, 'ST', CW / 2 + 14, MY + 10)); tutHold(tutUse(0, 'AB', CW / 2 - 10, MY + 2)); G.ctrl = p; },
    on(T, e) { if (e.k === 'recv' && e.p.team === 0 && e.kind === 'pass') T.n++; } },
  { t: 'STEILPASS', need: 2, txt: k => `${k.through} spielt den Ball in den Lauf deines Stürmers – hinter die Abwehr. Achte aufs Abseits!`,
    setup(T) { const s = atkDir(0), gx = goalX(0), p = tutUse(0, 'MF', gx - s * 36, MY); giveBall(p, true); tutUse(0, 'ST', gx - s * 23, MY); tutHold(tutUse(1, 'AB', gx - s * 20, MY - 9)); tutHold(tutUse(1, 'AB', gx - s * 20, MY + 9)); G.ctrl = p; },
    on(T, e) { if (e.k === 'recv' && e.p.team === 0 && e.kind === 'through') { T.n++; T.reset = 1.2; } } },
  { t: 'SCHIESSEN', need: 3, txt: k => `${k.shot}: kurz = flach, lang = hoch, zu lang = drüber. Mit ${k.aim} zielst du in die Ecke, das Zielkreuz im Tor zeigt wohin. ${LASTIN === 'touch' ? 'Beim Aufladen den Daumen ziehen = zielen (Zeitlupe), leicht in die Ecke = Schlenzer' : `Beim Aufladen ${k.pass} = Schlenzer, ${k.cross} = Heber`}. Schieß 3 Tore.`,
    setup(T) { const s = atkDir(0), gx = goalX(0), p = tutUse(0, 'ST', gx - s * 19, MY + rnd(-6, 6)); giveBall(p, true); G.ctrl = p; G.gk[1].d.tw = Math.min(G.gk[1].d.tw, 55); },
    on(T, e) { if (e.k === 'goal' && e.team === 0) T.n++; } },
  { t: 'FLANKE & KOPFBALL', need: 2, txt: k => `Vom Flügel flanken: ${k.cross}. Dein Stürmer läuft zur Flanke und köpft im Strafraum von selbst aufs Tor – ${k.aim} wählt die Ecke. Kommt der Ball flach, drück schnell ${k.shot.split(' ')[0]} für die Direktabnahme.`,
    setup(T) { const s = atkDir(0), gx = goalX(0), p = tutUse(0, 'MF', gx - s * 22, 6); giveBall(p, true); tutUse(0, 'ST', gx - s * 9, MY - 2); tutUse(0, 'ST', gx - s * 11, MY + 4); tutHold(tutUse(1, 'AB', gx - s * 5, MY + 8)); G.ctrl = p; G.gk[1].d.tw = Math.min(G.gk[1].d.tw, 45); },
    on(T, e) { if (e.k === 'goal' && e.team === 0) T.n++; } },
  { t: 'ABWEHR', need: 3, txt: k => `Hol dir den Ball: ${k.tackle} = Tackling (von vorn!), ${k.slide} = Grätsche (Ball zuerst treffen). ${k.sw} wechselt den Spieler.`,
    setup(T) { const s = atkDir(0), ox = ownX(0), a = tutUse(1, 'ST', ox + s * 38, MY + rnd(-8, 8)); giveBall(a, true); a.think = 1.2; const d = tutUse(0, 'AB', ox + s * 26, MY); tutUse(0, 'AB', ox + s * 20, MY + 9, 1); G.ctrl = d; },
    on(T, e) { if (e.k === 'win') { T.n++; T.reset = 1; } if (e.k === 'goal' && e.team === 1) T.reset = 0.1; } },
  { t: 'STANDARDS', need: 2, txt: k => `Freistoß und Elfmeter: Die Kamera steht hinter dem Ball. Mit ${k.move} das Fadenkreuz verschieben, ${k.shot}. Wenig Kraft = Bogen über die Mauer. Triff zweimal.`,
    setup(T) { const s = atkDir(0), gx = goalX(0); tutUse(0, 'ST', gx - s * 23, MY); for (let i = 0; i < 2; i++) tutUse(1, 'AB', gx - s * 14, MY + i); G.phase = 'play';
      G.gk[1].d.tw = Math.min(G.gk[1].d.tw, 50); if (T.n % 2 === 0) setupSetPiece('free', 0, gx - s * 20, MY + 7); else setupSetPiece('pen', 0, 0, 0); },
    on(T, e) { if (e.k === 'goal' && e.team === 0) T.n++; } },
];
function tutUse(team, grp, x, y) {
  const p = G.players.find(q => q.team === team && !isGK(q) && q.off && grpOf(q) === grp) || G.players.find(q => q.team === team && !isGK(q) && q.off);
  p.off = false; place(p, x, y); p.face = atkDir(team); p.tutHold = null; return p;
}
function tutHold(p) { p.tutHold = [p.x, p.y]; return p; }
function startTraining(lesson = 0) {
  const ids = LIGEN[TEAMS[HOME_TEAM].lg].ids;
  startMatch(MY_TEAM(), ids[1] === MY_TEAM() ? ids[2] : ids[1], { human: 0, tut: true, wx: {} });
  G.tut = { i: lesson, n: 0, marks: [], reset: 0 };
  G.phase = 'play';
  tutSetup();
}
// Verein für Training und Freundschaftsspiel: der zuletzt gewählte, sonst Staffelstein
const MY_TEAM = () => QUICK.a;
function tutSetup() {
  const T = G.tut, L = LESSONS[T.i];
  for (const p of G.players) { if (!isGK(p)) { p.off = true; p.tutHold = null; } p.act = null; p.stun = 0; p.d.energy = 1; }
  G.offs = null; G.sp = null; G.pending = null; G.pen = null; G.netHit = null; G.scorer = null; G.cut = null;
  const b = G.ball; Object.assign(b, { owner: null, passTo: null, shot: null, plan: null, kind: '', vx: 0, vy: 0, vz: 0, z: 0, trail: [] });
  for (const g of G.gk) { g.off = false; place(g, ownX(g.team) + atkDir(g.team) * 1, MY); }
  G.phase = 'play'; G.phaseT = 0; T.marks = []; T.reset = 0; T.shotT = 0; T.idleT = 0; b.x = CW / 2; b.y = 4;
  L.setup(T);
  G.camSnap = true;
  showTutBox();
}
function tutEvent(e) { const T = G && G.tut; if (!T) return; const L = LESSONS[T.i]; if (L.on) L.on(T, e); checkTutDone(); showTutBox(); }
function checkTutDone() {
  const T = G.tut, L = LESSONS[T.i];
  if (T.n < L.need || T.done) return;
  T.done = true; T.doneT = 1.6; AU.jingle('goal'); banner('GESCHAFFT!', '#3ddc84', L.t, 1.4, true);
}
function nextLesson() {
  const T = G.tut; T.i++; T.n = 0; T.done = false;
  if (T.i >= LESSONS.length) { store.set(TUT_KEY, true); track('training-fertig'); unlock('training'); hideTutBox(); G.paused = true; G.tut = null; return ACT.tutDone(); }
  tutSetup();
}
// pro Bild: Markierungen, Haltepositionen, Ballverlust, Neustart
// läuft jedes Bild (auch außerhalb des Spielbetriebs): nach einer geschafften Lektion kurz warten, dann weiter
function tutTick(dt) { const T = G.tut; if (T.done) { T.doneT -= dt; if (T.doneT <= 0) nextLesson(); } }
function tutStep(dt) {
  const T = G.tut, L = LESSONS[T.i], b = G.ball;
  if (L.t === 'LAUFEN') {
    const c = G.ctrl; T.marks = T.marks.filter(([x, y]) => { if (dist(c.x, c.y, x, y) < 1.6) { T.n++; AU.select(); showTutBox(); return false; } return true; });
    checkTutDone();
  }
  for (const p of G.players) if (p.tutHold && !p.off && p !== G.ctrl && b.passTo !== p) { p.tx = p.tutHold[0]; p.ty = p.tutHold[1]; p.urg = 0.6; }
  if (G.phase !== 'play' || T.done) return;
  // Ball beim Torwart des Gegners, beim Gegner (außer Abwehr-Lektion) oder liegt lange: neu ansetzen
  if (b.owner && isGK(b.owner) && b.owner.team === 1) T.reset = T.reset || 1;
  if (L.t !== 'ABWEHR' && b.owner && b.owner.team === 1) T.reset = T.reset || 0.8;
  if (L.t === 'ABWEHR' && b.owner && b.owner.team === 0) { tutEvent({ k: 'win' }); }
  if (L.t === 'ABWEHR' && !b.owner && b.lastTeam === 0 && b.kind === 'loose') { tutEvent({ k: 'win' }); b.kind = 'won'; }
  // nach einem Schuss ohne Tor oder wenn der Ball liegen bleibt: neu
  if (b.kind === 'shot' || b.kind === 'parry' || b.kind === 'block') { T.shotT = (T.shotT || 0) + dt; if (T.shotT > 3 && !T.reset) T.reset = 0.3; } else T.shotT = 0;
  if (!b.owner && Math.hypot(b.vx, b.vy) < 0.5) { T.idleT = (T.idleT || 0) + dt; if (T.idleT > 2.5 && !T.reset) T.reset = 0.3; } else T.idleT = 0;
  if (T.reset) { T.reset -= dt; if (T.reset <= 0) tutSetup(); }
}
function tutOut() { if (!G.tut) return false; AU.whistle(1); G.tut.reset = 0.8; G.phase = 'play'; G.ball.vx = G.ball.vy = 0; return true; }
function drawTutMarks() {
  if (!G.tut) return;
  for (const [x, y] of G.tut.marks) {
    const px = sx(x, y), py = sy(y), b = Math.floor(G.t * 4) % 2;
    ctx.fillStyle = '#000'; ctx.fillRect(px - 9, py - 3, 19, 7); ctx.fillStyle = '#ffd200'; ctx.fillRect(px - 8 - b, py - 2, 17 + b * 2, 5);
    ctx.fillStyle = '#ffd200'; ctx.fillRect(px - 1, py - 22, 3, 20); ctx.fillStyle = '#e30613'; ctx.fillRect(px + 2, py - 22, 6, 4);
  }
}
const tutBox = document.getElementById('tut');
function showTutBox() {
  const T = G && G.tut; if (!T) return hideTutBox();
  const L = LESSONS[T.i]; if (!L) return;
  tutBox.innerHTML = `<b>TRAINING ${T.i + 1}/${LESSONS.length}: ${L.t} · ${Math.min(T.n, L.need)}/${L.need}</b><span>${esc(L.txt(tutKeys()))}</span><button data-t="skip">ÜBERSPRINGEN</button><button data-t="end">BEENDEN</button>`;
  tutBox.hidden = false;
  tutBox.querySelectorAll('button').forEach(bt => bt.addEventListener('click', e => { e.stopPropagation(); AU.init(); if (bt.dataset.t === 'skip') { G.tut.done = false; nextLesson(); } else { hideTutBox(); ACT.toMain(); } }));
}
function hideTutBox() { tutBox.hidden = true; tutBox.innerHTML = ''; }
Object.assign(ACT, {
  training() { hideMenu(); startTraining(0); },
  tutDone() {
    show(`<div class="panel narrow"><h2>TRAINING GESCHAFFT!</h2><p>Du kennst jetzt Pass, Steilpass, Flanke, Schuss, Kopfball, Zweikampf und Standards. Der Trainer ist zufrieden – fast.</p>
      <p class="muted">Tipp: F (Gamepad LB) ist der Haken, Q öffnet Taktik & Wechsel.</p>
      <div class="row"><button class="main" data-act="quick" autofocus>FREUNDSCHAFTSSPIEL</button><button data-act="career">SAISON</button><button data-act="toMain">HAUPTMENÜ</button></div></div>`, { back: ACT.toMain });
  },
});
