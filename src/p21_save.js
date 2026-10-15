// ================= Laufendes Spiel speichern und fortsetzen =================
// Handys beenden Tabs im Hintergrund gern (kurz zu WhatsApp, Anruf). Darum wird das laufende Spiel beim Verlassen der Seite
// gespeichert (wie bei Hallen-Legenden) und lässt sich im Hauptmenü fortsetzen: Spielstand, Uhr, Halbzeit, Statistik, Torschützen,
// Wechsel, Karten und Kondition. Weiter geht es mit einem Freistoß für die Mannschaft, die den Ball hatte.
// Ein Saisonspiel zählt nur, wenn genau diese Partie in der Saison noch ansteht – sonst wird es als Freundschaftsspiel fortgesetzt.
const MATCH_KEY = 'krl_spiel';
const careerStamp = () => CAREER ? `${CAREER.team}|${CAREER.year}|${CAREER.S.ci}` : '';
const dKey = d => d.pid != null ? 'p' + d.pid : `${d.name}|${d.num}`;
const dState = d => ({ k: dKey(d), ms: d.ms, yc: d.yc || 0, energy: d.energy, used: !!d.used, subbed: !!d.subbed, onAt: d.onAt || 0, note: d.note });
function saveMatch() {
  if (!G || G.demo || G.tut || G.watch || G.so || G.counted || G.phase === 'end') return false;
  if (G.half === 1 && G.clock < 2 && !G.score[0] && !G.score[1]) return false;   // gerade erst angepfiffen: nichts zu retten
  const o = Object.assign({}, G.opts); for (const k of ['xi', 'bench', 'career', 'watch', 'form', 'ment', 'resume']) delete o[k];
  const brk = ['halfend', 'pause', 'etpause'].includes(G.phase), bo = G.ball.owner ? G.players.indexOf(G.ball.owner) : -1;
  const d = {
    v: 1, tid: G.tid, o, career: !!G.career, ck: G.career ? careerStamp() : '', kits: G.kits, wx: G.wx, brk,
    score: G.score, half: G.half, clock: G.clock, added: G.added, addShown: !!G.addShown, swap: G.swap, subs: G.subs, stats: G.stats, log: G.log,
    form: G.form, ment: G.ment, poss: G.poss, bx: G.ball.x, by: G.ball.y, bo, kick: ['goal', 'replay'].includes(G.phase) && G.scoreTeam != null ? 1 - G.scoreTeam : G.phase === 'kickoff' && G.sp ? G.sp.team : null,
    ps: G.players.map(p => ({ off: !!p.off, d: dState(p.d) })), bench: G.bench.map(B => B.map(dState)), at: Date.now(),
  };
  try { store.set(MATCH_KEY, d); return true; } catch (e) { return false; }
}
// gespeichertes Spiel nur verwenden, wenn es vollständig ist (sonst verwerfen statt abstürzen)
function savedMatch() {
  const d = store.get(MATCH_KEY, null);
  const ok = d && d.v === 1 && Array.isArray(d.tid) && TEAMS[d.tid[0]] && TEAMS[d.tid[1]] && Array.isArray(d.score) && Array.isArray(d.ps) && d.ps.length === 22 && d.half >= 1;
  if (d && !ok) store.del(MATCH_KEY);
  return ok ? d : null;
}
const delMatch = () => store.del(MATCH_KEY);
function savedInfo() {
  const d = savedMatch(); if (!d) return '';
  return `${TEAMS[d.tid[0]].k} ${d.score[0]}:${d.score[1]} ${TEAMS[d.tid[1]].k} · ${d.half <= 2 ? d.half + '. HZ' : 'VERL.'}${d.career ? ' · SAISON' : ''}`;
}
function loadMatch() {
  const d = savedMatch(); if (!d) return ACT.main();
  // Saisonspiel nur, wenn genau diese Partie noch ansteht
  let o = Object.assign({}, d.o), career = false;
  if (d.career && !CAREER) { const sv = loadCareerSave(); if (sv) CAREER = sv; }
  if (d.career && CAREER && d.ck === careerStamp()) { const co = careerMatchOpts(false), g = myGame(); if (co && g && g.h === d.tid[0] && g.a === d.tid[1]) { o = co; career = true; } }
  o.kits = d.kits; o.wx = d.wx; o.resume = true; o.watch = false;
  startMatch(d.tid[0], d.tid[1], o);
  // Spieler zuordnen (auch nach Wechseln), Statistik und Karten übernehmen
  const pool = new Map(); for (const p of G.players) pool.set(dKey(p.d), p.d); for (const B of G.bench) for (const x of B) pool.set(dKey(x), x);
  const put = (x, s) => { x.ms = s.ms; x.yc = s.yc; x.energy = s.energy; x.used = s.used; x.subbed = s.subbed; x.onAt = s.onAt; if (s.note != null) x.note = s.note; return x; };
  if (d.ps.every(s => pool.has(s.d.k)) && d.bench.every(B => B.every(s => pool.has(s.k)))) {
    d.ps.forEach((s, i) => { const p = G.players[i], x = put(pool.get(s.d.k), s.d); p.d = x; p.off = s.off; p.look = lookOf(x, G.kits[p.team], isGK(p)); });
    G.bench = d.bench.map(B => B.map(s => put(pool.get(s.k), s)));
  }
  Object.assign(G, { score: d.score, half: d.half, clock: d.clock, added: d.added, addShown: d.addShown, swap: d.swap, subs: d.subs, stats: d.stats, log: d.log, form: d.form, ment: d.ment });
  if (!career) G.career = null;
  for (const p of G.players) if (p.off) { p.x = -20; p.y = -20; }
  if (d.brk) { G.phase = 'halfend'; G.phaseT = 99; endOfHalf(); }
  else if (d.kick != null) { setupKickoff(d.kick, false); banner('WEITER GEHT\'S', '#ffc83a', `${G.T[0].k} ${G.score[0]}:${G.score[1]} ${G.T[1].k} · ${minuteTxt()}`, 1.8, true); }
  else {
    const team = d.poss >= 0 ? d.poss : 0, gx = goalX(team), s = atkDir(team);
    let x = clamp(d.bx, 2, CW - 2); if (Math.abs(x - gx) < 22) x = gx - s * 22; if (Math.abs(x - ownX(team)) < 18) x = ownX(team) + s * 18;
    setupSetPiece('free', team, x, clamp(d.by, 4, CH - 4));
    banner('WEITER GEHT\'S', '#ffc83a', `${G.T[0].k} ${G.score[0]}:${G.score[1]} ${G.T[1].k} · ${minuteTxt()}`, 1.8, true);
  }
  delMatch();
  track('spiel-fortgesetzt', { modus: career ? 'saison' : 'freundschaftsspiel' });
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveMatch(); });
addEventListener('pagehide', () => saveMatch());
Object.assign(ACT, {
  resumeMatch() { loadMatch(); },
  saveQuit() { const car = G && G.career; saveMatch(); INGAME_MENU = false; hideTutBox(); G = null; startDemo(); if (car) ACT.chub(); else ACT.main(); },
});

// ================= Saison-Spielstand: robust gegen geänderte Vereinsdaten, als Datei sichern und laden =================
// Vereine und Ligen sind im Spiel einfach durchnummeriert. Kommt ein Verein dazu oder fällt einer weg (neue Saisondaten, Wunsch eines
// Vereins), verschieben sich die Nummern. Darum merkt sich der Spielstand zu jeder Nummer Name und Kreis und ordnet beim Laden neu zu.
// Passt die laufende Saison danach nicht mehr (Verein weg oder neu in der Liga), beginnt sie neu – Kader, Kasse und Titel bleiben.
// Lässt sich gar nichts zuordnen, wird der alte Stand beiseitegelegt (nicht gelöscht) und kann als Datei gesichert werden.
const CAREER_OLD_KEY = 'krl_saison_alt';
const tkey = id => TEAMS[id] ? `${TEAMS[id].n}|${KREISE[LIGEN[TEAMS[id].lg].kreis].n}` : '';
const lkey = li => LIGEN[li] ? `${LIGEN[li].n}|${KREISE[LIGEN[li].kreis].n}` : '';
function stampKeys(c) {
  const t = {}, add = id => { if (id != null && TEAMS[id]) t[id] = tkey(id); };
  add(c.team); add(c.rival); for (const k in c.squads) add(+k);
  for (const li of c.kl) for (const id of Object.keys(c.S.tables[li] || {})) add(+id);
  for (const h of c.hist || []) add(h.champ);
  c.keys = { t, l: Object.fromEntries(c.kl.map(li => [li, lkey(li)])) };
}
function migrateCareer(c) {
  if (!c || !c.keys || !c.S) return c;
  const okT = Object.entries(c.keys.t).every(([id, k]) => tkey(+id) === k), okL = Object.entries(c.keys.l).every(([li, k]) => lkey(+li) === k);
  if (okT && okL) return c;
  const byT = new Map(), byN = new Map(), byL = new Map();
  for (const t of TEAMS) { byT.set(tkey(t.id), t.id); byN.set(t.n, byN.has(t.n) ? -1 : t.id); }
  LIGEN.forEach((L, li) => byL.set(lkey(li), li));
  const mt = {}, ml = {};
  for (const [id, k] of Object.entries(c.keys.t)) { let n = byT.get(k); if (n == null) { const b = byN.get(k.split('|')[0]); if (b != null && b >= 0) n = b; } mt[id] = n ?? null; }
  for (const [li, k] of Object.entries(c.keys.l)) ml[li] = byL.get(k) ?? null;
  if (mt[c.team] == null || ml[c.lg] == null) throw new Error('Verein oder Liga nicht mehr in den Daten');
  const T = id => id == null ? id : (id in mt ? mt[id] : null), Lg = li => li in ml ? ml[li] : null;
  const remapKeys = (o, f) => { const r = {}; for (const [k, v] of Object.entries(o || {})) { const n = f(+k); if (n != null) r[n] = v; } return r; };
  c.team = T(c.team); c.rival = T(c.rival); c.lg = Lg(c.lg); c.kl = c.kl.map(Lg).filter(x => x != null);
  c.squads = remapKeys(c.squads, T); for (const [k, sq] of Object.entries(c.squads)) for (const p of sq) p.tid = +k;
  c.forms = remapKeys(c.forms, T); c.lvl = remapKeys(c.lvl, T);
  c.market = (c.market || []).map(m => ({ ...m, from: T(m.from) })).filter(m => m.from != null);
  for (const h of c.hist || []) { h.team = T(h.team) ?? h.team; h.champ = T(h.champ); }
  if (c.custom) c.custom.lg = c.lg;
  c.tname = TEAMS[c.team].n;
  // laufende Saison: passt sie noch? (alle Vereine zugeordnet und die Ligen haben dieselben Vereine)
  const S = c.S, games = gs => (gs || []).map(g => ({ ...g, h: T(g.h), a: T(g.a), li: Lg(g.li), goals: (g.goals || []).map(x => ({ ...x, tid: T(x.tid) })) }));
  const tables = {}; let fit = true;
  for (const [li, tb] of Object.entries(S.tables || {})) { const n = Lg(+li); if (n == null) { fit = false; continue; } tables[n] = remapKeys(tb, T); if (Object.keys(tables[n]).length !== Object.keys(tb).length || Object.keys(tables[n]).length !== LIGEN[n].ids.length) fit = false; }
  if (fit) {
    S.tables = tables;
    S.cal = S.cal.map(ev => ev.games ? { ...ev, games: Object.fromEntries(Object.entries(ev.games).map(([li, G2]) => [Lg(+li), G2.map(([h, a]) => [T(h), T(a)])])) } : ev);
    S.results = S.results.map(r => ({ ...r, games: games(r.games) })); S.last = games(S.last);
    for (const k of ['cup', 'po']) if (S[k]) { S[k].teams = S[k].teams.map(T); S[k].champ = T(S[k].champ); S[k].rounds = S[k].rounds.map(R => R.map(x => ({ ...x, a: T(x.a), b: T(x.b), w: T(x.w) }))); }
    fit = !JSON.stringify([S.cal, S.cup, S.po]).includes('null,null') && (!S.cup || S.cup.teams.every(x => x != null)) && (!S.po || S.po.teams.every(x => x != null));
  }
  if (!fit) { CAREER = c; for (const tid of klTeams()) { ensureSquad(tid); c.forms[tid] = c.forms[tid] || defaultForm(tid); } newSeason(); refreshMarket(); news('Spielplan', 'Neue Spielpläne vom Verband', 'Die Liga hat sich geändert – die Saison beginnt neu. Kader, Kasse und Titel bleiben.', 'start'); }
  stampKeys(c);
  return c;
}
let CAREER_NOTE = '';
function loadCareerSave() {
  const sv = store.get(CAREER_KEY); if (!sv) return null;
  try {
    if (sv.custom) addCustomTeam(sv.custom); else removeCustomTeam();
    const c = migrateCareer(sv);
    prepCareer(c);
    if (validCareer(c)) { if (c !== sv || !c.keys) { stampKeys(c); store.set(CAREER_KEY, c); } return c; }
    throw new Error('ungültig');
  } catch (e) {
    store.set(CAREER_OLD_KEY, sv); store.del(CAREER_KEY);
    CAREER_NOTE = 'Dein alter Spielstand passte nicht mehr zu den Vereinsdaten und wurde beiseitegelegt. Du kannst ihn unten als Datei sichern.';
    return null;
  }
}
// ---------- als Datei sichern und laden ----------
function downloadText(name, text, type = 'application/json') {
  if (PLATFORM.saveFile) return PLATFORM.saveFile(name, text, type);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportCareer(c = CAREER) {
  if (!c) return; stampKeys(c);
  const day = new Date().toISOString().slice(0, 10), nm = norm(TEAMS[c.team] ? TEAMS[c.team].short : 'saison').replace(/[^a-z0-9]+/g, '-');
  downloadText(`kreisliga-legenden-${nm}-${day}.json`, JSON.stringify({ app: 'kreisliga-legenden', art: 'saison', v: 1, gespeichert: new Date().toISOString(), career: c }));
  track('spielstand-export');
}
let IMPORT = null;
function pickImport() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importCareerText(String(r.result)); r.readAsText(f); });
  inp.click();
}
function importCareerText(txt) {
  let c; try { const o = JSON.parse(txt); c = o && o.career ? o.career : o; } catch (e) { return toast('Die Datei ist kein Spielstand von Kreisliga-Legenden.'); }
  if (!c || c.v !== 2 || !c.S || !c.squads) return toast('Die Datei ist kein Spielstand von Kreisliga-Legenden.');
  IMPORT = c;
  if (store.get(CAREER_KEY)) return show(`<div class="panel narrow"><h2>SPIELSTAND ERSETZEN?</h2><p>Der aktuelle Spielstand wird durch den aus der Datei ersetzt (${esc(c.tname || '')}, Saison ${seasonLabel(c.year)}). Tipp: Vorher den aktuellen als Datei sichern.</p><div class="row"><button data-act="impNo" autofocus>NEIN</button><button class="main" data-act="impYes">JA, LADEN</button></div></div>`, { back: ACT.impNo });
  ACT.impYes();
}
Object.assign(ACT, {
  cExport() { exportCareer(); },
  cExportOld() { const o = store.get(CAREER_OLD_KEY); if (o) downloadText('kreisliga-legenden-alter-spielstand.json', JSON.stringify({ app: 'kreisliga-legenden', art: 'saison', v: 1, career: o })); },
  cImport() { pickImport(); },
  impNo() { IMPORT = null; if (CAREER) ACT.chub(); else ACT.career(); },
  impYes() {
    const prev = store.get(CAREER_KEY); store.set(CAREER_KEY, IMPORT); IMPORT = null; CAREER = null;
    const c = loadCareerSave();
    if (!c) { if (prev) store.set(CAREER_KEY, prev); return ACT.career(); }
    CAREER = c; CTAB = 'blatt'; track('spielstand-import'); ACT.chub();
  },
});
