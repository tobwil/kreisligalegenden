// ================= Saison: Kreisliga, Kreispokal, Meisterschaft, Playoffs um die deutsche Kreisliga-Krone =================
// Ablauf als Kalender aus Ereignissen (Spieltage, Pokalrunden, dann Playoff-Runden). Jedes Ereignis wird komplett abgearbeitet: das
// eigene Spiel wird gespielt, angeschaut oder simuliert, alle anderen Partien simuliert. Die Kreisligen des eigenen Kreises laufen
// parallel, ihre Meister spielen mit Kreismeistern aus ganz Deutschland im K.-o.-System um die deutsche Kreisliga-Meisterschaft.
const CAREER_KEY = 'krl_saison';
let CAREER = null;
const saveCareer = () => store.set(CAREER_KEY, CAREER);
const START_YEAR = 2026;
const seasonLabel = y => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
const CT = () => CAREER.team;
const validCareer = c => !!(c && c.v === 2 && c.S && c.squads && TEAMS[c.team] && TEAMS[c.team].n === c.tname);
const fmtMoney = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('de-DE') + ' €';
const PO_NAMES = ['ACHTELFINALE', 'VIERTELFINALE', 'HALBFINALE', 'FINALE'];
const TROPHY = 'GOLDENE ECKFAHNE';
const CUP_NAMES = ['FINALE', 'HALBFINALE', 'VIERTELFINALE', 'ACHTELFINALE', '2. RUNDE', '1. RUNDE'];
const cupName = r => CUP_NAMES[CAREER.S.cup.rounds.length - 1 - r] || `${r + 1}. RUNDE`;
const MAX_KL = 3;   // höchstens drei Ligen des eigenen Kreises laufen mit (Kaderdaten im Spielstand bleiben klein)

// ---------- Spieler ----------
const newSS = () => ({ sp: 0, g: 0, a: 0, ns: 0, nn: 0, sv: 0, co: 0, yc: 0, rc: 0, potm: 0 });
function careerize(p, tid) {
  const q = Object.assign({}, p);
  q.pid = CAREER.npid++; q.tid = tid;
  q.pot = Math.min(95, q.ovr + (q.age < 21 ? 6 + ((Math.random() * 10) | 0) : q.age < 24 ? (Math.random() * 7) | 0 : q.age < 27 ? (Math.random() * 3) | 0 : 0));
  q.form = 0; q.fit = 100; q.inj = 0; q.ban = 0; q.ycs = 0; q.ss = newSS(); q.cs = newSS(); q.seasons = 0;
  return q;
}
function ensureSquad(tid) {
  if (!CAREER.squads[tid]) CAREER.squads[tid] = roster(tid).map(p => careerize(p, tid));
  return CAREER.squads[tid];
}
const playerById = pid => { for (const k in CAREER.squads) { const p = CAREER.squads[k].find(q => q.pid === pid); if (p) return p; } return null; };
function genPlayer(grp, lvl, age, tid) {
  const used = new Set((CAREER.squads[tid] || []).map(q => q.name)), nums = new Set((CAREER.squads[tid] || []).map(q => q.num));
  const p = makePlayer18(Math.random, grp, lvl, used, nums, tid); p.age = age;
  for (const a of ['tmp', 'aus']) if (age < 20) p[a] = Math.min(95, p[a] + 3);
  p.ovr = ovr(p);
  return careerize(p, tid);
}
// Mannschaft fürs Spiel: Formation, Elf, Bank (eigener Verein: eigene Aufstellung, sonst automatisch)
function matchSquad(tid) {
  const sq = ensureSquad(tid), mine = tid === CT();
  const form = mine ? CAREER.form : CAREER.forms[tid] || defaultForm(tid);
  let L = autoXI(sq, form);
  if (mine && CAREER.xi) {
    const xi = CAREER.xi.map(pid => sq.find(p => p.pid === pid && !(p.inj > 0) && !(p.ban > 0)));
    if (xi.length === 11 && xi.every(Boolean) && new Set(xi).size === 11) { const rest = sq.filter(p => !xi.includes(p) && !(p.inj > 0) && !(p.ban > 0)); const gk = rest.filter(p => p.grp === 'TW').sort((a, b) => b.ovr - a.ovr)[0]; const others = rest.filter(p => p !== gk).sort((a, b) => effO(b) - effO(a)); L = { xi, bench: (gk ? [gk] : []).concat(others).slice(0, 7) }; }
  }
  return { form, xi: L.xi, bench: L.bench };
}
const squadStr = tid => { const L = autoXI(ensureSquad(tid), tid === CT() ? CAREER.form : defaultForm(tid)).xi; return L.reduce((s, p) => s + effO(p), 0) / Math.max(1, L.length); };

// ---------- Spielplan, Tabelle ----------
function roundRobin(ids) {
  if (ids.length % 2) ids = ids.concat([-1]);   // spielfrei
  const n = ids.length, a = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) { const h = a[i], g = a[n - 1 - i]; games.push(r % 2 === 0 ? (i === 0 ? [h, g] : [g, h]) : (i === 0 ? [g, h] : [h, g])); }
    rounds.push(games); a.splice(1, 0, a.pop());
  }
  return rounds;
}
const newRow = () => ({ sp: 0, s: 0, u: 0, n: 0, tf: 0, tg: 0, pkt: 0, form: [] });
function record(table, a, b, ga, gb) {
  const A = table[a], B = table[b]; if (!A || !B) return;
  A.sp++; B.sp++; A.tf += ga; A.tg += gb; B.tf += gb; B.tg += ga;
  if (ga > gb) { A.s++; B.n++; A.pkt += 3; A.form.push('s'); B.form.push('n'); }
  else if (gb > ga) { B.s++; A.n++; B.pkt += 3; B.form.push('s'); A.form.push('n'); }
  else { A.u++; B.u++; A.pkt++; B.pkt++; A.form.push('u'); B.form.push('u'); }
  A.form = A.form.slice(-5); B.form = B.form.slice(-5);
}
function standings(li) {
  const T = CAREER.S.tables[li];
  return Object.keys(T).map(Number).sort((a, b) => T[b].pkt - T[a].pkt || (T[b].tf - T[b].tg) - (T[a].tf - T[a].tg) || T[b].tf - T[a].tf || a - b);
}
const posOf = (tid, li = CAREER.lg) => standings(li).indexOf(tid) + 1;

// ---------- Neue Karriere, neue Saison ----------
const klTeams = () => CAREER.kl.flatMap(li => LIGEN[li].ids);
const lgName = (li = CAREER.lg) => `${LIGEN[li].n} ${KREISE[LIGEN[li].kreis].n}`;
function newCareer(team, len, diff, hlen) {
  const lg = TEAMS[team].lg, K = KREISE[LIGEN[lg].kreis], r = seeded(hashStr(TEAMS[team].n + 'kl'));
  const kl = [lg].concat(K.ligen.filter(l => l !== lg).sort(() => r() - 0.5).slice(0, MAX_KL - 1));
  CAREER = { v: 2, team, tname: TEAMS[team].n, lg, kl, year: START_YEAR, len, diff, hlen, squads: {}, npid: 1, form: defaultForm(team), ment: 1, xi: null, pk: null,
    forms: {}, titles: [], news: [], money: 3000, hist: [], train: 'bal', market: [], records: {}, seasonsPlayed: 0 };
  for (const tid of klTeams()) { ensureSquad(tid); CAREER.forms[tid] = defaultForm(tid); }
  newSeason(); refreshMarket(); rivalOf();
  news('Saisonstart', `${TEAMS[team].n}: Auf geht's!`, `Neuer Trainer an der Seitenlinie. Der Vorstand hofft auf eine gute Saison in der ${lgName()} – und auf volle Bratwurstbuden.`, 'start');
  saveCareer();
  track('saison-start', { verein: TEAMS[team].n, verband: verbOf(team).n });
}
function newSeason() {
  const C = CAREER, S = C.S = { year: C.year, tables: {}, cal: [], ci: 0, results: [], po: null, cup: null, done: false, scorers: {}, last: null };
  // Spielpläne aller mitlaufenden Ligen; Ligen mit mehr Spieltagen spielen an manchen Terminen doppelt
  const rr = {};
  for (const li of C.kl) {
    S.tables[li] = {}; for (const tid of LIGEN[li].ids) S.tables[li][tid] = newRow();
    const R = roundRobin(shuffle(LIGEN[li].ids)), full = C.len === 2 ? R.concat(R.map(g => g.map(([h, a]) => [a, h]))) : R;
    rr[li] = full.map(g => g.filter(([h, a]) => h >= 0 && a >= 0));
  }
  const M = rr[C.lg].length;
  for (let md = 0; md < M; md++) {
    const games = {};
    for (const li of C.kl) { const R = rr[li], f = Math.floor(md * R.length / M), t = Math.floor((md + 1) * R.length / M); games[li] = R.slice(f, t).flat(); }
    S.cal.push({ t: 'lg', md: md + 1, games });
  }
  drawCup();
  // Ziel des Vorstands nach Kaderstärke im Liga-Vergleich
  const ids = LIGEN[C.lg].ids, n = ids.length, rank = ids.slice().sort((a, b) => squadStr(b) - squadStr(a)).indexOf(C.team);
  const top = Math.ceil(n / 3), mid = Math.ceil(n * 2 / 3);
  S.goal = rank < 2 ? { k: 'champ', txt: 'Meisterschaft' } : rank < top + 1 ? { k: 'top', v: top, txt: `Platz 1 bis ${top}` } : rank < mid + 1 ? { k: 'mid', v: mid, txt: `Platz 1 bis ${mid}` } : { k: 'stay', v: n - 2, txt: `Klassenerhalt (Platz ${n - 2} oder besser)` };
  for (const sq of Object.values(C.squads)) for (const p of sq) { p.ss = newSS(); p.ycs = 0; }
}
// Kreispokal: alle Vereine der mitlaufenden Ligen (höchstens 32), Freilose in Runde 1, Runden zwischen den Spieltagen
function drawCup() {
  const C = CAREER, S = C.S;
  let teams = shuffle(klTeams()); if (teams.length > 32) teams = [C.team].concat(teams.filter(t => t !== C.team).slice(0, 31));
  teams = shuffle(teams);
  let P = 2; while (P < teams.length) P *= 2;
  const byes = P - teams.length, first = [];
  // Freilose zuerst verteilen, dann echte Paarungen
  let i = 0;
  for (let b = 0; b < byes; b++) first.push({ a: teams[i++], b: null, w: null });
  while (i < teams.length) first.push({ a: teams[i++], b: teams[i++], w: null });
  for (const t of first) if (t.b == null) t.w = t.a;
  const R = Math.log2(P), M = S.cal.filter(e => e.t === 'lg').length;
  S.cup = { teams, rounds: [shuffle(first)], champ: null };
  for (let r = 1; r < R; r++) S.cup.rounds.push([]);
  // Runde r nach Spieltag round((r+1)·M/(R+1)), das Finale spätestens vor dem letzten Spieltag
  for (let r = R - 1; r >= 0; r--) { const after = Math.min(M - 1, Math.max(1, Math.round((r + 1) * M / (R + 1)))); S.cal.splice(S.cal.findIndex(e => e.t === 'lg' && e.md === after) + 1, 0, { t: 'cup', r }); }
}
const curEvent = () => CAREER.S.cal[CAREER.S.ci];
function myGame(ev = curEvent()) {
  if (!ev) return null;
  if (ev.t === 'lg') { const g = ev.games[CAREER.lg].find(([h, a]) => h === CT() || a === CT()); return g ? { h: g[0], a: g[1], neutral: false } : null; }
  if (ev.t === 'cup') { const R = CAREER.S.cup.rounds, ti = R[ev.r].find(t => t.a === CT() || t.b === CT()); return ti && ti.w == null && ti.b != null ? { h: ti.a, a: ti.b, neutral: ev.r === R.length - 1, tie: ti } : null; }
  if (ev.t === 'po') { const ti = CAREER.S.po.rounds[ev.r].find(t => t.a === CT() || t.b === CT()); return ti && ti.w == null ? { h: ti.a, a: ti.b, neutral: ev.r === 3, tie: ti } : null; }
  return null;
}
function eventLabel(ev = curEvent()) {
  if (!ev) return '';
  if (ev.t === 'lg') return `${LIGEN[CAREER.lg].n.toUpperCase()} · ${ev.md}. SPIELTAG`;
  if (ev.t === 'cup') return `KREISPOKAL · ${cupName(ev.r)}`;
  return `DEUTSCHE KREISLIGA-MEISTERSCHAFT · ${PO_NAMES[ev.r]}`;
}
const CUP_FINAL = () => ({ title: 'KREISPOKAL-FINALE', venue: `SPORTPARK ${KREISE[LIGEN[CAREER.lg].kreis].n.toUpperCase().replace(/[/].*/, '')}`, neutral: true, ground: 0, ads: ['KREISPOKAL', 'KREISLIGA-LEGENDEN', 'SPARKASSE', 'GETRÄNKE MÜLLER', 'BRATWURST-BUDE'] });
const FINAL_EVENT = { title: 'ENDSPIEL', venue: 'STADION AM SCHLOSSPARK', neutral: true, night: true, ground: 0, ads: ['GOLDENE ECKFAHNE', 'KREISLIGA-LEGENDEN', 'ENDSPIEL', 'METZGEREI HÜMMER', 'BRATWURST-BUDE'] };

// ---------- Ergebnis-Simulation ----------
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function simScore(h, a, neutral) {
  const d = squadStr(h) - squadStr(a) + (neutral ? 0 : 2.5);
  const lh = 1.45 * Math.exp(d * 0.05) + 0.1, la = 1.3 * Math.exp(-d * 0.05) + 0.1;
  return [poisson(lh), poisson(la)];
}
// Torschützen und Vorlagen aus der Elf verteilen
function simScorers(tid, n, xi) {
  const w = p => (p.grp === 'ST' ? 5 : p.grp === 'MF' ? 2.3 : p.grp === 'AB' ? 0.6 : 0) * (p.sch / 60) ** 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const tot = xi.reduce((s, p) => s + w(p), 0); let r = Math.random() * tot, sc = xi[0];
    for (const p of xi) { r -= w(p); if (r <= 0) { sc = p; break; } }
    const as = Math.random() < 0.7 ? pick(xi.filter(p => p !== sc && p.grp !== 'TW')) : null;
    out.push({ sc, as, min: 1 + ((Math.random() * 90) | 0) });
  }
  return out.sort((x, y) => x.min - y.min);
}
// Partie abschließen (gespielt oder simuliert): Statistik, Noten, Form, Fitness, Karten, Verletzungen
function applyGame(h, a, gh, ga, live) {
  const res = { h, a, gh, ga, goals: [] };
  for (const [tid, own, opp] of [[h, gh, ga], [a, ga, gh]]) {
    const sq = ensureSquad(tid);
    let played;
    if (live && live[tid]) played = live[tid];
    else {
      const M = matchSquad(tid), sc = simScorers(tid, own, M.xi);
      played = M.xi.map(p => ({ p, g: 0, a: 0, note: null, yc: 0, rc: 0, sv: 0 }));
      const by = new Map(played.map(x => [x.p, x]));
      for (const s of sc) { by.get(s.sc).g++; if (s.as && by.get(s.as)) by.get(s.as).a++; res.goals.push({ tid, min: s.min, name: s.sc.name, pid: s.sc.pid }); }
      const w = own > opp ? -0.35 : own < opp ? 0.35 : 0;
      for (const x of played) {
        x.note = clamp(Math.round((3.5 + w + gauss() * 0.55 - x.g * 0.8 - x.a * 0.4 + (x.p.grp === 'TW' ? opp * 0.3 - (opp ? 0 : 0.5) : 0)) * 2) / 2, 1, 6);
        if (Math.random() < 0.06) x.yc = 1; if (Math.random() < 0.004) x.rc = 1;
        if (x.p.grp === 'TW') x.sv = Math.max(0, Math.round(gauss() + 3 - opp * 0.3));
      }
      // ein Einwechselspieler bekommt einen Einsatz
      const sub = M.bench.find(p => p.grp !== 'TW'); if (sub && Math.random() < 0.8) played.push({ p: sub, g: 0, a: 0, note: null, yc: 0, rc: 0, sv: 0, sub: true });
    }
    for (const x of played) {
      const p = x.p, s = p.ss, c = p.cs;
      s.sp++; c.sp++; s.g += x.g; c.g += x.g; s.a += x.a; c.a += x.a; s.sv += x.sv || 0; c.sv += x.sv || 0;
      if (x.note != null) { s.ns += x.note; s.nn++; c.ns += x.note; c.nn++; p.form = clamp(p.form + (3.5 - x.note) * 0.6 - p.form * 0.25, -4, 4); p.lastNote = x.note; }
      if (p.grp === 'TW' && !x.sub) { s.co += opp; c.co += opp; }
      if (x.yc) { s.yc++; c.yc++; p.ycs++; if (p.ycs % 5 === 0) { p.ban = Math.max(p.ban, 1); p.banNew = true; if (tid === CT()) news('Sperre', `${p.name} gesperrt`, `Die fünfte Gelbe Karte: ${p.name} muss ein Spiel zuschauen.`); } }
      if (x.rc) { s.rc++; c.rc++; p.ban = Math.max(p.ban, 2); p.banNew = true; if (tid === CT()) news('Sperre', `Rot für ${p.name}`, `${p.name} ist für zwei Spiele gesperrt.`); }
      if (x.potm) { s.potm++; c.potm++; }
      p.fit = clamp(p.fit - (x.sub ? 6 : 14) - (p.age > 30 ? 3 : 0), 40, 100);
      if (!x.sub && Math.random() < 0.012 + (p.age > 31 ? 0.008 : 0)) { p.inj = 1 + ((Math.random() * 3) | 0); p.injNew = true; if (tid === CT()) news('Verletzung', `${p.name} fällt aus`, `${p.name} hat sich verletzt und fehlt ${p.inj === 1 ? 'ein Spiel' : p.inj + ' Spiele'}. Der Betreuer hat das Eisspray schon nachbestellt.`); }
      const sk = CAREER.S.scorers; if (x.g) sk[p.pid] = (sk[p.pid] || 0) + x.g;
    }
  }
  return res;
}
// zwischen zwei Spieltagen: Fitness erholt, Sperren und Verletzungen laufen ab, Training
function betweenGames(tids) {
  for (const tid of tids) for (const p of ensureSquad(tid)) {
    p.fit = clamp(p.fit + 14 + A_fit(p), 40, 100);
    if (p.inj > 0 && !p.injNew) p.inj--; if (p.ban > 0 && !p.banNew) p.ban--; p.banNew = false; p.injNew = false;
    p.form *= 0.92;
  }
  trainStep();
}
const A_fit = p => (p.aus - 60) / 10 - (p.age > 32 ? 2 : 0);

// ---------- Ereignis abarbeiten ----------
// mine: Ergebnis des eigenen Spiels (aus dem echten Spiel) oder null = simulieren
function runEvent(mine) {
  const C = CAREER, S = C.S, ev = curEvent(); if (!ev) return;
  const my = myGame(ev), done = [];
  if (ev.t === 'lg') {
    for (const [lk, games] of Object.entries(ev.games)) {
      const li = +lk;
      for (const [h, a] of games) {
        let r;
        if (my && h === my.h && a === my.a && li === C.lg) r = mine ? Object.assign(applyGame(h, a, mine.gh, mine.ga, mine.live), mine.goals ? { goals: mine.goals } : {}) : (() => { const [gh, ga] = simScore(h, a, false); return applyGame(h, a, gh, ga); })();
        else { const [gh, ga] = simScore(h, a, false); r = applyGame(h, a, gh, ga); }
        record(S.tables[li], h, a, r.gh, r.ga); r.li = li; done.push(r);
        if (li === C.lg && (h === CT() || a === CT())) noteOwnResult(r, !!mine);
        if (li === C.lg && (h === CT() || a === CT())) bookGate(h, a);
      }
    }
    S.results.push({ ev: S.ci, md: ev.md, games: done });
  } else if (ev.t === 'cup') {
    const R = S.cup.rounds, last = ev.r === R.length - 1;
    for (const ti of R[ev.r]) {
      if (ti.w != null) continue;
      const r = koGame(ti, my && ti === my.tie ? mine : null, last); done.push(r);
      if (ti.a === CT() || ti.b === CT()) { noteOwnResult(r, !!mine, ti, 'cup'); if (!last && ti.a === CT()) bookGate(ti.a, ti.b); }
    }
    S.results.push({ ev: S.ci, cup: ev.r, games: done });
    const W = R[ev.r].map(t => t.w);
    if (!last) { const next = []; for (let i = 0; i < W.length; i += 2) next.push({ a: W[i], b: W[i + 1], w: null }); R[ev.r + 1] = next; }
    else S.cup.champ = W[0];
    const was = R[ev.r].some(t => (t.a === CT() || t.b === CT()) && t.b != null), alive = R[ev.r].some(t => t.w === CT());
    if (was) { if (alive) { prize(last ? 2500 : 300 + ev.r * 200, last ? 'Kreispokalsieger' : `Kreispokal: ${cupName(ev.r + 1)}`); if (last) title('pokal'); } else S.cupOut = ev.r; }
    if (last && S.cup.champ !== C.team) news('Kreispokal', `${TEAMS[S.cup.champ].short} holt den Kreispokal`, `Der Pokal des Kreises ${KREISE[LIGEN[C.lg].kreis].n} geht an ${TEAMS[S.cup.champ].n}.`);
  } else if (ev.t === 'po') {
    for (const ti of S.po.rounds[ev.r]) {
      if (ti.w != null) continue;
      const r = koGame(ti, my && ti === my.tie ? mine : null, ev.r === 3);
      done.push(r);
      if (ti.a === CT() || ti.b === CT()) noteOwnResult(r, !!mine, ti, 'po');
    }
    S.results.push({ ev: S.ci, po: ev.r, games: done });
    if (ev.r < 3) { const W = S.po.rounds[ev.r].map(t => t.w), next = []; for (let i = 0; i < W.length; i += 2) next.push({ a: W[i], b: W[i + 1], w: null }); S.po.rounds[ev.r + 1] = next; }
    else { S.po.champ = S.po.rounds[3][0].w; S.done = true; }
    const alive = S.po.rounds[ev.r].some(t => t.w === CT());
    const was = S.po.rounds[ev.r].some(t => t.a === CT() || t.b === CT());
    if (was) { if (alive) { prize(ev.r === 3 ? 5000 : 800 + ev.r * 400, ev.r === 3 ? 'Deutscher Kreisliga-Meister' : `Weiter: ${PO_NAMES[ev.r + 1]}`); if (ev.r === 3) title('dkm'); } else S.poOut = ev.r; }
  }
  const tids = klTeams().concat(S.po ? S.po.teams : []);
  betweenGames([...new Set(tids)]);
  S.last = done; S.ci++;
  // Liga vorbei: Meister ehren, Playoffs auslosen
  if (ev.t === 'lg' && !S.cal.slice(S.ci).some(e => e.t === 'lg')) startPlayoffs();
  if (S.ci >= S.cal.length && S.po && S.po.champ != null) S.done = true;
  saveCareer();
}
// K.-o.-Spiel (Pokal, Playoffs): eigenes Ergebnis übernehmen oder simulieren, bei Gleichstand Elfmeterschießen
function koGame(ti, mine, neutral) {
  let gh, ga, so = null, live = null;
  if (mine) { gh = mine.gh; ga = mine.ga; so = mine.so; live = mine.live; }
  else { [gh, ga] = simScore(ti.a, ti.b, neutral); if (gh === ga) { const pa = 0.5 + (squadStr(ti.a) - squadStr(ti.b)) * 0.01; so = Math.random() < pa ? [5, 4] : [3, 4]; if (Math.random() < 0.3) so = so[0] > so[1] ? [4, 2] : [2, 4]; } }
  const r = applyGame(ti.a, ti.b, gh, ga, live); if (live && mine.goals) r.goals = mine.goals;
  ti.gh = gh; ti.ga = ga; ti.so = so; ti.w = gh > ga ? ti.a : ga > gh ? ti.b : so && so[0] > so[1] ? ti.a : ti.b;
  return r;
}
// Kreismeister aus ganz Deutschland: je ein Kreis aus möglichst vielen verschiedenen Landesverbänden, Meister nach Stärke gelost
function farChampions(n) {
  const myK = LIGEN[CAREER.lg].kreis, out = [];
  const vs = shuffle(VERB.map((V, i) => i).filter(i => VERB[i].kreise.some(k => k !== myK)));
  for (let pass = 0; out.length < n && pass < 4; pass++) for (const vi of vs) {
    if (out.length >= n) break;
    const ks = VERB[vi].kreise.filter(k => k !== myK && !out.some(t => LIGEN[TEAMS[t].lg].kreis === k)); if (!ks.length) continue;
    const K = KREISE[pick(ks)], ids = LIGEN[pick(K.ligen)].ids.slice().sort((a, b) => TEAMS[b].r - TEAMS[a].r).slice(0, 3);
    out.push(Math.random() < 0.6 ? ids[0] : pick(ids));
  }
  return out;
}
function startPlayoffs() {
  const C = CAREER, S = C.S;
  const champs = C.kl.map(li => standings(li)[0]);
  champs.forEach((tid, i) => { if (tid === C.team) { title('meister'); prize(1500, `Meister der ${lgName(C.kl[i])}`); } });
  const others = farChampions(16 - champs.length);
  const teams = shuffle(champs.concat(others));
  for (const tid of teams) ensureSquad(tid);
  S.po = { teams, rounds: [[], [], [], []], champ: null };
  for (let i = 0; i < 16; i += 2) S.po.rounds[0].push({ a: teams[i], b: teams[i + 1], w: null });
  for (let r = 0; r < 4; r++) S.cal.push({ t: 'po', r });
  const meCh = champs.includes(C.team);
  const ch = TEAMS[champs[0]];
  news('Meister', meCh ? `MEISTER! ${TEAMS[C.team].short.toUpperCase()} HOLT DEN TITEL` : `${ch.short} ist Meister der ${LIGEN[C.lg].n}`, meCh ? `Die Schale bleibt im Dorf! Jetzt geht es in den Playoffs gegen die besten Kreismeister Deutschlands um die ${TROPHY}.` : `Für ${TEAMS[C.team].short} reicht es diesmal nicht. ${ch.short} vertritt den Kreis bei der deutschen Kreisliga-Meisterschaft.`, meCh ? 'title' : '');
}
function prize(v, why) { CAREER.money += v; news('Kasse', `+${fmtMoney(v)}`, `Prämie: ${why}.`, 'money'); }
function title(kind) { CAREER.titles.push({ year: CAREER.year, kind }); unlock(kind); track('titel', { art: kind }); }
function news(d, h, t, k = '') { CAREER.news.unshift({ d, h, t, k, ev: CAREER.S ? CAREER.S.ci : 0, y: CAREER.year }); CAREER.news = CAREER.news.slice(0, 40); }
function bookGate(h, a) {
  if (h !== CT()) return;
  const fans = Math.round(60 + squadStr(a) * 1.5 + (posOf(a, TEAMS[a].lg) <= 3 ? 60 : 0) + Math.random() * 60 + (CAREER.S.tables[CAREER.lg][h].form.slice(-3).filter(f => f === 's').length * 25));
  const inc = fans * 4 + Math.round(fans * 0.6) * 3;   // Eintritt und Bratwurst
  CAREER.money += inc; CAREER.S.fans = fans; CAREER.S.gate = inc;
}
function noteOwnResult(r, played, tie, kind) {
  const me = CT(), home = r.h === me, my = home ? r.gh : r.ga, op = home ? r.ga : r.gh, opp = TEAMS[home ? r.a : r.h];
  const won = my > op || (tie && tie.w === me), lost = my < op || (tie && tie.w != null && tie.w !== me && my === op);
  const sc = r.goals.filter(g => g.tid === me).map(g => g.name + (g.og ? ' (Eigentor)' : ''));
  const heads = won ? [`${TEAMS[me].short} siegt ${my}:${op}`, `Dreier gegen ${opp.short}!`, `${my}:${op} – Jubel im Sportheim`] : lost ? [`${my}:${op} gegen ${opp.short}`, `Bittere Pleite gegen ${opp.short}`, home ? `Heimpleite gegen ${opp.short}` : `Nichts zu holen in ${opp.short}`] : [`Remis gegen ${opp.short}`, `${my}:${op} – ein Punkt`];
  const body = tie ? (won ? `${tie.so ? `Nach Elfmeterschießen (${tie.so[0]}:${tie.so[1]}) ` : ''}weiter im ${kind === 'cup' ? 'Kreispokal' : 'Turnier'}!` : `${tie.so ? `Im Elfmeterschießen (${tie.so[0]}:${tie.so[1]}) ` : ''}ausgeschieden.${kind === 'cup' ? ' Jetzt zählt die Liga.' : ' Die Saison ist vorbei.'}`) : (sc.length ? `Tore: ${sc.join(', ')}.` : 'Kein eigenes Tor.') + (played ? '' : ' (simuliert)');
  news(kind === 'cup' ? 'Kreispokal' : tie ? 'Playoffs' : `${curEvent().md}. Spieltag`, pick(heads), body, won ? 'win' : lost ? 'loss' : 'draw');
  derbyResult(r, played);
}

// ---------- Eigenes Spiel ----------
function careerMatchOpts(watch) {
  const ev = curEvent(), g = myGame(ev); if (!g) return null;
  const H = matchSquad(g.h), A = matchSquad(g.a), meHome = g.h === CT();
  const rec = [g.h, g.a].map(tid => {
    if (ev.t === 'po') return CAREER.kl.includes(TEAMS[tid].lg) ? LIGEN[TEAMS[tid].lg].n.toUpperCase() : 'KREISMEISTER ' + kreisOf(tid).n.toUpperCase();
    const li = TEAMS[tid].lg, r = CAREER.S.tables[li][tid];
    return ev.t === 'cup' ? `${LIGEN[li].n.toUpperCase()} · ${posOf(tid, li)}. PLATZ` : `${posOf(tid)}. PLATZ · ${r.pkt} PKT`;
  });
  const cupLast = ev.t === 'cup' && ev.r === CAREER.S.cup.rounds.length - 1;
  const event = ev.t === 'po' && ev.r === 3 ? FINAL_EVENT : ev.t === 'po' ? { title: PO_NAMES[ev.r], ground: TEAMS[g.h].ground } : cupLast ? CUP_FINAL() : ev.t === 'cup' ? { title: 'KREISPOKAL', ground: TEAMS[g.h].ground } : null;
  return {
    human: meHome ? 0 : 1, diff: CAREER.diff, hlen: CAREER.hlen, xi: [H.xi, A.xi], bench: [H.bench, A.bench], form: [H.form, A.form], ment: [meHome ? CAREER.ment : 1, meHome ? 1 : CAREER.ment],
    career: { label: (isDerby(g.h, g.a) ? 'DERBY! · ' : '') + eventLabel(ev), rec, pk: CAREER.pk, ev: CAREER.S.ci }, derby: isDerby(g.h, g.a), ko: ev.t !== 'lg', et: ev.t === 'po' && ev.r === 3, event, watch,
  };
}
function playCareerMatch(watch) {
  const o = careerMatchOpts(watch), g = myGame(); if (!o) return;
  startMatch(g.h, g.a, o);
}
// nach dem echten Spiel: Ergebnis mit Torschützen, Noten und Karten in die Karriere
function careerAfterMatch() {
  if (!CAREER || !G.career || G.career.ev !== CAREER.S.ci || G.counted) return '';
  G.counted = true;
  const live = {};
  for (const t of [0, 1]) {
    const tid = G.tid[t];
    const ds = G.players.filter(p => p.team === t).map(p => ({ d: p.d, sub: false })).concat(G.bench[t].filter(d => d.used || d.subbed).map(d => ({ d, sub: true })));
    live[tid] = ds.filter(x => x.d.ref && x.d.ms.min > 0).map(x => ({ p: x.d.ref, g: x.d.ms.g, a: x.d.ms.a, note: x.d.note, yc: x.d.ms.yc && !x.d.ms.rc ? 1 : 0, rc: x.d.ms.rc, sv: x.d.ms.sv, sub: !!x.d.used, potm: G.potm && G.potm.d === x.d }));
  }
  const so = G.so ? [G.so.k[0].reduce((a, b) => a + b, 0), G.so.k[1].reduce((a, b) => a + b, 0)] : null;
  const ev = curEvent();
  runEvent({ gh: G.score[0], ga: G.score[1], so, live, goals: G.log.map(l => ({ tid: G.tid[l.team], min: l.min, name: l.name, pid: l.pid, og: l.og })) });
  saveCareer();
  return ev.t === 'lg' ? `Tabelle: ${posOf(CT())}. Platz · ${CAREER.S.tables[CAREER.lg][CT()].pkt} Punkte` : '';
}

// ---------- Training ----------
const TRAIN = { bal: ['Ausgewogen', ATTRS.filter(a => a !== 'tw')], kond: ['Kondition', ['aus', 'tmp']], tech: ['Technik & Passspiel', ['tec', 'pas']], absch: ['Torabschluss', ['sch', 'kop']], abw: ['Zweikampf', ['zwk', 'kop']], tw: ['Torwarttraining', ['tw']] };
function trainStep() {
  const C = CAREER, focus = TRAIN[C.train] || TRAIN.bal;
  for (const p of C.squads[C.team] || []) {
    const room = p.pot - p.ovr, ageK = p.age < 22 ? 1.4 : p.age < 26 ? 1 : p.age < 30 ? 0.5 : 0.2;
    if (Math.random() < 0.09 * ageK * (room > 0 ? 1 : 0.25)) {
      const ks = p.grp === 'TW' ? (C.train === 'tw' || C.train === 'bal' ? ['tw', 'tw', 'pas'] : ['tw']) : focus[1].filter(k => k !== 'tw');
      const k = pick(ks.length ? ks : ['pas']); p[k] = Math.min(95, p[k] + 1); p.ovr = ovr(p); p.pot = Math.max(p.pot, p.ovr);
    }
  }
}
// ---------- Saisonende: Bilanz, Entwicklung, Abgänge, Nachwuchs, Wechselbörse ----------
function seasonSummary() {
  const C = CAREER, S = C.S, pos = posOf(C.team), tbl = S.tables[C.lg][C.team];
  const g = S.goal, ok = g.k === 'champ' ? pos === 1 : pos <= g.v;
  const poRes = S.po && S.po.champ === C.team ? 'Deutscher Kreisliga-Meister' : S.poOut != null ? `Playoffs: ${PO_NAMES[S.poOut]}` : pos === 1 ? 'Playoffs' : '–';
  const cupRes = S.cup && S.cup.champ === C.team ? 'Kreispokalsieger' : S.cupOut != null ? `Kreispokal: ${CUP_NAMES[S.cup.rounds.length - 1 - S.cupOut] || 'Runde ' + (S.cupOut + 1)}` : '–';
  const top = Object.entries(S.scorers).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([pid, n]) => ({ p: playerById(+pid), n }))[0];
  return { pos, pkt: tbl.pkt, tore: `${tbl.tf}:${tbl.tg}`, ok, goal: g.txt, poRes, cupRes, top };
}
function endSeason() {
  const C = CAREER, sm = seasonSummary();
  C.hist.push({ year: C.year, team: C.team, pos: sm.pos, pkt: sm.pkt, tore: sm.tore, po: sm.poRes, cup: sm.cupRes, champ: C.S.po ? C.S.po.champ : null });
  // Gegner von weit her (Playoffs) verlassen den Spielstand wieder
  const keep = new Set(klTeams());
  for (const tid of Object.keys(C.squads)) if (!keep.has(+tid)) delete C.squads[tid];
  C.money += 1500;   // Sponsor (Metzgerei, Autohaus) für die neue Saison
  const out = [];
  for (const [tid, sq] of Object.entries(C.squads)) {
    const mine = +tid === C.team, keep = [];
    for (const p of sq) {
      p.age++; p.seasons++;
      // Entwicklung: Junge wachsen Richtung Potenzial, Ältere bauen ab
      const delta = p.age <= 22 ? rnd(1, 4) : p.age <= 26 ? rnd(0, 2.5) : p.age <= 30 ? rnd(-1, 1) : rnd(-3.5, -0.5);
      for (const a of ATTRS) { if (a === 'tw' && p.grp !== 'TW') continue; p[a] = clamp(Math.round(p[a] + delta * (a === 'tmp' || a === 'aus' ? (p.age > 29 ? 1.4 : 0.8) : 1) + rnd(-1, 1)), 20, 95); }
      p.ovr = Math.min(ovr(p), p.age <= 26 ? Math.max(p.pot, ovr(p)) : 99); p.ovr = ovr(p); p.pot = Math.max(p.pot, p.ovr);
      p.inj = 0; p.ban = 0; p.fit = 100; p.form = 0;
      // Karriereende im Kreisliga-Alter, Wechsel nach oben für junge Starke
      const retire = p.age >= 34 && Math.random() < (p.age - 32) * 0.18;
      const up = p.age <= 25 && p.ovr >= 74 && Math.random() < 0.3;
      if (retire || up) { if (mine) out.push({ p, why: retire ? 'hängt die Schuhe an den Nagel' : 'wechselt in die Bezirksliga' }); continue; }
      keep.push(p);
    }
    C.squads[tid] = keep;
    // Nachwuchs aus der A-Jugend auffüllen
    const base = TEAMS[tid].r;
    while (C.squads[tid].length < 18) { const grpNeed = needGrp(C.squads[tid]); C.squads[tid].push(genPlayer(grpNeed, base - 8 + rnd(-3, 4), 17 + ((Math.random() * 3) | 0), +tid)); }
  }
  if (out.length) news('Abgänge', `${out.length} Abgang${out.length > 1 ? 'e' : ''} im Kader`, out.map(o => `${o.p.name} ${o.why}`).join('. ') + '.');
  C.year++; C.seasonsPlayed++;
  if (C.xi) C.xi = null;
  newSeason(); refreshMarket();
  news('Neue Saison', `Saison ${seasonLabel(C.year)} beginnt`, `Neues Spiel, neues Glück in der ${lgName()}. Ziel des Vorstands: ${C.S.goal.txt}.`, 'start');
  saveCareer();
}
function needGrp(sq) {
  const need = { TW: 2, AB: 6, MF: 6, ST: 4 }, have = { TW: 0, AB: 0, MF: 0, ST: 0 };
  for (const p of sq) have[p.grp]++;
  return Object.keys(need).sort((a, b) => (have[a] - need[a]) - (have[b] - need[b]))[0];
}
// Wechselbörse: wechselwillige Spieler anderer Vereine aus dem eigenen Kreis, Handgeld aus der Vereinskasse
function refreshMarket() {
  const C = CAREER, pool = [];
  for (const tid of klTeams()) if (tid !== C.team) for (const p of ensureSquad(tid)) pool.push(p);
  C.market = shuffle(pool.filter(p => p.ovr >= 55)).slice(0, 7).map(p => ({ pid: p.pid, from: p.tid, fee: feeOf(p) }));
}
const feeOf = p => Math.max(150, Math.round((Math.pow(Math.max(0, p.ovr - 50), 1.6) * 18 + (p.age < 23 ? 400 : 0)) / 50) * 50);
function buyPlayer(i) {
  const C = CAREER, m = C.market[i]; if (!m) return 'Nicht mehr da.';
  const p = (C.squads[m.from] || []).find(q => q.pid === m.pid); if (!p) { C.market.splice(i, 1); return 'Der Spieler ist schon weg.'; }
  if (C.money < m.fee) return 'Zu wenig Geld in der Vereinskasse.';
  if (C.squads[C.team].length >= 24) return 'Der Kader ist voll (24 Spieler).';
  C.money -= m.fee; C.squads[m.from] = C.squads[m.from].filter(q => q !== p);
  const used = new Set(C.squads[C.team].map(q => q.num)); if (used.has(p.num)) { let n = 2; while (used.has(n)) n++; p.num = n; }
  p.tid = C.team; C.squads[C.team].push(p); C.market.splice(i, 1);
  // der abgebende Verein holt Ersatz aus der Jugend
  C.squads[m.from].push(genPlayer(p.grp, TEAMS[m.from].r - 6, 18, m.from));
  news('Wechsel', `${p.name} kommt!`, `${p.name} (${GRP_N[p.grp]}, ${p.age}) wechselt von ${TEAMS[m.from].short} zu uns. Handgeld: ${fmtMoney(m.fee)}.`, 'money');
  saveCareer(); return '';
}
function releasePlayer(pid) {
  const C = CAREER, sq = C.squads[C.team], p = sq.find(q => q.pid === pid); if (!p) return;
  if (sq.length <= 16) return 'Mindestens 16 Spieler müssen bleiben.';
  if (p.grp === 'TW' && sq.filter(q => q.grp === 'TW').length <= 1) return 'Der letzte Torwart bleibt.';
  C.squads[C.team] = sq.filter(q => q !== p); if (C.xi) C.xi = C.xi.filter(x => x !== pid); if (C.xi && C.xi.length !== 11) C.xi = null;
  news('Abgang', `${p.name} verlässt den Verein`, `${p.name} sucht sich einen neuen Verein. Danke für alles!`);
  saveCareer(); return '';
}
