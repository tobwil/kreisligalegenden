// ================= Zielansicht bei Freistoß und Elfmeter (wie bei FIFA/PES: Kamera hinter dem Ball) =================
// Bei eigenem Elfmeter und Freistoß in Schussweite schaut die Kamera vom Ball aufs Tor: Torwart, Mauer, Tor, ein Fadenkreuz.
// Richtung verschiebt das Fadenkreuz (links/rechts und hoch/runter), Schusstaste halten = Kraft, loslassen = Schuss.
// Wenig Kraft gibt einen Bogen (über die Mauer), viel Kraft einen harten, flachen Schuss. Nach dem Schuss bleibt die Ansicht,
// bis der Ball am Tor ist. Die Figuren sind eigene Pixelfiguren von vorn bzw. hinten.
const AIM_RANGE = 34;   // Freistöße bis 34 m vor dem Tor
// Kamera 7,5 m hinter und 3,3 m über dem Ball (leicht erhöht, damit das Tor über der Mauer zu sehen ist)
const AIM_F = 1.9, AIM_Y0 = 0.2;
function aimWanted() {
  const sp = G.sp;
  if (!sp || G.demo || G.watch || !isHumanTeam(sp.team) || !(sp.type === 'pen' || sp.type === 'free')) return false;
  if (!['setpiece', 'penalty'].includes(G.phase)) return false;
  if (sp.type === 'pen') return true;
  const gx = goalX(sp.team), b = G.ball;
  return dist(b.x, b.y, gx, MY) < AIM_RANGE && Math.abs(b.x - gx) > 9;
}
const aimViewOn = () => !!(G && (aimWanted() || (G.aimFly && G.aimFly.t < 1.6)));
// Kamera-Rahmen aus Ballposition und Tor: d = Blickrichtung, r = rechts
function aimFrame() {
  const A = G.aimCam;
  if (A && (G.aimFly || A.fid === G.ball.fid)) return A;
  const sp = G.sp, team = sp ? sp.team : G.human, gx = goalX(team), b = G.ball, s = atkDir(team);
  let dx = gx - b.x, dy = MY - b.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  G.aimCam = { team, s, gx, dx, dy, rx: -dy, ry: dx, cx: b.x - dx * 7.5, cy: b.y - dy * 7.5, cz: 3.3, fid: G.ball.fid };
  return G.aimCam;
}
function aimProj(A, x, y, z) {
  const ex = x - A.cx, ey = y - A.cy, f = ex * A.dx + ey * A.dy; if (f < 0.25) return null;
  const r = ex * A.rx + ey * A.ry, F = H * AIM_F, Y0 = H * AIM_Y0;
  return { x: W / 2 + r / f * F, y: Y0 - (z - A.cz) / f * F, k: F / f, f };
}
// ---------- Steuerung ----------
function aimStep(dt, sp, c) {
  const s = atkDir(sp.team), gk = G.gk[1 - sp.team];
  if (!sp.aim) {
    // Start: Fadenkreuz in die Ecke, in der der Torwart nicht steht, halbhoch
    const side = gk && gk.y > MY + 0.3 ? -1 : gk && gk.y < MY - 0.3 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    sp.aim = { u: side * 1.8 * s, z: 1.1 };
  }
  sp.aim.u = clamp(sp.aim.u + IN.x * dt * 4.2, -5.5, 5.5);
  sp.aim.z = clamp(sp.aim.z - IN.y * dt * 2.2, 0.15, 3.4);
  if (IN.pb) c.chargeArm = true;
  if (IN.b && c.chargeArm) c.charge = Math.min(1.05, (c.charge || 0) + dt / 1.1);
  if (IN.rb && c.chargeArm && c.charge > 0) { const pw = clamp(c.charge, 0.1, 1.05); c.charge = 0; c.chargeArm = false; aimShot(c, pw, sp); return true; }
  return false;
}
function aimShot(c, pw, sp) {
  const s = atkDir(sp.team), gx = goalX(sp.team), b = G.ball, pen = sp.type === 'pen';
  const ty0 = MY + sp.aim.u * s, tz0 = sp.aim.z, d = dist(b.x, b.y, gx, ty0);
  const sch = A_(c, 'sch') + (c.d.trait === 'Freistoßkönig' ? 6 : 0);
  // Kraft: 0 = 14 m/s (Bogen), 1 = 31 m/s (Strich); überzogen streut stark
  let v = 14 + pw * 17 + sch * 0.02;
  // Bogen (wenig Kraft): Flugbahn so, dass der Ball gerade über die Mauer (2,6 m) geht und sich zum Ziel senkt
  const wall = G.players.filter(p => p.wall && !p.off);
  if (pw < 0.6 && wall.length) {
    const D = Math.hypot(gx - b.x, ty0 - b.y), dw = Math.min(...wall.map(p => Math.hypot(p.x - b.x, p.y - b.y))), r = clamp(dw / D, 0.15, 0.85);
    const T2 = 2 * (2.6 - tz0 * r) / (GRAV * r * (1 - r));
    if (T2 > 0) v = Math.min(v, Math.max(11, D / Math.sqrt(T2)));
  }
  const err = (0.01 + d * 0.0008) * (1.5 - sch / 100) * (pen ? 0.8 : 1) * (1 + Math.max(0, pw - 0.88) * 4);
  const target = { y: ty0 + gauss() * err * d, z: Math.max(0.05, tz0 + gauss() * err * d * 0.6 + Math.max(0, pw - 0.95) * 6), v };
  // die Mauer springt
  for (const p of G.players) if (p.wall && !p.off) { p.vz = 3.3; p.z = 0.01; }
  G.aimFly = { t: 0, fid: b.fid + 1 };
  spShot(c, pw, 0, target);
}
// ---------- Pixelfiguren von vorn und von hinten ----------
const FRONT = new Map();
function frontFig(L, pose, back) {
  const key = L.key + '|' + pose + '|' + +back;
  let cv0 = FRONT.get(key); if (cv0) return cv0;
  const w = 22, h = 28, ox = 5, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), R = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(ox + x, y, ww, hh); };
  const jer = (x, y, ww, hh) => {
    R(x, y, ww, hh, L.c1);
    if (L.pat === 1) for (let i = x + 1; i < x + ww; i += 2) R(i, y, 1, hh, L.c2);
    if (L.pat === 2) for (let j = y + 1; j < y + hh; j += 3) R(x, j, ww, 1, L.c2);
    if (L.pat === 3) R(x, y + 3, ww, 2, L.c2);
  };
  // Beine, Stutzen, Schuhe
  R(3, 18, 2, 2, L.skin); R(7, 18, 2, 2, L.skin); R(3, 20, 2, 5, L.so || L.c1); R(7, 20, 2, 5, L.so || L.c1); R(2, 25, 3, 2, L.shoe || '#1a1a1e'); R(7, 25, 3, 2, L.shoe || '#1a1a1e');
  R(2, 14, 8, 4, L.sh); R(5, 16, 2, 2, shade(L.sh, 0.7));
  jer(2, 6, 8, 8); R(2, 6, 1, 8, L.jerS);
  // Arme je nach Haltung
  if (pose === 'gk') { jer(-3, 7, 5, 2); jer(10, 7, 5, 2); R(-5, 6, 2, 3, L.gk ? '#ececec' : L.skin); R(15, 6, 2, 3, L.gk ? '#ececec' : L.skin); }
  else if (pose === 'wall') { jer(0, 6, 2, 3); jer(10, 6, 2, 3); R(1, 9, 2, 4, L.skin); R(9, 9, 2, 4, L.skin); R(3, 13, 6, 2, L.skin); }
  else if (pose === 'up') { jer(0, 4, 2, 3); jer(10, 4, 2, 3); R(0, 0, 2, 4, L.skin); R(10, 0, 2, 4, L.skin); }
  else { jer(0, 6, 2, 3); jer(10, 6, 2, 3); R(0, 9, 2, 5, L.skin); R(10, 9, 2, 5, L.skin); }
  // Kopf
  R(4, 5, 4, 1, L.skinS); R(3, 0, 6, 5, L.skin);
  if (back) { R(3, 0, 6, 4, L.hair); R(4, 4, 4, 1, L.hair); if (L.num) { g.fillStyle = lum(L.c1) > 0.6 ? '#1a1a1e' : '#ffffff'; g.fillRect(ox + 5, 8, 2, 4); } }
  else { R(3, 0, 6, 1, L.hair); R(3, 1, 1, 2, L.hair); R(8, 1, 1, 2, L.hair); R(4, 2, 1, 1, '#1a1010'); R(7, 2, 1, 1, '#1a1010'); if (L.beard) R(4, 4, 4, 1, shade(L.hair, 0.9)); }
  // Umriss
  const src = g.getImageData(0, 0, w, h), out = g.createImageData(w, h), sd = src.data, od = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (sd[i + 3]) { od[i] = sd[i]; od[i + 1] = sd[i + 1]; od[i + 2] = sd[i + 2]; od[i + 3] = 255; continue; }
    const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && sd[(yy * w + xx) * 4 + 3];
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { od[i] = 11; od[i + 1] = 9; od[i + 2] = 16; od[i + 3] = 255; }
  }
  g.putImageData(out, 0, 0); FRONT.set(key, c); return c;
}
// ---------- Zeichnen ----------
function drawAimView() {
  const A = aimFrame(), F = H * AIM_F, Y0 = H * AIM_Y0, night = PITCH.night;
  // Himmel
  const sky = ctx.createLinearGradient(0, 0, 0, Y0);
  if (night) { sky.addColorStop(0, '#05070f'); sky.addColorStop(1, '#1a2244'); } else if (PITCH.wet) { sky.addColorStop(0, '#6d7684'); sky.addColorStop(1, '#a9b0ba'); } else { sky.addColorStop(0, '#5b9bd8'); sky.addColorStop(1, '#bfe0f2'); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Y0 + 2);
  // Rasen in 2-px-Blöcken: Mähstreifen (Asche ohne)
  const G0 = PITCH.ground, dim = night ? 0.72 : PITCH.wet ? 0.9 : 1;
  const colA = shade(G0 === 2 ? '#b5764a' : G0 === 1 ? '#2f9a45' : '#549a3b', dim), colB = shade(G0 === 2 ? '#a96c43' : G0 === 1 ? '#2b9140' : '#47852f', dim);
  for (let y = Math.ceil(Y0) + 1; y < H; y += 2) {
    const f = A.cz * F / (y - Y0);
    for (let x = 0; x < W; x += 4) {
      const r = (x + 2 - W / 2) / F * f, wx = A.cx + A.dx * f + A.rx * r;
      ctx.fillStyle = Math.floor(wx / 6) % 2 ? colA : colB; ctx.fillRect(x, y, 4, 2);
    }
  }
  // Hintergrund hinter dem Tor: Bande, Zuschauer, Bäume
  const back = aimProj(A, A.gx + A.s * 5, MY, 0);
  if (back) {
    const yb = back.y, k = back.k, top = yb - 3.8 * k;
    ctx.fillStyle = night ? '#0d1220' : '#2f5a32'; ctx.fillRect(0, Math.max(0, top - 1.5 * k), W, 1.5 * k + 2);
    ctx.fillStyle = night ? '#1a1a28' : '#5c6a74'; ctx.fillRect(0, top, W, yb - top);
    for (let i = 0; i < W / 5; i++) for (let j = 0; j < 3; j++) { const hh = (i * 7 + j * 13) % 11; if (hh > 7) continue; ctx.fillStyle = ['#c8102e', '#f3ead6', '#2f56b0', '#3a2f4d', '#ffc83a'][(i + j * 2) % 5]; ctx.fillRect(i * 5 + (j % 2) * 2, top + 2 + j * (k * 0.9), 3, Math.max(2, k * 0.5)); }
    const ad = yb - 1.0 * k; ctx.fillStyle = '#f4f4f0'; ctx.fillRect(0, ad, W, yb - ad);
    const ads = (PITCH.ads && PITCH.ads.length ? PITCH.ads : ['KREISLIGA-LEGENDEN']);
    for (let i = 0, x = -((A.cy * 7) % 160); x < W; i++) { const t = ads[i % ads.length], w0 = t.length * 7 + 20; ctx.fillStyle = ['#c8102e', '#14306b', '#0a8a3e', '#ffd200'][i % 4]; ctx.fillRect(x, ad + 1, w0 - 4, yb - ad - 2); text(t, x + w0 / 2 - 2, ad + (yb - ad) / 2 - 4, i % 4 === 3 ? '#14306b' : '#ffffff', 8, 'center', false); x += w0; }
  }
  // Linien
  const wh = night ? 'rgba(235,235,235,0.75)' : 'rgba(255,255,255,0.85)';
  const seg = pts => { ctx.strokeStyle = wh; ctx.lineWidth = 2; ctx.beginPath(); let on = false; for (const [x, y] of pts) { const p = aimProj(A, x, y, 0); if (!p) { on = false; continue; } if (on) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); on = true; } } ctx.stroke(); };
  const L = (x1, y1, x2, y2) => { const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.8)), pts = []; for (let i = 0; i <= n; i++) pts.push([lerp(x1, x2, i / n), lerp(y1, y2, i / n)]); seg(pts); };
  const gx = A.gx, s = A.s, bx = gx - s * BOX_D, sx6 = gx - s * SIX_D;
  L(gx, -2, gx, CH + 2); L(bx, MY - BOX_W / 2, bx, MY + BOX_W / 2); L(gx, MY - BOX_W / 2, bx, MY - BOX_W / 2); L(gx, MY + BOX_W / 2, bx, MY + BOX_W / 2);
  L(sx6, MY - SIX_W / 2, sx6, MY + SIX_W / 2); L(gx, MY - SIX_W / 2, sx6, MY - SIX_W / 2); L(gx, MY + SIX_W / 2, sx6, MY + SIX_W / 2);
  { const px = gx - s * PEN_D, pts = []; for (let a = -0.93; a <= 0.93; a += 0.05) pts.push([px - s * Math.cos(a) * CIRCLE_R, MY + Math.sin(a) * CIRCLE_R]); seg(pts.filter(([x]) => (x - bx) * s < 0)); const p = aimProj(A, px, MY, 0); if (p) { ctx.fillStyle = wh; ctx.fillRect(p.x - 2, p.y - 1, 4, 2); } }
  // Tor: Netz (hinten), dann Pfosten und Latte
  const P = (y, z, dx = 0) => aimProj(A, gx + s * dx, y, z);
  ctx.strokeStyle = night ? 'rgba(220,220,230,0.4)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 14; i++) { const y = GY1 + GW * i / 14, a = P(y, 0, 1.8), b2 = P(y, 2.0, 1.8), c2 = P(y, GH, 0); if (a && b2 && c2) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); } }
  for (let j = 0; j <= 6; j++) { const z = 2.0 * j / 6, a = P(GY1, z, 1.8), b2 = P(GY2, z, 1.8); if (a && b2) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); } }
  for (const y of [GY1, GY2]) { const a = P(y, 0, 1.8), b2 = P(y, 2.0, 1.8), c2 = P(y, GH, 0), d2 = P(y, 0, 0); if (a && b2 && c2 && d2) { ctx.beginPath(); ctx.moveTo(d2.x, d2.y); ctx.lineTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); } }
  // Figuren und Ball nach Tiefe sortiert (hinten zuerst)
  const items = [];
  for (const p of G.players) {
    if (p.off) continue; const q = aimProj(A, p.x, p.y, p.z || 0); if (!q || q.f > 60 || q.x < -60 || q.x > W + 60) continue;
    if ((G.sp && p === G.sp.taker && !G.aimFly) || q.f < (G.aimFly ? 9 : 5)) continue;   // Schütze steht unter der Kamera
    items.push({ f: q.f, draw: () => {
      const keeper = isGK(p), mine = p.team === A.team, pose = keeper ? 'gk' : p.wall ? (p.z > 0.2 ? 'up' : 'wall') : 'idle';
      const img = frontFig(p.look, pose, mine), sc = q.k * 1.85 / 26, w = img.width * sc, h = img.height * sc;
      const sh = aimProj(A, p.x, p.y, 0); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.35 * sh.k, 0.08 * sh.k, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.translate(q.x, q.y - h / 2);
      if (keeper && p.act && p.act.type === 'dive') { const side = Math.sign((p.vx * A.rx + p.vy * A.ry) || 1); ctx.rotate(side * Math.min(1.35, p.act.t * 5)); }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    } });
  }
  const B = G.ball, bq = aimProj(A, B.x, B.y, B.z + 0.11);
  if (bq) items.push({ f: bq.f, draw: () => {
    const sh = aimProj(A, B.x, B.y, 0), r = Math.max(2, 0.12 * bq.k);
    if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#0b0910'; ctx.beginPath(); ctx.arc(bq.x, bq.y, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(bq.x, bq.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1e'; ctx.fillRect(bq.x - r * 0.3, bq.y - r * 0.3, Math.max(1, r * 0.55), Math.max(1, r * 0.55));
  } });
  items.sort((a, b) => b.f - a.f).forEach(i => i.draw());
  // Pfosten und Latte vor dem Netz
  const pw = Math.max(2, 0.12 * (P(MY, 0) || { k: 20 }).k);
  for (const y of [GY1, GY2]) { const a = P(y, 0), b2 = P(y, GH); if (a && b2) { ctx.fillStyle = '#f4f4f0'; ctx.fillRect(a.x - pw / 2, b2.y, pw, a.y - b2.y); } }
  { const a = P(GY1, GH), b2 = P(GY2, GH); if (a && b2) { ctx.fillStyle = '#f4f4f0'; ctx.fillRect(Math.min(a.x, b2.x), a.y - pw / 2, Math.abs(b2.x - a.x), pw); } }
  // Fadenkreuz und Kraft (nur vor dem Schuss)
  const sp = G.sp;
  if (sp && sp.aim && !G.aimFly) {
    const t = aimProj(A, gx, MY + sp.aim.u * s, sp.aim.z);
    if (t) { const blink = Math.floor(G.t * 4) % 2, cl = blink ? '#ffc83a' : '#fff1b0'; ctx.fillStyle = '#000'; ctx.fillRect(t.x - 9, t.y - 2, 19, 5); ctx.fillRect(t.x - 2, t.y - 9, 5, 19); ctx.fillStyle = cl; ctx.fillRect(t.x - 8, t.y - 1, 6, 3); ctx.fillRect(t.x + 3, t.y - 1, 6, 3); ctx.fillRect(t.x - 1, t.y - 8, 3, 6); ctx.fillRect(t.x - 1, t.y + 3, 3, 6); }
    const c = sp.taker, v = c.charge || 0, bw = 140, bx0 = W / 2 - bw / 2, by0 = H - 58;
    ctx.fillStyle = 'rgba(3,5,16,0.85)'; ctx.fillRect(bx0 - 4, by0 - 14, bw + 8, 24);
    text('KRAFT', bx0, by0 - 11, '#cfd6f2', 8, 'left', false); text(v < 0.01 ? '' : v < 0.45 ? 'BOGEN' : v < 0.85 ? 'MITTEL' : v > 0.97 ? 'ZU FEST!' : 'STRAMM', bx0 + bw, by0 - 11, '#ffc83a', 8, 'right', false);
    ctx.fillStyle = '#1a2040'; ctx.fillRect(bx0, by0, bw, 6);
    ctx.fillStyle = v > 0.97 ? '#ff4f3a' : v > 0.85 ? '#ffc83a' : '#3ddc84'; ctx.fillRect(bx0, by0, Math.round(bw * Math.min(1, v)), 6);
    const K = KEYN(), m = `${sp.type === 'pen' ? 'ELFMETER' : 'FREISTOSS'} · RICHTUNG: ZIELEN · ${K.b} HALTEN: KRAFT${sp.type === 'free' ? ` · ${K.a}: PASS · ${K.c}: FLANKE` : ''}`;
    hint(m);
    if (sp.type === 'free') text('WENIG KRAFT = BOGEN ÜBER DIE MAUER · VIEL KRAFT = HART UND FLACH', W / 2, H - 20, '#cfd6f2', 8, 'center', false);
  }
}
