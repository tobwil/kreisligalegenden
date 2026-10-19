// ================= Saison: Oberfläche =================
const NEWC = { team: HOME_TEAM, len: 2, diff: 1, hlen: 2 };
let CTAB = 'blatt';
Object.assign(ACT, {
  career() {
    const sv = loadCareerSave();
    if (sv) { CAREER = sv; return ACT.chub(); }
    pkFocus(NEWC.team); renderNewCareer();
  },
  ncTeam(a) { NEWC.team = +a; pkFocus(NEWC.team); renderNewCareer(`[data-act="ncTeam"][data-arg="${a}"]`); },
  ncLen(a) { NEWC.len = +a; renderNewCareer(`[data-act="ncLen"][data-arg="${a}"]`); },
  ncDiff(a) { NEWC.diff = +a; renderNewCareer(`[data-act="ncDiff"][data-arg="${a}"]`); },
  ncGo() { newCareer(NEWC.team, NEWC.len, NEWC.diff, NEWC.hlen); CTAB = 'blatt'; ACT.chub(); },
  chub(tab) { if (tab) CTAB = tab; if (G && !G.demo && (G.phase === 'end' || G.counted)) { G = null; startDemo(); } if (!CAREER) { const sv = loadCareerSave(); if (!sv) return ACT.main(); CAREER = sv; } renderHub(); },
  ctab(a) { CTAB = a; renderHub(`[data-act="ctab"][data-arg="${a}"]`); },
  cplay() { playCareerMatch(false); },
  cwatch() { playCareerMatch(true); },
  csim() { runEvent(null); CTAB = 'blatt'; renderHub(); },
  cnext() { runEvent(null); renderHub(); },
  cseason() { endSeason(); CTAB = 'blatt'; renderHub(); },
  cskip() { let n = 0; while (!CAREER.S.done && CAREER.S.ci < CAREER.S.cal.length && !myGame() && n < 10) { runEvent(null); n++; } renderHub(); },
  cplayer(a) { showPlayer(+a); },
  cform(a) { CAREER.form = a; CAREER.xi = null; saveCareer(); renderHub(`[data-act="cform"][data-arg="${a}"]`); },
  cment(a) { CAREER.ment = +a; saveCareer(); renderHub(`[data-act="cment"][data-arg="${a}"]`); },
  cxiPick(a) { LINEUP.pick = LINEUP.pick === +a ? null : +a; renderHub(`[data-act="cxiPick"][data-arg="${a}"]`); },
  cxiSwap(a) {
    const C = CAREER, i = LINEUP.pick; if (i == null) return;
    const cur = matchSquad(C.team), xi = cur.xi.map(p => p.pid), pid = +a;
    const j = xi.indexOf(pid); if (j >= 0) { [xi[i], xi[j]] = [xi[j], xi[i]]; } else xi[i] = pid;
    C.xi = xi; LINEUP.pick = null; saveCareer(); renderHub('[data-act="cxiAuto"]');
  },
  cxiAuto() { CAREER.xi = null; LINEUP.pick = null; saveCareer(); renderHub('[data-act="cxiAuto"]'); },
  cpk(a) { CAREER.pk = +a; saveCareer(); renderHub(`[data-act="cpk"][data-arg="${a}"]`); },
  ctrain(a) { CAREER.train = a; saveCareer(); renderHub(`[data-act="ctrain"][data-arg="${a}"]`); },
  cdp(a) { const [pid, k] = a.split('|'), p = playerById(+pid); if (!p || p.tid !== CAREER.team || !spendDP(p, k)) return; saveCareer(); AU.select(); showPlayer(p.pid); const b = menu.querySelector(`[data-act="cdp"][data-arg="${a}"]`) || menu.querySelector('[data-act="cdp"]'); if (b) b.focus(); },
  cbuy(a) { const e = buyPlayer(+a); renderHub(); if (e) toast(e); },
  crel(a) { const e = releasePlayer(+a); if (e) toast(e); else { renderHub(); } },
  cdel() { show(`<div class="panel narrow"><h2>SAISON LÖSCHEN?</h2><p>Der Spielstand mit ${esc(TEAMS[CAREER.team].n)} geht verloren.</p><div class="row"><button data-act="chub" autofocus>NEIN</button><button class="main" data-act="cdelYes">JA, LÖSCHEN</button></div></div>`, { back: ACT.chub }); },
  cdelYes() { store.del(CAREER_KEY); CAREER = null; ACT.main(); },
  cleg(a) { LEGVIEW = +a; renderHub(`[data-act="cleg"][data-arg="${a}"]`); },
});
const LINEUP = { pick: null };
// Karriere-Kopfleiste (.csticky) klebt unter dem Innenabstand des Menüs. Der enthält am iPhone Notch oder Dynamic Island, darüber
// scrollte der Inhalt sichtbar durch und die Leiste schien zu schweben. Sobald sie klebt, deckt ein Streifen in ihrer Farbe die Lücke ab
// (wie bei Korb- und Hallen-Legenden). Gescrollt wird am Handy das ganze Menü, auf Tablet und Desktop das Panel selbst.
function stickyGap() {
  const s = menu.querySelector('.csticky'); if (!s) return;
  const pan = s.closest('.panel'), sc = pan && getComputedStyle(pan).overflowY !== 'visible' && pan.scrollHeight > pan.clientHeight ? pan : menu;
  if (pan && !pan.sgOn) { pan.sgOn = true; pan.addEventListener('scroll', stickyGap, { passive: true }); }
  const pt = parseFloat(getComputedStyle(sc).paddingTop) || 0, top = s.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientTop;
  s.style.setProperty('--gap', (pt + 2) + 'px'); s.classList.toggle('stuck', sc.scrollTop > 0 && Math.abs(top - pt) < 1.5);
}
menu.addEventListener('scroll', stickyGap, { passive: true }); addEventListener('resize', stickyGap);
let LEGVIEW = null;
function toast(msg) { const el = menu.querySelector('.cmsg'); if (el) { el.textContent = msg; el.hidden = false; } else alert(msg); }
function renderNewCareer(focusSel) {
  const T = TEAMS[NEWC.team], s = teamStr(NEWC.team), n = ligaOf(NEWC.team).ids.length, md = n % 2 ? n : n - 1;
  PK.act = 'ncTeam'; PK.sel = [NEWC.team]; PK_RENDER = renderNewCareer;
  show(`<div class="panel"><div class="row spread"><h2>NEUE SAISON</h2><button class="small" data-act="main">ZURÜCK</button></div>
    <p class="muted">Übernimm einen Verein aus einer Kreisliga in ganz Deutschland: erst den Landesverband auf der Karte, dann den Kreis, dann den Verein – oder einfach suchen. Kreispokal inklusive, und die Meister spielen mit Kreismeistern aus ganz Deutschland um die ${TROPHY}.</p>
    ${pickerHTML()}
    ${CAREER_NOTE ? `<p class="cmsg">${esc(CAREER_NOTE)} <button class="small" data-act="cExportOld">ALTEN STAND SICHERN</button></p>` : ''}
    <div class="row"><button class="small" data-act="cImport">SPIELSTAND AUS DATEI LADEN</button></div>
    <div class="row"><button class="small" data-act="ncEigen">${T.custom ? 'EIGENEN VEREIN BEARBEITEN' : '+ EIGENEN VEREIN ANLEGEN'}</button><span class="muted">Verein nicht dabei? Leg ihn selbst an.</span></div>
    <div class="tcard active"><div class="tname"><img src="${iconURL(T.home)}" alt="">${esc(T.n.toUpperCase())}</div>${bars([['Gesamt', s.ovr], ['Angriff', s.att], ['Abwehr', s.def]], 50, 82)}
      <div class="tag">${esc(homeTag(NEWC.team).toUpperCase())} · ${GROUNDS[T.ground]} · BESTER SPIELER: ${esc(s.star.name.toUpperCase())} (${s.star.grp})</div></div>
    <div class="row"><span class="tag">SAISON</span>${[[1, `NUR HINRUNDE (${md} SPIELTAGE)`], [2, `HIN- UND RÜCKRUNDE (${md * 2})`]].map(([v, n]) => `<button class="small ${NEWC.len === v ? 'on' : ''}" data-act="ncLen" data-arg="${v}">${n}</button>`).join('')}</div>
    <div class="row"><span class="tag">SCHWIERIGKEIT</span>${DIFF.map((d, i) => `<button class="small ${NEWC.diff === i ? 'on' : ''}" data-act="ncDiff" data-arg="${i}">${d.n.toUpperCase()}</button>`).join('')}</div>
    <div class="row sfoot"><button class="main" data-act="ncGo" ${focusSel ? '' : 'autofocus'}>LOS GEHT'S</button><span class="muted">${esc(TEAMS[NEWC.team].short)}</span></div></div>`, { back: ACT.main });
  pickerWire(renderNewCareer);
  if (focusSel) { const el = menu.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
}
const dpOpen = () => ensureSquad(CAREER.team).reduce((n, p) => n + (p.dp || 0), 0);
const TABS = [['blatt', 'KREISBLATT'], ['tab', 'TABELLE'], ['kader', 'KADER'], ['elf', 'AUFSTELLUNG'], ['plan', 'SPIELPLAN'], ['cup', 'KREISPOKAL'], ['po', 'PLAYOFFS'], ['stat', 'STATISTIK'], ['hist', 'HISTORIE'], ['verein', 'VEREIN']];
function renderHub(focusSel) {
  const C = CAREER, T = TEAMS[C.team], S = C.S, ev = curEvent(), g = myGame(ev);
  const head = `<div class="csticky"><div class="row spread chead"><div class="tname"><img src="${iconURL(T.home)}" alt="">${esc(T.n.toUpperCase())}</div>
    <div class="cbud"><b>${fmtMoney(C.money)}</b><span class="tag">SAISON ${seasonLabel(C.year)}${S.ci < S.cal.length && curEvent().t !== 'po' ? ` · ${posOf(C.team)}. PLATZ` : ''}</span></div></div>
    <div class="ctabw"><div class="ctabs">${TABS.map(([k, n]) => `<button class="small ${CTAB === k ? 'on' : ''}" data-act="ctab" data-arg="${k}">${n}${k === 'kader' && dpOpen() ? ` <span class="badge dp">+${dpOpen()}</span>` : ''}</button>`).join('')}</div></div></div>`;
  const body = { blatt: blattHTML, tab: tableHTML, kader: squadHTML, elf: lineupHTML, plan: planHTML, cup: cupHTML, po: poHTML, stat: statHTML, hist: histHTML, verein: clubHTML }[CTAB] || blattHTML;
  let foot;
  if (S.done || S.ci >= S.cal.length) {
    const sm = seasonSummary();
    foot = `<div class="cfoot"><h2>SAISON ${seasonLabel(C.year)} BEENDET</h2><p>${sm.pos}. Platz · ${sm.pkt} Punkte · ${sm.tore} Tore · ${esc(sm.cupRes)} · ${esc(sm.poRes)}</p><p class="muted">Ziel des Vorstands: ${esc(sm.goal)} – ${sm.ok ? 'erfüllt! Der Vorstand spendiert ein Fass.' : 'verfehlt. Beim Stammtisch wird diskutiert.'}${sm.top && sm.top.p ? ` · Torschützenkönig im Verein: ${esc(sm.top.p.name)} (${sm.top.n})` : ''}</p>
      ${S.po && S.po.champ != null ? `<p class="champ">${esc(TEAMS[S.po.champ].n.toUpperCase())} IST DEUTSCHER KREISLIGA-MEISTER!</p>` : ''}
      <div class="row"><button class="main" data-act="cseason" autofocus>NEUE SAISON</button><button data-act="cshareSeason">SAISON ALS BILD TEILEN</button><button data-act="main">HAUPTMENÜ</button></div></div>`;
  } else if (g) {
    const opp = TEAMS[g.h === C.team ? g.a : g.h], home = g.h === C.team, M = matchSquad(C.team), miss = ensureSquad(C.team).filter(p => p.inj > 0 || p.ban > 0);
    foot = `<div class="cfoot"><p class="muted">${home ? 'Heimspiel' : g.neutral ? 'Neutraler Platz' : 'Auswärts'} · ${GROUNDS[g.neutral ? 0 : TEAMS[g.h].ground]} · Gegner: ${starHTML(stars(squadStr(opp.id)))} · ${esc(CAREER.kl.includes(opp.lg) ? ligaOf(opp.id).n : 'Kreismeister ' + homeTag(opp.id, true))} · Deine Elf: ${M.form}${miss.length ? ` · fehlen: ${miss.map(p => esc(p.name) + (p.inj > 0 ? ' (verletzt)' : ' (gesperrt)')).join(', ')}` : ''}</p>
      </div><div class="sfoot nextbar"><div><h3>${isDerby(g.h, g.a) ? '<span class="badge hot">DERBY</span> ' : ''}${esc(eventLabel(ev))}</h3>
      <div class="np-vs"><img src="${iconURL(TEAMS[g.h].home)}" alt=""><b>${esc(TEAMS[g.h].short.toUpperCase())}</b> – <img src="${iconURL(TEAMS[g.a].home)}" alt=""><b>${esc(TEAMS[g.a].short.toUpperCase())}</b></div></div>
      <div class="row"><button class="main" data-act="cpre" autofocus>VOR DEM SPIEL ›</button><button data-act="cwatch">ZUSCHAUEN</button><button data-act="csim">SIMULIEREN</button></div></div>`;
  } else {
    foot = `<div class="cfoot sfoot"><h3>${esc(eventLabel(ev))}</h3><p class="muted">${ev.t === 'po' ? (S.po.teams.includes(C.team) ? 'Ausgeschieden – die anderen spielen weiter.' : 'Dein Verein ist nicht dabei. Die Kreismeister spielen um die ' + TROPHY + '.') : ev.t === 'cup' ? (S.cupOut != null ? 'Im Kreispokal schon ausgeschieden – die anderen spielen weiter.' : 'Freilos im Kreispokal – eine Runde weiter ohne Spiel.') : 'Spielfrei.'}</p>
      <div class="row"><button class="main" data-act="cnext" autofocus>WEITER</button>${ev.t === 'po' ? '<button data-act="cskip">BIS ZUM SAISONENDE</button>' : ''}</div></div>`;
  }
  show(`<div class="panel">${head}<p class="cmsg" hidden></p>${body()}${foot}</div>`, { back: ACT.main, focus: !focusSel });
  stickyGap();
  if (focusSel) { const el = menu.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
  bindHubCanvases();
  const tw = menu.querySelector('.ctabw'), tb = tw && tw.querySelector('.ctabs');
  if (tb) { const upd = () => { tw.classList.toggle('more-l', tb.scrollLeft > 4); tw.classList.toggle('more-r', tb.scrollLeft + tb.clientWidth < tb.scrollWidth - 4); }; tb.addEventListener('scroll', upd); upd(); const on = tb.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
function bindHubCanvases() {
  menu.querySelectorAll('canvas[data-pid]').forEach(c => { const p = playerById(+c.dataset.pid); if (p) c.getContext('2d').drawImage(portrait(p, TEAMS[p.tid].home), 0, 0); });
}
const formHTML = f => `<div class="cform">${f.map(x => `<i class="${x === 's' ? 'w' : x === 'n' ? 'l' : 'd'}">${x.toUpperCase()}</i>`).join('')}</div>`;
// ---------- Kreisblatt ----------
function blattHTML() {
  const C = CAREER, S = C.S, n = C.news[0], ev = curEvent(), li = C.lg;
  const lastLg = [...S.results].reverse().find(r => r.md);
  const tick = lastLg ? lastLg.games.filter(r => r.li === li).map(r => `<span class="${r.h === C.team || r.a === C.team ? 'me' : ''}">${esc(TEAMS[r.h].k)} ${r.gh}:${r.ga} ${esc(TEAMS[r.a].k)}</span>`).join('') : '';
  const st = standings(li), me = st.indexOf(C.team), from = clamp(me - 2, 0, st.length - 5);
  const mini = st.slice(from, from + 5).map((tid, i) => { const r = S.tables[li][tid]; return `<tr class="${tid === C.team ? 'me' : ''} ${from + i === 0 ? 'zone-a' : from + i >= st.length - 2 ? 'zone-d' : ''}"><td>${from + i + 1}</td><td class="l">${esc(TEAMS[tid].short)}</td><td>${r.sp}</td><td>${r.pkt}</td></tr>`; }).join('');
  const top = topScorers(li, 5).map(x => `<tr class="${x.p.tid === C.team ? 'me' : ''}"><td class="l">${esc(x.p.name)} <span class="tag">${esc(TEAMS[x.p.tid].k)}</span></td><td>${x.n}</td></tr>`).join('');
  const g = myGame(ev), opp = g ? TEAMS[g.h === C.team ? g.a : g.h] : null;
  const derbyTxt = g && isDerby(g.h, g.a) ? 'DERBY gegen den Erzrivalen – das ganze Dorf schaut zu! ' : '';
  const fav = g ? derbyTxt + (squadStr(C.team) - squadStr(opp.id) > 2 ? 'Wir sind Favorit.' : squadStr(opp.id) - squadStr(C.team) > 2 ? `${opp.short} ist Favorit.` : 'Ein Spiel auf Augenhöhe.') : '';
  const danger = opp ? ensureSquad(opp.id).filter(p => p.grp === 'ST' || p.grp === 'MF').sort((a, b) => (b.ss.g - a.ss.g) || (b.ovr - a.ovr))[0] : null;
  return `<div class="paper"><div class="np-mast">KREISBLATT</div>
    <div class="np-date"><span>${seasonLabel(C.year)} · ${esc(lgName(li))}</span><span>${ev ? esc(eventLabel(ev)) : 'Saisonende'}</span></div>
    ${n ? `<p class="np-head">${esc(n.h)}</p><p class="np-lead">${esc(n.t)}</p>` : ''}
    ${tick ? `<div class="np-ticker">${tick}</div>` : ''}
    <div class="np-grid">
      <div class="np-box"><h4>NÄCHSTES SPIEL</h4>${g ? `<div class="np-vs"><img src="${iconURL(TEAMS[g.h].home)}" alt=""><b>${esc(TEAMS[g.h].short)}</b><span>–</span><img src="${iconURL(TEAMS[g.a].home)}" alt=""><b>${esc(TEAMS[g.a].short)}</b></div><p>${fav}${danger ? ` Aufpassen auf ${esc(danger.name)}${danger.ss.g ? ` (${danger.ss.g} ${danger.ss.g === 1 ? 'Tor' : 'Tore'})` : ''}.` : ''}</p>` : '<p>Kein Spiel für uns.</p>'}
        <h4>VORSTAND</h4><p>Saisonziel: ${esc(S.goal.txt)}.</p></div>
      <div class="np-box"><h4>TABELLE</h4><table class="mini dt"><tr><th></th><th class="l"></th><th>SP</th><th>PKT</th></tr>${mini}</table></div>
      <div class="np-box"><h4>TORJÄGER</h4><table class="mini dt">${top || '<tr><td class="l">noch keine Tore</td></tr>'}</table></div>
    </div>
    <h4 class="np-sec">MELDUNGEN</h4><div class="np-news">${C.news.slice(0, 14).map(x => `<p><b>${esc(x.d.toUpperCase())}</b>${esc(x.h)} – ${esc(x.t)}</p>`).join('')}</div></div>`;
}
function topScorers(li, n) {
  const ids = new Set(li == null ? Object.keys(CAREER.squads).map(Number) : LIGEN[li].ids), out = [];
  for (const [pid, g] of Object.entries(CAREER.S.scorers)) { const p = playerById(+pid); if (p && ids.has(p.tid)) out.push({ p, n: g }); }
  return out.sort((a, b) => b.n - a.n).slice(0, n);
}
// ---------- Tabelle ----------
function tableHTML() {
  const C = CAREER, S = C.S, li = C.kl.includes(LEGVIEW) ? LEGVIEW : C.lg;
  const st = standings(li);
  return `${C.kl.length > 1 ? `<div class="ctabs">${C.kl.map(i => `<button class="small ${li === i ? 'on' : ''}" data-act="cleg" data-arg="${i}">${esc(LIGEN[i].n.toUpperCase())}</button>`).join('')}</div>` : `<h3>${esc(lgName(li).toUpperCase())}</h3>`}
  <div class="tblwrap"><table class="dt"><tr><th>#</th><th class="l">VEREIN</th><th>SP</th><th class="hm">S</th><th class="hm">U</th><th class="hm">N</th><th>TORE</th><th class="hs">DIFF</th><th>PKT</th><th class="c hm">FORM</th></tr>
  ${st.map((tid, i) => { const r = S.tables[li][tid]; return `<tr class="${tid === C.team ? 'me' : ''} ${i === 0 ? 'zone-a' : i >= st.length - 2 ? 'zone-d' : ''}"><td>${i + 1}</td><td class="l"><img src="${iconURL(TEAMS[tid].home)}" alt="" style="width:14px;height:14px;vertical-align:-2px;image-rendering:pixelated"> ${esc(TEAMS[tid].n)}</td><td>${r.sp}</td><td class="hm">${r.s}</td><td class="hm">${r.u}</td><td class="hm">${r.n}</td><td>${r.tf}:${r.tg}</td><td class="hs">${r.tf - r.tg > 0 ? '+' : ''}${r.tf - r.tg}</td><td>${r.pkt}</td><td class="c hm">${formHTML(r.form)}</td></tr>`; }).join('')}</table></div>
  <p class="muted">Grün: Meister – spielt in den Playoffs um die deutsche Kreisliga-Meisterschaft. Rot: Abstiegsplätze.</p>`;
}
// ---------- Kader ----------
const noteAvg = s => s.nn ? fmtNote(Math.round(s.ns / s.nn * 10) / 10) : '–';
function squadHTML() {
  const C = CAREER, sq = ensureSquad(C.team).slice().sort((a, b) => 'TWABMFST'.indexOf(a.grp) - 'TWABMFST'.indexOf(b.grp) || b.ovr - a.ovr);
  const fit = p => `<span class="fbar"><i style="width:${Math.round(p.fit)}%;background:${p.fit > 80 ? 'var(--green)' : p.fit > 60 ? 'var(--gold)' : 'var(--hot)'}"></i></span>`;
  const dpN = sq.reduce((n, p) => n + (p.dp || 0), 0);
  return `${dpN ? `<p><span class="badge dp">+${dpN}</span> Offene Entwicklungspunkte: Spieler mit grünem Plus antippen und verteilen.</p>` : ''}<div class="tblwrap"><table class="dt"><tr><th>#</th><th class="l">SPIELER</th><th>POS</th><th class="hs">ALTER</th><th>STÄRKE</th><th class="hm">POT</th><th class="hm">FIT</th><th class="hm">FORM</th><th>SP</th><th>T</th><th class="hs">NOTE</th></tr>
  ${sq.map(p => `<tr><td>${p.num}</td><td class="l"><button class="link" data-act="cplayer" data-arg="${p.pid}">${esc(p.name)}</button>${p.inj > 0 ? ' <span class="badge inj">VERL</span>' : ''}${p.ban > 0 ? ' <span class="badge inj">GESP</span>' : ''}${p.trait ? ` <span class="badge">${esc(p.trait.toUpperCase())}</span>` : ''}${p.dp > 0 ? ` <span class="badge dp">+${p.dp}</span>` : ''}</td><td>${p.grp}</td><td class="hs">${p.age}</td><td>${p.ovr}</td><td class="hm">${p.pot}</td><td class="hm">${fit(p)}</td><td class="hm">${p.form > 0.8 ? '↗' : p.form < -0.8 ? '↘' : '→'}</td><td>${p.ss.sp}</td><td>${p.ss.g}</td><td class="hs">${noteAvg(p.ss)}</td></tr>`).join('')}</table></div>
  <p class="muted">Tippe auf einen Namen für die Spielerkarte – dort kannst du deine Spieler auch bearbeiten und Entwicklungspunkte verteilen (<span class="badge dp">+1</span>). Stärke 1–99, POT = Potenzial.</p>`;
}
function showPlayer(pid) {
  const p = playerById(pid); if (!p) return;
  const mine = p.tid === CAREER.team, T = TEAMS[p.tid];
  const at = ATTRS.filter(a => p.grp === 'TW' || a !== 'tw').map(a => [ATTR_N[a], p[a]]);
  show(`<div class="panel narrow"><div class="pcard"><canvas width="40" height="40" data-pid="${p.pid}"></canvas><div><h2>${esc(p.first)} ${p.nick ? `„${esc(p.nick)}“ ` : ''}${esc(p.name)}</h2>
    <p class="muted">#${p.num} · ${GRP_N[p.grp]} · ${p.age} Jahre${p.job ? ` · ${esc(p.job)}` : ''} · ${esc(T.short)}</p></div></div>
    ${p.trait ? `<p><span class="badge">${esc(p.trait.toUpperCase())}</span></p>` : ''}
    ${bars(at.concat([['Gesamt', p.ovr], ['Potenzial', p.pot]]), 20, 95)}
    ${mine && !(p.dp > 0) ? `<p class="muted">ENTWICKLUNGSPUNKTE: keine offen. Punkte gibt es durch Training (je jünger und je mehr Luft bis zum Potenzial, desto öfter) und für starke Spiele – dann erscheinen hier Knöpfe zum Verteilen.</p>` : ''}
    ${mine && p.dp > 0 ? `<h3>ENTWICKLUNGSPUNKTE: ${p.dp}</h3><p class="muted">Wohin soll ${esc(p.name)} sich entwickeln? Jeder Punkt hebt einen Wert um 1 (bis ${DP_MAX}). Was bis zum Saisonende offen ist, setzt das Training nach dem Schwerpunkt.</p>
    <div class="row">${dpKeys(p).map(a => `<button class="small" data-act="cdp" data-arg="${p.pid}|${a}" ${p[a] >= DP_MAX ? 'disabled' : ''}>+ ${ATTR_N[a].toUpperCase()} ${p[a]}</button>`).join('')}</div>` : ''}
    <div class="kpis"><div class="kpi"><span>SAISON</span><b>${p.ss.sp} SP · ${p.ss.g} T · ${p.ss.a} V</b><i>Note ${noteAvg(p.ss)}${p.grp === 'TW' ? ` · ${p.ss.co} Gegentore` : ''}</i></div>
      <div class="kpi"><span>KARRIERE</span><b>${p.cs.sp} SP · ${p.cs.g} T · ${p.cs.a} V</b><i>Note ${noteAvg(p.cs)} · ${p.cs.yc} Gelb · ${p.cs.rc} Rot</i></div>
      <div class="kpi"><span>ZUSTAND</span><b>${Math.round(p.fit)}% FIT</b><i>${p.inj > 0 ? `verletzt (${p.inj} Sp.)` : p.ban > 0 ? `gesperrt (${p.ban} Sp.)` : p.form > 0.8 ? 'in Form' : p.form < -0.8 ? 'außer Form' : 'normal'}</i></div></div>
    <div class="row"><button class="main" data-act="chub" autofocus>ZURÜCK</button>${mine ? `<button data-act="cpEdit" data-arg="${p.pid}">BEARBEITEN</button><button data-act="crel" data-arg="${p.pid}">VERABSCHIEDEN</button>` : ''}</div></div>`, { back: ACT.chub });
  bindHubCanvases();
}
// ---------- Aufstellung ----------
function lineupHTML() {
  const C = CAREER, M = matchSquad(C.team), F = FORMS[C.form], sq = ensureSquad(C.team);
  const xi = M.xi, pick = LINEUP.pick, others = sq.filter(p => !xi.includes(p)).sort((a, b) => 'TWABMFST'.indexOf(a.grp) - 'TWABMFST'.indexOf(b.grp) || b.ovr - a.ovr);
  const pk = C.pk != null ? playerById(C.pk) : null;
  return `<h3>FORMATION</h3><div class="row">${FORM_KEYS.map(f => `<button class="small ${C.form === f ? 'on' : ''}" data-act="cform" data-arg="${f}">${f}</button>`).join('')}</div>
  <h3>AUSRICHTUNG</h3><div class="row">${MENT.map((m, i) => `<button class="small ${C.ment === i ? 'on' : ''}" data-act="cment" data-arg="${i}">${m}</button>`).join('')}</div>
  <h3>STARTELF ${C.xi ? '(EIGENE)' : '(CO-TRAINER)'} · ${pick == null ? 'POSITION ANTIPPEN ZUM TAUSCHEN' : 'JETZT SPIELER WÄHLEN'}</h3>
  <div class="subs"><div class="btns">${xi.map((p, i) => `<button class="small ${pick === i ? 'on' : ''}" data-act="cxiPick" data-arg="${i}">${F[i][0].padEnd(2)} ${esc(p.name.toUpperCase().slice(0, 13))} <i>${p.grp !== SLOT_GRP[F[i][0]] ? '⚠ ' : ''}${p.ovr} · ${Math.round(p.fit)}%</i></button>`).join('')}</div>
  <div class="btns">${others.map(p => `<button class="small" data-act="cxiSwap" data-arg="${p.pid}" ${pick == null || p.inj > 0 || p.ban > 0 ? 'disabled' : ''}>${p.grp} ${esc(p.name.toUpperCase().slice(0, 13))} <i>${p.inj > 0 ? 'VERL' : p.ban > 0 ? 'GESP' : `${p.ovr} · ${Math.round(p.fit)}%`}</i></button>`).join('')}</div></div>
  <div class="row"><button class="small" data-act="cxiAuto">CO-TRAINER STELLT AUF</button></div>
  <h3>ELFMETERSCHÜTZE</h3><div class="row">${xi.filter(p => p.grp !== 'TW').sort((a, b) => b.sch - a.sch).slice(0, 5).map(p => `<button class="small ${pk && pk.pid === p.pid ? 'on' : ''}" data-act="cpk" data-arg="${p.pid}">${esc(p.name.toUpperCase())} ${p.sch}</button>`).join('')}</div>
  <p class="muted">⚠ = Spieler auf fremder Position (schwächer). Verletzte und gesperrte Spieler setzt der Co-Trainer automatisch aus.</p>`;
}
// ---------- Spielplan ----------
function planHTML() {
  const C = CAREER, S = C.S;
  const rows = S.cal.map((ev, i) => {
    const res = S.results.find(r => r.ev === i), g = ev.t === 'lg' ? ev.games[C.lg].find(([h, a]) => h === C.team || a === C.team) : null;
    if (ev.t === 'lg' && g) {
      const r = res && res.games.find(x => x.li === C.lg && x.h === g[0] && x.a === g[1]);
      const me = g[0] === C.team, out = r ? (me ? r.gh - r.ga : r.ga - r.gh) : null;
      return `<tr class="${i === S.ci ? 'me' : ''}"><td>${ev.md}.</td><td class="l">${me ? 'H' : 'A'} · ${esc(TEAMS[me ? g[1] : g[0]].n)}${isDerby(g[0], g[1]) ? ' <span class="badge hot">DERBY</span>' : ''}</td><td>${r ? `${r.gh}:${r.ga}` : '–'}</td><td class="c">${out == null ? '' : `<div class="cform"><i class="${out > 0 ? 'w' : out < 0 ? 'l' : 'd'}">${out > 0 ? 'S' : out < 0 ? 'N' : 'U'}</i></div>`}</td></tr>`;
    }
    if (ev.t === 'lg') return `<tr class="${i === S.ci ? 'me' : ''}"><td>${ev.md}.</td><td class="l muted">spielfrei</td><td></td><td></td></tr>`;
    if (ev.t === 'po') return `<tr class="${i === S.ci ? 'me' : ''}"><td>PO</td><td class="l">${PO_NAMES[ev.r]}</td><td></td><td></td></tr>`;
    if (ev.t === 'cup') {
      const t = (S.cup.rounds[ev.r] || []).find(x => x.a === C.team || x.b === C.team);
      const opp = t ? (t.b == null ? 'Freilos' : 'Kreispokal · ' + TEAMS[t.a === C.team ? t.b : t.a].n) : S.cupOut != null && S.cupOut < ev.r ? 'Kreispokal · ausgeschieden' : 'Kreispokal · Gegner offen';
      const out = t && t.w != null && t.b != null ? (t.w === C.team ? 1 : -1) : null;
      return `<tr class="${i === S.ci ? 'me' : ''}"><td>POK</td><td class="l">${esc(cupName(ev.r))} · ${esc(opp)}</td><td>${t && t.gh != null ? `${t.gh}:${t.ga}${t.so ? ' n.E.' : ''}` : '–'}</td><td class="c">${out == null ? '' : `<div class="cform"><i class="${out > 0 ? 'w' : 'l'}">${out > 0 ? 'S' : 'N'}</i></div>`}</td></tr>`;
    }
    return '';
  }).join('');
  return `<div class="tblwrap"><table class="dt"><tr><th>ST</th><th class="l">GEGNER</th><th>ERG</th><th class="c"></th></tr>${rows}</table></div>`;
}
// ---------- Playoffs ----------
function poHTML() {
  const C = CAREER, P = C.S.po;
  if (!P) return `<p>Nach dem letzten Spieltag spielen die Meister der Kreisligen deines Kreises mit Kreismeistern aus ganz Deutschland – von Schleswig-Holstein bis Südbaden – im K.-o.-System um die <b>${TROPHY}</b>: Achtelfinale, Viertelfinale, Halbfinale und das Endspiel im Stadion am Schlosspark. Unentschieden? Dann Elfmeterschießen (im Finale vorher Verlängerung).</p><p class="muted">Aktuell: ${posOf(C.team)}. Platz in der ${esc(lgName())}.</p>`;
  return bracketHTML(P.rounds, PO_NAMES, P.champ, '🏆', 0) + `<p class="muted">${P.teams.map(t => `${esc(TEAMS[t].short)} (${esc(C.kl.includes(TEAMS[t].lg) ? LIGEN[TEAMS[t].lg].n : homeTag(t, true))})`).join(' · ')}</p>`;
}
// K.-o.-Baum: Runden als Spalten (bei vielen Runden nur die aktuelle und die folgenden)
function bracketHTML(rounds, names, champ, cupIcon, from) {
  const C = CAREER, n0 = rounds[0].length;
  const tie = t => {
    const row = (tid, g, w) => `<div class="bt ${t.w == null ? '' : w ? 'win' : 'out'} ${tid === C.team ? 'mine' : ''}"><span>${tid == null ? (t.a != null && t.w === t.a ? 'Freilos' : '?') : esc(TEAMS[tid].short)}</span><b>${g ?? ''}</b></div>`;
    return `<div class="tie ${t.a === C.team || t.b === C.team ? 'myt' : ''}">${row(t.a, t.gh, t.w === t.a)}${row(t.b, t.ga, t.w === t.b && t.b != null)}${t.so ? `<div class="bt"><i>n.E. ${t.so[0]}:${t.so[1]}</i></div>` : ''}</div>`;
  };
  const cols = rounds.map((R, r) => { if (r < from) return ''; const n = n0 >> r, list = R.length ? R : Array.from({ length: n }, () => ({ a: null, b: null, w: null })); return `<div class="bcol"><h3>${names[r]}</h3><div class="bties">${list.map(tie).join('')}</div></div>`; }).join('');
  return `<div class="bracket" style="grid-template-columns:repeat(${rounds.length - from + 1},minmax(110px,1fr))">${cols}<div class="bcol champ"><h3>SIEGER</h3><div class="bties"><div class="tie"><div class="bt win"><span>${champ != null ? esc(TEAMS[champ].short) : '?'}</span><b>${cupIcon}</b></div></div></div></div></div>`;
}
// ---------- Kreispokal ----------
function cupHTML() {
  const C = CAREER, P = C.S.cup; if (!P) return '<p class="muted">Kein Kreispokal in dieser Saison.</p>';
  const R = P.rounds, names = R.map((_, r) => cupName(r)), cur = R.findIndex(x => !x.length || x.some(t => t.w == null));
  const from = R.length > 3 ? Math.max(0, Math.min((cur < 0 ? R.length - 1 : cur) - 1, R.length - 3)) : 0;
  return `<p>Der Kreispokal ${esc(KREISE[LIGEN[C.lg].kreis].n)}: ${P.teams.length} Vereine, K.-o.-Runden zwischen den Spieltagen. Unentschieden? Sofort Elfmeterschießen. Das Finale steigt auf neutralem Platz.</p>
    ${bracketHTML(R, names, P.champ, '🥈', from)}`;
}
// ---------- Statistik ----------
function statHTML() {
  const C = CAREER, sq = ensureSquad(C.team);
  const best = (f, k, n = 5) => sq.filter(f).sort((a, b) => k(b) - k(a)).slice(0, n);
  const list = (title, ps, v) => `<div><h3>${title}</h3><table class="dt">${ps.map(p => `<tr><td class="l"><button class="link" data-act="cplayer" data-arg="${p.pid}">${esc(p.name)}</button></td><td>${v(p)}</td></tr>`).join('') || '<tr><td class="l">–</td></tr>'}</table></div>`;
  const avg = p => p.ss.nn ? p.ss.ns / p.ss.nn : 9;
  return `<div class="leaders">
    ${list('TORE', best(p => p.ss.g > 0, p => p.ss.g), p => p.ss.g)}
    ${list('VORLAGEN', best(p => p.ss.a > 0, p => p.ss.a), p => p.ss.a)}
    ${list('BESTE NOTE (AB 3 SPIELEN)', best(p => p.ss.nn >= 3, p => -avg(p)), p => noteAvg(p.ss))}
    ${list('EINSÄTZE', best(() => true, p => p.ss.sp), p => p.ss.sp)}
  </div>
  <h3>TORJÄGER ${esc(LIGEN[C.lg].n.toUpperCase())}</h3><table class="dt">${topScorers(C.lg, 10).map((x, i) => `<tr class="${x.p.tid === C.team ? 'me' : ''}"><td>${i + 1}</td><td class="l">${esc(x.p.name)} <span class="tag">${esc(TEAMS[x.p.tid].short)}</span></td><td>${x.n}</td></tr>`).join('') || '<tr><td class="l">noch keine Tore</td></tr>'}</table>`;
}
// ---------- Verein: Kasse, Training, Wechselbörse, Titel ----------
function clubHTML() {
  const C = CAREER, S = C.S;
  const tro = C.titles.length ? C.titles.map(t => `<div class="tshelf won"><b>${t.kind === 'dkm' ? '🏆' : t.kind === 'pokal' ? '🥈' : '🥇'}</b><span>${t.kind === 'dkm' ? 'DEUTSCHER KREISLIGA-MEISTER' : t.kind === 'pokal' ? 'KREISPOKALSIEGER' : 'MEISTER ' + esc(LIGEN[C.lg].n.toUpperCase())}</span><i>${seasonLabel(t.year)}</i></div>`).join('') : '<p class="muted">Noch keine Titel. Der Pokalschrank im Sportheim wartet.</p>';
  const mk = (C.market || []).map((m, i) => { const p = (C.squads[m.from] || []).find(q => q.pid === m.pid); if (!p) return ''; return `<tr><td class="l"><button class="link" data-act="cplayer" data-arg="${p.pid}">${esc(p.name)}</button> <span class="tag">${esc(TEAMS[m.from].short)}</span></td><td>${p.grp}</td><td class="hs">${p.age}</td><td>${p.ovr}</td><td>${fmtMoney(m.fee)}</td><td><button class="small" data-act="cbuy" data-arg="${i}" ${C.money < m.fee ? 'disabled' : ''}>HOLEN</button></td></tr>`; }).join('');
  const rv = rivalOf();
  return `<div class="kpis">${rv != null ? `<div class="kpi"><span>ERZRIVALE</span><b>${esc(TEAMS[rv].short.toUpperCase())}</b><i>Derbysieg: +500 € und Ruhm</i></div>` : ''}<div class="kpi"><span>VEREINSKASSE</span><b>${fmtMoney(C.money)}</b><i>Eintritt, Bratwurst, Sponsoren, Prämien</i></div>
    <div class="kpi"><span>ZUSCHAUER</span><b>${S.fans || '–'}</b><i>letztes Heimspiel${S.gate ? ' · ' + fmtMoney(S.gate) : ''}</i></div>
    <div class="kpi"><span>PLATZ</span><b>${GROUNDS[TEAMS[C.team].ground]}</b><i>${esc(TEAMS[C.team].short)}</i></div></div>
  <h3>TRAINING (SCHWERPUNKT)</h3><div class="row">${Object.entries(TRAIN).map(([k, [n]]) => `<button class="small ${C.train === k ? 'on' : ''}" data-act="ctrain" data-arg="${k}">${n.toUpperCase()}</button>`).join('')}</div>
  <p class="muted">Wer sich im Training oder mit einem starken Spiel verbessert, bekommt einen Entwicklungspunkt – den verteilst du auf der Spielerkarte. Was bis zum Saisonende offen ist, setzt das Training nach diesem Schwerpunkt.${(() => { const n = ensureSquad(C.team).reduce((s, p) => s + (p.dp || 0), 0); return n ? ` <b>Offen: ${n} Punkt${n === 1 ? '' : 'e'}.</b>` : ''; })()}</p>
  <h3>WECHSELBÖRSE</h3>${mk ? `<div class="tblwrap"><table class="dt"><tr><th class="l">SPIELER</th><th>POS</th><th class="hs">ALTER</th><th>STÄRKE</th><th>HANDGELD</th><th></th></tr>${mk}</table></div>` : '<p class="muted">Im Sommer melden sich wechselwillige Spieler aus dem Kreis.</p>'}
  <h3>TROPHÄEN</h3><div class="tshelves">${tro}</div>
  <div class="row"><button class="small" data-act="cEigen">${C.custom ? 'VEREIN BEARBEITEN' : 'TRIKOT & PLATZ ÄNDERN'}</button><button class="small" data-act="cdel">SAISON LÖSCHEN</button></div>
  <h3>SPIELSTAND</h3><div class="row"><button class="small" data-act="cExport">ALS DATEI SICHERN</button><button class="small" data-act="cImport">AUS DATEI LADEN</button></div>
  <p class="muted">Der Spielstand liegt ${ON_WEB ? 'nur in diesem Browser' : 'auf diesem Gerät'}. Browser löschen ihn manchmal (Safari nach einigen Wochen ohne Besuch) – sichere ihn ab und zu als Datei.</p>`;
}
