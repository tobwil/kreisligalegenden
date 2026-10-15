// ================= Touch, Hauptschleife, Start =================
if (TOUCHDEV) document.body.classList.add('touch');
fitView(); addEventListener('resize', fitView); addEventListener('orientationchange', () => setTimeout(fitView, 250));
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// iOS zoomt trotz user-scalable=no manchmal hinein (Doppeltipp, Bedienungshilfen): Zoom sofort zurücksetzen (wie bei Hallen-Legenden)
if (window.visualViewport) visualViewport.addEventListener('resize', () => {
  const vp = document.getElementById('vp'); if (!vp || visualViewport.scale <= 1.01) return;
  const c = vp.content; vp.content = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  setTimeout(() => { vp.content = c; }, 300);
});
const buzz = ms => { if (TOUCHDEV && LASTIN === 'touch' && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };
const attacking = () => !!(G && G.human >= 0 && (G.ball.owner ? G.ball.owner.team === G.human : G.ball.passTo && G.ball.passTo.team === G.human));   // eigener Pass unterwegs zählt als Angriff
// Tippen aufs Spielfeld: Mitspieler = Pass zu ihm, in der Abwehr = Wechsel zu diesem Spieler
function tapAt(cx0, cy0) {
  if (!G || G.demo || !menu.hidden) return;
  if (G.phase === 'intro' || G.phase === 'replay') { KEYP.Enter = true; IN.any = true; return; }
  if (G.watch) { joinGame(); return; }
  const r = cv.getBoundingClientRect(); if (cx0 < r.left || cx0 > r.right || cy0 < r.top || cy0 > r.bottom) return;
  const cx = (cx0 - r.left) * W / r.width, cy = (cy0 - r.top) * H / r.height, me = G.human; if (me < 0) return;
  let hit = null, hd = 1e9;
  for (const p of G.players) { if (p.off || (p.team !== me && attacking())) continue; const px = sx(p.x, p.y), py = sy(p.y, p.z) - 14, d = Math.hypot((cx - px) * 1.2, cy - py); if (Math.abs(cx - px) < 14 && Math.abs(cy - py) < 22 && d < hd) { hd = d; hit = p; } }
  if (!hit) return;
  const c = G.ctrl, own = G.ball.owner;
  // Abwehr: Gegner antippen = dein Spieler, der ihm am nächsten ist
  if (hit.team !== me) { if (G.phase === 'play' && !isGK(hit)) { const n = nearestTo(me, hit.x, hit.y); if (n) { G.ctrl = n; G.manT = G.t; AU.select(); buzz(8); } } return; }
  // eigenen Ballführer antippen = Haken (Richtung vom Stick)
  if (own === c && hit === c && G.phase === 'play' && !isGK(c)) { trick(c, 0, 0); buzz(12); return; }   // eigenen Spieler antippen = Übersteiger
  if (own && own === c && c.team === me && hit !== c) {
    if (G.phase === 'play' && !isGK(c)) { pass(c, hit); buzz(12); }
    else if (G.phase === 'play' && isGK(c)) { gkThrow(c, hit); buzz(12); }
    else if (G.sp && G.sp.taker === c && G.sp.type !== 'pen') { pass(c, hit); buzz(12); }
    return;
  }
  if (G.phase === 'play' && !attacking() && !isGK(hit)) { G.ctrl = hit; G.manT = G.t; AU.select(); buzz(8); }
}
// Tricks am Handy über den Bewegungs-Stick, der Daumen bleibt dabei im Fluss:
//   Stick einmal kreisen = Drehung · Stick schnell in die Gegenrichtung schnippen = Trick in die neue Richtung
//   (zurück = Zurückziehen, zur Seite = Haken, nach vorn = Tempo) · links doppelt antippen = Übersteiger,
//   doppelt antippen und gleich ziehen = Trick in die Zugrichtung
const STG = { acc: 0, t0: 0, la: null, hold: null, minM: 1, lastTap: 0 };
const canTrick = () => !!(G && G.phase === 'play' && !G.pl && G.ctrl && G.ball.owner === G.ctrl && !isGK(G.ctrl) && attacking());
function touchTrick(x, y, kind) { if (!canTrick()) return false; TOUCH.fdir = { x, y, kind }; TOUCH.pulseF = 1; buzz(14); STG.acc = 0; STG.la = null; STG.hold = null; return true; }
function stickGesture(x, y, now) {
  const m = Math.hypot(x, y), S = STG;
  if (m < 0.45) { S.la = null; S.acc = 0; S.minM = Math.min(S.minM, m); return; }
  // Kreisen: Winkel aufsummieren, solange der Daumen außen bleibt und gleichmäßig in eine Richtung läuft
  const a = Math.atan2(y, x);
  if (S.la === null || now - S.t0 > 1200) { S.la = a; S.acc = 0; S.t0 = now; }
  else { let d = a - S.la; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; S.la = a;
    if (Math.abs(d) > 1.2 || (S.acc && Math.sign(d) !== Math.sign(S.acc) && Math.abs(d) > 0.08)) { S.acc = 0; S.t0 = now; } else S.acc += d;
    if (Math.abs(S.acc) > Math.PI * 1.75 && touchTrick(x / m, y / m, 'drehung')) return; }
  // Schnippen: eben noch kräftig in eine Richtung, über die Mitte, jetzt kräftig in die Gegenrichtung
  if (m > 0.7) {
    const H = S.hold;
    if (H && now - H.t < 240 && S.minM < 0.45 && (x * H.x + y * H.y) / m < -0.45 && G && G.ctrl && opps(G.ctrl).some(o => !isGK(o) && dist(o.x, o.y, G.ctrl.x, G.ctrl.y) < 5) && touchTrick(x / m, y / m)) return;
    S.hold = { x: x / m, y: y / m, t: now }; S.minM = 1;
  }
}
(() => {
  const zone = document.getElementById('zone'), st = document.getElementById('stick'), kn = document.getElementById('knob'), pend = new Map();
  let sid = null, sx0 = 0, sy0 = 0, dblT = null;
  const R = () => 46;
  const rest = () => { st.style.left = ''; st.style.top = ''; st.classList.remove('act', 'sprint'); kn.style.transform = ''; TOUCH.x = TOUCH.y = 0; TOUCH.s = false; };
  const move = e => {
    const r = R(); let dx = e.clientX - sx0, dy = e.clientY - sy0, m = Math.hypot(dx, dy);
    if (m > r * 2) { const f = (m - r * 2) / m; sx0 += dx * f; sy0 += dy * f; dx -= dx * f; dy -= dy * f; m = r * 2; st.style.left = sx0 + 'px'; st.style.top = sy0 + 'px'; }
    const k = Math.min(1, r / (m || 1)); TOUCH.x = dx * k / r; TOUCH.y = dy * k / r; TOUCH.s = m > r * 1.15;
    st.classList.toggle('sprint', TOUCH.s); kn.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    stickGesture(TOUCH.x, TOUCH.y, performance.now());
  };
  zone.addEventListener('pointerdown', e => {
    AU.init(); setInput('touch'); try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    const now = performance.now(), left = e.clientX < innerWidth * 0.5, dbl = left && sid === null && now - STG.lastTap < 330 && canTrick();
    pend.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now, left, dbl });
    STG.hold = null; STG.la = null; STG.acc = 0; STG.minM = 1;
    // Doppeltipp: kurz abwarten, ob der Daumen gleich zieht (dann Trick in diese Richtung), sonst Übersteiger
    if (dbl) { STG.lastTap = 0; clearTimeout(dblT); dblT = setTimeout(() => { dblT = null; const mm = Math.hypot(TOUCH.x, TOUCH.y); touchTrick(mm > 0.45 ? TOUCH.x : 0, mm > 0.45 ? TOUCH.y : 0); }, 140); }
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId === sid) return move(e);
    const p = pend.get(e.pointerId); if (!p) return;
    if (p.left && sid === null && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { sid = e.pointerId; sx0 = p.x; sy0 = p.y; st.style.left = p.x + 'px'; st.style.top = p.y + 'px'; st.classList.add('act'); pend.delete(e.pointerId); move(e); }
  });
  const end = e => {
    if (e.pointerId === sid) { sid = null; rest(); return; }
    const p = pend.get(e.pointerId); pend.delete(e.pointerId);
    if (e.type !== 'pointerup' || !p) return;
    const ddx = e.clientX - p.x, ddy = e.clientY - p.y, dur = performance.now() - p.t, dd = Math.hypot(ddx, ddy);
    if (p.dbl) { if (dblT) { clearTimeout(dblT); dblT = null; touchTrick(0, 0); } return; }   // Doppeltipp ohne Ziehen = Übersteiger
    if (dur < 380 && dd < 16) { tapAt(e.clientX, e.clientY); if (p.left && dur < 260) STG.lastTap = performance.now(); }
  };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  // Zwei Knöpfe, kein Suchen: antippen = Hauptaktion, gedrückt halten und ziehen (egal wohin) = zweite Aktion
  //   Angriff  PASS:   tippen = kurzer Pass · halten = fester und weiter (Balken) · wischen = Steilpass · nach oben wischen = hoch/Flanke
  //            SCHUSS: halten lädt auf, loslassen schießt · beim Aufladen ziehen = Zielkreuz im Tor schieben (wie bei Padel-Legenden),
  //                    das Spiel läuft dabei kurz in Zeitlupe; leicht in die Ecke = Schlenzer, leicht gegen einen herausgelaufenen Torwart = Heber
  //   Abwehr   WECHSEL: tippen = Spieler wechseln · halten = ein Mitspieler presst mit
  //            TACKLING: tippen = Tackling · ziehen = Grätsche (Richtung vom Stick)
  const DRAG = 26;
  const passPow = () => TOUCH.passT ? clamp((performance.now() - TOUCH.passT - 120) / 650, 0, 1) : 0;
  document.querySelectorAll('.tb[data-k]').forEach(b => {
    const k = b.dataset.k; let holdT = null, st = null;
    const alt = lbl => { b.classList.add('alt'); b.querySelector('span').textContent = lbl; buzz(15); };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); AU.init(); setInput('touch'); b.classList.add('on');
      if (G && (G.phase === 'intro' || G.phase === 'replay')) { KEYP.Enter = true; st = null; return; }
      const att = attacking() || !!(G && G.sp && isHumanTeam(G.sp.team));
      st = { x: e.clientX, y: e.clientY, att, done: false };
      if (k === 'a') {
        if (att) TOUCH.passT = performance.now();
        else { TOUCH.pulseA = 1; holdT = setTimeout(() => { holdT = null; if (st && !st.done) { TOUCH.k = true; alt('DRUCK'); } }, 260); }
      } else if (att) TOUCH.b = true;
    });
    b.addEventListener('pointermove', e => {
      if (!st || st.done) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.hypot(dx, dy) < (k === 'b' && st.att ? (TOUCH.aim ? 0 : 14) : DRAG)) return;
      if (k === 'a') { if (!st.att || Math.hypot(dx, dy) < 40) return; st.done = true; TOUCH.passT = 0; const up = dy < -Math.abs(dx) * 0.8; if (up) TOUCH.pulseC = 1; else TOUCH.pulseK = 1; alt(up ? 'HOCH' : 'STEIL'); }
      else if (st.att) { if (!TOUCH.b) return; if (!TOUCH.aim) { b.classList.add('aim'); buzz(10); } TOUCH.aim = { dx, dy }; return; }
      else { st.done = true; TOUCH.pulseC = 1; alt('GRÄTSCHE'); }
    });
    const rel = () => {
      if (holdT) { clearTimeout(holdT); holdT = null; }
      if (st && !st.done) { if (k === 'a' && st.att) { TOUCH.pow = passPow(); TOUCH.pulseA = 1; } else if (k === 'b' && !st.att) TOUCH.pulseB = 1; }
      if (k === 'a') TOUCH.passT = 0;
      if (k === 'b') { TOUCH.b = false; if (TOUCH.aim) { TOUCH.aimLast = TOUCH.aim; TOUCH.aim = null; } } if (k === 'a') TOUCH.k = false;
      st = null; b.classList.remove('on', 'lob', 'alt', 'aim'); tbMode = ''; updateTouchLabels();
    };
    b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel);
  });
})();
const TBL = { a: document.querySelector('.tb-a'), b: document.querySelector('.tb-b') }; let tbMode = '';
function updateTouchLabels() {
  if (!TOUCHDEV || !G || G.demo) return;
  if (TBL.a.classList.contains('on') || TBL.b.classList.contains('on')) return;   // während des Drückens nicht umbeschriften
  const m = attacking() || (G.sp && isHumanTeam(G.sp.team)) ? 'att' : 'def'; if (m === tbMode) return; tbMode = m;
  const L = m === 'att' ? [['PASS', 'halten: weiter'], ['SCHUSS', 'ziehen: zielen']] : [['WECHSEL', 'halten: Druck'], ['TACKLING', 'ziehen: Grätsche']];
  for (const [i, el] of [TBL.a, TBL.b].entries()) { el.querySelector('span').textContent = L[i][0]; el.querySelector('small').textContent = L[i][1]; }
}
addEventListener('pointerdown', () => AU.init());
document.getElementById('tbPause').addEventListener('pointerdown', e => { e.preventDefault(); AU.init(); if (!menu.hidden) menuBack(); else togglePause(); });
document.getElementById('rotOk').addEventListener('click', () => document.body.classList.add('portraitok'));
// Gamepad im Menü: Steuerkreuz/Stick navigiert, A bestätigt, B zurück
const PADM = {};
function menuPad() {
  if (!navigator.getGamepads) return;
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const st = { up: bt(12) || ay < -0.6, down: bt(13) || ay > 0.6, left: bt(14) || ax < -0.6, right: bt(15) || ax > 0.6, a: bt(0), b: bt(1) }, now = performance.now();
    if (menu.hidden) { for (const k in st) PADM[k] = st[k] ? Infinity : false; return; }
    for (const k in st) {
      if (!st[k]) { PADM[k] = false; continue; }
      if (PADM[k] && now < PADM[k]) continue;
      PADM[k] = now + (PADM[k] ? 120 : 350);
      const el = document.activeElement;
      if (k === 'a') { if (el && menu.contains(el)) el.click(); }
      else if (k === 'b') menuBack();
      else if (el && el.type === 'range' && (k === 'left' || k === 'right')) { if (k === 'left') el.stepDown(); else el.stepUp(); el.dispatchEvent(new Event('input', { bubbles: true })); }
      else menuMove(k);
    }
    break;
  }
}
addEventListener('keydown', e => { if (!menu.hidden && menu.querySelector('.press') && document.activeElement?.tagName !== 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); AU.init(); ACT.main(); } });
cv.addEventListener('pointerdown', () => { if (G && !G.demo && (G.phase === 'intro' || G.phase === 'replay')) KEYP.Enter = true; });
function updateWatchBar() {
  const on = !!(G && G.watch && !G.demo && menu.hidden);
  document.body.classList.toggle('watching', on);
  if (on) { const b = document.querySelector('#watchbar [data-w="ff"]'); if (b) b.textContent = `TEMPO ${G.ff || 1}×`; }
}
document.querySelectorAll('#watchbar button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (!G) return; if (b.dataset.w === 'join') joinGame(); else G.ff = G.ff === 1 ? 2 : G.ff === 2 ? 4 : 1; }));
addEventListener('keydown', e => { if (e.code === 'KeyF' && G && G.watch && menu.hidden) G.ff = G.ff === 1 ? 2 : G.ff === 2 ? 4 : 1; });

// Touch-Tipp in den ersten zwei Spielen auf dem Handy (wie bei Hallen- und Padel-Legenden): Spiel hält an, bis man tippt.
// Statt eines Textblocks stehen die Erklärungen direkt neben dem Stick und den beiden Knöpfen.
let TTIP = null, tipG = null;
function closeTouchTip() { if (!TTIP) return false; TTIP.remove(); TTIP = null; document.body.classList.remove('tipon'); clearEdges(); if (G && menu.hidden) G.paused = false; return true; }
function touchTip() {
  if (!TOUCHDEV || !G || G.demo || G.watch || G.tut || G === tipG || G.phase !== 'kickoff' || !menu.hidden) return;
  tipG = G; if (LASTIN !== 'touch') return;
  const n = store.get('krl_touchtip', 0); if (n >= 2) return; store.set('krl_touchtip', n + 1);
  const el = document.createElement('div'); el.id = 'ttip'; el.className = 'cm'; el.setAttribute('role', 'dialog');
  const R = s => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); }, st = R('#stick'), ra = R('.tb-a'), rb = R('.tb-b'), vw = innerWidth, vh = innerHeight;
  const lab = (css, h, t) => `<div class="lab" style="${css}"><b>${h}</b>${t}</div>`;
  // die Knöpfe sind je nach Ballbesitz beschriftet: Beschriftung passend dazu, die andere Hälfte steht oben
  const att = attacking() || !!(G.sp && isHumanTeam(G.sp.team));
  const A = att ? ['PASS', 'tippen = kurz · halten = weiter<br>wischen = Steilpass<br>nach oben wischen = hoch'] : ['WECHSEL', 'tippen = anderer Spieler<br>halten = Mitspieler presst mit'];
  const B = att ? ['SCHUSS', 'halten = Kraft<br>dabei ziehen = zielen'] : ['TACKLING', 'tippen = Tackling<br>ziehen = Grätsche'];
  const top = att ? 'Ohne Ball werden die Knöpfe zu <b>WECHSEL</b> und <b>TACKLING</b> (ziehen = Grätsche). Gegner antippen = zu ihm wechseln.'
    : 'Mit Ball werden die Knöpfe zu <b>PASS</b> (halten = weiter, wischen = steil) und <b>SCHUSS</b> (halten = Kraft, dabei ziehen = zielen).';
  el.innerHTML = `<div class="cmtop"><b>SO SPIELST DU AUF DEM HANDY</b><span>${top}</span><button>LOS GEHT'S</button></div>`
    + (st ? lab(`left:${Math.max(8, st.left)}px;bottom:${vh - st.top + 10}px`, 'LAUFEN – LINKER DAUMEN', 'irgendwo links aufsetzen und ziehen<br>weit ziehen = Sprint<br>mit Ball: Stick kreisen = Trick') : '')
    + (ra ? lab(`right:${vw - ra.left + 10}px;bottom:${vh - ra.bottom + 4}px`, A[0], A[1]) : '')
    + (rb ? lab(`right:${vw - rb.right}px;bottom:${vh - rb.top + 10}px`, B[0], B[1]) : '');
  const t0 = performance.now();
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (performance.now() - t0 > 450) closeTouchTip(); });   // tippen irgendwo = weiter
  document.body.appendChild(el); document.body.classList.add('tipon'); TTIP = el; G.paused = true;
}
const BTN_SCALE = { s: 0.82, m: 1, l: 1.18 };
function applyBtnSize() { document.getElementById('pad').style.setProperty('--tbs', BTN_SCALE[SETTINGS.btn] || 1); }
applyBtnSize();
// Neue Version? Handys halten einen offenen Tab tagelang am Leben und zeigen dann den alten Stand. Kommt die Seite nach einer Weile
// wieder in den Vordergrund (oder das Hauptmenü öffnet sich), fragen wir leise nach der aktuellen Kennung und bieten NEU LADEN an.
let VCHK = 0, NEWVER = false;
function checkVersion() {
  if (NEWVER || !ON_WEB || location.protocol === 'file:' || performance.now() - VCHK < 10 * 60e3 && VCHK) return;
  VCHK = performance.now();
  fetch(location.pathname, { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
    const m = t.match(/const BUILD = '(\d+)'/); if (!m || m[1] === BUILD) return;
    NEWVER = true; if (G && !G.demo) saveMatch();
    const el = document.createElement('div'); el.id = 'newver';
    el.innerHTML = '<span>Es gibt eine neue Version von Kreisliga-Legenden.</span><button>NEU LADEN</button>';
    el.querySelector('button').addEventListener('click', () => { if (G && !G.demo) saveMatch(); location.reload(); });
    document.body.appendChild(el);
  }).catch(() => { });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
// Zurück-Geste und Zurück-Taste (Android, Browser): im Spiel = Pause, im Menü = eine Ebene zurück, statt die Seite zu verlassen.
// Nur auf dem Titelbild verlässt Zurück das Spiel. Der Merker im Verlauf wird erst bei einer Eingabe gesetzt (sonst überspringt Chrome ihn).
if (ON_WEB && history.pushState) {
  const arm = () => { if (!(history.state && history.state.krl)) try { history.pushState({ krl: 1 }, ''); } catch (e) { } };
  addEventListener('pointerdown', arm, true); addEventListener('keydown', arm, true);
  addEventListener('popstate', () => {
    if (!menu.hidden && menu.querySelector('.title .press')) { history.back(); return; }   // Titelbild: wirklich zurück
    if (closeTouchTip()) return;
    if (menu.hidden && G && !G.demo) togglePause(); else menuBack();
  });
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(1 / 30, (now - lastT) / 1000)); lastT = now;
  readInput(dt); readSlots(dt); menuPad(); updateTouchLabels(); touchTip();
  if (TTIP && (IN.pa || IN.pb)) closeTouchTip();
  document.body.classList.toggle('ingame', !!(G && !G.demo));
  document.body.classList.toggle('cut', !!(G && !G.demo && (G.phase === 'intro' || G.phase === 'replay')));
  if (G && !G.paused) gameTick(dt);
  updateWatchBar();
  if (G) render();
  requestAnimationFrame(frame);
}
startDemo();
ACT.title();
(document.fonts && document.fonts.load ? Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('8px "Press Start 2P"', 'ÄÖÜß')]) : Promise.resolve()).then(() => { if (G) buildPitch(PITCH.home || G.T[0], G.kits[0], G.kits[1], G.event, G.wx); }).catch(() => { });
requestAnimationFrame(frame);
