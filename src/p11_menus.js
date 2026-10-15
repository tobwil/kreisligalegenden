// ================= Menüs =================
const menu = document.getElementById('menu');
let BACK = null;
const QUICK = { a: HOME_TEAM, b: LIGEN[TEAMS[HOME_TEAM].lg].ids.find(i => i !== HOME_TEAM), side: 'a', mode: 'play' };
function show(html, { back = null, clear = false, focus = true } = {}) {
  menu.innerHTML = html; menu.hidden = false; menu.classList.toggle('clear', clear); BACK = back;
  if (!G || G.demo) AU.startMusic();   // Menümusik nur außerhalb eines Spiels
  document.body.classList.add('menuopen');
  menu.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); AU.init(); AU.select(); const f = ACT[el.dataset.act]; if (f) f(el.dataset.arg, el); }));
  if (focus) { const f = menu.querySelector('[autofocus]') || menu.querySelector('button.main') || menu.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
  menu.scrollTop = 0;
}
function hideMenu() { menu.hidden = true; menu.innerHTML = ''; BACK = null; document.body.classList.remove('menuopen'); clearEdges(); }
function menuBack() { if (BACK) { AU.back(); BACK(); } }
function focusables() { return [...menu.querySelectorAll('button, select, input')].filter(e => e.offsetParent !== null && !e.disabled); }
function menuMove(dir) {
  const els = focusables(); if (!els.length) return;
  const cur = document.activeElement; if (!els.includes(cur)) { els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = 1e9;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy;
    const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4; if (!ok) continue;
    const main = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx), side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    const s = main + side * 2.2; if (s < bs) { bs = s; best = e; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); AU.select(); }
}
addEventListener('keydown', e => {
  if (menu.hidden) return;
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;
  const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
  if (m) { e.preventDefault(); menuMove(m); }
});
const bars = (rows, lo = 40, hi = 90) => `<div class="bars">${rows.map(([l, v]) => `<span>${l}</span><div class="bar"><i style="width:${clamp((v - lo) / (hi - lo), 0.03, 1) * 100}%"></i></div><span>${Math.round(v)}</span>`).join('')}</div>`;
const starHTML = n => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
function teamStr(tid) {
  const ro = roster(tid), xi = autoXI(ro, defaultForm(tid)).xi;
  const avg = (f, k) => { const s = xi.filter(f); return s.length ? s.reduce((a, p) => a + p[k], 0) / s.length : 50; };
  return { ovr: teamOvr(tid), att: Math.round(avg(p => p.grp === 'ST' || p.grp === 'MF', 'ovr')), def: Math.round(avg(p => p.grp === 'AB' || p.grp === 'TW', 'ovr')), star: xi.slice().sort((a, b) => b.ovr - a.ovr)[0] };
}
let INGAME_MENU = false;
const LEGAL = 'Echte Vereinsnamen aller Kreisligen Deutschlands (Stand Herbst 2026), alle Spieler, Werte und Trikots frei erfunden. Kein offizielles Spiel des DFB, der Landesverbände oder der Vereine.';

const ACT = {
  title() {
    show(`<div class="title">
      <h1 class="logo">KREISLIGA-<br>LEGENDEN<span>11 GEGEN 11</span></h1>
      <button class="press" data-act="main" autofocus>${TOUCHDEV ? 'TIPPEN ZUM STARTEN' : 'DRÜCKE START'}</button>
      <p class="legal">${LEGAL}</p>
      <p class="legal">${esc(PLATFORM.legal || '© 2026 Tobias Wilhelm · Quellcode offen, nicht kommerziell · github.com/tobwil/kreisligalegenden')}</p></div>`, { clear: true });
    menu.querySelector('.title').addEventListener('click', () => { AU.init(); AU.select(); ACT.main(); });   // irgendwo tippen reicht
  },
  main() {
    checkVersion();
    const sv = loadCareerSave(), ok = !!sv;
    show(`<div class="panel narrow"><div class="title"><h1 class="logo mlogo">KREISLIGA-<br>LEGENDEN<span>11 GEGEN 11</span></h1></div>
      <div class="btns menu-list">
        ${savedMatch() ? `<button class="main" data-act="resumeMatch" autofocus>SPIEL FORTSETZEN <i>${esc(savedInfo())}</i></button>` : ''}
        <button class="${savedMatch() ? '' : 'main'}" data-act="quick" ${savedMatch() ? '' : 'autofocus'}>FREUNDSCHAFTSSPIEL <i>1 gegen CPU</i></button>
        <button data-act="career">${ok ? 'SAISON FORTSETZEN' : 'SAISON'} <i>${ok ? `${esc(TEAMS[sv.team].short)} · ${seasonLabel(sv.year)}` : 'Kreisliga, Meisterschaft, Playoffs'}</i></button>
        <button data-act="training">TRAINING <i>${store.get(TUT_KEY) ? 'Steuerung üben' : 'neu? Hier lernst du alles'}</i></button>
        <button data-act="erfolge">ERFOLGE <i>Stufe ${lpLevel(PROF.lp)} · ${Object.keys(PROF.ach).length}/${ACHS.length} Abzeichen</i></button>
        <button data-act="controls">STEUERUNG <i>Tasten, Gamepad, Touch</i></button>
        <button data-act="options">OPTIONEN <i>Ton, Steuerung, Tempo</i></button>
        <button data-act="about">ÜBER DAS SPIEL <i>Hobby-Projekt</i></button>
        ${PLATFORM.quit ? '<button data-act="exitGame">BEENDEN</button>' : ''}
      </div>
      <p class="legal" style="text-align:center;margin-inline:auto">${LEGAL}</p></div>`, { back: ACT.title, clear: true });
  },
  quick() { QUICK.side = 'a'; pkFocus(QUICK.a); renderQuick(); },
  qpick(arg) { const id = +arg; if (QUICK.side === 'a') { QUICK.a = id; if (QUICK.b === id) QUICK.b = LIGEN[TEAMS[id].lg].ids.find(i => i !== id); QUICK.side = 'b'; } else { QUICK.b = id; if (QUICK.a === id) QUICK.a = LIGEN[TEAMS[id].lg].ids.find(i => i !== id); } pkFocus(id); renderQuick(`[data-act="qpick"][data-arg="${id}"]`); },
  qside(arg) { QUICK.side = arg; pkFocus(arg === 'a' ? QUICK.a : QUICK.b); renderQuick(`.tcard.${arg}`); },
  qdiff(arg) { SETTINGS.diff = +arg; saveSettings(); renderQuick(`[data-act="qdiff"][data-arg="${arg}"]`); },
  qmode(arg) { QUICK.mode = arg; renderQuick(`[data-act="qmode"][data-arg="${arg}"]`); },
  qstart() { const mp = !TOUCHDEV && QUICK.mp && QUICK.mp !== 'solo' && QUICK.mode !== 'watch' ? QUICK.mp : null; startMatch(QUICK.a, QUICK.b, { human: 0, watch: QUICK.mode === 'watch', mp, mpIn: QUICK.mpIn || 0 }); if (mp) track('zu-zweit', { modus: mp }); },
  controls() {
    const L = LAY(), N = L.keyN, k = x => x === 'LEER' ? 'LEERTASTE' : x, alt = q => (L[q] || []).slice(1).map(c => c.replace(/^Key/, '').replace(/^(Shift)(Left|Right)$/, 'SHIFT').replace('Space', 'LEERTASTE')).filter((v, i, A) => A.indexOf(v) === i && v !== k(N[q]));
    const ks = q => [k(N[q])].concat(alt(q)).join(' / ');
    const D = L.def || { tk: 'b', sl: 'c', pr: 'k' }, dt = q => q === 'a' ? 'Spieler wechseln' : q === D.tk ? 'Tackling (nur von vorn, von hinten gibt es Fouls)' : q === D.sl ? 'Grätsche (Ball zuerst treffen!)' : q === D.pr ? 'halten = ein Mitspieler presst mit' : '–';
    show(`<div class="panel narrow"><h2>STEUERUNG</h2>
      <div class="row"><span class="tag">TASTATUR</span>${Object.entries(LAYOUTS).map(([id, l]) => `<button class="small ${SETTINGS.keys === id || (!LAYOUTS[SETTINGS.keys] && id === 'wasd') ? 'on' : ''}" data-act="optKeys" data-arg="${id}">${l.n}</button>`).join('')}</div>
      <div class="keys">
        <b>${L.moveN.toUpperCase()}</b><span>Laufen${L.move[0] === 'KeyW' ? ' (die Pfeiltasten gehen auch)' : ''}</span>
        <b>${ks('a')}</b><span>Angriff: Pass in Laufrichtung (das blaue Dreieck zeigt den Empfänger), der Mitspieler läuft dem Ball entgegen. Antippen = kurzer Pass, gedrückt halten = fester und weiter (türkiser Balken), beim Loslassen geht der Ball. Kurz bevor ein Pass bei dir ankommt drücken = Direktpass. Abwehr: ${dt('a')}</span>
        <b>${ks('k')}</b><span>Angriff: Steilpass in den Lauf – antippen = normal, halten = weiter in die Tiefe. Abwehr: ${dt('k')}</span>
        <b>KOPFBALL</b><span>Gelber Ring = dort kommt ein hoher Ball in Kopfhöhe an. Ist er in Reichweite, läuft dein Spieler von selbst zum Treffpunkt und der Stick zielt nur noch (Pfeil): hoch/runter = Ecke im Tor, beim Wegköpfen die Richtung. Im Strafraum des Gegners köpft dein Stürmer von selbst aufs Tor (${ks('a')} vorher = ablegen). In der Abwehr: ${ks('b')}, ${ks('c')} oder ${ks('k')} = wegköpfen in Stickrichtung, ${ks('a')} = zum Mitspieler köpfen</span>
        <b>${ks('c')}</b><span>Angriff: Flanke (auf dem Flügel) oder hoher Ball – antippen = automatisch, halten = Kraft (Flanke: kurzer Pfosten → Elfmeterpunkt → langer Pfosten, hoher Ball: weiter). Abwehr: ${dt('c')}</span>
        <b>${ks('b')}</b><span>Angriff: Schuss – antippen = platziert, halten lädt auf (grün flach, gelb hoch, rot drüber); weiter als 40 m vom Tor = Befreiungsschlag hoch und weit nach vorn; ${L.move[0] === 'KeyW' ? 'W/S' : 'Pfeil hoch/runter'} zielt in die Ecke, das Zielkreuz im Tor zeigt wohin. Beim Aufladen ${ks('a')} = Schlenzer an den Innenpfosten, ${ks('c')} = Heber über den Torwart. Kurz bevor der Ball kommt: Direktschuss, Volley oder Kopfball. Freistoß und Elfmeter: Zielansicht hinter dem Ball, Richtung = Fadenkreuz. Abwehr: ${dt('b')}</span>
        <b>${ks('f')}</b><span>Angriff: Trick – die Richtung entscheidet: zur Seite Haken, zurück Zurückziehen, nach vorn Tempo-Dribbling, ohne Richtung Übersteiger. Abwehr: Spieler wechseln</span>
        <b>${ks('s')}</b><span>Sprint (kostet Kraft)</span>
        <b>T / TAB</b><span>Taktik & Wechsel: Formation, Ausrichtung, Auswechslungen (5 Wechsel)</span>
        <b>ESC / P</b><span>Pause · M: Ton an/aus</span>
        <b>TORWART</b><span>Hat dein Torwart den Ball: ${k(N.a)} abwerfen, ${k(N.b)} oder ${k(N.c)} abschlagen. Beim Elfmeter gegen dich: Richtung halten = Ecke raten</span>
        <b>STANDARDS</b><span>Einwurf: Richtung + ${k(N.a)} · Ecke: Richtung verschiebt das Zielvisier im Strafraum, ${k(N.c)} oder ${k(N.b)} flankt genau dorthin, ${k(N.a)} kurz ausgeführt · Freistoß in Schussweite und Elfmeter: Kamera hinter dem Ball, Richtung verschiebt das Fadenkreuz, ${k(N.b)} halten = Kraft (wenig = Bogen über die Mauer, viel = hart und flach), ${k(N.a)} Pass, ${k(N.c)} Flanke</span>
        <b>GAMEPAD</b><span>Wie EA FC: Stick laufen · A Pass (halten = weiter) · B Schuss (beim Aufladen A = Schlenzer, X = Heber) · X Flanke · Y Steilpass · LB Haken · RT Sprint. Abwehr: A Wechsel · B Tackling · X Grätsche · Y Druck · Select Taktik · Start Pause</span>
        <b>TOUCH</b><span>Zwei Knöpfe: antippen = Hauptaktion, gedrückt halten und ziehen = zweite Aktion. PASS: tippen = kurzer Pass, halten = fester und weiter (türkiser Balken), wischen = Steilpass, nach oben wischen = Flanke/hoher Ball (erst halten, dann wischen = mit mehr Kraft). SCHUSS: halten lädt auf, Daumen ziehen = Zielkreuz im Tor verschieben (Zeitlupe), loslassen = Schuss; leicht in die Ecke = Schlenzer, leicht gegen einen herausgelaufenen Torwart = Heber. Abwehr: WECHSEL (halten = Druck), TACKLING (ziehen = Grätsche), Gegner antippen = zu ihm wechseln; hoher Ball: TACKLING = wegköpfen, WECHSEL = zum Mitspieler köpfen. Stick links (weit ziehen = Sprint). Mitspieler antippen = Pass zu ihm. Tricks mit dem Stick: einmal kreisen = Drehung, schnell in die Gegenrichtung schnippen = Trick in die neue Richtung (zurück Zurückziehen, zur Seite Haken), links doppelt antippen oder deinen Spieler antippen = Übersteiger. Knopfgröße in den Optionen</span>
      </div>
      <p class="muted">Abseits ist an (Optionen). Gelb-Rot und Rot schicken den Spieler vom Platz. Fouls im Strafraum geben Elfmeter.</p>
      <div class="row"><button class="main" data-act="back">ZURÜCK</button>${INGAME_MENU ? '' : '<button data-act="training">TRAINING STARTEN</button>'}</div></div>`, { back: () => ACT.back() });
  },
  back() { if (INGAME_MENU) ACT.pause(); else ACT.main(); },
  exitGame() { if (PLATFORM.quit) PLATFORM.quit(); },
  about() {
    show(`<div class="panel narrow"><h2>ÜBER DAS SPIEL</h2>
      <p><b>Kreisliga-Legenden ist ein Fußballspiel im Retro-Pixel-Look</b> über den Amateurfußball – vom Ascheplatz bis zur deutschen Kreisliga-Meisterschaft.</p>
      <p>Dabei sind alle ${TEAMS.length.toLocaleString('de-DE')} Vereine der höchsten Kreisspielklasse aus ${KREISE.length} Kreisen und allen ${VERB.length} Landesverbänden – mit ihren echten Namen, Saison 2026/27, Stand Herbst 2026 (Quelle: öffentliche Tabellen auf fussball.de). Spieler, Spielstärken, Trikotfarben, Sportplätze und Werbebanden sind frei erfunden. Kein offizielles Produkt des DFB, der Landesverbände oder der Vereine. Ein Verein möchte nicht dabei sein? Kurze Nachricht über das Impressum genügt.</p>
      <p>Kostenlos, ohne Werbung, ohne Anmeldung. Spielstände bleiben nur ${ON_WEB ? 'in deinem Browser' : 'auf diesem Gerät'}.</p>
      <p class="muted">Aus der Familie von Hallen-Legenden, Padel-Legenden und Korb-Legenden. Schriften: Press Start 2P und VT323 (SIL Open Font License).</p>
      ${ON_WEB ? '<p class="muted"><a href="../">Startseite mit Story</a> · <a href="../impressum.html">Impressum</a> · <a href="../datenschutz.html">Datenschutz</a></p>' : ''}
      <div class="row"><button class="main" data-act="main" autofocus>ZURÜCK</button></div></div>`, { back: ACT.main });
  },
  options() {
    const v = AU.vol, sl = (k, l) => `<span>${l}</span><input type="range" min="0" max="100" step="5" value="${Math.round(v[k] * 100)}" data-vol="${k}">`;
    const tog = (on, act, a, b) => `<div class="row"><button class="small ${on ? 'on' : ''}" data-act="${act}" data-arg="1">${a}</button><button class="small ${!on ? 'on' : ''}" data-act="${act}" data-arg="0">${b}</button></div>`;
    show(`<div class="panel narrow"><h2>OPTIONEN</h2>
      <div class="opt">
        <span>Ton</span>${tog(AU.on, 'optSound', 'AN', 'AUS')}
        ${sl('master', 'Gesamt')}${sl('music', 'Musik')}${sl('sfx', 'Effekte')}${sl('crowd', 'Zuschauer')}
        <span>Stadionsprecher</span>${tog(AU.vol.speaker, 'optSpeaker', 'AN', 'AUS')}
        <span>Abseits</span>${tog(SETTINGS.offside, 'optOff', 'AN', 'AUS')}
        <span>Auto-Spielerwechsel</span>${tog(SETTINGS.autoswitch, 'optSwitch', 'AN', 'AUS')}
        <span>Co-Trainer wechselt aus</span>${tog(SETTINGS.autosub, 'optSub', 'AN', 'AUS')}
        <span>Wiederholung nach Toren</span>${tog(SETTINGS.replay !== false, 'optReplay', 'AN', 'AUS')}
        <span>Radar</span>${tog(SETTINGS.radar, 'optRadar', 'AN', 'AUS')}
        <span>Steuerhilfen</span><div class="row">${[['auto', 'AUTO'], ['1', 'AN'], ['0', 'AUS']].map(([v, n]) => `<button class="small ${String(SETTINGS.helps === true ? '1' : SETTINGS.helps === false ? '0' : 'auto') === v ? 'on' : ''}" data-act="optHelps" data-arg="${v}">${n}</button>`).join('')}</div>
        <span>Tastatur</span><div class="row">${Object.entries(LAYOUTS).map(([id, l]) => `<button class="small ${SETTINGS.keys === id ? 'on' : ''}" data-act="optKeys" data-arg="${id}">${l.n}</button>`).join('')}</div>
        ${TOUCHDEV ? `<span>Knopfgröße</span><div class="row">${[['s', 'KLEIN'], ['m', 'NORMAL'], ['l', 'GROSS']].map(([v, n]) => `<button class="small ${SETTINGS.btn === v ? 'on' : ''}" data-act="optBtn" data-arg="${v}">${n}</button>`).join('')}</div>` : ''}
        <span>Spieltempo</span><div class="row">${[[0.85, 'RUHIG'], [1, 'NORMAL'], [1.15, 'SCHNELL']].map(([s, n]) => `<button class="small ${SETTINGS.speed === s ? 'on' : ''}" data-act="optSpeed" data-arg="${s}">${n}</button>`).join('')}</div>
      </div>
      <div class="row"><button class="main" data-act="back">ZURÜCK</button></div></div>`, { back: () => ACT.back() });
    menu.querySelectorAll('[data-vol]').forEach(el => el.addEventListener('input', () => { AU.init(); AU.setVol(el.dataset.vol, el.value / 100); }));
  },
  optKeys(a) { SETTINGS.keys = a; saveSettings(); const back = menu.querySelector('.keys') ? ACT.controls : ACT.options; back(); },
  optSound(a) { if ((a === '1') !== AU.on) AU.toggle(); ACT.options(); },
  optSpeaker(a) { AU.vol.speaker = a === '1'; store.set(AUDIO_KEY, AU.vol); ACT.options(); },
  optOff(a) { SETTINGS.offside = a === '1'; saveSettings(); ACT.options(); },
  optSwitch(a) { SETTINGS.autoswitch = a === '1'; saveSettings(); ACT.options(); },
  optSub(a) { SETTINGS.autosub = a === '1'; saveSettings(); ACT.options(); },
  optReplay(a) { SETTINGS.replay = a === '1'; saveSettings(); ACT.options(); },
  optRadar(a) { SETTINGS.radar = a === '1'; saveSettings(); ACT.options(); },
  optHelps(a) { SETTINGS.helps = a === 'auto' ? 'auto' : a === '1'; saveSettings(); ACT.options(); },
  optSpeed(a) { SETTINGS.speed = +a; saveSettings(); ACT.options(); },
  optBtn(a) { SETTINGS.btn = a; saveSettings(); applyBtnSize(); ACT.options(); },
  pause() {
    INGAME_MENU = true; G.paused = true; AU.ambience(false);
    show(`<div class="panel narrow"><h2>PAUSE</h2>
      <p class="muted">${G.T[0].k} ${G.score[0]} : ${G.score[1]} ${G.T[1].k} · ${minuteTxt()}</p>
      ${G.chal ? `<div class="chal">${G.chal.map(x => `<div class="${x.ok ? 'ok' : x.failed ? 'no' : ''}"><b>${x.ok ? '✔' : x.failed ? '✘' : '·'}</b>${esc(x.t)}</div>`).join('')}</div>` : ''}
      <div class="btns menu-list">
        <button class="main" data-act="resume" autofocus>WEITER</button>
        ${G.watch ? '<button data-act="wresume">EINSTEIGEN <i>dein Team übernehmen</i></button>' : ''}
        ${G.human >= 0 && !G.watch ? `<button data-act="tactics">TAKTIK & WECHSEL ${LASTIN === 'key' ? '<i>Q</i>' : ''}</button>` : ''}
        <button data-act="statsNow">STATISTIK</button>
        <button data-act="controls">STEUERUNG</button>
        <button data-act="options">OPTIONEN</button>
        ${!G.watch && !G.so ? '<button data-act="saveQuit">SPEICHERN & BEENDEN <i>später im Hauptmenü fortsetzen</i></button>' : ''}
        <button data-act="quit">${G.career ? 'SPIEL ABBRECHEN (ZÄHLT NICHT)' : 'HAUPTMENÜ'}</button>
      </div></div>`, { back: ACT.resume });
  },
  statsNow() { show(`<div class="panel narrow">${statsHTML()}<div class="row"><button class="main" data-act="pause">ZURÜCK</button></div></div>`, { back: ACT.pause }); },
  resume() { INGAME_MENU = false; hideMenu(); if (G) { G.paused = false; AU.ambience(true); } },
  wresume() { joinGame(); ACT.resume(); },
  quit() { delMatch(); INGAME_MENU = false; hideTutBox(); const car = G && G.career; G = null; startDemo(); if (car) ACT.chub(); else ACT.main(); },
  // Taktik & Wechsel: Formation, Ausrichtung, Wechsel (erst Feldspieler, dann Bankspieler antippen)
  tactics(sel) {
    if (!G || G.human < 0) return;
    INGAME_MENU = true; G.paused = true; AU.ambience(false);
    const t = G.human, me = teamP(t).concat(G.players.filter(p => p.team === t && p.off));
    const pick = G.subPick;
    const row = (p, i) => `<button class="small ${pick === i ? 'on' : ''}" data-act="tsel" data-arg="${i}" ${p.off ? 'disabled' : ''}>${slotOf(p).padEnd(2)} ${esc(p.d.name.toUpperCase().slice(0, 12))} <i>${p.d.yc ? '🟨 ' : ''}${Math.round(p.d.energy * 100)}%</i></button>`;
    const brow = (d, i) => `<button class="small" data-act="tsub" data-arg="${i}" ${d.used || d.subbed || G.subs[t] <= 0 || pick == null ? 'disabled' : ''}>${d.grp} ${esc(d.name.toUpperCase().slice(0, 12))} <i>${d.ovr}${d.subbed ? ' · RAUS' : d.used ? ' · DRIN' : ''}</i></button>`;
    show(`<div class="panel"><div class="row spread"><h2>TAKTIK & WECHSEL</h2><span class="tag">NOCH ${G.subs[t]} WECHSEL</span></div>
      <h3>FORMATION</h3><div class="row">${FORM_KEYS.map(f => `<button class="small ${G.form[t] === f ? 'on' : ''}" data-act="tform" data-arg="${f}">${f}</button>`).join('')}</div>
      <h3>AUSRICHTUNG</h3><div class="row">${MENT.map((m, i) => `<button class="small ${G.ment[t] === i ? 'on' : ''}" data-act="tment" data-arg="${i}">${m}</button>`).join('')}</div>
      <h3>WECHSEL: ${pick == null ? 'SPIELER AUF DEM PLATZ WÄHLEN' : 'JETZT EINEN ERSATZSPIELER WÄHLEN'}</h3>
      <div class="subs"><div class="btns">${me.map(row).join('')}</div><div class="btns">${G.bench[t].map(brow).join('')}</div></div>
      <div class="row"><button class="main" data-act="tdone" ${sel ? '' : 'autofocus'}>WEITER SPIELEN</button></div></div>`, { back: ACT.tdone });
    if (sel) { const el = menu.querySelector(sel); if (el) el.focus({ preventScroll: true }); }
  },
  tform(a) { G.form[G.human] = a; ACT.tactics(`[data-act="tform"][data-arg="${a}"]`); },
  tment(a) { G.ment[G.human] = +a; ACT.tactics(`[data-act="tment"][data-arg="${a}"]`); },
  tsel(a) { G.subPick = +a; ACT.tactics(`[data-act="tsub"]:not([disabled])`); },
  tsub(a) { const me = teamP(G.human).concat(G.players.filter(p => p.team === G.human && p.off)), p = me[G.subPick]; if (p && doSub(p, +a)) { G.subPick = null; AU.whistle(1); } ACT.tactics('[data-act="tdone"]'); },
  tdone() { G.subPick = null; if (G.phase === 'pause') return ACT.halftime(); if (G.phase === 'etpause') return ACT.extraTime(); ACT.resume(); },
  halftime() {
    INGAME_MENU = false; AU.jingle('half'); G.paused = false;
    show(`<div class="panel narrow"><h2>HALBZEIT</h2><p class="res">${G.T[0].k} ${G.score[0]} : ${G.score[1]} ${G.T[1].k}</p>${scorersHTML()}${statsHTML(true)}
      <p class="muted">${pick(['In der Kabine gibt es Tee und deutliche Worte.', 'Der Platzwart kreidet nach.', 'Am Bratwurststand bildet sich eine Schlange.', 'Der Trainer zündet sich eine an.'])}</p>
      <div class="row"><button class="main" data-act="secondHalf" autofocus>2. HALBZEIT</button>${G.human >= 0 && !G.watch ? '<button data-act="tactics">TAKTIK & WECHSEL</button>' : ''}</div></div>`, { back: ACT.secondHalf });
  },
  secondHalf() { hideMenu(); G.paused = false; nextHalf(); },
  extraTime() {
    show(`<div class="panel narrow"><h2>VERLÄNGERUNG</h2><p class="res">${G.T[0].k} ${G.score[0]} : ${G.score[1]} ${G.T[1].k}</p><p class="muted">Unentschieden nach 90 Minuten: Es geht in die Verlängerung (2 × 15 Minuten), danach Elfmeterschießen.</p>
      <div class="row"><button class="main" data-act="etGo" autofocus>WEITER</button>${G.human >= 0 && !G.watch ? '<button data-act="tactics">TAKTIK & WECHSEL</button>' : ''}</div></div>`, { back: ACT.etGo });
  },
  etGo() { hideMenu(); G.paused = false; G.half = 2; nextHalf(); },
  fulltime() {
    delMatch();
    INGAME_MENU = false;
    const w = winnerOf(), me = G.human;
    rateMatch();
    AU.jingle(w === me ? 'win' : 'half');
    const res = G.career ? careerAfterMatch() : null;
    const fl = flairEnd();
    track('spiel-ende', { modus: G.career ? 'saison' : 'freundschaftsspiel', ergebnis: me < 0 || G.watch ? 'zuschauen' : w === me ? 'sieg' : w < 0 ? 'remis' : 'niederlage' });
    const mvp = G.potm;
    const verdict = me < 0 || G.watch ? (w < 0 ? 'UNENTSCHIEDEN.' : `${esc(G.T[w].short.toUpperCase())} GEWINNT.`) : w === me ? 'SIEG! FREIBIER IM SPORTHEIM.' : w < 0 ? 'UNENTSCHIEDEN.' : 'NIEDERLAGE.';
    show(`<div class="panel"><h2>${G.event ? esc(G.event.title) + ' · ' : ''}ENDSTAND</h2>
      <p class="res">${G.T[0].k} ${G.score[0]} : ${G.score[1]} ${G.T[1].k}</p>
      ${G.so ? `<p class="muted" style="text-align:center">nach Elfmeterschießen ${G.so.k[0].reduce((a, b) => a + b, 0)}:${G.so.k[1].reduce((a, b) => a + b, 0)}</p>` : G.half > 2 ? '<p class="muted" style="text-align:center">nach Verlängerung</p>' : ''}
      <p class="muted" style="text-align:center">${verdict}</p>
      ${scorersHTML()}
      ${flairHTML(fl)}
      ${mvp ? `<div class="potm"><canvas id="mvpc" width="40" height="40"></canvas><div><h3>SPIELER DES SPIELS</h3><b style="font-family:var(--pix);font-size:12px">${esc(mvp.d.name.toUpperCase())}</b><div>${G.T[mvp.team].k} · NOTE ${fmtNote(mvp.d.note)}${mvp.d.ms.g ? ` · ${mvp.d.ms.g} TOR${mvp.d.ms.g > 1 ? 'E' : ''}` : ''}${mvp.d.ms.sv ? ` · ${mvp.d.ms.sv} PARADEN` : ''}</div></div></div>` : ''}
      ${statsHTML()}
      ${notesHTML()}
      ${res ? `<p class="muted">${res}</p>` : ''}
      <div class="row sfoot">${G.career ? '<button class="main" data-act="chub" autofocus>WEITER</button>' : `<button class="main" data-act="rematch" autofocus>REVANCHE</button>${diffHint()}<button data-act="toMain">HAUPTMENÜ</button>`}${G.human >= 0 && !G.watch ? '<button data-act="share">ERGEBNIS TEILEN</button>' : ''}</div></div>`, { back: G.career ? ACT.chub : ACT.toMain });
    const cvs = document.getElementById('mvpc'); if (cvs && mvp) cvs.getContext('2d').drawImage(portrait(mvp.d, G.kits[mvp.team]), 0, 0);
  },
  rematch() { const o = G.opts; startMatch(G.tid[0], G.tid[1], o || {}); },
  rematchDiff(v) { const d = clamp(+v, 0, 2); track(d > G.diffI ? 'stufe-hoch' : 'stufe-runter', { stufe: DIFF[d].n.toLowerCase() }); SETTINGS.diff = d; saveSettings(); startMatch(G.tid[0], G.tid[1], Object.assign({}, G.opts, { diff: d })); },
  toMain() { hideTutBox(); G = null; startDemo(); ACT.main(); },
};
function renderQuick(focusSel) {
  const card = (side, tid) => { const T = TEAMS[tid], s = teamStr(tid); return `<div class="tcard ${side} ${QUICK.side === side ? 'active' : ''}" data-act="qside" data-arg="${side}" tabindex="-1">
    <h3>${side === 'a' ? 'DEIN VEREIN' : 'GEGNER'}</h3><div class="tname"><img src="${iconURL(T.home)}" alt="">${esc(T.n.toUpperCase())}</div>
    ${bars([['Gesamt', s.ovr], ['Angriff', s.att], ['Abwehr', s.def]], 50, 82)}<div class="tag">${GROUNDS[T.ground]} · ${esc(homeTag(tid).toUpperCase())}</div></div>`; };
  PK.act = 'qpick'; PK.sel = [QUICK.a, QUICK.b]; PK_RENDER = renderQuick;
  show(`<div class="panel"><div class="row spread"><h2>FREUNDSCHAFTSSPIEL</h2><button class="small" data-act="main">ZURÜCK</button></div>
    <div class="duel">${card('a', QUICK.a)}<div class="vs">VS</div>${card('b', QUICK.b)}</div>
    <h3>${QUICK.side === 'a' ? 'WÄHLE DEINEN VEREIN' : 'WÄHLE DEN GEGNER'}</h3>
    ${pickerHTML()}
    <div class="row"><span class="tag">SCHWIERIGKEIT</span>${DIFF.map((d, i) => `<button class="small ${SETTINGS.diff === i ? 'on' : ''}" data-act="qdiff" data-arg="${i}">${d.n.toUpperCase()}</button>`).join('')}</div>
    <div class="row"><span class="tag">MODUS</span>${[['play', 'SELBST SPIELEN'], ['watch', 'ZUSCHAUEN']].map(([m, n]) => `<button class="small ${QUICK.mode === m ? 'on' : ''}" data-act="qmode" data-arg="${m}">${n}</button>`).join('')}</div>
    ${TOUCHDEV ? '' : `<div class="row"><span class="tag">SPIELER</span>${[['solo', 'ALLEIN'], ['coop', 'ZU ZWEIT MITEINANDER'], ['vs', 'ZU ZWEIT GEGENEINANDER']].map(([m, n]) => `<button class="small ${(QUICK.mp || 'solo') === m ? 'on' : ''}" data-act="qmp" data-arg="${m}">${n}</button>`).join('')}</div>
    ${QUICK.mp && QUICK.mp !== 'solo' ? `<div class="row"><span class="tag">EINGABE</span>${MP_PRESETS.map((p, i) => `<button class="small ${(QUICK.mpIn || 0) === i ? 'on' : ''}" data-act="qmpIn" data-arg="${i}">${p[2]}</button>`).join('')}</div>
      <p class="muted">Spieler 1 (gelb): ${esc(MP_SRC[MP_PRESETS[QUICK.mpIn || 0][0]].help)}<br>Spieler 2 (rosa): ${esc(MP_SRC[MP_PRESETS[QUICK.mpIn || 0][1]].help)}${QUICK.mp === 'vs' ? '<br>Gegeneinander: Spieler 1 spielt den linken Verein, Spieler 2 den Gegner.' : ''}</p>` : ''}`}
    <div class="row sfoot"><button class="main" data-act="qstart" ${focusSel ? '' : 'autofocus'}>ANPFIFF</button><span class="muted">${esc(TEAMS[QUICK.a].short)} – ${esc(TEAMS[QUICK.b].short)} · ${DIFF[SETTINGS.diff].n}${QUICK.mode === 'watch' ? ' · zuschauen' : ''}</span></div></div>`, { back: ACT.main });
  pickerWire(renderQuick);
  if (focusSel) { const el = menu.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
}
// ---------- Noten (Schulnoten 1–6 wie im Kicker), Statistik ----------
const fmtNote = n => n == null ? '–' : n.toFixed(1).replace('.', ',');
function rateMatch() {
  if (G.rated) return; G.rated = true;
  const w = winnerOf(), all = [];
  for (const t of [0, 1]) {
    const conc = G.score[1 - t], ds = G.players.filter(p => p.team === t).map(p => ({ d: p.d, gk: isGK(p), team: t })).concat(G.bench[t].filter(d => d.used || d.subbed).map(d => ({ d, gk: d.grp === 'TW', team: t })));
    for (const x of ds) {
      const m = x.d.ms; if (m.min < G.hlen * 0.35) { x.d.note = null; continue; }
      let n = 3.6 - m.g * 0.9 - m.a * 0.5 - m.sot * 0.08 - m.tk * 0.07 - m.sv * 0.22 + m.og * 0.8 + m.yc * 0.2 + m.rc * 1.6 + (w === t ? -0.35 : w < 0 ? 0 : 0.35);
      if (x.gk) n += conc * 0.35 - (conc === 0 ? 0.6 : 0); else if (x.d.grp === 'AB') n += conc * 0.12 - (conc === 0 ? 0.3 : 0);
      n += rnd(-0.35, 0.35);
      x.d.note = clamp(Math.round(n * 2) / 2, 1, 6); all.push(x);
    }
  }
  const best = all.filter(x => x.d.note != null).sort((a, b) => a.d.note - b.d.note || (b.team === w) - (a.team === w) || b.d.ms.g - a.d.ms.g)[0];
  G.potm = best || null;
}
function scorersHTML() {
  if (!G.log.length) return '';
  const col = t => G.log.filter(g => g.team === t).map(g => `${g.min}' ${esc(g.name)}${g.og ? ' (ET)' : g.pen ? ' (11m)' : ''}`).join('<br>') || '&nbsp;';
  return `<div class="scorers"><div>${col(0)}</div><div>${col(1)}</div></div>`;
}
function statsHTML(short) {
  const S = G.stats, tot = S.poss[0] + S.poss[1] || 1, row = (l, a, b) => `<tr><td>${a}</td><td class="c">${l}</td><td>${b}</td></tr>`;
  return `<div class="tblwrap"><table class="dt cmp"><tr><th>${G.T[0].k}</th><th class="c"></th><th>${G.T[1].k}</th></tr>
    ${row('BALLBESITZ', Math.round(S.poss[0] / tot * 100) + '%', Math.round(S.poss[1] / tot * 100) + '%')}
    ${row('SCHÜSSE (AUFS TOR)', `${S.shots[0]} (${S.onT[0]})`, `${S.shots[1]} (${S.onT[1]})`)}
    ${row('ECKEN', S.corners[0], S.corners[1])}
    ${short ? '' : row('PÄSSE ANGEKOMMEN', S.passes[0] ? Math.round(S.passOk[0] / S.passes[0] * 100) + '%' : '–', S.passes[1] ? Math.round(S.passOk[1] / S.passes[1] * 100) + '%' : '–')}
    ${row('FOULS', S.fouls[0], S.fouls[1])}
    ${row('GELB / ROT', `${S.yellow[0]} / ${S.red[0]}`, `${S.yellow[1]} / ${S.red[1]}`)}
    ${short ? '' : row('ABSEITS', S.offs[0], S.offs[1])}</table></div>`;
}
function notesHTML() {
  const team = t => { const ds = G.players.filter(p => p.team === t).map(p => p.d).concat(G.bench[t].filter(d => d.used || d.subbed)).filter(d => d.note != null);
    return `<div><h3>${esc(G.T[t].short.toUpperCase())}</h3><table class="dt box"><tr><th class="l">SPIELER</th><th>NOTE</th><th>T</th><th>V</th></tr>${ds.sort((a, b) => a.note - b.note).map(d => `<tr><td class="l">${esc(d.name)}${d.ms.yc ? ' 🟨' : ''}${d.ms.rc ? ' 🟥' : ''}</td><td>${fmtNote(d.note)}</td><td>${d.ms.g || ''}</td><td>${d.ms.a || ''}</td></tr>`).join('')}</table></div>`; };
  return `<div class="leaders">${team(0)}${team(1)}</div>`;
}
function togglePause() { if (!G || G.demo) return; if (menu.hidden) ACT.pause(); else if (INGAME_MENU) ACT.resume(); }
// nach einem klaren Ergebnis im Freundschaftsspiel eine andere Schwierigkeit vorschlagen (wie bei Hallen-Legenden)
function diffHint() {
  const h = G.human; if (G.career || G.watch || G.pl || h < 0) return '';
  const gd = G.score[h] - G.score[1 - h], d = G.diffI ?? SETTINGS.diff;
  if (gd >= 4 && d < 2) return `<button data-act="rematchDiff" data-arg="${d + 1}">ZU LEICHT? REVANCHE AUF ${DIFF[d + 1].n.toUpperCase()}</button>`;
  if (gd <= -4 && d > 0) return `<button data-act="rematchDiff" data-arg="${d - 1}">ZU SCHWER? REVANCHE AUF ${DIFF[d - 1].n.toUpperCase()}</button>`;
  return '';
}
function startMatch(ta, tb, o) {
  INGAME_MENU = false; hideMenu(); AU.init(); AU.stopMusic();
  if (!o.resume) delMatch();
  newMatch(ta, tb, o); G.opts = o;
  if (o.mp) setupMulti(o.mp, o.mpIn || 0);
  if (!o.watch && !o.tut && !o.resume) { G.helpN = store.get('krl_games', 0); store.set('krl_games', G.helpN + 1); }
  if (o.watch) { G.watch = true; G.ff = 1; }
  startFlair(o); planFlitzer(o);
  track('spiel-start', { modus: o.tut ? 'training' : o.career ? 'saison' : 'freundschaftsspiel', zuschauen: !!o.watch, verband: o.tut ? undefined : verbOf(ta).n });
}
function joinGame() { if (!G || !G.watch) return; G.watch = false; G.ff = 1; G.ctrl = nearestTo(G.human, G.ball.x, G.ball.y); clearEdges(); }
function startDemo() {
  const L = LEAGUE(Math.random() < 0.3 ? TEAMS[HOME_TEAM].lg : (Math.random() * LIGEN.length) | 0), a = L[(Math.random() * L.length) | 0].id; let b = L[(Math.random() * L.length) | 0].id; if (b === a) b = L[(L.findIndex(t => t.id === a) + 1) % L.length].id;
  newMatch(a, b, { demo: true, hlen: 2 });
  AU.ambience(false);
}
function newDemo() { startDemo(); }
