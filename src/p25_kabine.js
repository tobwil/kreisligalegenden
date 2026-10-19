// ================= Kabine nach dem Spiel =================
// Kleine Pixelszene auf dem Ergebnisbildschirm: nach einem Sieg Bierdusche und Jubel, nach einem Remis Schulterzucken auf der Bank,
// nach einer Niederlage hängende Köpfe bei flackerndem Neonlicht. Gezeigt wird dein Verein (beim Zuschauen der Sieger).
const KAB_W = 240, KAB_H = 100;
function kabineInfo() {
  const w = winnerOf(), me = G.human, t = me >= 0 && !G.watch ? me : w >= 0 ? w : 0;
  return { t, mood: w < 0 ? 'draw' : w === t ? 'win' : 'loss' };
}
function kabineHTML() {
  const { mood } = kabineInfo(), alt = { win: 'Kabine: Jubel und Bierdusche', draw: 'Kabine: Schulterzucken auf der Bank', loss: 'Kabine: hängende Köpfe' }[mood];
  return `<canvas class="kabine" id="kabc" width="${KAB_W}" height="${KAB_H}" data-mood="${mood}" role="img" aria-label="${alt}"></canvas>`;
}
// Aufstellung der Szene: wer wo steht oder sitzt (einmal festgelegt, gezeichnet wird pro Bild)
function kabineCast(t, mood) {
  const ps = G.players.filter(p => p.team === t && !p.off).sort((a, b) => (a.d.num || 0) - (b.d.num || 0));
  const star = G.potm && G.potm.team === t && ps.includes(G.potm) ? G.potm : ps.find(p => p.d.ms && p.d.ms.g) || ps[0];
  const rest = ps.filter(p => p !== star).slice(0, 6), out = [];
  if (mood === 'win') {   // alle stehen und springen, der Held mit der Flasche in der Mitte
    const row = [...rest.slice(0, 3), star, ...rest.slice(3)];
    row.forEach((p, i) => { const x = 34 + i * (172 / Math.max(1, row.length - 1)); out.push({ p, x, y: 88, pose: p === star ? 'faust' : 'cheer', ph: i * 0.37, bottle: p === star }); });
  } else {   // die meisten sitzen auf der Bank, zwei stehen davor
    const sit = rest.slice(0, 5), stand = [star, rest[5]].filter(Boolean);
    sit.forEach((p, i) => out.push({ p, x: 40 + i * 34, y: 74, pose: 'sit', ph: i * 0.5, towel: mood === 'loss' && i === 2 }));
    stand.forEach((p, i) => out.push({ p, x: 70 + i * 90, y: 90, pose: mood === 'loss' ? 'sad' : i ? 'hold' : 'idle', ph: i, beer: mood === 'draw' && i === 1 }));
  }
  return out;
}
function kabineStart() {
  const cv = document.getElementById('kabc'); if (!cv || !G) return;
  const g = cv.getContext('2d'), { t, mood } = kabineInfo(), kit = G.kits[t], cast = kabineCast(t, mood), score = [G.score[t], G.score[1 - t]];
  let last = -1;
  const loop = now => {
    if (!cv.isConnected) return;
    const f = Math.floor(now / 1000 * 10);   // 10 Bilder pro Sekunde reichen für Pixel
    if (f !== last) { last = f; drawKabine(g, now / 1000, kit, cast, mood, score, t); }
    requestAnimationFrame(loop);
  };
  drawKabine(g, 0, kit, cast, mood, score, t);
  requestAnimationFrame(loop);
}
function drawKabine(g, s, kit, cast, mood, score, t) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  g.imageSmoothingEnabled = false;
  // Wand mit Kacheln, Streifen in Vereinsfarbe, Fliesenboden
  R(0, 0, KAB_W, 70, '#c9c2a8');
  for (let y = 0; y < 70; y += 8) R(0, y, KAB_W, 1, '#b3ab90');
  for (let y = 0; y < 70; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < KAB_W; x += 12) R(x, y, 1, 8, '#b3ab90');
  R(0, 40, KAB_W, 4, kit.c1); R(0, 44, KAB_W, 1, shade(kit.c1, 0.6));
  R(0, 70, KAB_W, 30, '#565b63');
  for (let x = 0; x < KAB_W; x += 16) R(x, 70, 1, 30, '#4a4f56');
  R(0, 84, KAB_W, 1, '#4a4f56'); R(0, 70, KAB_W, 1, '#3b3f45');
  // Taktiktafel mit dem Ergebnis in Kreide
  R(6, 6, 52, 30, '#7a5230'); R(8, 8, 48, 26, '#1f3a2a');
  const sc = 2, tw = digitsW(score[0], sc) + 6 + digitsW(score[1], sc);
  const tx = 32 - tw / 2; drawDigits(g, score[0], tx, 14, '#e8efe6', sc); R(tx + digitsW(score[0], sc) + 2, 17, 2, 2, '#e8efe6'); R(tx + digitsW(score[0], sc) + 2, 22, 2, 2, '#e8efe6');
  drawDigits(g, score[1], tx + digitsW(score[0], sc) + 6, 14, '#e8efe6', sc);
  R(12, 29, 14, 1, 'rgba(232,239,230,0.5)'); R(30, 29, 20, 1, 'rgba(232,239,230,0.5)');
  // Haken mit Trikots (Straßenklamotten der anderen), Neonröhre
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 24; R(x + 5, 8, 2, 3, '#3a3a3a');
    const c = i % 3 === 2 ? '#3d5a80' : kit.c1, c2 = i % 3 === 2 ? '#2b4060' : kit.c2;
    R(x, 11, 12, 4, c); R(x - 2, 11, 3, 6, c); R(x + 11, 11, 3, 6, c); R(x + 1, 15, 10, 9, c); R(x + 5, 12, 2, 12, c2);
  }
  const flick = mood === 'loss' && Math.sin(s * 7) + Math.sin(s * 2.3) > 1.5;
  R(96, 1, 48, 3, flick ? '#9a978a' : '#fffbe0');
  // Bank
  R(10, 64, 220, 3, '#a0703a'); R(10, 67, 220, 1, '#6e4a24');
  for (const x of [16, 120, 222]) R(x, 68, 3, 7, '#6e4a24');
  // Bierkasten (Sieg) bzw. umgekippte Wasserflasche (Niederlage)
  if (mood !== 'loss') { R(8, 80, 18, 10, '#c8a020'); R(8, 80, 18, 2, '#8a6c10'); for (let i = 0; i < 4; i++) R(10 + i * 4, 77, 2, 4, '#5a3a12'); }
  if (mood === 'loss') { R(200, 88, 9, 3, '#7cc4e8'); R(209, 89, 2, 1, '#e8f4fa'); }
  // Spieler: erst die auf der Bank, dann die stehenden (weiter vorn)
  const fr = Math.floor(s * 8);
  const drawP = (look, pose, f, x, y, flip) => g.drawImage(sprite(look, pose, f, flip), Math.round(x - AX), Math.round(y - AY));
  for (const c of [...cast].sort((a, b) => a.y - b.y)) {
    const flip = c.x > KAB_W / 2, jump = mood === 'win' && !c.bottle ? Math.abs(Math.sin(s * 5 + c.ph * 4)) * 5 : 0;
    const sway = mood === 'loss' && c.pose === 'sit' ? (Math.sin(s * 1.3 + c.ph) > 0.6 ? 1 : 0) : 0;
    drawP(c.p.look, c.pose, c.pose === 'cheer' ? (fr + Math.round(c.ph * 6)) % 6 : c.pose === 'faust' ? fr % 2 : fr % 2, c.x, c.y - jump + sway, flip);
    if (c.towel) { const hx = c.x + (flip ? 1 : -1); R(hx - 5, 49 + sway, 10, 5, '#f2f2ee'); R(hx - 6, 52 + sway, 2, 9, '#f2f2ee'); R(hx + 4, 52 + sway, 2, 9, '#f2f2ee'); R(hx - 5, 49 + sway, 10, 1, '#d8d8d0'); }
    if (c.beer) { const hx = c.x + (flip ? -4 : 4), hy = c.y - 18; R(hx - 1, hy - 7, 3, 7, '#5a3a12'); R(hx, hy - 9, 1, 2, '#5a3a12'); R(hx - 1, hy - 5, 3, 2, '#e8d070'); }
    if (c.bottle) {   // Flasche hoch über dem Kopf, Bierdusche fällt auf die anderen
      const hx = c.x + (flip ? -4 : 4), hy = c.y - 28 - (fr % 2);
      R(hx - 1, hy - 7, 3, 7, '#5a3a12'); R(hx, hy - 9, 1, 2, '#5a3a12'); R(hx - 1, hy - 5, 3, 2, '#e8d070');
      for (let k = 0; k < 26; k++) {
        const ph = (s * 0.9 + k / 26) % 1, dir = k % 2 ? 1 : -1, vx = dir * (30 + (k * 37 % 50)), x = hx + vx * ph, y = hy - 9 - 26 * ph + 70 * ph * ph;
        if (y < KAB_H - 2) R(x, y, k % 3 ? 2 : 1, 2, k % 4 ? '#ffd75a' : '#fff6d0');
      }
    }
  }
  // Trainer am rechten Rand
  const coach = COACH_LOOK[t] || COACH_LOOK[0];
  drawP(coach, mood === 'win' ? 'cheer' : mood === 'loss' ? 'sad' : 'idle', mood === 'win' ? fr % 6 : fr % 2, 226, 92 - (mood === 'win' ? Math.abs(Math.sin(s * 4)) * 3 : 0), true);
  // Licht: nach Niederlagen düster
  if (mood === 'loss') R(0, 0, KAB_W, KAB_H, flick ? 'rgba(10,12,30,0.5)' : 'rgba(10,12,30,0.36)');
}
