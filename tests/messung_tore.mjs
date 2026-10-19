// Messung (kein Test): Torschnitt und Angriffs-Trichter im Spiel CPU gegen CPU.
// Mischt Paarungen aus derselben Liga und über Ligen hinweg, läuft auf mehreren Seiten parallel.
//   Ballbesitzphasen → davon ins letzte Drittel → davon mit Schuss → aufs Tor → Tor
//   Aufruf:  cd tests && node messung_tore.mjs [Spiele, Standard 160] [Seiten parallel, Standard 4]
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
const N = +process.argv[2] || 160, P = +process.argv[3] || 4;

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const part = async k => {
  const page = await (await browser.newContext()).newPage(); await page.goto(GAME); await page.waitForTimeout(400);
  return page.evaluate(([k, n, P]) => {
    let x = 1000 + k * 7919; Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const m = { games: 0, goals: 0, poss: 0, final: 0, shotPoss: 0, shots: 0, onT: 0, saves: 0, blocks: 0, reb: 0, near: 0, mid: 0, far: 0, gNear: 0, gMid: 0, gFar: 0, cross: 0, gHead: 0, end: {} };
    const oShoot = window.shoot, oGoal = window.scoreGoal, oCross = window.cross; let last = null, cur = null, lastReb = -9, kind = '';
    window.shoot = (pl, pw, ay, o = {}) => { if (G.phase === 'play') { const d = dist(pl.x, pl.y, goalX(pl.team), MY); last = o.header ? 'Head' : d < 11 ? 'Near' : d < 20 ? 'Mid' : 'Far'; m[last === 'Head' ? 'head' : last.toLowerCase()] = (m[last === 'Head' ? 'head' : last.toLowerCase()] || 0) + 1; if (cur && !cur.shot) { cur.shot = true; m.shotPoss++; } } return oShoot(pl, pw, ay, o); };
    window.cross = (...a) => { if (G.phase === 'play') m.cross++; return oCross(...a); };
    window.scoreGoal = (t, y, z) => { if (G.phase === 'play' && !G.so) { m.goals++; if (last) m['g' + last] = (m['g' + last] || 0) + 1; if (G.t - lastReb < 3) m.reb++; } return oGoal(t, y, z); };
    for (let i = k; i < n; i += P) {
      const lg = TEAMS[HOME_TEAM].lg, cross = i % 2;
      const a = cross ? LIGEN[lg].ids[i % 8] : LIGEN[lg].ids[i % LIGEN[lg].ids.length], b = cross ? LIGEN[lg + 1].ids[15 - (i % 8)] : LIGEN[lg].ids[(i + 3) % LIGEN[lg].ids.length];
      newMatch(a, b, { human: -1, hlen: 2 }); G.paused = true; G.phase = 'kickoff'; lastReb = -9; cur = null;
      let f = 0, pt = null;
      while (G.phase !== 'end' && f < 60 * 60 * 12) {
        step(1 / 60); f++;
        if (G.phase === 'pause') nextHalf(); else if (G.phase === 'etpause') { G.half = 2; nextHalf(); }
        const o = G.ball.owner;
        if (G.phase === 'play' && o && o.team !== pt) { if (cur && cur.final && !cur.shot) { const r = isGK(o) ? 'Torwart (' + (cur.k || '?') + ')' : (cur.k || '?'); m.end[r] = (m.end[r] || 0) + 1; } if (!isGK(o)) { pt = o.team; cur = { shot: false, final: false }; m.poss++; } else { pt = o.team; cur = null; } }
        if (cur && !o && G.ball.kind) cur.k = G.ball.kind; else if (cur && o && o.team === pt) cur.k = 'verloren am Ball';
        if (cur && cur.final && !cur.shot && G.phase !== 'play' && !cur.dead) { cur.dead = true; const r = 'Aus/Pfiff (' + (cur.k || '?') + ')'; m.end[r] = (m.end[r] || 0) + 1; cur.shot = true; }
        if (cur && o && !cur.final && prog(o.team, o.x) > 0.7) { cur.final = true; m.final++; }
        const kd = G.ball.kind; if (kd !== kind && (kd === 'parry' || kd === 'block')) { lastReb = G.t; m[kd === 'parry' ? 'saves' : 'blocks']++; if (last) m[(kd === 'parry' ? 'sv' : 'bl') + last] = (m[(kd === 'parry' ? 'sv' : 'bl') + last] || 0) + 1; }
        if (last && o && isGK(o) && kind === 'shot') m['ct' + last] = (m['ct' + last] || 0) + 1;
        kind = kd;
      }
      m.games++; m.shots += G.stats.shots[0] + G.stats.shots[1]; m.onT += G.stats.onT[0] + G.stats.onT[1];
    }
    return m;
  }, [k, N, P]);
};
const parts = await Promise.all([...Array(P).keys()].map(part));
await browser.close();
const m = { end: {} }; for (const p of parts) for (const [k, v] of Object.entries(p)) { if (k === 'end') { for (const [r, c] of Object.entries(v)) m.end[r] = (m.end[r] || 0) + c; } else m[k] = (m[k] || 0) + v; }
const pg = k => (m[k] / m.games).toFixed(2), pc = (a, b) => (m[a] / Math.max(1, m[b]) * 100).toFixed(0) + '%';
console.log(`${m.games} Spiele · Tore ${pg('goals')} je Spiel (Abpraller ${pc('reb', 'goals')})`);
console.log(`Trichter je Spiel: Ballbesitzphasen ${pg('poss')} → letztes Drittel ${pg('final')} (${pc('final', 'poss')}) → mit Schuss ${pg('shotPoss')} (${pc('shotPoss', 'final')})`);
console.log(`Schüsse ${pg('shots')} · aufs Tor ${pg('onT')} (${pc('onT', 'shots')}) · Paraden ${pg('saves')} · Blocks ${pg('blocks')} · Flanken ${pg('cross')}`);
console.log(`Flachschüsse nah <11 m ${pg('near')} (Tore ${pg('gNear')}, ${pc('gNear', 'near')}) · mittel ${pg('mid')} (${pg('gMid')}, ${pc('gMid', 'mid')}) · fern ${pg('far')} (${pg('gFar')}, ${pc('gFar', 'far')})`);
console.log(`Kopfbälle ${pg('head')} (Tore ${pg('gHead')}, ${pc('gHead', 'head')}) · Flanken ${pg('cross')}`);
console.log('Angriffe im letzten Drittel ohne Schuss enden durch (je Spiel):', Object.entries(m.end).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([r, c]) => `${r} ${(c / m.games).toFixed(2)}`).join(' · '));
for (const c of ['Near', 'Mid', 'Far', 'Head']) console.log(`${c}: Schüsse ${pg(c === 'Head' ? 'head' : c.toLowerCase())} · Tor ${pg('g' + c)} · geblockt ${pg('bl' + c)} · Parade ${pg('sv' + c)} · gefangen ${pg('ct' + c)}`);
