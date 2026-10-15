// ================= Derbys und Ergebnisbild zum Teilen =================
// Jeder Verein hat in der Saison einen Erzrivalen in der eigenen Liga: einen Verein aus demselben Ort, sonst einen etwa
// gleich starken Nachbarn. Derbys haben mehr Stimmung, eine Prämie und eigene Schlagzeilen. Nach jedem Spiel lässt sich das
// Ergebnis als Zeitungsausschnitt aus dem Kreisblatt (1080 × 1080 Pixel) teilen, etwa in die WhatsApp-Gruppe der Mannschaft.
function rivalOf(C = CAREER) {
  if (!C || !LIGEN[C.lg]) return null;
  if (C.rival != null && LIGEN[C.lg].ids.includes(C.rival) && C.rival !== C.team) return C.rival;
  const words = t => norm(t.n).split(' ').filter(w => w.length > 3 && !/^\d+$/.test(w) && !TRAD.has(w));
  const me = TEAMS[C.team], mine = new Set(words(me)), cands = LIGEN[C.lg].ids.filter(t => t !== C.team);
  let best = cands.find(t => words(TEAMS[t]).some(w => mine.has(w)));   // gleicher Ort im Vereinsnamen
  if (best == null) { const r = seeded(hashStr(me.n + 'rivale')); best = cands.slice().sort((a, b) => Math.abs(TEAMS[a].r - me.r) - Math.abs(TEAMS[b].r - me.r))[(r() * 3) | 0]; }
  C.rival = best ?? null; return C.rival;
}
const isDerby = (h, a) => !!CAREER && rivalOf() != null && ((h === CAREER.team && a === CAREER.rival) || (a === CAREER.team && h === CAREER.rival));
// Ergebnis eines Derbys: Prämie, Schlagzeile, Erfolg
function derbyResult(r, played) {
  if (!isDerby(r.h, r.a)) return;
  const me = CT(), home = r.h === me, my = home ? r.gh : r.ga, op = home ? r.ga : r.gh, opp = TEAMS[home ? r.a : r.h];
  if (my > op) { prize(500, `Derbysieg gegen ${opp.short}`); news('Derby', `DERBYSIEG! ${TEAMS[me].short.toUpperCase()} SCHLÄGT ${opp.short.toUpperCase()}`, `${my}:${op} gegen den Erzrivalen. Im Sportheim wird bis in die Nacht gefeiert, beim Bäcker gibt es Derby-Brezen.`, 'title'); if (played) unlock('derby'); }
  else if (my < op) news('Derby', `Derbypleite gegen ${opp.short}`, `${my}:${op}. Eine Woche lang Spott auf dem Dorfplatz – das Rückspiel ist schon im Kalender markiert.`, 'loss');
  else news('Derby', `Derby endet ${my}:${op}`, `Kein Sieger im Duell mit ${opp.short}. Beide Fanlager sind halb zufrieden.`, 'draw');
}

// ---------- Ergebnisbild ----------
function wrapText(g, s, max) {
  const out = []; let line = '';
  for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function resultCanvas() {
  const S = 360, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const T = (s, x, y, col, size = 8, align = 'left') => { g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = col; g.fillText(s, Math.round(x), Math.round(y)); };
  const ink = '#1d1a14', paper = '#efe6cf', me = G.human >= 0 && !G.watch ? G.human : 0, w = winnerOf();
  // Papier mit gerissenem Rand
  g.fillStyle = '#07060b'; g.fillRect(0, 0, S, S);
  g.fillStyle = paper; g.fillRect(14, 14, S - 28, S - 28);
  for (let x = 14; x < S - 14; x += 4) { const d = (x * 7) % 5; g.fillStyle = '#07060b'; g.fillRect(x, 14, 4, d % 3); g.fillRect(x, S - 14 - (d % 2), 4, 2); }
  // Kopf
  T('KREISBLATT', S / 2, 24, ink, 24, 'center');
  g.fillStyle = ink; g.fillRect(24, 54, S - 48, 2); g.fillRect(24, 70, S - 48, 1);
  const label = G.career && G.career.label ? G.career.label : G.event ? G.event.title : 'FREUNDSCHAFTSSPIEL';
  T(label.slice(0, 40), 24, 59, '#5a5240', 8);
  T(new Date().toLocaleDateString('de-DE'), S - 24, 59, '#5a5240', 8, 'right');
  // Schlagzeile
  const derby = G.career && isDerby(G.tid[0], G.tid[1]);
  const head = derby && w === me ? 'DERBYSIEG!' : w < 0 ? `REMIS IN ${G.T[0].short.toUpperCase()}` : `${G.T[w].short.toUpperCase()} SIEGT ${G.score[w]}:${G.score[1 - w]}`;
  g.font = `16px ${FONT}`; const lines = wrapText(g, head, S - 48).slice(0, 2);
  lines.forEach((l, i) => T(l, S / 2, 80 + i * 20, ink, 16, 'center'));
  // Ergebnis-Kasten mit Trikots
  const y0 = 80 + lines.length * 20 + 8;
  g.fillStyle = '#14111d'; g.fillRect(24, y0, S - 48, 74);
  for (const t of [0, 1]) {
    const cx = t ? S - 76 : 76;
    g.drawImage(jerseyIcon(G.kits[t]), cx - 20, y0 + 6, 40, 40);
    T(G.T[t].k, cx, y0 + 50, '#f3ead6', 8, 'center');
    T(G.T[t].short.toUpperCase().slice(0, 15), cx, y0 + 62, '#9b90ad', 8, 'center');
  }
  T(`${G.score[0]}:${G.score[1]}`, S / 2, y0 + 20, '#ffc83a', 24, 'center');
  if (G.so) T(`n.E. ${G.so.k[0].reduce((a, b) => a + b, 0)}:${G.so.k[1].reduce((a, b) => a + b, 0)}`, S / 2, y0 + 50, '#cfd6f2', 8, 'center');
  // Torschützen
  let y = y0 + 84;
  T('TORE', 24, y, ink, 8); y += 12;
  const rows = [0, 1].map(t => G.log.filter(l => l.team === t).slice(0, 6));
  if (!G.log.length) T('keine', 24, y, '#5a5240', 8);
  rows.forEach((L, t) => L.forEach((l, i) => T(`${l.min}' ${l.name.toUpperCase().slice(0, 13)}${l.og ? ' (ET)' : l.pen ? ' (11M)' : ''}`, t ? S / 2 + 6 : 24, y + i * 11, t ? '#5a2020' : '#1d3a5a', 8)));
  y += Math.max(1, rows[0].length, rows[1].length) * 11 + 8;
  // Statistik in einer Zeile
  const st = G.stats, pos = st.poss[0] + st.poss[1] > 1 ? Math.round(st.poss[0] / (st.poss[0] + st.poss[1]) * 100) : null;
  if (st.shots[0] + st.shots[1] > 0) { T(`SCHÜSSE ${st.shots[0]}:${st.shots[1]}${pos != null ? ` · BALLBESITZ ${pos}:${100 - pos}` : ''}`, 24, y, '#5a5240', 8); y += 16; }
  // Spieler des Spiels
  if (G.potm) { g.fillStyle = ink; g.fillRect(24, y, S - 48, 1); y += 6; T('SPIELER DES SPIELS', 24, y, '#5a5240', 8); y += 11; T(`${G.potm.d.name.toUpperCase()} · NOTE ${fmtNote(G.potm.d.note)}`, 24, y, ink, 8); }
  // Fuß
  g.fillStyle = ink; g.fillRect(24, S - 44, S - 48, 1);
  T('GESPIELT IN KREISLIGA-LEGENDEN', S / 2, S - 38, '#5a5240', 8, 'center');
  T('KREISLIGA-LEGENDEN.DE', S / 2, S - 26, ink, 8, 'center');
  // auf 1080 × 1080 hochskalieren, Pixel bleiben scharf
  const out = document.createElement('canvas'); out.width = 1080; out.height = 1080;
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, 1080, 1080);
  return out;
}
async function shareResult() {
  const cv = resultCanvas(), blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const txt = `${G.T[0].n} ${G.score[0]}:${G.score[1]} ${G.T[1].n} – gespielt in Kreisliga-Legenden: https://kreisliga-legenden.de`;
  unlock('teilen'); track('teilen', { modus: G.career ? 'saison' : 'freundschaftsspiel' });
  try {
    const file = new File([blob], 'kreisliga-ergebnis.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: txt }); return 'geteilt'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'abgebrochen'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kreisliga-ergebnis.png'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'gespeichert';
}
Object.assign(ACT, {
  async share(a, el) { if (el) { el.disabled = true; el.textContent = 'BILD WIRD ERSTELLT …'; } const r = await shareResult(); if (el) { el.textContent = r === 'gespeichert' ? 'BILD GESPEICHERT ✔' : r === 'geteilt' ? 'GETEILT ✔' : 'ERGEBNIS TEILEN'; el.disabled = false; } },
});
