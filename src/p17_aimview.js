// ================= Zielansicht bei Freistoß und Elfmeter (wie bei FIFA/PES: Kamera hinter dem Ball) =================
// Bei eigenem Elfmeter und Freistoß in Schussweite schaut die Kamera vom Ball aufs Tor: Torwart, Mauer, Tor, ein Fadenkreuz.
// Richtung verschiebt das Fadenkreuz (links/rechts und hoch/runter), Schusstaste halten = Kraft, loslassen = Schuss.
// Wenig Kraft gibt einen Bogen (über die Mauer), viel Kraft einen harten, flachen Schuss. Nach dem Schuss bleibt die Ansicht,
// bis der Ball am Tor ist. Die Figuren sind eigene Pixelfiguren von vorn bzw. hinten.
const AIM_RANGE = 34;   // Freistöße bis 34 m vor dem Tor
// Kamera 9 m hinter und 3,4 m über dem Ball (leicht erhöht, damit das Tor über der Mauer zu sehen ist); Ball, Schütze, Mauer und Tor im Bild
const AIM_F = 1.6, AIM_Y0 = 0.2, AIM_BACK = 9, AIM_Z = 3.4;
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
  G.aimCam = { team, s, gx, dx, dy, rx: -dy, ry: dx, cx: b.x - dx * AIM_BACK, cy: b.y - dy * AIM_BACK, cz: AIM_Z, fid: G.ball.fid, bx: b.x, by: b.y };
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
// In der Zielansicht stehen die Figuren nah an der Kamera und werden groß gezeichnet. Deshalb in doppelter Auflösung
// (44 × 58 Pixel, Figur 56 Pixel hoch) mit Gesicht, Haaren, Trikotmuster, Kragen, Rückennummer, Stutzen und Schuhen.
const FRONT = new Map(), FIG_H = 56;
function frontFig(L, pose, back) {
  const key = L.key + '|' + pose + '|' + +back + '|2';
  let cv0 = FRONT.get(key); if (cv0) return cv0;
  const w = 44, h = 58, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), R = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y + 1, ww, hh); };
  const pants = L.pants, sock = L.so || L.c1, shoe = L.shoe || '#1a1a1e', gl = L.gk ? '#ececec' : null;
  const belly = L.belly ? 1 : 0, t0 = 14, t1 = 31;   // Rumpf von t0 bis t1
  // Trikotfläche mit Muster, Licht rechts, Schatten links
  const jer = (x, y, ww, hh, edge = true) => {
    for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
      const X = x + i, Y = y + j; let col = L.c1;
      if (L.pat === 1 && (X % 4) < 2) col = L.c2;
      else if (L.pat === 2 && ((Y - t0) % 6) < 3) col = L.c2;
      else if (L.pat === 3 && Y >= t0 + 5 && Y <= t0 + 7) col = L.c2;
      if (edge && i === 0) col = shade(col, 0.72); else if (edge && i === ww - 1) col = mix(col, '#ffffff', 0.22);
      R(X, Y, 1, 1, col);
    }
  };
  // Beine: Haut, Stutzen mit Streifen, Schuhe (lange Hose: durchgehend Hosenfarbe)
  for (const [lx, d] of [[15, 0.82], [24, 1]]) {
    if (pants) { R(lx, 37, 6, 15, shade(pants, d)); }
    else { R(lx, 37, 6, 4, shade(L.skin, d)); R(lx, 41, 6, 11, shade(sock, d)); R(lx, 42, 6, 1, shade(L.c2, d)); R(lx, 41, 1, 11, shade(sock, d * 0.8)); }
    R(lx - 1, 52, 7, 4, shade(shoe, d)); R(lx - 1, 55, 7, 1, '#000000'); R(lx + 3, 52, 2, 1, mix(shoe, '#ffffff', 0.35));
  }
  // Hose
  R(14, 31, 16, 7, L.sh); R(14, 31, 2, 7, shade(L.sh, 0.75)); R(28, 31, 2, 7, mix(L.sh, '#ffffff', 0.15)); R(21, 35, 2, 3, shade(L.sh, 0.6));
  // Rumpf (Bauch: unten breiter)
  for (let y = t0; y < t1; y++) { const wide = belly && y > t0 + 7 ? 1 : 0; jer(13 - wide, y, 18 + 2 * wide, 1); }
  if (!back) { R(19, t0, 6, 2, L.c2); R(20, t0 + 2, 4, 1, L.c2); R(21, t0, 2, 1, L.skin); }   // Kragen mit V
  else { R(17, t0, 10, 1, L.c2); if (L.num) { const n = L.num, sc = 2, dw = digitsW(n, sc), col = lum(L.c1) > 0.6 ? '#1a1a1e' : '#ffffff'; drawDigits(g, n, 22 - (dw >> 1), t0 + 5, col, sc); } }
  // Arme je nach Haltung (Ärmel in Trikotfarbe, dann Haut, Torwart mit Handschuhen)
  const hand = (x, y) => { if (gl) { R(x - 1, y, 5, 4, gl); R(x - 1, y + 3, 5, 1, '#b8b8bc'); } else R(x, y, 3, 3, L.skin); };
  if (pose === 'gk') {
    jer(5, t0 + 1, 8, 4, false); jer(31, t0 + 1, 8, 4, false); R(1, t0 + 1, 4, 4, L.skin); R(39, t0 + 1, 4, 4, L.skin); hand(0, t0 - 2); hand(41, t0 - 2);
  } else if (pose === 'up') {
    jer(9, t0 - 3, 4, 5, false); jer(31, t0 - 3, 4, 5, false); R(9, 2, 4, 10, L.skin); R(31, 2, 4, 10, L.skin); hand(9, 0); hand(31, 0);
  } else if (pose === 'wall') {
    jer(9, t0 + 1, 4, 6, false); jer(31, t0 + 1, 4, 6, false); R(9, t0 + 7, 4, 7, L.skin); R(31, t0 + 7, 4, 7, L.skin); R(13, 28, 18, 3, L.skin); R(13, 30, 18, 1, L.skinS);   // Hände vor der Hose
  } else {
    jer(9, t0 + 1, 4, 6, false); jer(31, t0 + 1, 4, 6, false); R(9, t0 + 7, 4, 9, L.skin); R(31, t0 + 7, 4, 9, L.skin); R(9, t0 + 7, 1, 9, L.skinS); hand(9, t0 + 16); hand(31, t0 + 16);
  }
  // Hals und Kopf
  R(20, 11, 4, 3, L.skinS); R(17, 1, 10, 11, L.skin); R(17, 1, 2, 11, L.skinS); R(16, 5, 1, 3, L.skin); R(27, 5, 1, 3, L.skin);
  const Hc = L.hair, HL = mix(Hc, '#ffffff', 0.25), style = L.style ?? 1;
  if (back) {
    if (style !== 3) { R(17, 0, 10, 9, Hc); R(18, 0, 6, 1, HL); if (style === 2 || style === 4) R(16, 2, 12, 8, Hc); if (style === 5) R(20, 9, 4, 5, Hc); }
    else R(19, 2, 4, 2, mix(L.skin, '#ffffff', 0.35));   // Glatze glänzt
  } else {
    R(19, 6, 2, 2, '#1a1010'); R(24, 6, 2, 2, '#1a1010'); R(19, 6, 1, 1, '#f4f4f0'); R(24, 6, 1, 1, '#f4f4f0');   // Augen
    R(22, 7, 1, 2, L.skinS); R(20, 10, 4, 1, shade(L.skin, 0.72));                                              // Nase, Mund
    if (style !== 3) { R(17, 0, 10, 3, Hc); R(18, 0, 5, 1, HL); R(19, 5, 2, 1, Hc); R(24, 5, 2, 1, Hc); }
    if (style === 0) R(18, 3, 5, 1, Hc);                                  // Pony
    if (style === 2) { R(16, 1, 2, 9, Hc); R(26, 1, 2, 9, Hc); }        // länger
    if (style === 4) { R(16, -1, 12, 3, Hc); R(16, 2, 1, 5, Hc); R(27, 2, 1, 5, Hc); R(18, -1, 2, 1, HL); R(23, -1, 2, 1, HL); }   // Locken
    if (style === 3) R(20, 1, 4, 1, mix(L.skin, '#ffffff', 0.35));
    if (L.beard) { R(17, 9, 10, 3, shade(Hc, 0.9)); R(20, 10, 4, 1, shade(L.skin, 0.72)); }
  }
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
  // Hintergrund hinter dem Tor wie auf dem Sportplatz: Baumreihe, Wiese, Geländer mit ein paar Zuschauern, Banden der Betriebe aus dem Ort
  const back = aimProj(A, A.gx + A.s * 5, MY, 0);
  if (back) {
    const yb = back.y, k = back.k;
    const tree = night ? '#0b1a10' : '#3a6a33', tree2 = night ? '#10241a' : '#4a7f3d', treeD = night ? '#07120a' : '#2c5228', hill = night ? '#132a14' : '#5a9645';
    const crown = yb - 3.6 * k, base = yb - 1.9 * k;
    for (let x = -((A.cy * 9) % 41) - 41, i = 0; x < W + 40; x += 0.9 * k + ((i * 7) % 5) * 0.25 * k, i++) {   // Baumkronen in zwei Grüntönen
      const r = (0.9 + ((i * 5) % 4) * 0.22) * k; ctx.fillStyle = i % 2 ? tree : tree2;
      ctx.beginPath(); ctx.arc(x, crown + r * 0.35, r, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = tree; ctx.fillRect(0, crown, W, base - crown); ctx.fillStyle = treeD; ctx.fillRect(0, base - 0.25 * k, W, 0.25 * k);
    ctx.fillStyle = hill; ctx.fillRect(0, base, W, yb - base);
    // Zuschauer am Geländer: locker verteilt, wie im Kreisliga-Alltag
    const ph = 1.0 * k, py = yb - 1.0 * k;
    for (let i = 0, x = -((A.cy * 11) % 23); x < W; i++) {
      const gap = 9 + ((i * 37) % 23); x += gap; if ((i * 13) % 7 === 0) continue;
      const col = ['#c8102e', '#3a4a6a', '#7a6a5a', '#2d5a3a', '#d8d2c0', '#5a5a5a', '#1d4f91'][(i * 3) % 7], w0 = Math.max(3, ph * 0.38);
      ctx.fillStyle = col; ctx.fillRect(x, py - ph * 0.95, w0, ph * 0.55); ctx.fillStyle = '#2a2a33'; ctx.fillRect(x, py - ph * 0.42, w0, ph * 0.42);
      ctx.fillStyle = SKIN[i % SKIN.length][0]; ctx.fillRect(x + w0 * 0.2, py - ph * 1.2, w0 * 0.6, ph * 0.25);
    }
    ctx.fillStyle = '#c9ced4'; ctx.fillRect(0, py - ph * 0.62, W, Math.max(1, k * 0.05));   // Geländer
    // Banden
    const ad = yb - 0.9 * k; ctx.fillStyle = OUTLINE; ctx.fillRect(0, ad - 1, W, yb - ad + 1);
    const ads = PITCH.ads && PITCH.ads.length ? PITCH.ads : ['KREISLIGA-LEGENDEN'], cols = [['#14306b', '#ffd200'], ['#f4f4f0', '#c8102e'], ['#0a5a2a', '#f4f4f0'], ['#1d1d24', '#f07d00'], ['#ffd200', '#14306b']];
    const fs = Math.max(6, Math.min(10, Math.round(k * 0.36)));
    ctx.font = `${fs}px ${FONT}`;
    for (let i = 0, x = -((A.cy * 7) % 120) - 60; x < W; i++) {
      const t = ads[i % ads.length], w0 = ctx.measureText(t).width + 18, cl = cols[i % 5];
      ctx.fillStyle = cl[0]; ctx.fillRect(x, ad, w0 - 2, yb - ad - 1);
      ctx.fillStyle = cl[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + w0 / 2 - 1, ad + (yb - ad) / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      x += w0;
    }
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
    const taker = G.sp && p === G.sp.taker && !G.aimFly;
    if (taker) {   // Schütze steht zum Anlauf links hinter dem Ball, von hinten zu sehen
      const tq = aimProj(A, A.bx - A.dx * 0.4 - A.rx * 1.5, A.by - A.dy * 0.4 - A.ry * 1.5, 0);
      if (tq) items.push({ f: tq.f, draw: () => { const img = frontFig(p.look, 'idle', true), sc = tq.k * 1.85 / FIG_H, w = img.width * sc, h = img.height * sc;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(tq.x, tq.y, 0.35 * tq.k, 0.08 * tq.k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.imageSmoothingEnabled = false; ctx.drawImage(img, tq.x - w / 2, tq.y - h, w, h); } });
      continue;
    }
    if (q.f < (G.aimFly ? 12 : 5)) continue;   // zu nah an der Kamera (nach dem Schuss laufen die Spieler sonst riesig durchs Bild)
    items.push({ f: q.f, draw: () => {
      const keeper = isGK(p), mine = p.team === A.team, pose = keeper ? 'gk' : p.wall ? (p.z > 0.2 ? 'up' : 'wall') : 'idle';
      const img = frontFig(p.look, pose, mine), sc = q.k * 1.85 / FIG_H, w = img.width * sc, h = img.height * sc;
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
  // Fadenkreuz, vorhergesagte Flugbahn und Kraft (nur vor dem Schuss)
  const sp = G.sp;
  if (sp && sp.aim && !G.aimFly) {
    const c = sp.taker, v = c.charge || 0, ty = MY + sp.aim.u * s, tz = sp.aim.z;
    // Flugbahn als Punkte: wenig Kraft = hoher Bogen über die Mauer, viel Kraft = flach und hart
    const B0 = G.ball, peak = tz + (sp.type === 'pen' ? 0.2 : lerp(2.6, 0.5, clamp(v || 0.35, 0, 1)));
    for (let i = 1; i < 18; i++) {
      const u = i / 18, x = lerp(B0.x, gx, u), y = lerp(B0.y, ty, u), z = lerp(0.11, tz, u) + 4 * (peak - Math.max(tz, 0.11)) * u * (1 - u) * (sp.type === 'pen' ? 0 : 1);
      const p = aimProj(A, x, y, z); if (!p) continue; const r = Math.max(1, Math.round(0.07 * p.k));
      ctx.fillStyle = '#000'; ctx.fillRect(p.x - r - 1, p.y - r - 1, r * 2 + 2, r * 2 + 2); ctx.fillStyle = i % 2 ? '#fff1b0' : '#ffc83a'; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    const t = aimProj(A, gx, ty, tz);
    if (t) {   // Fadenkreuz: Ring mit Kreuz, gut sichtbar vor Netz und Mauer
      const blink = Math.floor(G.t * 4) % 2, cl = blink ? '#ffc83a' : '#fff1b0', R2 = 9;
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(t.x, t.y, R2, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = cl; ctx.beginPath(); ctx.arc(t.x, t.y, R2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.fillRect(t.x - 15, t.y - 2, 9, 4); ctx.fillRect(t.x + 6, t.y - 2, 9, 4); ctx.fillRect(t.x - 2, t.y - 15, 4, 9); ctx.fillRect(t.x - 2, t.y + 6, 4, 9);
      ctx.fillStyle = cl; ctx.fillRect(t.x - 14, t.y - 1, 7, 2); ctx.fillRect(t.x + 7, t.y - 1, 7, 2); ctx.fillRect(t.x - 1, t.y - 14, 2, 7); ctx.fillRect(t.x - 1, t.y + 7, 2, 7);
    }
    // Kraftbalken unten in der Mitte (zwischen Stick und Knöpfen)
    const bw = 150, bx0 = W / 2 - bw / 2, by0 = H - 22;
    ctx.fillStyle = 'rgba(3,5,16,0.88)'; ctx.fillRect(bx0 - 5, by0 - 15, bw + 10, 26);
    text('KRAFT', bx0, by0 - 12, '#cfd6f2', 8, 'left', false);
    text(v < 0.01 ? (sp.type === 'free' ? 'WENIG = BOGEN · VIEL = FLACH' : '') : v < 0.45 ? 'BOGEN' : v < 0.85 ? 'MITTEL' : v > 0.97 ? 'ZU FEST!' : 'STRAMM', bx0 + bw, by0 - 12, v < 0.01 ? '#8a90a8' : '#ffc83a', 8, 'right', false);
    ctx.fillStyle = '#1a2040'; ctx.fillRect(bx0, by0, bw, 6);
    ctx.fillStyle = '#2a3058'; ctx.fillRect(bx0 + Math.round(bw * 0.45), by0, 1, 6); ctx.fillRect(bx0 + Math.round(bw * 0.85), by0, 1, 6);
    ctx.fillStyle = v > 0.97 ? '#ff4f3a' : v > 0.85 ? '#ffc83a' : '#3ddc84'; ctx.fillRect(bx0, by0, Math.round(bw * Math.min(1, v)), 6);
    // Hinweis oben unter der Anzeigetafel, damit unten nichts mit Stick und Knöpfen kollidiert
    const K = KEYN(), touch = LASTIN === 'touch', title = sp.type === 'pen' ? 'ELFMETER' : 'FREISTOSS';
    const m = touch ? `${title} · STICK = ZIELEN · SCHUSS HALTEN = KRAFT${sp.type === 'free' ? ' · PASS = KURZ' : ''}`
      : `${title} · RICHTUNG = ZIELEN · ${K.b} HALTEN = KRAFT${sp.type === 'free' ? ` · ${K.a}: PASS · ${K.c}: FLANKE` : ''}`;
    ctx.font = `8px ${FONT}`; const mw = ctx.measureText(m).width + 16; ctx.fillStyle = 'rgba(3,5,16,0.85)'; ctx.fillRect(W / 2 - mw / 2, 30, mw, 14); text(m, W / 2, 33, '#ffc83a', 8, 'center', false);
  }
}
