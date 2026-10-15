// ================= Pixel-Sprites: prozedural, mit Umriss =================
// Kleine Figuren (~28 px), damit viel vom Platz zu sehen ist. Koordinaten relativ zum Fußpunkt, Blick nach rechts
const SW = 28, SH = 44, AX = 14, AY = 40;
const OUTLINE = '#0a0c12';
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];
function drawDigits(g, n, x, y, col, scale = 1) {
  const s = String(n); g.fillStyle = col;
  [...s].forEach((d, k) => { const m = DIGITS[+d]; if (!m) return; for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(x + k * 4 * scale + (i % 3) * scale, y + ((i / 3) | 0) * scale, scale, scale); });
}
const digitsW = (n, scale = 1) => String(n).length * 4 * scale - scale;

// Posen: k Knie, f Fuß, e Ellbogen, h Hand (lf/af vorderes Bein/Arm, lb/ab hinteres), b Rumpfversatz, lean Rumpfneigung
const RUN_LEG = [{ k: [2, -6], f: [3, 0] }, { k: [2, -6], f: [1, 0] }, { k: [0, -6], f: [-2, 0] }, { k: [-1, -6], f: [-4, -3] }, { k: [2, -8], f: [0, -5] }, { k: [4, -8], f: [4, -3] }];
const RUN_ARM = [{ e: [3, -17], h: [5, -15] }, { e: [2, -17], h: [3, -14] }, { e: [0, -16], h: [0, -13] }, { e: [-2, -17], h: [-3, -14] }, { e: [-1, -16], h: [-1, -13] }, { e: [2, -16], h: [3, -14] }];
const runPose = fr => ({ lf: RUN_LEG[fr % 6], lb: RUN_LEG[(fr + 3) % 6], af: RUN_ARM[(fr + 3) % 6], ab: RUN_ARM[fr % 6], b: [1, fr % 3 === 1 ? -1 : 0], lean: 1 });
const POSES = {
  idle: fr => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [2, -16], h: [3, -12] }, ab: { e: [-2, -16], h: [-3, -12] }, b: [0, fr ? 1 : 0] }),
  run: fr => runPose(fr),
  kick1: () => ({ lf: { k: [-1, -7], f: [-4, -4] }, lb: { k: [1, -6], f: [1, 0] }, af: { e: [3, -18], h: [5, -19] }, ab: { e: [-3, -18], h: [-6, -17] }, b: [0, 0], lean: 1 }),
  kick2: () => ({ lf: { k: [3, -8], f: [7, -7] }, lb: { k: [0, -6], f: [-1, 0] }, af: { e: [-2, -18], h: [-5, -19] }, ab: { e: [3, -18], h: [5, -17] }, b: [-1, 0], lean: -1 }),
  pass: () => ({ lf: { k: [3, -6], f: [5, -2] }, lb: { k: [-1, -6], f: [-1, 0] }, af: { e: [-2, -17], h: [-4, -15] }, ab: { e: [3, -17], h: [4, -14] }, b: [0, 0] }),
  head: () => ({ lf: { k: [2, -8], f: [0, -4] }, lb: { k: [-1, -7], f: [-3, -3] }, af: { e: [3, -20], h: [5, -22] }, ab: { e: [-3, -20], h: [-5, -22] }, b: [1, 0], lean: 2 }),
  slide: () => ({ lf: { k: [4, -4], f: [9, -1] }, lb: { k: [1, -3], f: [-2, 0] }, af: { e: [-3, -11], h: [-5, -8] }, ab: { e: [1, -13], h: [3, -12] }, b: [-2, 7], lean: -2 }),
  tackle: () => ({ lf: { k: [4, -5], f: [7, -1] }, lb: { k: [-2, -5], f: [-4, 0] }, af: { e: [3, -17], h: [5, -15] }, ab: { e: [-3, -17], h: [-5, -15] }, b: [1, 2], lean: 2 }),
  cheer: fr => { const r = runPose(fr); r.af = { e: [2, -23], h: [3, -27] }; r.ab = { e: [-2, -23], h: [-3, -27] }; return r; },
  plane: fr => { const r = runPose(fr); r.af = { e: [4, -19], h: [8, -20] }; r.ab = { e: [-4, -19], h: [-8, -20] }; return r; },
  knee: () => ({ lf: { k: [2, -1], f: [-3, 0] }, lb: { k: [0, -1], f: [-4, 0] }, af: { e: [4, -17], h: [7, -20] }, ab: { e: [-4, -17], h: [-7, -20] }, b: [0, 5], lean: -1 }),
  sad: () => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [2, -19], h: [1, -23] }, ab: { e: [-2, -19], h: [-1, -23] }, b: [0, 1], lean: 1 }),
  throw1: () => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [0, -24], h: [-1, -27] }, ab: { e: [-2, -24], h: [-3, -27] }, b: [-1, 0], lean: -2 }),
  throw2: () => ({ lf: { k: [3, -6], f: [4, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [3, -22], h: [6, -23] }, ab: { e: [2, -22], h: [5, -24] }, b: [1, 0], lean: 1 }),
  gk: fr => ({ lf: { k: [3, -5], f: [3, 0] }, lb: { k: [-2, -5], f: [-3, 0] }, af: { e: [4, -15], h: [6, -14 - fr] }, ab: { e: [-4, -15], h: [-6, -14 - fr] }, b: [0, 2], lean: 1 }),
  stretch: () => ({ lf: { k: [1, -6], f: [1, 0] }, lb: { k: [-1, -6], f: [-1, 0] }, af: { e: [1, -24], h: [1, -28] }, ab: { e: [-1, -24], h: [-1, -28] }, b: [0, 0] }),
  hold: () => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [3, -16], h: [4, -18] }, ab: { e: [1, -16], h: [3, -18] }, b: [0, 0] }),
  sit: () => ({ lf: { k: [4, -6], f: [4, 0] }, lb: { k: [3, -6], f: [3, 0] }, af: { e: [2, -12], h: [4, -10] }, ab: { e: [-2, -12], h: [2, -9] }, b: [0, 5] }),
  flag: () => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [2, -23], h: [2, -27] }, ab: { e: [-2, -16], h: [-3, -12] }, b: [0, 0] }),
  card: () => ({ lf: { k: [2, -6], f: [2, 0] }, lb: { k: [-1, -6], f: [-2, 0] }, af: { e: [2, -23], h: [3, -28] }, ab: { e: [-2, -16], h: [-3, -12] }, b: [0, 0] }),
};
// Hand je Pose (für den Ball beim Torwart und Einwurf)
const HAND = { hold: [4, -18], throw1: [-2, -28], throw2: [6, -24], stretch: [1, -29] };

// Trikot: c1 Grundfarbe, c2 Absetzfarbe, pat Muster, sh Hose, so Stutzen. Torwart: eigene Farbe gk
function kitLook(kit, gk) {
  const c1 = gk ? kit.gk : kit.c1, c2 = gk ? shade(kit.gk, 0.55) : kit.c2;
  const sh = gk ? '#1d1d24' : kit.sh || (colDist(kit.c2, kit.c1) > 90 ? kit.c2 : '#1d1d24');
  return { c1, c2, pat: gk ? 0 : kit.pat || 0, sh, so: gk ? c1 : kit.so || c1 };
}
function lookOf(p, kit, gk = p.grp === 'TW') {
  const k = kitLook(kit, gk), sk = SKIN[p.skin ?? 1];
  return { ...k, gk, jerS: shade(k.c1, 0.72), jerH: mix(k.c1, '#ffffff', 0.3), skin: sk[0], skinS: sk[1], hair: p.hair || '#2a1a10', style: p.style ?? 1, beard: !!p.beard, belly: !!p.belly, tall: p.tall ? 1 : 0, socks: !!p.socks,
    shoe: (p.num || 0) % 3 === 0 ? '#1a1a1e' : (p.num || 0) % 3 === 1 ? '#f2f2f2' : '#d23a2a', num: p.num || 0,
    key: `${k.c1}|${k.c2}|${k.pat}|${k.sh}|${k.so}|${p.skin}|${p.hair}|${p.style}|${+!!p.beard}|${+!!p.belly}|${+!!p.tall}|${+!!p.socks}|${p.num}|${+gk}` };
}
const SPR = new Map();
function sprite(look, pose, fr, flip = false) {
  const key = look.key + '|' + pose + '|' + fr + '|' + +flip;
  let c = SPR.get(key); if (c) return c;
  c = renderSprite(look, pose, fr, flip); SPR.set(key, c);
  if (SPR.size > 9000) SPR.clear();
  return c;
}
function renderSprite(L, pose, fr, flip = false) {
  const base = document.createElement('canvas'); base.width = SW; base.height = SH;
  const g = base.getContext('2d');
  const P = (POSES[pose] || POSES.idle)(fr);
  const t = L.tall ? -1 : 0;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(flip ? AX - x - w : AX + x, AY + y, w, h); };
  const brush = (x1, y1, x2, y2, w, c) => { const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1); for (let i = 0; i <= n; i++) { const k = i / n; R(Math.round(lerp(x1, x2, k) - (w >> 1)), Math.round(lerp(y1, y2, k) - (w >> 1)), w, w, c); } };
  const [bx, by] = P.b, lean = P.lean || 0;
  const hipY = -12 + by + t, shY = -21 + by + t, hx = bx;
  const leg = (Lg, back) => {
    const hip = [hx + (back ? -1 : 1), hipY], [kx, ky] = Lg.k, [fx, fy] = Lg.f;
    const kyy = ky + by * (Lg === P.lf || Lg === P.lb ? 0 : 0);
    const d = back ? 0.75 : 1, skin = back ? L.skinS : L.skin, sock = shade(L.so, d);
    brush(hip[0], hip[1], kx, kyy, 2, skin);
    const mx = Math.round(lerp(kx, fx, L.socks ? 0.6 : 0.3)), my = Math.round(lerp(kyy, fy, L.socks ? 0.6 : 0.3));
    brush(kx, kyy, mx, my, 2, skin);
    brush(mx, my, fx, fy - 1, 2, sock);
    R(fx - 1, fy - 1, 4, 2, shade(L.shoe, d)); R(fx - 1, fy, 4, 1, back ? '#55555c' : '#2a2a30');
  };
  const arm = (A, back) => {
    const sh = [hx + lean + (back ? -2 : 2), shY + 1], ex = A.e[0] + bx, ey = A.e[1] + by + t, hx2 = A.h[0] + bx, hy = A.h[1] + by + t;
    const skin = back ? L.skinS : L.skin, sl = back ? L.jerS : L.c1;
    brush(sh[0], sh[1], Math.round(lerp(sh[0], ex, 0.8)), Math.round(lerp(sh[1], ey, 0.8)), 2, sl);   // Ärmel
    brush(Math.round(lerp(sh[0], ex, 0.8)), Math.round(lerp(sh[1], ey, 0.8)), ex, ey, 2, skin);
    brush(ex, ey, hx2, hy, 2, skin);
    if (L.gk) R(hx2 - 1, hy - 1, 3, 3, '#e8e8ea'); else R(hx2, hy, 2, 2, skin);   // Torwarthandschuhe
  };
  leg(P.lb, true); arm(P.ab, true);
  leg(P.lf, false);
  // Hose
  R(hx - 3, hipY - 1, 7, 4, L.sh); R(hx - 3, hipY - 1, 1, 4, shade(L.sh, 0.75)); R(hx - 3, hipY + 2, 3, 1, shade(L.sh, 0.7));
  // Trikot: Rumpf von den Schultern bis zur Hüfte, mit Neigung und optional Bauch
  const tH = hipY - shY;
  for (let r = 0; r < tH; r++) {
    const k = r / Math.max(1, tH - 1), y = shY + r, off = Math.round(lean * (1 - k));
    const right = 3 + (L.belly && k > 0.45 ? 1 : 0), left = -3;
    for (let x = left; x < right; x++) {
      let c = L.c1;
      if (L.pat === 1 && ((x + 10) % 2 === 0)) c = L.c2;
      else if (L.pat === 2 && (r >> 1) % 2 === 1) c = L.c2;
      else if (L.pat === 3 && r >= 3 && r <= 4) c = L.c2;
      if (x === left) c = shade(c, 0.75); else if (x === right - 1 && k < 0.6) c = mix(c, '#ffffff', 0.25);
      R(hx + off + x, y, 1, 1, c);
    }
  }
  R(hx + lean - 1, shY, 3, 1, L.c2);   // Kragen
  // Kopf
  const hy = shY - 6, hxx = hx + lean - 2;
  R(hx + lean, shY - 1, 2, 1, L.skinS);
  R(hxx, hy, 5, 5, L.skin); R(hxx + 1, hy + 5, 3, 1, L.skin); R(hxx, hy, 1, 5, L.skinS);
  R(hxx + 3, hy + 2, 1, 1, '#1a1010'); R(hxx + 4, hy + 3, 1, 1, L.skinS);
  const Hc = L.hair, HL = mix(Hc, '#ffffff', 0.25);
  switch (L.style) {
    case 0: R(hxx, hy - 1, 5, 2, Hc); R(hxx, hy, 1, 3, Hc); R(hxx + 2, hy - 1, 2, 1, HL); break;          // kurz mit Pony
    case 1: R(hxx, hy - 1, 5, 1, Hc); R(hxx, hy, 1, 2, Hc); break;                                       // kurz
    case 2: R(hxx - 1, hy - 1, 6, 2, Hc); R(hxx - 1, hy, 2, 5, Hc); break;                               // länger
    case 3: R(hxx + 1, hy, 2, 1, mix(L.skin, '#fff', 0.4)); break;                                         // Glatze
    case 4: R(hxx - 1, hy - 2, 7, 3, Hc); R(hxx - 1, hy, 2, 4, Hc); R(hxx, hy - 2, 3, 1, HL); break;       // Locken
    default: R(hxx, hy - 1, 5, 1, Hc); R(hxx - 2, hy, 3, 2, Hc); R(hxx - 1, hy + 2, 1, 2, Hc);            // Zopf
  }
  if (L.beard) { R(hxx + 1, hy + 4, 4, 2, shade(Hc, 0.9)); }
  arm(P.af, false);
  // äußere Kontur
  const out = document.createElement('canvas'); out.width = SW; out.height = SH;
  const o = out.getContext('2d'), src = g.getImageData(0, 0, SW, SH), dst = o.createImageData(SW, SH), s = src.data, d = dst.data;
  const oc = hexRgb(OUTLINE);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4;
    if (s[i + 3] > 0) { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = 255; continue; }
    const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < SW && yy < SH && s[(yy * SW + xx) * 4 + 3] > 0;
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255; }
  }
  o.putImageData(dst, 0, 0);
  return out;
}
// gedrehte Sprites: liegend (Foul) und Torwart im Flug
function rotSprite(look, pose, ang, flip) {
  const key = look.key + '|rot|' + pose + '|' + ang + '|' + +flip; let c = SPR.get(key); if (c) return c;
  const s = sprite(look, pose, 0, flip); c = document.createElement('canvas'); c.width = SH; c.height = SH;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(SH / 2, SH / 2); g.rotate(ang * Math.PI / 180); g.drawImage(s, -AX, -AY + 12); SPR.set(key, c); return c;
}

// ================= Porträts für Spielerkarten =================
const PORT = new Map();
function portrait(p, kit) {
  const L = lookOf(p, kit), key = L.key + '|port';
  if (PORT.has(key)) return PORT.get(key);
  const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (let y = 0; y < 40; y++) R(0, y, 40, 1, mix('#2f6b34', '#8fc26a', y / 40));
  for (let i = 0; i < 40; i += 6) R(i, 0, 3, 40, 'rgba(255,255,255,0.05)');
  // Trikot mit Kragen und Ärmeln
  R(3, 31, 34, 9, L.c1); R(3, 31, 6, 9, L.jerS); R(31, 32, 5, 8, L.jerH);
  if (L.pat === 1) for (let x = 5; x < 37; x += 4) R(x, 31, 2, 9, L.c2);
  if (L.pat === 2) { R(3, 34, 34, 2, L.c2); R(3, 38, 34, 2, L.c2); }
  if (L.pat === 3) R(3, 35, 34, 3, L.c2);
  R(14, 30, 12, 2, L.c2); R(16, 31, 8, 2, L.skinS);
  R(16, 25, 8, 7, L.skinS);
  R(11, 9, 18, 19, L.skin); R(11, 9, 3, 19, L.skinS); R(13, 26, 14, 2, L.skinS); R(9, 15, 2, 5, L.skinS); R(29, 15, 2, 5, L.skinS);
  R(14, 15, 4, 2, '#fff'); R(22, 15, 4, 2, '#fff'); R(16, 15, 2, 2, '#1a1010'); R(24, 15, 2, 2, '#1a1010');
  R(14, 13, 4, 1, shade(L.hair, 0.7)); R(22, 13, 4, 1, shade(L.hair, 0.7));
  R(19, 17, 2, 4, L.skinS); R(18, 21, 4, 1, shade(L.skinS, 0.85)); R(16, 23, 8, 1, shade(L.skinS, 0.75));
  if (L.belly) { R(11, 24, 18, 4, L.skin); R(11, 26, 2, 3, L.skinS); }   // Doppelkinn
  const Hc = L.hair;
  switch (L.style) {
    case 0: R(11, 6, 18, 5, Hc); R(10, 8, 2, 7, Hc); R(28, 8, 2, 6, Hc); R(14, 6, 6, 1, mix(Hc, '#fff', 0.25)); break;
    case 1: R(11, 7, 18, 3, Hc); R(10, 9, 1, 5, Hc); R(29, 9, 1, 5, Hc); break;
    case 2: R(10, 5, 20, 6, Hc); R(8, 8, 3, 14, Hc); R(29, 8, 3, 14, Hc); break;
    case 3: R(15, 10, 5, 1, mix(L.skin, '#fff', 0.45)); break;
    case 4: R(8, 2, 24, 9, Hc); R(7, 6, 4, 10, Hc); R(29, 6, 4, 10, Hc); R(12, 3, 6, 1, mix(Hc, '#fff', 0.25)); break;
    default: R(11, 6, 18, 4, Hc); R(28, 8, 6, 4, Hc); R(32, 11, 3, 6, Hc); R(10, 8, 2, 5, Hc);
  }
  if (L.beard) { R(12, 21, 16, 7, shade(Hc, 0.9)); R(16, 22, 8, 1, L.skinS); R(16, 23, 8, 1, shade(L.skinS, 0.75)); }
  if (L.gk) { R(3, 31, 34, 2, shade(L.c1, 0.6)); }
  PORT.set(key, c); return c;
}
// Trikot-Symbol (mit Ärmeln und Muster) für Auswahl und Tabellen
const JICON = new Map();
function jerseyIcon(K) {
  const key = `${K.c1}|${K.c2}|${K.pat}`; if (JICON.has(key)) return JICON.get(key);
  const c = document.createElement('canvas'); c.width = 24; c.height = 24; const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const body = [[0, 3, 24, 7], [5, 2, 14, 21]];
  R(0, 3, 24, 8, OUTLINE); R(4, 1, 16, 23, OUTLINE);
  R(1, 4, 22, 6, K.c1); R(5, 2, 14, 21, K.c1);
  if (K.pat === 1) for (let x = 6; x < 19; x += 3) R(x, 2, 1, 21, K.c2);
  if (K.pat === 2) for (let y = 5; y < 23; y += 4) R(5, y, 14, 2, K.c2);
  if (K.pat === 3) R(5, 9, 14, 3, K.c2);
  R(1, 8, 4, 2, K.c2); R(19, 8, 4, 2, K.c2);   // Ärmelbündchen
  R(9, 2, 6, 2, K.c2); R(10, 2, 4, 1, OUTLINE);   // Kragen
  R(5, 3, 2, 20, shade(K.c1, 0.8));
  void body;
  JICON.set(key, c); return c;
}
const iconURL = K => { const k = 'u|' + K.c1 + K.c2 + K.pat; if (!JICON.has(k)) JICON.set(k, jerseyIcon(K).toDataURL()); return JICON.get(k); };
