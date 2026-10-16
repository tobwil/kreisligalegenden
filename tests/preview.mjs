// Große Testreihe gegen eine echte Netlify-Vorschau (oder die Live-Seite):
//   node preview.mjs https://deploy-preview-12--kreisligalegenden.netlify.app [--wait]
// 1. --wait: wartet, bis die Vorschau genau den Stand von game/index.html ausliefert (gleiche BUILD-Kennung)
// 2. Seite übers Netz: Startseite, /spielen, Impressum, Datenschutz, Manifest, Icons, Service Worker, Kopfzeilen,
//    keine kaputten Dateien, Spiel startet auf Desktop und Handy ohne Fehler, offline nach dem ersten Besuch
// 3. alle Spieltests (run.mjs) gegen die Vorschau
// 4. zufallsabhängige Tests noch mal mit anderem Zufall (SEED), damit seltene Fälle früh auffallen
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { const req = createRequire(execSync('npm root -g').toString().trim() + '/'); ({ chromium } = req('playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const BASE = (process.argv[2] || process.env.PREVIEW || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(BASE)) { console.error('Aufruf: node preview.mjs https://deploy-preview-N--kreisligalegenden.netlify.app [--wait]'); process.exit(2); }
const WAIT = process.argv.includes('--wait');
const SEEDS = (process.env.SEEDS || '3,11').split(',').map(Number).filter(Boolean);
// diese Tests hängen am Zufall (Spielzüge, Torwart, Zweikämpfe) – sie laufen mit jedem SEED noch einmal
const RANDOM = ['CPU gegen CPU', 'Bot spielt', 'Ecke mit Zielvisier', 'Flanke halten', 'Ecken-Balance', 'Parade (#8)', 'Arcade-Feinschliff', 'Arcade-Hilfen', 'Kopfball', 'Regeln', 'Tor: Jubel'];
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find(existsSync);
const want = (readFileSync(path.join(root, 'game', 'index.html'), 'utf8').match(/const BUILD = '(\d+)'/) || [])[1];

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) fails++; };
const get = (u, o = {}) => fetch(BASE + u, { redirect: 'manual', ...o });

// 1. auf die Vorschau warten
if (WAIT) {
  const t0 = Date.now(); let seen = '';
  for (;;) {
    try { const t = await (await fetch(BASE + '/game/', { cache: 'no-store' })).text(); seen = (t.match(/const BUILD = '(\d+)'/) || [])[1] || '?'; if (seen === want) break; } catch (e) { seen = e.message; }
    if (Date.now() - t0 > 15 * 60e3) { console.error(`Vorschau zeigt nach 15 Minuten noch nicht den Stand ${want} (sondern ${seen})`); process.exit(1); }
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log(`Vorschau ist bereit (Stand ${want}) nach ${Math.round((Date.now() - t0) / 1000)} s`);
}

// 2. Seite übers Netz
console.log(`\n== Seite: ${BASE}`);
{
  const g = await get('/game/'); const t = await g.text();
  ok(g.status === 200 && (!want || t.includes(`const BUILD = '${want}'`)), `/game/ liefert den Stand von game/index.html (${g.status})`);
  for (const [u, s] of [['/', 200], ['/impressum.html', 200], ['/datenschutz.html', 200], ['/impressum', 200], ['/datenschutz', 200], ['/robots.txt', 200], ['/sitemap.xml', 200], ['/fonts/fonts.css', 200], ['/game/sw.js', 200]]) ok((await get(u)).status === s, `${u} → ${s}`);
  for (const u of ['/spielen', '/spielen.html']) { const r = await get(u); ok(r.status === 301 && /\/game\/$/.test(r.headers.get('location') || ''), `${u} leitet aufs Spiel um`); }
  const m = await get('/game/manifest.webmanifest'), man = await m.json().catch(() => null);
  ok(m.status === 200 && /manifest\+json/.test(m.headers.get('content-type') || ''), 'Manifest mit richtigem Typ');
  ok(!!man && man.icons.length >= 3, 'Manifest hat Icons');
  if (man) for (const i of man.icons) ok((await get('/game/' + i.src)).status === 200, `Icon ${i.src}`);
  ok(/no-cache/.test((await get('/game/sw.js')).headers.get('cache-control') || ''), 'sw.js wird nicht zwischengespeichert');
  for (const u of ['/tests/run.mjs', '/src/build.sh']) ok(/noindex/.test((await get(u)).headers.get('x-robots-tag') || ''), `${u} nicht im Suchindex`);
}

// Browser: keine Fehler, keine kaputten Dateien, Handy offline
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const MOBILE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
for (const [name, opts, url] of [['Startseite Desktop', DESKTOP, '/'], ['Startseite Handy', { ...MOBILE, viewport: { width: 390, height: 844 } }, '/'], ['Spiel Desktop', DESKTOP, '/game/'], ['Spiel Handy', MOBILE, '/game/']]) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), errs = [], bad = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push(r.status() + ' ' + r.url().slice(BASE.length)); });
  page.on('requestfailed', r => { if (r.url().startsWith(BASE)) bad.push('abgebrochen ' + r.url().slice(BASE.length)); });
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(1500);
  if (url === '/game/') {
    const st = await page.evaluate(() => typeof G !== 'undefined' && !!G && !!document.querySelector('#menu') && typeof startMatch === 'function');
    ok(st, `${name}: Spiel läuft`);
    // kurz anspielen: ein CPU-Spiel startet und läuft ohne Fehler
    await page.evaluate(() => { const L = LIGEN[TEAMS[HOME_TEAM].lg].ids; startMatch(L[0], L[1], { human: 0 }); G.phase = 'play'; G.sp = null; });
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => G.t > 0.5), `${name}: Spiel läuft weiter`);
    if (opts.isMobile) ok(await page.evaluate(() => { const r = document.getElementById('tbPause').getBoundingClientRect(); return r.width > 30; }), `${name}: Pause-Knopf sichtbar`);
    if (opts.isMobile) {
      const sw = await page.evaluate(async () => { const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 10000))]); return !!(reg && reg.active); });
      ok(sw, `${name}: Service Worker aktiv`);
      await page.waitForTimeout(800); await ctx.setOffline(true); await page.reload().catch(() => { }); await page.waitForTimeout(1500);
      ok(await page.evaluate(() => typeof G !== 'undefined' && !!G).catch(() => false), `${name}: startet offline`);
      await ctx.setOffline(false);
    }
  } else {
    ok(await page.evaluate(() => !!document.querySelector('a[href="game/"]')), `${name}: Link zum Spiel`);
  }
  ok(!errs.length, `${name}: keine Skriptfehler ${errs.join('; ')}`);
  ok(!bad.length, `${name}: keine kaputten Dateien ${bad.join(', ')}`);
  await ctx.close();
}
await browser.close();

// 3. + 4. Spieltests gegen die Vorschau, die zufallsabhängigen zusätzlich mit anderem Zufall
const run = (label, args, env = {}) => {
  console.log(`\n== ${label}`);
  const r = spawnSync(process.execPath, [path.join(here, 'run.mjs'), ...args], { stdio: 'inherit', env: { ...process.env, GAME: BASE + '/game/', ...env } });
  ok(r.status === 0, label);
};
run('Alle Spieltests gegen die Vorschau', []);
for (const s of SEEDS) run(`Zufallsabhängige Tests mit SEED=${s}`, RANDOM, { SEED: String(s) });

console.log(`\n${fails ? `✘ ${fails} Prüfung(en) fehlgeschlagen` : '✔ Große Testreihe bestanden'} – ${BASE}`);
process.exit(fails ? 1 : 0);
