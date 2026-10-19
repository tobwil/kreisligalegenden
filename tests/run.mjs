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
// Netlify blendet in Vorschauen eine eigene Leiste (iframe) ein – für Klicks und Tipps im Test entfernen
const hideNetlify = () => new MutationObserver(() => document.querySelectorAll('iframe[src*="app.netlify.com"]').forEach(f => (f.parentElement !== document.body && f.parentElement || f).remove())).observe(document, { childList: true, subtree: true });
async function open(opts = DESKTOP, seed = +process.env.SEED || 7) {   // SEED=… spielt dieselben Tests mit anderem Zufall (große Testreihe)
  const ctx = await browser.newContext(opts);
  if (seed) await ctx.addInitScript(s => { let x = s; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; }, seed);
  if (/^https?:/.test(GAME)) await ctx.addInitScript(hideNetlify);   // Vorschau: Netlifys Leiste liegt sonst über den Touch-Knöpfen
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(GAME, { timeout: 60000 }); await page.waitForTimeout(600);
  // Zufall neu ansetzen: wie viele Bilder das Titelspiel bis hier lief, hängt von der Ladezeit ab (Datei oder Netz)
  if (seed) await page.evaluate(s => { let x = s; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; }, seed);
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
  const res = await page.evaluate(() => [0, 1, 2, 3, 4, 5].map(i => __runMatch(LIGEN[TEAMS[HOME_TEAM].lg].ids[i], LIGEN[TEAMS[HOME_TEAM].lg + 1].ids[15 - i])));   // 6 Spiele: bei ~1,4 Toren je Spiel sind 2 Tore in 4 Spielen nicht sicher
  let goals = 0, shots = 0, passes = 0, ok2 = 0;
  for (const r of res) {
    ok(r.phase === 'end', 'Spiel endet nicht: ' + JSON.stringify(r.score));
    goals += r.score[0] + r.score[1]; shots += r.stats.shots[0] + r.stats.shots[1]; passes += r.stats.passes[0] + r.stats.passes[1]; ok2 += r.stats.passOk[0] + r.stats.passOk[1];
    ok(r.score[0] + r.score[1] < 13, 'unplausibles Ergebnis ' + r.score);
    ok(r.log.length === r.score[0] + r.score[1], 'Torliste passt nicht zum Ergebnis');
  }
  ok(goals >= 3 && goals <= 48, 'Tore gesamt ' + goals);
  ok(shots >= 24, 'zu wenige Schüsse ' + shots);
  ok(passes > 225 && ok2 / passes > 0.55, `Passquote ${ok2}/${passes}`);
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

// Bot spielt ein ganzes Spiel nur über Tasten (wie ein Mensch an der Tastatur): prüft, dass Laufen, Pass (kurz und gehalten),
// Steilpass, Schuss, Flanke, Tackling, Spielerwechsel, Standards und Halbzeit im Zusammenspiel funktionieren.
test('Bot spielt ein ganzes Spiel mit der Tastatur: Pässe, Schüsse, Ballgewinne, Standards, Halbzeit, Abpfiff ohne Hänger', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids;
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; hideMenu();
    const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyW', 'Enter'], H = {};
    const press = (k, n) => { if (!H[k]) H[k] = n; };   // H > 0: Taste gedrückt, H < 0: kurz losgelassen, bevor sie wieder geht
    const busy = () => ['KeyS', 'KeyA', 'KeyD', 'Space'].some(k => H[k]);
    const out = { regain: 0, keys: { S: 0, A: 0, D: 0, Space: 0 }, frames: 0, half: 0 };
    let lastOwnerTeam = null, tackleT = -9, crossed = null, n = 0;
    const s = () => atkDir(0);
    while (G.phase !== 'end' && n < 60 * 60 * 9) {
      n++;
      const b = G.ball, c = G.ctrl, ph = G.phase;
      let ax = 0, ay = 0;
      if (ph === 'pause') { nextHalf(); out.half++; continue; }
      if (ph === 'intro' || ph === 'replay' || ph === 'goal') { if (n % 30 === 0) press('Enter', 2); }
      else if ((ph === 'setpiece' || ph === 'kickoff' || ph === 'penalty') && G.sp && isHumanTeam(G.sp.team) && G.sp.t > 0.6 && !busy()) {
        if (aimViewOn()) press('Space', 30); else if (G.sp.type === 'corner') press('KeyA', 8); else press('KeyS', 4);
      } else if (ph === 'play' && c) {
        const gx = goalX(0), mine = b.owner === c, ours = b.owner && b.owner.team === 0;
        if (mine) {
          ax = s(); ay = (MY - c.y) * 0.08;
          const dg = dist(c.x, c.y, gx, MY), front = opps(c).some(o => !isGK(o) && (o.x - c.x) * s() > 0 && dist(o.x, o.y, c.x, c.y) < 2.6);
          if (!busy()) {
            if (Math.abs(c.y - MY) > 12 && Math.abs(c.x - gx) < 30 && crossed !== c) { crossed = c; press('KeyA', 20); out.keys.A++; ax = 0; ay = 0; }
            else if (dg < 27) { press('Space', 20); out.keys.Space++; }
            else if (front) { press('KeyS', n % 3 ? 3 : 35); out.keys.S++; }
            else if (n % 97 === 0) { press('KeyD', n % 2 ? 3 : 25); out.keys.D++; }
          }
        } else if (ours) { ax = Math.sign(b.owner.x + s() * 12 - c.x) * 0.6; ay = Math.sign(c.y - MY) * 0.2; }
        else {
          const tx = b.owner ? b.owner.x : b.x, ty = b.owner ? b.owner.y : b.y, d = dist(c.x, c.y, tx, ty);
          if (d > 0.4) { ax = (tx - c.x) / d; ay = (ty - c.y) / d; }
          if (b.owner && b.owner.team === 1 && d < 1.3 && G.t - tackleT > 0.8 && !busy()) { press('KeyD', 3); out.keys.D++; tackleT = G.t; }
          else if (d > 15 && n % 60 === 0 && !busy()) { press('KeyS', 3); out.keys.S++; }
        }
      }
      KEY.ArrowRight = ax > 0.3; KEY.ArrowLeft = ax < -0.3; KEY.ArrowDown = ay > 0.3; KEY.ArrowUp = ay < -0.3;
      for (const k of ['KeyS', 'KeyA', 'KeyD', 'Space', 'Enter']) { const on = H[k] > 0; if (on && !KEY[k]) KEYP[k] = true; KEY[k] = on; if (H[k] > 0) { if (--H[k] === 0) H[k] = -6; } else if (H[k] < 0) H[k]++; }
      readInput(1 / 60); step(1 / 60);
      const ot = G.ball.owner ? G.ball.owner.team : null;
      if (ot === 0 && lastOwnerTeam === 1) out.regain++;
      if (ot != null) lastOwnerTeam = ot;
    }
    for (const k of KEYS) KEY[k] = false;
    out.frames = n; out.phase = G.phase; out.score = G.score.slice(); out.passes = G.stats.passes[0]; out.passOk = G.stats.passOk[0]; out.shots = G.stats.shots[0]; out.corners = G.stats.corners[0];
    return out;
  });
  ok(r.phase === 'end', 'Spiel endet nicht: ' + JSON.stringify(r));
  ok(r.half >= 1, 'keine Halbzeit: ' + JSON.stringify(r));
  ok(r.passes >= 12 && r.passOk / r.passes > 0.4, 'zu wenige oder zu schlechte Pässe: ' + JSON.stringify(r));
  ok(r.shots >= 4, 'zu wenige Schüsse: ' + JSON.stringify(r));
  ok(r.regain >= 3, 'kaum Ballgewinne: ' + JSON.stringify(r));
  console.log('    Bot:', JSON.stringify({ score: r.score, passes: `${r.passOk}/${r.passes}`, shots: r.shots, regain: r.regain, keys: r.keys }));
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

test('Tastatur: Pass antippen = kurz zum nahen Mitspieler, halten = fester und weiter (Balken), Pass geht beim Loslassen; Steilpass halten = weiter in die Tiefe', async () => {
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
    // Steilpass (D): halten = weiter in die Tiefe, also schneller gespielt
    const sp = () => Math.hypot(G.ball.vx, G.ball.vy);
    setup(); KEY.KeyD = KEYP.KeyD = true; frame(); KEY.KeyD = false; frame(); out.t1 = G.ball.kind === 'through' ? sp() : 0;
    setup(); KEY.KeyD = KEYP.KeyD = true; for (let i = 0; i < 50; i++) frame(); KEY.KeyD = false; frame(); out.t2 = G.ball.kind === 'through' ? sp() : 0;
    return out;
  });
  ok(r.notYet && r.tap, 'Antippen spielt nicht kurz zum nahen Mitspieler: ' + JSON.stringify(r));
  ok(r.bar && r.hold, 'Halten spielt nicht fest zum weiten Mitspieler: ' + JSON.stringify(r));
  ok(r.t1 > 0 && r.t2 > r.t1 + 2, 'Steilpass halten spielt nicht weiter: ' + JSON.stringify(r));
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

test('Schusstaste aus dem eigenen Strafraum = Befreiungsschlag: landet vor dem gegnerischen Strafraum, nicht im Toraus', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, res = [];
    for (const pw of [0.2, 0.6, 1]) for (let n = 0; n < 4; n++) {
      startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
      const s = atkDir(0), ox = ownX(0), p = teamP(0).find(q => grpOf(q) === 'AB'); place(p, ox + s * 12, MY + 6); giveBall(p, true); G.ctrl = p;
      shoot(p, pw, null); const B = G.ball; let land = null;
      for (let i = 0; i < 60 * 3 && land == null; i++) { step(1 / 60); if (B.z < 0.05 && i > 5) land = (B.x - ox) * s; }
      res.push({ land, shot: !!B.shot, goalKick: G.sp && G.sp.type === 'goal' });
    }
    return res;
  });
  ok(r.every(x => x.land != null && x.land > 25 && x.land < 82 && !x.shot && !x.goalKick), JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Ecke mit Zielvisier: Richtung verschiebt das Ziel im Strafraum, Flanke landet dort, halten = scharf, Pass = kurz ausgeführt', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {}, s0 = () => atkDir(0);
    const corner = () => { startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; setupSetPiece('corner', 0, goalX(0) === CW ? CW - 0.3 : 0.3, 0.3); G.phase = 'setpiece'; G.sp.t = 2; for (const k in KEY) KEY[k] = false; readInput(1 / 60); stepSetPiece(1 / 60); };
    corner(); const a0 = { ...G.sp.caim }; KEY.ArrowDown = true; for (let i = 0; i < 30; i++) { readInput(1 / 60); stepSetPiece(1 / 60); } KEY.ArrowDown = false; readInput(1 / 60);
    const a1 = { ...G.sp.caim }; out.moved = a1.y - a0.y > 4; render(); out.drawn = true;
    KEY.KeyA = KEYP.KeyA = true; readInput(1 / 60); stepSetPiece(1 / 60); KEY.KeyA = false; out.wait = G.ball.kind !== 'cross'; readInput(1 / 60); stepSetPiece(1 / 60);   // Flanke beim Loslassen
    out.cross = G.ball.kind === 'cross'; const B = G.ball; let land = null; const v0 = Math.hypot(B.vx, B.vy);
    const o = { ...B }; for (let i = 0; i < 200 && land == null; i++) { ballPhys(o, 1 / 60); if (o.z < 2.0 && o.vz < 0 && i > 10) land = { x: o.x, y: o.y }; }   // reine Flugbahn: Torwart oder Kopfball fangen sie sonst je nach Zufall vorher ab
    out.err = land ? Math.hypot(land.x - a1.x, land.y - a1.y) : 99;
    // gehalten = scharf: schneller und flacher als angetippt
    const kick = n => { corner(); KEY.KeyA = KEYP.KeyA = true; for (let i = 0; i < n; i++) { readInput(1 / 60); G.t += 1 / 60; stepSetPiece(1 / 60); } KEY.KeyA = false; readInput(1 / 60); stepSetPiece(1 / 60); return G.ball.kind === 'cross' ? G.ball.vz : 99; };
    const vTap = kick(1), vHold = kick(50); out.vz = [vTap, vHold]; out.sharp = vHold < vTap - 1;
    corner(); KEY.KeyS = KEYP.KeyS = true; readInput(1 / 60); stepSetPiece(1 / 60); KEY.KeyS = false; out.short = G.ball.kind === 'pass';
    return out;
  });
  ok(r.moved && r.drawn, 'Zielvisier bewegt sich nicht: ' + JSON.stringify(r));
  ok(r.cross && r.err < 4.5, 'Flanke landet nicht am Zielvisier: ' + JSON.stringify(r));
  ok(r.wait && r.sharp, 'Ecke: Kraft durch Halten fehlt: ' + JSON.stringify(r));
  ok(r.short, 'kurze Ecke fehlt: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Flanke halten = kurzer bis langer Pfosten; Kopfball: Spieler läuft selbst zum Ball, der Stick zielt (hoch/runter = Ecke)', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.offside = false;   // die Verteidiger stehen in diesem Aufbau an der Mittellinie
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    const frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    const setup = () => {
      startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
      const s = atkDir(0), gx = goalX(0), w = teamP(0).find(q => grpOf(q) === 'MF'), [near, far] = teamP(0).filter(q => grpOf(q) === 'ST');
      for (const q of G.players) if (!isGK(q) && q !== w && q !== near && q !== far) place(q, CW / 2, q.team ? 3 : CH - 3);
      place(w, gx - s * 14, 4); place(near, gx - s * 6, MY - 3); place(far, gx - s * 7, MY + 5); w.cd = 0; G.ctrl = w; giveBall(w, true); for (const k in KEY) KEY[k] = false; frame();
      return { w, near, far, s, gx };
    };
    const crossHold = n => { const P = setup(); KEY.KeyA = KEYP.KeyA = true; for (let i = 0; i < n; i++) frame(); KEY.KeyA = false; frame(); return G.ball.passTo === P.near ? 'near' : G.ball.passTo === P.far ? 'far' : G.ball.passTo ? 'other' : 'none'; };
    out.short = crossHold(3); out.long = crossHold(55);
    // Kopfball: Stick die ganze Zeit gedrückt, der Spieler läuft trotzdem zum Ball und köpft in die Ecke, in die der Stick zeigt
    const head = key => {
      const P = setup(); for (const q of [P.far]) place(q, CW / 2, CH - 3); place(P.near, P.gx - P.s * 9.5, MY - 2);   // außerhalb des Fünfers, wo der Torwart nicht herauskommt
      cross(P.w, 0); G.ctrl = G.ball.passTo || P.near; const c = G.ctrl;
      for (let i = 0; i < 150; i++) { KEY[key] = true; if (G.ball.z > 0.9 && dist(G.ball.x, G.ball.y, c.x, c.y) < 5) KEYP.Space = KEY.Space = true; else KEY.Space = false; readInput(1 / 60); step(1 / 60); if (G.ball.shot && G.ball.shot.header) break; }
      const B = G.ball; if (!(B.shot && B.shot.header && B.shot.by === c)) return null;
      return B.y + B.vy * (P.gx - B.x) / B.vx - MY;
    };
    out.down = head('ArrowDown'); out.up = head('ArrowUp');
    return out;
  });
  ok(r.short === 'near' && r.long === 'far', 'Flanke nach Kraft: ' + JSON.stringify(r));
  ok(r.down != null && r.up != null, 'Kopfball kommt mit gedrücktem Stick nicht zustande: ' + JSON.stringify(r));
  ok(r.down > 0.5 && r.up < -0.5, 'Kopfball geht nicht in Stickrichtung: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Spielerwechsel in der Abwehr: Verteidiger vor dem Gegner statt des überlaufenen, mit Richtung, schnell weiterschalten, Auto-Wechsel beim Überlaufen', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.autoswitch = false;
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    const frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    let P;
    const setup = () => {
      startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
      const s = atkDir(0), ox = ownX(0), o = teamP(1).find(q => grpOf(q) === 'ST'), ab = teamP(0).filter(q => grpOf(q) === 'AB'), [behind, front, side, up] = ab;
      for (const q of G.players) if (!isGK(q)) place(q, CW / 2 + (q.team ? 1 : -1) * 0, q.team ? 3 : CH - 3);
      const cx = ox + s * 40; place(o, cx, MY); o.vx = -s * 6; o.vy = 0; giveBall(o, true); o.think = 9;
      place(behind, cx + s * 3, MY + 0.5); place(front, cx - s * 9, MY + 1); place(side, cx + s * 4, MY + 6); place(up, cx - s * 2, MY - 12);
      G.ctrl = behind; G.manT = -9; for (const k in KEY) KEY[k] = false; frame();
      P = { behind, front, side, up, o, s };
    };
    const press = k => { KEY[k] = KEYP[k] = true; frame(); KEY[k] = false; frame(); };
    setup(); press('KeyS'); out.smart = G.ctrl === P.front;
    press('KeyS'); out.cycle = G.ctrl !== P.front && G.ctrl !== P.behind;
    setup(); KEY.ArrowUp = true; press('KeyS'); KEY.ArrowUp = false; out.dir = G.ctrl === P.up;
    setup(); render(); out.drawn = true;
    // Auto-Wechsel: dein Spieler ist überlaufen und du läufst noch hinterher
    setup(); SETTINGS.autoswitch = true; KEY[P.s > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; G.autoT = -9; frame(); out.auto = G.ctrl === P.front;
    return out;
  });
  ok(r.smart, 'Wechsel nimmt nicht den Verteidiger vor dem Gegner: ' + JSON.stringify(r));
  ok(r.cycle, 'schnell nochmal drücken schaltet nicht weiter: ' + JSON.stringify(r));
  ok(r.dir, 'Wechsel mit Richtung: ' + JSON.stringify(r));
  ok(r.auto && r.drawn, 'Auto-Wechsel beim Überlaufen: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Arcade-Feinschliff: Stellen (Tackling halten), Schwung nach dem Wechsel, Doppelpass auf Knopfdruck, perfekter Schuss, Abschirmen', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.autoswitch = false;
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const s = atkDir(0), ox = ownX(0), frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    const clear = () => { for (const k in KEY) KEY[k] = false; frame(); };
    const away = (keep) => { G.phase = 'play'; G.sp = null; G.offs = null; G.banner = null; G.oneTwo = null; G.ball.passer = null; G.ball.passTo = null; for (const q of G.players) if (!isGK(q) && !keep.includes(q)) place(q, CW / 2 + (q.team ? 38 : -30) * s, q.team ? 2 : CH - 2); };   // Gegner hinten (kein Abseits), eigene weit weg
    // Stellen: D halten, der Verteidiger bleibt zwischen Gegner und Tor statt reinzurutschen; Loslassen nah dran = Tackling
    const o = teamP(1).find(q => grpOf(q) === 'ST'), d = teamP(0).find(q => grpOf(q) === 'AB');
    away([o, d]); const cx = ox + s * 30; place(o, cx, MY); giveBall(o, true); place(d, cx - s * 2, MY - 6); d.cd = 0; d.stun = 0; d.act = null; G.ctrl = d; G.manT = G.t; clear();
    KEY.KeyD = KEYP.KeyD = true; let tk0 = d.act;
    for (let i = 0; i < 60; i++) { place(o, cx, MY); o.think = 9; G.ball.owner = o; readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); movePlayer(d, 1 / 60); }
    out.contain = d.contain === o && !tk0 && G.ball.owner === o;
    out.goalSide = Math.abs(d.x - ox) < Math.abs(o.x - ox) - 0.5 && dist(d.x, d.y, o.x, o.y) < 2.6 && Math.abs(d.y - MY) < 1.5;
    // 1,5 m: nah genug fürs Tackling, aber nicht so nah, dass zufällig gespitzelt wird (ein Spitzeln beim Stellen davor zurücksetzen)
    const tk1 = d.d.ms.tk; d.cd = 0; d.stun = 0; d.act = null; place(d, cx - s * 1.5, MY); KEY.KeyD = false; frame(); out.release = (d.d.ms.tk > tk1 || !!(d.act && ['tackle', 'stumble'].includes(d.act.type))) && !d.contain;   // Tackling ausgelöst (gelungen oder gestolpert)
    // Anlauf-Tackling: aus 3 m nur kurz antippen (wie am Handy) – dein Spieler sprintet hin und tackelt
    away([o, d]); place(o, cx, MY); giveBall(o, true); o.think = 9; place(d, cx - s * 3, MY + 0.4); d.cd = 0; d.stun = 0; d.act = null; d.lunge = null; d.containT = null; G.ctrl = d; G.manT = G.t; clear();
    const tk2 = d.d.ms.tk; KEY.KeyD = KEYP.KeyD = true; frame(); KEY.KeyD = false; let lunged = false;
    for (let i = 0; i < 50 && !lunged; i++) { place(o, cx, MY); G.ball.owner = o; readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); movePlayer(d, 1 / 60); lunged = d.d.ms.tk > tk2 || !!(d.act && ['tackle', 'stumble'].includes(d.act.type)); }
    out.lunge = lunged;
    // Schwung: der neue Spieler läuft nach dem Wechsel weiter und dreht dann auf den Stick, statt abrupt abzuknicken
    const m = teamP(0).find(q => grpOf(q) === 'MF'); away([m]); place(m, CW / 2, MY); giveBall(o, true); place(o, CW / 2 + 20, 3);
    const run = sw => { m.vx = 7; m.vy = 0; G.ctrl = m; G.swT = sw ? G.t : null; KEY.ArrowLeft = true; KEY.ArrowRight = false; readInput(1 / 60); const v = []; for (let i = 0; i < 30; i++) { movePlayer(m, 1 / 60); G.t += 1 / 60; v.push(m.vx); } KEY.ArrowLeft = false; return v; };
    const sw = run(true), no = run(false);
    out.swing = { early: sw[3], hard: no[3], late: sw[29] };
    // Doppelpass: Pass, Mitspieler nimmt an, sofort nochmal Pass (ohne Richtung) = Rückpass in den Lauf
    const [p, q] = teamP(0).filter(x => grpOf(x) === 'MF');
    const one = (wait, dir) => {
      away([p, q]); place(p, CW / 2, MY); place(q, CW / 2 + s * 9, MY); p.cd = 0; q.cd = 0; G.ctrl = p; G.ball.shot = null; giveBall(p, true); G.banner = null; clear();
      KEY[s > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; KEY.KeyS = KEYP.KeyS = true; frame(); KEY.KeyS = false; frame(); KEY.ArrowRight = KEY.ArrowLeft = false;
      for (let i = 0; i < 120 && G.ball.owner !== q; i++) { readInput(1 / 60); step(1 / 60); }
      if (G.ball.owner !== q) return 'nicht angenommen (' + G.phase + ')';
      for (let i = 0; i < wait; i++) { readInput(1 / 60); step(1 / 60); }
      if (dir) KEY.ArrowUp = true;
      KEY.KeyS = KEYP.KeyS = true; frame(); KEY.KeyS = false; frame(); KEY.ArrowUp = false;
      return G.ball.kind + (G.ball.passTo === p ? '>p' : '') + (G.banner && G.banner.txt === 'DOPPELPASS' ? '!' : '') + (p.run && p.run.gg ? '+lauf' : '');
    };
    out.oneTwo = one(2, false); out.late = one(45, false); out.side = one(2, true);
    away([]); giveBall(o, true); place(o, CW / 2 + 20, 3); G.oneTwo = { from: p, to: q, t: G.t }; out.stale = oneTwoOk(q, 0, 0);
    // perfekter Schuss: Loslassen in der hellen Zone
    const c = teamP(0).find(x => grpOf(x) === 'ST'), gx = goalX(0);
    const shot = n => { away([c]); G.ball.shot = null; G.banner = null; place(c, gx - s * 17, MY + 4); c.cd = 0; c.charge = 0; c.chargeArm = false; G.ctrl = c; giveBall(c, true); clear();
      KEY.Space = KEYP.Space = true; for (let i = 0; i < n; i++) frame(); if (n === 25) render(); KEY.Space = false; frame(); return (G.ball.shot ? 'shot' : '-') + (G.banner && G.banner.txt === 'PERFEKT!' ? '!' : ''); };
    out.perfect = shot(25); out.over = shot(45); out.short = shot(8);
    // Abschirmen: langsam, Gegner im Rücken = schwerer zu tackeln
    const a = teamP(1).find(x => grpOf(x) === 'ST'), t = teamP(0).find(x => grpOf(x) === 'AB'); away([a, t]);
    const trial = (vx, n) => { let won = 0; for (let i = 0; i < n; i++) { place(a, CW / 2, MY); a.hx = -s; a.hy = 0; a.vx = vx; a.vy = 0; giveBall(a, true); a.hx = -s; place(t, CW / 2 + s * 1, MY); t.cd = 0; t.stun = 0; t.act = null; tackle(t, a); if (G.ball.owner !== a) won++; } return won / n; };
    place(a, CW / 2, MY); a.hx = -s; a.hy = 0; a.vx = 0; a.vy = 0; place(t, CW / 2 + s, MY); giveBall(a, true); a.hx = -s;
    out.shieldGeo = [shields(a, t), (place(t, CW / 2 - s, MY), shields(a, t))];
    out.rate = [trial(0, 600), trial(-s * 6, 600)];
    return out;
  });
  ok(r.contain && r.goalSide, 'Stellen: Verteidiger bleibt nicht zwischen Gegner und Tor: ' + JSON.stringify(r));
  ok(r.release, 'Stellen: Loslassen nah dran tackelt nicht: ' + JSON.stringify(r));
  ok(r.lunge, 'Anlauf-Tackling: kurz antippen aus 3 m tackelt nicht: ' + JSON.stringify(r));
  ok(r.swing.early > 6 && r.swing.hard < 5.5 && r.swing.late < -3, 'Schwung nach dem Wechsel: ' + JSON.stringify(r.swing));
  ok(r.oneTwo === 'through>p!+lauf', 'Doppelpass auf Knopfdruck: ' + r.oneTwo);
  ok(!r.late.includes('!') && !r.side.includes('!') && !r.stale, 'Doppelpass zu spät, quer oder ohne Annahme: ' + JSON.stringify([r.late, r.side, r.stale]));
  ok(r.perfect === 'shot!' && r.over === 'shot' && r.short === 'shot', 'perfekter Schuss: ' + JSON.stringify([r.perfect, r.over, r.short]));
  ok(r.shieldGeo[0] && !r.shieldGeo[1] && r.rate[0] < r.rate[1] - 0.06, 'Abschirmen: ' + JSON.stringify([r.shieldGeo, r.rate]));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

// Reddit-Feedback „CPU nimmt zu leicht den Ball ab und gibt blitzschnell weiter, man kommt kaum an den Gegner“
test('Zweikampf-Fairness: Schonfrist nach deiner Annahme, CPU spielt nach Ballgewinn nicht sofort weiter, kein Dauerfeuer, Aufholschub, Handy startet auf Freizeitkick', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.autoswitch = false;
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0, diff: 1 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const s = atkDir(0), h = teamP(0).find(q => grpOf(q) === 'MF'), c = teamP(1).find(q => grpOf(q) === 'MF');
    const away = keep => { G.offs = null; G.banner = null; G.ball.passer = null; G.ball.passTo = null; for (const q of G.players) if (!isGK(q) && !keep.includes(q)) place(q, CW / 2 + (q.team ? 30 : -30) * s, q.team ? 2 : CH - 2); };
    let tk = 0; const oTk = window.tackle; window.tackle = (d, o) => { if (d === c) tk++; return oTk(d, o); };
    // Schonfrist: der CPU-Presser steht direkt an dir – in den ersten 0,6 s nach der Annahme greift er nicht an, danach schon
    const win = (a, b, n) => { let k = 0; for (let i = 0; i < n; i++) {
      away([h, c]); place(h, CW / 2, MY); place(c, CW / 2 + s * 1, MY); c.cd = 0; c.stun = 0; c.act = null; h.stun = 0; h.act = null; G.ctrl = h; G.poss = 1; giveBall(h, true);
      for (let f = 0; f < b * 60; f++) { G.t += 1 / 60; place(h, CW / 2, MY); place(c, CW / 2 + s * 1, MY); if (G.ball.owner !== h) break; const t0 = tk; aiTeam(1, 1 / 60); if (tk > t0) { if (f < a * 60) k++; break; } }
    } return k; };
    tk = 0; out.early = win(0.6, 0.6, 150);
    tk = 0; let late = 0; for (let i = 0; i < 60; i++) { away([h, c]); place(h, CW / 2, MY); place(c, CW / 2 + s * 1, MY); c.cd = 0; c.stun = 0; c.act = null; G.ctrl = h; giveBall(h, true); h.gotT = G.t - 1; for (let f = 0; f < 60 && !tk; f++) { G.t += 1 / 60; place(h, CW / 2, MY); place(c, CW / 2 + s * 1, MY); G.ball.owner = h; aiTeam(1, 1 / 60); } if (tk) late++; tk = 0; }
    out.late = late;
    // kein Dauerfeuer: nach seinem Tackling wartet derselbe CPU-Spieler länger
    away([h, c]); place(h, CW / 2, MY); place(c, CW / 2 + s * 1, MY); c.cd = 0; c.stun = 0; c.act = null; giveBall(h, true); oTk(c, h); out.cd = c.cd; G.phase = 'play'; G.sp = null; G.paused = true;   // ein Foul pfeift ab – für die nächsten Teile wieder anpfeifen
    // nach dem Ballgewinn gegen dich: die CPU sichert erst den Ball (kein Pass in den ersten 0,5 s), obwohl ein Mitspieler frei steht
    const m = teamP(1).find(q => grpOf(q) === 'MF' && q !== c); let quick = 0;
    for (let i = 0; i < 40; i++) {
      away([h, c, m]); place(h, CW / 2 - s * 6, MY); place(c, CW / 2, MY); place(m, CW / 2 - s * 10, MY + 8); G.poss = 0; G.ball.owner = null; giveBall(c, true);
      for (let f = 0; f < 30; f++) { G.t += 1 / 60; carrierAI(c, 1 / 60); if (G.ball.owner !== c) { quick++; break; } }
    }
    out.quick = quick; out.settle = c.settleT > 0;
    // Aufholschub: einem Gegner mit Ball hinterher läuft dein Spieler etwas schneller als zu einem Mitspieler
    const mate = teamP(0).find(q => grpOf(q) === 'ST');
    const run = opp => { away([h, c, m, mate]); place(h, CW / 2, MY); h.vx = h.vy = 0; h.stun = 0; h.act = null; h.contain = null; h.lunge = null; const own = opp ? c : mate; place(own, CW / 2 + s * 10, MY); giveBall(own, true); own.think = 9; G.ctrl = h;
      for (const k in KEY) KEY[k] = false; KEY[s > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; readInput(1 / 60); const x0 = h.x; for (let f = 0; f < 45; f++) { place(own, CW / 2 + s * 10, MY); movePlayer(h, 1 / 60); } KEY.ArrowRight = KEY.ArrowLeft = false; return Math.abs(h.x - x0); };
    out.chase = [run(true), run(false)];
    window.tackle = oTk;
    return out;
  });
  ok(r.early === 0, 'Schonfrist: CPU tackelt direkt nach deiner Annahme: ' + JSON.stringify(r));
  ok(r.late >= 20, 'nach der Schonfrist greift die CPU nicht mehr an: ' + JSON.stringify(r));
  ok(r.cd >= 1.2, 'CPU-Tackling ohne Pause danach: ' + JSON.stringify(r));
  ok(r.settle && r.quick <= 2, 'CPU spielt nach Ballgewinn sofort weiter: ' + JSON.stringify(r));
  ok(r.chase[0] > r.chase[1] * 1.05, 'kein Aufholschub: ' + JSON.stringify(r));
  // Handy ohne gespeicherte Einstellungen: Start auf Freizeitkick, am Rechner Kreisliga
  for (const [o, want] of [[MOBILE, 0], [DESKTOP, 1]]) { const x = await open(o, 0); const d = await x.page.evaluate(() => SETTINGS.diff); ok(d === want, `Start-Schwierigkeit ${o === MOBILE ? 'Handy' : 'Rechner'}: ${d}`); await x.ctx.close(); }
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('FIFA-Gefühl: erste Berührung in Stickrichtung (mit Sprint weiter vorgelegt, ohne Stick gestoppt), Gnadenfrist nach Ballverlust', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.autoswitch = false;
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true;
    const s = atkDir(0), [p, q] = teamP(0).filter(x => grpOf(x) === 'MF'), o = teamP(1).find(x => grpOf(x) === 'ST');
    const frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    const away = keep => { G.phase = 'play'; G.sp = null; G.offs = null; G.oneTwo = null; for (const x of G.players) if (!isGK(x) && !keep.includes(x)) place(x, CW / 2 + (x.team ? 38 : -30) * s, x.team ? 2 : CH - 2); for (const k in KEY) KEY[k] = false; };
    // erste Berührung: Pass von p zu q, beim Ankommen Stick nach oben (quer zur Passrichtung)
    const recv = (keys) => {
      away([p, q]); place(p, CW / 2, MY); place(q, CW / 2 + s * 10, MY); p.cd = q.cd = 0; G.ctrl = p; giveBall(p, true); readInput(1 / 60);
      pass(p, q); G.ctrl = q; let got = false;
      for (let i = 0; i < 120 && !got; i++) { for (const k of keys) KEY[k] = true; readInput(1 / 60); step(1 / 60); got = G.ball.owner === q; }
      const v = { got, vx: q.vx * s, vy: q.vy, sp: Math.hypot(q.vx, q.vy), lead: Math.hypot(G.ball.x - q.x, G.ball.y - q.y) };
      for (let i = 0; i < 12; i++) { readInput(1 / 60); step(1 / 60); }
      v.lead2 = +Math.hypot(G.ball.x - q.x, G.ball.y - q.y).toFixed(2); v.own = G.ball.owner === q; for (const k in KEY) KEY[k] = false; return v;
    };
    out.up = recv(['ArrowUp']); out.none = recv([]); out.sprint = recv(['ArrowUp', 'KeyW']);
    // Gnadenfrist: Ball wird dir weggespitzelt, du drückst gleich danach Pass
    const grace = wait => {
      away([p, q, o]); place(p, CW / 2, MY); place(q, CW / 2 + s * 10, MY - 4); place(o, CW / 2 + s * 1.5, MY + 1); p.cd = 0; G.ctrl = p; giveBall(p, true); frame();
      const b = G.ball; b.owner = null; b.state = 'free'; b.last = o; b.lastTeam = 1; b.kind = 'loose'; b.fid++; b.vx = 1; b.vy = 0.5; b.passer = null;
      for (let i = 0; i < wait; i++) frame();
      KEY.KeyS = KEYP.KeyS = true; frame(); KEY.KeyS = false; frame();
      return b.kind === 'pass' && b.last === p;
    };
    out.grace = grace(4); out.late = grace(20);
    return out;
  });
  ok(r.up.got && r.up.vy < -2.5 && r.up.sp > 3.5, 'erste Berührung geht nicht in Stickrichtung: ' + JSON.stringify(r));
  ok(r.none.got && r.none.sp < r.up.sp * 0.6, 'ohne Stick wird der Ball nicht gestoppt: ' + JSON.stringify(r));
  ok(r.sprint.got && r.sprint.sp > r.up.sp && r.sprint.lead2 > r.up.lead2 + 0.3 && r.sprint.own, 'mit Sprint nicht weiter vorgelegt: ' + JSON.stringify(r));
  ok(r.grace && !r.late, 'Gnadenfrist: ' + JSON.stringify([r.grace, r.late]));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Ausspielen und Flanken: Wendekreis nach Tempo, Körpertäuschung, Ausgespielt-Banner, Landepunkt beim Aufladen, Freistoß vom Flügel mit Zielvisier', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key'; SETTINGS.autoswitch = false;
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true;
    const s = atkDir(0), gx = goalX(0), c = teamP(0).find(x => grpOf(x) === 'MF'), st = teamP(0).find(x => grpOf(x) === 'ST'), [o1, o2] = teamP(1).filter(x => grpOf(x) === 'AB');
    const frame = () => { readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); };
    const away = keep => { G.phase = 'play'; G.sp = null; G.offs = null; G.banner = null; for (const x of G.players) if (!isGK(x) && !keep.includes(x)) place(x, CW / 2 + (x.team ? 38 : -30) * s, x.team ? 2 : CH - 2); for (const k in KEY) KEY[k] = false; };
    // Wendekreis: 90°-Haken aus vollem Lauf vs. aus vollem Sprint (0,1 s)
    const turn = sprint => { away([c]); place(c, CW / 2, MY); giveBall(c, true); c.gotT = G.t - 1; G.ctrl = c; const v = maxSpeed(c, sprint) * (sprint ? 0.93 : 0.85); c.vx = v * s; c.vy = 0;
      KEY.ArrowUp = true; KEY.KeyW = sprint; readInput(1 / 60); for (let i = 0; i < 6; i++) { movePlayer(c, 1 / 60); G.t += 1 / 60; } KEY.ArrowUp = KEY.KeyW = false;
      return Math.round(Math.abs(Math.atan2(c.vy, c.vx * s)) * 180 / Math.PI); };
    out.turnWalk = turn(false); out.turnSprint = turn(true);
    // Körpertäuschung: Haken, Verteidiger dicht vor dir (Zufall festgesetzt: gelingt)
    const feint = cut => { away([c, o1]); place(c, CW / 2, MY); giveBall(c, true); G.ctrl = c; c.feintT = -9; c.vx = 5 * s; c.vy = 0; place(o1, CW / 2 + s * 1.6, MY); o1.stun = 0;
      const r0 = Math.random; Math.random = () => 0; KEY[cut ? 'ArrowUp' : (s > 0 ? 'ArrowRight' : 'ArrowLeft')] = true; frame(); Math.random = r0; for (const k in KEY) KEY[k] = false; return o1.stun > 0.3; };
    out.feint = feint(true); out.straight = feint(false);
    // Ausgespielt: zwei Gegner eben noch vor dir, jetzt hinter dir
    away([c, o1, o2]); place(c, CW / 2, MY); giveBall(c, true); G.ctrl = c; c.feintT = G.t;
    place(o1, CW / 2 + s * 1.5, MY + 1); place(o2, CW / 2 + s * 2.2, MY - 1.2); o1.stun = o2.stun = 0; frame();
    place(o1, CW / 2 - s * 2, MY + 1); frame(); out.beat1 = c.beatN === 1 && o1.stun > 0.1;
    place(o2, CW / 2 - s * 2, MY - 1.2); frame(); out.banner = G.banner && G.banner.txt;
    // Landepunkt: Flanke vom Flügel halten, kurz = kurzer Pfosten, lang = langer Pfosten
    away([st]); place(st, gx - s * 22, MY + 20); giveBall(st, true); G.ctrl = st; st.cd = 0; frame();
    KEY.KeyA = KEYP.KeyA = true; for (let i = 0; i < 16; i++) frame(); const p1 = crossPreview(st); render();
    for (let i = 0; i < 30; i++) frame(); const p2 = crossPreview(st); KEY.KeyA = false; frame();
    out.prev = p1 && p2 ? { near: +Math.abs(p1.ty - MY).toFixed(1), far: +Math.abs(p2.ty - MY).toFixed(1), side: Math.sign(p1.ty - MY) === Math.sign(st.y - MY) && Math.sign(p2.ty - MY) !== Math.sign(st.y - MY) } : null;
    out.crossed = G.ball.kind === 'cross';
    // Seitenwechsel: von links auf rechts (Richtung zur anderen Seite halten), Ring zeigt die Landestelle beim Mitspieler drüben
    const [w1, w2] = teamP(0).filter(x => grpOf(x) === 'MF'); away([w1, w2]); place(w1, CW / 2 - s * 5, 6); place(w2, CW / 2 + s * 6, CH - 7); giveBall(w1, true); G.ctrl = w1; w1.cd = 0; frame();
    KEY.ArrowDown = true; KEY.KeyA = KEYP.KeyA = true; for (let i = 0; i < 25; i++) frame(); const sw = crossPreview(w1); KEY.KeyA = false; frame(); KEY.ArrowDown = false;
    out.switch = { prev: !!sw && sw.tgt === w2 && Math.abs(sw.ty - w2.y) < 6, flew: G.ball.kind === 'lob' && G.ball.passTo === w2 };
    // Gamepad: rechter Stick schiebt den Ring frei (0,5 s nach rechts = gut 13 m), der Ball fliegt dorthin
    away([w1, w2]); place(w1, CW / 2 - s * 5, 6); place(w2, CW / 2 + s * 6, CH - 7); giveBall(w1, true); G.ctrl = w1; w1.cd = 0; LASTIN = 'pad'; frame();
    const pf = () => { readInput(1 / 60); IN.rs = { x: s, y: 0 }; G.t += 1 / 60; humanControl(1 / 60); };
    KEY.KeyA = KEYP.KeyA = true; frame(); for (let i = 0; i < 30; i++) pf(); const g1 = crossPreview(w1), g0 = w1.lobBase && { tx: w1.lobBase.tx };
    KEY.KeyA = false; readInput(1 / 60); G.t += 1 / 60; humanControl(1 / 60); LASTIN = 'key';
    const GB = { ...G.ball }; let gl = null; for (let i = 0; i < 300 && !gl; i++) { ballPhys(GB, 1 / 60); if (GB.z < 2 && GB.vz < 0 && i > 10) gl = { x: GB.x, y: GB.y }; }
    out.pad = { moved: g0 && g1 ? +((g1.tx - g0.tx) * s).toFixed(1) : null, err: gl && g1 ? +Math.hypot(gl.x - g1.tx, gl.y - g1.ty).toFixed(1) : 99 };
    // Kopfball und Schuss: Ecke per rechtem Daumen (SCHUSS ziehen, Touch) oder rechtem Stick (Gamepad), der linke Stick bleibt frei
    const hd = (mode, dy) => { away([st]); place(st, gx - s * 8, MY); st.cd = 0; G.ctrl = st; const b = G.ball; b.owner = null; b.state = 'free'; b.x = st.x; b.y = st.y; b.z = 1.8; b.vx = 0; b.vy = 0; b.vz = -1; b.kind = 'cross'; b.shot = null;
      for (const k in KEY) KEY[k] = false; readInput(1 / 60); LASTIN = mode; TOUCH.aim = mode === 'touch' ? { dx: 0, dy } : null; IN.rs = mode === 'pad' ? { x: 0, y: dy / 40 } : null;
      header(st, true); const v = G.ball.vy; TOUCH.aim = null; IN.rs = null; LASTIN = 'key'; return Math.sign(Math.round(v * 10)); };
    out.head = [hd('touch', -40), hd('touch', 40), hd('pad', -40), hd('pad', 40)];
    away([st]); place(st, gx - s * 17, MY); giveBall(st, true); G.ctrl = st; st.cd = 0; LASTIN = 'pad'; frame();
    const shotPad = dy => { G.ball.shot = null; giveBall(st, true); st.chargeArm = false; st.charge = 0; KEY.Space = KEYP.Space = true; readInput(1 / 60); IN.rs = { x: 0, y: dy }; G.t += 1 / 60; humanControl(1 / 60); for (let i = 0; i < 10; i++) { readInput(1 / 60); IN.rs = { x: 0, y: dy }; G.t += 1 / 60; humanControl(1 / 60); }
      KEY.Space = false; readInput(1 / 60); IN.rs = { x: 0, y: dy }; G.t += 1 / 60; humanControl(1 / 60); return G.ball.shot ? Math.sign(Math.round(G.ball.vy * 10)) : 'kein Schuss'; };
    out.padShot = [shotPad(-1), shotPad(1)]; LASTIN = 'key';
    // Freistoß vom Flügel: Zielvisier statt Schussansicht, Flanke landet dort
    const fk = () => { startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; setupSetPiece('free', 0, gx - s * 19, MY + 23); G.phase = 'setpiece'; G.sp.t = 2; for (const k in KEY) KEY[k] = false; readInput(1 / 60); stepSetPiece(1 / 60); };
    fk(); out.fkAim = !aimWanted() && !!G.sp.caim; render();
    const A = { ...G.sp.caim }; KEY.KeyA = KEYP.KeyA = true; readInput(1 / 60); stepSetPiece(1 / 60); KEY.KeyA = false; readInput(1 / 60); stepSetPiece(1 / 60);
    out.fkCross = G.ball.kind === 'cross';
    const B = { ...G.ball }; let land = null; for (let i = 0; i < 200 && !land; i++) { ballPhys(B, 1 / 60); if (B.z < 2 && B.vz < 0 && i > 10) land = { x: B.x, y: B.y }; }
    out.fkErr = land ? +Math.hypot(land.x - A.x, land.y - A.y).toFixed(1) : 99;
    // zentral vor dem Tor bleibt es die Schussansicht
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; setupSetPiece('free', 0, gx - s * 22, MY + 3); G.phase = 'setpiece'; out.central = aimWanted();
    return out;
  });
  ok(r.turnWalk > 45 && r.turnSprint < 35, 'Wendekreis nach Tempo: ' + JSON.stringify(r));
  ok(r.feint && !r.straight, 'Körpertäuschung: ' + JSON.stringify(r));
  ok(r.beat1 && r.banner === 'AUSGESPIELT!', 'Ausgespielt: ' + JSON.stringify(r));
  ok(r.prev && r.prev.side && r.crossed, 'Landepunkt beim Aufladen (kurz = kurzer Pfosten, lang = langer Pfosten): ' + JSON.stringify(r));
  ok(r.switch.prev && r.switch.flew, 'Seitenwechsel mit Landestelle: ' + JSON.stringify(r.switch));
  ok(r.pad.moved > 10 && r.pad.err < 5, 'Gamepad: rechter Stick schiebt den Ring, Ball fliegt dorthin: ' + JSON.stringify(r.pad));
  ok(JSON.stringify(r.head) === '[-1,1,-1,1]' && JSON.stringify(r.padShot) === '[-1,1]', 'Kopfball/Schuss zielen mit rechtem Daumen bzw. rechtem Stick: ' + JSON.stringify([r.head, r.padShot]));
  ok(r.fkAim && r.fkCross && r.fkErr < 4.5 && r.central, 'Freistoß vom Flügel mit Zielvisier: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Kurznamen (#5): keine Abkürzung wie „Mün.“ und kein Strich am Anfang, Großstadt-Reserven mit Vereinskennung, eindeutig je Liga', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const bad = TEAMS.filter(t => /^[-–\/]/.test(t.short) || /\.$/.test(t.short) && t.short.length <= 7).map(t => t.n + ' → ' + t.short);
    const dup = []; for (const L of LIGEN) { const s = L.ids.map(i => TEAMS[i].short); s.forEach((x, i) => { if (s.indexOf(x) !== i) dup.push(x); }); }
    const want = { 'FC Teutonia Mün.': 'Teutonia', 'SC Germania Nbg.': 'Germania', 'Rhen. Rheindürkheim': 'Rheindürkheim', 'FSV Alem. Laubenheim': 'Laubenheim', 'Vikt. Neuenhaßlau': 'Neuenhaßlau',
      'FC Germ. Wächtersbach': 'Wächtersbach', 'Germ. Kl.-Krotzenburg': 'Kl.-Krotzenburg', 'SV Gr. Ellershausen/Hetj.': 'Ellershausen', 'TuS Westf. Neuenkirchen': 'Neuenkirchen',
      'BV Berg. Neukirchen': 'Neukirchen', 'TSV 54 - DJK München': 'DJK München', 'TSV 1860 München III': '1860 München III', 'TSV 1860 Staffelstein': 'Staffelstein' };
    const wrong = Object.entries(want).map(([n, w]) => { const t = TEAMS.find(x => x.n === n); return t && t.short !== w ? `${n} → ${t.short} (erwartet ${w})` : null; }).filter(Boolean);
    return { bad, dup, wrong };
  });
  ok(!r.bad.length, 'kaputte Kurznamen: ' + r.bad.join(', '));
  ok(!r.dup.length, 'doppelte Kurznamen in einer Liga: ' + r.dup.join(', '));
  ok(!r.wrong.length, r.wrong.join('; '));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('App: Manifest mit Icons, Offline-Cache – nach dem ersten Besuch startet das Spiel auch ohne Netz', async () => {
  const { createServer } = await import('node:http'); const { readFileSync, existsSync: ex } = await import('node:fs');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const srv = createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!ex(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
  await new Promise(res => srv.listen(0, 'localhost', res)); const port = srv.address().port;
  const ctx = await browser.newContext(MOBILE), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const man = JSON.parse(readFileSync(path.join(root, 'game', 'manifest.webmanifest'), 'utf8'));
    ok(man.start_url && man.display && man.icons.length >= 3 && man.icons.every(i => ex(path.join(root, 'game', i.src))), 'Manifest oder Icons fehlen');
    await page.goto(`http://localhost:${port}/game/`); 
    const sw = await page.evaluate(async () => { const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]); return !!(reg && reg.active); });
    ok(sw, 'Service Worker nicht aktiv');
    await page.waitForTimeout(500); await ctx.setOffline(true);
    await page.reload(); await page.waitForTimeout(800);
    ok(await page.evaluate(() => typeof G !== 'undefined' && !!G && !!menu.querySelector('.logo')), 'offline startet das Spiel nicht');
    ok(!errors.length, errors.join('; '));
  } finally { await ctx.close(); srv.close(); }
});

test('Ecken-Balance: Torwart kommt bei Flanken in den Fünfer heraus (fängt oder faustet), Ecken sind keine sicheren Tore mehr', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = { goals: 0, gk: 0, n: 40 };
    for (let n = 0; n < out.n; n++) {
      startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true; G.phase = 'play'; setupSetPiece('corner', 0, goalX(0) === CW ? CW - 0.3 : 0.3, n % 2 ? 0.3 : CH - 0.3); G.phase = 'setpiece'; G.sp.t = 2;
      for (const k in KEY) KEY[k] = false; readInput(1 / 60); stepSetPiece(1 / 60);
      KEY.Space = KEYP.Space = true; readInput(1 / 60); stepSetPiece(1 / 60); KEY.Space = false; readInput(1 / 60); stepSetPiece(1 / 60); G.phase = 'play'; G.sp = null;
      const g0 = G.score[0], gk = G.gk[1]; let touched = false;
      for (let i = 0; i < 60 * 4; i++) { KEY.Space = !!(G.ball.passTo && G.ball.passTo.team === 0 && G.ball.z > 0.8); if (KEY.Space) KEYP.Space = true; readInput(1 / 60); step(1 / 60); if (G.ball.last === gk || G.ball.owner === gk) touched = true; if (G.phase !== 'play') break; }
      out.goals += G.score[0] > g0; out.gk += touched;
    }
    return out;
  });
  ok(r.gk >= 4, 'Torwart greift bei Ecken nie ein: ' + JSON.stringify(r));
  ok(r.goals / r.n < 0.4, 'zu viele Tore aus Ecken: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Parade (#8): abgewehrter Ball („über die Latte“, „um den Pfosten“, ins Feld) geht nie direkt ins Tor', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = { n: 0, goals: 0, bad: [] };
    startMatch(L[0], L[1], { human: -1, flitzer: 0 }); G.paused = true;
    for (let i = 0; i < 400; i++) {
      G.phase = 'play'; G.sp = null; G.score = [0, 0];
      const g = G.gk[1], lx = ownX(1), s = atkDir(1), sh = teamP(0).find(q => grpOf(q) === 'ST'), b = G.ball;
      for (const p of G.players) if (p !== g) place(p, CW / 2, p.team ? 4 : CH - 4);
      const y = MY + rnd(-5, 5), dl = rnd(0.4, 3.5);
      place(g, lx + s * dl, y); g.act = null; g.stun = 0;
      Object.assign(b, { owner: null, x: lx + s * dl, y, z: rnd(1.0, 2.4), vx: -s * rnd(12, 22), vy: rnd(-2, 2), vz: rnd(-1, 2), passTo: null, kind: 'shot' }); b.fid++;
      b.shot = { by: sh, team: 0, t0: G.t, d: 15 }; b.plan = { g, ok: true, catchIt: false, done: false, fid: b.fid, at: G.t, y };
      resolveSave(g); out.n++;
      const z0 = b.z, vz0 = b.vz;
      for (let k = 0; k < 60 * 3 && G.phase === 'play'; k++) step(1 / 60);
      if (G.score[0] > 0) { out.goals++; if (out.bad.length < 3) out.bad.push({ z0: +z0.toFixed(2), vz0: +vz0.toFixed(2), dl: +dl.toFixed(2), y: +(y - MY).toFixed(2) }); }
    }
    return out;
  });
  ok(r.goals === 0, `${r.goals} von ${r.n} Paraden gingen trotzdem ins Tor: ` + JSON.stringify(r.bad));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

// Reddit-Feedback 2: „bis 2 m komme ich ran, dann Blitzpass“ und „zu viele Abpraller-Tore“
test('CPU unter Druck (merkt dich später, Fehlpass, Befreiungsschlag) und Abpraller (Parade zur Seite, Torwart am kurzen Pfosten)', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0, diff: 1 }); G.paused = true; G.phase = 'play'; G.sp = null;
    const s = atkDir(1), c = teamP(1).find(q => grpOf(q) === 'MF'), m = teamP(1).find(q => grpOf(q) === 'MF' && q !== c), h = teamP(0).find(q => grpOf(q) === 'MF');
    const away = keep => { G.phase = 'play'; G.sp = null; G.offs = null; G.ball.passTo = null; G.ball.shot = null; for (const q of G.players) if (!isGK(q) && !keep.includes(q)) place(q, CW / 2 - s * 30, q.team ? 2 : CH - 2); };
    // du stellst dich auf 2 m vor sie, ein Mitspieler steht schräg hinter ihr frei: in den ersten 0,2 s spielt die CPU nicht ab (vorher: sofort)
    let early = 0; for (let i = 0; i < 60; i++) {
      away([c, m, h]); place(c, CW / 2, MY); place(m, CW / 2 - s * 6, MY + 8); place(h, CW / 2 + s * 2, MY); G.ctrl = h; G.poss = 1; G.ball.owner = null; giveBall(c, true); c.settleT = 0; c.think = 0;
      for (let f = 0; f < 12; f++) { G.t += 1 / 60; place(h, CW / 2 + s * 2, MY); carrierAI(c, 1 / 60); if (G.ball.owner !== c) { early++; break; } }
    }
    out.early = early;
    // Fehlpass unter Druck: Richtungsfehler mit dir dicht dran deutlich größer als frei
    const devs = near => { let sum = 0; for (let i = 0; i < 300; i++) {
      away([c, m, h]); place(c, CW / 2, MY); place(m, CW / 2 + s * 12, MY); place(h, near ? CW / 2 - s * 0.8 : CW / 2 - s * 20, MY + 0.3); G.ball.owner = null; giveBall(c, true);
      pass(c, m); sum += Math.abs(Math.atan2(G.ball.vy, G.ball.vx * s)); } return sum / 300; };
    out.dev = [devs(false), devs(true)];
    // Panik: in der eigenen Hälfte bedrängt haut die CPU den Ball auch mal blind raus
    let clears = 0; const oc = window.clearBall; window.clearBall = p => { clears++; return oc(p); };
    for (let i = 0; i < 150; i++) { away([c, m, h]); const ox = ownX(1); place(c, ox + s * 30, MY + 8); place(m, ox + s * 45, MY - 10); place(h, ox + s * 29.2, MY + 8); G.poss = 1; giveBall(c, true); c.settleT = 0; c.think = 0; c.pressT = G.t - 1; carrierAI(c, 1 / 60); }
    window.clearBall = oc; out.clears = clears;
    // Parade ins Feld: landet selten zentral vor dem Tor
    let near = 0, n = 0; const g = G.gk[1], lx = ownX(1), sh = teamP(0).find(q => grpOf(q) === 'ST');
    for (let i = 0; i < 300; i++) {
      away([g, sh]); const y = MY + rnd(-1.2, 1.2), b = G.ball; place(g, lx + s * 0.6, y); g.act = null; g.stun = 0;
      Object.assign(b, { owner: null, x: lx + s * 0.6, y, z: rnd(0.3, 1.2), vx: -s * rnd(14, 22), vy: rnd(-2, 2), vz: rnd(-1, 1), passTo: null, kind: 'shot' }); b.fid++;
      b.shot = { by: sh, team: 0, t0: G.t, d: 12 }; b.plan = { g, ok: true, catchIt: false, done: false, fid: b.fid, at: G.t, y };
      resolveSave(g); if (b.kind !== 'parry') continue; n++;
      const o = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, spin: 0 }; for (let k = 0; k < 90; k++) ballPhys(o, 1 / 60);
      if (Math.abs(o.x - lx) < 11 && Math.abs(o.y - MY) < 9) near++;
    }
    out.parryNear = near / Math.max(1, n);
    // Torwart: Ball 5 m vor der Linie, 8 m seitlich – er rückt zum kurzen Pfosten (vorher 0,7 m neben der Mitte)
    away([g]); G.ball.owner = null; Object.assign(G.ball, { x: lx + s * 5, y: MY + 8, z: 0, vx: 0, vy: 0, vz: 0 }); out.gkY = gkSpot(g)[1] - MY;
    return out;
  });
  ok(r.early <= 6, 'CPU spielt weiter sofort ab, wenn du auf 2 m ran bist: ' + JSON.stringify(r));
  ok(r.dev[1] > r.dev[0] * 1.8, 'unter Druck nicht ungenauer: ' + JSON.stringify(r));
  ok(r.clears >= 10, 'kein Befreiungsschlag in der Not: ' + JSON.stringify(r));
  ok(r.parryNear < 0.35, 'Paraden landen zu oft zentral vor dem Tor: ' + JSON.stringify(r));
  ok(r.gkY > 1.3, 'Torwart steht bei Ball von schräg nicht am kurzen Pfosten: ' + JSON.stringify(r));
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
    // Texte unten (Kraftbalken) dürfen sich nicht überlappen (iPhone: „WENIG = BOGEN …“ lag über „KRAFT“)
    const T = [], ft = ctx.fillText;
    ctx.fillText = function (s, x, y) { const w = this.measureText(s).width, a = this.textAlign; T.push({ s, x: a === 'center' ? x - w / 2 : a === 'right' ? x - w : x, y, w, h: parseInt(this.font) }); return ft.call(this, s, x, y); };
    try { render(); } finally { ctx.fillText = ft; }
    const own = T.filter(t => !T.some(u => u !== t && u.s === t.s && u.x === t.x - 1 && u.y === t.y - 1)), maxY = Math.max(...own.map(t => t.y)), low = own.filter(t => t.y > maxY - 40 && t.s.trim());
    out.overlap = low.flatMap((a, i) => low.slice(i + 1).filter(b => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).map(b => a.s + ' / ' + b.s));
    out.low = low.map(t => t.s);
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
  ok(!r.overlap.length && r.low.includes('BOGEN'), 'Freistoß: Texte unten überlappen: ' + JSON.stringify([r.overlap, r.low]));
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

test('Langer Ball nach vorn: ohne Taste nimmt dein Spieler ihn mit der Brust an und läuft weiter, mit Schuss-Taste köpft er; Flanke im Strafraum bleibt Kopfball', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    SETTINGS.keys = 'legenden'; LASTIN = 'key';
    const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, out = {};
    startMatch(L[0], L[1], { human: 0, flitzer: 0 }); G.paused = true;
    const s = atkDir(0), gx = goalX(0), mf = teamP(0).find(q => grpOf(q) === 'MF'), st = teamP(0).find(q => grpOf(q) === 'ST');
    const run = (tx, ty, press, kind = 'lob') => {
      G.phase = 'play'; G.sp = null; G.offs = null; G.ball.shot = null; for (const k in KEY) KEY[k] = false;
      for (const q of G.players) if (!isGK(q) && q !== mf && q !== st) place(q, q.team ? gx - s * 2 : CW / 2 - s * 20, q.team ? (q.num % 2 ? 2 : CH - 2) : CH - 2);
      place(mf, tx - s * 28, ty); place(st, tx, ty); st.cd = 0; st.queue = null; mf.cd = 0; G.ctrl = mf; giveBall(mf, true);
      // hoher Ball, der in Kopfhöhe bei ihm ankommt (langer Ball, Befreiungsschlag nach vorn oder Flanke)
      const b = G.ball; kickBall(mf, kind, 0.4); launchAir(st.x + s * 0.3, st.y, 1.7, 1.4); b.passer = mf; if (kind !== 'clear') { b.passTo = st; noteRecv(st, st.x, st.y); }
      G.ctrl = st; let headed = false, got = false;
      for (let i = 0; i < 200 && !got && !headed; i++) {
        const eta = dist(st.x, st.y, G.ball.x, G.ball.y) / Math.max(2, Math.hypot(G.ball.vx, G.ball.vy));
        if (press && eta < 0.8 && !st.queue && !KEY.Space) { KEY.Space = KEYP.Space = true; } else KEY.Space = false;   // kurz vor der Ankunft Schuss drücken
        readInput(1 / 60); step(1 / 60);
        if (G.ball.kind === 'head' || (G.ball.shot && G.ball.shot.header) || (st.act && st.act.type === 'head')) headed = true;
        if (G.ball.owner === st) got = true;
      }
      // nach der Annahme läuft er mit dem Ball weiter in Stickrichtung
      let moved = 0; if (got) { const x0 = st.x; KEY[s > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; for (let i = 0; i < 30; i++) { readInput(1 / 60); step(1 / 60); } moved = (st.x - x0) * s; KEY.ArrowRight = KEY.ArrowLeft = false; }
      return { got, headed, moved: +moved.toFixed(1), own: G.ball.owner === st };
    };
    out.mid = run(CW / 2 + s * 12, MY - 6, false, 'clear'); // Befreiungsschlag nach vorn, in Kopfhöhe
    out.box = run(gx - s * 14, MY + 3, false);              // langer hoher Ball an die Strafraumgrenze
    out.press = run(CW / 2 + s * 12, MY - 6, true);         // mit Schuss-Taste vorgemerkt: Kopfball
    out.cross = run(gx - s * 9, MY + 2, false, 'cross');    // Flanke in den Strafraum: Kopfball wie bisher
    return out;
  });
  ok(r.mid.got && !r.mid.headed && r.mid.moved > 2, 'langer Ball wird nicht angenommen oder er läuft nicht weiter: ' + JSON.stringify(r));
  ok(r.box.got && !r.box.headed, 'langer Ball an den Strafraum wird geköpft statt angenommen: ' + JSON.stringify(r));
  ok(r.press.headed, 'mit Schuss-Taste kein Kopfball: ' + JSON.stringify(r));
  ok(r.cross.headed, 'Flanke im Strafraum wird nicht geköpft: ' + JSON.stringify(r));
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

test('Saison: Entwicklungspunkte – Training und starke Spiele bringen Punkte, du verteilst sie auf der Spielerkarte, Rest setzt das Training am Saisonende; Fitness in ganzen Prozent', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    NEWC.team = HOME_TEAM; ACT.ncGo(); const C = CAREER, sq = ensureSquad(C.team), out = {};
    const st = sq.find(q => q.grp === 'ST'), gk = sq.find(q => q.grp === 'TW');
    // Training: die Verbesserung landet als Punkt beim Spieler, nicht mehr direkt in einem Wert
    const sum = p => ATTRS.reduce((s, a) => s + p[a], 0), before = sq.map(sum);
    for (const p of sq) { p.dp = 0; p.pot = 95; p.ageAdj = 0; p.age = 19; }
    const oR = Math.random; Math.random = () => 0.01; trainStep(); Math.random = oR;
    out.trainPts = sq.every(p => p.dp === 1) && sq.every((p, i) => sum(p) === before[i]);
    // das Kreisblatt meldet neue Punkte, der KADER-Reiter zeigt sie an
    out.news = C.news[0] && C.news[0].h.includes('verbessern') && /Kader/.test(C.news[0].t);
    ACT.ctab('elf'); const tb = menu.querySelector('[data-act="ctab"][data-arg="kader"] .badge.dp'); out.tab = !!tb && tb.textContent === '+' + sq.length;
    // Karte ohne Punkte erklärt, woher sie kommen
    const nb = sq.find(q => q !== st); nb.dp = 0; ACT.cplayer(nb.pid); out.hint = /keine offen/.test(menu.textContent) && !menu.querySelector('[data-act="cdp"]');
    // Verteilen: + auf der Spielerkarte hebt den Wert um 1
    const t0 = st.tmp, o0 = st.ovr; ACT.cplayer(st.pid); out.btns = menu.querySelectorAll('[data-act="cdp"]').length;
    out.noTw = !menu.querySelector(`[data-act="cdp"][data-arg="${st.pid}|tw"]`);
    menu.querySelector(`[data-act="cdp"][data-arg="${st.pid}|tmp"]`).click();
    out.spent = st.tmp === t0 + 1 && st.dp === 0 && st.ovr >= o0 && !menu.querySelector('[data-act="cdp"]');
    out.fieldTw = spendDP(Object.assign(st, { dp: 1 }), 'tw') === false; st.dp = 0;
    out.gkTw = spendDP(Object.assign(gk, { dp: 1 }), 'tw') === true;
    // Obergrenze 95
    st.dp = 1; st.sch = 95; out.cap = spendDP(st, 'sch') === false && st.sch === 95; st.dp = 0;
    // Kader zeigt offene Punkte
    sq[3].dp = 2; ACT.ctab('kader'); out.badge = !!menu.querySelector('.badge.dp');
    // offene Punkte bleiben die ganze Saison liegen (auch beim Simulieren) …
    const m = sq.find(q => q.grp === 'MF'); C.train = 'absch'; m.dp = 2; m.pot = 30; m.sch = 60; m.kop = 60;
    Math.random = () => 0.99; for (let i = 0; i < 30; i++) trainStep(); Math.random = oR;
    out.keep = m.dp === 2 && m.sch + m.kop === 120;
    // … erst am Saisonende verteilt das Training nach dem Schwerpunkt (Torabschluss = Schuss/Kopfball)
    autoDP(m); out.auto = m.dp === 0 && m.sch + m.kop === 122;
    // starkes Spiel: Spieler des Spiels bekommt einen Bonuspunkt (nur eigener Verein)
    const opp = LIGEN[C.lg].ids.find(i => i !== C.team); for (const p of sq) p.dp = 0;
    const st2 = sq.find(q => q.grp === 'ST'), oppSq = ensureSquad(opp); for (const p of oppSq) p.dp = 0;
    const xi = matchSquad(C.team).xi, live = { [C.team]: xi.map(p => ({ p, g: 0, a: 0, note: 3.5, potm: p === st2 })), [opp]: matchSquad(opp).xi.map(p => ({ p, g: 1, a: 0, note: 1, potm: false })) };
    applyGame(C.team, opp, 1, 1, live);
    out.potm = st2.dp === 1 && oppSq.every(p => !p.dp);
    // Fitness bleibt in ganzen Prozent (Ausdauer 67 brachte 97,59999… %)
    for (const p of sq) { p.fit = 83; p.aus = 67; } betweenGames([C.team]); out.fitInt = sq.every(p => Number.isInteger(p.fit)); ACT.ctab('elf'); out.noDec = !/\d\.\d+%/.test(menu.textContent);
    return out;
  });
  ok(r.trainPts, 'Training gibt keine Punkte oder ändert Werte direkt: ' + JSON.stringify(r));
  ok(r.btns >= 7 && r.noTw && r.spent && r.fieldTw && r.gkTw && r.cap, 'Verteilen auf der Spielerkarte: ' + JSON.stringify(r));
  ok(r.badge && r.tab && r.news && r.hint, 'Offene Punkte nicht sichtbar (Kader, Reiter, Kreisblatt, Karte): ' + JSON.stringify(r));
  ok(r.keep && r.auto, 'Punkte verschwinden vor Saisonende oder Training verteilt nicht: ' + JSON.stringify(r));
  ok(r.potm, 'Bonuspunkt für starkes Spiel (nur eigener Verein): ' + JSON.stringify(r));
  ok(r.fitInt && r.noDec, 'Fitness mit Nachkommastellen: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

// Issue #19: Spielerkarte und Editor des Torwarts stürzten ab (Vereinstrikot ohne Torwartfarbe)
test('Saison: Spielerkarte und Bearbeiten öffnen auch beim Torwart', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    NEWC.team = HOME_TEAM; ACT.ncGo(); const gk = CAREER.squads[CAREER.team].find(q => q.grp === 'TW'), out = {};
    try { ACT.cplayer(gk.pid); out.card = menu.textContent.includes(gk.name) && !!menu.querySelector(`canvas[data-pid="${gk.pid}"]`); } catch (e) { out.card = 'Fehler: ' + e.message; }
    try { ACT.cpEdit(gk.pid); out.edit = !!menu.querySelector('#pe_name') && menu.querySelector('#pe_name').value === gk.name; ACT.peCancel(); } catch (e) { out.edit = 'Fehler: ' + e.message; }
    try { for (const t of ['kader', 'elf']) ACT.ctab(t); out.kader = true; } catch (e) { out.kader = 'Fehler: ' + e.message; }
    return out;
  });
  ok(r.card === true && r.edit === true && r.kader === true, 'Torwart: ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Saison: eigenen Verein anlegen, Spieler bearbeiten (Name, Nummer, Alter, Beruf, Position, Aussehen), nach Neuladen alles noch da', async () => {
  const { page, ctx, errors } = await open();
  await page.evaluate(() => { ACT.career(); ACT.ncEigen(); });
  await page.fill('#eg_n', 'SV Musterdorf 1920'); await page.click('[data-act="eigCol"][data-arg="c1|#141414"]'); await page.click('[data-act="eigCol"][data-arg="c2|#ffd200"]');
  await page.click('[data-act="eigSave"]');
  const a = await page.evaluate(() => { const t = TEAMS[NEWC.team]; ACT.ncGo(); return { n: t.n, k: t.k, custom: !!t.custom, inLiga: LIGEN[t.lg].ids.includes(t.id), career: TEAMS[CAREER.team].n, tbl: Object.keys(CAREER.S.tables[CAREER.lg]).map(Number).includes(t.id) }; });
  ok(a.custom && a.k === 'MUS' && a.inLiga && a.tbl && a.career === 'SV Musterdorf 1920', 'eigener Verein: ' + JSON.stringify(a));
  await page.evaluate(() => { const p = ensureSquad(CAREER.team).find(q => q.grp === 'MF'); window.__pid = p.pid; window.__age = p.age; ACT.cpEdit(p.pid); });
  await page.fill('#pe_name', 'Wilhelm'); await page.fill('#pe_num', '10'); await page.fill('#pe_age', '41'); await page.fill('#pe_job', 'Kreisliga-Legende'); await page.click('[data-act="peGrp"][data-arg="ST"]'); await page.click('[data-act="peBeard"]');
  await page.click('[data-act="peSave"]');
  await page.evaluate(() => { localStorage.setItem('__pid', String(__pid)); localStorage.setItem('__age', String(__age)); });
  await page.reload(); await page.waitForTimeout(600);
  const b = await page.evaluate(() => { ACT.career(); const p = playerById(+localStorage.getItem('__pid')); return { team: CAREER && TEAMS[CAREER.team].n, name: p && p.name, num: p && p.num, grp: p && p.grp, age: p && p.age, job: p && p.job, dev: p && devAge(p) === +localStorage.getItem('__age'), card: p && (showPlayer(p.pid), menu.textContent.includes('41 Jahre · Kreisliga-Legende')), nums: new Set(ensureSquad(CAREER.team).map(q => q.num)).size === ensureSquad(CAREER.team).length }; });
  ok(b.team === 'SV Musterdorf 1920' && b.name === 'Wilhelm' && b.num === 10 && b.grp === 'ST' && b.age === 41 && b.job === 'Kreisliga-Legende' && b.dev && b.card && b.nums, 'nach Neuladen: ' + JSON.stringify(b));
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
    menu.scrollTop = 200; stickyGap(); out.fold = getComputedStyle(menu.querySelector('.chead')).display === 'none' && inView('.ctabs');   // Kopfzeile klappt beim Scrollen ein, Reiter bleiben
    ACT.main(); ACT.qstart(); G.phase = 'play'; G.sp = null; pop(); out.pause = !menu.hidden && G.paused && INGAME_MENU;
    pop(); out.resume = menu.hidden && !G.paused;
    const L = ORD_LOOK(0), s = sprite(L, 'run', 2), d = s.getContext('2d').getImageData(0, 0, SW, SH).data;
    let pants = 0; for (let y = AY - 8; y < AY - 2; y++) for (let x = 0; x < SW; x++) { const i = (y * SW + x) * 4; if (d[i + 3] && d[i] === 0x2a && d[i + 1] === 0x2d) pants++; }
    out.pants = pants > 3;
    return out;
  });
  for (const k of ['quick', 'back', 'newc', 'hub', 'fold', 'pause', 'resume', 'pants']) ok(r[k], k + ': ' + JSON.stringify(r));
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Was ist neu: einmal pro Update nur für Wiederkehrer, Tasten passend zur Eingabe, danach Hauptmenü; Neue sehen es nie', async () => {
  const { page, ctx, errors } = await open();
  const r = await page.evaluate(() => {
    const out = {};
    store.del(NEWS_KEY); PROF.games = 0; store.del(TUT_KEY); ACT.main(); out.fresh = !menu.querySelector('.news') && store.get(NEWS_KEY) === NEWS[0].id;
    store.del(NEWS_KEY); PROF.games = 3; SETTINGS.keys = 'legenden'; LASTIN = 'key'; ACT.main();
    out.shown = !!menu.querySelector('.news'); out.items = menu.querySelectorAll('.newsl li').length; out.txt = menu.querySelector('.news') ? menu.querySelector('.news').textContent : '';
    out.focus = document.activeElement && document.activeElement.textContent;
    menu.querySelector('[data-act="main"]').click(); out.menu = !menu.querySelector('.news') && !!menu.querySelector('[data-act="quick"]');
    ACT.main(); out.once = !menu.querySelector('.news');
    store.set(NEWS_KEY, 1); ACT.main(); out.next = menu.querySelectorAll('.newsl li').length; ACT.main();
    // unterbrochenes Spiel gespeichert: erst FORTSETZEN, die Neuigkeiten kommen beim nächsten Mal
    store.del(NEWS_KEY); const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; startMatch(L[0], L[1], { human: 0 }); G.paused = true; G.clock = 30; saveMatch();
    ACT.main(); out.resume = !!savedMatch() && !menu.querySelector('.news') && !!menu.querySelector('[data-act="resumeMatch"]') && store.get(NEWS_KEY) !== NEWS[0].id;
    return out;
  });
  ok(r.fresh, 'Neue Spieler sehen das Was-ist-neu-Fenster: ' + JSON.stringify(r));
  ok(r.shown && r.items === 3 && r.txt.includes('Entwicklungspunkte') && r.txt.includes('Mehr Tore') && r.txt.includes('CPU unter Druck'), 'Was-ist-neu fehlt oder falsche Tasten: ' + JSON.stringify(r));
  ok(r.next === 3, 'wer Stand 1 schon kennt, sieht nur das Neue (höchstens drei): ' + JSON.stringify(r));
  ok(r.focus === "LOS GEHT'S" && r.menu && r.once && r.resume, 'Was-ist-neu: Knopf, Hauptmenü danach oder nur einmal: ' + JSON.stringify(r));
  const shot = await page.screenshot(); ok(shot.length > 1000, 'Screenshot');
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
    const labs = el ? [...el.querySelectorAll('.lab b')].map(b => b.textContent).join(',') : '';
    const boxes = [...document.querySelectorAll('#ttip .cmtop, #ttip .lab, #stick, .tb-a, .tb-b')].map(e => e.getBoundingClientRect()); let overlap = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top) overlap++; }
    closeTouchTip(); G.phase = 'play'; return { ok: on && !G.paused, labs, overlap }; });
  ok(tip.overlap === 0, 'Touch-Tipp: Kästen überlappen sich oder die Knöpfe: ' + tip.overlap);
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
  // Stick: im Kreis laufen (55 px = volles Lauftempo, kein Sprint), über den Kreis hinaus (85 px) = Sprint
  const stickAt = async d => { const x0 = 140, y0 = 260; await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + d * i / 6, y0); await page.waitForTimeout(60);
    const v = await page.evaluate(() => ({ x: +TOUCH.x.toFixed(2), s: TOUCH.s, ring: getComputedStyle(document.getElementById('stick'), '::after').opacity })); await page.mouse.up(); await page.waitForTimeout(60); return v; };
  const walk = await stickAt(55), run = await stickAt(85);
  ok(walk.x === 1 && !walk.s && run.s && +walk.ring > 0.5, 'Stick: Sprint erst außerhalb des Kreises: ' + JSON.stringify([walk, run]));
  // größere Trefferfläche: knapp neben dem Kreis (12 px außerhalb, zur Bildschirmmitte hin) zählt als PASS
  await page.evaluate(() => { G.phase = 'play'; G.sp = null; const p = teamP(0).find(q => grpOf(q) === 'MF'); for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, 3); place(p, CW / 2, MY); giveBall(p, true); G.ctrl = p; p.cd = 0; });   // Gegner weg: sonst nimmt einer im Live-Spiel manchmal vorher den Ball ab
  await page.waitForTimeout(150);
  const nearPt = await page.evaluate(() => { const r = document.querySelector('.tb-a').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = r.width / 2 + 12; return { x: cx - d * 0.8, y: cy - d * 0.6, hit: (document.elementFromPoint(cx - d * 0.8, cy - d * 0.6) || {}).id }; });
  const p1 = await page.evaluate(() => G.stats.passes[0]);
  await page.touchscreen.tap(nearPt.x, nearPt.y);
  const nearOk = await page.waitForFunction(p1 => G.stats.passes[0] > p1, p1, { timeout: 2000, polling: 'raf' }).then(() => true, () => false);
  const dbg = await page.evaluate(() => ({ own: G.ball.owner && G.ball.owner.team, ph: G.phase, li: LASTIN }));
  ok(nearPt.hit === 'zone' && nearOk, 'Tipp knapp neben PASS zählt nicht: ' + JSON.stringify([nearPt, dbg]));
  // Pause-Knopf oben rechts: sichtbar, antippen pausiert, WEITER spielt weiter
  const pz = await page.evaluate(() => { const r = document.getElementById('tbPause').getBoundingClientRect(); return { w: r.width, x: r.right, y: r.top, vw: innerWidth }; });
  ok(pz.w > 30 && pz.x > pz.vw - 80 && pz.y < 80, 'Pause-Knopf oben rechts fehlt: ' + JSON.stringify(pz));
  await page.touchscreen.tap(pz.x - pz.w / 2, pz.y + pz.w / 2); await page.waitForTimeout(120);
  const pzOn = await page.evaluate(() => G.paused && !menu.hidden);
  await page.evaluate(() => menu.querySelector('[data-act="resume"]').click()); await page.waitForTimeout(120);
  const pzOff = await page.evaluate(() => !G.paused && menu.hidden);
  ok(pzOn && pzOff, 'Pause-Knopf pausiert nicht oder WEITER geht nicht: ' + pzOn + '/' + pzOff);
  const nv = await page.evaluate(() => { const e = document.createElement('div'); e.id = 'newver'; document.body.appendChild(e); const p = getComputedStyle(e).position; e.remove(); return p; });
  ok(nv === 'fixed', 'Hinweis „neue Version“ ohne Gestaltung: ' + nv);
  // gedrückt halten und ziehen: Angriff PASS ziehen = Flanke/hoher Ball, SCHUSS aufladen und ziehen = Schlenzer; Abwehr TACKLING ziehen = Grätsche, tippen = Tackling
  const ctr = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const drag = async (sel, dx, dy, hold = 60) => { const c = await ctr(sel); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.move(c.x + dx / 2, c.y + dy / 2); await page.mouse.move(c.x + dx, c.y + dy); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(60); };
  const setup = () => page.evaluate(() => { G.phase = 'play'; G.sp = null; G.ball.shot = null; const p = teamP(0).find(q => grpOf(q) === 'ST'); place(p, goalX(0) - atkDir(0) * 18, MY + 3); for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, 3); giveBall(p, true); G.ctrl = p; p.cd = 0; tbMode = ''; });
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 4, -55);
  const hi = await page.evaluate(() => ['lob', 'cross'].includes(G.ball.kind) && !G.ball.owner);
  ok(hi, 'PASS nach oben wischen spielt keinen hohen Ball');
  // nach oben ziehen und halten: Ring mit der Landestelle, der Ball fliegt erst beim Loslassen
  await setup(); await page.waitForTimeout(80);
  { const c = await ctr('.tb-a'); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.move(c.x + 2, c.y - 30); await page.mouse.move(c.x + 4, c.y - 55); await page.waitForTimeout(450);
    const held = await page.evaluate(() => { const P = crossPreview(G.ctrl); return { prev: !!P, x: P && P.tx, own: !!G.ball.owner, lbl: document.querySelector('.tb-a span').textContent }; });
    // rechter Daumen schiebt den Ring: 60 px nach rechts = 15 m
    await page.mouse.move(c.x + 34, c.y - 55); await page.mouse.move(c.x + 64, c.y - 55); await page.waitForTimeout(120);
    const ring = await page.evaluate(() => { const P = crossPreview(G.ctrl); return P && { x: P.tx, y: P.ty }; });
    await page.mouse.up();
    const flew0 = await page.waitForFunction(() => ['lob', 'cross'].includes(G.ball.kind) && !G.ball.owner, null, { timeout: 1500, polling: 'raf' }).then(() => true, () => false);
    const fl = await page.evaluate(([ring, flew]) => { const B = { ...G.ball }; let land = null; for (let i = 0; i < 300 && !land; i++) { ballPhys(B, 1 / 60); if (B.z < 2 && B.vz < 0) land = { x: B.x, y: B.y }; }
      return { flew, err: land && ring ? +Math.hypot(land.x - ring.x, land.y - ring.y).toFixed(1) : 99 }; }, [ring, flew0]);
    ok(held.prev && held.own && held.lbl === 'HOCH' && ring && Math.abs(ring.x - held.x - 15) < 1 && fl.flew && fl.err < 5, 'PASS nach oben ziehen und halten: Ring, rechter Daumen schiebt ihn, Ball fliegt beim Loslassen dorthin: ' + JSON.stringify([held, ring, fl])); }
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 55, 5);
  const th = await page.evaluate(() => G.ball.kind === 'through' && !G.ball.owner);
  ok(th, 'PASS zur Seite wischen spielt keinen Steilpass');
  await setup(); await page.waitForTimeout(80);
  await drag('.tb-a', 10, 12, 60);   // kleines Verrutschen beim Tippen: flacher Pass, kein hoher Ball
  const flat = await page.evaluate(() => ({ k: G.ball.kind, own: !!G.ball.owner, z: G.ball.z }));
  ok(flat.k === 'pass', 'leichtes Verrutschen beim Tippen wird zum hohen Ball: ' + JSON.stringify(flat));
  // SCHUSS halten und Daumen ziehen = zielen (wie Padel-Legenden): nach oben = Ecke oben im Bild, nach unten = Ecke unten
  const aimShot = async dy => { await page.evaluate(() => { G.phase = 'play'; G.sp = null; G.ball.shot = null; const p = teamP(0).find(q => grpOf(q) === 'ST'); place(p, goalX(0) - atkDir(0) * 18, MY); for (const o of teamP(1)) if (!isGK(o)) place(o, CW / 2, 3); giveBall(p, true); G.ctrl = p; p.cd = 0; tbMode = ''; }); await page.waitForTimeout(80); await drag('.tb-b', 0, dy, 150); return page.evaluate(() => G.ball.shot ? G.ball.vy : null); };
  const vUp = await aimShot(-60), vDown = await aimShot(60);
  ok(vUp != null && vDown != null && vUp < 0 && vDown > 0, 'Zielen mit dem Daumen: ' + vUp + ' / ' + vDown);
  const def = () => page.evaluate(() => { G.phase = 'play'; G.sp = null; SETTINGS.autoswitch = false;   // Live-Spiel: kein Auto-Wechsel weg vom Verteidiger, wenn der Test länger braucht
    const a = teamP(1).find(q => grpOf(q) === 'ST'), d = teamP(0).find(q => grpOf(q) === 'AB'); for (const q of G.players) if (q !== a && q !== d && !isGK(q)) place(q, q.team ? 8 : CW - 8, 3); place(a, CW / 2, MY); a.hx = -1; a.hy = 0; giveBall(a, true); a.think = 9; a.cd = 99; /* kein Übersteiger des Stürmers, der den Verteidiger stolpern lässt (seit #26 dribbelt er unter Druck kurz weiter) */ a.vx = a.vy = 0; place(d, CW / 2 + 1.5, MY); d.cd = 0; d.stun = 0; d.act = null; G.ctrl = d; G.manT = G.t; tbMode = ''; window.__d = d;
    // Versuche des Verteidigers direkt mitzählen: auf einem langsamen Rechner ist das Tackling bis zur Prüfung oft schon wieder vorbei (Abklingzeit, Stolpern, Ball zurückerobert)
    window.__tk = 0; window.__sl = 0;
    if (!window.__tkHook) { window.__tkHook = 1; const oT = window.tackle, oS = window.slide;
      window.tackle = (x, ...r) => { const c0 = x.cd; const v = oT(x, ...r); if (x === window.__d && x.cd > 0 && !(c0 > 0)) window.__tk++; return v; };
      window.slide = (x, ...r) => { const c0 = x.cd; const v = oS(x, ...r); if (x === window.__d && x.cd > 0 && !(c0 > 0)) window.__sl++; return v; }; } });
  await def(); await page.waitForTimeout(80);
  const lb = await page.evaluate(() => document.querySelector('.tb-b span').textContent);
  ok(lb === 'TACKLING', 'Abwehr-Beschriftung: ' + lb);
  await drag('.tb-b', 0, -40);
  await page.waitForFunction(() => __sl > 0, null, { timeout: 1000 }).catch(() => {});
  const sl = await page.evaluate(() => ({ ok: __sl > 0, ctrl: G.ctrl === __d, act: __d.act && __d.act.type, cd: +__d.cd.toFixed(2), own: G.ball.owner && G.ball.owner.team, ph: G.phase }));
  ok(sl.ok, 'TACKLING ziehen grätscht nicht: ' + JSON.stringify(sl));
  await def(); await page.waitForTimeout(80);
  // Tippen = Tackling: sofort, wenn er dran ist, sonst per Anlauf (der CPU-Stürmer sichert nach dem Ballgewinn erst und dribbelt ein Stück) – bis zu 1 s warten
  const c = await ctr('.tb-b'); await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => __tk > 0, null, { timeout: 1000 }).catch(() => {});
  const tk = await page.evaluate(() => ({ ok: __tk > 0, act: __d.act, cd: __d.cd, ph: G.phase, ctrl: G.ctrl === __d, own: G.ball.owner && G.ball.owner.team, LASTIN, lbl: document.querySelector('.tb-b span').textContent, cls: document.querySelector('.tb-b').className }));
  ok(tk.ok, 'TACKLING tippen tackelt nicht ' + JSON.stringify(tk));
  // TACKLING halten = stellen: der Verteidiger hält Abstand zwischen Gegner und Tor und tackelt nicht sofort
  await def(); await page.evaluate(() => { const a = G.ball.owner; place(__d, a.x + 5, a.y + 3); __d.d.ms.tk = 0; });
  { const c = await ctr('.tb-b'); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(450);
    const st = await page.evaluate(() => ({ contain: !!__d.contain && __d.contain === G.ball.owner, tk: !!(__d.act && __d.act.type === 'tackle'), lbl: document.querySelector('.tb-b span').textContent }));
    await page.mouse.up(); await page.waitForTimeout(80);
    const after = await page.evaluate(() => !__d.contain);
    ok(st.contain && !st.tk && after, 'TACKLING halten stellt nicht: ' + JSON.stringify(st)); }
  ok(!errors.length, errors.join('; ')); await ctx.close();
});

test('Handy: Kamera näher dran (Zoom AUTO = nah, Option WEIT), Mitspieler antippen passt auch mit Zoom, Tor antippen schießt in diese Ecke', async () => {
  const { page, ctx, errors } = await open(MOBILE);
  await page.evaluate(() => { localStorage.setItem('krl_touchtip', '9'); });
  const setup = (where) => page.evaluate(where => { LASTIN = 'touch'; const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; if (!G || G.demo || !G.T) { startMatch(L[0], L[1], { human: 0, flitzer: 0 }); hideMenu(); }
    G.phase = 'play'; G.sp = null; G.ball.shot = null; const s = atkDir(0), gx = goalX(0), st = teamP(0).find(q => grpOf(q) === 'ST'), mf = teamP(0).find(q => grpOf(q) === 'MF');
    for (const o of G.players) if (!isGK(o) && o !== st && o !== mf) place(o, o.team ? gx - s * 40 : CW / 2 - s * 30, o.team ? 2 : CH - 2);
    place(st, where === 'goal' ? gx - s * 15 : CW / 2, MY); place(mf, where === 'goal' ? gx - s * 22 : CW / 2 + s * 8, MY + 8); st.cd = 0; giveBall(st, true); G.ctrl = st; G.camSnap = true; G.paused = true; render(); render(); G.paused = false;
    window.__st = st; window.__mf = mf; }, where);
  // Bildschirmpunkt (CSS-Pixel) eines Spielfeldpunkts mit Zoom
  const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const r = cv.getBoundingClientRect(), k = r.width / W; return { x: r.left + zx(sx(x, y)) * k, y: r.top + zy(sy(y, z)) * k }; }, [x, y, z]);
  await setup('mid');
  const z = await page.evaluate(() => { const a = ZM; SETTINGS.zoom = 'weit'; G.camSnap = true; render(); const w = ZM; SETTINGS.zoom = 'mittel'; G.camSnap = true; render(); const m = ZM; SETTINGS.zoom = 'auto'; G.camSnap = true; render(); return { auto: a, weit: w, mittel: m }; });
  ok(z.auto === 1.25 && z.weit === 1 && z.mittel > 1 && z.mittel < 1.25, 'Zoom-Stufen: ' + JSON.stringify(z));
  // Mitspieler antippen = Pass zu ihm (Antippen-Punkt über die Zoom-Umrechnung)
  const mfp = await page.evaluate(() => ({ x: __mf.x, y: __mf.y })); const pm = await scr(mfp.x, mfp.y, 1.2);
  await page.evaluate(() => { G.paused = true; }); await page.touchscreen.tap(pm.x, pm.y); await page.waitForTimeout(80);
  const passed = await page.evaluate(() => G.ball.passTo === __mf || G.ball.owner === __mf);
  ok(passed, 'Mitspieler antippen spielt keinen Pass (Zoom): ' + JSON.stringify(pm));
  // Tor antippen: oben im Tor = obere Ecke, unten = untere Ecke
  const tapGoal = async yy => { await setup('goal'); await page.evaluate(() => { G.paused = true; render(); });
    const g = await page.evaluate(() => goalX(0)); const pt = await scr(g, yy, 1.2); await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(60);
    return page.evaluate(() => G.ball.shot && G.ball.shot.by === __st ? Math.sign(G.ball.vy) : 'kein Schuss'); };
  const up = await tapGoal(32 - 3.66 + 0.6), down = await tapGoal(32 + 3.66 - 0.6);
  ok(up === -1 && down === 1, 'Tor antippen schießt nicht in die Ecke: ' + JSON.stringify([up, down]));
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
    page.on('requestfailed', r => { if (!/^https:\/\/app\.netlify\.com\//.test(r.url())) errors.push('fehlt: ' + r.url()); });   // Netlify-Vorschauleiste lädt eigene Videos
    await page.goto(GAME.replace(/game\/(index\.html)?$/, 'index.html'), { timeout: 60000 }); await page.waitForTimeout(500);   // Datei oder Vorschau-Seite
    const kinds = [];
    const n = await page.evaluate(() => __story.TL.length);
    for (let i = 0; i < n; i++) {
      await page.evaluate(i => { const t = __story.TL[i]; scrollTo(0, (t.u0 + (t.u1 - t.u0) / 2) * __story.unitPx()); }, i);
      await page.waitForTimeout(250);
      kinds.push(await page.evaluate(() => __story.state().kind));
    }
    const links = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')));
    ok(['intro', 'tor', 'karte', 'kreisblatt', 'pokal', 'bus', 'finale'].every(k => kinds.includes(k)), 'Szenen: ' + kinds);
    ok(links.includes('game/') && links.some(l => /^\/?impressum(\.html)?$/.test(l)) && links.some(l => /^\/?datenschutz(\.html)?$/.test(l)), 'Links fehlen: ' + links.join(' '));   // Netlify macht aus impressum.html → /impressum
    ok(!errors.length, errors.join('; ')); await ctx.close();
  }
  for (const f of ['impressum.html', 'datenschutz.html']) {
    const ctx = await browser.newContext(DESKTOP), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(GAME.replace(/game\/(index\.html)?$/, f)); await page.click('.card .reveal');
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
