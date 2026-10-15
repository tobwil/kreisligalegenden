// ================= Spielzustand, Formationen, Standardsituationen, Eingabe =================
let G = null;
// Schwierigkeit: cpu = Bonus auf die Werte der CPU, react = Reaktionszeit, tackle = Zweikampfeifer der CPU,
// foul = Foulquote der CPU gegen den Menschen, think = Bedenkzeit am Ball, gk = Bonus für den CPU-Torwart
const DIFF = [
  { n: 'Freizeitkick', cpu: -9, react: 1.4, tackle: 0.55, foul: 0.45, think: 1.45, gk: -6, icpt: 0.35, htk: 0.22 },
  { n: 'Kreisliga', cpu: 0, react: 1, tackle: 1, foul: 0.8, think: 1, gk: 0, icpt: 0.55, htk: 0.12 },
  { n: 'Legende', cpu: 7, react: 0.72, tackle: 1.4, foul: 1, think: 0.7, gk: 5, icpt: 0.8, htk: 0.03 },
];
// Spielrichtung: in der 1. Halbzeit spielt Team 0 nach rechts (auf das Tor bei x = CW), nach der Pause getauscht
const atkDir = t => ((t === 0) !== G.swap) ? 1 : -1;
const goalX = t => atkDir(t) > 0 ? CW : 0;           // Tor, auf das Team t spielt
const ownX = t => atkDir(t) > 0 ? 0 : CW;            // eigenes Tor
const prog = (t, x) => atkDir(t) > 0 ? x / CW : (CW - x) / CW;   // 0 = eigene Torlinie, 1 = gegnerische
const fromProg = (t, u) => atkDir(t) > 0 ? u * CW : CW - u * CW;
const relY = (t, v) => atkDir(t) > 0 ? v * CH : (1 - v) * CH;   // v: 0 = links in Spielrichtung, 1 = rechts
const inBox = (t, x, y) => Math.abs(x - ownX(t)) < BOX_D && Math.abs(y - MY) < BOX_W / 2;   // im eigenen Strafraum von Team t
const toGoal = (p) => dist(p.x, p.y, goalX(p.team), MY);

// Formationen: [Position, Tiefe u (0 eigenes Tor … 0,62 Sturm), Breite v (0 links … 1 rechts)]
const FORMS = {
  '4-4-2': [['TW', 0, .5], ['LV', .22, .12], ['IV', .18, .38], ['IV', .18, .62], ['RV', .22, .88], ['LM', .42, .13], ['ZM', .38, .4], ['ZM', .38, .6], ['RM', .42, .87], ['ST', .6, .38], ['ST', .6, .62]],
  '4-3-3': [['TW', 0, .5], ['LV', .22, .12], ['IV', .18, .38], ['IV', .18, .62], ['RV', .22, .88], ['ZM', .37, .3], ['DM', .32, .5], ['ZM', .37, .7], ['LA', .58, .15], ['ST', .62, .5], ['RA', .58, .85]],
  '4-2-3-1': [['TW', 0, .5], ['LV', .22, .12], ['IV', .18, .38], ['IV', .18, .62], ['RV', .22, .88], ['DM', .32, .38], ['DM', .32, .62], ['LM', .48, .15], ['OM', .49, .5], ['RM', .48, .85], ['ST', .63, .5]],
  '3-5-2': [['TW', 0, .5], ['IV', .18, .25], ['IV', .17, .5], ['IV', .18, .75], ['LM', .41, .08], ['ZM', .37, .33], ['DM', .31, .5], ['ZM', .37, .67], ['RM', .41, .92], ['ST', .6, .4], ['ST', .6, .6]],
  '5-3-2': [['TW', 0, .5], ['LV', .25, .08], ['IV', .17, .3], ['IV', .16, .5], ['IV', .17, .7], ['RV', .25, .92], ['ZM', .37, .3], ['ZM', .35, .5], ['ZM', .37, .7], ['ST', .58, .4], ['ST', .58, .6]],
};
const FORM_KEYS = Object.keys(FORMS);
const SLOT_GRP = { TW: 'TW', LV: 'AB', IV: 'AB', RV: 'AB', DM: 'MF', ZM: 'MF', OM: 'MF', LM: 'MF', RM: 'MF', LA: 'ST', RA: 'ST', ST: 'ST' };
const MENT = ['DEFENSIV', 'NORMAL', 'OFFENSIV'];
// Beste Elf für eine Formation: je Position der stärkste freie Spieler der passenden Gruppe (verletzte/gesperrte nicht)
function autoXI(squad, form) {
  const av = squad.filter(p => !(p.inj > 0) && !(p.ban > 0)), used = new Set(), xi = [];
  for (const [slot] of FORMS[form]) {
    const grp = SLOT_GRP[slot];
    let c = av.filter(p => !used.has(p) && p.grp === grp).sort((a, b) => effO(b) - effO(a))[0];
    if (!c) c = av.filter(p => !used.has(p) && (grp === 'TW') === (p.grp === 'TW')).sort((a, b) => effO(b) - effO(a))[0] || av.find(p => !used.has(p));
    if (c) { used.add(c); xi.push(c); }
  }
  const bench = av.filter(p => !used.has(p)).sort((a, b) => (a.grp === 'TW') - (b.grp === 'TW') || effO(b) - effO(a));
  // ein Ersatztorwart auf die Bank, wenn vorhanden
  const gk = bench.find(p => p.grp === 'TW'), rest = bench.filter(p => p !== gk);
  return { xi, bench: (gk ? [gk] : []).concat(rest).slice(0, 7) };
}
const effO = p => p.ovr + (p.form || 0) * 0.5 - (100 - (p.fit ?? 100)) * 0.06 - Math.max(0, 70 - (p.fit ?? 100)) * 0.35;   // unter 70 % Fitness bleibt ein Spieler eher draußen (wie bei Hallen-Legenden)

const KIT_NAMES = ['HEIM', 'AUSWÄRTS'];
const GK_COLS = ['#ffd23f', '#3fd0ff', '#9cff57', '#ff8bd1', '#ff9f1c', '#c58bff', '#1d1d24'];
// Wie wirkt ein Trikot aus der Entfernung? Streifen und Ringel mischen beide Farben
const kitVis = k => k.pat === 1 || k.pat === 2 ? mix(k.c1, k.c2, 0.45) : k.pat === 3 ? mix(k.c1, k.c2, 0.2) : k.c1;
const kitGap = (k1, k2) => Math.min(colDist(kitVis(k1), kitVis(k2)), colDist(k1.c1, k2.c1) + 40);
function makeKits(a, b) {
  const A = TEAMS[a], B = TEAMS[b], ka = { ...A.home };
  // Gast: Heimtrikot, Auswärtstrikot oder ein Ausweichtrikot – das mit dem größten Abstand zum Heimteam
  const cands = [{ ...B.home }, { ...B.away }, { c1: '#1d1d24', c2: B.home.c1, pat: 0 }, { c1: '#ffd200', c2: '#1d1d24', pat: 0 }, { c1: '#e30613', c2: '#f4f4f0', pat: 0 }, { c1: '#0a8a3e', c2: '#f4f4f0', pat: 0 }];
  let kb = cands[0];
  if (kitGap(kb, ka) < 175) kb = kitGap(cands[1], ka) >= 175 ? cands[1] : cands.slice(2).sort((x, y) => kitGap(y, ka) - kitGap(x, ka))[0];
  const ok = (g, os) => os.every(o => colDist(g, o) > 110);
  ka.gk = GK_COLS.find(g => ok(g, [kitVis(ka), kitVis(kb)])) || '#ffd23f';
  kb.gk = GK_COLS.find(g => ok(g, [kitVis(ka), kitVis(kb), ka.gk])) || '#3fd0ff';
  return [ka, kb];
}
// o: { human (0/1, -1 = keiner), diff, hlen (Minuten echte Zeit je Halbzeit), event, career, xi: [[11],[11]], bench, form, ko (K.-o.-Spiel), et (Verlängerung) }
function newMatch(ta, tb, o = {}) {
  const A = TEAMS[ta], B = TEAMS[tb];
  const kits = o.kits || makeKits(ta, tb);
  G = {
    mode: 'match', demo: !!o.demo, T: [A, B], tid: [ta, tb], kits, human: o.demo ? -1 : (o.human ?? 0), diff: DIFF[o.diff ?? SETTINGS.diff], diffI: o.diff ?? SETTINGS.diff,
    hlen: Math.round((o.hlen ?? SETTINGS.hlen) * 60), event: o.event || null, career: o.career || null, derby: !!o.derby, opts: o, ko: !!o.ko, et: !!o.et,
    players: [], bench: [[], []], subs: [5, 5], score: [0, 0], half: 1, clock: 0, added: 0, swap: false,
    phase: 'intro', phaseT: 0, t: 0, parts: [], banner: null, ticker: null, shake: 0, excite: 0, ctrl: null, poss: -1, possT: 0, kickoffTeam: 0,
    form: [o.form ? o.form[0] : 'X', o.form ? o.form[1] : 'X'], ment: [1, 1], sp: null, offs: null, log: [], rec: [], recT: 0, so: null, pen: null, netHit: null,
    stats: { shots: [0, 0], onT: [0, 0], corners: [0, 0], fouls: [0, 0], yellow: [0, 0], red: [0, 0], offs: [0, 0], poss: [0, 0], passes: [0, 0], passOk: [0, 0] },
    ball: { x: CW / 2, y: MY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, state: 'held', last: null, lastTeam: -1, passTo: null, kind: '', shot: null, nc: null, ncT: 0, fid: 0, trail: [], spin: 0 },
    cam: { x: CW / 2, y: 20 },
  };
  for (const t of [0, 1]) {
    const tid = G.tid[t], boost = G.human >= 0 && t !== G.human ? G.diff.cpu : 0;
    let xi = o.xi && o.xi[t], bench = o.bench && o.bench[t], form = o.form && o.form[t];
    if (!xi) { const ro = roster(tid); form = form || defaultForm(tid); const L = autoXI(ro, form); xi = L.xi; bench = L.bench; }
    G.form[t] = form || defaultForm(tid);
    xi.forEach((d, i) => G.players.push(makeP(t, i, matchData(d, boost))));
    G.bench[t] = (bench || []).map(d => matchData(d, boost));
    G.ment[t] = o.ment ? o.ment[t] : 1;
  }
  G.gk = [G.players.find(p => p.team === 0 && p.i === 0), G.players.find(p => p.team === 1 && p.i === 0)];
  // Wetter: manchmal Regen (schneller, nasser Platz), manchmal Freitagabend unter Flutlicht
  G.wx = o.wx || (o.demo ? {} : { night: Math.random() < 0.2, wet: Math.random() < 0.15 });
  buildPitch(A, kits[0], kits[1], o.event, G.wx);
  G.kickoffTeam = Math.random() < 0.5 ? 0 : 1;
  setupKickoff(G.kickoffTeam, true);
  if (G.demo) { G.phase = 'kickoff'; G.phaseT = 0; }
  else { G.phase = 'intro'; G.phaseT = 0; AU.jingle('intro'); }
  AU.ambience(true);
  return G;
}
const defaultForm = tid => ['4-4-2', '4-4-2', '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'][hashStr(TEAMS[tid].n + 'form') % 7];
// Spielerdaten fürs Spiel: Werte mit Schwierigkeits-Bonus, Form und Fitness aus der Karriere
function matchData(r, boost) {
  const f = (r.form || 0) * 0.6 - Math.max(0, 80 - (r.fit ?? 100)) * 0.15;
  const d = Object.assign({}, r);
  for (const a of ATTRS) d[a] = clamp((r[a] ?? 50) + boost + f, 15, 99);
  d.energy = clamp((r.fit ?? 100) / 100, 0.5, 1); d.ms = newMS(); d.ref = r; d.yc = 0;
  return d;
}
const newMS = () => ({ g: 0, a: 0, sh: 0, sot: 0, tk: 0, sv: 0, ps: 0, pso: 0, yc: 0, rc: 0, min: 0, og: 0 });
function makeP(team, i, d) {
  const p = { team, i, d, x: CW / 2, y: MY, z: 0, vx: 0, vy: 0, vz: 0, hx: 1, hy: 0, face: 1, pose: 'idle', fr: 0, animT: 0, tx: CW / 2, ty: MY, urg: 0, act: null, stun: 0, cd: 0, off: false, think: 0 };
  p.look = lookOf(d, G.kits[team], i === 0);
  return p;
}
const slotOf = p => FORMS[G.form[p.team]][p.i][0];
const grpOf = p => SLOT_GRP[slotOf(p)];
const isGK = p => p.i === 0;
const kit = t => G.kits[t];
const teamP = t => G.players.filter(q => q.team === t && !q.off);
const mates = p => G.players.filter(q => q.team === p.team && q !== p && !q.off);
const opps = p => G.players.filter(q => q.team !== p.team && !q.off);
const nameOf = p => p.d.name.toUpperCase();
const A_ = (p, k) => p.d[k] * (k === 'tmp' ? 0.82 + 0.18 * p.d.energy : k === 'aus' ? 1 : 0.9 + 0.1 * p.d.energy);
function say(txt, t = 3.5) { if (G.demo) return; G.ticker = { txt, t }; }
function banner(txt, col = '#ffc83a', sub = '', dur = 1.6, big = false) { if (G.demo && !big) return; G.banner = { txt, col, sub, t: 0, dur, big }; }

function place(p, x, y) { Object.assign(p, { x, y, z: 0, vx: 0, vy: 0, vz: 0, tx: x, ty: y, act: null, stun: 0, pose: 'idle' }); }
function giveBall(p, quiet) {
  const b = G.ball, from = b.last;
  if (b.passer && ['pass', 'through', 'lob'].includes(b.kind)) flairRecv(p, b.passer);
  if (G.tut && b.passer && b.passer.team === p.team && b.passer !== p) tutEvent({ k: 'recv', p, kind: b.kind });
  p.assistFrom = b.passer && b.passer !== p && b.passer.team === p.team && ['pass', 'through', 'lob', 'cross', 'head'].includes(b.kind) ? b.passer : null;
  if (b.passer && b.passer.team === p.team && b.passer !== p && b.kind && b.kind !== 'shot') G.stats.passOk[p.team]++;
  b.owner = p; b.state = 'held'; b.passTo = null; b.shot = null; b.passer = null; b.kind = ''; b.vz = 0; b.z = 0; b.spin = 0; b.plan = null;
  if (isGK(p)) { b.x = p.x + p.face * 0.25; b.y = p.y + 0.05; b.z = 1; } else { b.x = p.x + p.hx * 0.45; b.y = p.y + p.hy * 0.4; }
  b.last = p; b.lastTeam = p.team; p.gotT = G.t; p.think = rnd(0.15, 0.4) * G.diff.think;
  if (G.poss !== p.team) { G.poss = p.team; G.possT = 0; }
  if (G.offs && G.offs.team !== p.team) G.offs = null;
  if (!quiet) AU.touch();
  toCtrl(p.team, p, from);
  void from;
}
function nearestTo(team, x, y, excl, gk = false) {
  let best = null, bd = 1e9;
  for (const p of G.players) if (p.team === team && p !== excl && !p.off && (gk || !isGK(p))) { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
  return best;
}

// ---------- Anstoß und Standardsituationen ----------
function setupKickoff(team, full) {
  G.phase = 'kickoff'; G.phaseT = 0; G.sp = null; G.pen = null; G.offs = null; G.netHit = null;
  const b = G.ball; Object.assign(b, { x: CW / 2, y: MY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, passTo: null, shot: null, kind: '', plan: null, trail: [] });
  for (const p of G.players) {
    if (p.off) continue;
    const [x, y] = kickoffSpot(p, team); place(p, x, y); p.face = atkDir(p.team);
  }
  const k = teamP(team).filter(q => !isGK(q)).sort((a, c) => dist(a.x, a.y, CW / 2, MY) - dist(c.x, c.y, CW / 2, MY))[0];
  place(k, CW / 2 - atkDir(team) * 0.4, MY); giveBall(k, true); G.poss = team; G.possT = 0;
  G.sp = { type: 'kick', team, taker: k, x: CW / 2, y: MY, t: 0 };
  G.camSnap = true;
  if (G.human >= 0 && !G.demo) G.ctrl = G.human === team ? k : nearestTo(G.human, CW / 2, MY);
  if (G.pl) mpReset(team, k);
  void full;
}
function kickoffSpot(p, team) {
  const F = FORMS[G.form[p.team]][p.i], s = atkDir(p.team);
  if (isGK(p)) return [ownX(p.team) + s * 1.5, MY];
  let u = 0.06 + F[1] * 0.68;                         // eigene Hälfte
  const x = CW / 2 - s * (CW / 2) * (1 - u / 0.5) * 0.98;
  let y = relY(p.team, F[2]);
  let xx = clamp(x, 2, CW - 2);
  if ((xx - CW / 2) * s > -1) xx = CW / 2 - s * 1;
  if (p.team !== team && dist(xx, y, CW / 2, MY) < CIRCLE_R + 0.5) { const a = Math.atan2(y - MY, xx - CW / 2); xx = CW / 2 + Math.cos(a) * (CIRCLE_R + 0.6); y = MY + Math.sin(a) * (CIRCLE_R + 0.6); if ((xx - CW / 2) * s > 0) xx = CW / 2 - s * 1; }
  return [xx, y];
}
// type: 'throw' Einwurf, 'corner' Ecke, 'goal' Abstoß, 'free' Freistoß, 'pen' Elfmeter
function setupSetPiece(type, team, x, y, who) {
  const b = G.ball, s = atkDir(team), gx = goalX(team);
  G.offs = null; G.pen = null; G.netHit = null;
  if (type === 'corner') { x = gx === CW ? CW - 0.3 : 0.3; y = y < MY ? 0.3 : CH - 0.3; }
  if (type === 'goal') { x = ownX(team) + s * SIX_D * 0.9; y = MY + (y < MY ? -4 : 4); }
  if (type === 'throw') { y = y < MY ? -0.25 : CH + 0.25; x = clamp(x, 0.6, CW - 0.6); }
  if (type === 'pen') { x = gx - s * PEN_D; y = MY; }
  if (type === 'free') { x = clamp(x, 1, CW - 1); y = clamp(y, 1, CH - 1); }
  let taker = who && !who.off && !isGK(who) ? who : null;
  if (type === 'goal') taker = G.gk[team];
  if (!taker) {
    const cands = teamP(team).filter(q => !isGK(q));
    if (type === 'pen' || (type === 'free' && Math.abs(x - gx) < 32)) taker = penTaker(team);
    else if (type === 'corner') taker = cands.sort((a, c) => c.d.pas - a.d.pas)[0];
    else taker = cands.sort((a, c) => dist(a.x, a.y, x, y) - dist(c.x, c.y, x, y))[0];
  }
  Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, passTo: null, shot: null, kind: '', plan: null, trail: [] });
  const spots = setPieceSpots(type, team, x, y, taker);
  for (const p of G.players) if (!p.off) { const sp = spots.get(p); if (sp) place(p, sp[0], sp[1]); p.face = p.team === team ? atkDir(team) : -atkDir(team); }
  const tx = type === 'throw' ? x : x - s * (type === 'pen' || type === 'free' ? 0.6 : type === 'corner' ? 0 : 0.5);
  place(taker, type === 'corner' ? x + (x < 1 ? -0.5 : 0.5) : tx, type === 'throw' ? y : type === 'corner' ? y + (y < 1 ? -0.4 : 0.4) : y);
  taker.face = type === 'corner' ? (x < 1 ? 1 : -1) : s;
  giveBall(taker, true); G.poss = team; G.possT = 0;
  if (type === 'throw') { b.x = taker.x; b.y = taker.y; b.z = 2.0; }
  else { b.x = x; b.y = y; b.z = 0; }
  G.sp = { type, team, taker, x, y, t: 0, ready: false };
  G.camSnap = true;
  G.phase = type === 'pen' ? 'penalty' : 'setpiece'; G.phaseT = 0;
  if (type === 'pen') G.pen = { shooter: taker, team, gk: G.gk[1 - team], guess: null, done: false };
  if (G.human >= 0 && !G.demo) G.ctrl = G.human === team ? taker : (type === 'pen' ? G.gk[G.human] : nearestTo(G.human, x, y));
  if (G.pl) { mpReset(team, taker); if (type === 'pen') { const k = slotOfTeam(1 - team); if (k) k.ctrl = G.gk[1 - team]; } }
}
// bester Schütze (Elfmeter, Freistoß): festgelegter Schütze aus der Karriere, sonst der beste Schuss auf dem Platz
function penTaker(team) {
  const on = teamP(team).filter(q => !isGK(q)), set = G.career && G.career.pk != null && G.human === team ? on.find(q => q.d.pid === G.career.pk) : null;
  return set || on.sort((a, c) => (c.d.sch + c.d.tec * 0.3 + (c.d.trait === 'Freistoßkönig' ? 8 : 0)) - (a.d.sch + a.d.tec * 0.3 + (a.d.trait === 'Freistoßkönig' ? 8 : 0)))[0];
}
// Aufstellung bei Standards: Spielaufstellung um den Ball, dazu Strafraumbesetzung bei Ecken und Freistößen, Mauer, 9,15 m Abstand
function setPieceSpots(type, team, x, y, taker) {
  for (const p of G.players) p.wall = false;
  const out = new Map(), s = atkDir(team), gx = goalX(team);
  const saveBall = G.ball.x, saveBy = G.ball.y, saveP = G.poss;
  G.ball.x = x; G.ball.y = y; G.poss = team;
  for (const p of G.players) if (!p.off) out.set(p, isGK(p) ? gkSpot(p) : formSpot(p));
  G.ball.x = saveBall; G.ball.y = saveBy; G.poss = saveP;
  const att = teamP(team).filter(q => !isGK(q) && q !== taker), def = teamP(1 - team).filter(q => !isGK(q));
  const crowd = type === 'corner' || (type === 'free' && Math.abs(x - gx) < 38);
  if (type === 'pen') {
    // alle außerhalb von Strafraum und Teilkreis, Torwart auf der Linie
    const others = G.players.filter(q => !q.off && q !== taker && !isGK(q));
    if (G.so) {
      // Elfmeterschießen: alle anderen warten Arm in Arm im Mittelkreis, der eigene Torwart am Rand des Strafraums
      for (const t of [0, 1]) others.filter(q => q.team === t).forEach((q, i) => out.set(q, [CW / 2 + (t === 0 ? -1.2 : 1.2) + (i % 2) * (t === 0 ? -0.9 : 0.9), MY - 4.5 + i * 0.95]));
      out.set(G.gk[team], [gx - s * (BOX_D + 3), MY + 12]);
    } else others.forEach((q, i) => { const k = i / Math.max(1, others.length - 1); out.set(q, [gx - s * (BOX_D + 1.2 + (i % 3) * 1.1 + (Math.abs(k - 0.5) < 0.15 ? 2 : 0)), MY - 17 + k * 34 + (q.team === team ? 0.6 : -0.6)]); });
    out.set(G.gk[1 - team], [gx - s * 0.3, MY]);
    return out;
  }
  if (crowd) {
    // Angreifer in den Strafraum: kurzer Pfosten, langer Pfosten, Elfmeterpunkt, Strafraumkante; groß und kopfballstark zuerst
    const near = y < MY ? -1 : 1;
    const zones = [[6, near * 2.5], [7, -near * 3], [PEN_D, 0.5], [9, -near * 6], [BOX_D + 2, 0], [12, near * 7]];
    const tall = att.filter(q => grpOf(q) !== 'AB' || q.d.kop > 60).sort((a, c) => c.d.kop - a.d.kop);
    const keepBack = att.filter(q => grpOf(q) === 'AB').sort((a, c) => a.d.kop - c.d.kop).slice(0, 2);
    const runners = tall.filter(q => !keepBack.includes(q)).slice(0, type === 'corner' ? 5 : 4);
    runners.forEach((q, i) => { const z = zones[i]; out.set(q, [gx - s * z[0] + rnd(-0.6, 0.6), MY + z[1] + rnd(-0.8, 0.8)]); });
    // Verteidiger: Manndeckung torseitig, zwei am Pfosten bei der Ecke
    const markers = def.slice().sort((a, c) => c.d.kop - a.d.kop);
    runners.forEach((q, i) => { const m = markers[i]; if (m) { const sp = out.get(q); out.set(m, [sp[0] + s * 1.1, sp[1] + (MY - sp[1]) * 0.1 + 0.4]); } });
    if (type === 'corner') { const rest = markers.slice(runners.length); if (rest[0]) out.set(rest[0], [gx - s * 0.6, MY + near * (GW / 2 - 0.3)]); if (rest[1]) out.set(rest[1], [gx - s * 6, MY + near * 8]); }
  }
  if (type === 'free' && Math.abs(x - gx) < 34 && Math.abs(y - MY) < 22) {
    // Mauer: 2–4 Spieler, 9,15 m entfernt, wie im echten Spiel: der äußere steht auf der Linie Ball–kurzer Pfosten,
    // die anderen nach innen. Das kurze Eck ist zu, das lange Eck hält der Torwart
    const d = dist(x, y, gx, MY), ux = (gx - x) / d, uy = (MY - y) / d, n = d < 22 ? 4 : d < 28 ? 3 : 2;
    const npY = MY + (y < MY ? -1 : 1) * GW / 2, nd = dist(x, y, gx, npY), px = x + (gx - x) / nd * 9.15, py = y + (npY - y) / nd * 9.15;
    const offNP = (px - x) * -uy + (py - y) * ux, sg = Math.abs(offNP) < 0.05 ? 1 : Math.sign(offNP);
    const wall = def.slice().sort((a, c) => dist(a.x, a.y, x, y) - dist(c.x, c.y, x, y)).slice(0, n);
    wall.forEach((q, i) => { const off = offNP + sg * (0.3 - i * 0.7); out.set(q, [x + ux * 9.15 - uy * off, y + uy * 9.15 + ux * off]); q.wall = true; });
  }
  // Abstand: Gegner mindestens 9,15 m vom Ball (beim Einwurf 2 m)
  const minD = type === 'throw' ? 2.2 : 9.3;
  for (const q of G.players) {
    if (q.off || q.team === team || isGK(q) || (q.wall && type === 'free')) continue;
    const sp = out.get(q); if (!sp) continue;
    const d = dist(sp[0], sp[1], x, y);
    if (d < minD) { const a = d > 0.1 ? Math.atan2(sp[1] - y, sp[0] - x) : Math.atan2(MY - y, ownX(1 - team) - x); sp[0] = x + Math.cos(a) * minD; sp[1] = y + Math.sin(a) * minD; }
  }
  // Mitspieler nicht auf den Schützen
  for (const [q, sp] of out) { sp[0] = clamp(sp[0], 0.5, CW - 0.5); sp[1] = clamp(sp[1], 0.5, CH - 0.5); if (q !== taker && dist(sp[0], sp[1], x, y) < 1.5 && q.team === team) sp[1] += 3; }
  return out;
}

// ---------- Eingabe ----------
const KEY = {}, KEYP = {};
const IN = { x: 0, y: 0, s: false, a: false, b: false, c: false, k: false, f: false, pa: false, pb: false, pc: false, pk: false, pf: false, ra: false, rb: false, rc: false, rk: false, bHeld: 0, aHeld: 0, any: false };
const TOUCH = { x: 0, y: 0, a: false, b: false, c: false, k: false, s: false, aim: null, aimLast: null, pow: null, passT: 0, pulseA: 0, pulseB: 0, pulseC: 0, pulseK: 0, pulseF: 0, fdir: null, kpow: null, cpow: null };
let LASTIN = TOUCHDEV ? 'touch' : 'key';
const setInput = k => { if (k === LASTIN) return; LASTIN = k; document.body.classList.toggle('padin', k === 'pad' || (k === 'key' && TOUCHDEV)); };
// Gamepad oder Tastatur am Tablet: Touch-Knöpfe weg; der erste Finger auf dem Bildschirm holt sie zurück
if (TOUCHDEV) document.addEventListener('touchstart', () => setInput('touch'), { capture: true, passive: true });
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  KEY[e.code] = true; if (!e.repeat) KEYP[e.code] = true; setInput('key');
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && menu.hidden) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && G && !G.demo) { e.preventDefault(); if (menu.hidden) togglePause(); else menuBack(); }
  else if (e.code === 'Escape' && !menu.hidden) menuBack();
  if (e.code === 'KeyM' && menu.hidden) AU.toggle();
  if ((e.code === 'KeyT' || e.code === 'Tab') && menu.hidden && G && !G.demo && G.human >= 0 && !['intro', 'end', 'replay'].includes(G.phase)) ACT.tactics();
});
addEventListener('keyup', e => { KEY[e.code] = false; });
addEventListener('blur', () => { for (const k in KEY) KEY[k] = false; });
const prevIN = { a: false, b: false, c: false, k: false, f: false, st: false };
const K = (...c) => c.some(k => KEY[k] || KEYP[k]);
// Tastatur-Belegungen. Bedeutung der Aktionen: a Pass (Abwehr: wechseln), b Schuss (Tackling), c Flanke/hoher Ball (Grätsche),
// k Steilpass (Druck), f Haken (wechseln), s Sprint
const LAYOUTS = {
  // Standard (wie Hallen- und Korb-Legenden): Pfeile laufen, W Sprint, S Pass (halten = fester), A Flanke, D Steilpass, Leertaste Schuss und Kopfball.
  // Abwehr: S wechselt, D Tackling, Leertaste Grätsche, A ein Mitspieler presst mit. def sagt, welche Taste in der Abwehr was macht.
  legenden: { n: 'LEGENDEN', def: { tk: 'k', sl: 'b', pr: 'c' }, move: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], moveN: 'Pfeiltasten', a: ['KeyS'], b: ['Space'], c: ['KeyA'], k: ['KeyD'], f: ['KeyF'], s: ['KeyW', 'ShiftLeft', 'ShiftRight'],
    keyN: { a: 'S', b: 'LEER', c: 'A', k: 'D', f: 'F', s: 'W' } },
  // linke Hand läuft, rechte Hand wie die Knöpfe am Gamepad: K unten = Pass, L rechts = Schuss, J links = Flanke, I oben = Steilpass
  wasd: { n: 'WASD + IJKL', move: ['KeyW', 'KeyS', 'KeyA', 'KeyD'], moveN: 'WASD', a: ['KeyK'], b: ['KeyL'], c: ['KeyJ'], k: ['KeyI'], f: ['KeyU', 'KeyO'], s: ['ShiftLeft', 'ShiftRight', 'Space'],
    keyN: { a: 'K', b: 'L', c: 'J', k: 'I', f: 'U', s: 'SHIFT' } },
  // EA FC am PC (klassisch): Pfeile laufen, linke Hand für die Aktionen
  fc: { n: 'EA FC KLASSISCH', move: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], moveN: 'Pfeiltasten', a: ['KeyS'], b: ['KeyD', 'Space'], c: ['KeyA'], k: ['KeyW'], f: ['KeyQ', 'KeyF'], s: ['ShiftLeft', 'ShiftRight', 'KeyE'],
    keyN: { a: 'S', b: 'D', c: 'A', k: 'W', f: 'Q', s: 'SHIFT' } },
};
const LAY = () => LAYOUTS[SETTINGS.keys] || LAYOUTS.legenden;
function readInput(dt) {
  let x = 0, y = 0, a, b, c, s, k, f, st = false;
  // Tastatur nach gewählter Belegung (Optionen); bei WASD laufen die Pfeiltasten zusätzlich
  const L = LAY(), [mu, md, ml, mr] = L.move, arrows = L.move[0] !== 'ArrowUp';
  if (K(ml) || (arrows && K('ArrowLeft'))) x -= 1; if (K(mr) || (arrows && K('ArrowRight'))) x += 1;
  if (K(mu) || (arrows && K('ArrowUp'))) y -= 1; if (K(md) || (arrows && K('ArrowDown'))) y += 1;
  a = K(...L.a); b = K(...L.b); c = K(...L.c); k = K(...L.k); f = K(...L.f); s = K(...L.s);
  if (navigator.getGamepads) for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.25) { x += ax; y += ay; }
    if (bt(14)) x -= 1; if (bt(15)) x += 1; if (bt(12)) y -= 1; if (bt(13)) y += 1;
    a = a || bt(0); b = b || bt(1); c = c || bt(2); k = k || bt(3); f = f || bt(4); s = s || bt(5) || bt(7) || bt(6); st = st || bt(9);
    if (bt(8) && !prevIN.sel && G && !G.demo && G.human >= 0 && menu.hidden) ACT.tactics(); prevIN.sel = bt(8);
    if (gp.buttons.some(q => q && q.pressed)) setInput('pad');
    break;
  }
  if (TOUCH.x || TOUCH.y) { x += TOUCH.x; y += TOUCH.y; }
  a = a || TOUCH.a || !!TOUCH.pulseA; b = b || TOUCH.b || !!TOUCH.pulseB; c = c || TOUCH.c || !!TOUCH.pulseC; k = k || TOUCH.k || !!TOUCH.pulseK; s = s || TOUCH.s; f = f || !!TOUCH.pulseF;
  TOUCH.pulseA = 0; TOUCH.pulseB = 0; TOUCH.pulseC = 0; TOUCH.pulseK = 0; TOUCH.pulseF = 0;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  IN.x = x; IN.y = y; IN.s = s;
  IN.pa = a && !prevIN.a; IN.pb = b && !prevIN.b; IN.pc = c && !prevIN.c; IN.pk = k && !prevIN.k; IN.pf = f && !prevIN.f;
  IN.ra = !a && prevIN.a; IN.rb = !b && prevIN.b; IN.rc = !c && prevIN.c; IN.rk = !k && prevIN.k;
  IN.bHeld = b ? IN.bHeld + dt : (IN.rb ? IN.bHeld : 0);
  IN.a = a; IN.b = b; IN.c = c; IN.k = k; IN.f = f;
  IN.any = IN.pa || IN.pb || IN.pc || IN.pk || !!KEYP.Enter;
  if (st && !prevIN.st && G && !G.demo && menu.hidden) togglePause();
  if (G && G.watch && !G.demo && menu.hidden && (IN.pa || IN.pb || IN.pc)) joinGame();
  prevIN.a = a; prevIN.b = b; prevIN.c = c; prevIN.k = k; prevIN.f = f; prevIN.st = st;
  for (const kk in KEYP) KEYP[kk] = false;
}
function clearEdges() { IN.pa = IN.pb = IN.pc = IN.pk = IN.pf = IN.ra = IN.rb = IN.rc = IN.rk = IN.any = false; }

// ---------- Wechsel ----------
// i: Platz auf dem Feld, bi: Platz auf der Bank. Ein ausgewechselter Spieler darf nicht zurück
function doSub(p, bi, quiet) {
  const t = p.team, nd = G.bench[t][bi]; if (!nd || G.subs[t] <= 0 || p.off || nd.used) return false;
  if (G.ball.owner === p) return false;
  const old = p.d; old.subbed = true; nd.used = true; nd.onAt = G.half;
  G.bench[t][bi] = old; p.d = nd; p.look = lookOf(nd, G.kits[t], isGK(p)); G.subs[t]--;
  if (!quiet) say(`WECHSEL ${G.T[t].k}: ${nd.name.toUpperCase()} FÜR ${old.name.toUpperCase()}`);
  return true;
}
// müde Spieler in Spielpausen auswechseln (CPU immer, Mensch nur mit Auto-Wechsel)
function autoSubs() {
  for (const t of [0, 1]) {
    if (t === G.human && !SETTINGS.autosub) continue;
    if (G.subs[t] <= 0) continue;
    const tired = teamP(t).filter(p => !isGK(p) && p.d.energy < 0.55).sort((a, b) => a.d.energy - b.d.energy)[0];
    if (!tired) continue;
    const grp = grpOf(tired), bi = G.bench[t].map((d, i) => [d, i]).filter(([d]) => !d.used && !d.subbed && d.grp !== 'TW').sort((x, y) => (y[0].grp === grp) - (x[0].grp === grp) || y[0].ovr - x[0].ovr)[0];
    if (bi) doSub(tired, bi[1]);
  }
}
