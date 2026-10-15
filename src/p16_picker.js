// ================= Vereinsauswahl: Deutschlandkarte -> Landesverband -> Kreis -> Liga -> Verein =================
// Keine langen Listen: Auf jeder Stufe stehen nur wenige Kacheln (21 Verbände, die Kreise eines Verbands, die Vereine einer Liga).
// Dazu eine Suche über alle Vereine mit höchstens acht Treffern.
const PK = { v: null, k: null, l: null, q: '', act: 'qpick', sel: [] };
// Verbände in der Reihenfolge der Kartenbuchstaben
const MAPV = KARTE.order.map(id => VERB.findIndex(V => V.id === id));
let MAPGRID = null;
function mapGrid() {
  if (MAPGRID) return MAPGRID;
  MAPGRID = new Int8Array(KARTE.w * KARTE.h).fill(-1);
  KARTE.rows.forEach((row, y) => {
    let x = 0;
    for (const [, ch, n] of row.matchAll(/([.A-Z])(\d*)/g)) { const len = n ? +n : 1, v = ch === '.' ? -1 : MAPV[ch.charCodeAt(0) - 65]; for (let i = 0; i < len; i++) MAPGRID[y * KARTE.w + x + i] = v ?? -1; x += len; }
  });
  return MAPGRID;
}
// Kartenfarben: Wiesengrün in Abstufungen, die Grenze dunkel, der gewählte Verband gold
const MAPCOL = ['#3f8f4a', '#4ea055', '#367d41', '#5aa95c', '#46964f', '#2f7039', '#53a35a'];
function drawGermany(cvs, hi, hover) {
  const g = mapGrid(), w = KARTE.w, h = KARTE.h, c = cvs.getContext('2d'), img = c.createImageData(w, h);
  const rgb = hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = g[y * w + x], o = (y * w + x) * 4; if (v < 0) { img.data[o + 3] = 0; continue; }
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= w || yy >= h || g[yy * w + xx] !== v; });
    let col = rgb(v === hi ? '#ffc83a' : v === hover ? '#8fd18f' : MAPCOL[v % MAPCOL.length]);
    if (edge) col = col.map(q => q * 0.45);
    if (v !== hi && hi != null && hi >= 0) col = col.map(q => q * 0.8);
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}
// Mittelpunkt eines Verbands auf der Karte (für die Beschriftung beim Überfahren)
function mapCenter(v) {
  const g = mapGrid(); let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < g.length; i++) if (g[i] === v) { sx += i % KARTE.w; sy += (i / KARTE.w) | 0; n++; }
  return n ? [sx / n, sy / n] : [50, 68];
}
// Auswahl auf einen Verein stellen (zeigt dessen Liga)
function pkFocus(tid) { const L = ligaOf(tid); PK.v = L.v; PK.k = L.kreis; PK.l = TEAMS[tid].lg; PK.q = ''; }
const teamTile = (T, extra = '') => `<button class="tbtn ${PK.sel[0] === T.id ? 'sel-a' : ''} ${PK.sel[1] === T.id ? 'sel-b' : ''}" data-act="${PK.act}" data-arg="${T.id}" ${extra}><img src="${iconURL(T.home)}" alt=""><b>${esc(T.k)}</b><small>${esc(T.short)}</small>${starHTML(stars(teamOvr(T.id)))}</button>`;
function pickerHTML() {
  const crumbs = [`<button class="small crumb ${PK.v == null ? 'on' : ''}" data-act="pkTop">DEUTSCHLAND</button>`];
  if (PK.v != null) crumbs.push(`<button class="small crumb ${PK.k == null ? 'on' : ''}" data-act="pkV" data-arg="${PK.v}">${esc(VERB[PK.v].n.toUpperCase())}</button>`);
  if (PK.k != null) crumbs.push(`<button class="small crumb on" data-act="pkK" data-arg="${PK.k}">${esc(KREISE[PK.k].n.toUpperCase())}</button>`);
  let body;
  if (PK.v == null) {
    body = `<div class="pkmap"><div class="mapbox"><canvas id="pkmap" width="${KARTE.w}" height="${KARTE.h}" aria-label="Deutschlandkarte: Landesverband wählen"></canvas><span id="pkmapn" class="mapname"></span></div>
      <div class="chips">${VERB.map((V, i) => `<button class="small" data-act="pkV" data-arg="${i}">${esc(V.n)}<i>${V.kreise.length}</i></button>`).join('')}</div></div>`;
  } else if (PK.k == null) {
    const V = VERB[PK.v];
    body = `<div class="pkmap"><div class="mapbox small"><canvas id="pkmap" width="${KARTE.w}" height="${KARTE.h}"></canvas></div>
      <div><p class="muted pkinfo">${esc(V.n)}: ${V.kreise.length} ${V.kreise.length === 1 ? 'Kreis' : 'Kreise'}, gespielt wird die ${esc(V.kl.replace(/;.*/, ''))}. Wähle deinen Kreis.</p>
      <div class="chips">${V.kreise.map(ki => `<button class="small" data-act="pkK" data-arg="${ki}">${esc(KREISE[ki].n)}${KREISE[ki].ligen.length > 1 ? `<i>${KREISE[ki].ligen.length}</i>` : ''}</button>`).join('')}</div></div></div>`;
  } else {
    const K = KREISE[PK.k], li = K.ligen.includes(PK.l) ? PK.l : K.ligen[0];
    body = `${K.ligen.length > 1 ? `<div class="ctabs">${K.ligen.map(l => `<button class="small ${l === li ? 'on' : ''}" data-act="pkL" data-arg="${l}">${esc(LIGEN[l].n.toUpperCase())}</button>`).join('')}</div>` : `<h3>${esc(LIGEN[li].n.toUpperCase())}</h3>`}
      <div class="grid">${LEAGUE(li).map(T => teamTile(T)).join('')}</div>`;
  }
  return `<div class="picker"><div class="pkbar"><div class="crumbs">${crumbs.join('<span>›</span>')}</div><input id="pkq" type="search" placeholder="Verein oder Ort suchen …" value="${esc(PK.q)}" autocomplete="off" enterkeyhint="search"></div>
    <div id="pkbody">${PK.q.trim().length >= 2 ? searchHTML() : body}</div></div>`;
}
function searchHTML() {
  const hits = searchTeams(PK.q);
  if (!hits.length) return '<p class="muted">Kein Verein gefunden. Tipp: Ortsname eingeben, z. B. „Staffelstein“.</p>';
  return `<div class="grid">${hits.map(id => teamTile(TEAMS[id], `title="${esc(TEAMS[id].n)} · ${esc(homeTag(id))}"`)).join('')}</div>`;
}
// nach show(): Karte zeichnen, Klicks auf die Karte und Suche verdrahten
function pickerWire(rerender) {
  const cvs = document.getElementById('pkmap');
  if (cvs) {
    drawGermany(cvs, PK.v);
    const at = e => { const r = cvs.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width * KARTE.w) | 0, y = ((e.clientY - r.top) / r.height * KARTE.h) | 0; return x >= 0 && y >= 0 && x < KARTE.w && y < KARTE.h ? mapGrid()[y * KARTE.w + x] : -1; };
    const lbl = document.getElementById('pkmapn');
    let last = -2;
    cvs.addEventListener('pointermove', e => {
      const v = at(e); if (v === last) return; last = v; drawGermany(cvs, PK.v, v);
      if (lbl) { if (v >= 0) { const [cx, cy] = mapCenter(v); lbl.textContent = VERB[v].n; lbl.style.left = (cx / KARTE.w * 100) + '%'; lbl.style.top = (cy / KARTE.h * 100) + '%'; lbl.hidden = false; } else lbl.hidden = true; }
    });
    cvs.addEventListener('pointerleave', () => { last = -2; drawGermany(cvs, PK.v); if (lbl) lbl.hidden = true; });
    cvs.addEventListener('click', e => { e.stopPropagation(); const v = at(e); if (v >= 0) { AU.init(); AU.select(); ACT.pkV(v); } });
    if (lbl) lbl.hidden = true;
  }
  const q = document.getElementById('pkq');
  if (q) q.addEventListener('input', () => {
    PK.q = q.value; const b = document.getElementById('pkbody');
    if (PK.q.trim().length >= 2) { b.innerHTML = searchHTML(); b.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); AU.init(); AU.select(); ACT[el.dataset.act](el.dataset.arg, el); })); }
    else if (PK.q.trim().length === 0) rerender('#pkq');
  });
}
let PK_RENDER = null;
Object.assign(ACT, {
  pkTop() { PK.v = PK.k = null; PK.q = ''; PK_RENDER('[data-act="pkV"]'); },
  pkV(a) { PK.v = +a; PK.k = null; PK.q = ''; const V = VERB[PK.v]; if (V.kreise.length === 1) PK.k = V.kreise[0]; PK_RENDER(PK.k != null ? '.picker .tbtn' : '[data-act="pkK"]'); },
  pkK(a) { PK.k = +a; PK.l = KREISE[PK.k].ligen[0]; PK.q = ''; PK_RENDER('.picker .tbtn'); },
  pkL(a) { PK.l = +a; PK_RENDER(`[data-act="pkL"][data-arg="${a}"]`); },
});
