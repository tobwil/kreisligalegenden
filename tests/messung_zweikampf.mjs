// Messung (kein Test): wie fair fühlen sich Zweikämpfe gegen die CPU an? Ein Bot spielt ganze Spiele über Tasten,
// wahlweise „wie am Handy“ (verzögert und ungenau). Gezählt wird pro Schwierigkeitsstufe:
//   Tore, Ballbesitz, Ballverluste an die CPU, davon „sofort weg“ (< 1 s nach eigener Annahme),
//   wie schnell die CPU nach einem Ballgewinn weiterspielt und wie lange du brauchst, um wieder dran zu sein.
// Aufruf:  cd tests && node messung_zweikampf.mjs [Spiele je Stufe, Standard 4]
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { const req = createRequire(execSync('npm root -g').toString().trim() + '/'); ({ chromium } = req('playwright')); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = pathToFileURL(process.env.GAME || path.join(root, 'game', 'index.html')).href;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find(existsSync);
const N = +process.argv[2] || 4;

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const rows = [];
for (const touch of [false, true]) for (const diff of [0, 1, 2]) {
  const acc = [];
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(s => { let x = s; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; }, 100 + i * 17 + diff);
    const page = await ctx.newPage(); await page.goto(GAME); await page.waitForTimeout(400);
    acc.push(await page.evaluate(([diff, touch, seed]) => {
      let x = seed; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647;
      SETTINGS.keys = 'legenden'; SETTINGS.autoswitch = true; LASTIN = 'key';
      const L = LIGEN[TEAMS[HOME_TEAM].lg].ids;
      startMatch(L[0], L[1], { human: 0, flitzer: 0, diff }); G.paused = true; hideMenu();
      const H = {}, press = (k, n) => { if (!H[k]) H[k] = n; }, busy = () => ['KeyS', 'KeyA', 'KeyD', 'Space'].some(k => H[k]);
      const m = { own: 0, opp: 0, lost: 0, quick: 0, cpuTk: 0, cpuPoke: 0, cpuFirst: [], chase: [] };
      const oTk = window.tackle, oPoke = window.poke;
      window.tackle = (d, c) => { if (d.team === 1 && c && c.team === 0) m.cpuTk++; return oTk(d, c); };
      window.poke = (d, c) => { if (d.team === 1) m.cpuPoke++; return oPoke(d, c); };
      let lastTeam = null, gotT = 0, cpuGot = null, chaseT = null, n = 0, lag = [], tackleT = -9;
      const s = () => atkDir(0);
      while (G.phase !== 'end' && n < 60 * 60 * 9) {
        n++;
        const b = G.ball, c = G.ctrl, ph = G.phase;
        let ax = 0, ay = 0;
        if (ph === 'pause') { nextHalf(); continue; }
        if (ph === 'intro' || ph === 'replay' || ph === 'goal') { if (n % 30 === 0) press('Enter', 2); }
        else if ((ph === 'setpiece' || ph === 'kickoff' || ph === 'penalty') && G.sp && isHumanTeam(G.sp.team) && G.sp.t > 0.6 && !busy()) {
          if (aimViewOn()) press('Space', 30); else if (G.sp.type === 'corner') press('KeyA', 8); else press('KeyS', 4);
        } else if (ph === 'play' && c) {
          const gx = goalX(0), mine = b.owner === c, ours = b.owner && b.owner.team === 0;
          if (mine) {
            ax = s(); ay = (MY - c.y) * 0.08;
            const dg = dist(c.x, c.y, gx, MY), front = opps(c).some(o => !isGK(o) && (o.x - c.x) * s() > 0 && dist(o.x, o.y, c.x, c.y) < 2.6);
            if (!busy()) {
              if (dg < 27) press('Space', 20);
              else if (front && (!touch || n % 4 === 0)) press('KeyS', n % 3 ? 3 : 35);
            }
          } else if (ours) { ax = Math.sign(b.owner.x + s() * 12 - c.x) * 0.6; ay = Math.sign(c.y - MY) * 0.2; }
          else {
            const tx = b.owner ? b.owner.x : b.x, ty = b.owner ? b.owner.y : b.y, d = dist(c.x, c.y, tx, ty);
            if (d > 0.4) { ax = (tx - c.x) / d; ay = (ty - c.y) / d; }
            if (b.owner && b.owner.team === 1 && d < (touch ? 3 : 1.3) && G.t - tackleT > 0.8 && !busy()) { press('KeyD', 3); tackleT = G.t; }
            else if (d > 15 && n % 60 === 0 && !busy()) press('KeyS', 3);
          }
        }
        // „wie am Handy“: Richtung ungenau (bis ±25°) und 0,15 s verzögert
        if (touch) {
          const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.9, r = Math.hypot(ax, ay);
          lag.push([Math.cos(a) * r, Math.sin(a) * r]); [ax, ay] = lag.length > 9 ? lag.shift() : [0, 0];
        }
        KEY.ArrowRight = ax > 0.3; KEY.ArrowLeft = ax < -0.3; KEY.ArrowDown = ay > 0.3; KEY.ArrowUp = ay < -0.3;
        for (const k of ['KeyS', 'KeyA', 'KeyD', 'Space', 'Enter']) { const on = H[k] > 0; if (on && !KEY[k]) KEYP[k] = true; KEY[k] = on; if (H[k] > 0) { if (--H[k] === 0) H[k] = -6; } else if (H[k] < 0) H[k]++; }
        readInput(1 / 60); step(1 / 60);
        const o = G.ball.owner, ot = o ? o.team : null;
        if (G.phase === 'play' && ot != null) m[ot === 0 ? 'own' : 'opp']++;
        if (ot === 0 && lastTeam !== 0) { gotT = G.t; if (chaseT != null) { m.chase.push(G.t - chaseT); chaseT = null; } }
        if (ot === 1 && lastTeam === 0 && G.phase === 'play') {
          m.lost++; if (G.t - gotT < 1) m.quick++;
          cpuGot = { p: o, t: G.t }; chaseT = G.t;
        }
        // erste Aktion der CPU nach dem Ballgewinn (Pass, Schuss oder Ball verloren)
        if (cpuGot && G.ball.owner !== cpuGot.p) { m.cpuFirst.push(G.t - cpuGot.t); cpuGot = null; }
        // wieder dran: dein Spieler bis 1,5 m am Ballführer
        if (chaseT != null && G.ctrl && o && o.team === 1 && dist(G.ctrl.x, G.ctrl.y, o.x, o.y) < 1.5) { m.chase.push(G.t - chaseT); chaseT = null; }
        if (chaseT != null && G.phase !== 'play') chaseT = null;
        if (ot != null) lastTeam = ot;
      }
      window.tackle = oTk; window.poke = oPoke;
      const avg = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
      return { goals: G.score[0], against: G.score[1], poss: m.own / Math.max(1, m.own + m.opp), lost: m.lost, quick: m.quick, cpuTk: m.cpuTk, cpuPoke: m.cpuPoke, first: avg(m.cpuFirst), chase: avg(m.chase) };
    }, [diff, touch, 100 + i * 17 + diff]));
    await ctx.close();
  }
  const sum = k => acc.reduce((p, q) => p + q[k], 0), av = k => sum(k) / acc.length;
  rows.push({ eingabe: touch ? 'Handy' : 'Tastatur', stufe: ['Freizeitkick', 'Kreisliga', 'Legende'][diff], tore: `${sum('goals')}:${sum('against')}`, ballbesitz: (av('poss') * 100).toFixed(0) + '%', ballverluste: av('lost').toFixed(1), sofortWeg: av('quick').toFixed(1), cpuTackling: av('cpuTk').toFixed(1), cpuSpitzeln: av('cpuPoke').toFixed(1), cpuErsteAktion: av('first').toFixed(2) + ' s', wiederDran: av('chase').toFixed(2) + ' s' });
  console.log(JSON.stringify(rows.at(-1)));
}
await browser.close();
console.table(rows);
