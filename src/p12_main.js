// ================= Touch, Hauptschleife, Start =================
if (TOUCHDEV) document.body.classList.add('touch');
fitView(); addEventListener('resize', fitView); addEventListener('orientationchange', () => setTimeout(fitView, 250));
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
const buzz = ms => { if (TOUCHDEV && LASTIN === 'touch' && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };
const attacking = () => !!(G && G.human >= 0 && G.ball.owner && G.ball.owner.team === G.human);
// Tippen aufs Spielfeld: Mitspieler = Pass zu ihm, in der Abwehr = Wechsel zu diesem Spieler
function tapAt(cx0, cy0) {
  if (!G || G.demo || !menu.hidden) return;
  if (G.phase === 'intro' || G.phase === 'replay') { KEYP.Enter = true; IN.any = true; return; }
  if (G.watch) { joinGame(); return; }
  const r = cv.getBoundingClientRect(); if (cx0 < r.left || cx0 > r.right || cy0 < r.top || cy0 > r.bottom) return;
  const cx = (cx0 - r.left) * W / r.width, cy = (cy0 - r.top) * H / r.height, me = G.human; if (me < 0) return;
  let hit = null, hd = 1e9;
  for (const p of G.players) { if (p.off || p.team !== me) continue; const px = sx(p.x, p.y), py = sy(p.y, p.z) - 14, d = Math.hypot((cx - px) * 1.2, cy - py); if (Math.abs(cx - px) < 14 && Math.abs(cy - py) < 22 && d < hd) { hd = d; hit = p; } }
  if (!hit) return;
  const c = G.ctrl, own = G.ball.owner;
  if (own && own === c && c.team === me && hit !== c) {
    if (G.phase === 'play' && !isGK(c)) { pass(c, hit); buzz(12); }
    else if (G.phase === 'play' && isGK(c)) { gkThrow(c, hit); buzz(12); }
    else if (G.sp && G.sp.taker === c && G.sp.type !== 'pen') { pass(c, hit); buzz(12); }
    return;
  }
  if (G.phase === 'play' && !attacking() && !isGK(hit)) { G.ctrl = hit; G.manT = G.t; AU.select(); buzz(8); }
}
(() => {
  const zone = document.getElementById('zone'), st = document.getElementById('stick'), kn = document.getElementById('knob'), pend = new Map();
  let sid = null, sx0 = 0, sy0 = 0;
  const R = () => 46;
  const rest = () => { st.style.left = ''; st.style.top = ''; st.classList.remove('act', 'sprint'); kn.style.transform = ''; TOUCH.x = TOUCH.y = 0; TOUCH.s = false; };
  const move = e => {
    const r = R(); let dx = e.clientX - sx0, dy = e.clientY - sy0, m = Math.hypot(dx, dy);
    if (m > r * 2) { const f = (m - r * 2) / m; sx0 += dx * f; sy0 += dy * f; dx -= dx * f; dy -= dy * f; m = r * 2; st.style.left = sx0 + 'px'; st.style.top = sy0 + 'px'; }
    const k = Math.min(1, r / (m || 1)); TOUCH.x = dx * k / r; TOUCH.y = dy * k / r; TOUCH.s = m > r * 1.15;
    st.classList.toggle('sprint', TOUCH.s); kn.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  };
  zone.addEventListener('pointerdown', e => { AU.init(); setInput('touch'); zone.setPointerCapture(e.pointerId); pend.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), left: e.clientX < innerWidth * 0.5 }); });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId === sid) return move(e);
    const p = pend.get(e.pointerId); if (!p) return;
    if (p.left && sid === null && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { sid = e.pointerId; sx0 = p.x; sy0 = p.y; st.style.left = p.x + 'px'; st.style.top = p.y + 'px'; st.classList.add('act'); pend.delete(e.pointerId); move(e); }
  });
  const end = e => {
    if (e.pointerId === sid) { sid = null; rest(); return; }
    const p = pend.get(e.pointerId); pend.delete(e.pointerId);
    if (e.type === 'pointerup' && p && performance.now() - p.t < 380 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 16) tapAt(e.clientX, e.clientY);
  };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  // PASS: kurz = Pass, lang = Steilpass · SCHUSS: halten lädt auf · HOCH: Flanke oder hoher Ball (Abwehr: Tackling)
  document.querySelectorAll('.tb').forEach(b => {
    const k = b.dataset.k; let holdT = null, held = false;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); AU.init(); setInput('touch'); b.classList.add('on'); held = false;
      if (G && (G.phase === 'intro' || G.phase === 'replay')) { KEYP.Enter = true; return; }
      if (k === 'a') { if (attacking() || (G && G.sp && isHumanTeam(G.sp.team))) holdT = setTimeout(() => { holdT = null; held = true; TOUCH.pulseK = 1; b.classList.add('lob'); buzz(20); }, 380); else TOUCH.pulseA = 1; }
      else if (k === 'c') TOUCH.pulseC = 1;
      else TOUCH.b = true;
    });
    const rel = () => {
      b.classList.remove('on', 'lob');
      if (k === 'a') { if (holdT) { clearTimeout(holdT); holdT = null; if (!held && (attacking() || (G && G.sp && isHumanTeam(G.sp.team)))) TOUCH.pulseA = 1; } }
      else if (k === 'b') TOUCH.b = false;
    };
    b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel);
  });
})();
const TBL = { a: document.querySelector('.tb-a'), b: document.querySelector('.tb-b'), c: document.querySelector('.tb-c') }; let tbMode = '';
function updateTouchLabels() {
  if (!TOUCHDEV || !G || G.demo) return;
  const m = attacking() || (G.sp && isHumanTeam(G.sp.team)) ? 'att' : 'def'; if (m === tbMode) return; tbMode = m;
  const L = m === 'att' ? ['PASS', 'SCHUSS', 'HOCH'] : ['WECHSEL', 'GRÄTSCHE', 'TACKLING'];
  TBL.a.textContent = L[0]; TBL.b.textContent = L[1]; TBL.c.textContent = L[2];
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

let lastT = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(1 / 30, (now - lastT) / 1000)); lastT = now;
  readInput(dt); menuPad(); updateTouchLabels();
  document.body.classList.toggle('ingame', !!(G && !G.demo));
  if (G && !G.paused) gameTick(dt);
  updateWatchBar();
  if (G) render();
  requestAnimationFrame(frame);
}
startDemo();
ACT.title();
(document.fonts && document.fonts.load ? Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('8px "Press Start 2P"', 'ÄÖÜß')]) : Promise.resolve()).then(() => { if (G) buildPitch(PITCH.home || G.T[0], G.kits[0], G.kits[1], G.event, G.wx); }).catch(() => { });
requestAnimationFrame(frame);
