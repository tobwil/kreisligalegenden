// Messung (kein Test): wie viele Tore fallen nach einem Abpraller (Parade oder Block, Tor binnen 3 s)?
// CPU gegen CPU, ganze Spiele Bild für Bild.  Aufruf:  cd tests && node messung_abpraller.mjs [Spiele, Standard 30]
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
const N = +process.argv[2] || 30;

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.goto(GAME); await page.waitForTimeout(400);
const r = await page.evaluate(n => {
  let x = 4242; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const L = LIGEN[TEAMS[HOME_TEAM].lg].ids, m = { games: 0, goals: 0, reb: 0, parry: 0, block: 0, parryNear: 0 };
  const oGoal = window.scoreGoal; let lastReb = -9, kind = '', lastKind = '', watch = null;
  window.scoreGoal = (team, y, z) => { if (G.phase === 'play' && !G.so) { m.goals++; if (G.t - lastReb < 3) { m.reb++; const k = 'after_' + lastKind + '_' + (G.ball.kind || 'none'); m[k] = (m[k] || 0) + 1; } } return oGoal(team, y, z); };
  for (let i = 0; i < n; i++) {
    newMatch(L[i % L.length], L[(i + 3) % L.length], { human: -1, hlen: 2 }); G.paused = true; G.phase = 'kickoff'; lastReb = -9;
    let f = 0;
    while (G.phase !== 'end' && f < 60 * 60 * 12) {
      step(1 / 60); f++;
      if (G.phase === 'pause') nextHalf(); else if (G.phase === 'etpause') { G.half = 2; nextHalf(); }
      const k = G.ball.kind;
      if (k !== kind && (k === 'parry' || k === 'block')) {
        lastReb = G.t; lastKind = k; m[k]++; watch = { def: G.ball.lastTeam, t: G.t };
        // wo landet der abgewehrte Ball? (nah = binnen 11 m vom Tor, zentral)
        if (k === 'parry') { const o = { x: G.ball.x, y: G.ball.y, z: G.ball.z, vx: G.ball.vx, vy: G.ball.vy, vz: G.ball.vz, spin: 0 }; for (let j = 0; j < 90; j++) ballPhys(o, 1 / 60); const gx = G.ball.x < CW / 2 ? 0 : CW; if (Math.abs(o.x - gx) < 11 && Math.abs(o.y - MY) < 10) m.parryNear++; }
      }
      if (watch && G.ball.owner) { m[G.ball.owner.team === watch.def ? 'firstDef' : 'firstAtk'] = (m[G.ball.owner.team === watch.def ? 'firstDef' : 'firstAtk'] || 0) + 1; watch = null; } else if (watch && (G.phase !== 'play' || G.t - watch.t > 4)) { m.firstNone = (m.firstNone || 0) + 1; watch = null; }
      kind = k;
    }
    m.games++;
  }
  return m;
}, N);
await browser.close();
console.log(JSON.stringify({ ...r, rebShare: (r.reb / Math.max(1, r.goals) * 100).toFixed(1) + '%', perGame: (r.reb / r.games).toFixed(2), parryNearShare: (r.parryNear / Math.max(1, r.parry) * 100).toFixed(0) + '%' }));
