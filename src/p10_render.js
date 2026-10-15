// ================= Darstellung: Kamera, Szene, TV-Grafik =================
// Kamera wie im Fernsehen: schwenkt mit dem Ball (mit Vorlauf in Spielrichtung) und neigt sich etwas, wenn der Ball nach vorn kommt
function camTarget() {
  const b = G.ball;
  let x = b.x, y = b.y;
  if (b.owner && G.phase === 'play') {
    let lead = atkDir(b.owner.team) * 5;
    // Touch: nahe einem Tor zeigt der Vorlauf immer zu diesem Tor, sonst bliebe es unter den Knöpfen (wie bei Hallen-Legenden)
    if (touchPad()) lead = lerp(lead, Math.sign(b.x - CW / 2) * 5, clamp((Math.abs(b.x - CW / 2) - 22) / 12, 0, 1));
    x += lead + b.owner.vx * 0.3;
  } else if (!b.owner) x += b.vx * 0.25;
  if (G.phase === 'goal' && G.scorer) { x = lerp(b.x, G.scorer.x, 0.5); y = G.scorer.y; }
  const [lo, hi] = camLimits();
  return [clamp(x, lo, hi), y];
}
// Kamera-Anschlag: am Desktop wie im Fernsehen kurz hinter der Torlinie. Auf dem Handy darf die Kamera so weit über das Spielfeld
// hinaus schwenken, dass beide Tore samt Netz neben den Knöpfen (rechts) und dem Stick (links) liegen; gemessen an den echten Knöpfen.
const touchPad = () => TOUCHDEV && document.body.classList.contains('touch') && document.body.classList.contains('ingame');
let CAMLIM = { key: '' };
for (const ev of ['resize', 'orientationchange']) addEventListener(ev, () => { CAMLIM = { key: '' }; });
function camLimits() {
  const lo = VIEW_HALF - 6, hi = CW - VIEW_HALF + 6;
  if (!touchPad()) return [lo, hi];
  const key = `${W}|${innerWidth}|${innerHeight}|${Math.round(CAMY / 8)}|${SETTINGS.btn}`;
  if (CAMLIM.key === key && performance.now() - CAMLIM.t < 1000) return CAMLIM.v;
  const pad = document.getElementById('pad'), cr = cv.getBoundingClientRect();
  if (!pad || !pad.getBoundingClientRect().width || !cr.width) return [lo, hi];
  const k = cr.width / W, kk = kOf(GY2), M = 6, back = NET_D + 0.6;
  const top = cr.top + sy(GY1, GH + 0.6) * k, bot = cr.top + sy(GY2) * k;              // Tor auf dem Bildschirm, Latte bis Boden
  const onGoal = q => q.width && q.bottom > top && q.top < bot;
  const btn = [...pad.querySelectorAll('.tb[data-k]')].map(e => e.getBoundingClientRect()).filter(onGoal), st = document.getElementById('stick').getBoundingClientRect();
  let l = lo, h = hi;
  if (btn.length) { const T = (Math.min(...btn.map(q => q.left)) - cr.left) / k - M; h = Math.max(hi, CW + back - (T - W / 2) / (PX * kk)); }
  if (onGoal(st)) { const T = (st.right - cr.left) / k + M; l = Math.min(lo, -back - (T - W / 2) / (PX * kk)); }
  CAMLIM = { key, t: performance.now(), v: [l, h] };
  return CAMLIM.v;
}
function render() {
  const now = performance.now(), dt = Math.min(0.05, (now - (G.lastR || now)) / 1000); G.lastR = now;
  const [tx, ty] = G.phase === 'replay' && G.replay ? [clamp(G.ball.x, ...camLimits()), G.ball.y] : camTarget();
  const k = Math.min(1, dt * (G.phase === 'replay' ? 5 : 2.6));
  if (G.camSnap) { G.cam.x = tx; G.cam.y = ty; G.camSnap = false; }
  G.cam.x = lerp(G.cam.x, tx, k); G.cam.y = lerp(G.cam.y, ty, Math.min(1, dt * 1.8));
  CAMX = G.cam.x + (G.shake > 0 ? rnd(-1, 1) * G.shake * 0.4 : 0);
  CAMY = CAMY_MAX * clamp((G.cam.y - 12) / (CH - 22), 0, 1);
  // Zielansicht hinter dem Ball bei Freistoß und Elfmeter (p17), danach zurück zur TV-Kamera
  if (G.aimFly) { G.aimFly.t += dt; if (G.aimFly.t > 1.6 || (G.ball.owner && G.aimFly.t > 0.4)) { G.aimFly = null; G.camSnap = true; } }
  if (!G.aimFly && !aimWanted()) G.aimCam = null;
  if (G.phase !== 'replay' && aimViewOn()) { drawAimView(); if (!G.demo) drawHUD(true); return; }
  const t = G.t, excite = G.excite > 1.2 ? 2 : G.excite > 0.4 ? 1 : 0;
  drawBack(t, excite);
  drawPitch();
  drawTutMarks();
  const items = [];
  const showSel = !G.demo && G.human >= 0 && !G.watch && G.phase !== 'replay';
  for (const p of G.players) if (!p.off) items.push({ y: p.y, draw: () => drawPlayerAt(p, showSel && p === G.ctrl ? (G.ball.owner === p ? '#ffc83a' : '#7cf2ff') : false) });
  for (const side of [0, 1]) { items.push({ y: GY1 - 0.05, draw: () => drawGoalBack(side) }); items.push({ y: GY2 + 0.05, draw: () => drawGoalFront(side) }); }
  for (const [x, y] of [[0, 0], [CW, 0], [0, CH], [CW, CH]]) items.push({ y, draw: () => drawCornerFlag(x, y, t) });
  items.push(...officialsItems(dt), ...benchItems());
  const dog = dogItem(dt); if (dog) items.push(dog);
  const b = G.ball;
  let by = b.y; if (b.owner && !isGK(b.owner)) by = b.owner.y + (b.owner.hy > 0 ? 0.05 : -0.05); if (b.owner && isGK(b.owner)) by = b.owner.y + 0.05;
  items.push({ y: by, draw: () => drawBall(b) });
  if (!G.demo && G.human >= 0 && !G.watch && G.phase === 'play') drawLanding();
  items.sort((a, c) => a.y - c.y).forEach(i => i.draw());
  drawParts();
  if (PITCH.wet) drawRain(t);
  if (G.phase === 'replay') { drawReplayOverlay(); return; }
  if (!G.demo) drawHUD();
  else if (menu.hidden) text('DEMO', 8, 8, '#9b90ad', 8);
}
// hoher Ball: gelber Ring dort, wo er in Kopfhöhe ankommt (Flanke, Ecke, Abschlag), damit man hinlaufen und köpfen kann
function drawLanding() {
  const b = G.ball; if (b.owner || b.shot || b.z < 1.2 || !['cross', 'lob', 'clear', 'punt', 'head', 'parry', 'loose'].includes(b.kind)) return;
  let q = null; for (const p of ballPath()) if (p.z < 2.4 && p.t > 0.15 && (q = p)) break;
  if (!q || q.x < 0 || q.x > CW || q.y < 0 || q.y > CH) return;
  const x = sx(q.x, q.y), y = sy(q.y), r = 5 + Math.round(Math.min(q.t, 1) * 4), k = (Math.floor(G.t * 6) % 2) ? '#ffc83a' : '#fff1a8';
  ctx.globalAlpha = 0.85; ctx.strokeStyle = k; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
}
function drawRain(t) {
  ctx.fillStyle = 'rgba(205,222,255,0.5)';
  for (let i = 0; i < 150; i++) { const x = ((i * 97 + t * 260) % (W + 40)) - 20, y = ((i * 53 + t * 520) % (H + 20)) - 10; ctx.fillRect(Math.round(x), Math.round(y), 1, 5); }
}
function text(s, x, y, col = '#f3ead6', size = 8, align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1); }
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
const minuteTxt = () => G.so ? 'n.E.' : G.phase === 'intro' ? "0'" : `${minuteOf()}'${G.clock > halfLen() && G.added ? '+' : ''}`;
function drawHUD(lite) {
  // Anzeigetafel oben links
  const x0 = 6, y0 = 6;
  ctx.fillStyle = 'rgba(3,5,16,0.88)'; ctx.fillRect(x0, y0, 176, 18);
  for (const t of [0, 1]) {
    const x = x0 + 2 + t * 70, k = G.kits[t];
    ctx.fillStyle = k.c1; ctx.fillRect(x, y0 + 2, 32, 14); ctx.fillStyle = k.c2; ctx.fillRect(x, y0 + 13, 32, 3);
    text(G.T[t].k, x + 16, y0 + 5, lum(k.c1) > 0.6 ? '#1a1205' : '#ffffff', 8, 'center', false);
    text(String(G.score[t]), x + 49, y0 + 4, '#ffffff', 10, 'center');
    for (let i = 0; i < G.stats.red[t]; i++) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x + 1 + i * 5, y0 + 19, 3, 5); }
  }
  text(minuteTxt(), x0 + 156, y0 + 5, G.clock > halfLen() ? '#3ddc84' : '#f3ead6', 8, 'center');
  if (G.so) drawShootoutTally(x0, y0 + 26);
  if (lite) { if (G.banner) drawBanner(G.banner); if (G.cut) drawCard(G.cut); return; }
  if (SETTINGS.radar && G.phase !== 'intro') drawRadar();
  const c = G.ctrl;
  // Passziel des eigenen Ballführers
  if (c && G.ball.owner === c && c.team === G.human && (G.phase === 'play' || G.phase === 'setpiece' || G.phase === 'kickoff') && !isGK(c) || (c && G.ball.owner === c && isGK(c) && G.phase === 'play')) {
    const q = choosePass(c, IN.x, IN.y);
    if (q) { const x = sx(q.x, q.y), y = sy(q.y, q.z) - 40 - (Math.floor(G.t * 4) % 2); ctx.fillStyle = '#000'; ctx.fillRect(x - 4, y - 1, 9, 4); ctx.fillRect(x - 2, y + 3, 5, 2); ctx.fillStyle = '#7cf2ff'; ctx.fillRect(x - 3, y, 7, 2); ctx.fillRect(x - 2, y + 2, 5, 1); ctx.fillRect(x - 1, y + 3, 3, 1); }
  }
  // Steuermarke über dem eigenen Spieler
  if (c && G.human >= 0 && !G.watch && !c.off) {
    const x = sx(c.x, c.y), y = sy(c.y, c.z) - 38 - (Math.floor(G.t * 3) % 2);
    if (x < 4 || x > W - 4) { const ex = x < 4 ? 4 : W - 10, ey = clamp(sy(c.y) - 20, 30, H - 30); ctx.fillStyle = '#000'; ctx.fillRect(ex - 1, ey - 1, 8, 8); ctx.fillStyle = '#ffc83a'; ctx.fillRect(ex, ey, 6, 6); }
    else if (G.ball.owner !== c) { ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y + 2, 3, 2); ctx.fillStyle = '#ffc83a'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1); }
    if (TOUCH.passT && G.ball.owner === c && performance.now() - TOUCH.passT > 150) drawPower(c, clamp((performance.now() - TOUCH.passT - 120) / 650, 0, 1), '#7cf2ff');
    if (c.charge > 0 && G.ball.owner === c) {
      drawPower(c, c.charge); drawAimCross(c);
      if (PROF.games < 15 || G.tut) { const K = KEYN(), t = LASTIN === 'touch' ? 'ZUM ZIELEN DEN DAUMEN ZIEHEN' : `${K.a}: SCHLENZER · ${K.c}: HEBER`; text(t, sx(c.x, c.y), sy(c.y, c.z) - 54, '#f3ead6', 8, 'center'); }
    }
  }
  // Name des Ballführers
  const o = G.ball.owner;
  if (o && (G.phase === 'play' || G.phase === 'setpiece')) text(`${o.d.num} ${o.d.name.toUpperCase()}`, sx(o.x, o.y), sy(o.y) + 4, o.team === G.human ? '#ffc83a' : '#cfd6f2', 8, 'center');
  drawSetPieceHint();
  if (G.phase === 'goal' && G.scorer && G.scorer.team === G.human && !G.watch && !G.celebSet && G.phaseT < 2.6) { const K = KEYN(); hint(`JUBEL: ${K.a} KNIE-RUTSCHER · ${K.b} FLIEGER · ${K.c} BECKER-FAUST`); }
  if (G.ticker) { const a = clamp(G.ticker.t * 3, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(3,5,16,0.85)'; ctx.fillRect(0, H - 18, W, 14); text(G.ticker.txt, W / 2, H - 15, '#f3ead6', 8, 'center', false); ctx.globalAlpha = 1; }
  else drawKeyBar();
  if (G.cut) drawCard(G.cut);
  if (G.banner) drawBanner(G.banner);
  if (G.phase === 'intro') drawIntro();
}
function drawPower(p, v, col) {
  const x = sx(p.x, p.y) - 12, y = sy(p.y, p.z) - 44, w = 24;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
  ctx.fillStyle = '#1a2040'; ctx.fillRect(x, y, w, 4);
  const f = clamp(v, 0, 1.05), fw = Math.round(w * Math.min(1, f));
  ctx.fillStyle = col || (f > 0.93 ? '#ff4f3a' : f > 0.6 ? '#ffc83a' : '#3ddc84'); ctx.fillRect(x, y, fw, 4);
}
// Zielkreuz im Tor beim Aufladen: zeigt, wohin der Schuss geht (Höhe = Schusskraft, rot = drüber)
function drawAimCross(c) {
  const a = shotAim(c, c.charge, Math.abs(IN.y) > 0.25 ? IN.y : 0), gx = goalX(c.team), over = c.charge > 0.93;
  if (c.taim) a.y = c.taim.y;
  const x = sx(gx, a.y);
  const y = sy(a.y, over ? GH + 0.5 : a.z), col = over ? '#ff4f3a' : c.charge > 0.6 ? '#ffc83a' : '#3ddc84', r = 6 + (Math.floor(G.t * 8) % 2);
  if (x < -10 || x > W + 10) return;
  // gestrichelte Schusslinie vom Ball zum Ziel
  const b = G.ball, bx = sx(b.x, b.y), by = sy(b.y, b.z), n = Math.max(4, Math.round(Math.hypot(x - bx, y - by) / 7)), ph = (G.t * 10) % 1;
  for (let i = 1; i < n; i++) {
    const k = (i + ph) / n, px = Math.round(lerp(bx, x, k)), py = Math.round(lerp(by, y, k) - Math.sin(k * Math.PI) * 6 * a.z);
    ctx.globalAlpha = 0.25 + 0.6 * k; ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, 3, 3); ctx.fillStyle = col; ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(x - r - 1, y - 2, r * 2 + 3, 5); ctx.fillRect(x - 2, y - r - 1, 5, r * 2 + 3);
  ctx.fillStyle = col; ctx.fillRect(x - r, y - 1, r * 2 + 1, 3); ctx.fillRect(x - 1, y - r, 3, r * 2 + 1);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1);
  if (c.taim) { const k = shotKind(c, c.charge, a.y); text({ chip: 'HEBER', finesse: 'SCHLENZER', hammer: 'HAMMER', shot: '' }[k], x, y - r - 12, col, 8, 'center'); }
}
// Radar: 1 Pixel pro Meter
function drawRadar() {
  const w = CW, h = CH, x0 = W - w - (TOUCHDEV ? 58 : 8), y0 = 6;
  ctx.fillStyle = 'rgba(10,40,20,0.55)'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 + w / 2, y0, 1, h); ctx.fillRect(x0, y0 + MY - 8, 1, 16); ctx.fillRect(x0 + w - 1, y0 + MY - 8, 1, 16);
  for (const p of G.players) {
    if (p.off) continue;
    const k = G.kits[p.team], px = Math.round(x0 + p.x), py = Math.round(y0 + p.y);
    ctx.fillStyle = OUTLINE; ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = isGK(p) ? k.gk : k.c1; ctx.fillRect(px - 1, py - 1, 2, 2);
    if (p === G.ctrl && G.human >= 0 && !G.watch) { ctx.fillStyle = '#ffc83a'; ctx.fillRect(px - 2, py - 4, 4, 1); }
  }
  const b = G.ball; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 + b.x) - 1, Math.round(y0 + b.y) - 1, 2, 2);
  // Sichtfenster
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(Math.round(x0 + CAMX - VIEW_HALF) + 0.5, y0 + 0.5, Math.round(VIEW_HALF * 2), h - 1);
}
function drawShootoutTally(x0, y0) {
  const S = G.so;
  for (const t of [0, 1]) {
    text(G.T[t].k, x0, y0 + t * 11, '#cfd6f2', 8);
    const n = Math.max(5, S.k[t].length);
    for (let i = 0; i < n; i++) { const v = S.k[t][i]; ctx.fillStyle = '#000'; ctx.fillRect(x0 + 30 + i * 9, y0 + t * 11, 7, 7); ctx.fillStyle = v === 1 ? '#3ddc84' : v === 0 ? '#ff4f3a' : '#3a2f4d'; ctx.fillRect(x0 + 31 + i * 9, y0 + 1 + t * 11, 5, 5); }
  }
}
const KEYN = () => LASTIN === 'touch' ? { a: 'PASS', b: 'SCHUSS', c: 'PASS NACH OBEN WISCHEN', k: 'PASS WISCHEN' } : LASTIN === 'pad' ? { a: 'A', b: 'B', c: 'X', k: 'Y' } : LAY().keyN;
function drawSetPieceHint() {
  const c = G.ctrl, K0 = KEYN();
  if (G.phase === 'play' && c && isGK(c) && G.ball.owner === c && isHumanTeam(c.team)) return hint(`TORWART · ${K0.a}: ABWERFEN (RICHTUNG) · ${K0.c}: ABSCHLAG`);
  const sp = G.sp; if (!sp || !isHumanTeam(sp.team) || G.demo) {
    if (G.phase === 'penalty' && G.pen && isHumanTeam(1 - G.pen.team)) hint('TORWART: RICHTUNG HALTEN = ECKE RATEN');
    return;
  }
  const K = KEYN(), m = {
    kick: `ANSTOSS · ${K.a}: PASS`, throw: `EINWURF · RICHTUNG + ${K.a}`, corner: `ECKE · ${K.c}: FLANKE (RICHTUNG = KURZER/LANGER PFOSTEN) · ${K.a}: KURZ`,
    goal: `ABSTOSS · ${K.a}: KURZ · ${K.c}: WEIT`, free: `FREISTOSS · ${K.b} HALTEN: SCHUSS · ${K.a}: PASS · ${K.c}: FLANKE`, pen: `ELFMETER · ${K.b} HALTEN, RICHTUNG = ECKE`,
  }[sp.type];
  if (m && (G.phase === 'setpiece' || G.phase === 'kickoff' || G.phase === 'penalty')) hint(m);
}
function hint(s) { ctx.font = `8px ${FONT}`; const w = ctx.measureText(s).width + 16; ctx.fillStyle = 'rgba(3,5,16,0.85)'; ctx.fillRect(W / 2 - w / 2, H - 36, w, 14); text(s, W / 2, H - 33, '#ffc83a', 8, 'center', false); }
// Tastenleiste in den ersten Spielen (Steuerhilfen)
const helpsOn = () => (SETTINGS.helps === true || (SETTINGS.helps === 'auto' && (G.helpN ?? 0) < 3)) && G && !G.demo && !G.watch && G.human >= 0 && menu.hidden && LASTIN !== 'touch';
function keyBarItems() {
  const att = G.ball.owner && G.ball.owner.team === G.human, pad = LASTIN === 'pad';
  if (pad) return att ? [['A', 'PASS'], ['Y', 'STEIL'], ['X', 'FLANKE'], ['B', 'SCHUSS'], ['LB', 'HAKEN'], ['RT', 'SPRINT']] : [['A', 'WECHSEL'], ['B', 'TACKLING'], ['X', 'GRÄTSCHE'], ['Y', 'DRUCK'], ['RT', 'SPRINT']];
  const N = LAY().keyN, sw = LAY().swapDef;
  return att ? [[N.a, 'PASS'], [N.k, 'STEIL'], [N.c, 'FLANKE'], [N.b, 'SCHUSS'], [N.f, 'HAKEN'], [N.s, 'SPRINT']] : [[N.a, 'WECHSEL'], [sw ? N.c : N.b, 'TACKLING'], [sw ? N.b : N.c, 'GRÄTSCHE'], [N.k, 'DRUCK'], [N.s, 'SPRINT']];
}
function drawKeyBar() {
  if (!helpsOn() || G.phase !== 'play') return;
  const items = keyBarItems(); ctx.font = `8px ${FONT}`;
  const parts = items.map(([k, l]) => [k, ' ' + l]), gap = 12;
  const w = parts.reduce((a, [k, l]) => a + ctx.measureText(k).width + ctx.measureText(l).width, 0) + gap * (parts.length - 1);
  let x = Math.round(W / 2 - w / 2); const y = H - 15;
  ctx.fillStyle = 'rgba(7,6,11,0.72)'; ctx.fillRect(x - 8, y - 3, w + 16, 13);
  for (const [k, l] of parts) { text(k, x, y, '#ffc83a', 8, 'left', false); x += ctx.measureText(k).width; ctx.font = `8px ${FONT}`; text(l, x, y, '#f3ead6', 8, 'left', false); x += ctx.measureText(l).width + gap; ctx.font = `8px ${FONT}`; }
}
function drawBanner(B) {
  const k = B.t / B.dur, a = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1;
  const sc = B.big ? 22 : 16, y = B.big ? H / 2 - 40 : 74, slide = (1 - easeBack(Math.min(1, B.t / 0.25))) * 40;
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = 'rgba(3,5,16,0.75)'; ctx.fillRect(0, y - 8, W, sc + (B.sub ? 30 : 16));
  ctx.fillStyle = B.col; ctx.fillRect(0, y - 8, W, 2); ctx.fillRect(0, y + sc + (B.sub ? 20 : 6), W, 2);
  text(B.txt, W / 2 + slide, y, B.col, sc, 'center');
  if (B.sub) text(B.sub, W / 2 - slide, y + sc + 6, '#f3ead6', 8, 'center');
  ctx.globalAlpha = 1;
}
function drawCard(c) {
  const p = c.p, k = clamp(c.t / 0.25, 0, 1), x = W - 150, y = 134;
  ctx.globalAlpha = c.t > c.dur - 0.3 ? (c.dur - c.t) / 0.3 : 1;
  ctx.fillStyle = 'rgba(3,5,16,0.85)'; ctx.fillRect(x - 6, y - 6, 140, 60);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 26, 36); ctx.fillStyle = c.col; ctx.fillRect(x, y + (1 - k) * 10, 24, 34 - (1 - k) * 10);
  if (c.title === 'GELB-ROT') { ctx.fillStyle = '#ffd200'; ctx.fillRect(x, y, 12, 34); }
  text(c.title, x + 32, y + 2, c.col, 8);
  text(`${p.d.num} ${p.d.name.toUpperCase()}`.slice(0, 13), x + 32, y + 16, '#f3ead6', 8);
  text(G.T[p.team].k, x + 32, y + 30, '#9b90ad', 8);
  ctx.globalAlpha = 1;
}
function drawReplayOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 16, W, 16);
  if (Math.floor(G.t * 2) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(10, 4, 8, 8); }
  text('WIEDERHOLUNG', 24, 4, '#f3ead6', 8);
  text(TOUCHDEV ? 'TIPPEN = WEITER' : 'TASTE = WEITER', W - 10, H - 13, '#9b90ad', 8, 'right');
}
function drawIntro() {
  const k = ease(G.phaseT / 0.6);
  ctx.fillStyle = `rgba(3,5,16,${0.78 * k})`; ctx.fillRect(0, 0, W, H);
  const ev = G.event, T0 = G.T[0];
  text(G.career && G.career.label ? G.career.label : ev ? ev.title : 'FREUNDSCHAFTSSPIEL', W / 2, 22, ev ? '#ffc83a' : '#9b90ad', 8, 'center');
  text(`${ev && ev.venue ? ev.venue : 'SPORTPLATZ ' + T0.short.toUpperCase()} · ${GROUNDS[PITCH.ground]}${PITCH.wet ? ' · REGEN' : ''}${PITCH.night && !(ev && ev.night) ? ' · FLUTLICHT' : ''}`, W / 2, 36, '#cfd6f2', 8, 'center');
  for (const t of [0, 1]) {
    const T = G.T[t], kt = G.kits[t], cx = W / 2 + (t ? 1 : -1) * (W * 0.25) * k;
    ctx.drawImage(jerseyIcon(kt), cx - 24, 54, 48, 48);
    text(T.k, cx, 108, '#ffffff', 14, 'center');
    text(T.n.toUpperCase().slice(0, 26), cx, 128, kt.c1 === '#f4f4f0' ? '#e8e8e8' : lum(kt.c1) < 0.2 ? '#cfd6f2' : kt.c1, 8, 'center');
    const rec = G.career && G.career.rec ? G.career.rec[t] : null;
    if (rec) text(rec, cx, 141, '#9b90ad', 8, 'center');
    text(G.form[t], cx, 154, '#ffc83a', 8, 'center');
    teamP(t).forEach((p, i) => text(`${slotOf(p).padEnd(2)} ${p.d.name.toUpperCase().slice(0, 12)}`, cx, 168 + i * 13, '#cfd6f2', 8, 'center'));
  }
  text('VS', W / 2, 74, '#ffc83a', 16, 'center');
  if (G.derby) text('DERBY GEGEN DEN ERZRIVALEN!', W / 2, 40 + (Math.floor(G.t * 3) % 2), '#ff4f3a', 8, 'center');
  if (G.chal) { text('AUFGABEN', W / 2, H - 66, '#ffc83a', 8, 'center'); G.chal.forEach((x, i) => text(x.t.toUpperCase(), W / 2, H - 54 + i * 10, '#cfd6f2', 8, 'center')); }
  if (Math.floor(G.t * 2) % 2) text(TOUCHDEV ? 'TIPPEN ZUM ANSTOSS' : 'TASTE ZUM ANSTOSS', W / 2, H - 20, '#f3ead6', 8, 'center');
}
