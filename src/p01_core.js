// ================= Kern: Maße, Projektion, Helfer =================
let W = 640; const H = 360;   // W wächst auf breiten Bildschirmen (siehe fitView), H bleibt fest
// Spielfeld 100 × 64 m. x läuft von Torlinie zu Torlinie, y von der hinteren Seitenlinie (Vereinsheim) zur vorderen, z ist die Höhe
const CW = 100, CH = 64, MY = CH / 2, GRAV = 9.8;
const GW = 7.32, GH = 2.44, GY1 = MY - GW / 2, GY2 = MY + GW / 2;     // Tor: 7,32 × 2,44 m
const BOX_D = 16.5, BOX_W = 40.32, SIX_D = 5.5, SIX_W = 18.32, PEN_D = 11, CIRCLE_R = 9.15, BALL_R = 0.11;
// Sicht: 11 px pro Meter in der Länge, 4,8 px pro Meter in der Tiefe, 12 px pro Meter in der Höhe. Die Kamera schwenkt (CAMX)
// und neigt sich ein wenig nach vorn (CAMY in Bildpunkten), damit die ganze Platzbreite erreichbar ist
const PX = 11, DY = 4.8, ZPX = 12, PITCH_Y0 = 96, CAMY_MAX = 58;
const kOf = y => 0.84 + 0.16 * (y / CH);       // horizontale Perspektive (hinten schmaler)
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const FONT = '"Press Start 2P", ui-monospace, monospace';
const TOUCHDEV = 'ontouchstart' in window || matchMedia('(pointer:coarse)').matches;
let CAMX = CW / 2, CAMY = 0;
const sx = (x, y) => Math.round(W / 2 + (x - CAMX) * PX * kOf(y));
const sy = (y, z = 0) => Math.round(PITCH_Y0 - CAMY + y * DY - z * ZPX);
let VIEW_HALF = W / 2 / PX;
function fitView() {
  const cs = getComputedStyle(document.body), aw = innerWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = innerHeight - (document.body.classList.contains('touch') ? 0 : 24), w = Math.min(800, Math.max(640, Math.round(H * aw / Math.max(1, ah) / 2) * 2));
  document.documentElement.style.setProperty('--ar', `${w} / ${H}`);
  if (w === W) return;
  W = w; VIEW_HALF = W / 2 / PX; cv.width = W; ctx.imageSmoothingEnabled = false;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pick = a => a[(Math.random() * a.length) | 0];
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const c = hexRgb(h); return rgbHex(c[0] * f, c[1] * f, c[2] * f); }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)); }
function colDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
const lum = h => { const c = hexRgb(h); return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Plattform: Im Browser gilt der Standard. Eine Hülle (z. B. eine App) kann vor dem Spiel window.KRL_PLATFORM setzen:
// name, storage (wie localStorage), event(name, daten), quit(), legal (Copyright-Zeile), shareUrl
const PLATFORM = Object.assign({ name: 'web', storage: null, event: null, quit: null, legal: null, shareUrl: null }, window.KRL_PLATFORM);
const ON_WEB = PLATFORM.name === 'web';
const store = {
  get(k, d = null) { try { const v = (PLATFORM.storage || localStorage).getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { (PLATFORM.storage || localStorage).setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { (PLATFORM.storage || localStorage).removeItem(k); } catch (e) { } },
};
// Einstellungen: Halbzeitlänge in Minuten (echte Zeit), Schwierigkeit, Spieltempo, Abseits, automatischer Spielerwechsel in der Abwehr, Steuerhilfen
const SETTINGS = Object.assign({ hlen: 3, diff: 1, speed: 1, offside: true, autoswitch: true, autosub: true, helps: 'auto', radar: true }, store.get('krl_settings', {}));
const saveSettings = () => store.set('krl_settings', SETTINGS);
function track(name, data) {
  try { if (window.umami && name) window.umami.track(name, data); } catch (e) { }
  try { if (PLATFORM.event && name) PLATFORM.event(name, data || {}); } catch (e) { }
}

// ================= Vereine =================
// Alle Vereine der höchsten Kreisspielklasse in Deutschland (VDB aus d_vereine.js): Landesverband -> Kreis -> Liga -> Verein.
// Echte Vereinsnamen, Stärke grob nach Punkten pro Spiel im Herbst 2026. Spieler, Werte, Trikotfarben und Plätze sind frei erfunden.
// Muster: 0 einfarbig, 1 Längsstreifen, 2 Ringel, 3 Brustring. Platzart: 0 Rasen, 1 Kunstrasen, 2 Hartplatz (Asche)
const GROUNDS = ['RASEN', 'KUNSTRASEN', 'HARTPLATZ'];
// Kreis Coburg/Kronach/Lichtenfels: von Hand gestaltet [Ortsteil im Namen, Kürzel, Name, Kurzname, Farbe 1, Farbe 2, Stärke, Platz, Muster]
const HANDMADE = { 'Coburg': [
  ['Staffelstein', 'STA', 'TSV 1860 Staffelstein', 'Staffelstein', '#c8102e', '#ffffff', 74, 0, 0], ['Krecktal', 'KRE', 'FC Krecktal', 'Krecktal', '#0b3d91', '#ffffff', 69, 1, 1],
  ['Einberg', 'EIN', 'VfB Einberg', 'Einberg', '#ffffff', '#c8102e', 69, 2, 3], ['Lichtenfels II', 'LIC', '1. FC Lichtenfels II', 'Lichtenfels II', '#d71920', '#1a1a1a', 68, 1, 0],
  ['Sonnefeld', 'SON', 'TSV Sonnefeld', 'Sonnefeld', '#0a8a3e', '#ffffff', 67, 0, 0], ['Oberlauter', 'OBL', 'TSV Oberlauter', 'Oberlauter', '#1d4f91', '#ffd200', 66, 0, 2],
  ['Ketschendorf', 'KET', 'SV Coburg-Ketschendorf', 'Ketschendorf', '#f07d00', '#141414', 66, 2, 0], ['Gestungshausen', 'GES', 'TSV Gestungshausen', 'Gestungshausen', '#ffd200', '#14306b', 65, 0, 0],
  ['Scherneck', 'SCH', 'TSV Scherneck', 'Scherneck', '#7a1f2b', '#f4f4f0', 65, 1, 0], ['Pfarrweisach', 'PFA', 'TSV Pfarrweisach', 'Pfarrweisach', '#0057a8', '#f4f4f4', 64, 0, 1],
  ['Großgarnstadt', 'GRO', 'SV Großgarnstadt', 'Großgarnstadt', '#00733a', '#ffd200', 63, 2, 0], ['Bosporus', 'BOS', 'SV Bosporus Coburg', 'Bosporus', '#e30613', '#ffffff', 63, 1, 0],
  ['Niederfüllbach', 'NFG', 'SG Niederfüllbach/Grub', 'Niederfüllbach', '#5c2d91', '#ffffff', 60, 0, 0], ['Heilgersdorf', 'HEI', 'SV Heilgersdorf', 'Heilgersdorf', '#1a1a1a', '#ffffff', 57, 2, 1],
  ['Heldritt', 'HEL', 'TSV 1861 Heldritt', 'Heldritt', '#1356a8', '#ffffff', 57, 0, 0], ['Haarbrücken', 'HAA', 'FC Haarbrücken', 'Haarbrücken', '#008d4c', '#141414', 56, 1, 2],
  ['Kronach', 'KRO', '1. FC Kronach', 'Kronach', '#14306b', '#ffffff', 72, 0, 0], ['Marktzeuln', 'MAR', 'TSV Marktzeuln', 'Marktzeuln', '#0a8a3e', '#ffffff', 71, 0, 0],
  ['Burgkunstadt', 'BUR', '1. FC Burgkunstadt', 'Burgkunstadt', '#d0021b', '#ffffff', 70, 2, 0], ['Stockheim', 'STO', '1. FC Stockheim', 'Stockheim', '#ffd200', '#1a1a1a', 69, 1, 0],
  ['Neufang', 'NEU', 'DJK-SV Neufang', 'Neufang', '#0b3d91', '#ffd200', 68, 0, 3], ['Wolfers', 'WON', 'SG Wolfersgrün/Neuengrün/Nurn', 'Wolfersgrün', '#c8102e', '#1a1a1a', 68, 2, 0],
  ['Baiersdorf', 'BAI', '1. FC Baiersdorf', 'Baiersdorf', '#1a1a1a', '#ffd200', 68, 0, 1], ['Ludwigsstadt', 'LUD', 'TSV Ludwigsstadt', 'Ludwigsstadt', '#1d4f91', '#ffffff', 65, 2, 0],
  ['Steinbach', 'SHF', 'SG Steinbach/Hirschfeld', 'Steinbach', '#00863f', '#f5f5f5', 63, 0, 2], ['Steinberg', 'STE', 'TSV Steinberg', 'Steinberg', '#7a1f2b', '#ffffff', 62, 1, 0],
  ['DJK Lichtenfels', 'DJL', 'DJK Lichtenfels', 'DJK Lichtenfels', '#ffffff', '#0a3d91', 61, 0, 0], ['Mainroth', 'MRO', 'SG Roth-Main Mainroth', 'Mainroth', '#e2001a', '#ffffff', 61, 0, 1],
  ['Windheim', 'WIN', 'TSV Windheim', 'Windheim', '#f39200', '#0a2d6e', 60, 2, 0], ['Arnstein', 'ARN', 'SC Jura Arnstein', 'Arnstein', '#5c2d91', '#ffd200', 60, 1, 0],
  ['Lettenreuth', 'LET', 'SpVgg Lettenreuth', 'Lettenreuth', '#00a0dc', '#ffffff', 58, 0, 2], ['Michelau', 'MSW', 'SG Michelau/Schwürbitz', 'Michelau', '#e30613', '#141414', 56, 0, 0],
] };
const KITCOL = [['#c8102e', '#ffffff'], ['#1d4f91', '#ffffff'], ['#0a8a3e', '#ffffff'], ['#141414', '#ffd200'], ['#7a1f2b', '#f4f4f0'], ['#f07d00', '#141414'], ['#ffd200', '#0a2d6e'],
  ['#5c2d91', '#ffffff'], ['#0b3d91', '#e2001a'], ['#e30613', '#141414'], ['#00733a', '#ffd200'], ['#5aa9e6', '#ffffff'], ['#141414', '#ffffff'], ['#ffffff', '#c8102e'], ['#ffffff', '#1d4f91'],
  ['#e2001a', '#ffd200'], ['#0a2d6e', '#ffd200'], ['#008d4c', '#141414'], ['#7a1f2b', '#5aa9e6'], ['#f4f4f0', '#0a8a3e']];
const COLW = { rot: '#c8102e', blau: '#1d4f91', grün: '#0a8a3e', gruen: '#0a8a3e', schwarz: '#141414', weiß: '#f4f4f0', weiss: '#f4f4f0', gelb: '#ffd200', gold: '#d4a017', orange: '#f07d00', lila: '#5c2d91' };
const COLAB = { R: 'rot', B: 'blau', G: 'grün', S: 'schwarz', W: 'weiß' };
// Farben aus dem Vereinsnamen (Rot-Weiß, Blau-Gelb, RW, BW, SW …), sonst aus einer Palette
function kitFromName(n, r) {
  const m = n.match(/(Rot|Blau|Grün|Gruen|Schwarz|Weiß|Weiss|Gelb|Gold|Orange|Lila)[- ]?(Rot|Blau|Grün|Gruen|Schwarz|Weiß|Weiss|Gelb|Gold|Orange|Lila)/i);
  if (m) return [COLW[m[1].toLowerCase()], COLW[m[2].toLowerCase()]];
  const a = n.replace(/(\s[RBGSW])\/([RBGSW]\s)/, '$1$2').match(/(?:^|\s)(RW|BW|GW|SW|WR|WB|RS|BG|GB)S?(?=\s)/);
  if (a) return [COLW[COLAB[a[1][0]]], COLW[COLAB[a[1][1]]]];
  return KITCOL[(r() * KITCOL.length) | 0];
}
// Kurzname: Vereinskürzel, Jahreszahlen und Traditionsnamen weg, der Ort bleibt ("TSV 1860 Staffelstein" -> "Staffelstein")
const TRAD = new Set('germania eintracht eintr. viktoria victoria concordia borussia fortuna alemannia teutonia union arminia preußen preussen westfalia rhenania olympia sportfreunde sportfr. spfr. kickers hertha tasmania normannia hansa vorwärts dynamo lok lokomotive stahl motor empor traktor aufbau chemie einheit fortschritt turbine inter rapid sparta glückauf glück-auf wacker phönix phoenix jahn frisch auf grün-weiß blau-weiß rot-weiß schwarz-weiß rot-weiss blau-weiss grün-weiss schwarz-weiss blau-gelb gelb-schwarz schwarz-gelb rot-schwarz schwarz-rot blau-rot rot-blau grün-gelb türkspor türkgücü türkiyemspor croatia hellas polonia sportclub sportverein spielvereinigung turnverein sportgemeinschaft spielgemeinschaft fußballverein fussballverein fußballclub fussballclub tura tus turn- sport- club spvgg. spvg. spvgg spvg sg sv tsv fc sc vfb vfl vfr djk post bahn eisenbahn polizei werder'.split(' '));
const isAbbr = w => /^\d+\.?$/.test(w) || /^\d{2,4}(\/\d{2,4})?$/.test(w) || /^[A-ZÄÖÜ0-9.\-]{1,6}$/.test(w) && /[A-ZÄÖÜ]/.test(w) && w !== w[0] + w.slice(1).toLowerCase() || /^[A-ZÄÖÜ][a-zäöü]{0,3}[A-ZÄÖÜ][A-Za-zäöü]{0,3}\.?$/.test(w) || /^[A-ZÄÖÜ]{1,4}-[A-ZÄÖÜ]{1,4}$/.test(w);
function shortName(n) {
  let suf = '';
  const sm = n.match(/\s+(II|III|IV|V|U\d\d)$/); if (sm) { suf = ' ' + sm[1]; n = n.slice(0, sm.index); }
  n = n.replace(/\s+(I|1\.)$/, '').replace(/(Rot|Blau|Grün|Schwarz|Weiß|Weiss|Gelb|Gold)[- ](Rot|Blau|Grün|Schwarz|Weiß|Weiss|Gelb|Gold)/gi, ' ');
  const core = s => {
    const ws = s.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean).filter(w => !isAbbr(w) && !TRAD.has(w.toLowerCase()));
    while (ws.length && /^(a\.|i\.|v\.|am|an|im|in|der|die|von|vom|zu|und|e\.|b\.)$/i.test(ws[ws.length - 1])) ws.pop();
    while (ws.length && /^(a\.|i\.|am|an|im|in|der|die|von|vom|zu|und|e\.|b\.)$/i.test(ws[0])) ws.shift();
    return ws;
  };
  n = n.replace(/(^|\s)[RBGSW]\/[RBGSW](?=\s)/g, ' ');
  let ws = core(n.split('/')[0]); if (ws.join('').length < 3) ws = core(n.replace(/\//g, ' '));
  if (!ws.length) return (n.length > 16 ? n.slice(0, 15) + '.' : n) + suf;
  let s = ws.slice(0, 3).join(' ');
  if (s.length > 15) s = ws.slice(0, 2).join(' ');
  if (s.length > 15) s = ws[0];
  if (s.length > 15 && s.includes('-')) s = s.split('-')[0];
  if (s.length > 16) s = s.slice(0, 15) + '.';
  return s + suf;
}
// Kürzel aus drei Buchstaben des Ortsnamens, eindeutig innerhalb des Kreises
function uniqueK(v, used) {
  const L = v.toUpperCase().replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/ß/g, 'S').replace(/^(BAD|GROSS|KLEIN|OBER|UNTER|NIEDER|ALT|NEU|SANKT|ST)\s+/, '').replace(/[^A-Z]/g, '').padEnd(3, 'X');
  const cand = [L.slice(0, 3), L[0] + L.slice(2, 4), L[0] + L[1] + L[L.length - 1], L[0] + L[3] + L[L.length - 1], L[0] + L[2] + L[L.length - 2], L[0] + L[1] + L[4], L[0] + L[4] + L[5]];
  const k = cand.find(c => c.length === 3 && !used.has(c)) || (() => { for (let i = 0; i < 99; i++) { const c = L.slice(0, 2) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26]; if (!used.has(c)) return c; } return L.slice(0, 3); })();
  used.add(k); return k;
}
const VERB = [], KREISE = [], LIGEN = [], TEAMS = [];
function defaultAway(t) { return lum(t.c1) > 0.75 ? { c1: lum(t.c2) > 0.75 ? '#1d1d24' : t.c2, c2: t.c1, pat: 0 } : { c1: '#f4f4f0', c2: t.c1, pat: 0 }; }
function addTeam(o) { const t = Object.assign({ id: TEAMS.length }, o); t.home = { c1: o.c1, c2: o.c2, pat: o.pat || 0 }; t.away = defaultAway(t); TEAMS.push(t); return t; }
// mehr Asche im Westen, mehr Kunstrasen in der Stadt
const ASCHE = { '21': 0.3, '22': 0.3, '23': 0.25, '43': 0.25, '41': 0.2, '42': 0.2, '03': 0.05, '66': 0.05, '02': 0.1 };
const CITY = { '03': 1, '66': 1, '02': 1 };
for (const [vid, vn, kl, kreise] of VDB) {
  const V = { id: vid, n: vn, kl, kreise: [] }, vi = VERB.push(V) - 1;
  for (const [kn, ligen] of kreise) {
    const K = { n: kn, v: vi, ligen: [] }, ki = KREISE.push(K) - 1, used = new Set(), hand = Object.keys(HANDMADE).find(h => kn.includes(h));
    V.kreise.push(ki);
    for (const [ln, teams] of ligen) {
      const L = { n: ln, kreis: ki, v: vi, ids: [] }, li = LIGEN.push(L) - 1;
      K.ligen.push(li);
      const shorts = new Set();
      for (const tx of teams.split('|')) {
        const c = tx.lastIndexOf(':'), n = tx.slice(0, c), ppg = tx.slice(c + 1), r = seeded(hashStr(n + vid));
        const hm = hand && HANDMADE[hand].find(h => n.includes(h[0]) && !used.has(h[1]));
        let t;
        if (hm) { used.add(hm[1]); t = { k: hm[1], n: hm[2], short: hm[3], c1: hm[4], c2: hm[5], r: hm[6], ground: hm[7], pat: hm[8] }; }
        else {
          let s = shortName(n); if (shorts.has(s)) s = n.length > 16 ? n.slice(0, 15) + '.' : n;
          const [c1, c2] = kitFromName(n, r), q = r();
          const rating = ppg === '' ? 60 + ((r() * 8) | 0) : clamp(Math.round(56 + +ppg * 0.6 + (r() - 0.5) * 3), 55, 76);
          const g = r(), ash = ASCHE[vid] || 0.1, kr = CITY[vid] ? 0.6 : 0.28;
          t = { k: uniqueK(s, used), n, short: s, c1, c2, r: rating, ground: g < ash ? 2 : g < ash + kr ? 1 : 0, pat: q < 0.6 ? 0 : q < 0.75 ? 1 : q < 0.9 ? 2 : 3 };
        }
        shorts.add(t.short);
        t.lg = li; t.att = Math.round(t.r + (r() - 0.5) * 8); t.def = Math.round(t.r + (r() - 0.5) * 8);
        L.ids.push(addTeam(t).id);
      }
    }
  }
}
const LEAGUE = li => LIGEN[li].ids.map(i => TEAMS[i]);
const ligaOf = tid => LIGEN[TEAMS[tid].lg];
const kreisOf = tid => KREISE[ligaOf(tid).kreis];
const verbOf = tid => VERB[ligaOf(tid).v];
// Herkunft kurz: "Kreisliga 1 · Coburg/Kronach/Lichtenf." bzw. für Gegner von weit her mit Landesverband
const homeTag = (tid, far) => far ? `${kreisOf(tid).n} · ${verbOf(tid).n}` : `${ligaOf(tid).n} · ${kreisOf(tid).n}`;
const HOME_TEAM = (TEAMS.find(t => t.n === 'TSV 1860 Staffelstein') || TEAMS[0]).id;
// Suche über alle Vereine (ohne Umlaute, Groß-/Kleinschreibung)
const norm = s => s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ');
let SEARCH_IX = null;
function searchTeams(q, max = 8) {
  q = norm(q).trim(); if (q.length < 2) return [];
  if (!SEARCH_IX) SEARCH_IX = TEAMS.map(t => ' ' + norm(t.n + ' ' + KREISE[LIGEN[t.lg].kreis].n));
  const parts = q.split(/\s+/), out = [];
  for (let i = 0; i < TEAMS.length && out.length < 60; i++) if (parts.every(p => SEARCH_IX[i].includes(p))) out.push(i);
  // Treffer am Wortanfang zuerst
  return out.sort((a, b) => (SEARCH_IX[b].includes(' ' + parts[0]) ? 1 : 0) - (SEARCH_IX[a].includes(' ' + parts[0]) ? 1 : 0)).slice(0, max);
}

// ================= Kader =================
// Gruppen: TW Torwart, AB Abwehr, MF Mittelfeld, ST Sturm. Werte: tmp Tempo, tec Technik, pas Passen, sch Schuss, kop Kopfball,
// zwk Zweikampf, tw Torwart, aus Ausdauer
const ATTRS = ['tmp', 'tec', 'pas', 'sch', 'kop', 'zwk', 'tw', 'aus'];
const ATTR_N = { tmp: 'Tempo', tec: 'Technik', pas: 'Passen', sch: 'Schuss', kop: 'Kopfball', zwk: 'Zweikampf', tw: 'Torwart', aus: 'Ausdauer' };
const GRP_N = { TW: 'Torwart', AB: 'Abwehr', MF: 'Mittelfeld', ST: 'Sturm' };
const POS_BIAS = {
  TW: { tw: 20, tmp: -10, tec: -12, sch: -22, kop: -8, zwk: -16, pas: -8 },
  AB: { zwk: 10, kop: 6, tmp: -2, tec: -6, sch: -10, pas: -3, tw: -40 },
  MF: { pas: 8, tec: 5, aus: 4, zwk: -2, sch: -2, tw: -40 },
  ST: { sch: 10, tec: 4, tmp: 5, kop: 3, zwk: -12, pas: -4, tw: -40 },
};
const TRAITS = { TW: ['Elfmeterkiller', 'Katze'], AB: ['Kopfballungeheuer', 'Blutgrätsche', 'Dampfwalze'], MF: ['Dauerläufer', 'Schlitzohr', 'Flankengott', 'Freistoßkönig'], ST: ['Knipser', 'Turbo', 'Kopfballungeheuer', 'Schlitzohr'] };
const ovr = p => Math.round(p.grp === 'TW' ? (p.tw * 4 + p.pas + p.tmp) / 6
  : p.grp === 'AB' ? (p.zwk * 3 + p.kop * 2 + p.tmp + p.pas + p.aus) / 8
  : p.grp === 'MF' ? (p.pas * 3 + p.tec * 2 + p.aus + p.zwk + p.sch) / 8 : (p.sch * 3 + p.tec * 2 + p.tmp * 2 + p.kop) / 8);
const SUR = ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun','Krüger','Hofmann','Hartmann','Lange','Schmitt','Werner','Schmitz','Krause','Meier','Lehmann','Schmid','Schulze','Maier','Köhler','Herrmann','König','Walter','Mayer','Huber','Kaiser','Fuchs','Peters','Lang','Scholz','Möller','Weiß','Jung','Hahn','Schubert','Vogel','Friedrich','Keller','Günther','Frank','Berger','Winkler','Roth','Beck','Lorenz','Baumann','Franke','Albrecht','Schuster','Simon','Ludwig','Böhm','Winter','Kraus','Martin','Schumacher','Krämer','Vogt','Stein','Jäger','Otto','Sommer','Groß','Seidel','Heinrich','Brandt','Haas','Schreiber','Graf','Schulte','Dietrich','Ziegler','Kuhn','Kühn','Pohl','Engel','Horn','Busch','Bergmann','Thomas','Voigt','Sauer','Arnold','Wolff','Pfeiffer',
  'Dörfler','Hümmer','Leicht','Ruß','Fischbach','Gagel','Sesselmann','Engelhardt','Schramm','Eichhorn','Fiedler','Kestel','Geuß','Zapf','Bätz','Höfner','Pülz','Rebhan','Fugmann','Gräf','Fröba','Heublein','Muckelbauer','Ebert','Hagel','Morgenroth','Söllner','Dressel','Schardt','Kolb','Häfner','Raab','Nüßlein','Wittmann','Hetzel','Faber','Wachter','Murmann','Göpfert','Querfurth','Stammberger','Wunder','Rauh','Hofmann','Brückner','Truckenbrodt','Leistner','Wicklein','Oppel','Scheler','Löffler','Pfadenhauer','Grosch','Heidenreich','Gemeinhardt','Rosenbauer','Kohles','Hümmrich',
  'Yilmaz','Kaya','Demir','Öztürk','Sahin','Celik','Aydin','Arslan','Dogan','Kilic','Kowalski','Nowak','Wojcik','Kaminski','Lewandowski','Zielinski','Rossi','Russo','Esposito','Bianchi','Romano','Popovic','Jovanovic','Petrovic','Nikolic','Markovic','Papadopoulos','Georgiou','Schmidtke','Wiebe','Friesen','Penner','Klassen','Neufeld','Dück','Horvath','Nagy','Novak','Svoboda','Dvorak','Silva','Santos','Pereira','Ferreira','Costa'];
const FIRST = ['Thomas','Michael','Andreas','Stefan','Christian','Markus','Daniel','Sebastian','Tobias','Jan','Kevin','Dennis','Marcel','Patrick','Florian','Lukas','Jonas','Niklas','Tim','Felix','Max','Leon','Paul','Finn','Ben','Elias','Noah','Luca','Kai','Sven','Dirk','Jens','Frank','Uwe','Ralf','Holger','Torsten','Mehmet','Emre','Can','Deniz','Burak','Piotr','Marek','Marco','Dimitrios','Nikola','Ivan','Artur','Waldemar','Eugen','Ole','Malte','Bastian','René','Mario','Pascal','Sascha','Dominik','Benedikt','Johannes','Philipp','Matthias','Simon','Fabian','Julian','Moritz','Jannik','Tom','David','Nico','Robin','Manuel','Steffen','Christoph','Martin','Alexander','Maximilian','Lennart','Georg','Wolfgang','Heiko','Timo','Yannick','Erik'];
const NICK = ['Kalle','Pommes','Bomber','Hacke','Schorsch','Ente','Bulle','Atze','Kante','Wiesel','Bolzer','Pfosten','Mücke','Hammer','Floh','Turbo','Opa','Socke','Brikett','Locke','Keule','Knipser','Schnitzel','Matze','Stulle','Bratwurst','Zange','Eisen','Kater','Lupo','Flitzer','Krake','Tank','Rakete'];
const JOBS = ['Dachdecker','Azubi','Student','Metzger','Bäcker','Polizist','Lehrer','Landwirt','Elektriker','Krankenpfleger','Kfz-Mechatroniker','Maurer','Bankkaufmann','Schreiner','Fliesenleger','Erzieher','Zimmermann','Installateur','Schüler','Busfahrer','Gärtner','Lagerist','Informatiker','Versicherungsmakler','Postbote','Physiotherapeut','Feuerwehrmann','Koch','Industriemechaniker','Korbmacher','Brauer','Glasbläser','Schichtarbeiter','Ingenieur'];
const SKIN = [['#f3c9a2', '#d9a47c'], ['#e6b085', '#c98d62'], ['#c98c5c', '#a96d43'], ['#9a6440', '#7a4a2c'], ['#6e4428', '#52301b']];
const HAIR = ['#2a1a10', '#4a2e18', '#7a4a20', '#c9a050', '#e3c27a', '#1a1a1a', '#8a3a18', '#b8b0a0'];
// Kader eines Vereins: 18 Spieler, die ersten 11 in der Grundformation (TW, 4 Abwehr, 4 Mittelfeld, 2 Sturm), dann 7 Ersatzspieler
const SQUAD_GRPS = ['TW', 'AB', 'AB', 'AB', 'AB', 'MF', 'MF', 'MF', 'MF', 'ST', 'ST', 'TW', 'AB', 'AB', 'MF', 'MF', 'ST', 'MF'];
function makePlayer18(r, grp, lvl, used, nums, tid) {
  let name; do { name = SUR[(r() * SUR.length) | 0]; } while (used.has(name) && used.size < SUR.length); used.add(name);
  let num, tries = 0; do { num = grp === 'TW' && tries < 12 ? [1, 12, 22, 30][(r() * 4) | 0] : 2 + ((r() * (tries < 40 ? 30 : 60)) | 0); tries++; } while (nums.has(num) && tries < 200); nums.add(num);
  const b = POS_BIAS[grp], age = clamp(Math.round(17 + r() * 17 + (r() < 0.12 ? 4 : 0)), 17, 38);
  const p = { name, first: FIRST[(r() * FIRST.length) | 0], nick: r() < 0.18 ? NICK[(r() * NICK.length) | 0] : '', job: JOBS[(r() * JOBS.length) | 0], num, grp, age, trait: '' };
  const agePen = age > 31 ? (age - 31) * 1.2 : 0;
  for (const a of ATTRS) p[a] = clamp(Math.round(lvl + (b[a] || 0) + (r() - 0.5) * 14 - (a === 'tmp' || a === 'aus' ? agePen : 0)), 20, 95);
  if (r() < 0.16) { p.trait = TRAITS[grp][(r() * TRAITS[grp].length) | 0]; }
  const T = { Elfmeterkiller: ['tw', 3], Katze: ['tw', 5], Kopfballungeheuer: ['kop', 10], Blutgrätsche: ['zwk', 6], Dampfwalze: ['zwk', 6], Dauerläufer: ['aus', 10], Schlitzohr: ['tec', 8], Flankengott: ['pas', 6], Freistoßkönig: ['sch', 5], Knipser: ['sch', 8], Turbo: ['tmp', 10] }[p.trait];
  if (T) p[T[0]] = Math.min(97, p[T[0]] + T[1]);
  p.skin = (r() * SKIN.length) | 0; p.hair = age > 33 && r() < 0.5 ? '#b8b0a0' : HAIR[(r() * HAIR.length) | 0]; p.style = (r() * 6) | 0;
  p.beard = age > 20 && r() < 0.32; p.belly = age > 27 && r() < 0.22; p.tall = grp === 'TW' || (grp === 'AB' && r() < 0.5) ? 1 : 0; p.socks = r() < 0.2;
  p.ovr = ovr(p);
  return p;
}
function roster(tid) {
  const t = TEAMS[tid], r = seeded(hashStr(t.n + '#kader')), used = new Set(), nums = new Set();
  return SQUAD_GRPS.map((grp, i) => {
    const lvl = (grp === 'TW' ? t.def : grp === 'AB' ? t.def : grp === 'ST' ? t.att : (t.att + t.def) / 2) - (i >= 11 ? 6 : 0) + (i === 9 ? 3 : 0);
    return makePlayer18(r, grp, lvl, used, nums, tid);
  });
}
const teamOvr = tid => { const ro = roster(tid).slice(0, 11); return Math.round(ro.reduce((s, p) => s + p.ovr, 0) / 11); };
const stars = v => clamp(Math.round((v - 50) / 6), 1, 5);   // Stärke als 1 bis 5 Sterne
