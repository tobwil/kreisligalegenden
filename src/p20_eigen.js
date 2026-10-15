// ================= Eigener Verein, Trikot und Spieler bearbeiten (Saison) =================
// Wer seinen Verein nicht findet (oder einen erfundenen spielen will), legt ihn selbst an: Name, Kürzel, Farben, Muster, Platz.
// Er spielt dann in der Kreisliga des Vereins, der gerade in der Auswahl markiert ist (die Liga hat dann einen Verein mehr).
// Der eigene Verein steht im Spielstand und wird beim Laden wieder angelegt. Spieler des eigenen Vereins lassen sich umbenennen,
// umnummerieren, auf eine andere Position stellen und anders aussehen lassen – die Werte bleiben, wie sie sind.
const EIGEN_KEY = 'krl_eigen';
const KIT_PAL = ['#c8102e', '#e30613', '#f07d00', '#ffd200', '#0a8a3e', '#00733a', '#5aa9e6', '#1d4f91', '#0b3d91', '#5c2d91', '#7a1f2b', '#141414', '#f4f4f0', '#8a8a8a'];
const PAT_N = ['UNI', 'STREIFEN', 'RINGEL', 'BRUSTRING'];
let EIGEN = null, EIGEN_EDIT = false;
const eigenKeys = ['n', 'short', 'k', 'c1', 'c2', 'pat', 'ground', 'lg'];
const autoShort = n => shortName(n) || n.trim();
const autoK = n => norm(autoShort(n)).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

// eigenen Verein in die Daten einhängen (immer am Ende, damit sich keine anderen Nummern verschieben)
function addCustomTeam(def) {
  let t = TEAMS.find(x => x.custom);
  const f = { k: def.k, n: def.n, short: def.short, c1: def.c1, c2: def.c2, pat: def.pat || 0, ground: def.ground || 0, lg: def.lg };
  if (t) { for (const L of LIGEN) L.ids = L.ids.filter(i => i !== t.id); Object.assign(t, f); t.home = { c1: f.c1, c2: f.c2, pat: f.pat }; t.away = defaultAway(t); }
  else t = addTeam(Object.assign(f, { r: KL_BASE, att: KL_BASE, def: KL_BASE, custom: true }));
  if (!LIGEN[t.lg].ids.includes(t.id)) LIGEN[t.lg].ids.push(t.id);
  SEARCH_IX = null;
  return t.id;
}
function removeCustomTeam() { const t = TEAMS.find(x => x.custom); if (t) for (const L of LIGEN) L.ids = L.ids.filter(i => i !== t.id); SEARCH_IX = null; }
// Spielstand vorbereiten: eigener Verein wieder anlegen, geändertes Trikot übernehmen
function prepCareer(c) {
  if (!c) return;
  if (c.custom) addCustomTeam(c.custom); else removeCustomTeam();
  if (c.kit && TEAMS[c.team]) { const t = TEAMS[c.team]; t.c1 = c.kit.c1; t.c2 = c.kit.c2; t.pat = c.kit.pat; t.home = { ...c.kit }; t.away = defaultAway(t); }
}
function loadCareerSave() { const sv = store.get(CAREER_KEY); prepCareer(sv); return validCareer(sv) ? sv : null; }

// ---------- Formular: eigener Verein ----------
function eigenHTML() {
  const E = EIGEN, L = LIGEN[E.lg], K = KREISE[L.kreis], kit = { c1: E.c1, c2: E.c2, pat: E.pat };
  const sw = (key, v) => `<button class="sw ${E[key] === v ? 'on' : ''}" style="background:${v}" data-act="eigCol" data-arg="${key}|${v}" aria-label="Farbe ${v}"></button>`;
  return `<div class="panel narrow"><div class="row spread"><h2>${EIGEN_EDIT ? 'VEREIN BEARBEITEN' : 'EIGENER VEREIN'}</h2><button class="small" data-act="eigBack">ZURÜCK</button></div>
    <div class="tcard active"><div class="tname"><img id="eg_icon" src="${iconURL(kit)}" alt=""><span id="eg_title">${esc((E.n || 'DEIN VEREIN').toUpperCase())}</span></div>
      <div class="tag">${EIGEN_EDIT ? '' : `SPIELT IN: ${esc(L.n.toUpperCase())} · ${esc(K.n.toUpperCase())}`}</div></div>
    <div class="eform">
      <label>Vereinsname<input id="eg_n" maxlength="34" value="${esc(E.n)}" placeholder="z. B. SV Musterdorf 1920" autocomplete="off"></label>
      <label>Kurzname<input id="eg_short" maxlength="16" value="${esc(E.short)}" autocomplete="off"></label>
      <label>Kürzel<input id="eg_k" maxlength="3" value="${esc(E.k)}" autocomplete="off" style="text-transform:uppercase"></label>
    </div>
    <div class="row"><span class="tag">FARBE 1</span>${KIT_PAL.map(v => sw('c1', v)).join('')}</div>
    <div class="row"><span class="tag">FARBE 2</span>${KIT_PAL.map(v => sw('c2', v)).join('')}</div>
    <div class="row"><span class="tag">MUSTER</span>${PAT_N.map((n, i) => `<button class="small ${E.pat === i ? 'on' : ''}" data-act="eigPat" data-arg="${i}">${n}</button>`).join('')}</div>
    <div class="row"><span class="tag">PLATZ</span>${GROUNDS.map((n, i) => `<button class="small ${E.ground === i ? 'on' : ''}" data-act="eigGround" data-arg="${i}">${n}</button>`).join('')}</div>
    ${EIGEN_EDIT ? '' : '<p class="muted">Dein Verein spielt in der Kreisliga des Vereins, den du in der Auswahl markiert hast – wähle vorher dort deinen Kreis. Alle Vereine starten gleich stark, die Spieler kannst du danach im Kader bearbeiten.</p>'}
    <p class="cmsg" hidden></p>
    <div class="row"><button class="main" data-act="eigSave">${EIGEN_EDIT ? 'SPEICHERN' : 'VEREIN ANLEGEN'}</button></div></div>`;
}
function renderEigen() {
  show(eigenHTML(), { back: ACT.eigBack });
  const $ = id => menu.querySelector('#' + id);
  let manS = EIGEN.short && EIGEN.short !== autoShort(EIGEN.n), manK = EIGEN.k && EIGEN.k !== autoK(EIGEN.n);
  $('eg_n').addEventListener('input', e => {
    EIGEN.n = e.target.value;
    if (!manS) { EIGEN.short = autoShort(EIGEN.n).slice(0, 16); $('eg_short').value = EIGEN.short; }
    if (!manK) { EIGEN.k = autoK(EIGEN.n); $('eg_k').value = EIGEN.k; }
    $('eg_title').textContent = (EIGEN.n || 'DEIN VEREIN').toUpperCase();
  });
  $('eg_short').addEventListener('input', e => { EIGEN.short = e.target.value; manS = true; });
  $('eg_k').addEventListener('input', e => { EIGEN.k = e.target.value.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, '').slice(0, 3); e.target.value = EIGEN.k; manK = true; });
}
Object.assign(ACT, {
  ncEigen() {
    const prev = store.get(EIGEN_KEY, null);
    EIGEN = Object.assign({ n: '', short: '', k: '', c1: '#c8102e', c2: '#f4f4f0', pat: 0, ground: 0 }, prev || {}, { lg: TEAMS[NEWC.team].custom && prev ? prev.lg : TEAMS[NEWC.team].lg });
    EIGEN_EDIT = false; renderEigen();
  },
  cEigen() {
    const C = CAREER, t = TEAMS[C.team];
    EIGEN = { n: t.n, short: t.short, k: t.k, c1: t.home.c1, c2: t.home.c2, pat: t.home.pat || 0, ground: t.ground, lg: t.lg };
    EIGEN_EDIT = true; renderEigen();
  },
  eigCol(a) { const [k, v] = a.split('|'); EIGEN[k] = v; renderEigen(); },
  eigPat(a) { EIGEN.pat = +a; renderEigen(); },
  eigGround(a) { EIGEN.ground = +a; renderEigen(); },
  eigBack() { if (EIGEN_EDIT) { CTAB = 'verein'; ACT.chub(); } else renderNewCareer(); },
  eigSave() {
    const E = EIGEN; E.n = (E.n || '').trim(); E.short = (E.short || '').trim() || autoShort(E.n); E.k = (E.k || '').trim().toUpperCase() || autoK(E.n);
    if (E.n.length < 3) return toast('Bitte einen Vereinsnamen mit mindestens 3 Zeichen eingeben.');
    if (E.c1 === E.c2) return toast('Bitte zwei verschiedene Farben wählen.');
    if (!EIGEN_EDIT) {
      const def = {}; for (const k of eigenKeys) def[k] = E[k];
      store.set(EIGEN_KEY, def); NEWC.team = addCustomTeam(def); pkFocus(NEWC.team); track('eigener-verein');
      return renderNewCareer();
    }
    // im Spielstand: eigener Verein bekommt alles, ein echter Verein nur Trikot und Platz (Name bleibt der echte)
    const C = CAREER, t = TEAMS[C.team];
    if (C.custom) { for (const k of eigenKeys) C.custom[k] = k === 'lg' ? C.custom.lg : E[k]; addCustomTeam(C.custom); C.tname = t.n; store.set(EIGEN_KEY, C.custom); }
    else { C.kit = { c1: E.c1, c2: E.c2, pat: E.pat }; t.ground = E.ground; prepCareer(C); }
    t.ground = E.ground; saveCareer(); CTAB = 'verein'; ACT.chub();
  },
});

// ---------- Spieler bearbeiten ----------
let PED = null;   // { pid, snap }
const PED_KEYS = ['first', 'name', 'nick', 'num', 'grp', 'skin', 'hair', 'style', 'beard', 'belly'];
function playerEditHTML(p) {
  const btn = (act, v, on, label, style = '') => `<button class="small ${on ? 'on' : ''}" data-act="${act}" data-arg="${v}" ${style}>${label}</button>`;
  return `<div class="panel narrow"><div class="pcard"><canvas width="40" height="40" data-pid="${p.pid}"></canvas><div><h2>SPIELER BEARBEITEN</h2><p class="muted">Werte und Stärke bleiben gleich – nur Name, Nummer, Position und Aussehen.</p></div></div>
    <div class="eform">
      <label>Vorname<input id="pe_first" maxlength="16" value="${esc(p.first)}" autocomplete="off"></label>
      <label>Nachname<input id="pe_name" maxlength="18" value="${esc(p.name)}" autocomplete="off"></label>
      <label>Spitzname<input id="pe_nick" maxlength="16" value="${esc(p.nick || '')}" placeholder="(keiner)" autocomplete="off"></label>
      <label>Nummer<input id="pe_num" type="number" min="1" max="99" value="${PED.num ?? p.num}" inputmode="numeric"></label>
    </div>
    <div class="row"><span class="tag">POSITION</span>${['TW', 'AB', 'MF', 'ST'].map(g => btn('peGrp', g, p.grp === g, GRP_N[g].toUpperCase())).join('')}</div>
    <div class="row"><span class="tag">HAUT</span>${SKIN.map((s, i) => `<button class="sw ${p.skin === i ? 'on' : ''}" style="background:${s[0]}" data-act="peSkin" data-arg="${i}" aria-label="Hautton ${i + 1}"></button>`).join('')}</div>
    <div class="row"><span class="tag">HAARE</span>${HAIR.map(h => `<button class="sw ${p.hair === h ? 'on' : ''}" style="background:${h}" data-act="peHair" data-arg="${h}" aria-label="Haarfarbe"></button>`).join('')}</div>
    <div class="row"><span class="tag">FRISUR</span>${[0, 1, 2, 3, 4, 5].map(i => btn('peStyle', i, p.style === i, i + 1)).join('')}</div>
    <div class="row"><span class="tag">EXTRAS</span>${btn('peBeard', 1, p.beard, 'BART')}${btn('peBelly', 1, p.belly, 'BAUCH')}</div>
    <p class="cmsg" hidden></p>
    <div class="row"><button class="main" data-act="peSave">SPEICHERN</button><button data-act="peCancel">ABBRECHEN</button></div></div>`;
}
function renderPlayerEdit() {
  const p = playerById(PED.pid); if (!p) return ACT.chub();
  show(playerEditHTML(p), { back: ACT.peCancel }); bindHubCanvases();
  const $ = id => menu.querySelector('#' + id);
  for (const k of ['first', 'name', 'nick']) $('pe_' + k).addEventListener('input', e => { p[k] = e.target.value; });
  $('pe_num').addEventListener('input', e => { PED.num = e.target.value; });
}
const pedLook = (k, v) => { const p = playerById(PED.pid); if (!p) return; p[k] = v; renderPlayerEdit(); };
Object.assign(ACT, {
  cpEdit(a) { const p = playerById(+a); if (!p || p.tid !== CAREER.team) return; PED = { pid: p.pid, snap: Object.fromEntries(PED_KEYS.map(k => [k, p[k]])) }; renderPlayerEdit(); },
  peGrp(a) { const p = playerById(PED.pid); if (!p) return; p.grp = a; p.ovr = ovr(p); renderPlayerEdit(); },
  peSkin(a) { pedLook('skin', +a); },
  peHair(a) { pedLook('hair', a); },
  peStyle(a) { pedLook('style', +a); },
  peBeard() { const p = playerById(PED.pid); pedLook('beard', !p.beard); },
  peBelly() { const p = playerById(PED.pid); pedLook('belly', !p.belly); },
  peCancel() { const p = playerById(PED && PED.pid); if (p) { Object.assign(p, PED.snap); p.ovr = ovr(p); } PED = null; showPlayerOrHub(p); },
  peSave() {
    const p = playerById(PED.pid); if (!p) return ACT.chub();
    const $ = id => menu.querySelector('#' + id);
    p.first = $('pe_first').value.trim() || PED.snap.first; p.name = $('pe_name').value.trim() || PED.snap.name; p.nick = $('pe_nick').value.trim();
    const num = clamp(Math.round(+(PED.num ?? $('pe_num').value) || p.num), 1, 99);
    if (num !== PED.snap.num) { const other = ensureSquad(CAREER.team).find(q => q !== p && q.num === num); if (other) other.num = PED.snap.num; p.num = num; }
    p.ovr = ovr(p); PED = null; saveCareer(); showPlayer(p.pid);
  },
});
const showPlayerOrHub = p => p ? showPlayer(p.pid) : ACT.chub();
