/* Kreisliga-Legenden: Story-Film der Landingpage (Technik aus Hallen- und Korb-Legenden).
   Eine Pixel-Figur läuft beim Scrollen von links nach rechts durch sieben Szenen: Dorfsportplatz am Sonntag, der Schuss ins Netz,
   die Deutschlandkarte im Vereinsheim, das Kreisblatt an der Theke, der Kreispokal, der Vereinsbus zu den Playoffs und das Endspiel
   unter Flutlicht um die Goldene Eckfahne. Die Karte kommt aus src/d_karte.js (wird vorher geladen). */
(() => {
'use strict';

// ================= Helfer (wie src/p01_core.js) =================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const seg = (q, a, b) => clamp((q - a) / (b - a), 0, 1); // 0..1 innerhalb [a, b]
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const c = hexRgb(h); return rgbHex(c[0] * f, c[1] * f, c[2] * f); }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)); }
const lum = h => { const c = hexRgb(h); return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; };
const hash = (i, j = 0) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const SKIN = [['#f3c9a2', '#d9a47c'], ['#e6b085', '#c98d62'], ['#c98c5c', '#a96d43'], ['#9a6440', '#7a4a2c'], ['#6e4428', '#52301b']];

// ================= Sprites (Port aus src/p03_sprites.js) =================
const SW = 36, SH = 56, AX = 18, AY = 53;
const OUTLINE = '#0b0910';
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];
function drawDigits(g, n, x, y, col) {
  const s = String(n); g.fillStyle = col;
  [...s].forEach((d, k) => { const m = DIGITS[+d]; for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(x + k * 4 + (i % 3), y + ((i / 3) | 0), 1, 1); });
}
const digitsW = n => String(n).length * 4 - 1;
const RUN_LEG = [{ k: [4, -12], f: [6, 0] }, { k: [3, -11], f: [2, 0] }, { k: [1, -11], f: [-3, -1] }, { k: [-1, -12], f: [-7, -6] }, { k: [4, -15], f: [0, -9] }, { k: [7, -15], f: [7, -6] }];
const RUN_ARM = [{ e: [4, -24], h: [8, -28] }, { e: [2, -23], h: [6, -25] }, { e: [-1, -23], h: [1, -19] }, { e: [-4, -24], h: [-4, -19] }, { e: [-2, -23], h: [0, -19] }, { e: [2, -23], h: [6, -24] }];
function runPose(fr, ball) {
  return { lf: RUN_LEG[fr % 6], lb: RUN_LEG[(fr + 3) % 6], af: ball ? { e: [5, -24], h: [9, -19 + (fr % 3)] } : RUN_ARM[(fr + 3) % 6], ab: RUN_ARM[fr % 6], b: [1, fr % 3 === 1 ? -1 : 0] };
}
// ruhiger Gang für den Manager: kürzere Schritte, Arme schwingen wenig
const WALK_LEG = [{ k: [3, -11], f: [5, 0] }, { k: [2, -11], f: [1, 0] }, { k: [0, -11], f: [-3, 0] }, { k: [-1, -11], f: [-5, -2] }, { k: [2, -13], f: [0, -4] }, { k: [4, -12], f: [5, -2] }];
const WALK_ARM = [{ e: [3, -24], h: [6, -19] }, { e: [2, -24], h: [4, -18] }, { e: [0, -24], h: [1, -18] }, { e: [-2, -24], h: [-3, -18] }, { e: [-1, -24], h: [-1, -18] }, { e: [1, -24], h: [3, -18] }];
const POSES = {
  idle: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [4, -24], h: [5, -18] }, ab: { e: [-4, -24], h: [-5, -18] }, b: [0, fr ? 1 : 0] }),
  run: fr => runPose(fr, false),
  drib: fr => runPose(fr, true),
  walk: fr => ({ lf: WALK_LEG[fr % 6], lb: WALK_LEG[(fr + 3) % 6], af: WALK_ARM[(fr + 3) % 6], ab: WALK_ARM[fr % 6], b: [0, fr % 3 === 1 ? -1 : 0] }),
  hold: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [5, -25], h: [9, -22] }, ab: { e: [-2, -25], h: [6, -21] }, b: [0, fr ? 1 : 0] }),
  bounce: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [5, -24], h: [9, -19 + fr] }, ab: { e: [-4, -24], h: [-5, -18] }, b: [0, fr ? 1 : 0] }),
  wind: fr => ({ lf: fr ? { k: [6, -15], f: [3, -8] } : { k: [5, -10], f: [7, 0] }, lb: fr ? { k: [-2, -12], f: [-7, -7] } : { k: [-3, -11], f: [-6, 0] }, af: { e: [-3, -37], h: [-6, -43] }, ab: { e: [5, -29], h: [11, -31] }, b: [-1, 0] }),
  throw: fr => ({ lf: fr ? { k: [6, -13], f: [7, -6] } : { k: [6, -10], f: [8, 0] }, lb: fr ? { k: [-2, -12], f: [-7, -8] } : { k: [-2, -11], f: [-7, -1] }, af: { e: [7, -31], h: [12, -26] }, ab: { e: [-5, -27], h: [-9, -24] }, b: [2, 0] }),
  star: () => ({ lf: { k: [5, -10], f: [10, -2] }, lb: { k: [-5, -10], f: [-10, -2] }, af: { e: [8, -37], h: [12, -46] }, ab: { e: [-8, -37], h: [-12, -46] }, b: [0, 0] }),
  gk: fr => ({ lf: { k: [6, -9], f: [6, 0] }, lb: { k: [-5, -9], f: [-6, 0] }, af: { e: [8, -27], h: [10, -33 - fr] }, ab: { e: [-7, -27], h: [-9, -33 - fr] }, b: [0, 3] }),
  cheer: fr => { const r = runPose(fr, false); r.af = { e: [5, -39], h: [7, -47] }; r.ab = { e: [-4, -39], h: [-5, -47] }; return r; },
  jubel: fr => ({ lf: { k: [4, -11], f: [5, 0] }, lb: { k: [-3, -11], f: [-4, 0] }, af: { e: [5, -38], h: [7, -46 - fr] }, ab: { e: [-4, -38], h: [-5, -46 - fr] }, b: [0, fr ? -1 : 0] }),
  sit: () => ({ lf: { k: [6, -9], f: [6, 0] }, lb: { k: [5, -9], f: [5, 0] }, af: { e: [4, -18], h: [7, -16] }, ab: { e: [-3, -18], h: [3, -15] }, b: [0, 7] }),
  read: fr => ({ lf: { k: [6, -9], f: [6, 0] }, lb: { k: [5, -9], f: [5, 0] }, af: { e: [6, -19], h: [11, -24 - fr] }, ab: { e: [1, -19], h: [9, -25 - fr] }, b: [0, 7] }),
  lift: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [4, -39], h: [3, -47 - fr] }, ab: { e: [-3, -39], h: [1, -47 - fr] }, b: [0, fr ? -1 : 0] }),
  point: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [8, -30], h: [14, -33 - fr] }, ab: { e: [-4, -24], h: [-5, -18] }, b: [0, 0] }),
  // Fußball: Schuss (Standbein, Schussbein schwingt durch), Torwart-Hechtsprung, Kopfball-Jubel mit Becker-Faust
  kick: fr => fr ? ({ lf: { k: [7, -14], f: [13, -12] }, lb: { k: [-1, -11], f: [-2, 0] }, af: { e: [-4, -27], h: [-9, -26] }, ab: { e: [6, -27], h: [10, -24] }, b: [-1, 0] })
    : ({ lf: { k: [-2, -12], f: [-8, -5] }, lb: { k: [1, -11], f: [2, 0] }, af: { e: [5, -27], h: [9, -27] }, ab: { e: [-5, -27], h: [-9, -25] }, b: [0, 0] }),
  dive: () => ({ lf: { k: [-3, -10], f: [-9, -8] }, lb: { k: [-5, -9], f: [-11, -6] }, af: { e: [7, -33], h: [13, -38] }, ab: { e: [5, -35], h: [11, -42] }, b: [0, 2] }),
  faust: fr => ({ lf: { k: [3, -11], f: [3, 0] }, lb: { k: [-2, -11], f: [-3, 0] }, af: { e: [7, -28], h: [7, -34 - fr] }, ab: { e: [-4, -24], h: [-5, -18] }, b: [0, 0] }),
};

function look(o) {
  const sk = SKIN[o.skin], jer = o.jer, trim = o.trim;
  const L = { gk: !!o.gk, suit: !!o.suit, jer, jerS: shade(jer, 0.7), jerH: mix(jer, '#ffffff', 0.3), trim, sho: o.sho, sock: o.sock || jer, shoe: o.shoe,
    skin: sk[0], skinS: sk[1], hair: o.hair, style: o.style, beard: !!o.beard, band: !!o.band, num: o.num, tall: !!o.tall,
    numCol: lum(jer) > 0.6 ? shade(trim, 0.9) : '#ffffff' };
  L.key = JSON.stringify(o);
  return L;
}

const SPR = new Map();
function sprite(L, pose, fr = 0, flip = false) {
  const key = L.key + '|' + pose + '|' + fr + '|' + +flip;
  let c = SPR.get(key); if (!c) { c = renderSprite(L, pose, fr, flip); SPR.set(key, c); }
  return c;
}
function renderSprite(L, pose, fr, flip) {
  const base = document.createElement('canvas'); base.width = SW; base.height = SH;
  const g = base.getContext('2d');
  const P = (POSES[pose] || POSES.idle)(fr);
  const t = L.tall ? -1 : 0, pants = L.gk || L.suit;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(flip ? AX - x - w : AX + x, AY + y, w, h); };
  const brush = (x1, y1, x2, y2, w, c) => { const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1); for (let i = 0; i <= n; i++) { const k = i / n; R(Math.round(lerp(x1, x2, k) - (w >> 1)), Math.round(lerp(y1, y2, k) - (w >> 1)), w, w, c); } };
  const limb = (segs, outline) => { if (outline) segs.forEach(s => brush(s[0], s[1], s[2], s[3], s[4] + 2, OUTLINE)); segs.forEach(s => brush(...s)); };
  const [bx, by] = P.b;
  const hipY = -19 + by + t, shY = -32 + by + t * 2, hx = bx;
  const leg = (Lg, back) => {
    const hip = [hx + (back ? -2 : 2), hipY], [kx, ky] = Lg.k, [fx, fy] = Lg.f, mx = (kx + fx) / 2, my = (ky + fy) / 2;
    const d = back ? 0.72 : 1, skin = back ? L.skinS : L.skin, sock = shade(L.sock, d), pant = shade(L.sho, back ? 0.75 : 1);
    if (pants) limb([[hip[0], hip[1], kx, ky, 4, pant], [kx, ky, fx, fy - 2, 4, pant]], !back);
    else limb([[hip[0], hip[1], kx, ky, 4, skin], [kx, ky, mx, my, 3, skin], [mx, my, fx, fy - 2, 3, sock]], !back);
    if (!back && !pants) R(kx, ky - 1, 1, 1, mix(L.skin, '#ffffff', 0.3));
    if (!back) R(fx - 2, fy - 3, 7, 4, OUTLINE);
    R(fx - 1, fy - 2, 5, 2, shade(L.shoe, d)); R(fx - 1, fy, 5, 1, back ? '#3a3a40' : '#55555c');
    if (!L.suit) R(fx + 1, fy - 2, 1, 2, shade(L.trim, d)); else if (!back) R(fx + 2, fy - 2, 2, 1, '#4a4652');
  };
  const arm = (A, back) => {
    const sh = [hx + (back ? -3 : 3), shY + 2], ex = A.e[0] + bx, ey = A.e[1] + by + t, hx2 = A.h[0] + bx, hy = A.h[1] + by + t;
    const skin = back ? L.skinS : L.skin, jer = back ? L.jerS : L.jer;
    const sx2 = lerp(sh[0], ex, 0.45), sy2 = lerp(sh[1], ey, 0.45);
    limb(pants ? [[sh[0], sh[1], ex, ey, 3, jer], [ex, ey, hx2, hy, 3, jer]] : [[sh[0], sh[1], ex, ey, 3, skin], [sh[0], sh[1], sx2, sy2, 4, jer], [ex, ey, hx2, hy, 2, skin]], !back);
    if (L.suit) R(Math.round(lerp(ex, hx2, 0.8)) - 1, Math.round(lerp(ey, hy, 0.8)), 3, 1, '#f3ead6'); // Hemdmanschette
    R(hx2 - 1, hy - 1, 3, 3, L.gk ? '#ececec' : skin); R(hx2 - 1, hy + 1, 3, 1, L.gk ? '#bdbdbd' : L.skinS);
    if (!pants && !back && L.band) R(Math.round(lerp(ex, hx2, 0.7)) - 1, Math.round(lerp(ey, hy, 0.7)), 3, 1, L.trim);
  };
  leg(P.lb, true); arm(P.ab, true);
  leg(P.lf, false);
  R(hx - 5, hipY - 2, 10, 6, L.sho); R(hx - 5, hipY - 2, 2, 6, shade(L.sho, 0.78));
  if (!L.suit) R(hx + 4, hipY - 1, 1, 4, L.trim);
  R(hx - 5, hipY + 3, 4, 1, shade(L.sho, 0.65)); R(hx + 1, hipY + 3, 4, 1, shade(L.sho, 0.85));
  const tH = hipY - 1 - shY;
  for (let r = 0; r < tH; r++) {
    const k = r / Math.max(1, tH - 1), l = Math.round(lerp(-6, -4, k)), rr = Math.round(lerp(5, 4, k)), y = shY + r;
    R(hx + l, y, rr - l + 1, 1, L.jer); R(hx + l, y, 3, 1, L.jerS); R(hx + rr, y, 1, 1, r < tH * 0.6 ? L.jerH : L.jer);
  }
  if (L.suit) {
    // Sakko: Hemd im V-Ausschnitt, Krawatte, Revers, Knöpfe, Einstecktuch
    for (let r = 0; r < 7; r++) { const w = Math.max(2, 6 - r); R(hx - (w >> 1) + 1, shY + r, w, 1, '#f3ead6'); }
    R(hx, shY + 1, 2, 1, '#b8321f'); R(hx, shY + 2, 2, 7, L.trim); R(hx + 1, shY + 2, 1, 7, shade(L.trim, 0.75)); R(hx, shY + 9, 2, 1, shade(L.trim, 0.6));
    R(hx - 3, shY + 1, 1, 6, shade(L.jer, 0.6)); R(hx + 4, shY + 1, 1, 6, shade(L.jer, 0.6));
    R(hx + 1, shY + 9, 1, 1, '#c9c2b0'); R(hx + 1, shY + 11, 1, 1, '#c9c2b0');
    R(hx - 5, shY + 3, 2, 1, '#ffc83a');
    R(hx - 6, shY, 12, 1, shade(L.jer, 0.8)); R(hx - 1, shY, 4, 1, '#f3ead6');
  } else {
    R(hx - 6, shY, 12, 1, L.trim); R(hx - 1, shY, 4, 2, L.skinS); R(hx, shY + 2, 2, 1, L.trim);
    const dx0 = AX + hx - Math.floor(digitsW(L.num) / 2) + 1;
    drawDigits(g, L.num, flip ? 2 * AX - dx0 - digitsW(L.num) : dx0, AY + shY + 4, L.numCol);
  }
  R(hx - 4, hipY - 2, 9, 1, shade(L.jer, 0.8));
  const hy = shY - 10, hxx = hx - 3;
  R(hx - 1, shY - 2, 4, 3, L.skinS);
  R(hxx + 1, hy, 6, 9, L.skin); R(hxx, hy + 1, 8, 7, L.skin); R(hxx + 8, hy + 3, 1, 3, L.skin);
  R(hxx, hy + 1, 2, 7, L.skinS); R(hxx + 2, hy + 8, 5, 1, L.skinS);
  R(hxx + 2, hy + 4, 2, 2, shade(L.skinS, 0.85));
  R(hxx + 5, hy + 3, 2, 2, '#f4f0ea'); R(hxx + 6, hy + 3, 1, 2, '#1a1010');
  R(hxx + 5, hy + 2, 3, 1, shade(L.hair, 0.75)); R(hxx + 7, hy + 7, 1, 1, shade(L.skinS, 0.8));
  R(hxx + 4, hy + 1, 2, 1, mix(L.skin, '#ffffff', 0.35));
  const H = L.hair, HL = mix(H, '#ffffff', 0.25);
  switch (L.style) {
    case 0: R(hxx + 1, hy - 1, 7, 2, H); R(hxx, hy, 2, 4, H); R(hxx + 3, hy - 1, 3, 1, HL); break;
    case 1: R(hxx + 1, hy - 1, 6, 1, H); R(hxx, hy, 1, 3, H); break;
    case 2: R(hxx, hy - 2, 8, 3, H); R(hxx - 1, hy, 3, 8, H); R(hxx, hy + 1, 8, 1, L.trim); R(hxx + 2, hy - 2, 3, 1, HL); break;
    case 3: R(hxx + 3, hy + 1, 2, 1, mix(L.skin, '#fff', 0.45)); break;
    case 4: R(hxx, hy - 3, 9, 4, H); R(hxx - 1, hy - 1, 3, 6, H); R(hxx + 2, hy - 3, 3, 1, HL); break;
    default: R(hxx + 1, hy - 1, 7, 2, H); R(hxx - 2, hy - 2, 3, 3, H); R(hxx, hy, 1, 4, H);
  }
  if (L.beard) { R(hxx + 2, hy + 6, 6, 3, shade(H, 0.9)); R(hxx + 6, hy + 7, 2, 1, L.skinS); }
  arm(P.af, false);
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


// ================= Figuren =================
// Die Legende im Vereinstrikot (Rot-Weiß, Nummer 9), Gegner in Blau, der Torwart in Grün, Zuschauer am Geländer
const HERO = look({ jer: '#c8102e', trim: '#f3ead6', sho: '#f3ead6', sock: '#c8102e', shoe: '#17141c', skin: 1, hair: '#4a2a17', style: 0, num: 9 });
const KEEPER = look({ gk: true, jer: '#3ddc84', trim: '#14214d', sho: '#1d1d24', sock: '#1d1d24', shoe: '#17141c', skin: 0, hair: '#d9b25a', style: 4, num: 1, tall: true });
const FAN = [
  look({ jer: '#c8102e', trim: '#f3ead6', sho: '#2a2440', shoe: '#17141c', skin: 0, hair: '#8a7f66', style: 3, beard: true, num: 12 }),
  look({ jer: '#2f56b0', trim: '#f3ead6', sho: '#2a2440', shoe: '#17141c', skin: 2, hair: '#1a1210', style: 1, num: 4 }),
  look({ jer: '#3a2f4d', trim: '#ffc83a', sho: '#2a2440', shoe: '#17141c', skin: 1, hair: '#4a2a17', style: 2, num: 7 }),
];

// ================= Szenen und Zeitachse =================
// w = Breite der Szene in Welt-Pixeln, at = Haltepunkt der Figur, act = Länge der Aktion (Scroll-Einheiten)
const SCENES = [
  { id: 'platz', w: 520, at: 0, act: 0, label: 'ANPFIFF' },
  { id: 'tor', w: 440, at: 90, act: 300, cam: 0.12, need: 190, label: 'DER SCHUSS' },
  { id: 'karte', w: 460, at: 120, act: 300, cam: 0.14, need: 200, label: 'GANZ DEUTSCHLAND' },
  { id: 'kreisblatt', w: 400, at: 180, act: 240, cam: 0.36, need: 60, label: 'KREISBLATT' },
  { id: 'pokal', w: 420, at: 200, act: 240, cam: 0.42, need: 60, label: 'KREISPOKAL' },
  { id: 'bus', w: 520, at: 150, act: 260, cam: 0.2, need: 220, label: 'PLAYOFFS' },
  { id: 'finale', w: 560, at: 250, act: 160, cam: 0.42, need: 126, label: 'ENDSPIEL' },
];
let acc = 0;
SCENES.forEach(s => { s.x = acc; acc += s.w; });
const WORLD = acc;
const INTRO = { x: 90, len: 130 };

const TL = [];
(() => {
  let u = 0, x = INTRO.x;
  TL.push({ u0: u, u1: u += INTRO.len, hold: true, x, scene: SCENES[0], kind: 'intro' });
  SCENES.forEach(s => {
    if (!s.act) return;
    const tx = s.x + s.at;
    TL.push({ u0: u, u1: u += tx - x, hold: false, x0: x, x1: tx });
    TL.push({ u0: u, u1: u += s.act, hold: true, x: tx, scene: s, kind: s.id });
    x = tx;
  });
  TL.total = u;
})();
function stateAt(u) {
  u = clamp(u, 0, TL.total);
  let e = TL[TL.length - 1];
  for (const s of TL) if (u <= s.u1) { e = s; break; }
  const q = (u - e.u0) / Math.max(1, e.u1 - e.u0);
  const x = e.hold ? e.x : lerp(e.x0, e.x1, q);
  const scene = [...SCENES].reverse().find(s => x >= s.x);
  return { u, x, q, hold: e.hold, kind: e.hold ? e.kind : 'walk', seg: e, scene };
}

// ================= Zeichnen =================
const cv = document.getElementById('story');
const g = cv.getContext('2d');
let W = 320, H = 180, FY = 158, cam = 0, T = 0, SCALE = 4;
const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const sx = wx => Math.round(wx - cam);
const PIX = '"Press Start 2P", monospace';
function text(s, x, y, c, size = 8, align = 'left') { g.font = `${size}px ${PIX}`; g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = c; g.fillText(s, Math.round(x), Math.round(y)); }
function glow(x, y, r, c, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c.replace('A', a)); gr.addColorStop(1, c.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
function ellipse(x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function drawSprite(L, pose, fr, wx, lift = 0, flip = false, shadow = true) {
  const x = sx(wx);
  if (shadow) ellipse(x, FY, 7, 1.6, 'rgba(0,0,0,.4)');
  g.drawImage(sprite(L, pose, fr, flip), x - AX, Math.round(FY - AY - lift));
}
function ball(x, y) { // Fußball, 5 px: weiß mit schwarzen Flecken
  R(x - 2, y - 3, 5, 7, OUTLINE); R(x - 3, y - 2, 7, 5, OUTLINE);
  R(x - 2, y - 2, 5, 5, '#f4f4f0'); R(x, y, 1, 1, '#17141c'); R(x - 2, y - 2, 1, 1, '#17141c'); R(x + 2, y - 2, 1, 1, '#17141c'); R(x - 2, y + 2, 1, 1, '#9a96a0'); R(x + 2, y + 2, 1, 1, '#17141c');
}

// ---------- Sportplatz draußen: Himmel, Hügel mit Kirchturm, Geländer mit Zuschauern, Rasen ----------
const SKY = { day: ['#4f8fd6', '#a8d4f2'], eve: ['#2a2350', '#e8875a'], night: ['#05040a', '#141032'] };
const ADS = ['METZGEREI HÜMMER', 'AUTOHAUS KRAUS', 'BÄCKEREI LANG', 'GETRÄNKE MÜLLER', 'RAIFFEISENBANK', 'FAHRSCHULE BAUER', 'BRATWURST-BUDE'];
function outdoor(s, opt = {}) {
  const x0 = sx(s.x), tod = opt.tod || 'day', night = tod === 'night';
  const sky = g.createLinearGradient(0, 0, 0, FY - 40); sky.addColorStop(0, SKY[tod][0]); sky.addColorStop(1, SKY[tod][1]);
  g.fillStyle = sky; g.fillRect(x0, 0, s.w, FY);
  if (night) for (let k = 0; k < s.w / 6; k++) { const h = hash(k, s.x); if (h < 0.35) R(x0 + hash(k, 3) * s.w, hash(k, 7) * (FY - 70), 1, 1, h < 0.06 ? '#ffffff' : '#7a76a0'); }
  if (tod === 'eve') { ellipse(x0 + s.w * 0.7 - (cam - s.x) * 0.05, FY - 66, 14, 14, '#ffd08a'); }
  // Wolken (Parallaxe 0.2)
  if (!night) for (let k = 0; k < 4; k++) { const cx = x0 + ((k * 137 + T * 3 - (s.x - cam) * 0.2) % (s.w + 80)) - 40, cy = 14 + hash(k, s.x) * 30; g.fillStyle = tod === 'eve' ? 'rgba(255,200,170,.35)' : 'rgba(255,255,255,.75)'; g.fillRect(cx, cy, 34, 5); g.fillRect(cx + 6, cy - 4, 20, 5); }
  // Hügel, Wald und Kirchturm (Parallaxe 0.4)
  const hp = Math.round((s.x - cam) * 0.4) - x0, hillTop = FY - 64;
  g.fillStyle = night ? '#0e1a18' : tod === 'eve' ? '#3c4a3a' : '#5f9a5a';
  for (let i = -2; i < s.w + 4; i += 2) { const wx = i - hp, y = hillTop + Math.sin(wx * 0.015) * 7 + Math.sin(wx * 0.041) * 3; g.fillRect(x0 + i, y, 2, FY - y); }
  g.fillStyle = night ? '#0a1412' : tod === 'eve' ? '#2c3a2c' : '#3f7a44';
  for (let i = -2; i < s.w + 4; i += 3) { const wx = i - hp, h2 = hash(Math.round(wx / 3), 5); g.fillRect(x0 + i, hillTop + 10 - h2 * 6, 3, 30); }
  if (opt.church) { const cx = x0 + opt.church; R(cx, hillTop - 22, 8, 34, night ? '#2a2440' : '#e8e0cf'); R(cx + 1, hillTop - 30, 6, 8, night ? '#1d1830' : '#b3483a'); R(cx + 3, hillTop - 34, 2, 4, '#3a2f2a'); R(cx + 3, hillTop - 15, 2, 3, '#3a2f4d'); R(cx - 10, hillTop - 4, 12, 16, night ? '#221d33' : '#efe6d4'); R(cx - 11, hillTop - 7, 14, 4, night ? '#1d1830' : '#b3483a'); }
  // Flutlichtmasten
  if (opt.masts) for (const mx of opt.masts) { const lx = x0 + mx; R(lx, 18, 2, FY - 60, '#5c5470'); R(lx - 7, 12, 16, 7, '#3a3450'); for (let k = 0; k < 4; k++) R(lx - 6 + k * 4, 13, 3, 4, night || tod === 'eve' ? '#fff7d6' : '#9a96a0'); if (night || tod === 'eve') glow(lx + 1, 15, 46, 'rgba(255,245,210,A)', night ? 0.35 : 0.18); }
  // Zuschauer hinter dem Geländer (Parallaxe 0.8)
  const fence = FY - 40, pc = Math.round((s.x - cam) * 0.8) - x0, cheer = opt.cheer || 0;
  const rows = opt.stand ? 5 : 1;
  for (let r = rows - 1; r >= 0; r--) {
    const yb = fence - r * 7;
    for (let i = -4, n = Math.ceil(s.w / 7) + 8; i < n; i++) {
      const h = hash(i + Math.round(s.x / 7), r + 11); if (h > (opt.stand ? 0.92 : opt.crowd ?? 0.45)) continue;
      const wx = i * 7 + pc + (hash(i, 9) * 3 | 0), col = shade(['#c8102e', '#f3ead6', '#2f56b0', '#3a2f4d', '#5c7a3a', '#8a5a2a', '#ffc83a'][(h * 70 | 0) % 7], night ? 0.7 : 1), skin = SKIN[(hash(i, r * 7) * 5) | 0][0];
      const jump = cheer && hash(i, r) < 0.7 ? Math.round(Math.abs(Math.sin(T * 9 + h * 20)) * 2 * cheer) : 0, px2 = x0 + wx;
      R(px2, yb - 10 - jump, 5, 8, col); R(px2 + 1, yb - 14 - jump, 3, 4, skin); R(px2 + 1, yb - 15 - jump, 3, 1, h > 0.3 ? '#4a2a17' : '#8a7f66');
      if (cheer && h > 0.25) { R(px2 - 1, yb - 17 - jump, 1, 4, skin); R(px2 + 5, yb - 17 - jump, 1, 4, skin); }
      else if (h < 0.12) { R(px2 + 5, yb - 9, 2, 3, '#ffd200'); R(px2 + 5, yb - 10, 2, 1, '#ffffff'); }   // Bierbecher
    }
  }
  // Geländer und Werbebanden
  R(x0, fence - 6, s.w, 2, '#c8ccd4'); for (let k = 0; k < s.w; k += 24) R(x0 + k, fence - 6, 2, 8, '#9a9ea8');
  const by = fence + 2; R(x0, by, s.w, 9, '#f4f4f0'); R(x0, by + 8, s.w, 1, '#8a8a90');
  g.save(); g.beginPath(); g.rect(x0, by, s.w, 9); g.clip();
  for (let k = 0, x = x0 + 4; x < x0 + s.w; k++) { const ad = opt.board && k % 2 ? opt.board : ADS[(k + (s.x / 40 | 0)) % ADS.length], w = ad.length * 6 + 14; R(x, by + 1, w - 4, 7, ['#c8102e', '#14306b', '#0a8a3e', '#ffd200'][(k + (s.x / 30 | 0)) % 4]); g.font = `6px ${PIX}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = (k + (s.x / 30 | 0)) % 4 === 3 ? '#14306b' : '#ffffff'; g.fillText(ad, x + 4, by + 2); x += w; }
  g.restore();
  // Rasen mit Mähstreifen (oder Asche)
  const gy = by + 9;
  for (let k = 0; k < s.w; k += 24) R(x0 + k, gy, 24, H - gy, opt.ash ? ((k / 24) % 2 ? '#b8603a' : '#c06a42') : ((k / 24) % 2 ? (night ? '#1f5a2a' : '#3c9a46') : (night ? '#236331' : '#44a64e')));
  R(x0, FY + 8, s.w, 1, 'rgba(243,234,214,.75)');
  if (night) { g.fillStyle = 'rgba(255,245,210,.05)'; g.fillRect(x0, gy, s.w, H - gy); }
}
// Sportheim mit Schild, Bratwurststand mit Rauch
function sportheim(x, label) {
  const y = FY - 40;
  R(x, y - 46, 86, 46, '#d9c9a8'); R(x - 4, y - 52, 94, 7, '#8a3a2a'); R(x - 2, y - 56, 90, 4, '#a84a36');
  R(x + 6, y - 38, 16, 12, '#7cb8e8'); R(x + 13, y - 38, 1, 12, '#d9c9a8'); R(x + 30, y - 38, 16, 12, '#7cb8e8'); R(x + 37, y - 38, 1, 12, '#d9c9a8');
  R(x + 60, y - 30, 14, 30, '#6a4a2a'); R(x + 71, y - 16, 2, 2, '#ffd200');
  R(x + 8, y - 22, 46, 9, '#14306b'); text(label, x + 31, y - 21, '#ffffff', 6, 'center');
}
function bratwurst(x) {
  const y = FY - 40;
  R(x, y - 26, 34, 26, '#c8102e'); R(x - 2, y - 30, 38, 5, '#f4f4f0'); for (let k = 0; k < 38; k += 6) R(x - 2 + k, y - 30, 3, 5, '#c8102e');
  R(x + 2, y - 22, 30, 4, '#3a2f2a'); for (let k = 0; k < 5; k++) R(x + 4 + k * 6, y - 23, 4, 2, '#a8562a');
  text('WURST', x + 17, y - 14, '#ffd200', 6, 'center');
  for (let k = 0; k < 5; k++) { const ph = (T * 0.6 + k / 5) % 1; g.fillStyle = `rgba(230,230,235,${0.45 * (1 - ph)})`; g.fillRect(x + 12 + Math.sin(ph * 6 + k) * 5, y - 30 - ph * 40, 6 + ph * 8, 4 + ph * 4); }
}
// Tor von der Seite (wie man es am Sportplatz sieht): vorn der Pfosten, die Latte nur im Querschnitt (sie zeigt in den Bildschirm hinein),
// das Dachnetz fällt schräg nach hinten ab bis zum niedrigen Netzbügel. Kein waagrechter Balken nach hinten – der sah aus wie eine Latte.
function goal(x, bulge = 0) {
  const top = FY - 58, depth = 30, backTop = top + 22, net = 'rgba(243,234,214,.5)';
  const roofY = k => top + (backTop - top) * k, b = k => Math.sin(k * Math.PI) * bulge;
  g.lineWidth = 1; g.strokeStyle = net;
  for (let k = 0; k <= 8; k++) {   // waagrechte Maschen des Seitennetzes
    const y0 = top + k * (FY - top) / 8, y1 = backTop + k * (FY - backTop) / 8;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x + depth + b(k / 8) * 9, y1); g.stroke();
  }
  for (let k = 1; k <= 6; k++) {   // senkrechte Maschen, oben am schrägen Dachnetz
    const f = k / 6, bx = x + depth * f;
    g.beginPath(); g.moveTo(bx, roofY(f)); g.lineTo(bx + b(f) * 6, FY + 2); g.stroke();
  }
  g.strokeStyle = 'rgba(243,234,214,.8)'; g.beginPath(); g.moveTo(x, top); g.lineTo(x + depth, backTop); g.stroke();   // Kante des Dachnetzes
  R(x + depth - 1, backTop, 2, FY - backTop + 2, '#a8a8b0');   // Netzbügel hinten
  R(x - 2, top - 2, 3, FY - top + 2, '#f4f4f0');                // Pfosten
  R(x - 3, top - 3, 5, 5, '#f4f4f0'); R(x - 2, top - 2, 3, 3, '#d8d8de');   // Latte im Querschnitt
}

// ---------- Szene: Deutschlandkarte im Vereinsheim (Daten aus src/d_karte.js) ----------
const MAPC = ['#3f8f4a', '#4ea055', '#367d41', '#5aa95c', '#46964f', '#2f7039', '#53a35a'];
let MAPIMG = null;
function mapImage(lit) {
  if (typeof KARTE === 'undefined') return null;
  const K = KARTE, key = Math.round(lit * 21);
  if (MAPIMG && MAPIMG.key === key) return MAPIMG.c;
  const c = MAPIMG && MAPIMG.c || document.createElement('canvas'); c.width = K.w; c.height = K.h;
  const o = c.getContext('2d'), im = o.createImageData(K.w, K.h), grid = [];
  K.rows.forEach(row => { const r = []; for (const [, ch, n] of row.matchAll(/([.A-Z])(\d*)/g)) for (let i = 0; i < (n ? +n : 1); i++) r.push(ch === '.' ? -1 : ch.charCodeAt(0) - 65); grid.push(r); });
  // Reihenfolge des Aufleuchtens: von Norden nach Süden (nach dem Schwerpunkt jedes Verbands)
  const cy = Array.from({ length: K.order.length }, (_, v) => { let s = 0, n = 0; grid.forEach((r, y) => r.forEach(c => { if (c === v) { s += y; n++; } })); return n ? s / n : 999; });
  const order = cy.map((y, v) => v).sort((a, b) => cy[a] - cy[b]);
  for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
    const v = grid[y][x], i = (y * K.w + x) * 4; if (v < 0) continue;
    const on = order.indexOf(v) < key || key >= 21, edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy] || [])[x + dx] !== v);
    let col = hexRgb(on ? MAPC[v % MAPC.length] : '#2a2440'); if (edge) col = col.map(q => q * 0.5);
    im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255;
  }
  o.putImageData(im, 0, 0); MAPIMG = { key, c }; return c;
}
function mapScene(s, st) {
  room(s, '#3a2a22', '#33251e', '#5a4030', '#4e372a');
  const q = st.kind === 'karte' ? st.q : (st.x > s.x + s.at ? 1 : 0), x0 = sx(s.x), fy = FY - 22;
  // Tafel mit Karte: 100 × 136 Felder, halb so groß gezeichnet
  const bx = x0 + s.at + 44, mh = Math.min(72, FY - 80), mw = Math.round(mh * 100 / 136), by = FY - 52 - mh;
  R(bx - 4, by - 4, mw + 8, mh + 8, '#6a4a2a'); R(bx - 2, by - 2, mw + 4, mh + 4, '#14111d');
  const im = mapImage(seg(q, 0.08, 0.7)); if (im) g.drawImage(im, bx, by, mw, mh);
  // Zähler daneben
  const k = ease(seg(q, 0.08, 0.7)), tx = x0 + s.at - 34, ty = 26;
  R(tx - 4, ty - 4, 76, 50, '#14111d'); R(tx - 4, ty - 4, 76, 1, '#3a2f4d');
  text(String(Math.round(4913 * k)).replace(/\B(?=(\d{3})+$)/, '.'), tx, ty, '#ffc83a', 10); text('VEREINE', tx, ty + 12, '#b3a9c4', 6);
  text(String(Math.round(238 * k)), tx, ty + 22, '#7cf2ff', 8); text('KREISE', tx + 28, ty + 23, '#b3a9c4', 6);
  text(String(Math.round(21 * k)), tx, ty + 34, '#3ddc84', 8); text('VERBÄNDE', tx + 20, ty + 35, '#b3a9c4', 6);
  // Wimpel an der Wand
  for (let w = 0; w < 4; w++) { const wx = x0 + s.at + 120 + w * 22, wy = 20; R(wx, wy, 14, 2, '#8a7f66'); g.fillStyle = ['#c8102e', '#14306b', '#0a8a3e', '#ffd200'][w]; g.beginPath(); g.moveTo(wx + 1, wy + 2); g.lineTo(wx + 13, wy + 2); g.lineTo(wx + 7, wy + 16); g.fill(); }
}
// Innenraum: Wand, Holzvertäfelung, Boden
function room(s, wall, wall2, floor, floor2) {
  const x0 = sx(s.x);
  R(x0, 0, s.w, FY, wall);
  for (let k = 0; k < s.w; k += 16) R(x0 + k, 0, 1, FY - 22, wall2);
  R(x0, FY - 30, s.w, 8, shade(wall, 0.8)); R(x0, FY - 30, s.w, 1, shade(wall, 1.3));
  R(x0, FY - 22, s.w, H - FY + 22, floor);
  for (let y = FY - 20; y < H; y += 4) R(x0, y, s.w, 1, floor2);
}
// ---------- Szene: Kreisblatt im Sportheim ----------
function clubhouse(s, st) {
  room(s, '#4a3626', '#3f2e20', '#6a4a30', '#5e4128');
  const x0 = sx(s.x), fy = FY - 22;
  // Theke mit Zapfhahn, Fernseher, Bank
  const tx = x0 + s.at + 70; R(tx, fy - 26, 70, 26, '#5a3a22'); R(tx - 2, fy - 28, 74, 3, '#8a5a32');
  R(tx + 14, fy - 40, 3, 12, '#c8ccd4'); R(tx + 12, fy - 42, 7, 3, '#c8102e'); R(tx + 28, fy - 34, 5, 6, '#ffd200'); R(tx + 28, fy - 35, 5, 2, '#ffffff');
  R(tx + 6, 18, 40, 26, '#17141c'); R(tx + 8, 20, 36, 22, '#3c9a46'); R(tx + 25, 20, 1, 22, '#f4f4f0'); text('2:1', tx + 26, 23, '#ffffff', 6, 'center');
  R(x0 + s.at - 12, FY - 14, 26, 4, '#8a5a32'); R(x0 + s.at - 12, FY - 14, 26, 1, '#a8703e'); R(x0 + s.at - 10, FY - 10, 2, 10, '#6a4a2a'); R(x0 + s.at + 10, FY - 10, 2, 10, '#6a4a2a');
  // Mannschaftsfoto
  R(x0 + 40, 22, 46, 30, '#efe6cf'); R(x0 + 42, 24, 42, 22, '#3c9a46'); for (let k = 0; k < 7; k++) { R(x0 + 44 + k * 6, 34, 4, 8, '#c8102e'); R(x0 + 45 + k * 6, 31, 2, 3, '#e6b085'); } text('1. MANNSCHAFT', x0 + 63, 47, '#3a2f2a', 4, 'center');
}
function newspaper(px, q, fr) {
  const x = sx(px) + 6, y = FY - 38 - fr;
  R(x - 1, y - 1, 18, 14, OUTLINE); R(x, y, 16, 12, '#efe6cf'); R(x + 8, y, 1, 12, '#cfc4a8');
  R(x + 1, y + 1, 14, 2, '#1a1205');
  R(x + 1, y + 4, 6, 1, '#1a1205'); R(x + 1, y + 6, 6, 1, '#8a7f66'); R(x + 1, y + 8, 5, 1, '#8a7f66');
  R(x + 10, y + 4, 5, 4, '#3c9a46'); R(x + 10, y + 9, 5, 1, '#8a7f66');
}
// ---------- Pokale ----------
function cup(x, y) { // Kreispokal, Fuß bei (x, y): Silberpokal mit Henkeln
  R(x - 4, y - 3, 9, 3, '#6a4a2a'); R(x - 1, y - 7, 3, 4, '#c8ccd4');
  R(x - 5, y - 17, 11, 10, '#dfe3ea'); R(x - 4, y - 16, 2, 8, '#ffffff'); R(x + 3, y - 16, 2, 8, '#9aa0ac');
  R(x - 8, y - 16, 3, 1, '#c8ccd4'); R(x - 8, y - 16, 1, 5, '#c8ccd4'); R(x + 6, y - 16, 3, 1, '#c8ccd4'); R(x + 8, y - 16, 1, 5, '#c8ccd4');
}
function eckfahne(x, y, big = 1) { // die Goldene Eckfahne: goldener Stab mit Fahne auf einem Sockel
  const s = big;
  R(x - 8 * s, y - 6 * s, 16 * s, 6 * s, '#3a2f4d'); R(x - 7 * s, y - 5 * s, 14 * s, 1, '#5c5470');
  R(x - 1, y - 40 * s, 2 * s, 34 * s, '#ffc83a'); R(x, y - 40 * s, 1, 34 * s, '#fff0b0');
  const wv = Math.sin(T * 4) * 2;
  g.fillStyle = '#ffc83a'; g.beginPath(); g.moveTo(x + 1, y - 40 * s); g.lineTo(x + 14 * s, y - 36 * s + wv); g.lineTo(x + 1, y - 30 * s); g.fill();
  g.fillStyle = '#c96a12'; g.beginPath(); g.moveTo(x + 1, y - 35 * s); g.lineTo(x + 10 * s, y - 34 * s + wv); g.lineTo(x + 1, y - 30 * s); g.fill();
  glow(x + 4, y - 34 * s, 22 * s, 'rgba(255,200,58,A)', 0.25 + Math.sin(T * 3) * 0.05);
}
// ---------- Szene: Vereinsbus und Wegweiser ----------
function road(s) {
  const x0 = sx(s.x);
  R(x0, FY - 14, s.w, 30, '#3a3a42'); for (let k = 0; k < s.w; k += 26) R(x0 + k + ((-cam * 0) % 26), FY + 6, 14, 2, '#e8e0cf');
  R(x0, FY - 16, s.w, 2, '#9a9ea8');
}
function busScene(s, st) {
  outdoor(s, { tod: 'eve', crowd: 0 });
  road(s);
  const q = st.kind === 'bus' ? st.q : st.x > s.x + s.at ? 1 : 0, x0 = sx(s.x);
  // Wegweiser
  const px = x0 + s.at - 60; R(px, FY - 70, 3, 56, '#9a9ea8');
  [['FLENSBURG 612', 1], ['GÖRLITZ 433', 1], ['FREIBURG 498', 0], ['AACHEN 451', 0]].forEach(([t, r], k) => { const y = FY - 70 + k * 10, w = t.length * 6 + 8; R(r ? px + 3 : px - w, y, w, 8, '#ffd200'); R(r ? px + 3 + w : px - w - 4, y + 1, 4, 6, '#ffd200'); text(t, (r ? px + 7 : px - w + 4), y + 1, '#14306b', 6); });
  // Bus: fährt am Ende los
  const go = ease(seg(q, 0.72, 1)), bx = x0 + s.at + 30 + go * 260, by = FY - 6;
  R(bx, by - 40, 130, 34, '#f4f4f0'); R(bx, by - 18, 130, 6, '#c8102e'); R(bx + 122, by - 36, 8, 18, '#7cb8e8');
  for (let k = 0; k < 6; k++) R(bx + 6 + k * 19, by - 36, 15, 12, '#7cb8e8');
  text('SG LEGENDEN · TOUR', bx + 64, by - 11, '#14306b', 6, 'center');
  for (const wx of [bx + 22, bx + 104]) { ellipse(wx, by - 4, 7, 7, '#17141c'); ellipse(wx, by - 4, 3, 3, '#9a9ea8'); }
  if (go > 0 || q > 0.5) for (let k = 0; k < 4; k++) { const ph = (T * 1.5 + k / 4) % 1; g.fillStyle = `rgba(200,200,210,${0.4 * (1 - ph)})`; g.fillRect(bx - 6 - ph * 24, by - 8 - ph * 8, 4 + ph * 6, 3 + ph * 4); }
  // Mitspieler schauen aus dem Fenster und winken
  for (let k = 0; k < 5; k++) { R(bx + 10 + k * 19, by - 32 + (Math.floor(T * 4 + k) % 2), 6, 6, SKIN[k % 5][0]); R(bx + 10 + k * 19, by - 34, 6, 2, ['#4a2a17', '#1a1210', '#d9b25a', '#8a7f66', '#1a1210'][k]); }
}
// ---------- Szene: Endspiel unter Flutlicht ----------
function finaleScene(s, st) {
  outdoor(s, { tod: 'night', stand: true, cheer: 1, masts: [40, 300, 520], board: 'GOLDENE ECKFAHNE' });
  eckfahne(sx(s.x + s.at + 46), FY - 2, 1);
}
// ---------- Konfetti ----------
let CONFETTI = [];
function confetti(x, y, n, spread) {
  for (let k = 0; k < n; k++) CONFETTI.push({ x: x + (Math.random() - 0.5) * spread, y: y - Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 20 + 10, c: ['#c8102e', '#ffc83a', '#f3ead6', '#3ddc84', '#7cf2ff'][k % 5], life: 3 });
}
function stepConfetti(dt) {
  CONFETTI = CONFETTI.filter(p => (p.life -= dt) > 0 && p.y < H);
  CONFETTI.forEach(p => { p.x += p.vx * dt + Math.sin(T * 6 + p.y) * 0.3; p.y += p.vy * dt; R(sx(p.x), p.y, 2, 2, p.c); });
}
// Trennwand zwischen den Szenen (wie Kulissen)
function divider(wx) {
  const x = sx(wx);
  if (x < -12 || x > W + 12) return;
  R(x - 5, 0, 10, H, '#07060b'); R(x - 5, 0, 1, H, '#2a2140'); R(x + 4, 0, 1, H, '#2a2140');
  for (let y = 6; y < H; y += 14) R(x - 2, y, 4, 2, '#1a1430');
}

// ---------- Die Legende ----------
const GOAL_DX = 150;   // Torlinie rechts vom Haltepunkt
function hero(st) {
  const ws = 9, runFr = Math.floor(st.x / ws) % 6, idleFr = Math.floor(T * 2) % 2, L = HERO, tor = SCENES[1];
  switch (st.kind) {
    case 'intro': { // jonglieren
      const ph = (T * 1.8) % 1, h = Math.abs(Math.sin(ph * Math.PI)) * 22;
      drawSprite(L, h < 4 ? 'kick' : 'idle', h < 4 ? 1 : 0, st.x);
      ball(sx(st.x) + 9, FY - 12 - h);
      return;
    }
    case 'walk': {
      drawSprite(L, 'run', runFr, st.x);
      if (st.x < tor.x + tor.at) ball(sx(st.x) + 9 + (runFr % 3), FY - 2);
      return;
    }
    case 'tor': {
      // Dribbling, Schuss, der Ball fliegt ins Netz, der Torwart fliegt daneben, Jubel mit Faust
      const q = st.q, gx = tor.x + tor.at + GOAL_DX;
      let x = st.x, pose, fr = idleFr;
      if (q < 0.22) { x += ease(seg(q, 0, 0.22)) * 40; pose = 'run'; fr = Math.floor(q * 90) % 6; }
      else if (q < 0.3) { x += 40; pose = 'kick'; fr = q < 0.26 ? 0 : 1; }
      else if (q < 0.58) { x += 40; pose = 'idle'; }
      else { x += 40; pose = q < 0.66 ? 'jubel' : 'faust'; fr = Math.floor(T * 6) % 2; }
      drawSprite(L, pose, fr, x, q > 0.6 && q < 0.66 ? Math.abs(Math.sin(T * 9)) * 6 : 0);
      const fly = seg(q, 0.26, 0.4);
      if (q < 0.26) ball(sx(x) + 10, FY - 2);
      else if (q < 0.4) ball(Math.round(lerp(sx(x) + 12, sx(gx) + 14, fly)), Math.round(lerp(FY - 2, FY - 40, fly) - Math.sin(fly * Math.PI) * 10));
      else { const k = seg(q, 0.4, 0.5); ball(sx(gx) + 18 + Math.round(k * 4), Math.round(lerp(FY - 40, FY - 3, ease(k)))); }
      return;
    }
    case 'karte': drawSprite(L, st.q > 0.1 && st.q < 0.9 ? 'point' : 'idle', Math.floor(T * 2) % 2, st.x); return;
    case 'kreisblatt': {
      const q = st.q;
      if (q < 0.08 || q > 0.92) { drawSprite(L, 'idle', 0, st.x); return; }
      const fr = Math.floor(T * 1.5) % 2;
      g.drawImage(sprite(L, 'read', fr), sx(st.x) - AX, FY - 4 - AY);
      newspaper(st.x, q, fr);
      return;
    }
    case 'pokal': {
      const q = st.q, lifted = q > 0.25 && q < 0.92, fr = Math.floor(T * 4) % 2;
      drawSprite(L, lifted ? 'lift' : 'idle', lifted ? fr : idleFr, st.x);
      if (lifted) cup(sx(st.x) + 2, FY - 46 - fr); else cup(sx(st.x) + 22, FY - 22);
      if (!lifted) { R(sx(st.x) + 14, FY - 22, 18, 22, '#6a4a2a'); R(sx(st.x) + 13, FY - 23, 20, 2, '#8a5a32'); }
      return;
    }
    case 'bus': { const q = st.q; if (q < 0.62) drawSprite(L, q > 0.2 ? 'cheer' : 'idle', Math.floor(T * 5) % 6, st.x + seg(q, 0.45, 0.62) * 30); return; }
    case 'finale': drawSprite(L, st.q > 0.25 ? 'point' : 'idle', Math.floor(T * 2) % 2, st.x); return;
  }
}

// ================= Bild aufbauen =================
let st = stateAt(0), shownU = 0, targetU = 0, lastT = performance.now(), fired = {};
function render() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; T += dt;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  shownU = reduce ? targetU : lerp(shownU, targetU, Math.min(1, dt * 10));
  if (Math.abs(shownU - targetU) < 0.05) shownU = targetU;
  st = stateAt(shownU);
  let a = 0.33;
  if (st.hold && st.seg.scene && st.seg.scene.cam != null) {
    const sc = st.seg.scene, want = sc.need ? Math.max(0.06, Math.min(sc.cam, (W - sc.need) / W)) : sc.cam;
    const k = ease(seg(st.q, 0, 0.12)) * (1 - ease(seg(st.q, 0.9, 1))); a = lerp(0.33, want, k);
  }
  if (st.kind === 'intro') a = 0.45;
  cam = clamp(st.x - W * a, 0, WORLD - W);
  if (W > WORLD) cam = 0;

  g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060b'; g.fillRect(0, 0, W, H);
  const tor = SCENES[1], torQ = st.kind === 'tor' ? st.q : 0, scored = torQ > 0.4;
  SCENES.forEach(s => {
    const a0 = sx(s.x), a1 = sx(s.x + s.w);
    if (a1 < 0 || a0 > W) return;
    g.save(); g.beginPath(); g.rect(a0, 0, s.w, H); g.clip();
    if (s.id === 'platz') { outdoor(s, { church: 300 }); sportheim(a0 + 150, 'SPORTHEIM'); bratwurst(a0 + 380); }
    if (s.id === 'tor') {
      outdoor(s, { cheer: scored ? 1 : 0, crowd: 0.6, board: scored ? 'TOOOR!' : undefined });
      const gx = s.x + s.at + GOAL_DX, net = st.kind === 'tor' ? seg(torQ, 0.38, 0.42) * (1 - seg(torQ, 0.55, 0.75)) : 0;
      // Torwart: hechtet in die falsche Ecke
      const dv = st.kind === 'tor' ? seg(torQ, 0.3, 0.42) : 0;
      if (dv > 0 && dv < 1 || (st.kind === 'tor' && torQ >= 0.42 && torQ < 0.7)) drawSprite(KEEPER, 'dive', 0, gx - 4, 4 + Math.sin(Math.min(1, dv) * Math.PI) * 6, true);
      else drawSprite(KEEPER, 'gk', idleFrK(), gx - 2, 0, true);
      goal(sx(gx), net);
    }
    if (s.id === 'karte') mapScene(s, st);
    if (s.id === 'kreisblatt') clubhouse(s, st);
    if (s.id === 'pokal') { outdoor(s, { tod: 'eve', cheer: st.kind === 'pokal' && st.q > 0.25 ? 1 : 0, crowd: 0.7, masts: [60, 360] }); }
    if (s.id === 'bus') busScene(s, st);
    if (s.id === 'finale') finaleScene(s, st);
    g.restore();
  });
  SCENES.slice(1).forEach(s => divider(s.x));
  hero(st);

  const trig = (key, cond, fn) => { if (cond && !fired[key]) { fired[key] = 1; fn(); } if (!cond) fired[key] = 0; };
  trig('tor', st.kind === 'tor' && st.q > 0.42, () => confetti(tor.x + tor.at + GOAL_DX - 40, 0, 40, 200));
  trig('cup', st.kind === 'pokal' && st.q > 0.3 && st.q < 0.9, () => confetti(st.x + 2, 10, 70, 140));
  trig('fin', st.kind === 'finale' && st.q > 0.2, () => confetti(st.x, 0, 90, W));
  stepConfetti(dt);

  if (st.kind === 'tor' && torQ > 0.42 && torQ < 0.95) {
    const k = seg(torQ, 0.42, 0.48), y = Math.round(lerp(-20, H * 0.2, ease(k)));
    g.font = `16px ${PIX}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = '#000'; g.fillText('TOOOR!', W * 0.4 + 2, y + 3);
    g.fillStyle = '#c94a12'; g.fillText('TOOOR!', W * 0.4, y + 2);
    g.fillStyle = '#ffc83a'; g.fillText('TOOOR!', W * 0.4, y);
  }
  const sh = g.createLinearGradient(0, 0, 0, H * 0.55);
  sh.addColorStop(0, 'rgba(7,6,11,.55)'); sh.addColorStop(1, 'rgba(7,6,11,0)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H * 0.55);
  onFrame(st);
}
const idleFrK = () => Math.floor(T * 3) % 2;

// ================= Seite: Größe, Scroll, Texte =================
const film = document.getElementById('film');
const sticky = film.querySelector('.film-sticky');
const caps = [...film.querySelectorAll('[data-scene]')];
const heroCap = film.querySelector('.cap-hero');
const hudNo = document.getElementById('hudNo'), hudLbl = document.getElementById('hudLbl'), hudFill = document.getElementById('hudFill'), hudBall = document.getElementById('hudBall');
let unitPx = 3;
function resize() {
  const vw = sticky.clientWidth, vh = sticky.clientHeight;
  SCALE = Math.max(1.5, Math.min(vh / 165, vw / 150));
  W = Math.ceil(vw / SCALE); H = Math.ceil(vh / SCALE);
  FY = H - 24;
  cv.width = W; cv.height = H;
  unitPx = Math.max(1.6, SCALE * 0.72);
  film.style.height = (TL.total * unitPx + vh) + 'px';
  update();
}
function update() { const r = film.getBoundingClientRect(); targetU = clamp(-r.top / unitPx, 0, TL.total); }
// Nutzungsstatistik: jede Szene einmal pro Besuch zählen (wie weit wird gescrollt?)
const SEEN = new Set();
function seen(sc) { if (SEEN.has(sc.id)) return; SEEN.add(sc.id); try { if (window.umami) window.umami.track('story-szene', { szene: sc.id, nr: SCENES.indexOf(sc) + 1 }); } catch (e) { } }
function onFrame(s) {
  const h = 1 - seg(s.u, INTRO.len * 0.25, INTRO.len * 0.9);
  heroCap.style.opacity = h; heroCap.style.transform = `translate3d(${-(1 - h) * 60}px,0,0)`; heroCap.style.visibility = h < 0.02 ? 'hidden' : 'visible';
  caps.forEach(c => {
    const sc = SCENES.find(x => x.id === c.dataset.scene);
    const enter = sc.x - W * 0.15, len = sc.w;
    let f = (s.x - enter) / len;
    if (sc.id === 'platz') f = s.kind === 'intro' ? -1 : (s.x - INTRO.x) / (sc.w - INTRO.x) + 0.08;
    if (s.hold && s.kind !== 'intro' && s.seg.scene === sc) f = clamp(f, 0.2, 0.8);
    const vis = f < 0.05 ? seg(f, -0.15, 0.05) : 1 - seg(f, 0.85, 1.05);
    const dx = f < 0.5 ? (1 - vis) * 80 : -(1 - vis) * 80;
    c.style.opacity = vis.toFixed(3); c.style.transform = `translate3d(${dx}px,0,0)`; c.style.visibility = vis < 0.02 ? 'hidden' : 'visible';
    if (vis > 0.5) seen(sc);
  });
  const idx = SCENES.indexOf(s.scene);
  hudNo.textContent = String(s.kind === 'intro' ? 0 : idx + 1).padStart(2, '0');
  hudLbl.textContent = s.kind === 'intro' ? 'ANSTOSS' : s.scene.label;
  const p = s.u / TL.total;
  hudFill.style.width = (p * 100) + '%';
  hudBall.style.left = `calc(${p * 100}% + ${6 - p * 12}px)`;
}
let running = false;
function loop() { if (!running) return; render(); requestAnimationFrame(loop); }
const io = new IntersectionObserver(es => { const v = es[0].isIntersecting; if (v && !running) { running = true; lastT = performance.now(); requestAnimationFrame(loop); } else if (!v) running = false; });
io.observe(film);
addEventListener('scroll', update, { passive: true });
addEventListener('resize', resize);
if (document.fonts) document.fonts.ready.then(() => { SPR.clear(); });
resize();
render();
// für Tests: window.__story.go(u)
window.__story = { total: () => TL.total, unitPx: () => unitPx, TL, SCENES, state: () => st, view: () => ({ cam, W }) };
})();
