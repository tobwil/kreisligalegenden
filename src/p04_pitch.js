// ================= Sportplatz: Spielfeld mit Perspektive, Sportheim, Zuschauer, Banden, Tore =================
const TX0 = -12, TY0 = -3, TEXW = Math.round((CW - 2 * TX0) * PX);
const FIELD = document.createElement('canvas'); FIELD.width = TEXW; FIELD.height = Math.round((CH + 4 - TY0) * DY);
const ftx = x => (x - TX0) * PX, fty = y => (y - TY0) * DY;
const BX = 46, KB = 0.82;                                  // Hintergrund: 46 m über die Torlinien hinaus, Maßstab wie hinter der Seitenlinie
const BACKDROP = document.createElement('canvas'); BACKDROP.width = Math.round((CW + 2 * BX) * PX * KB); BACKDROP.height = 150;
const CROWD = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = BACKDROP.width; c.height = 40; return c; });
const bkx = x => (x + BX) * PX * KB;                      // Welt-x → Hintergrund-x
let PITCH = { ground: 0, home: null, ads: null, smoke: [], flags: [] };
const ADS = ['METZGEREI HÜMMER', 'AUTOHAUS SÖLLNER', 'GETRÄNKE WUNDER', 'BÄCKEREI MORGENROTH', 'FAHRSCHULE TEMPO', 'DACHDECKER RAAB', 'SCHREINEREI FABER', 'GASTHOF ZUR LINDE', 'KORBWAREN KOLB', 'BRÄU AM BACH', 'SANITÄR GEUSS', 'ELEKTRO FIEDLER', 'BLUMEN EBERT', 'STEUERBÜRO HETZEL', 'KLÖSS-STUBE'];
function buildPitch(homeT, homeKit, awayKit, ev, wx = {}) {
  const ground = ev && ev.ground != null ? ev.ground : homeT.ground ?? 0;
  PITCH = { ground, home: homeT, ev: ev || null, smoke: [], flags: [], night: !!(ev && ev.night) || !!wx.night, wet: !!wx.wet };
  const c = FIELD.getContext('2d'), r = seeded(77 + homeT.id * 13);
  c.clearRect(0, 0, FIELD.width, FIELD.height);
  const dot = (x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(ftx(x)), Math.round(fty(y)), w, h); };
  const line = (x1, y1, x2, y2, col, w = 2, h = 1) => { const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.05); for (let i = 0; i <= n; i++) dot(lerp(x1, x2, i / n), lerp(y1, y2, i / n), col, w, h); };
  const arc = (cx, cy, rad, a0, a1, col) => { for (let a = a0; a <= a1; a += 0.004) dot(cx + rad * Math.cos(a), cy + rad * Math.sin(a), col, 2, 1); };
  let wh = '#f2f2ea';
  if (ground === 2) {
    // Hartplatz (Asche): rotbraun, körnig, ein paar Pfützen, Kreidelinien
    c.fillStyle = '#9a4d2b'; c.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let i = 0; i < 26000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,190,140,0.10)' : 'rgba(60,20,8,0.12)'; c.fillRect((r() * FIELD.width) | 0, (r() * FIELD.height) | 0, 1 + ((r() * 2) | 0), 1); }
    for (let i = 0; i < 9; i++) { const x = ftx(r() * CW), y = fty(r() * CH), w = 20 + r() * 50; c.fillStyle = 'rgba(70,40,40,0.35)'; c.beginPath(); c.ellipse(x, y, w, w * 0.18, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(180,200,230,0.18)'; c.fillRect(x - w * 0.4, y - 1, w * 0.5, 1); }
    // Rasenstreifen außerhalb
    c.fillStyle = '#4f7d36'; c.fillRect(0, 0, FIELD.width, fty(-1.6)); c.fillRect(0, fty(CH + 2.2), FIELD.width, FIELD.height);
    wh = '#efe9dc';
  } else if (ground === 1) {
    // Kunstrasen: kräftiges Grün, gleichmäßig, Gummigranulat, zusätzliche Jugendfeld-Linien
    c.fillStyle = '#2f9a45'; c.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let x = 0; x < CW; x += 5) { c.fillStyle = (x / 5) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'; c.fillRect(ftx(x), fty(-1), 5 * PX, fty(CH + 1) - fty(-1)); }
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() < 0.6 ? 'rgba(20,20,20,0.18)' : 'rgba(180,255,180,0.08)'; c.fillRect((r() * FIELD.width) | 0, (r() * FIELD.height) | 0, 1, 1); }
    const yl = '#e9c84a';
    for (const x0 of [CW / 2 - 30, CW / 2 + 4]) { line(x0, 6, x0 + 26, 6, yl, 1, 1); line(x0, CH - 6, x0 + 26, CH - 6, yl, 1, 1); line(x0, 6, x0, CH - 6, yl, 1, 1); line(x0 + 26, 6, x0 + 26, CH - 6, yl, 1, 1); }
    c.fillStyle = '#5b5d63'; c.fillRect(0, 0, FIELD.width, fty(-2.2)); c.fillRect(0, fty(CH + 3), FIELD.width, FIELD.height);
  } else {
    // Rasen: Mähstreifen, abgespielte Stellen im Torraum und am Mittelkreis
    c.fillStyle = '#4a8a34'; c.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let x = -12; x < CW + 12; x += 6) { c.fillStyle = Math.round(x / 6) % 2 ? '#549a3b' : '#47852f'; c.fillRect(ftx(x), 0, 6 * PX, FIELD.height); }
    for (let i = 0; i < 14000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(170,230,110,0.10)' : 'rgba(20,50,10,0.12)'; c.fillRect((r() * FIELD.width) | 0, (r() * FIELD.height) | 0, 1 + ((r() * 3) | 0), 1); }
    const worn = (cx, cy, rx, ry, n) => { for (let i = 0; i < n; i++) { const a = r() * 7, d = Math.sqrt(r()); const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d; c.fillStyle = r() < 0.6 ? 'rgba(140,105,60,0.45)' : 'rgba(110,80,45,0.4)'; c.fillRect(Math.round(ftx(x)), Math.round(fty(y)), 2 + ((r() * 4) | 0), 1 + ((r() * 2) | 0)); } };
    worn(3, MY, 4, 6, 600); worn(CW - 3, MY, 4, 6, 600); worn(CW / 2, MY, 4, 5, 260); worn(PEN_D, MY, 1, 1.5, 60); worn(CW - PEN_D, MY, 1, 1.5, 60);
    for (let i = 0; i < 6; i++) worn(r() * CW, r() * CH, 2, 2, 40);
  }
  // Linien
  const L = (x1, y1, x2, y2) => line(x1, y1, x2, y2, wh, x1 === x2 ? 2 : 1, x1 === x2 ? 1 : 2);
  L(0, 0, CW, 0); L(0, CH, CW, CH); L(0, 0, 0, CH); L(CW, 0, CW, CH); L(CW / 2, 0, CW / 2, CH);
  arc(CW / 2, MY, CIRCLE_R, 0, Math.PI * 2, wh); dot(CW / 2, MY, wh, 3, 2);
  for (const side of [0, 1]) {
    const m = x => side ? CW - x : x;
    L(m(0), MY - BOX_W / 2, m(BOX_D), MY - BOX_W / 2); L(m(0), MY + BOX_W / 2, m(BOX_D), MY + BOX_W / 2); L(m(BOX_D), MY - BOX_W / 2, m(BOX_D), MY + BOX_W / 2);
    L(m(0), MY - SIX_W / 2, m(SIX_D), MY - SIX_W / 2); L(m(0), MY + SIX_W / 2, m(SIX_D), MY + SIX_W / 2); L(m(SIX_D), MY - SIX_W / 2, m(SIX_D), MY + SIX_W / 2);
    dot(m(PEN_D), MY, wh, 3, 2);
    const a0 = Math.acos((BOX_D - PEN_D) / CIRCLE_R);
    if (side) arc(CW - PEN_D, MY, CIRCLE_R, Math.PI - a0, Math.PI + a0, wh); else arc(PEN_D, MY, CIRCLE_R, -a0, a0, wh);
    for (const cy of [0, CH]) for (let a = 0; a <= Math.PI / 2; a += 0.05) dot(m(Math.cos(a)), cy === 0 ? Math.sin(a) : CH - Math.sin(a), wh, 1, 1);
  }
  buildBack(homeT, homeKit, awayKit, ev);
}
// Hintergrund hinter der hinteren Seitenlinie: Hügel mit Burg, Kirchturm, Bäume, Sportheim, Tribüne, Flutlicht, Bratwurststand, Banden
function buildBack(homeT, homeKit, awayKit, ev) {
  const g = BACKDROP.getContext('2d'), r = seeded(5 + homeT.id), w = BACKDROP.width, h = BACKDROP.height;
  g.clearRect(0, 0, w, h);
  const night = PITCH.night;
  // ferne Hügel
  for (let x = 0; x < w; x += 2) { const y = 54 + Math.sin(x * 0.004 + homeT.id) * 10 + Math.sin(x * 0.013) * 4; g.fillStyle = night ? '#1b2340' : '#7f9fbf'; g.fillRect(x, y, 2, h - y); }
  // Burg auf dem Hügel (Easter Egg für die Gegend)
  const bxp = (r() * 0.6 + 0.2) * w;
  g.fillStyle = night ? '#141a30' : '#8aa0b8';
  g.fillRect(bxp, 38, 46, 18); g.fillRect(bxp + 6, 30, 8, 10); g.fillRect(bxp + 30, 26, 10, 14); for (let i = 0; i < 46; i += 4) g.fillRect(bxp + i, 36, 2, 2);
  for (let x = 0; x < w; x += 2) { const y = 66 + Math.sin(x * 0.009 + 2) * 6 + Math.sin(x * 0.031) * 2; g.fillStyle = night ? '#121a2c' : '#5f8a5a'; g.fillRect(x, y, 2, h - y); }
  // Kirchturm im Dorf
  const kx = (r() * 0.5 + 0.25) * w; g.fillStyle = night ? '#1e2236' : '#d8cdb8'; g.fillRect(kx, 50, 8, 30); g.fillStyle = night ? '#141826' : '#3d4c6b'; g.beginPath(); g.moveTo(kx - 1, 50); g.lineTo(kx + 4, 32); g.lineTo(kx + 9, 50); g.fill();
  g.fillStyle = '#f0c040'; g.fillRect(kx + 3, 31, 2, 2);
  // Baumreihe
  for (let x = -10; x < w + 10; x += 7 + ((r() * 9) | 0)) { const s = 9 + ((r() * 9) | 0), y = 80 - ((r() * 12) | 0); g.fillStyle = night ? '#0d1a14' : r() < 0.5 ? '#2e5e2a' : '#3a6e30'; g.beginPath(); g.ellipse(x, y, s, s * 1.15, 0, 0, 7); g.fill(); g.fillStyle = night ? '#132219' : 'rgba(255,255,255,0.08)'; g.fillRect(x - s / 2, y - s / 2, s / 2, 2); }
  g.fillStyle = night ? '#0f1a12' : '#3f7a35'; g.fillRect(0, 88, w, h - 88);
  // Sportheim mit Vereinsfarben
  const vx = bkx(14), vw = 150;
  g.fillStyle = night ? '#4a4038' : '#e8dcc4'; g.fillRect(vx, 70, vw, 40);
  g.fillStyle = shade(homeKit.c1 === '#f4f4f0' ? homeKit.c2 : homeKit.c1, night ? 0.5 : 0.85); g.beginPath(); g.moveTo(vx - 8, 72); g.lineTo(vx + vw / 2, 52); g.lineTo(vx + vw + 8, 72); g.fill();
  g.fillStyle = night ? '#ffd27a' : '#2b3a52'; for (let i = 0; i < 6; i++) g.fillRect(vx + 10 + i * 23, 80, 12, 10);
  g.fillStyle = '#5a3a20'; g.fillRect(vx + vw - 22, 88, 12, 22);
  g.fillStyle = '#1d1d24'; g.fillRect(vx + 30, 72, 90, 8); g.fillStyle = '#f4f4f0'; g.font = `8px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'center';
  g.fillText('SPORTHEIM', vx + 75, 72); g.textAlign = 'left';
  // Fahne am Mast
  g.fillStyle = '#9aa0a6'; g.fillRect(vx - 20, 40, 2, 70);
  PITCH.flags.push({ x: vx - 18, y: 40, k: homeKit });
  // kleine überdachte Tribüne
  const tx = bkx(CW / 2 + 6), tw = 170;
  g.fillStyle = night ? '#2a2f3a' : '#9aa3ad'; g.fillRect(tx, 76, tw, 4); g.fillStyle = night ? '#1e222b' : '#6b7480'; for (let i = 0; i <= 4; i++) g.fillRect(tx + i * (tw / 4), 80, 2, 30);
  g.fillStyle = night ? '#252a33' : '#c9ced4'; for (let row = 0; row < 3; row++) g.fillRect(tx + 4, 92 + row * 7, tw - 8, 2);
  // Bratwurststand
  const bwx = bkx(CW - 8);
  g.fillStyle = '#c8102e'; g.fillRect(bwx, 86, 60, 6); g.fillStyle = '#f4f4f0'; for (let i = 0; i < 60; i += 10) g.fillRect(bwx + i, 86, 5, 6);
  g.fillStyle = night ? '#4a3a2a' : '#c8a070'; g.fillRect(bwx + 2, 92, 56, 18); g.fillStyle = '#1d1d24'; g.fillRect(bwx + 4, 94, 52, 6);
  g.fillStyle = '#ffd200'; g.font = `8px ${FONT}`; g.fillText('BRATWURST', bwx + 5, 95);
  PITCH.smoke.push({ x: CW - 8 + 4.5, y: 92 });
  // Flutlichtmasten
  PITCH.masts = [6, 34, 66, 94];
  for (const mx of PITCH.masts) { const x = bkx(mx); g.fillStyle = '#5c6470'; g.fillRect(x, 6, 3, 116); g.fillStyle = '#2b2f38'; g.fillRect(x - 9, 2, 21, 9); g.fillStyle = night ? '#fff7d0' : '#d8dde4'; for (let i = 0; i < 4; i++) g.fillRect(x - 8 + i * 5, 4, 4, 5); }
  // Wiese mit Zuschauerhang
  g.fillStyle = night ? '#132a14' : '#4f8a3c'; g.fillRect(0, 110, w, 30);
  // Geländer
  g.fillStyle = '#c9ced4'; g.fillRect(0, 128, w, 1); g.fillStyle = '#8a9099'; for (let x = 0; x < w; x += 14) g.fillRect(x, 128, 1, 6);
  // Banden: lokale Betriebe
  const ads = (ev && ev.ads) || shuffle(ADS);
  let x = bkx(-6), i = 0;
  while (x < bkx(CW + 6)) {
    const txt = ads[i % ads.length], tw2 = Math.max(70, txt.length * 7 + 14), col = [['#14306b', '#ffd200'], ['#f4f4f0', '#c8102e'], ['#0a5a2a', '#f4f4f0'], ['#1d1d24', '#f07d00'], ['#ffd200', '#14306b']][i % 5];
    g.fillStyle = OUTLINE; g.fillRect(x - 1, 134, tw2 + 2, 14); g.fillStyle = col[0]; g.fillRect(x, 135, tw2, 12);
    g.fillStyle = col[1]; g.font = `6px ${FONT}`; g.textAlign = 'center'; g.fillText(txt, x + tw2 / 2, 138); g.textAlign = 'left';
    x += tw2 + 3; i++;
  }
  buildCrowd(homeKit, awayKit, !!(ev && ev.neutral));
}
// Zuschauer am Geländer (3 Bilder: ruhig, Arme hoch, Jubel). Im Kreisliga-Alltag kommen nicht viele
function buildCrowd(homeKit, awayKit, neutral) {
  const home = [homeKit.c1, homeKit.c1, homeKit.c2, '#7a6a5a', '#3a4a6a', '#5a5a5a', '#2d5a3a', '#8a2a2a', '#d8d2c0'], away = [awayKit.c1, awayKit.c2, '#5a5a5a', '#3a4a6a'];
  const n = neutral ? 260 : 110;
  CROWD.forEach((cnv, f) => {
    const g = cnv.getContext('2d'), r = seeded(99); g.clearRect(0, 0, cnv.width, cnv.height);
    for (let i = 0; i < n; i++) {
      const wx = r() * (CW + 4) - 2, x = Math.round(bkx(wx)), gast = neutral ? wx > CW / 2 : wx > CW * 0.78 && wx < CW * 0.9;
      if (!neutral && wx > 38 && wx < 62 && r() < 0.4) continue;
      const pal = gast ? away : home, col = pal[(r() * pal.length) | 0], skin = SKIN[(r() * SKIN.length) | 0][0], hair = HAIR[(r() * HAIR.length) | 0];
      const act = r(), up = f === 0 ? 0 : f === 1 ? (act < 0.4 ? 1 : 0) : (act < 0.75 ? 2 : 1), y = 20 + ((r() * 8) | 0) - up, big = r() < 0.3;
      g.fillStyle = col; g.fillRect(x, y + 3, big ? 6 : 5, 8); g.fillStyle = shade(col, 0.7); g.fillRect(x, y + 3, 1, 8);
      g.fillStyle = '#2a2a33'; g.fillRect(x, y + 11, big ? 6 : 5, 5);
      g.fillStyle = skin; g.fillRect(x + 1, y, 3, 3); g.fillStyle = hair; g.fillRect(x + 1, y, 3, 1);
      if (r() < 0.25) { g.fillStyle = '#f0c040'; g.fillRect(x + 5, y + 5, 2, 3); g.fillStyle = '#ffffff'; g.fillRect(x + 5, y + 4, 2, 1); }   // Bierbecher
      if (up) { g.fillStyle = skin; g.fillRect(x - 1, y - 2 - (up > 1 ? 1 : 0), 1, 4); g.fillRect(x + 5, y - 2 - (up > 1 ? 1 : 0), 1, 4); }
      if (r() < 0.04) { g.fillStyle = '#8a5a2a'; g.fillRect(x + 7, y + 12, 5, 3); g.fillRect(x + 11, y + 10, 2, 2); }   // Hund
      if (f && r() < 0.05) { g.fillStyle = homeKit.c1; g.fillRect(x - 3, y - 7, 10, 5); g.fillStyle = homeKit.c2; g.fillRect(x - 3, y - 5, 10, 1); }
    }
  });
}
function drawSky(t) {
  const top = PITCH_Y0 - CAMY - 3 * DY - 150 * 0.82;
  const gr = ctx.createLinearGradient(0, 0, 0, Math.max(10, top + 90));
  if (PITCH.night) { gr.addColorStop(0, '#05070f'); gr.addColorStop(1, '#1a2244'); } else if (PITCH.wet) { gr.addColorStop(0, '#6d7684'); gr.addColorStop(1, '#a9b0ba'); } else { gr.addColorStop(0, '#5b9bd8'); gr.addColorStop(1, '#bfe0f2'); }
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Math.max(0, top + 120));
  if (!PITCH.night) {
    ctx.fillStyle = PITCH.wet ? 'rgba(200,205,215,0.85)' : 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 6; i++) { const x = ((i * 190 - (CAMX * PX * 0.15) + t * 3) % (W + 200) + W + 200) % (W + 200) - 100, y = top + 10 + (i % 3) * 12; ctx.fillRect(x, y, 46, 6); ctx.fillRect(x + 8, y - 4, 26, 4); ctx.fillRect(x + 20, y - 7, 14, 3); }
  }
}
function drawBack(t, excite) {
  drawSky(t);
  const bottom = sy(TY0), k = KB, x0 = Math.round(W / 2 + (-BX - CAMX) * PX * k), top = bottom - BACKDROP.height;
  ctx.drawImage(BACKDROP, x0, top);
  // Fahnen und Rauch vom Grill
  for (const f of PITCH.flags) { const fx = x0 + f.x, fy = top + f.y + Math.round(Math.sin(t * 3) * 1); ctx.fillStyle = f.k.c1; ctx.fillRect(fx, fy, 16, 10); ctx.fillStyle = f.k.c2; ctx.fillRect(fx, fy + 4, 16, 2); }
  for (const s of PITCH.smoke) for (let i = 0; i < 5; i++) { const ph = (t * 0.6 + i / 5) % 1, sx0 = x0 + bkx(s.x) + Math.sin(t + i) * 3 + ph * 10, sy0 = top + s.y - ph * 40; ctx.fillStyle = `rgba(230,230,230,${(0.35 * (1 - ph)).toFixed(2)})`; ctx.fillRect(Math.round(sx0), Math.round(sy0), 5 + ph * 6, 4 + ph * 4); }
  const fr = excite > 1.2 ? (Math.floor(t * 7) % 2 ? 2 : 1) : excite > 0.4 ? Math.floor(t * 4) % 2 : 0;
  ctx.drawImage(CROWD[fr], x0, top + 96);
  if (PITCH.night) for (const mx of PITCH.masts) { const x = x0 + bkx(mx); const g = ctx.createRadialGradient(x, top + 6, 2, x, top + 6, 40); g.addColorStop(0, 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.fillRect(x - 40, top - 34, 80, 80); }
}
function drawPitch() {
  const r0 = Math.max(0, sy(TY0)), r1 = Math.min(H, sy(CH + 4));
  const base = PITCH_Y0 - CAMY;
  for (let row = r0; row < r1; row++) {
    const wy = (row - base) / DY, ty = Math.round((wy - TY0) * DY); if (ty < 0 || ty >= FIELD.height) continue;
    const k = kOf(wy), dx = W / 2 + (TX0 - CAMX) * PX * k;
    ctx.drawImage(FIELD, 0, ty, TEXW, 1, Math.round(dx), row, Math.round(TEXW * k), 1);
  }
  if (r1 < H) { ctx.fillStyle = PITCH.ground === 1 ? '#5b5d63' : '#3f7a35'; ctx.fillRect(0, r1, W, H - r1); }
  if (PITCH.night) { ctx.fillStyle = 'rgba(10,14,40,0.22)'; ctx.fillRect(0, r0, W, H - r0); }
  else if (PITCH.wet) { ctx.fillStyle = 'rgba(30,40,60,0.12)'; ctx.fillRect(0, r0, W, H - r0); }
}

// ================= Tore, Eckfahnen =================
const P3 = (x, y, z) => [sx(x, y), sy(y, z)];
function linePix(x1, y1, x2, y2, c, w = 1) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) | 0; ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; ctx.fillRect(Math.round(lerp(x1, x2, t)), Math.round(lerp(y1, y2, t)), w, w); }
}
const line3 = (a, b, c, w) => linePix(...P3(...a), ...P3(...b), c, w);
const NET_D = 2.0, NET_H = 1.6;
// Netzausbeulung nach einem Treffer
function netOff(side, y, z) {
  const n = G && G.netHit; if (!n || n.side !== side) return 0;
  const d = Math.hypot(y - n.y, (z - n.z) * 1.2), k = Math.max(0, 1 - n.t / 1.2);
  return Math.max(0, 1 - d / 1.6) * 0.7 * k * (1 + Math.sin(n.t * 18) * 0.25 * k);
}
// hinterer Teil: Netz hinten und oben, hinterer Pfosten. side 0 = Tor links (x = 0), 1 = rechts
function drawGoalBack(side) {
  const gx = side ? CW : 0, s = side ? 1 : -1, bx = gx + s * NET_D, nc = 'rgba(235,235,240,0.55)', nd = 'rgba(200,200,210,0.35)';
  // Rückwand des Netzes (Gitter), mit Ausbeulung
  for (let y = GY1; y <= GY2 + 0.01; y += 0.4) { const o1 = netOff(side, y, NET_H), o0 = netOff(side, y, 0); line3([bx + s * o1, y, NET_H], [bx + s * o0, y, 0], nd); }
  for (let z = 0; z <= NET_H + 0.01; z += 0.4) { let prev = null; for (let y = GY1; y <= GY2 + 0.01; y += 0.4) { const p = [bx + s * netOff(side, y, z), y, z]; if (prev) line3(prev, p, nd); prev = p; } }
  // Dachnetz
  for (let y = GY1; y <= GY2 + 0.01; y += 0.6) line3([gx, y, GH], [bx, y, NET_H], nc);
  line3([bx, GY1, NET_H], [bx, GY2, NET_H], '#d8d8de'); line3([bx, GY1, 0], [bx, GY1, NET_H], '#a8a8b0');
  // hinteres Seitennetz
  for (let k = 0; k <= 1.001; k += 0.25) line3([lerp(gx, bx, k), GY1, 0], [lerp(gx, bx, k), GY1, lerp(GH, NET_H, k)], nd);
  line3([gx, GY1, GH], [bx, GY1, NET_H], nc);
  // hinterer Pfosten und Latte
  const [px, py0] = P3(gx, GY1, 0), [, py1] = P3(gx, GY1, GH);
  ctx.fillStyle = OUTLINE; ctx.fillRect(px - 2, py1 - 1, 4, py0 - py1 + 1); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(px - 1, py1, 2, py0 - py1);
  const a = P3(gx, GY1, GH), b = P3(gx, GY2, GH);
  linePix(a[0], a[1] - 1, b[0], b[1] - 1, OUTLINE, 3); linePix(a[0], a[1], b[0], b[1], '#f4f4f4', 2);
}
// vorderer Teil: vorderes Seitennetz, vorderer Pfosten
function drawGoalFront(side) {
  const gx = side ? CW : 0, s = side ? 1 : -1, bx = gx + s * NET_D, nc = 'rgba(235,235,240,0.5)';
  for (let k = 0; k <= 1.001; k += 0.25) line3([lerp(gx, bx, k), GY2, 0], [lerp(gx, bx, k), GY2, lerp(GH, NET_H, k)], nc);
  line3([gx, GY2, GH], [bx, GY2, NET_H], nc); line3([bx, GY2, 0], [bx, GY2, NET_H], '#b8b8c0');
  const [px, py0] = P3(gx, GY2, 0), [, py1] = P3(gx, GY2, GH);
  ctx.fillStyle = OUTLINE; ctx.fillRect(px - 2, py1 - 1, 5, py0 - py1 + 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1, py1, 3, py0 - py1);
  ctx.fillStyle = '#d0d0d8'; ctx.fillRect(px + 1, py1, 1, py0 - py1);
}
function drawCornerFlag(x, y, t) {
  const [px, py] = P3(x, y, 0), [, pt] = P3(x, y, 1.5);
  ctx.fillStyle = OUTLINE; ctx.fillRect(px - 1, pt - 1, 3, py - pt + 1); ctx.fillStyle = '#f4f4f0'; ctx.fillRect(px, pt, 1, py - pt);
  const wv = Math.round(Math.sin(t * 5 + x) * 1);
  ctx.fillStyle = '#ffd200'; ctx.fillRect(px + 1, pt + wv, 6, 4); ctx.fillStyle = '#e30613'; ctx.fillRect(px + 1, pt + wv, 3, 2); ctx.fillRect(px + 4, pt + 2 + wv, 3, 2);
}
