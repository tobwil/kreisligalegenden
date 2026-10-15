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

test('Vereine: alle Landesverbände und Kreise, eindeutige Kürzel je Kreis, Kader mit 18 Spielern, Coburg von Hand gestaltet', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const dupK = [], bad = [], shortBad = [];
    for (const K of KREISE) { const ks = K.ligen.flatMap(l => LIGEN[l].ids.map(i => TEAMS[i].k)); ks.forEach((k, i) => { if (ks.indexOf(k) !== i || !/^[A-Z0-9]{3}$/.test(k)) dupK.push(K.n + ':' + k); }); }
    for (let i = 0; i < TEAMS.length; i += 13) { const t = TEAMS[i], ro = roster(t.id), nums = ro.map(p => p.num); if (ro.length !== 18 || new Set(nums).size !== 18 || ro.filter(p => p.grp === 'TW').length < 2) bad.push(t.n); }
    for (const t of TEAMS) if (!t.short || t.short.length > 21 || !(t.r >= 55 && t.r <= 76) || ![0, 1, 2].includes(t.ground)) shortBad.push(t.n + '>' + t.short);
    const cob = LIGEN[TEAMS[HOME_TEAM].lg];
    return { verb: VERB.length, kreise: KREISE.length, teams: TEAMS.length, small: LIGEN.filter(L => L.ids.length < 6).length, dupK, bad, shortBad, cob: cob.ids.length, names: cob.ids.map(i => TEAMS[i].n), k: TEAMS[HOME_TEAM].k, map: MAPV.filter(v => v < 0).length };
  });
  ok(r.verb >= 11 && r.kreise >= 100 && r.teams >= 2000, 'zu wenige Daten: ' + JSON.stringify([r.verb, r.kreise, r.teams]));
  ok(!r.small, 'Ligen mit weniger als 6 Vereinen');
  ok(!r.dupK.length, 'doppelte Kürzel: ' + r.dupK.slice(0, 10));
  ok(!r.bad.length, 'Kader fehlerhaft: ' + r.bad.slice(0, 10));
  ok(!r.shortBad.length, 'Kurzname/Stärke/Platz fehlerhaft: ' + r.shortBad.slice(0, 10));
  ok(r.cob === 16 && r.k === 'STA' && r.names.includes('SV Bosporus Coburg'), 'Coburg: ' + JSON.stringify(r.names));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Vereinsauswahl: Karte -> Landesverband -> Kreis -> Verein, Suche mit höchstens 8 Treffern, höchstens 45 Knöpfe je Stufe', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = {}, cnt = () => menu.querySelectorAll('.picker button').length;
    ACT.quick(); ACT.pkTop(); out.top = cnt(); out.map = !!document.getElementById('pkmap');
    let maxBtn = 0;
    for (let v = 0; v < VERB.length; v++) { ACT.pkV(v); maxBtn = Math.max(maxBtn, cnt()); for (const k of VERB[v].kreise.slice(0, 2)) { ACT.pkK(k); maxBtn = Math.max(maxBtn, cnt()); } }
    out.maxBtn = maxBtn;
    // Karte anklicken: Mitte von Bayern
    ACT.pkTop(); const cv = document.getElementById('pkmap'), bay = VERB.findIndex(V => V.n === 'Bayern'), [cx, cy] = mapCenter(bay), rc = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rc.left + (cx + 0.5) / KARTE.w * rc.width, clientY: rc.top + (cy + 0.5) / KARTE.h * rc.height }));
    out.click = PK.v === bay;
    // Kreis und Verein wählen: Gegner aus dem Allgäu
    const k = VERB[bay].kreise[0]; ACT.pkK(k); const tid = LIGEN[KREISE[k].ligen[0]].ids[3];
    menu.querySelector(`[data-act="qpick"][data-arg="${tid}"]`).click();
    out.picked = QUICK.a === tid && QUICK.side === 'b';
    const q = document.getElementById('pkq'); q.value = 'Staffel'; q.dispatchEvent(new Event('input'));
    out.hits = [...menu.querySelectorAll('#pkbody [data-act="qpick"]')].map(b => TEAMS[+b.dataset.arg].n);
    q.value = 'SV'; q.dispatchEvent(new Event('input')); out.many = menu.querySelectorAll('#pkbody [data-act="qpick"]').length;
    menu.querySelector('#pkbody [data-act="qpick"]').click(); out.b = QUICK.b !== HOME_TEAM && QUICK.side === 'b';
    return out;
  });
  ok(r.map && r.top <= 30, 'Startseite: ' + JSON.stringify(r));
  ok(r.maxBtn <= 45, 'zu viele Knöpfe auf einer Stufe: ' + r.maxBtn);
  ok(r.click, 'Klick auf die Karte wählt Bayern nicht');
  ok(r.picked && r.b, 'Verein wählen klappt nicht');
  ok(r.hits.includes('TSV 1860 Staffelstein'), 'Suche findet Staffelstein nicht: ' + r.hits);
  ok(r.many === 8, 'Suche begrenzt nicht auf 8: ' + r.many);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('CPU gegen CPU: komplette Spiele ohne Hänger, plausible Ergebnisse, Schüsse, Pässe, Zweikämpfe', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(RUN_MATCH);
  const res = await page.evaluate(() => [0, 1, 2, 3].map(i => __runMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[i], LIGEN[TEAMS[HOME_TEAM].lg + 1].ids[15 - i])));
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

test('Tastatur (Standard Legenden): Enter, Intro, Anstoß mit S, Pfeile laufen, Leertaste lädt und schießt, Esc pausiert', async () => {
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

test('Aktionen in den Belegungen Legenden, EA FC und WASD: Pass, Steilpass, Flanke, Haken, Tackling, Grätsche', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; });
  for (const [lay, K] of [['legenden', { a: 'KeyS', k: 'KeyD', c: 'KeyA', f: 'KeyF', b: 'Space', tk: 'KeyD', sl: 'Space' }], ['fc', { a: 'KeyS', k: 'KeyW', c: 'KeyA', f: 'KeyQ', b: 'KeyD' }], ['wasd', { a: 'KeyK', k: 'KeyI', c: 'KeyJ', f: 'KeyU', b: 'KeyL' }]]) {
  const r = await page.evaluate(([lay, K]) => {
    SETTINGS.keys = lay;
    const setup = (wing) => { G.phase = 'play'; G.sp = null; G.ball.passTo = null; const p = teamP(0).find(q => grpOf(q) === 'MF'); p.cd = 0; p.act = null; p.stun = 0; place(p, wing ? goalX(0) - atkDir(0) * 20 : CW / 2, wing ? 6 : MY); giveBall(p, true); G.ctrl = p; return p; };
    const press = k => { KEY[k] = true; KEYP[k] = true; readInput(1 / 60); KEY[k] = false; humanControl(1 / 60); readInput(1 / 60); humanControl(1 / 60); };   // Pass geht beim Loslassen
    const out = {};
    setup(); press(K.a); out.pass = G.ball.kind;
    setup(); press(K.k); out.through = G.ball.kind;
    setup(true); press(K.c); out.cross = G.ball.kind;
    const p = setup(); press(K.f); out.trick = p.act && p.act.type;
    // Abwehr: Gegner am Ball
    G.phase = 'play'; const o = teamP(1).find(q => grpOf(q) === 'MF'), d = teamP(0).find(q => grpOf(q) === 'AB');
    place(o, CW / 2, MY); giveBall(o, true); place(d, CW / 2 + 0.9, MY); d.cd = 0; G.ctrl = d; d.hx = -1; d.hy = 0;
    press(K.tk || K.b); out.tackle = d.act && d.act.type;
    d.cd = 0; d.act = null; d.stun = 0; place(d, CW / 2 + 2, MY); if (G.ball.owner !== o) { place(o, CW / 2, MY); giveBall(o, true); } G.ctrl = d;
    press(K.sl || K.c); out.slide = d.act && d.act.type;
    return out;
  }, [lay, K]);
  ok(r.pass === 'pass' && r.through === 'through' && r.cross === 'cross' && r.trick === 'trick' && ['tackle', 'stumble'].includes(r.tackle) && r.slide === 'slide', lay + ' ' + JSON.stringify(r));
  }
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Tastatur: Pass antippen = kurz zum nahen Mitspieler, halten = fester und weiter (Balken), Pass geht beim Loslassen', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const s = atkDir(0), mf = teamP(0).filter(q => grpOf(q) === 'MF'), [p, near, far] = mf;
    const frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    const setup = () => { for (const o of opps(p)) if (!isGK(o)) place(o, CW / 2 - s * 30, 3); for (const m of mates(p)) if (!isGK(m)) place(m, CW / 2 - s * 25, CH - 3);
      place(p, CW / 2, MY); place(near, CW / 2 + s * 9, MY); place(far, CW / 2 + s * 27, MY + 1); p.cd = 0; G.ctrl = p; giveBall(p, true); for (const k in KEY) KEY[k] = false; KEY[s > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; frame(); };   // Richtung zum Tor
    const out = {};
    setup(); KEY.KeyS = KEYP.KeyS = true; frame(); out.notYet = G.ball.owner === p; KEY.KeyS = false; frame(); out.tap = G.ball.passTo === near;
    setup(); KEY.KeyS = KEYP.KeyS = true; for (let i = 0; i < 50; i++) frame(); out.bar = p.passHold != null && passHoldPow(p) > 0.8; render();
    KEY.KeyS = false; frame(); out.hold = G.ball.passTo === far;
    return out;
  });
  ok(r.notYet && r.tap, 'Antippen spielt nicht kurz zum nahen Mitspieler: ' + JSON.stringify(r));
  ok(r.bar && r.hold, 'Halten spielt nicht fest zum weiten Mitspieler: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Passannahme: der angespielte Mitspieler nimmt den Ball an, auch wenn die Pfeiltaste noch gedrückt ist', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = { ok: 0, n: 0, lost: [] };
    for (let trial = 0; trial < 48; trial++) {
      startMatch(L[0], L[5], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
      const ps = teamP(0).filter(q => !isGK(q)), a = ps[3], q = ps[4];
      for (const o of G.players) if (o !== a && o !== q) place(o, o.team ? 90 : 10, 5 + o.i * 4);
      const d = 2.5 + (trial % 8) * 1.5, ang = (trial * 0.7) % 6.28, off = [0, 1.57, -1.57, 0.6][trial % 4], hx = Math.cos(ang + off), hy = Math.sin(ang + off);
      place(a, 50, 32); place(q, 50 + Math.cos(ang) * d, 32 + Math.sin(ang) * d); a.vx = a.vy = q.vx = q.vy = 0;
      giveBall(a, true); G.ctrl = a; pass(a, choosePass(a, Math.cos(ang), Math.sin(ang)));
      let got = null;
      for (let i = 0; i < 180 && !got; i++) { G.frame++; G.t += 1 / 60; IN.x = hx; IN.y = hy; aiTeam(0, 1 / 60); aiTeam(1, 1 / 60); humanControl(1 / 60); moveAll(1 / 60); updateBall(1 / 60); passAssist(1 / 60); checkBlocks(); tryCollect(); if (G.ball.owner) got = G.ball.owner; }
      out.n++; if (got && got.team === 0) out.ok++; else out.lost.push(d);
    }
    IN.x = IN.y = 0; return out;
  });
  ok(r.ok >= r.n - 1, `nur ${r.ok}/${r.n} Pässe angekommen, verloren bei ${r.lost}`);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Keine ungewollte Aktion bei der Annahme: gehaltene Tackling-Taste schießt nicht, Tasten vor einem losen Ball merken nichts vor', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'wasd';
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const d = teamP(0).find(q => grpOf(q) === 'AB'), out = {};
    const frame = () => { readInput(1 / 60); humanControl(1 / 60); };
    // Tackling-Taste (L) gehalten, dabei den Ball gewinnen, dann loslassen: kein Schuss
    place(d, CW / 2, MY); G.ctrl = d; const s0 = G.stats.shots[0];
    KEY.KeyL = true; KEYP.KeyL = true; frame(); giveBall(d, true); for (let i = 0; i < 40; i++) frame(); KEY.KeyL = false; frame(); frame();
    out.shot = G.stats.shots[0] !== s0; out.owner = G.ball.owner === d;
    // loser Ball 2 m vor dem Spieler, Pass-Taste (K): nichts vormerken
    G.ball.owner = null; G.ball.passTo = null; G.ball.x = d.x + 2; G.ball.y = d.y; G.ball.vx = G.ball.vy = 0; d.queue = null;
    KEYP.KeyK = true; frame(); out.queue = d.queue;
    return out;
  });
  ok(!r.shot && r.owner, 'gehaltene Tackling-Taste löst nach dem Ballgewinn einen Schuss aus');
  ok(!r.queue, 'Pass-Taste vor losem Ball merkt einen Direktpass vor');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Zu zweit: miteinander (zwei Menschen, zwei verschiedene Spieler, geteilte Tastatur) und gegeneinander (je eine Mannschaft)', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {}, frame = () => { readInput(1 / 60); readSlots(1 / 60); step(1 / 60); };
    startMatch(L[0], L[1], { human: 0, mp: 'coop', mpIn: 0 }); G.paused = true; KEYP.Enter = true; frame(); for (let i = 0; i < 30; i++) frame();
    G.phase = 'play'; G.sp = null; for (const s of G.pl) s.ctrl = null; mpFix();
    out.coop = G.pl.every(s => s.ctrl && s.ctrl.team === 0) && G.pl[0].ctrl !== G.pl[1].ctrl;
    const b = G.pl[1].ctrl, bx = b.x; KEY.ArrowRight = true; for (let i = 0; i < 30; i++) frame(); KEY.ArrowRight = false;
    out.p2moves = G.pl[1].ctrl === b && Math.abs(b.x - bx) > 1.5;
    const p1 = G.pl[0].ctrl; place(p1, CW / 2, MY); giveBall(p1, true); const ps0 = G.stats.passes[0]; KEY.KeyF = true; frame(); KEY.KeyF = false; frame();
    out.pass = G.stats.passes[0] > ps0;
    for (let i = 0; i < 300; i++) frame(); out.unique = G.pl[0].ctrl !== G.pl[1].ctrl;
    startMatch(L[0], L[1], { human: 0, mp: 'vs', mpIn: 0 }); G.paused = true; KEYP.Enter = true; frame();
    for (let i = 0; i < 60 * 15; i++) { if (i % 80 === 0) { KEY.KeyG = !KEY.KeyG; KEY.KeyK = !KEY.KeyK; } frame(); if (G.phase === 'pause') nextHalf(); }
    out.vs = G.pl.map(s => s.ctrl && s.ctrl.team).join(',') === '0,1';
    return out;
  });
  ok(r.coop, 'zu zweit miteinander: Spieler nicht getrennt');
  ok(r.p2moves, 'Spieler 2 (Pfeile) läuft nicht');
  ok(r.pass && r.unique, 'Pass zu zweit / gleicher Spieler doppelt gesteuert');
  ok(r.vs, 'gegeneinander: Mannschaften falsch');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Tricks: Richtung entscheidet (Haken, Zurückziehen, Tempo-Dribbling, Übersteiger), Handy: Stick kreisen, schnippen, doppelt antippen; Flitzer unterbricht und es geht weiter', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const c = teamP(0).find(q => grpOf(q) === 'MF'), s = atkDir(0);
    const kinds = [[0, 1], [-s, 0], [s, 0], [0, 0]].map(([x, y]) => { place(c, CW / 2, MY); c.hx = s; c.hy = 0; c.cd = 0; giveBall(c, true); trick(c, x, y); return c.act && c.act.kind; });
    out.kinds = kinds.join(',');
    // Handy: Tricks über den Stick, Wischen rechts macht keinen Trick mehr
    const z = document.getElementById('zone'), W = innerWidth, H = innerHeight, cx = W * 0.2, cy = H * 0.55;
    const ev = (t, x, y, id) => z.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    const prep = () => { for (const o of opps(c)) if (!isGK(o)) place(o, CW / 2 + s * 30, 3); place(c, CW / 2, MY); c.hx = s; c.hy = 0; c.cd = 0; c.act = null; c.stun = 0; G.ctrl = c; giveBall(c, true); TOUCH.fdir = null; TOUCH.pulseF = 0; STG.lastTap = 0; readInput(1 / 60); };
    const fire = () => { readInput(1 / 60); humanControl(1 / 60); return c.act && c.act.type === 'trick' ? c.act.kind : '-'; };
    const g = [];
    prep(); ev('pointerdown', cx, cy, 11); for (let i = 0; i <= 26; i++) { const a = i / 24 * 2 * Math.PI; ev('pointermove', cx + 40 * Math.cos(a), cy + 40 * Math.sin(a), 11); } ev('pointerup', cx + 40, cy, 11); g.push(fire());
    prep(); place(opps(c).find(o => !isGK(o)), c.x + s * 3, MY + 2);
    ev('pointerdown', cx, cy, 12); ev('pointermove', cx + s * 40, cy, 12); ev('pointermove', cx, cy + 2, 12); ev('pointermove', cx - s * 40, cy, 12); ev('pointerup', cx - s * 40, cy, 12); g.push(fire());
    prep(); const tx = W * 0.03, ty = H * 0.97; ev('pointerdown', tx, ty, 13); ev('pointerup', tx, ty, 13); ev('pointerdown', tx, ty, 14); ev('pointerup', tx, ty, 14); g.push(fire());
    prep(); ev('pointerdown', W * 0.8, H * 0.5, 15); ev('pointermove', W * 0.8 + 60, H * 0.5, 15); ev('pointerup', W * 0.8 + 60, H * 0.5, 15); g.push(fire());
    out.touch = g.join(',');
    // Flitzer erzwingen: Spiel steht, Uhr steht, danach Freistoß
    startMatch(L[0], L[1], { human: 0, flitzer: 1 }); G.paused = true; G.flitzer.half = 1; G.flitzer.at = 1; G.phase = 'play'; G.sp = null;
    let seen = false, clk = null, n = 0;
    for (; n < 60 * 30; n++) { step(1 / 60); if (G.phase === 'flitzer') { if (!seen) clk = G.clock; seen = true; render(); } else if (seen) break; }
    out.flitzer = seen && G.flitzer.done && G.phase === 'setpiece' && Math.abs(G.clock - clk) < 0.05;
    return out;
  });
  ok(r.kinds === 'haken,zurueck,tempo,ueber', 'Tricks: ' + r.kinds);
  ok(r.touch === 'drehung,zurueck,ueber,-', 'Handy-Tricks (kreisen, schnippen, doppelt antippen, wischen rechts): ' + r.touch);
  ok(r.flitzer, 'Flitzer läuft nicht sauber durch');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Abschluss: Zielkreuz beim Aufladen, Antippen schießt platziert, Schlenzer und Heber beim Aufladen, Treffer-Stopp', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const c = teamP(0).find(q => grpOf(q) === 'ST'), s = atkDir(0), gx = goalX(0), out = {};
    const frame = () => { readInput(1 / 60); humanControl(1 / 60); };
    const setup = () => { G.ball.shot = null; place(c, gx - s * 17, MY + 4); c.cd = 0; c.charge = 0; c.chargeArm = false; G.ctrl = c; giveBall(c, true); for (const k in KEY) KEY[k] = false; frame(); };
    // antippen: platzierter, flacher Schuss
    setup(); KEY.Space = true; KEYP.Space = true; frame(); KEY.Space = false; frame();
    out.tap = G.ball.shot && G.ball.shot.by === c && G.ball.z < 1.2 && G.ball.vz < 6;
    // halten: Ladebalken und Zielkreuz werden gezeichnet
    setup(); KEY.Space = true; KEYP.Space = true; for (let i = 0; i < 20; i++) frame(); out.charge = c.charge > 0.4 && c.charge < 0.93; render(); out.drawn = true;
    // beim Aufladen S = Schlenzer
    KEYP.KeyS = true; KEY.KeyS = true; frame(); KEY.KeyS = false; KEY.Space = false; frame();
    out.fin = !!(G.ball.shot && G.ball.shot.finesse);
    // beim Aufladen D = Heber
    setup(); KEY.Space = true; KEYP.Space = true; for (let i = 0; i < 12; i++) frame(); KEYP.KeyA = true; KEY.KeyA = true; frame(); KEY.KeyA = false; KEY.Space = false; frame();
    out.chip = !!(G.ball.shot && G.ball.shot.chip) && G.ball.vz > 4;
    // Hammer: kurzer Treffer-Stopp
    setup(); G.hitStop = 0; KEY.Space = true; KEYP.Space = true; for (let i = 0; i < 40; i++) frame(); KEY.Space = false; frame();
    out.stop = G.hitStop > 0; const x0 = G.ball.x; gameTick(1 / 60); out.frozen = G.ball.x === x0;
    return out;
  });
  ok(r.tap, 'Antippen schießt nicht platziert');
  ok(r.charge && r.drawn, 'Aufladen/Zielkreuz');
  ok(r.fin, 'Schlenzer beim Aufladen mit der Pass-Taste');
  ok(r.chip, 'Heber beim Aufladen mit der Flanken-Taste');
  ok(r.stop && r.frozen, 'kein Treffer-Stopp beim Hammer');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Arcade-Hilfen: Pass in Stickrichtung zum freien Mann, Gegner in der Passlinie greift nicht immer zu, Ball spitzeln, Doppelpass-Lauf', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const s = atkDir(0), out = {}, mf = teamP(0).filter(q => grpOf(q) === 'MF'), [p, q1, q2] = mf, opp = teamP(1).filter(q => !isGK(q));
    for (const o of opps(p)) if (!isGK(o)) place(o, CW / 2 + s * 38, 2);
    for (const m of mates(p)) if (!isGK(m)) place(m, CW / 2 - s * 25, CH - 2);
    place(p, CW / 2, MY); place(q1, CW / 2 + s * 12, MY - 3); place(q2, CW / 2 + s * 12, MY + 3); G.ctrl = p; giveBall(p, true);
    // q1 eng gedeckt, q2 frei: Pass nach vorne geht an q2
    place(opp[0], CW / 2 + s * 10.5, MY - 2.6);
    out.free = choosePass(p, s, 0) === q2;
    // Gegner steht in der Passlinie: mit Pech greift er daneben (Zufall festgesetzt)
    place(opp[0], CW / 2 + s * 6, MY + 1.5);
    const rnd0 = Math.random; Math.random = () => 0.99;
    pass(p, q2); out.gg = !!(p.run && p.run.gg);
    let got = null; for (let i = 0; i < 90 && !got; i++) { step(1 / 60); got = G.ball.owner; }
    Math.random = rnd0; out.through = got === q2;
    // Spitzeln: dein Verteidiger läuft dem Ballführer vor die Füße
    const a = opp[1], d = teamP(0).find(q => grpOf(q) === 'AB'); place(a, CW / 2, MY); a.hx = s; a.hy = 0; giveBall(a, true); a.gotT = G.t - 1;
    place(d, G.ball.x + s * 0.3, G.ball.y); d.cd = 0; G.ctrl = d; let won = false;
    for (let i = 0; i < 240 && !won; i++) { G.manT = G.t; IN.x = IN.y = 0; humanControl(1 / 60); won = G.ball.owner !== a; if (!won) { place(d, G.ball.x + s * 0.3, G.ball.y); d.act = null; G.t += 1 / 60; } }
    out.poke = won;
    return out;
  });
  ok(r.free, 'Pass in Stickrichtung geht an den gedeckten statt an den freien Mitspieler');
  ok(r.gg, 'nach dem Pass startet der Passgeber keinen Doppelpass-Lauf');
  ok(r.through, 'Gegner in der Passlinie fängt trotz Fehlgriff ab');
  ok(r.poke, 'Verteidiger spitzelt den Ball nicht weg');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Zielansicht: Freistoß und Elfmeter mit Kamera hinter dem Ball, Fadenkreuz, Kraft, Mauer springt, Ansicht folgt dem Ball', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = {};
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play';
    const s = atkDir(0), gx = goalX(0); setupSetPiece('free', 0, gx - s * 21, MY + 4);
    for (let i = 0; i < 120 && !(G.sp && G.sp.aim); i++) { readInput(1 / 60); step(1 / 60); }
    out.on = aimViewOn(); out.wall = G.players.filter(p => p.wall).length;
    render(); out.drawn = true;
    const u0 = G.sp && G.sp.aim ? G.sp.aim.u : null;
    // Fadenkreuz nach rechts schieben und hoch, dann mit wenig Kraft schießen
    KEY.ArrowRight = true; KEY.ArrowUp = true; for (let i = 0; i < 20; i++) { readInput(1 / 60); step(1 / 60); } KEY.ArrowRight = false; KEY.ArrowUp = false;
    out.moved = G.sp && G.sp.aim && G.sp.aim.u > u0 && G.sp.aim.z > 1.1;
    const sh0 = G.stats.shots[0];
    KEY.Space = true; KEYP.Space = true; for (let i = 0; i < 25; i++) { readInput(1 / 60); step(1 / 60); } KEY.Space = false; readInput(1 / 60); step(1 / 60);
    out.shot = G.stats.shots[0] === sh0 + 1; out.fly = !!G.aimFly; out.jump = G.players.some(p => p.wall && p.z > 0.05);
    for (let i = 0; i < 10; i++) { step(1 / 60); render(); }
    out.stillOn = aimViewOn();
    for (let i = 0; i < 160; i++) { step(1 / 60); render(); }
    out.back = !aimViewOn();
    // Elfmeter
    G.phase = 'play'; setupSetPiece('pen', 0, 0, 0); for (let i = 0; i < 90 && !G.sp.aim; i++) { readInput(1 / 60); step(1 / 60); }
    out.pen = aimViewOn(); render();
    return out;
  });
  ok(r.on && r.wall >= 2, 'keine Zielansicht beim Freistoß: ' + JSON.stringify(r));
  ok(r.moved, 'Fadenkreuz bewegt sich nicht');
  ok(r.shot && r.fly && r.jump, 'Schuss/Mauer: ' + JSON.stringify(r));
  ok(r.stillOn && r.back, 'Ansicht folgt dem Ball nicht oder kehrt nicht zurück: ' + JSON.stringify(r));
  ok(r.pen, 'keine Zielansicht beim Elfmeter');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Flair: drei Aufgaben pro Spiel, Doppelpass erkannt, Kopfballtor mit eigenem Banner, Endstand mit Aufgaben, Erfolge-Menü', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = {};
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true;
    out.chal = G.chal && G.chal.length; render();
    G.phase = 'play'; G.sp = null;
    const ps = teamP(0).filter(q => !isGK(q)), a = ps[5], b = ps[6];
    // Doppelpass: a -> b -> a
    place(a, 50, 30); place(b, 50 + atkDir(0) * 6, 30); giveBall(a, true); pass(a, b); G.ball.x = b.x; G.ball.y = b.y; giveBall(b, true); place(a, 50 + atkDir(0) * 4, 33); pass(b, a); G.ball.x = a.x; G.ball.y = a.y; giveBall(a, true);
    out.dp = G.feats.some(f => f.k === 'doppelpass');
    // Kopfballtor von a
    const gx = goalX(0); place(a, gx - atkDir(0) * 8, MY); giveBall(a, true); a.gotT = G.t - 2;
    G.ball.owner = null; G.ball.shot = { by: a, team: 0, t0: G.t, d: 8, header: true }; G.ball.last = a; G.ball.lastTeam = 0; G.ball.kind = 'shot';
    scoreGoal(0, MY, 1.5);
    out.banner = G.banner && G.banner.txt; out.kopf = G.feats.some(f => f.k === 'goal-kopf');
    G.phase = 'end'; ACT.fulltime(); out.endChal = !!menu.querySelector('.chal'); out.lp = PROF.lp > 0; out.ach = !!PROF.ach.tor1 && !!PROF.ach.kopf;
    ACT.erfolge(); out.achs = menu.querySelectorAll('.ach').length; out.achOn = menu.querySelectorAll('.ach.on').length;
    return out;
  });
  ok(r.chal === 3, 'keine drei Aufgaben: ' + r.chal);
  ok(r.dp, 'Doppelpass nicht erkannt');
  ok(r.kopf && r.banner === 'KOPFBALLTOR!', 'Kopfballtor-Banner: ' + r.banner);
  ok(r.endChal && r.lp && r.ach, 'Endstand/Punkte/Erfolge: ' + JSON.stringify(r));
  ok(r.achs >= 20 && r.achOn >= 2, 'Erfolge-Menü: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Derby und Teilen: Erzrivale in der eigenen Liga, Derby-Spiel markiert, Derbysieg mit Prämie, Ergebnisbild 1080 × 1080', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(async () => {
    const out = {};
    ACT.career(); ACT.ncGo();
    const rv = rivalOf(); out.rival = rv != null && LIGEN[CAREER.lg].ids.includes(rv) && rv !== CAREER.team;
    out.coburg = TEAMS[rv].n;
    // bis zum Derby simulieren
    let n = 0; while (!myGame() || !isDerby(myGame().h, myGame().a)) { runEvent(null); if (++n > 40) break; }
    const g = myGame(); out.found = !!g && isDerby(g.h, g.a);
    const o = careerMatchOpts(false); out.label = o.career.label; out.derbyOpt = o.derby;
    const m0 = CAREER.money;
    runEvent({ gh: g.h === CAREER.team ? 3 : 0, ga: g.h === CAREER.team ? 0 : 3, live: null, goals: [] });
    out.prize = CAREER.money - m0 >= 500; out.news = CAREER.news.some(x => /DERBYSIEG/.test(x.h));
    // Ergebnisbild nach einem Freundschaftsspiel
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.score = [2, 1];
    G.log = [{ min: 12, team: 0, name: 'Müller', og: false }, { min: 40, team: 1, name: 'Schmidt', og: false }, { min: 77, team: 0, name: 'Bauer', pen: true }];
    const cv = resultCanvas(); out.size = cv.width + 'x' + cv.height;
    const px = cv.getContext('2d').getImageData(540, 300, 1, 1).data; out.paper = px[3] === 255;
    G.phase = 'end'; ACT.fulltime(); out.btn = !!menu.querySelector('[data-act="share"]');
    return out;
  });
  ok(r.rival, 'kein Erzrivale');
  ok(r.found && r.derbyOpt && /DERBY/.test(r.label), 'Derby nicht markiert: ' + JSON.stringify(r));
  ok(r.prize && r.news, 'Derbysieg ohne Prämie/Schlagzeile');
  ok(r.size === '1080x1080' && r.paper && r.btn, 'Ergebnisbild: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Regeln: Seitenaus gibt Einwurf, Toraus Ecke oder Abstoß, Foul im Strafraum Elfmeter, Abseits wird gepfiffen', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: -1 }); G.paused = true; });
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
  await page.evaluate(() => { startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: -1 }); G.paused = true; });
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

test('Vereinsstärke: alle starten gleich stark, nach einer Saison haben sich die Vereine auseinanderentwickelt', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const ids = []; for (let i = 0; i < TEAMS.length; i += Math.floor(TEAMS.length / 40)) ids.push(i);
    const ovr = ids.map(teamOvr), out = { min: Math.min(...ovr), max: Math.max(...ovr), base: TEAMS.every(t => t.r === KL_BASE) };
    ACT.career(); ACT.ncGo(); let n = 0; while (!CAREER.S.done && n < 120) { runEvent(null); n++; }
    ACT.cseason();
    const lv = Object.values(CAREER.lvl || {}); out.lvMin = Math.min(...lv); out.lvMax = Math.max(...lv);
    const str = LIGEN[CAREER.lg].ids.map(squadStr); out.sMin = Math.min(...str); out.sMax = Math.max(...str);
    return out;
  });
  ok(r.base && r.max - r.min <= 2, 'Startstärken unterschiedlich: ' + JSON.stringify(r));
  ok(r.lvMax - r.lvMin >= 2, 'Vereinsniveau entwickelt sich nicht: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Kopfball: Flanke auf deinen Stürmer im Strafraum, er läuft hin und köpft von selbst aufs Tor', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; let shots = 0, tries = 0;
    for (let k = 0; k < 8; k++) {
      startMatch(L[0], L[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null; for (const kk in KEY) KEY[kk] = false;
      const s = atkDir(0), gx = goalX(0), wing = teamP(0).find(q => grpOf(q) === 'MF'), st = teamP(0).find(q => grpOf(q) === 'ST');
      for (const q of G.players) if (!isGK(q)) place(q, q.team ? gx - s * 3 : CW / 2 - s * 20, q.team ? 3 : CH - 5);   // Gegner weit weg, aber kein Abseits
      place(wing, gx - s * 14, MY + 26); giveBall(wing, true); place(st, gx - s * 10, MY - 1); G.ctrl = wing; cross(wing, 0); tries++;
      const sh0 = G.stats.shots[0]; let hd = false;
      for (let i = 0; i < 200 && G.phase === 'play'; i++) { readInput(1 / 60); step(1 / 60); if (G.ball.shot && G.ball.shot.header && G.ball.shot.team === 0) hd = true; }
      if (hd && G.stats.shots[0] > sh0) shots++;
    }
    return { shots, tries };
  });
  ok(r.shots >= 5, `nur ${r.shots} von ${r.tries} Flanken wurden zum Kopfball aufs Tor`);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Abwehr-Kopfball: hoher Ball kommt, Tackling-Taste köpft in Stickrichtung weg, Pass-Taste zum Mitspieler; gelber Ring zeigt den Landepunkt', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const out = {}, s = atkDir(0), ox = ownX(0), d = teamP(0).find(q => grpOf(q) === 'AB'), a = teamP(1).find(q => grpOf(q) === 'ST');
    const frame = () => { readInput(1 / 60); step(1 / 60); };
    const fly = () => { for (const q of G.players) if (!isGK(q) && q !== d) place(q, CW / 2, q.team ? 4 : CH - 4); place(d, ox + s * 22, MY); G.ctrl = d; G.manT = G.t; d.cd = 0;
      const b = G.ball; b.owner = null; Object.assign(b, { x: ox + s * 22, y: MY - 14, z: 2.2, vx: 0, vy: 0, vz: 0 }); b.last = a; b.lastTeam = 1; b.fid++; b.kind = 'cross'; b.passer = a; b.passTo = null; b.shot = null;
      launchAir(ox + s * 22, MY, 1.8, 0.9); };
    fly(); render(); out.ring = true;
    KEY.ArrowRight = s > 0; KEY.ArrowLeft = s < 0; KEY.KeyD = true; KEYP.KeyD = true; frame(); KEY.KeyD = false; KEY.ArrowRight = KEY.ArrowLeft = false;   // Richtung beim Drücken, dann Stick los: er läuft zum Ball
    let hd = false; for (let i = 0; i < 70 && !hd; i++) { frame(); hd = G.ball.kind === 'head' && G.ball.last === d; }
    out.clear = hd && G.ball.vx * s > 3;
    fly(); KEY.KeyS = true; KEYP.KeyS = true; frame(); KEY.KeyS = false;
    hd = false; for (let i = 0; i < 70 && !hd; i++) { frame(); hd = G.ball.kind === 'head' && G.ball.last === d; }
    out.pass = hd && G.ball.passTo && G.ball.passTo.team === 0;
    return out;
  });
  ok(r.clear, 'Tackling-Taste köpft nicht nach vorn weg');
  ok(r.pass, 'Pass-Taste köpft nicht zum Mitspieler');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Touch: Knöpfe verdecken das Tor nicht, die Kamera schwenkt am Tor weiter hinaus', async () => {
  const { page, ctx, errors } = await open(MOBILE);
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; startMatch(L[0], L[1], { human: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    document.body.classList.add('ingame');
    const [lo, hi] = camLimits(), cr = cv.getBoundingClientRect(), k = cr.width / W;
    CAMX = hi; const goalRight = cr.left + sx(CW + NET_D, GY2) * k;
    const btnLeft = Math.min(...[...document.querySelectorAll('#pad .tb[data-k]')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.bottom > cr.top + sy(GY1, GH) * k && q.top < cr.top + sy(GY2) * k; }).map(e => e.getBoundingClientRect().left));
    return { lo, hi, std: [VIEW_HALF - 6, CW - VIEW_HALF + 6], goalRight, btnLeft };
  });
  ok(r.hi > r.std[1], 'Kamera schwenkt am rechten Tor nicht weiter: ' + JSON.stringify(r));
  ok(!(r.btnLeft < Infinity) || r.goalRight <= r.btnLeft, 'Tor unter den Knöpfen: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('K.-o.-Spiel: Unentschieden führt zum Elfmeterschießen mit Sieger; Finale mit Verlängerung', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(RUN_MATCH);
  const r = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 6 && out.filter(x => x.so).length < 2; i++) { const m = __runMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[i], LIGEN[TEAMS[HOME_TEAM].lg].ids[i + 1], { ko: true, hlen: 1 }); out.push({ score: m.score, so: m.so, w: winnerOf() }); }
    return out;
  });
  for (const m of r) ok(m.w === 0 || m.w === 1, 'kein Sieger im K.-o.-Spiel ' + JSON.stringify(m));
  const sos = r.filter(m => m.so);
  ok(sos.length, 'kein Elfmeterschießen in 6 Spielen');
  for (const m of sos) { const a = m.so[0].reduce((x, y) => x + y, 0), b = m.so[1].reduce((x, y) => x + y, 0); ok(a !== b && m.score[0] === m.score[1], 'Elfmeterschießen falsch ' + JSON.stringify(m)); }
  const et = await page.evaluate(() => { newMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[1], { human: -1, hlen: 1, ko: true, et: true }); G.paused = true; G.half = 2; G.score = [1, 1]; G.phase = 'halfend'; G.phaseT = 3; G.demo = false; step(1 / 60); return { phase: G.phase, menu: !!menu.querySelector('[data-act="etGo"]') }; });
  ok(et.menu, 'keine Verlängerung im Finale');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: zwei komplette Saisons (Kreisliga, Kreispokal, Meister, Playoffs bis zum Finale), Speichern und Laden', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo(); const out = [];
    for (let s = 0; s < 2; s++) {
      let n = 0; while (!CAREER.S.done && n < 120) { runEvent(null); n++; }
      const C = CAREER, P = C.S.po, cup = C.S.cup;
      const games = C.kl.map(li => { const need = (LIGEN[li].ids.length - 1 + LIGEN[li].ids.length % 2) * C.len; return Object.values(C.S.tables[li]).every(r => r.sp === need - (LIGEN[li].ids.length % 2 ? 1 * C.len : 0)) ? 'ok' : li + ':' + Object.values(C.S.tables[li]).map(r => r.sp); });
      const far = P ? P.teams.filter(t => !C.kl.includes(TEAMS[t].lg)) : [];
      out.push({ n, kl: C.kl.length, games, champ: P && P.champ, teams: P && P.teams.length, rounds: P && P.rounds.map(R => R.length), champs: P && C.kl.every(li => P.teams.includes(standings(li)[0])),
        farV: new Set(far.map(t => ligaOf(t).v)).size, farK: new Set(far.map(t => ligaOf(t).kreis)).size, far: far.length,
        cup: cup && cup.champ != null && cup.rounds[cup.rounds.length - 1].length === 1, cupTeams: cup && cup.teams.length, cupEv: C.S.cal.filter(e => e.t === 'cup').length, sq: C.squads[C.team].length, nsq: Object.keys(C.squads).length });
      ACT.cseason();
    }
    return out;
  });
  for (const s of r) {
    ok(s.games.every(g => g === 'ok'), 'nicht alle Spiele: ' + s.games);
    ok(s.teams === 16 && s.rounds.join() === '8,4,2,1' && s.champ != null, 'Playoffs: ' + JSON.stringify(s));
    ok(s.champs, 'Meister fehlen in den Playoffs');
    ok(s.far === 16 - s.kl && s.farK === s.far && s.farV >= 10, 'Kreismeister aus ganz Deutschland: ' + JSON.stringify(s));
    ok(s.cup && s.cupTeams >= 16 && s.cupEv === Math.ceil(Math.log2(s.cupTeams)), 'Kreispokal: ' + JSON.stringify(s));
    ok(s.sq >= 16 && s.sq <= 24, 'Kadergröße ' + s.sq);
  }
  ok(r[1].nsq <= 50, 'Spielstand wächst: ' + r[1].nsq + ' Kader');
  await page.reload(); await page.waitForTimeout(600);
  const loaded = await page.evaluate(() => { ACT.career(); return { year: CAREER.year, hub: !!menu.querySelector('[data-act="ctab"]'), bytes: localStorage.getItem(CAREER_KEY).length }; });
  ok(loaded.year === 2028 && loaded.hub, 'Laden: ' + JSON.stringify(loaded));
  ok(loaded.bytes < 1500000, 'Spielstand zu groß: ' + loaded.bytes);
  for (const t of ['blatt', 'tab', 'kader', 'elf', 'plan', 'cup', 'po', 'stat', 'verein']) await page.evaluate(t => ACT.ctab(t), t);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: eigenen Verein anlegen, Spieler bearbeiten (Name, Nummer, Position, Aussehen), nach Neuladen alles noch da', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { ACT.career(); ACT.ncEigen(); });
  await page.fill('#eg_n', 'SV Musterdorf 1920'); await page.click('[data-act="eigCol"][data-arg="c1|#141414"]'); await page.click('[data-act="eigCol"][data-arg="c2|#ffd200"]');
  await page.click('[data-act="eigSave"]');
  const a = await page.evaluate(() => { const t = TEAMS[NEWC.team]; ACT.ncGo(); return { n: t.n, k: t.k, custom: !!t.custom, inLiga: LIGEN[t.lg].ids.includes(t.id), career: TEAMS[CAREER.team].n, tbl: Object.keys(CAREER.S.tables[CAREER.lg]).map(Number).includes(t.id) }; });
  ok(a.custom && a.k === 'MUS' && a.inLiga && a.tbl && a.career === 'SV Musterdorf 1920', 'eigener Verein: ' + JSON.stringify(a));
  await page.evaluate(() => { const p = ensureSquad(CAREER.team).find(q => q.grp === 'MF'); window.__pid = p.pid; ACT.cpEdit(p.pid); });
  await page.fill('#pe_name', 'Wilhelm'); await page.fill('#pe_num', '10'); await page.click('[data-act="peGrp"][data-arg="ST"]'); await page.click('[data-act="peBeard"]');
  await page.click('[data-act="peSave"]');
  await page.evaluate(() => localStorage.setItem('__pid', String(__pid)));
  await page.reload(); await page.waitForTimeout(600);
  const b = await page.evaluate(() => { ACT.career(); const p = playerById(+localStorage.getItem('__pid')); return { team: CAREER && TEAMS[CAREER.team].n, name: p && p.name, num: p && p.num, grp: p && p.grp, nums: new Set(ensureSquad(CAREER.team).map(q => q.num)).size === ensureSquad(CAREER.team).length }; });
  ok(b.team === 'SV Musterdorf 1920' && b.name === 'Wilhelm' && b.num === 10 && b.grp === 'ST' && b.nums, 'nach Neuladen: ' + JSON.stringify(b));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Spiel speichern: beim Verlassen gespeichert, im Hauptmenü fortsetzen mit Stand, Uhr, Wechseln und Karten', async () => {
  const { page, ctx, errors } = await open();
  const a = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; startMatch(L[0], L[3], { human: 0, hlen: 2 }); G.phase = 'kickoff'; G.paused = true;
    for (let i = 0; i < 60 * 30; i++) step(1 / 60);
    G.score = [2, 1]; const p = teamP(0).find(q => grpOf(q) === 'MF'); doSub(p, 2, true); G.players.find(q => q.team === 1 && grpOf(q) === 'AB').off = true;
    document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new Event('pagehide'));
    return { clock: Math.round(G.clock), sub: p.d.name, saved: !!savedMatch() };
  });
  await page.reload(); await page.waitForTimeout(600);
  const b = await page.evaluate(() => { ACT.main(); const btn = !!menu.querySelector('[data-act="resumeMatch"]'); ACT.resumeMatch(); return { btn, score: G.score.join(':'), clock: Math.round(G.clock), off: G.players.filter(q => q.off).length, names: G.players.filter(q => q.team === 0).map(q => q.d.name), left: !!savedMatch() }; });
  ok(a.saved && b.btn, 'kein gespeichertes Spiel / kein FORTSETZEN');
  ok(b.score === '2:1' && Math.abs(b.clock - a.clock) <= 1 && b.off === 1 && b.names.includes(a.sub) && !b.left, 'Fortsetzen: ' + JSON.stringify({ a, b }));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Spielstand robust: verschobene Vereinsnummern werden zugeordnet, kaputter Stand wird beiseitegelegt, Datei sichern und laden', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo(); for (let i = 0; i < 3; i++) runEvent(null); saveCareer();
    const C = JSON.parse(localStorage.getItem(CAREER_KEY)), out = { pts: C.S.tables[C.lg][C.team].pkt };
    const x = LIGEN[C.lg].ids.find(i => i !== C.team), sw = id => id === C.team ? x : id === x ? C.team : id, swapObj = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [sw(+k), v]));
    const old = JSON.parse(JSON.stringify(C));
    old.team = sw(old.team); old.rival = sw(old.rival); old.squads = swapObj(old.squads); old.forms = swapObj(old.forms); old.S.tables[old.lg] = swapObj(old.S.tables[old.lg]); old.keys.t = swapObj(old.keys.t);
    old.S.cal.forEach(ev => { if (ev.games) for (const li in ev.games) ev.games[li] = ev.games[li].map(([h, a]) => [sw(h), sw(a)]); });
    old.S.results.forEach(r => r.games.forEach(g => { g.h = sw(g.h); g.a = sw(g.a); }));
    if (old.S.cup) { old.S.cup.teams = old.S.cup.teams.map(sw); old.S.cup.rounds = old.S.cup.rounds.map(R => R.map(t => ({ ...t, a: sw(t.a), b: sw(t.b), w: sw(t.w) }))); }
    localStorage.setItem(CAREER_KEY, JSON.stringify(old)); CAREER = null;
    const c = loadCareerSave(); out.mig = !!c && c.team === C.team && c.S.tables[c.lg][c.team].pkt === out.pts && c.S.ci === C.S.ci;
    // Datei: exportieren (Text abfangen) und wieder laden
    let txt = null; PLATFORM.saveFile = (n, t) => { txt = t; }; CAREER = c; exportCareer(); PLATFORM.saveFile = null;
    localStorage.removeItem(CAREER_KEY); CAREER = null; importCareerText(txt); out.imp = !!CAREER && CAREER.team === C.team && !!localStorage.getItem(CAREER_KEY);
    // kaputt: Verein gibt es nicht mehr
    const bad = JSON.parse(JSON.stringify(C)); bad.keys.t[bad.team] = 'Gibt es nicht|Nirgendwo'; localStorage.setItem(CAREER_KEY, JSON.stringify(bad)); CAREER = null;
    out.bad = loadCareerSave() === null && !!localStorage.getItem(CAREER_OLD_KEY) && !localStorage.getItem(CAREER_KEY);
    return out;
  });
  ok(r.mig, 'verschobene Nummern nicht zugeordnet');
  ok(r.imp, 'Datei sichern/laden');
  ok(r.bad, 'kaputter Spielstand nicht beiseitegelegt');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: Vor dem Spiel, Rekorde, Auszeichnungen, Legenden, Reiter HISTORIE, Saison als Bild (1080 × 1350)', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo(); let n = 0; while (!myGame() && n < 10) { runEvent(null); n++; }
    ACT.cpre(); const pre = !!menu.querySelector('.duel') && !!menu.querySelector('[data-act="cplay"]');
    n = 0; while (!CAREER.S.done && n < 150) { runEvent(null); n++; }
    ACT.cseason(); ACT.ctab('hist'); const tab = menu.textContent.includes('REKORDE') && menu.textContent.includes('AUSZEICHNUNGEN');
    const cv = seasonCanvas(CAREER.hist[0]);
    return { pre, tab, rec: Object.keys(CAREER.records || {}).length, aw: (CAREER.awards || []).length, size: [cv.width, cv.height].join('x') };
  });
  ok(r.pre, 'keine Vorschau vor dem Spiel');
  ok(r.tab && r.rec >= 4 && r.aw >= 2, 'Historie/Rekorde/Auszeichnungen: ' + JSON.stringify(r));
  ok(r.size === '1080x1350', 'Saisonbild ' + r.size);
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

test('Handy: Zurück-Geste (Spiel = Pause, Menü = eine Ebene zurück), ANPFIFF und nächstes Saisonspiel kleben unten im Bild, Ordner mit langer Hose', async () => {
  const { page, ctx, errors } = await open(MOBILE);
  const r = await page.evaluate(() => {
    const out = {}, pop = () => dispatchEvent(new PopStateEvent('popstate', { state: null }));
    const inView = sel => { const e = menu.querySelector(sel); if (!e) return false; const q = e.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight + 1; };
    ACT.main(); ACT.quick(); out.quick = inView('[data-act="qstart"]');
    pop(); out.back = !!menu.querySelector('[data-act="quick"]');
    ACT.career(); out.newc = inView('[data-act="ncGo"]'); ACT.ncGo(); out.hub = inView('[data-act="cpre"]');
    ACT.main(); ACT.qstart(); G.phase = 'play'; G.sp = null; pop(); out.pause = !menu.hidden && G.paused && INGAME_MENU;
    pop(); out.resume = menu.hidden && !G.paused;
    const L = ORD_LOOK(0), s = sprite(L, 'run', 2), d = s.getContext('2d').getImageData(0, 0, SW, SH).data;
    let pants = 0; for (let y = AY - 8; y < AY - 2; y++) for (let x = 0; x < SW; x++) { const i = (y * SW + x) * 4; if (d[i + 3] && d[i] === 0x2a && d[i + 1] === 0x2d) pants++; }
    out.pants = pants > 3;
    return out;
  });
  for (const k of ['quick', 'back', 'newc', 'hub', 'pause', 'resume', 'pants']) ok(r[k], k + ': ' + JSON.stringify(r));
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

test('Touch: zwei Knöpfe passen sich an (Angriff/Abwehr), PASS tippen passt, halten und wischen: Steilpass, hoher Ball, zielen, Grätsche; tippen: Tackling', async () => {
  const { page, ctx, errors } = await open(MOBILE);
  await page.evaluate(() => { startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[4], { human: 0 }); G.phase = 'play'; G.sp = null; const p = teamP(0).find(q => grpOf(q) === 'MF'); place(p, CW / 2, MY); giveBall(p, true); G.ctrl = p; });
  await page.waitForTimeout(150);
  const tip = await page.evaluate(() => { localStorage.removeItem('krl_touchtip'); tipG = null; G.phase = 'kickoff'; updateTouchLabels(); touchTip(); const el = document.getElementById('ttip'), on = !!el && G.paused;
    const labs = el ? [...el.querySelectorAll('.lab b')].map(b => b.textContent).join(',') : ''; closeTouchTip(); G.phase = 'play'; return { ok: on && !G.paused, labs }; });
  ok(tip.ok, 'Touch-Tipp im ersten Spiel fehlt oder schließt nicht');
  ok(tip.labs === 'LAUFEN – LINKER DAUMEN,PASS,SCHUSS', 'Touch-Tipp: Beschriftungen an Stick und Knöpfen passen nicht: ' + tip.labs);
  // Anstoß-Vorschau: keine Knöpfe über den Aufstellungen
  const cut = await page.evaluate(async () => { G.phase = 'intro'; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const o = getComputedStyle(document.querySelector('.tb-a')).opacity; G.phase = 'play'; return o; });
  ok(cut === '0', 'Knöpfe in der Anstoß-Vorschau sichtbar: ' + cut);
  const lbl = await page.evaluate(() => document.querySelector('.tb-a span').textContent + '|' + document.querySelectorAll('#pad .tb[data-k]').length);
  ok(lbl === 'PASS|2', 'Angriffs-Beschriftung oder zwei Knöpfe fehlen: ' + lbl);
  const bb = await page.evaluate(() => { const r = document.querySelector('.tb-a').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // gezählte Pässe statt Ball in der Luft prüfen: der Mitspieler nimmt den Pass auf langsamen Rechnern sonst schon an, bevor der Test hinschaut
  const p0 = await page.evaluate(() => G.stats.passes[0]);
  await page.touchscreen.tap(bb.x, bb.y);
  const passed = await page.waitForFunction(p0 => G.stats.passes[0] > p0, p0, { timeout: 2000, polling: 'raf' }).then(() => true, () => false);
  ok(passed, 'PASS-Knopf passt nicht');
  // gedrückt halten und ziehen: Angriff PASS ziehen = Flanke/hoher Ball, SCHUSS aufladen und ziehen = Schlenzer; Abwehr TACKLING ziehen = Grätsche, tippen = Tackling
  const ctr = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const drag = async (sel, dx, dy, hold = 60) => { const c = await ctr(sel); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.move(c.x + dx / 2, c.y + dy / 2); await page.mouse.move(c.x + dx, c.y + dy); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(60); };
  const setup = () => page.evaluate(() => { G.phase = 'play'; G.sp = null; G.ball.shot = null; const p = teamP(0).find(q => grpOf(q) === 'ST'); place(p, goalX(0) - atkDir(0) * 18, MY + 3); for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, 3); giveBall(p, true); G.ctrl = p; p.cd = 0; tbMode = ''; });
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 4, -55);
  const hi = await page.evaluate(() => ['lob', 'cross'].includes(G.ball.kind) && !G.ball.owner);
  ok(hi, 'PASS nach oben wischen spielt keinen hohen Ball');
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 55, 5);
  const th = await page.evaluate(() => G.ball.kind === 'through' && !G.ball.owner);
  ok(th, 'PASS zur Seite wischen spielt keinen Steilpass');
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 10, 12, 60);   // kleines Verrutschen beim Tippen: flacher Pass, kein hoher Ball
  const flat = await page.evaluate(() => G.ball.kind === 'pass');
  ok(flat, 'leichtes Verrutschen beim Tippen wird zum hohen Ball');
  // SCHUSS halten und Daumen ziehen = zielen (wie Padel-Legenden): nach oben = Ecke oben im Bild, nach unten = Ecke unten
  const aimShot = async dy => { await page.evaluate(() => { G.phase = 'play'; G.sp = null; G.ball.shot = null; const p = teamP(0).find(q => grpOf(q) === 'ST'); place(p, goalX(0) - atkDir(0) * 18, MY); for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, 3); giveBall(p, true); G.ctrl = p; p.cd = 0; tbMode = ''; }); await page.waitForTimeout(80); await drag('.tb-b', 0, dy, 150); return page.evaluate(() => G.ball.shot ? G.ball.vy : null); };
  const vUp = await aimShot(-60), vDown = await aimShot(60);
  ok(vUp != null && vDown != null && vUp < 0 && vDown > 0, 'Zielen mit dem Daumen: ' + vUp + ' / ' + vDown);
  const def = () => page.evaluate(() => { G.phase = 'play'; G.sp = null; const a = teamP(1).find(q => grpOf(q) === 'ST'), d = teamP(0).find(q => grpOf(q) === 'AB'); for (const q of G.players) if (q !== a && q !== d && !isGK(q)) place(q, q.team ? 8 : CW - 8, 3); place(a, CW / 2, MY); a.hx = -1; a.hy = 0; giveBall(a, true); a.think = 9; a.vx = a.vy = 0; place(d, CW / 2 + 1.5, MY); d.cd = 0; d.stun = 0; d.act = null; G.ctrl = d; G.manT = G.t; tbMode = ''; window.__d = d; });
  await def(); await page.waitForTimeout(80);
  const lb = await page.evaluate(() => document.querySelector('.tb-b span').textContent);
  ok(lb === 'TACKLING', 'Abwehr-Beschriftung: ' + lb);
  await drag('.tb-b', 0, -40);
  const sl = await page.evaluate(() => __d.act && __d.act.type === 'slide' || __d.cd > 0.5);
  ok(sl, 'TACKLING ziehen grätscht nicht');
  await def(); await page.waitForTimeout(80);
  const c = await ctr('.tb-b'); await page.mouse.click(c.x, c.y); await page.waitForTimeout(80);
  const tk = await page.evaluate(() => ({ ok: __d.d.ms.tk > 0 || (__d.act && ['tackle', 'stumble'].includes(__d.act.type)) || __d.cd > 0, act: __d.act, cd: __d.cd, ph: G.phase, ctrl: G.ctrl === __d, own: G.ball.owner && G.ball.owner.team, LASTIN, lbl: document.querySelector('.tb-b span').textContent, cls: document.querySelector('.tb-b').className }));
  ok(tk.ok, 'TACKLING tippen tackelt nicht ' + JSON.stringify(tk));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Bildschirmgrößen: Hauptmenü, Freundschaftsspiel, neue Saison, Optionen ohne seitliches Überlaufen von 320 bis 1920 px; Tablet-Zoom', async () => {
  const sizes = [[320, 568], [568, 320], [360, 640], [667, 375], [740, 360], [844, 390], [932, 430], [1024, 768], [1180, 820], [1366, 768], [1920, 1080]];
  const bad = [];
  for (const [w, h] of sizes) {
    const touch = w < 1300;
    const { page, ctx, errors } = await open({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1000, deviceScaleFactor: 1 });
    for (const act of ['main', 'quick', 'career', 'options']) {
      const r = await page.evaluate(a => { document.body.classList.add('portraitok'); ACT[a](); const el = menu.firstElementChild; return { doc: document.documentElement.scrollWidth - innerWidth, panel: el ? Math.round(el.getBoundingClientRect().right - innerWidth) : 0, mz: getComputedStyle(document.documentElement).getPropertyValue('--mz').trim() }; }, act);
      if (r.doc > 1 || r.panel > 2) bad.push(`${w}x${h} ${act}: ${JSON.stringify(r)}`);
      if (w === 1180 && act === 'main' && !(+r.mz > 1)) bad.push('Tablet-Zoom fehlt: ' + r.mz);
    }
    if (errors.length) bad.push(`${w}x${h}: ${errors.join('; ')}`);
    await ctx.close();
  }
  ok(!bad.length, bad.join(' | '));
});

test('Spielstand aus älterer Version lädt (ohne Schlüssel, Vereinsniveau, Rekorde), Zu leicht?-Vorschlag nach klarem Sieg', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    ACT.career(); ACT.ncGo(); for (let i = 0; i < 3; i++) runEvent(null); saveCareer();
    const C = JSON.parse(localStorage.getItem(CAREER_KEY)); for (const k of ['keys', 'lvl', 'records', 'awards', 'legends', 'custom', 'kit']) delete C[k];
    localStorage.setItem(CAREER_KEY, JSON.stringify(C)); CAREER = null;
    const c = loadCareerSave(), out = { old: !!c && c.team === C.team && !!JSON.parse(localStorage.getItem(CAREER_KEY)).keys };
    if (c) { CAREER = c; ACT.chub(); ACT.ctab('hist'); out.hub = !!menu.querySelector('[data-act="ctab"]'); }
    startMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[0], LIGEN[TEAMS[HOME_TEAM].lg].ids[1], { human: 0, diff: 1 }); G.score = [5, 0]; G.phase = 'end'; ACT.fulltime();
    out.hint = !!menu.querySelector('[data-act="rematchDiff"][data-arg="2"]');
    return out;
  });
  ok(r.old && r.hub, 'alter Spielstand lädt nicht: ' + JSON.stringify(r));
  ok(r.hint, 'kein „Zu leicht?“ nach 5:0');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Darstellung: alle Platzarten (Rasen, Kunstrasen, Hartplatz), Nacht im Finale, Screenshots ohne Fehler', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = [];
    for (const [tid, ev] of [[LIGEN[TEAMS[HOME_TEAM].lg].ids[0], null], [LIGEN[TEAMS[HOME_TEAM].lg].ids[1], null], [LIGEN[TEAMS[HOME_TEAM].lg].ids[2], null], [LIGEN[TEAMS[HOME_TEAM].lg].ids[3], FINAL_EVENT]]) {
      newMatch(tid, LIGEN[TEAMS[HOME_TEAM].lg + 1].ids[0], { human: 0, event: ev }); G.phase = 'play'; for (let i = 0; i < 30; i++) step(1 / 60); render();
      out.push({ ground: PITCH.ground, night: PITCH.night });
    }
    return out;
  });
  ok(new Set(r.map(x => x.ground)).size === 3, 'nicht alle Platzarten: ' + JSON.stringify(r));
  ok(r[3].night, 'Finale nicht unter Flutlicht');
  ok(!errors.length, errors.join('; ')); await ctx.close();
});


test('Startseite: Story läuft durch alle sieben Szenen ohne Fehler, Links zu Spiel, Impressum und Datenschutz', async () => {
  for (const o of [DESKTOP, MOBILE]) {
    const ctx = await browser.newContext({ ...o, reducedMotion: 'reduce' }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push('fehlt: ' + r.url()));
    await page.goto(GAME.replace(/game\/index\.html$/, 'index.html'), { timeout: 60000 }); await page.waitForTimeout(500);
    const kinds = [];
    const n = await page.evaluate(() => __story.TL.length);
    for (let i = 0; i < n; i++) {
      await page.evaluate(i => { const t = __story.TL[i]; scrollTo(0, (t.u0 + (t.u1 - t.u0) / 2) * __story.unitPx()); }, i);
      await page.waitForTimeout(250);
      kinds.push(await page.evaluate(() => __story.state().kind));
    }
    const links = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')));
    ok(['intro', 'tor', 'karte', 'kreisblatt', 'pokal', 'bus', 'finale'].every(k => kinds.includes(k)), 'Szenen: ' + kinds);
    ok(links.includes('game/') && links.includes('impressum.html') && links.includes('datenschutz.html'), 'Links fehlen');
    ok(!errors.length, errors.join('; ')); await ctx.close();
  }
  for (const f of ['impressum.html', 'datenschutz.html']) {
    const ctx = await browser.newContext(DESKTOP), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(GAME.replace(/game\/index\.html$/, f)); await page.click('.card .reveal');
    const mail = await page.evaluate(() => document.querySelector('[data-k="mail"]').textContent);
    ok(/@/.test(mail), f + ': Kontakt wird nicht angezeigt');
    ok(!errors.length, errors.join('; ')); await ctx.close();
  }
});

test('Training: alle 7 Lektionen mit der Tastatur durchspielbar (Laufen, Passen, Steilpass, Schießen, Flanke, Abwehr, Standards)', async () => {
  const { page, ctx, errors } = await open();
  const log = await page.evaluate(() => {
  SETTINGS.keys = 'fc'; ACT.training(); G.paused = true; const log = [];
  const keys = ['KeyS', 'KeyA', 'KeyD', 'KeyW', 'KeyQ', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft'];
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
    else if (L.t === 'STEILPASS' && b.owner === c && f && G.t - c.gotT > 0.5) KEYP.KeyW = true;
    else if ((L.t === 'SCHIESSEN' || L.t === 'STANDARDS') && b.owner === c) { if (hold < 30) { KEY.Space = true; hold++; KEY.ArrowUp = hold > 3 && (n / 600 | 0) % 2 === 0; } else hold = 0; }
    else if (L.t === 'FLANKE & KOPFBALL') { if (b.owner === c && f) KEYP.KeyA = true; else if (!b.owner && b.passTo === c && f) KEYP.Space = true; }
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
