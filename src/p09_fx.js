// ================= Effekte: Partikel, Ball, Spieler, Schiedsrichter, Linienrichter, Bänke =================
function burst(x, y, z, col, n = 6, sp = 2.5) {
  return Array.from({ length: n }, () => ({ x, y, z, vx: rnd(-sp, sp), vy: rnd(-sp, sp) * 0.5, vz: rnd(1, sp * 1.4), col, life: rnd(0.25, 0.55), t: 0, sz: 2 }));
}
function confetti(gx, cols) {
  return Array.from({ length: 90 }, () => ({ x: gx + rnd(-10, 10), y: rnd(10, 54), z: rnd(5, 9), vx: rnd(-1.5, 1.5), vy: rnd(-1, 1), vz: rnd(-0.5, 2), col: pick(cols), life: rnd(2, 3.5), t: 0, sz: 2, conf: true, ph: rnd(0, 6) }));
}
function updateParts(dt) {
  for (const q of G.parts) {
    q.t += dt;
    if (q.conf) { q.vz = Math.max(q.vz - 3 * dt, -1.2); q.x += (q.vx + Math.sin(q.t * 5 + q.ph) * 0.8) * dt; }
    else { q.vz -= GRAV * dt; q.x += q.vx * dt; }
    q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt);
  }
  G.parts = G.parts.filter(q => q.t < q.life);
  // Staub auf dem Hartplatz, Spritzer bei Regen
  if (PITCH.ground === 2 && G.phase === 'play' && Math.random() < 0.3) { const p = pick(G.players); if (p && !p.off && Math.hypot(p.vx, p.vy) > 5) G.parts.push({ x: p.x, y: p.y, z: 0.1, vx: -p.vx * 0.1, vy: rnd(-0.3, 0.3), vz: rnd(0.3, 0.8), col: 'rgba(200,120,80,0.6)', life: 0.5, t: 0, sz: 2 }); }
}
function drawParts() {
  for (const q of G.parts) {
    const a = 1 - q.t / q.life; ctx.globalAlpha = clamp(a * 1.5, 0, 1);
    ctx.fillStyle = q.col;
    const w = q.conf ? (Math.sin(q.t * 9 + q.ph) > 0 ? 2 : 1) : q.sz;
    ctx.fillRect(sx(q.x, q.y), sy(q.y, q.z), w, 2);
  }
  ctx.globalAlpha = 1;
}
// Ball: weiß mit dunklen Flecken, dreht beim Rollen
function drawBall(b) {
  const x = sx(b.x, b.y), g = sy(b.y), y = sy(b.y, b.z) - 2;
  const sh = clamp(1 - b.z / 5, 0.25, 1), sw = Math.round(3 + 2 * sh);
  ctx.fillStyle = `rgba(0,0,0,${0.38 * sh})`; ctx.fillRect(x - sw + 1, g - 1, sw * 2 - 1, 2);
  if (b.trail && b.trail.length > 1) b.trail.forEach((t, i) => { ctx.globalAlpha = (i + 1) / b.trail.length * 0.35; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx(t[0], t[1]) - 1, sy(t[1], t[2]) - 3, 3, 3); });
  ctx.globalAlpha = 1;
  ctx.fillStyle = OUTLINE; ctx.fillRect(x - 2, y - 3, 5, 7); ctx.fillRect(x - 3, y - 2, 7, 5);
  ctx.fillStyle = '#f6f6f2'; ctx.fillRect(x - 2, y - 2, 5, 5);
  const r = Math.floor((b.roll || 0)) % 4;
  ctx.fillStyle = '#2a2a30';
  if (r === 0) { ctx.fillRect(x, y - 1, 1, 2); ctx.fillRect(x - 2, y + 1, 1, 1); }
  else if (r === 1) { ctx.fillRect(x - 1, y, 2, 1); ctx.fillRect(x + 2, y - 2, 1, 1); }
  else if (r === 2) { ctx.fillRect(x + 1, y, 1, 2); ctx.fillRect(x - 2, y - 2, 1, 1); }
  else { ctx.fillRect(x - 1, y - 1, 2, 1); ctx.fillRect(x + 1, y + 2, 1, 1); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 2, 1, 1);
}
function drawPlayerAt(p, sel) {
  const x = sx(p.x, p.y), gy = sy(p.y), y = sy(p.y, p.z);
  const sh = clamp(1 - p.z / 1.5, 0.35, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * sh})`; ctx.fillRect(x - 5, gy - 1, 10, 2); ctx.fillRect(x - 3, gy - 2, 6, 4);
  if (sel) {
    const c = typeof sel === 'string' ? sel : '#ffc83a', b = Math.floor(G.t * 4) % 2;
    const parts = [[x - 9 - b, gy - 1, 2, 2], [x + 8 + b, gy - 1, 2, 2], [x - 6, gy + 2 + b, 13, 1], [x - 6, gy - 4 - b, 13, 1]];
    ctx.fillStyle = '#000'; for (const [px, py, w, h] of parts) ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
    ctx.fillStyle = c; for (const [px, py, w, h] of parts) ctx.fillRect(px, py, w, h);
  }
  const act = p.rp ? p.rp.type : p.act && p.act.type, flip = p.face < 0;
  const pose = celebPose(p) || p.pose;
  if (act === 'dive') {
    const dy = p.rp ? p.rp.dy : p.act.dy || 1, ang = (flip ? -1 : 1) * (72 + dy * 14);
    ctx.drawImage(rotSprite(p.look, 'stretch', Math.round(ang), flip), x - SH / 2, y - SH / 2 - 8);
    return;
  }
  if (pose === 'fall' || act === 'fall' || (G.spray && G.spray.p === p)) {
    ctx.drawImage(rotSprite(p.look, 'idle', flip ? -90 : 90, flip), x - SH / 2, y - SH / 2 - 2);
    if (G.spray && G.spray.p === p && Math.floor(G.t * 10) % 2) { ctx.fillStyle = 'rgba(230,245,255,0.8)'; ctx.fillRect(x - 3 + rnd(-2, 2), y - 8 + rnd(-2, 2), 3, 3); }
    return;
  }
  const img = sprite(p.look, pose, p.fr, flip);
  ctx.drawImage(img, x - AX, y - AY);
}
// Schiedsrichter läuft diagonal hinter dem Ball mit, Linienrichter an der hinteren Seitenlinie auf Höhe des vorletzten Verteidigers
const REF = { d: { name: 'SCHIRI', num: 0, skin: 1, hair: '#2a1a10', style: 3, beard: false, belly: true, tall: 0 }, x: CW / 2, y: MY + 6, face: 1, animT: 0, pose: 'idle', fr: 0 };
const LINES = [{ x: 25, y: -1.1, face: 1, animT: 0 }, { x: 75, y: -1.1, face: 1, animT: 0 }];
function officialsItems(dt) {
  if (!REF.look) { REF.look = lookOf(REF.d, { c1: '#1d1d24', c2: '#ffd200', sh: '#1d1d24', so: '#1d1d24' }, false); }
  const b = G.ball, tx = clamp(b.x - (b.y < MY ? -1 : 1) * 6, 6, CW - 6), ty = clamp(b.y + (b.y < MY ? 9 : -9), 4, CH - 4);
  if (G.phase !== 'replay') {
    const dx = tx - REF.x, dy = ty - REF.y, d = Math.hypot(dx, dy), sp = d > 1 ? Math.min(6.5, d * 1.4) : 0;
    if (d > 0.01) { REF.x += dx / d * sp * dt; REF.y += dy / d * sp * dt; }
    REF.animT += sp * dt * 1.7; if (Math.abs(dx) > 0.5) REF.face = dx > 0 ? 1 : -1;
    REF.pose = sp > 0.5 ? 'run' : 'idle'; REF.fr = REF.pose === 'run' ? Math.floor(REF.animT) % 6 : 0;
    if (G.cut && G.cut.kind === 'card') { REF.pose = 'card'; }
    LINES.forEach((L, k) => {
      const t = ownX(0) === (k === 0 ? 0 : CW) ? 0 : 1;
      const ps = teamP(t).map(q => q.x).sort((a, c) => k === 0 ? a - c : c - a), line = ps[1] ?? (k === 0 ? 20 : 80);
      const want = k === 0 ? clamp(Math.min(line, b.x), 2, CW / 2) : clamp(Math.max(line, b.x), CW / 2, CW - 2), dx2 = want - L.x, sp2 = clamp(dx2 * 2, -6, 6);
      L.x += sp2 * dt; L.animT += Math.abs(sp2) * dt * 1.7; if (Math.abs(sp2) > 0.3) L.face = sp2 > 0 ? 1 : -1;
      if (!L.look) L.look = lookOf({ skin: k + 1, hair: HAIR[k * 3 + 1], style: k, beard: k === 1, num: 0 }, { c1: '#3a4a6a', c2: '#c9ced4', sh: '#1d1d24', so: '#1d1d24' }, false);
      L.pose = G.flagT > 0 && Math.abs(G.flagX - L.x) < 30 ? 'flag' : Math.abs(sp2) > 0.4 ? 'run' : 'idle'; L.fr = L.pose === 'run' ? Math.floor(L.animT) % 6 : 0;
    });
  }
  const items = [{ y: REF.y, draw: () => drawPlayerAt({ look: REF.look, x: REF.x, y: REF.y, z: 0, face: REF.face, pose: REF.pose, fr: REF.fr }, false) }];
  for (const L of LINES) items.push({ y: L.y, draw: () => { drawPlayerAt({ look: L.look, x: L.x, y: L.y, z: 0, face: L.face, pose: L.pose, fr: L.fr }, false); drawFlag(L); } });
  return items;
}
function drawFlag(L) {
  const x = sx(L.x, L.y), y = sy(L.y), up = L.pose === 'flag', fx = x + (L.face > 0 ? 3 : -3);
  ctx.fillStyle = '#c9ced4'; ctx.fillRect(fx, up ? y - 34 : y - 16, 1, up ? 10 : 8);
  const wv = up ? Math.round(Math.sin(G.t * 14)) : 0;
  ctx.fillStyle = up ? '#ffd200' : '#e30613'; ctx.fillRect(fx + (L.face > 0 ? 1 : -5), (up ? y - 34 : y - 16) + wv, 5, 3);
  if (!up) { ctx.fillStyle = '#ffd200'; ctx.fillRect(fx + (L.face > 0 ? 1 : -5), y - 16, 2, 3); }
}
// Trainerbänke an der hinteren Seitenlinie: Ersatzspieler sitzen, der Trainer steht
const BENCH_X = [41, 59];
function benchItems() {
  const out = [];
  for (const t of [0, 1]) {
    const bx = BENCH_X[atkDir(t) > 0 ? 0 : 1], y = -2.4;
    out.push({ y: y - 0.3, draw: () => {
      const x0 = sx(bx - 3, y), x1 = sx(bx + 3, y), yy = sy(y);
      ctx.fillStyle = '#1d2230'; ctx.fillRect(x0, yy - 22, x1 - x0, 3); ctx.fillStyle = 'rgba(200,230,255,0.25)'; ctx.fillRect(x0, yy - 19, x1 - x0, 12);
      ctx.fillStyle = '#2a3040'; ctx.fillRect(x0, yy - 19, 2, 19); ctx.fillRect(x1 - 2, yy - 19, 2, 19); ctx.fillStyle = shade(G.kits[t].c1, 0.6); ctx.fillRect(x0 + 2, yy - 6, x1 - x0 - 4, 3);
    } });
    G.bench[t].slice(0, 5).forEach((d, i) => {
      if (!d) return;
      out.push({ y: y + 0.01, draw: () => { if (!d._look || d._lk !== G.kits[t].c1) { d._look = lookOf(d, { ...G.kits[t], c1: shade(G.kits[t].c1, 0.8) }, false); d._lk = G.kits[t].c1; } ctx.drawImage(sprite(d._look, 'sit', 0, atkDir(t) < 0), sx(bx - 2.4 + i * 1.2, y) - AX, sy(y) - AY + 2); } });
    });
    // Trainer
    out.push({ y: y + 0.6, draw: () => {
      const cx = bx + (atkDir(t) > 0 ? 4 : -4), L = t === 0 ? COACH_LOOK[0] : COACH_LOOK[1];
      const jub = G.phase === 'goal' && G.scoreTeam === t, angry = G.phase === 'whistle' && G.stats.fouls[t] > 0 && G.phaseT < 1.2;
      drawPlayerAt({ look: L, x: cx, y: y + 0.6, z: 0, face: atkDir(t), pose: jub ? 'cheer' : angry ? 'sad' : 'idle', fr: Math.floor(G.t * 4) % 6 }, false);
    } });
  }
  return out;
}
const COACH_LOOK = [lookOf({ skin: 1, hair: '#7a4a20', style: 1, beard: true, belly: true, num: 0 }, { c1: '#2b3a52', c2: '#c9ced4', sh: '#1d1d24', so: '#1d1d24' }, false),
  lookOf({ skin: 0, hair: '#b8b0a0', style: 3, beard: false, belly: true, num: 0 }, { c1: '#4a3a2a', c2: '#c9ced4', sh: '#1d1d24', so: '#1d1d24' }, false)];
