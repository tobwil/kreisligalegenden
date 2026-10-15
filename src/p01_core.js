'use strict';
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
// Kreis Coburg/Kronach/Lichtenfels (BFV), Saison 2026/27: echte Vereinsnamen, Stärke grob nach dem Tabellenstand im Herbst 2026.
// Spieler, Werte und Trikotfarben sind frei erfunden. [Kürzel, Name, Kurzname, Farbe 1, Farbe 2, Stärke, Platz, Muster]
// Muster: 0 einfarbig, 1 Längsstreifen, 2 Ringel, 3 Brustring
const KREIS_LIGEN = [
  { k: 'KL1', n: 'Kreisliga 1 Coburg', short: 'KREISLIGA 1', clubs: [
    ['STA', 'TSV 1860 Staffelstein', 'Staffelstein', '#c8102e', '#ffffff', 74, 0, 0],
    ['KRE', 'FC Krecktal', 'Krecktal', '#0b3d91', '#ffffff', 69, 1, 1],
    ['EIN', 'VfB Einberg', 'Einberg', '#ffffff', '#c8102e', 69, 2, 3],
    ['LIC', '1. FC Lichtenfels II', 'Lichtenfels II', '#d71920', '#1a1a1a', 68, 1, 0],
    ['SON', 'TSV Sonnefeld', 'Sonnefeld', '#0a8a3e', '#ffffff', 67, 0, 0],
    ['OBL', 'TSV Oberlauter', 'Oberlauter', '#1d4f91', '#ffd200', 66, 0, 2],
    ['KET', 'SV Coburg-Ketschendorf', 'Ketschendorf', '#f07d00', '#141414', 66, 2, 0],
    ['GES', 'TSV Gestungshausen', 'Gestungshausen', '#ffd200', '#14306b', 65, 0, 0],
    ['SCH', 'TSV Scherneck', 'Scherneck', '#7a1f2b', '#f4f4f0', 65, 1, 0],
    ['PFA', 'TSV Pfarrweisach', 'Pfarrweisach', '#0057a8', '#f4f4f4', 64, 0, 1],
    ['GRO', 'SV Großgarnstadt', 'Großgarnstadt', '#00733a', '#ffd200', 63, 2, 0],
    ['BOS', 'SV Bosporus Coburg', 'Bosporus', '#e30613', '#ffffff', 63, 1, 0],
    ['NFG', 'SG Niederfüllbach/Grub', 'Niederfüllbach', '#5c2d91', '#ffffff', 60, 0, 0],
    ['HEI', 'SV Heilgersdorf', 'Heilgersdorf', '#1a1a1a', '#ffffff', 57, 2, 1],
    ['HEL', 'TSV 1861 Heldritt', 'Heldritt', '#1356a8', '#ffffff', 57, 0, 0],
    ['HAA', 'FC Haarbrücken', 'Haarbrücken', '#008d4c', '#141414', 56, 1, 2],
  ] },
  { k: 'KL2', n: 'Kreisliga 2 Coburg/Kronach/Lichtenfels', short: 'KREISLIGA 2', clubs: [
    ['KRO', '1. FC Kronach', 'Kronach', '#14306b', '#ffffff', 72, 0, 0],
    ['MAR', 'TSV Marktzeuln', 'Marktzeuln', '#0a8a3e', '#ffffff', 71, 0, 0],
    ['BUR', '1. FC Burgkunstadt', 'Burgkunstadt', '#d0021b', '#ffffff', 70, 2, 0],
    ['STO', '1. FC Stockheim', 'Stockheim', '#ffd200', '#1a1a1a', 69, 1, 0],
    ['NEU', 'DJK-SV Neufang', 'Neufang', '#0b3d91', '#ffd200', 68, 0, 3],
    ['WON', 'SG Wolfersgrün/Neuengrün/Nurn', 'Wolfersgrün', '#c8102e', '#1a1a1a', 68, 2, 0],
    ['BAI', '1. FC Baiersdorf', 'Baiersdorf', '#1a1a1a', '#ffd200', 68, 0, 1],
    ['LUD', 'TSV Ludwigsstadt', 'Ludwigsstadt', '#1d4f91', '#ffffff', 65, 2, 0],
    ['SHF', 'SG Steinbach/Hirschfeld', 'Steinbach', '#00863f', '#f5f5f5', 63, 0, 2],
    ['STE', 'TSV Steinberg', 'Steinberg', '#7a1f2b', '#ffffff', 62, 1, 0],
    ['DJL', 'DJK Lichtenfels', 'DJK Lichtenfels', '#ffffff', '#0a3d91', 61, 0, 0],
    ['MRO', 'SG Roth-Main Mainroth', 'Mainroth', '#e2001a', '#ffffff', 61, 0, 1],
    ['WIN', 'TSV Windheim', 'Windheim', '#f39200', '#0a2d6e', 60, 2, 0],
    ['ARN', 'SC Jura Arnstein', 'Arnstein', '#5c2d91', '#ffd200', 60, 1, 0],
    ['LET', 'SpVgg Lettenreuth', 'Lettenreuth', '#00a0dc', '#ffffff', 58, 0, 2],
    ['MSW', 'SG Michelau/Schwürbitz', 'Michelau', '#e30613', '#141414', 56, 0, 0],
  ] },
];
// Kreismeister aus anderen Regionen (Gegner in den Playoffs): Dörfer und Vereine frei erfunden, Regionen echt
const REGIONS = [
  ['Ostfriesland', ['siel', 'fehn', 'warf', 'hörn', 'um', 'ens', 'moor']], ['Nordheide', ['büttel', 'stedt', 'loh', 'horst', 'bostel', 'heide']],
  ['Holstein', ['hagen', 'rade', 'au', 'wisch', 'stedt', 'felde']], ['Emsland', ['lage', 'brück', 'loh', 'ingen', 'kamp', 'heim']],
  ['Altmark', ['leben', 'itz', 'ow', 'stedt', 'beck', 'au']], ['Uckermark', ['ow', 'in', 'itz', 'walde', 'felde', 'see']],
  ['Lausitz', ['witz', 'itz', 'au', 'ow', 'ick', 'hain']], ['Erzgebirge', ['grün', 'itz', 'bach', 'hain', 'walde', 'tal']],
  ['Sauerland', ['hagen', 'scheid', 'mecke', 'hausen', 'ohl', 'berg']], ['Eifel', ['scheid', 'rath', 'weiler', 'born', 'bach', 'feld']],
  ['Westerwald', ['bach', 'rod', 'hain', 'born', 'scheid', 'hausen']], ['Odenwald', ['bach', 'hausen', 'rode', 'hain', 'feld', 'brunn']],
  ['Allgäu', ['ing', 'hofen', 'ried', 'moos', 'kirch', 'zell']], ['Schwäbische Alb', ['ingen', 'hausen', 'stetten', 'weiler', 'heim', 'buch']],
  ['Pfalz', ['heim', 'bach', 'weiler', 'hof', 'stein', 'thal']],
];
const VROOT = ['Kleckers', 'Wiesen', 'Linden', 'Eichen', 'Buchen', 'Birken', 'Tannen', 'Mühl', 'Kirch', 'Brunn', 'Stein', 'Hasel', 'Ochsen', 'Gänse', 'Wolfs', 'Fuchs', 'Hasen', 'Raben', 'Lerchen', 'Wald', 'Moor', 'Sand', 'Lehm', 'Kalk', 'Rüben', 'Hopfen', 'Gersten', 'Hafer', 'Apfel', 'Krähen', 'Bären', 'Hirsch', 'Dachs', 'Erlen', 'Weiden', 'Rosen', 'Holler', 'Schlehen', 'Bocks', 'Kuckucks', 'Schnecken', 'Mösl', 'Hühner', 'Kraut', 'Lauter', 'Moos', 'Schwalben', 'Finken'];
const VPRE = ['Ober', 'Unter', 'Nieder', 'Hinter', 'Groß', 'Klein', 'Alt', 'Neu', 'Hohen'];
const CLUBPRE = ['SV', 'TSV', 'FC', 'SC', 'TuS', 'SpVgg', 'VfB', 'VfL', 'FSV', 'SSV', 'TSG', 'DJK', 'SuS', 'ASV', 'BSC'];
const CLUBMID = ['Germania', 'Eintracht', 'Viktoria', 'Concordia', 'Borussia', 'Fortuna', 'Alemannia', 'Teutonia', 'Union'];
const KITCOL = [['#c8102e', '#ffffff', 'Rot-Weiß'], ['#1d4f91', '#ffffff', 'Blau-Weiß'], ['#0a8a3e', '#ffffff', 'Grün-Weiß'], ['#141414', '#ffd200', 'Schwarz-Gelb'],
  ['#7a1f2b', '#f4f4f0', ''], ['#f07d00', '#141414', ''], ['#ffd200', '#0a2d6e', 'Gelb-Blau'], ['#5c2d91', '#ffffff', ''], ['#0b3d91', '#e2001a', 'Blau-Rot'],
  ['#e30613', '#141414', 'Rot-Schwarz'], ['#00733a', '#ffd200', ''], ['#5aa9e6', '#ffffff', ''], ['#141414', '#ffffff', 'Schwarz-Weiß'], ['#ffffff', '#c8102e', 'Weiß-Rot']];
const LEAGUE_TEAMS = 16;
const TEAMS = [];
function addTeam(o) { const t = Object.assign({ id: TEAMS.length }, o); t.home = { c1: o.c1, c2: o.c2, pat: o.pat || 0 }; t.away = defaultAway(t); TEAMS.push(t); return t; }
function defaultAway(t) { return lum(t.c1) > 0.75 ? { c1: lum(t.c2) > 0.75 ? '#1d1d24' : t.c2, c2: t.c1, pat: 0 } : { c1: '#f4f4f0', c2: t.c1, pat: 0 }; }
// Platzart: 0 Rasen, 1 Kunstrasen, 2 Hartplatz (Asche)
const GROUNDS = ['RASEN', 'KUNSTRASEN', 'HARTPLATZ'];
KREIS_LIGEN.forEach((L, li) => {
  L.ids = L.clubs.map(([k, n, short, c1, c2, r, gr, pat]) => {
    const rr = seeded(hashStr(n));
    return addTeam({ k, n, short, c1, c2, pat, r, ground: gr, lg: li, real: true, region: 'Coburg', att: Math.round(r + (rr() - 0.5) * 8), def: Math.round(r + (rr() - 0.5) * 8) }).id;
  });
});
// Kürzel aus drei Buchstaben des Ortsnamens, eindeutig über alle Vereine
function uniqueK(v) {
  const L = v.toUpperCase().replace(/[^A-ZÄÖÜ]/g, ''), used = new Set(TEAMS.map(t => t.k)), cand = [L.slice(0, 3), L[0] + L.slice(2, 4), L[0] + L[1] + L[L.length - 1], L[0] + L[3] + L[L.length - 1], L[0] + L[2] + L[L.length - 2]];
  return cand.find(c => c.length === 3 && !used.has(c)) || L.slice(0, 2) + TEAMS.length % 10;
}
// erfundene Kreismeister: je Region ein Verein, Stärke wie ein Kreisliga-Spitzenteam
const REGION_TEAMS = REGIONS.map(([reg, suf], ri) => {
  const r = seeded(hashStr('krl-region-' + reg)), pk = a => a[(r() * a.length) | 0];
  let vil = pk(VROOT).toLowerCase(); vil = vil[0].toUpperCase() + vil.slice(1) + pk(suf);
  if (r() < 0.35) vil = pk(VPRE) + vil.toLowerCase();
  const col = pk(KITCOL), form = r();
  const n = form < 0.25 && col[2] ? `${pk(CLUBPRE)} ${col[2]} ${vil}` : form < 0.45 ? `${pk(CLUBPRE)} ${pk(CLUBMID)} ${vil}` : form < 0.6 ? `${pk(['TSV', 'SV', 'FC', 'TuS'])} ${1890 + ((r() * 60) | 0)} ${vil}` : `${pk(CLUBPRE)} ${vil}`;
  const rating = 66 + Math.round(r() * 9);
  return addTeam({ k: uniqueK(vil), n, short: vil, c1: col[0], c2: col[1], pat: (r() * 4) | 0, r: rating, ground: (r() * 3) | 0, lg: -1, region: reg,
    att: rating + Math.round((r() - 0.5) * 8), def: rating + Math.round((r() - 0.5) * 8) }).id;
});
const LEAGUE = li => KREIS_LIGEN[li].ids.map(i => TEAMS[i]);
const HOME_TEAM = KREIS_LIGEN[0].ids[0];

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
