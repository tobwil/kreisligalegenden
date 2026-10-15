// ================= Flair: Zeitlupe, Jubel, besondere Aktionen, Aufgaben pro Spiel, Erfolge, Legenden-Punkte =================
// Alles, was ein Spiel „noch eins“ machen soll: Tore fühlen sich groß an, schöne Aktionen werden gefeiert, jedes Spiel hat
// drei kleine Aufgaben, und Erfolge bleiben dauerhaft im Profil (localStorage, nur auf diesem Gerät).
const PROFILE_KEY = 'krl_profil';
const PROF = Object.assign({ lp: 0, games: 0, wins: 0, goals: 0, chal: 0, ach: {} }, store.get(PROFILE_KEY, {}));
const saveProf = () => store.set(PROFILE_KEY, PROF);
const lpLevel = lp => Math.floor(Math.sqrt(lp / 120)) + 1;
const lpNext = lv => (lv * lv) * 120;

// ---------- Erfolge ----------
const ACHS = [
  ['sieg1', 'ERSTER SIEG', 'Gewinne ein Spiel'], ['tor1', 'ERSTES TOR', 'Schieß selbst ein Tor'], ['hattrick', 'HATTRICK-HELD', 'Ein Spieler trifft dreimal in einem Spiel'],
  ['traum', 'TRAUMTOR', 'Tor aus mehr als 22 Metern'], ['freistoss', 'FREISTOSSKÖNIG', 'Direkter Freistoß ins Tor'], ['elfer', 'EISKALT', 'Verwandle einen Elfmeter'],
  ['kopf', 'KOPFBALLUNGEHEUER', 'Erziele ein Kopfballtor'], ['direkt', 'DIREKTABNAHME', 'Tor direkt nach einem Zuspiel'], ['doppelpass', 'DOPPELPASS-TOR', 'Tor kurz nach einem Doppelpass'],
  ['schlenzer', 'SCHLENZ-KÜNSTLER', 'Tor per Schlenzer (beim Aufladen Pass drücken)'], ['heber', 'LUPFER', 'Tor per Heber (beim Aufladen Flanke drücken)'],
  ['null', 'DIE NULL STEHT', 'Gewinne ohne Gegentor'], ['kanter', 'KANTERSIEG', 'Gewinne mit 5 Toren Unterschied'], ['comeback', 'COMEBACK', 'Gewinne nach Rückstand'],
  ['haken3', 'KNOTENLÖSER', 'Lass in einem Spiel 3 Gegner stehen'], ['alle3', 'ALLES ERLEDIGT', 'Erfülle alle drei Aufgaben eines Spiels'], ['aufg25', 'FLEISSBIENCHEN', 'Erfülle 25 Aufgaben'],
  ['siege10', 'SERIENTÄTER', 'Gewinne 10 Spiele'], ['tore50', 'TORFABRIK', 'Schieß 50 Tore'], ['shootout', 'NERVENSTARK', 'Gewinne ein Elfmeterschießen'],
  ['derby', 'DERBYSIEGER', 'Gewinne ein Derby gegen den Erzrivalen'], ['meister', 'KREISMEISTER', 'Werde Meister deiner Kreisliga'], ['pokal', 'POKALSIEGER', 'Gewinne den Kreispokal'],
  ['dkm', 'DEUTSCHER MEISTER', 'Gewinne die Goldene Eckfahne'], ['training', 'MUSTERSCHÜLER', 'Schließe das Training ab'], ['teilen', 'LOKALPRESSE', 'Teile ein Ergebnis'],
];
function unlock(id) {
  if (PROF.ach[id]) return false;
  const a = ACHS.find(x => x[0] === id); if (!a) return false;
  PROF.ach[id] = Date.now(); PROF.lp += 150; saveProf();
  if (G && !G.demo) { G.achNew = (G.achNew || []).concat(id); G.ticker = { txt: `ERFOLG FREIGESCHALTET: ${a[1]}`, t: 3.2 }; }
  track('erfolg', { id });
  return true;
}

// ---------- Aufgaben pro Spiel ----------
// done(c): während des Spiels prüfen; end(c): erst beim Abpfiff
const CHALS = [
  { id: 'win2', t: 'Gewinne mit 2 Toren Unterschied', end: c => c.my - c.op >= 2 },
  { id: 'null', t: 'Spiel zu null', end: c => c.op === 0 },
  { id: 'kopf', t: 'Erziele ein Kopfballtor', done: c => c.feat('goal-kopf') },
  { id: 'weit', t: 'Tor von außerhalb des Strafraums', done: c => c.feat('goal-weit') },
  { id: 'drei', t: 'Schieß 3 Tore', done: c => c.my >= 3 },
  { id: 'dp', t: 'Spiel einen Doppelpass', done: c => c.feat('doppelpass') },
  { id: 'erst', t: 'Schieß das erste Tor des Spiels', done: c => c.first === c.me, fail: c => c.first === 1 - c.me },
  { id: 'haken', t: 'Lass 2 Gegner mit dem Haken stehen', done: c => c.count('haken') >= 2 },
  { id: 'aus', t: 'Spiel 3 Gegner im Dribbling aus', done: c => c.count('aus') >= 3 },
  { id: 'fair', t: 'Keine Karte für dein Team', end: c => G.stats.yellow[c.me] + G.stats.red[c.me] === 0 },
  { id: 'schuss', t: 'Mindestens 8 Torschüsse', done: c => G.stats.shots[c.me] >= 8 },
  { id: 'direkt', t: 'Tor per Direktabnahme', done: c => c.feat('goal-direkt') },
];
function chalCtx() {
  const me = G.human, my = G.score[me], op = G.score[1 - me], f = G.feats || [];
  return { me, my, op, first: G.firstGoal ?? -1, feat: k => f.some(x => x.k === k && x.team === me), count: k => f.filter(x => x.k === k && x.team === me).length };
}
function startFlair(o = {}) {
  G.feats = []; G.firstGoal = null; G.wasBehind = false; G.achNew = []; G.slowF = 1; G.celebSet = false; G.flairDone = false;
  if (G.human < 0 || o.watch || o.tut || G.tut || G.demo) { G.chal = null; return; }
  // drei verschiedene Aufgaben, je Spiel neu
  G.chal = shuffle(CHALS.slice()).slice(0, 3).map(c => ({ id: c.id, t: c.t, ok: false, failed: false }));
}
function chalCheck(final) {
  if (!G.chal) return;
  const c = chalCtx();
  for (const x of G.chal) {
    if (x.ok || x.failed) continue;
    const d = CHALS.find(q => q.id === x.id);
    if (d.fail && d.fail(c)) { x.failed = true; continue; }
    if ((d.done && d.done(c)) || (final && d.end && d.end(c))) { x.ok = true; if (!final) { G.ticker = { txt: `AUFGABE ERFÜLLT: ${x.t.toUpperCase()}`, t: 2.6 }; AU.select(); } }
  }
}
// ---------- besondere Aktionen ----------
function feat(k, p, label, sub) {
  if (!G.feats) G.feats = [];
  G.feats.push({ k, team: p.team, t: G.t, pid: p.d.pid });
  if (label && !G.demo && (p.team === G.human || G.watch || G.human < 0)) banner(label, '#7cf2ff', sub || p.d.name.toUpperCase(), 1.1);
  if (k !== 'aus' || Math.random() < 0.5) AU.crowd(0.6);
  G.excite = Math.max(G.excite, 0.9);
  chalCheck(false);
}
// Annahme: Doppelpass erkennen (A spielt zu B, B spielt zurück zu A)
function flairRecv(p, passer) {
  if (!passer || passer.team !== p.team || passer === p) return;
  // nur ein echter Doppelpass: der erste Passgeber ist gestartet und hat mindestens 3 m Richtung Tor gutgemacht
  const lf = passer.lastFrom, gain = lf ? (p.x - lf.px) * atkDir(p.team) : 0;
  if (lf && lf.q === p && G.t - lf.t < 4 && gain > 3 && G.phase === 'play') { feat('doppelpass', p, 'DOPPELPASS!'); G.lastDP = { team: p.team, t: G.t }; }
  p.lastFrom = { q: passer, t: G.t, px: passer.x };
}
// Dribbling: Gegner vor dem Ballführer, der danach hinter ihm steht = ausgespielt
function flairStep(dt) {
  if (G.phase === 'goal') return celebChoice();
  if (G.phase !== 'play') return;
  // Zeitlupe: Schuss, den der Torwart nicht mehr kriegt, kurz vor der Linie
  const b = G.ball;
  if (!G.demo && b.shot && !b.owner && b.plan && b.plan.onT && !b.plan.ok && Math.min(b.x, CW - b.x) < 8) G.slowF = Math.max(0.3, (G.slowF || 1) - dt * 6);
  else G.slowF = Math.min(1, (G.slowF || 1) + dt * 4);
  const o = b.owner; if (!o || isGK(o)) { G.dribble = null; return; }
  const s = atkDir(o.team);
  if (!G.dribble || G.dribble.p !== o) G.dribble = { p: o, seen: new Map() };
  for (const q of opps(o)) {
    if (isGK(q)) continue;
    const ahead = (q.x - o.x) * s, lat = Math.abs(q.y - o.y);
    if (ahead > 0.3 && ahead < 2.2 && lat < 1.4) G.dribble.seen.set(q, G.t);
    else if (G.dribble.seen.has(q) && ahead < -1.3 && G.t - G.dribble.seen.get(q) < 1.6) { G.dribble.seen.delete(q); if (G.t - (G.ausT || 0) > 2.5) { G.ausT = G.t; feat('aus', o, 'AUSGESPIELT!', `${o.d.name.toUpperCase()} GEHT VORBEI`); } else feat('aus', o); }
  }
}
// Tor: besondere Tore erkennen und groß ankündigen (gibt den Bannertext zurück)
function flairGoal(team, scorer, sh, og) {
  G.slowF = 1; if (!G.feats) G.feats = [];
  if (G.firstGoal == null) G.firstGoal = team;
  if (G.human >= 0 && G.score[1 - G.human] > G.score[G.human]) G.wasBehind = true;
  if (og || !scorer || !sh) { chalCheck(false); return null; }
  const fk = G.ball.fromSP === 'free', direct = scorer.assistFrom && sh.t0 - (scorer.gotT || -9) < 0.4 && !sh.pen && !fk;
  let label = null;
  const add = (k, l) => { G.feats.push({ k, team, t: G.t, pid: scorer.d.pid }); if (l && !label) label = l; };
  if (scorer.d.ms.g === 3) add('hattrick', 'HATTRICK!');
  if (sh.pen) add('goal-elfer');
  if (fk) add('goal-freistoss', 'FREISTOSSTOR!');
  if (sh.header) add('goal-kopf', 'KOPFBALLTOR!');
  if (sh.chip) add('goal-heber', 'HEBER!');
  if (sh.finesse) add('goal-schlenzer', sh.d > 16 ? 'SCHLENZER!' : null);
  if (sh.d > 22 && !fk) add('goal-traum', 'TRAUMTOR!');
  if (sh.d > BOX_D + 1) add('goal-weit');
  if (direct) add('goal-direkt', sh.header ? null : 'DIREKT!');
  if (G.lastDP && G.lastDP.team === team && G.t - G.lastDP.t < 6) add('goal-dp', 'DOPPELPASS-TOR!');
  // Erfolge nur für eigene Tore im eigenen Spiel
  if (team === G.human && !G.watch && !G.demo && !G.tut) {
    unlock('tor1');
    if (scorer.d.ms.g === 3) unlock('hattrick'); if (sh.d > 22) unlock('traum'); if (fk) unlock('freistoss'); if (sh.pen && !G.so) unlock('elfer');
    if (sh.header) unlock('kopf'); if (direct) unlock('direkt'); if (G.lastDP && G.lastDP.team === team && G.t - G.lastDP.t < 6) unlock('doppelpass');
    if (sh.finesse) unlock('schlenzer'); if (sh.chip) unlock('heber');
  }
  chalCheck(false);
  return label;
}
// Jubel selbst wählen: Pass = Knie-Rutscher, Schuss = Flieger, Flanke = Becker-Faust
function celebChoice() {
  const sc = G.scorer; if (!sc || !sc.celeb || G.watch || G.demo || sc.team !== G.human || G.celebSet) return;
  const pose = IN.pa ? 'knee' : IN.pb ? 'plane' : IN.pc ? 'faust' : null;
  if (pose) { sc.celeb.pose = pose; G.celebSet = true; AU.cheer(0.6); }
}
// ---------- Abpfiff: Aufgaben, Erfolge, Punkte ----------
function flairEnd() {
  if (!G.chal || G.flairDone) return null; G.flairDone = true;
  chalCheck(true);
  const me = G.human, my = G.score[me], op = G.score[1 - me], w = winnerOf(), won = w === me;
  const done = G.chal.filter(x => x.ok).length;
  let lp = 20 + (won ? 40 : w < 0 ? 15 : 0) + my * 8 + done * 30;
  PROF.games++; PROF.goals += my; PROF.chal += done; if (won) PROF.wins++;
  if (won) unlock('sieg1');
  if (won && op === 0) unlock('null'); if (won && my - op >= 5) unlock('kanter'); if (won && G.wasBehind) unlock('comeback');
  if ((G.feats || []).filter(f => f.team === me && f.k === 'aus').length + (G.feats || []).filter(f => f.team === me && f.k === 'haken').length >= 3) unlock('haken3');
  if (done === 3) unlock('alle3'); if (PROF.chal >= 25) unlock('aufg25'); if (PROF.wins >= 10) unlock('siege10'); if (PROF.goals >= 50) unlock('tore50');
  if (G.so && won) unlock('shootout');
  const lv0 = lpLevel(PROF.lp); PROF.lp += lp; saveProf();
  let money = 0;
  if (G.career && CAREER) { money = done * 250; if (money) { CAREER.money += money; news('Aufgaben', `${done} ${done === 1 ? 'Aufgabe' : 'Aufgaben'} erfüllt`, `Der Vorstand legt ${fmtMoney(money)} in die Vereinskasse.`, 'money'); saveCareer(); } }
  track('aufgaben', { erfuellt: done });
  return { done, lp, money, levelUp: lpLevel(PROF.lp) > lv0 };
}
function flairHTML(r) {
  if (!G.chal || !r) return '';
  const ach = (G.achNew || []).map(id => ACHS.find(a => a[0] === id)).filter(Boolean);
  return `<div class="chal"><h3>AUFGABEN</h3>${G.chal.map(x => `<div class="${x.ok ? 'ok' : 'no'}"><b>${x.ok ? '✔' : '✘'}</b>${esc(x.t)}</div>`).join('')}
    <p class="muted">+${r.lp} Legenden-Punkte${r.money ? ` · ${fmtMoney(r.money)} für die Vereinskasse` : ''}${r.levelUp ? ` · <b class="gold">STUFE ${lpLevel(PROF.lp)}!</b>` : ''}</p>
    ${ach.length ? `<p class="gold">NEUER ERFOLG: ${ach.map(a => esc(a[1])).join(' · ')}</p>` : ''}</div>`;
}
// ---------- Erfolge-Menü ----------
Object.assign(ACT, {
  erfolge() {
    const lv = lpLevel(PROF.lp), n = Object.keys(PROF.ach).length;
    show(`<div class="panel"><div class="row spread"><h2>ERFOLGE</h2><button class="small" data-act="main">ZURÜCK</button></div>
      <p>Stufe <b class="gold">${lv}</b> · ${PROF.lp.toLocaleString('de-DE')} Legenden-Punkte (nächste Stufe ab ${lpNext(lv).toLocaleString('de-DE')}) · ${n} von ${ACHS.length} Erfolgen · ${PROF.games} Spiele, ${PROF.wins} Siege, ${PROF.goals} Tore, ${PROF.chal} Aufgaben</p>
      <div class="achs">${ACHS.map(([id, name, d]) => `<div class="ach ${PROF.ach[id] ? 'on' : ''}"><b>${PROF.ach[id] ? '★' : '☆'}</b><span>${esc(name)}</span><i>${esc(d)}</i></div>`).join('')}</div>
      <p class="muted">Erfolge und Punkte bleiben nur in diesem Browser gespeichert.</p></div>`, { back: ACT.main });
  },
});
