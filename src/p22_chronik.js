// ================= Saison: Vor dem Spiel, Rekorde, Auszeichnungen, Vereinslegenden, Saison als Bild =================
// Vor jedem eigenen Spiel ein Vergleich beider Vereine (Tabelle, Form, Stärke, Torjäger, Hinspiel). Nach jedem Spiel werden Rekorde
// fortgeschrieben, am Saisonende gibt es Auszeichnungen und Vereinslegenden. Alles steht im neuen Reiter HISTORIE, und die ganze
// Saison lässt sich als Kreisblatt-Seite (1080 × 1350) teilen.

// ---------- Vor dem Spiel ----------
function teamForm(tid) { const S = CAREER.S, li = TEAMS[tid].lg, r = S.tables[li] && S.tables[li][tid]; return r ? r.form.slice(-5) : []; }
function lastMeeting(h, a) {
  for (const r of [...CAREER.S.results].reverse()) for (const g of r.games || []) if ((g.h === h && g.a === a) || (g.h === a && g.a === h)) return { g, cup: r.cup != null, po: r.po != null };
  return null;
}
function preHTML() {
  const C = CAREER, ev = curEvent(), g = myGame(ev); if (!g) return '';
  const side = tid => {
    const T = TEAMS[tid], li = T.lg, r = C.S.tables[li] && C.S.tables[li][tid], sq = ensureSquad(tid);
    const sc = topScorers(null, 99).find(x => x.p.tid === tid), star = sq.slice().sort((a, b) => b.ovr - a.ovr)[0];
    return `<div class="pvside ${tid === C.team ? 'me' : ''}"><img src="${iconURL(T.home)}" alt=""><b>${esc(T.short.toUpperCase())}</b>
      <span>${starHTML(stars(squadStr(tid)))}</span>
      <span class="tag">${r && C.kl.includes(li) ? `${posOf(tid, li)}. PLATZ · ${r.pkt} PKT` : 'KREISMEISTER ' + esc(kreisOf(tid).n.toUpperCase())}</span>
      ${formHTML(teamForm(tid))}
      <span class="muted">Torjäger: ${sc ? `${esc(sc.p.name)} (${sc.n})` : '–'}</span><span class="muted">Bester Spieler: ${esc(star.name)} (${star.ovr})</span></div>`;
  };
  const m = lastMeeting(g.h, g.a);
  const prev = m ? `<div class="pvprev">${m.cup ? 'POKAL' : m.po ? 'PLAYOFFS' : 'HINSPIEL'}<b>${esc(TEAMS[m.g.h].k)} ${m.g.gh}:${m.g.ga} ${esc(TEAMS[m.g.a].k)}</b></div>` : '';
  const miss = ensureSquad(C.team).filter(p => p.inj > 0 || p.ban > 0);
  return `<div class="panel narrow"><div class="row spread"><h2>VOR DEM SPIEL</h2><span class="tag">${esc(eventLabel(ev))}</span></div>
    ${isDerby(g.h, g.a) ? '<p class="champ">DERBY! MEHR STIMMUNG, 500 € PRÄMIE BEIM SIEG</p>' : ''}
    <div class="duel">${side(g.h)}<div class="vs">VS${prev}</div>${side(g.a)}</div>
    <p class="muted">${g.h === C.team ? 'Heimspiel' : g.neutral ? 'Neutraler Platz' : 'Auswärts'} · ${GROUNDS[g.neutral ? 0 : TEAMS[g.h].ground]} · Formation ${esc(C.form)}${miss.length ? ` · fehlen: ${miss.map(p => esc(p.name)).join(', ')}` : ''}</p>
    <div class="row"><button class="main" data-act="cplay" autofocus>ANPFIFF</button><button data-act="cwatch">ZUSCHAUEN</button><button data-act="csim">SIMULIEREN</button><button data-act="chub">ZURÜCK</button></div></div>`;
}
Object.assign(ACT, { cpre() { const h = preHTML(); if (!h) return ACT.chub(); show(h, { back: ACT.chub }); } });

// ---------- Rekorde ----------
function trackRecords(r) {
  const C = CAREER, R = C.records = C.records || {}, me = C.team, home = r.h === me, my = home ? r.gh : r.ga, op = home ? r.ga : r.gh, opp = TEAMS[home ? r.a : r.h];
  const txt = `${my}:${op} gegen ${opp.short} (${seasonLabel(C.year)})`;
  if (my - op > 0 && (!R.win || my - op > R.win.d || (my - op === R.win.d && my > R.win.g))) R.win = { d: my - op, g: my, txt };
  if (op - my > 0 && (!R.loss || op - my > R.loss.d)) R.loss = { d: op - my, txt };
  if (!R.goals || my + op > R.goals.n) R.goals = { n: my + op, txt };
  R.unb = my >= op ? (R.unb || 0) + 1 : 0; R.wins = my > op ? (R.wins || 0) + 1 : 0;
  if (!R.unbMax || R.unb > R.unbMax.n) R.unbMax = { n: R.unb, txt: seasonLabel(C.year) };
  if (!R.winsMax || R.wins > R.winsMax.n) R.winsMax = { n: R.wins, txt: seasonLabel(C.year) };
}

// ---------- Saisonende: Auszeichnungen, Rekorde, Legenden ----------
function chronikEndSeason(sm) {
  const C = CAREER, S = C.S, R = C.records = C.records || {}, A = C.awards = C.awards || [], y = C.year, sq = ensureSquad(C.team);
  const avg = p => p.ss.nn ? p.ss.ns / p.ss.nn : 9;
  const add = (k, title, p, v) => { if (p) A.push({ y, k, title, name: `${p.first} ${p.name}`, team: TEAMS[p.tid] ? TEAMS[p.tid].short : '', v, mine: p.tid === C.team }); };
  const king = topScorers(C.lg, 1)[0]; if (king) add('kanone', 'TORSCHÜTZENKÖNIG ' + LIGEN[C.lg].n.toUpperCase(), king.p, `${king.n} Tore`);
  const best = sq.filter(p => p.ss.nn >= 5).sort((a, b) => avg(a) - avg(b))[0]; if (best) add('sds', 'SPIELER DER SAISON', best, `Note ${fmtNote(Math.round(avg(best) * 10) / 10)}`);
  const ast = sq.filter(p => p.ss.a > 0).sort((a, b) => b.ss.a - a.ss.a)[0]; if (ast) add('vorlagen', 'VORLAGENKÖNIG IM VEREIN', ast, `${ast.ss.a} Vorlagen`);
  const gk = sq.filter(p => p.grp === 'TW' && p.ss.sp >= 5).sort((a, b) => a.ss.co / a.ss.sp - b.ss.co / b.ss.sp)[0]; if (gk) add('tw', 'BESTER TORWART IM VEREIN', gk, `${gk.ss.co} Gegentore in ${gk.ss.sp} Spielen`);
  const yng = sq.filter(p => p.age <= 21 && p.ss.sp >= 5).sort((a, b) => avg(a) - avg(b))[0]; if (yng) add('talent', 'TALENT DER SAISON', yng, `${yng.age} Jahre`);
  const mine = A.filter(a => a.y === y && a.mine);
  if (mine.length) news('Ehrung', `Auszeichnungen für ${TEAMS[C.team].short}`, mine.map(a => `${a.title}: ${a.name} (${a.v})`).join('. ') + '.', 'title');
  // Saisonrekorde
  if (!R.pkt || sm.pkt > R.pkt.n) R.pkt = { n: sm.pkt, txt: seasonLabel(y) };
  const [tf] = sm.tore.split(':').map(Number); if (!R.tf || tf > R.tf.n) R.tf = { n: tf, txt: seasonLabel(y) };
  const top = sq.slice().sort((a, b) => b.ss.g - a.ss.g)[0]; if (top && top.ss.g && (!R.scorer || top.ss.g > R.scorer.n)) R.scorer = { n: top.ss.g, txt: `${top.first} ${top.name} (${seasonLabel(y)})` };
  noteLegends();
}
// Vereinslegenden: viele Spiele oder viele Tore im eigenen Verein (bleiben auch nach Karriereende in der Chronik)
function noteLegends() {
  const C = CAREER, L = C.legends = C.legends || {};
  for (const p of ensureSquad(C.team)) if (p.cs.sp >= 40 || p.cs.g >= 15) L[p.pid] = { name: `${p.first} ${p.name}`, grp: p.grp, sp: p.cs.sp, g: p.cs.g, a: p.cs.a, nick: p.nick || '' };
}

// ---------- Reiter HISTORIE ----------
function histHTML() {
  const C = CAREER, R = C.records || {}, A = (C.awards || []).slice().reverse(), L = Object.values(C.legends || {}).sort((a, b) => b.g * 3 + b.sp - (a.g * 3 + a.sp));
  const rec = [['HÖCHSTER SIEG', R.win && R.win.txt], ['HÖCHSTE NIEDERLAGE', R.loss && R.loss.txt], ['TORREICHSTES SPIEL', R.goals && `${R.goals.n} Tore: ${R.goals.txt}`],
    ['UNGESCHLAGEN IN SERIE', R.unbMax && R.unbMax.n && `${R.unbMax.n} Spiele (${R.unbMax.txt})`], ['SIEGE IN SERIE', R.winsMax && R.winsMax.n && `${R.winsMax.n} Spiele (${R.winsMax.txt})`],
    ['MEISTE PUNKTE', R.pkt && `${R.pkt.n} (${R.pkt.txt})`], ['MEISTE TORE', R.tf && `${R.tf.n} (${R.tf.txt})`], ['BESTER TORSCHÜTZE', R.scorer && `${R.scorer.n} Tore: ${R.scorer.txt}`]].filter(r => r[1]);
  return `<h3>VEREINSCHRONIK</h3>${C.hist.length ? `<div class="tblwrap"><table class="dt"><tr><th class="l">SAISON</th><th>PLATZ</th><th>PKT</th><th>TORE</th><th class="l">POKAL</th><th class="l">PLAYOFFS</th></tr>${C.hist.map(h => `<tr><td class="l">${seasonLabel(h.year)}</td><td>${h.pos}.</td><td>${h.pkt}</td><td>${h.tore}</td><td class="l">${esc(h.cup)}</td><td class="l">${esc(h.po)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Die erste Saison läuft noch.</p>'}
  <h3>REKORDE</h3>${rec.length ? `<table class="dt">${rec.map(([k, v]) => `<tr><td class="l">${k}</td><td class="l">${esc(String(v))}</td></tr>`).join('')}</table>` : '<p class="muted">Noch keine Rekorde – spiel ein paar Spiele.</p>'}
  <h3>AUSZEICHNUNGEN</h3>${A.length ? `<table class="dt">${A.map(a => `<tr class="${a.mine ? 'me' : ''}"><td class="l">${seasonLabel(a.y)}</td><td class="l">${esc(a.title)}</td><td class="l">${esc(a.name)} <span class="tag">${esc(a.team)}</span></td><td class="l">${esc(a.v)}</td></tr>`).join('')}</table>` : '<p class="muted">Am Saisonende werden Torschützenkönig, Spieler der Saison und mehr geehrt.</p>'}
  <h3>VEREINSLEGENDEN</h3>${L.length ? `<table class="dt"><tr><th class="l">SPIELER</th><th>POS</th><th>SP</th><th>T</th><th>V</th></tr>${L.map(l => `<tr><td class="l">${esc(l.name)}${l.nick ? ` „${esc(l.nick)}“` : ''}</td><td>${l.grp}</td><td>${l.sp}</td><td>${l.g}</td><td>${l.a}</td></tr>`).join('')}</table>` : '<p class="muted">Ab 40 Spielen oder 15 Toren im Verein wird ein Spieler zur Legende.</p>'}
  ${C.hist.length ? '<div class="row"><button class="small" data-act="cshareSeason">LETZTE SAISON ALS BILD TEILEN</button></div>' : ''}`;
}

// ---------- Saison als Bild ----------
function seasonCanvas(h) {
  const C = CAREER, S = 360, H = 450, c = document.createElement('canvas'); c.width = S; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const T = (s, x, y, col, size = 8, align = 'left') => { g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = col; g.fillText(s, Math.round(x), Math.round(y)); };
  const ink = '#1d1a14', paper = '#efe6cf', team = TEAMS[C.team];
  g.fillStyle = '#07060b'; g.fillRect(0, 0, S, H); g.fillStyle = paper; g.fillRect(14, 14, S - 28, H - 28);
  T('KREISBLATT', S / 2, 24, ink, 24, 'center'); g.fillStyle = ink; g.fillRect(24, 54, S - 48, 2); g.fillRect(24, 70, S - 48, 1);
  T(`SAISONBILANZ ${seasonLabel(h.year)}`, 24, 59, '#5a5240', 8); T(LIGEN[C.lg].n.toUpperCase().slice(0, 22), S - 24, 59, '#5a5240', 8, 'right');
  g.drawImage(jerseyIcon(team.home), S / 2 - 24, 80, 48, 48);
  g.font = `14px ${FONT}`; const nm = wrapText(g, team.n.toUpperCase(), S - 48).slice(0, 2); nm.forEach((l, i) => T(l, S / 2, 134 + i * 18, ink, 14, 'center'));
  let y = 134 + nm.length * 18 + 8;
  g.fillStyle = '#14111d'; g.fillRect(24, y, S - 48, 62);
  T(`${h.pos}.`, 70, y + 12, '#ffc83a', 24, 'center'); T('PLATZ', 70, y + 42, '#9b90ad', 8, 'center');
  T(String(h.pkt), S / 2, y + 12, '#f3ead6', 24, 'center'); T('PUNKTE', S / 2, y + 42, '#9b90ad', 8, 'center');
  T(h.tore, S - 70, y + 12, '#f3ead6', 16, 'center'); T('TORE', S - 70, y + 42, '#9b90ad', 8, 'center');
  y += 74;
  const clean = (v, k) => (v === '–' || !v ? (k === 'PLAYOFFS' ? 'nicht dabei' : '–') : String(v).replace(/^(Kreispokal|Playoffs): /, ''));
  const rows = [['KREISPOKAL', clean(h.cup, 'KREISPOKAL')], ['PLAYOFFS', clean(h.po, 'PLAYOFFS')]];
  if (h.top) rows.push(['TORJÄGER', `${h.top.name} (${h.top.n})`]);
  if (h.goal) rows.push(['ZIEL', h.goal.replace(/ \(.*\)$/, '')]);
  for (const [k, v] of rows) { T(k, 24, y, '#5a5240', 8); T(v.toUpperCase().slice(0, 32), S - 24, y, ink, 8, 'right'); y += 14; }
  if (h.goal) { y += 4; g.font = `8px ${FONT}`; for (const l of wrapText(g, h.ok ? 'ZIEL ERREICHT – DER VORSTAND SPENDIERT EIN FASS FREIBIER.' : 'ZIEL VERFEHLT – BEIM STAMMTISCH WIRD DISKUTIERT.', S - 48)) { T(l, S / 2, y, h.ok ? '#0a6a2e' : '#8a2020', 8, 'center'); y += 11; } }
  const aw = (C.awards || []).filter(a => a.y === h.year && a.mine).slice(0, 4);
  if (aw.length) { g.fillStyle = ink; g.fillRect(24, y, S - 48, 1); y += 6; T('AUSZEICHNUNGEN', 24, y, '#5a5240', 8); y += 13; for (const a of aw) { T(a.title.slice(0, 26), 24, y, ink, 8); T(a.name.toUpperCase().slice(0, 18), S - 24, y, '#1d3a5a', 8, 'right'); y += 12; } }
  const tit = C.titles.filter(t => t.year === h.year);
  if (tit.length) { y += 4; T(tit.map(t => t.kind === 'dkm' ? 'DEUTSCHER KREISLIGA-MEISTER' : t.kind === 'pokal' ? 'KREISPOKALSIEGER' : 'MEISTER').join(' · ').slice(0, 40), S / 2, y, '#b8860b', 8, 'center'); }
  g.fillStyle = ink; g.fillRect(24, H - 44, S - 48, 1);
  T('GESPIELT IN KREISLIGA-LEGENDEN', S / 2, H - 38, '#5a5240', 8, 'center'); T('KREISLIGA-LEGENDEN.DE', S / 2, H - 26, ink, 8, 'center');
  const out = document.createElement('canvas'); out.width = 1080; out.height = 1350; const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, 1080, 1350);
  return out;
}
async function shareCanvas(cv, file, txt) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  try { const f = new File([blob], file, { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: txt }); return 'geteilt'; } } catch (e) { if (e && e.name === 'AbortError') return 'abgebrochen'; }
  if (PLATFORM.saveFile) { PLATFORM.saveFile(file, blob, 'image/png'); return 'gespeichert'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'gespeichert';
}
Object.assign(ACT, {
  async cshareSeason(a, el) {
    const C = CAREER, h = C.hist[C.hist.length - 1] || (C.S.done ? (() => { const sm = seasonSummary(); return { year: C.year, pos: sm.pos, pkt: sm.pkt, tore: sm.tore, cup: sm.cupRes, po: sm.poRes }; })() : null);
    if (!h) return;
    if (el) { el.disabled = true; el.textContent = 'BILD WIRD ERSTELLT …'; }
    const r = await shareCanvas(seasonCanvas(h), 'kreisliga-saison.png', `${TEAMS[C.team].n}: Saison ${seasonLabel(h.year)} – ${h.pos}. Platz, ${h.pkt} Punkte. Gespielt in Kreisliga-Legenden: ${PLATFORM.shareUrl || 'https://kreisliga-legenden.de'}`);
    unlock('teilen'); track('teilen', { modus: 'saison-bild' });
    if (el) { el.textContent = r === 'gespeichert' ? 'BILD GESPEICHERT ✔' : r === 'geteilt' ? 'GETEILT ✔' : 'SAISON ALS BILD TEILEN'; el.disabled = false; }
  },
});
