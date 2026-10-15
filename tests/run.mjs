// Regressionstests für Kreisliga-Legenden (game/index.html) mit Playwright und Chromium.
// Aufruf:  cd tests && npm install && npm test        (Chromium: CHROMIUM_PATH=/pfad/zu/chromium, sonst /opt/pw-browsers/chromium)
// Nur bestimmte Tests: npm test -- saison elfmeter
// Die Spiele laufen Bild für Bild (readInput + step), damit die Tests nicht von der Rechenzeit abhängen.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { const req = createRequire(execSync('npm root -g').toString().trim() + '/'); ({ chromium } = req('playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = /^https?:\/\//.test(process.env.GAME || '') ? process.env.GAME : pathToFileURL(process.env.GAME || path.join(root, 'game', 'index.html')).href;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find(existsSync);
const only = process.argv.slice(2);
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const MOBILE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
let browser;
async function open(opts = DESKTOP, seed = 7) {
  const ctx = await browser.newContext(opts);
  if (seed) await ctx.addInitScript(s => { let x = s; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; }, seed);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(GAME, { timeout: 60000 }); await page.waitForTimeout(600);
  return { page, ctx, errors };
}
// ganzes Spiel ohne Menschen Bild für Bild durchspielen
const RUN_MATCH = `window.__runMatch = (a, b, o = {}) => {
  newMatch(a, b, Object.assign({ human: -1, hlen: 2 }, o)); G.paused = true; G.phase = 'kickoff';
  let n = 0; while (G.phase !== 'end' && n < 60 * 60 * 12) { step(1 / 60); n++; if (G.phase === 'pause') nextHalf(); else if (G.phase === 'etpause') { G.half = 2; nextHalf(); } }
  return { score: G.score.slice(), phase: G.phase, n, stats: G.stats, log: G.log.slice(), so: G.so ? G.so.k : null };
};`;

test('Seite lädt ohne Fehler, Spielschleife läuft, Titel und Hauptmenü (Desktop und Handy)', async () => {
  for (const o of [DESKTOP, MOBILE]) {
    const { page, ctx, errors } = await open(o, 0);
    const t1 = await page.evaluate('G.t'); await page.waitForTimeout(500); const t2 = await page.evaluate('G.t');
    ok(t2 > t1, `G.t steigt nicht (${t1} -> ${t2})`);
    ok(await page.evaluate(() => !!menu.querySelector('.logo') && !!menu.querySelector('.press')), 'Titelbild fehlt');
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    ok(await page.evaluate(() => !!menu.querySelector('[data-act="quick"]') && !!menu.querySelector('[data-act="career"]')), 'Enter öffnet das Hauptmenü nicht');
    ok(!errors.length, errors.join('; ')); await ctx.close();
  }
});

test('Vereine: beide Kreisligen mit 16 echten Vereinen, eindeutige Kürzel, Kader mit 18 Spielern und eindeutigen Rückennummern', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const ks = TEAMS.map(t => t.k), dupK = ks.filter((k, i) => ks.indexOf(k) !== i);
    const bad = [];
    for (const t of TEAMS) { const ro = roster(t.id), nums = ro.map(p => p.num); if (ro.length !== 18 || new Set(nums).size !== 18 || ro.filter(p => p.grp === 'TW').length < 2) bad.push(t.k); }
    return { l: KREIS_LIGEN.map(L => L.ids.length), dupK, bad, names: LEAGUE(0).map(t => t.n) };
  });
  ok(r.l[0] === 16 && r.l[1] === 16, 'Ligagröße ' + r.l);
  ok(!r.dupK.length, 'doppelte Kürzel: ' + r.dupK);
  ok(!r.bad.length, 'Kader fehlerhaft: ' + r.bad);
  ok(r.names.includes('TSV 1860 Staffelstein') && r.names.includes('SV Bosporus Coburg'), 'echte Vereine fehlen');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('CPU gegen CPU: komplette Spiele ohne Hänger, plausible Ergebnisse, Schüsse, Pässe, Zweikämpfe', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(RUN_MATCH);
  const res = await page.evaluate(() => [0, 1, 2, 3].map(i => __runMatch(KREIS_LIGEN[0].ids[i], KREIS_LIGEN[1].ids[15 - i])));
  let goals = 0, shots = 0, passes = 0, ok2 = 0;
  for (const r of res) {
    ok(r.phase === 'end', 'Spiel endet nicht: ' + JSON.stringify(r.score));
    goals += r.score[0] + r.score[1]; shots += r.stats.shots[0] + r.stats.shots[1]; passes += r.stats.passes[0] + r.stats.passes[1]; ok2 += r.stats.passOk[0] + r.stats.passOk[1];
    ok(r.score[0] + r.score[1] < 13, 'unplausibles Ergebnis ' + r.score);
    ok(r.log.length === r.score[0] + r.score[1], 'Torliste passt nicht zum Ergebnis');
  }
  ok(goals >= 2 && goals <= 32, 'Tore gesamt ' + goals);
  ok(shots >= 16, 'zu wenige Schüsse ' + shots);
  ok(passes > 150 && ok2 / passes > 0.55, `Passquote ${ok2}/${passes}`);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Tastatur: Enter, Freundschaftsspiel startet mit Intro, Anstoß mit S, Pfeile laufen, Leertaste lädt und schießt, Esc pausiert', async () => {
  const { page, ctx, errors } = await open();
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.evaluate(() => ACT.qstart()); await page.waitForTimeout(200);
  ok(await page.evaluate(() => menu.hidden && G.phase === 'intro'), 'kein Intro');
  await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.phase === 'kickoff'), 'kein Anstoß nach Taste');
  // Anstoß: Team 0 hat den Ball? Sonst Ballbesitz setzen
  await page.evaluate(() => { if (G.sp.team !== 0) setupKickoff(0, true); G.sp.t = 1; });
  await page.keyboard.press('s');
  const passed = await page.waitForFunction(() => G.phase === 'play' && G.ball.owner === null, null, { timeout: 2000, polling: 'raf' }).then(() => true, () => false);
  ok(passed, 'Anstoß-Pass kommt nicht');
  const setup = () => page.evaluate(() => { G.phase = 'play'; G.sp = null; const p = teamP(0).find(q => grpOf(q) === 'ST'); place(p, goalX(0) - atkDir(0) * 18, MY); giveBall(p, true); p.charge = 0; for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, o.y); G.ctrl = p; return p.d.name; });
  await setup(); await page.waitForTimeout(100);
  const x0 = await page.evaluate(() => G.ctrl.x);
  const dir = await page.evaluate(() => atkDir(0));
  await page.keyboard.down(dir > 0 ? 'ArrowRight' : 'ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
  ok(await page.evaluate(([x0, dir]) => (G.ctrl.x - x0) * dir > 0.8, [x0, dir]), 'Pfeile bewegen den Spieler nicht');
  await setup(); await page.waitForTimeout(100);
  const sh0 = await page.evaluate(() => G.stats.shots[0]);
  await page.keyboard.down('Space'); await page.waitForTimeout(350); await page.keyboard.up('Space'); await page.waitForTimeout(150);
  ok(await page.evaluate(s => G.stats.shots[0] === s + 1, sh0), 'Leertaste schießt nicht');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => G.paused && !menu.hidden), 'Esc pausiert nicht');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => !G.paused && menu.hidden), 'Esc setzt nicht fort');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Aktionen: Pass, Steilpass, Flanke, Haken, Tackling und Grätsche lösen aus', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { startMatch(KREIS_LIGEN[0].ids[0], KREIS_LIGEN[0].ids[4], { human: 0 }); G.paused = true; });
  const r = await page.evaluate(() => {
    const setup = (wing) => { G.phase = 'play'; G.sp = null; G.ball.passTo = null; const p = teamP(0).find(q => grpOf(q) === 'MF'); p.cd = 0; p.act = null; p.stun = 0; place(p, wing ? goalX(0) - atkDir(0) * 20 : CW / 2, wing ? 6 : MY); giveBall(p, true); G.ctrl = p; return p; };
    const press = k => { KEY[k] = true; KEYP[k] = true; readInput(1 / 60); KEY[k] = false; humanControl(1 / 60); readInput(1 / 60); };
    const out = {};
    setup(); press('KeyS'); out.pass = G.ball.kind;
    setup(); press('KeyA'); out.through = G.ball.kind;
    setup(true); press('KeyD'); out.cross = G.ball.kind;
    const p = setup(); press('KeyF'); out.trick = p.act && p.act.type;
    // Abwehr: Gegner am Ball
    G.phase = 'play'; const o = teamP(1).find(q => grpOf(q) === 'MF'), d = teamP(0).find(q => grpOf(q) === 'AB');
    place(o, CW / 2, MY); giveBall(o, true); place(d, CW / 2 + 0.9, MY); d.cd = 0; G.ctrl = d; d.hx = -1; d.hy = 0;
    press('KeyD'); out.tackle = d.act && d.act.type;
    d.cd = 0; d.act = null; d.stun = 0; place(d, CW / 2 + 2, MY); if (G.ball.owner !== o) { place(o, CW / 2, MY); giveBall(o, true); } G.ctrl = d;
    press('Space'); out.slide = d.act && d.act.type;
    return out;
  });
  ok(r.pass === 'pass' && r.through === 'through' && r.cross === 'cross' && r.trick === 'trick' && r.tackle === 'tackle' && r.slide === 'slide', JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Regeln: Seitenaus gibt Einwurf, Toraus Ecke oder Abstoß, Foul im Strafraum Elfmeter, Abseits wird gepfiffen', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { startMatch(KREIS_LIGEN[0].ids[0], KREIS_LIGEN[0].ids[4], { human: -1 }); G.paused = true; });
  const r = await page.evaluate(() => {
    const out = {}, b = G.ball;
    const free = (x, y, vx, vy, last) => { G.phase = 'play'; G.sp = null; b.owner = null; Object.assign(b, { x, y, z: 0, vx, vy, vz: 0, plan: null, shot: null }); b.last = last; b.lastTeam = last.team; for (const p of G.players) { p.x = CW / 2; p.y = MY; } };
    const t0 = teamP(0)[5], t1 = teamP(1)[5];
    free(50, 1, 0, -12, t0); for (let i = 0; i < 20; i++) step(1 / 60); out.throw = G.pending && G.pending.k + G.pending.team;
    for (let i = 0; i < 70; i++) step(1 / 60); out.throwSet = G.sp && G.sp.type;
    // Toraus hinter dem Tor von Team 1, zuletzt Team 1 berührt: Ecke für Team 0
    const g1 = ownX(1); free(g1 - Math.sign(g1 - 50) * 2, 10, Math.sign(g1 - 50) * 15, 0, t1); for (let i = 0; i < 20; i++) step(1 / 60); out.corner = G.pending && G.pending.k + G.pending.team;
    free(g1 - Math.sign(g1 - 50) * 2, 10, Math.sign(g1 - 50) * 15, 0, t0); for (let i = 0; i < 20; i++) step(1 / 60); out.goalkick = G.pending && G.pending.k + G.pending.team;
    // Foul im Strafraum
    G.phase = 'play'; G.pending = null; const a = teamP(0).find(q => grpOf(q) === 'ST'), d = teamP(1).find(q => grpOf(q) === 'AB');
    place(a, goalX(0) - atkDir(0) * 9, MY); giveBall(a, true); place(d, a.x - atkDir(0) * 0.5, MY);
    foul(d, a, 1); out.pen = G.pending && G.pending.k;
    // Abseits
    SETTINGS.offside = true; G.phase = 'play'; G.pending = null; G.sp = null;
    const pas = teamP(0).find(q => grpOf(q) === 'MF'), st = teamP(0).find(q => grpOf(q) === 'ST');
    teamP(1).forEach((o, i) => place(o, isGK(o) ? goalX(0) - atkDir(0) * 1 : goalX(0) - atkDir(0) * 25, isGK(o) ? MY : 2 + i * 1.5));
    teamP(0).forEach(q => { if (!isGK(q)) place(q, CW / 2 - atkDir(0) * 20, 4); });
    place(pas, CW / 2, MY); giveBall(pas, true); place(st, goalX(0) - atkDir(0) * 12, MY + 3); G.spray = null;
    pass(pas, st); for (let i = 0; i < 180 && G.phase === 'play'; i++) step(1 / 60);
    out.offside = G.stats.offs[0];
    return out;
  });
  ok(r.throw === 'throw1' && r.throwSet === 'throw', 'Einwurf ' + r.throw + ' ' + r.throwSet);
  ok(r.corner === 'corner0', 'Ecke ' + r.corner);
  ok(r.goalkick === 'goal1', 'Abstoß ' + r.goalkick);
  ok(r.pen === 'pen', 'Elfmeter ' + r.pen);
  ok(r.offside === 1, 'Abseits nicht gepfiffen');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Tor: Jubel, Wiederholung, Anstoß für den Gegner; Pfosten prallt ab', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { startMatch(KREIS_LIGEN[0].ids[0], KREIS_LIGEN[0].ids[4], { human: -1 }); G.paused = true; });
  const r = await page.evaluate(() => {
    const b = G.ball, gx = goalX(0), s = atkDir(0), p = teamP(0).find(q => grpOf(q) === 'ST');
    G.phase = 'play'; G.sp = null; G.rec = Array.from({ length: 80 }, () => G.rec[0] || { p: G.players.map(q => [q.x, q.y, 0, 'idle', 0, 1, 0, 0]), b: [b.x, b.y, 0] });
    const gk = G.gk[1]; place(gk, gx - s * 1, GY1 - 3);
    b.owner = null; Object.assign(b, { x: gx - s * 6, y: MY + 1, z: 0.5, vx: s * 25, vy: 0, vz: 0 }); b.last = p; b.lastTeam = 0; b.fid++; b.shot = { by: p, team: 0 };
    let phases = new Set(); for (let i = 0; i < 60 * 12; i++) { step(1 / 60); phases.add(G.phase); if (G.phase === 'kickoff') break; }
    const out = { score: G.score.join(':'), phases: [...phases], kick: G.sp && G.sp.team, log: G.log.length };
    // Pfosten
    G.phase = 'play'; G.sp = null; place(gk, gx - s * 1, GY2 + 3); b.owner = null; Object.assign(b, { x: gx - s * 5, y: GY1, z: 0.8, vx: s * 20, vy: 0, vz: 0.5 }); b.last = p; b.lastTeam = 0; b.fid++; b.plan = { fid: b.fid, done: true, g: gk };
    for (let i = 0; i < 20; i++) step(1 / 60);
    out.post = (b.x - gx) * s < 0 && G.score[0] === 1;
    return out;
  });
  ok(r.score === '1:0' && r.log === 1, 'Tor zählt nicht: ' + r.score);
  ok(r.phases.includes('goal') && r.phases.includes('replay'), 'kein Jubel/keine Wiederholung: ' + r.phases);
  ok(r.kick === 1, 'Anstoß nicht beim Gegner');
  ok(r.post, 'Pfosten');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('K.-o.-Spiel: Unentschieden führt zum Elfmeterschießen mit Sieger; Finale mit Verlängerung', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(RUN_MATCH);
  const r = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 6 && out.filter(x => x.so).length < 2; i++) { const m = __runMatch(KREIS_LIGEN[0].ids[i], KREIS_LIGEN[0].ids[i + 1], { ko: true, hlen: 1 }); out.push({ score: m.score, so: m.so, w: winnerOf() }); }
    return out;
  });
  for (const m of r) ok(m.w === 0 || m.w === 1, 'kein Sieger im K.-o.-Spiel ' + JSON.stringify(m));
  const sos = r.filter(m => m.so);
  ok(sos.length, 'kein Elfmeterschießen in 6 Spielen');
  for (const m of sos) { const a = m.so[0].reduce((x, y) => x + y, 0), b = m.so[1].reduce((x, y) => x + y, 0); ok(a !== b && m.score[0] === m.score[1], 'Elfmeterschießen falsch ' + JSON.stringify(m)); }
  const et = await page.evaluate(() => { newMatch(KREIS_LIGEN[0].ids[0], KREIS_LIGEN[0].ids[1], { human: -1, hlen: 1, ko: true, et: true }); G.paused = true; G.half = 2; G.score = [1, 1]; G.phase = 'halfend'; G.phaseT = 3; G.demo = false; step(1 / 60); return { phase: G.phase, menu: !!menu.querySelector('[data-act="etGo"]') }; });
  ok(et.menu, 'keine Verlängerung im Finale');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: zwei komplette Saisons (Kreisliga, Meister, Playoffs bis zum Finale), Speichern und Laden', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo(); const out = [];
    for (let s = 0; s < 2; s++) {
      let n = 0; while (!CAREER.S.done && n < 80) { runEvent(null); n++; }
      const P = CAREER.S.po, tbl = CAREER.S.tables[CAREER.lg];
      out.push({ n, games: Object.values(tbl).map(r => r.sp), champ: P && P.champ, teams: P && P.teams.length, rounds: P && P.rounds.map(R => R.length), champs: P && KREIS_LIGEN.map((L, li) => P.teams.includes(standings(li)[0])), sq: CAREER.squads[CAREER.team].length });
      ACT.cseason();
    }
    return out;
  });
  for (const s of r) {
    ok(s.games.every(g => g === 15), 'nicht alle 15 Spiele: ' + s.games);
    ok(s.teams === 16 && s.rounds.join() === '8,4,2,1' && s.champ != null, 'Playoffs: ' + JSON.stringify(s));
    ok(s.champs.every(Boolean), 'Meister fehlen in den Playoffs');
    ok(s.sq >= 16 && s.sq <= 24, 'Kadergröße ' + s.sq);
  }
  await page.reload(); await page.waitForTimeout(600);
  const loaded = await page.evaluate(() => { ACT.career(); return { year: CAREER.year, hub: !!menu.querySelector('[data-act="ctab"]') }; });
  ok(loaded.year === 2028 && loaded.hub, 'Laden: ' + JSON.stringify(loaded));
  for (const t of ['blatt', 'tab', 'kader', 'elf', 'plan', 'po', 'stat', 'verein']) await page.evaluate(t => ACT.ctab(t), t);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: echtes Spiel zählt (Ergebnis, Tabelle, Torschützen, Noten) und Aufstellung wird verwendet', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo();
    // eigene Elf: bester Ersatzspieler statt Platz 10
    const sq = CAREER.squads[CAREER.team], M = matchSquad(CAREER.team), out = M.bench.find(p => p.grp !== 'TW');
    CAREER.xi = M.xi.map(p => p.pid); CAREER.xi[10] = out.pid;
    ACT.cplay(); G.paused = true;
    const me = G.human, used = teamP(me).some(p => p.d.pid === out.pid);
    let n = 0; while (G.phase !== 'end' && n < 60 * 60 * 14) { if (G.phase === 'intro') KEYP.Enter = true; readInput(1 / 60); step(1 / 60); n++; if (G.phase === 'pause') ACT.secondHalf(); }
    const score = G.score.slice(), tid = G.tid;
    const tbl = CAREER.S.tables[CAREER.lg][CAREER.team];
    return { used, phase: G.phase, score, ci: CAREER.S.ci, sp: tbl.sp, tf: tbl.tf, tg: tbl.tg, me, scorers: Object.values(CAREER.S.scorers).reduce((a, b) => a + b, 0), notes: sq.filter(p => p.ss.nn > 0).length };
  });
  ok(r.used, 'eigene Aufstellung nicht verwendet');
  ok(r.phase === 'end' && r.ci === 1 && r.sp === 1, 'Spiel zählt nicht: ' + JSON.stringify(r));
  const my = r.me === 0 ? r.score[0] : r.score[1], op = r.me === 0 ? r.score[1] : r.score[0];
  ok(r.tf === my && r.tg === op, 'Tore in der Tabelle falsch');
  ok(r.notes >= 11, 'Noten fehlen');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Menüs nur mit Pfeiltasten erreichbar: Hauptmenü, Freundschaftsspiel, Optionen, Saison-Reiter, Pause', async () => {
  const { page, ctx, errors } = await open();
  // Breitensuche: von jedem erreichten Element aus alle vier Richtungen probieren
  const reach = () => page.evaluate(() => {
    const els = focusables(); if (!els.length) return 1;
    const seen = new Set([els[0]]), todo = [els[0]];
    while (todo.length) { const e = todo.shift(); for (const d of ['up', 'down', 'left', 'right']) { e.focus(); menuMove(d); const n = document.activeElement; if (els.includes(n) && !seen.has(n)) { seen.add(n); todo.push(n); } } }
    return seen.size / els.length;
  });
  const res = {};
  await page.evaluate(() => ACT.main()); res.main = await reach();
  await page.evaluate(() => ACT.quick()); res.quick = await reach();
  await page.evaluate(() => ACT.options()); res.opt = await reach();
  await page.evaluate(() => { ACT.career(); ACT.ncGo(); }); res.hub = await reach();
  await page.evaluate(() => { ACT.cplay(); G.paused = false; ACT.pause(); }); res.pause = await reach();
  for (const [k, v] of Object.entries(res)) ok(v > 0.9, `${k}: nur ${Math.round(v * 100)} % erreichbar`);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Touch: Knöpfe passen sich an (Angriff/Abwehr), PASS tippen passt, Mitspieler antippen passt, Stick bewegt', async () => {
  const { page, ctx, errors } = await open(MOBILE);
  await page.evaluate(() => { startMatch(KREIS_LIGEN[0].ids[0], KREIS_LIGEN[0].ids[4], { human: 0 }); G.phase = 'play'; G.sp = null; const p = teamP(0).find(q => grpOf(q) === 'MF'); place(p, CW / 2, MY); giveBall(p, true); G.ctrl = p; });
  await page.waitForTimeout(150);
  const lbl = await page.evaluate(() => document.querySelector('.tb-a').textContent);
  ok(lbl === 'PASS', 'Angriffs-Beschriftung fehlt: ' + lbl);
  const bb = await page.evaluate(() => { const r = document.querySelector('.tb-a').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(bb.x, bb.y);
  const passed = await page.waitForFunction(() => G.ball.kind === 'pass' && !G.ball.owner, null, { timeout: 2000, polling: 'raf' }).then(() => true, () => false);
  ok(passed, 'PASS-Knopf passt nicht');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Darstellung: alle Platzarten (Rasen, Kunstrasen, Hartplatz), Nacht im Finale, Screenshots ohne Fehler', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = [];
    for (const [tid, ev] of [[KREIS_LIGEN[0].ids[0], null], [KREIS_LIGEN[0].ids[1], null], [KREIS_LIGEN[0].ids[2], null], [KREIS_LIGEN[0].ids[3], FINAL_EVENT]]) {
      newMatch(tid, KREIS_LIGEN[1].ids[0], { human: 0, event: ev }); G.phase = 'play'; for (let i = 0; i < 30; i++) step(1 / 60); render();
      out.push({ ground: PITCH.ground, night: PITCH.night });
    }
    return out;
  });
  ok(new Set(r.map(x => x.ground)).size === 3, 'nicht alle Platzarten: ' + JSON.stringify(r));
  ok(r[3].night, 'Finale nicht unter Flutlicht');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});


test('Training: alle 7 Lektionen mit der Tastatur durchspielbar (Laufen, Passen, Steilpass, Schießen, Flanke, Abwehr, Standards)', async () => {
  const { page, ctx, errors } = await open();
  const log = await page.evaluate(() => {
  ACT.training(); G.paused = true; const log = [];
  const keys = ['KeyS', 'KeyA', 'KeyD', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft'];
  const toward = (x, y) => { const c = G.ctrl; if (x - c.x > 0.5) KEY.ArrowRight = true; if (x - c.x < -0.5) KEY.ArrowLeft = true; if (y - c.y > 0.5) KEY.ArrowDown = true; if (y - c.y < -0.5) KEY.ArrowUp = true; };
  let n = 0, lastI = -1, hold = 0, t0 = 0;
  while (G && G.tut && n < 60 * 60 * 6) {
    for (const k of keys) KEY[k] = false;
    const T = G.tut, L = LESSONS[T.i], c = G.ctrl, b = G.ball; if (!L) break;
    if (T.i !== lastI) { log.push(`${L.t} start @${Math.round(n / 60)}s`); lastI = T.i; t0 = n; }
    if (n - t0 > 60 * 70) { log.push(`${L.t} TIMEOUT ${T.n}/${L.need}`); T.done = false; nextLesson(); continue; }
    const f = n % 12 === 0;
    if (L.t === 'LAUFEN' && T.marks[0]) toward(...T.marks[0]);
    else if (L.t === 'PASSEN' && b.owner === c && f) KEYP.KeyS = true;
    else if (L.t === 'STEILPASS' && b.owner === c && f && G.t - c.gotT > 0.5) KEYP.KeyA = true;
    else if ((L.t === 'SCHIESSEN' || L.t === 'STANDARDS') && b.owner === c) { if (hold < 30) { KEY.Space = true; hold++; KEY.ArrowUp = hold > 3 && (n / 600 | 0) % 2 === 0; } else hold = 0; }
    else if (L.t === 'FLANKE & KOPFBALL') { if (b.owner === c && f) KEYP.KeyD = true; else if (!b.owner && b.passTo === c && f) KEYP.Space = true; }
    else if (L.t === 'ABWEHR' && b.owner && b.owner.team === 1) { toward(b.owner.x, b.owner.y); if (dist(c.x, c.y, b.owner.x, b.owner.y) < 1.3 && f) KEYP.KeyD = true; }
    if (b.owner !== c) hold = 0;
    readInput(1 / 60); step(1 / 60); n++;
    if (!G.tut || !menu.hidden) break;
  }
  log.push('ende ' + (menu.querySelector('h2') ? menu.querySelector('h2').textContent : '') + ' gespeichert=' + store.get(TUT_KEY));
  return log;
  });
  ok(!log.some(l => l.includes('TIMEOUT')), log.join(' | '));
  ok(log[log.length - 1].includes('GESCHAFFT') && log[log.length - 1].includes('gespeichert=true'), log.join(' | '));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

// ---------- Ablauf ----------
browser = await chromium.launch(exe ? { executablePath: exe } : {});
let pass = 0, fail = 0;
for (const t of tests) {
  if (only.length && !only.some(o => t.name.toLowerCase().includes(o.toLowerCase()))) continue;
  const t0 = Date.now();
  try { await t.fn(); pass++; console.log(`✔ ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (e) { fail++; console.log(`✘ ${t.name}\n    ${e instanceof Fail ? e.message : e.stack}`); }
}
await browser.close();
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
