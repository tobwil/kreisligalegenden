// ================= Der Flitzer: extrem selten rennt jemand in Unterhose über den Platz =================
// Etwa in jedem 35. Spiel, zu einer zufälligen Zeit in einer zufälligen Halbzeit. Der Schiri pfeift ab, die Zuschauer johlen,
// zwei Ordner in Warnwesten rennen hinterher und holen ihn kurz vor der anderen Seitenlinie ein. Danach geht es mit einem
// Freistoß für die Mannschaft weiter, die den Ball hatte. Die Uhr steht so lange.
const FLITZER_P = 1 / 35;
function planFlitzer(o) {
  if (!G || G.demo || G.tut || o.resume || Math.random() > (o.flitzer ?? FLITZER_P)) return;
  G.flitzer = { half: Math.random() < 0.5 ? 1 : 2, at: rnd(0.15, 0.85) * G.hlen, st: null };
}
const FL_LOOK = () => lookOf({ skin: (Math.random() * SKIN.length) | 0, hair: pick(HAIR), style: (Math.random() * 6) | 0, beard: Math.random() < 0.5, belly: Math.random() < 0.6, num: 0 }, (() => { const s = SKIN[1][0]; return { c1: s, c2: s, sh: '#f4f4f0', so: s, pat: 0 }; })(), false);
// Ordner: Warnweste und lange dunkle Hose
const ORD_LOOK = k => { const L = lookOf({ skin: k + 1, hair: HAIR[k + 2], style: k + 2, beard: k === 0, belly: k === 1, num: 0 }, { c1: '#d8ff1e', c2: '#ff8a00', sh: '#2a2d38', so: '#2a2d38', pat: 3 }, false); return { ...L, pants: '#2a2d38', shoe: '#1a1a1e', key: L.key + '|lang' }; };
function startFlitzer() {
  const b = G.ball, side = Math.random() < 0.5 ? 1 : -1, x0 = clamp(CAMX + rnd(-12, 12), 8, CW - 8);
  const runner = { x: x0, y: side > 0 ? CH + 3 : -3, tx: clamp(x0 + rnd(-20, 20), 8, CW - 8), ty: side > 0 ? -2 : CH + 2, look: FL_LOOK(), face: 1, pose: 'run', fr: 0, animT: 0, zig: rnd(0, 6) };
  // eigenes Aussehen des Flitzers: Hautfarbe auch am Oberkörper
  const sk = SKIN[(Math.random() * SKIN.length) | 0]; runner.look = { ...runner.look, c1: sk[0], c2: sk[0], jerS: sk[1], jerH: sk[0], so: sk[0], skin: sk[0], skinS: sk[1], key: runner.look.key + '|flitzer' + sk[0] };
  const ords = [0, 1].map(k => ({ x: x0 - 6 + k * 12, y: runner.y + side * 2, look: ORD_LOOK(k), face: 1, pose: 'run', fr: 0, animT: 0 }));
  G.flitzer.st = { t: 0, side, runner, ords, caught: false, poss: b.owner ? b.owner.team : G.poss, bx: b.x, by: b.y, pre: G.phase };
  b.vx = b.vy = b.vz = 0; b.passTo = null; b.shot = null; b.plan = null;
  G.phase = 'flitzer'; G.phaseT = 0; AU.whistle(2);
  banner('FLITZER!', '#ffc83a', 'DIE ORDNER NEHMEN DIE VERFOLGUNG AUF', 2.2, true);
  say(pick(['Ein Flitzer! Die Zuschauer jubeln, die Ordner rennen hinterher.', 'Da läuft einer in Unterhose übers Feld!', 'Flitzer auf dem Platz – der Schiri unterbricht.']), 4);
  AU.crowd(1); AU.ooh(1); G.excite = Math.max(G.excite, 1.6);
  if (!G.watch && !G.demo && typeof unlock === 'function') unlock('flitzer');
  track('flitzer');
}
function stepFlitzer(dt) {
  const F = G.flitzer.st, R = F.runner; F.t += dt;
  for (const p of G.players) { p.tx = p.x + (R.x - p.x) * 0.02; p.ty = p.y; p.urg = 0.2; }   // alle bleiben stehen und schauen zu
  moveAll(dt);
  const step = (o, tx, ty, v) => { const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy); if (d > 0.05) { o.x += dx / d * Math.min(d, v * dt); o.y += dy / d * Math.min(d, v * dt); if (Math.abs(dx) > 0.2) o.face = dx > 0 ? 1 : -1; } o.animT += v * dt * 1.7; o.fr = Math.floor(o.animT) % 6; return d; };
  if (!F.caught) {
    // Zickzack quer über den Platz, die Ordner holen auf
    const zig = Math.sin(F.t * 2.2 + R.zig) * 4;
    step(R, R.tx + zig, R.ty, 6.4); R.pose = 'run';
    F.ords.forEach((o, k) => { step(o, R.x + (k ? 1 : -1) * 0.8, R.y - F.side * 0.6, F.t > 1.2 ? 7.4 : 0); o.pose = F.t > 1.2 ? 'run' : 'idle'; });
    const near = F.ords.some(o => dist(o.x, o.y, R.x, R.y) < 1.1);
    if ((near && Math.abs(R.y - R.ty) < CH * 0.45) || Math.abs(R.y - R.ty) < 0.5) { F.caught = true; F.ct = F.t; R.pose = 'fall'; AU.crowd(0.8); say(pick(['Erwischt! Die Ordner führen ihn ab.', 'Gefasst – unter Applaus geht es zum Ausgang.']), 3); }
  } else {
    const off = F.side > 0 ? -3 : CH + 3;   // zur Seitenlinie, über die er wollte
    if (F.t - F.ct > 1.2) { R.pose = 'run'; step(R, R.x, off, 2.2); F.ords.forEach((o, k) => { step(o, R.x + (k ? 0.7 : -0.7), R.y, 2.2); o.pose = 'run'; }); }
    else { R.pose = 'fall'; F.ords.forEach(o => { o.pose = 'idle'; }); }
    if (F.t - F.ct > 4.5 || (R.y < -2.5 || R.y > CH + 2.5) && F.t - F.ct > 2) endFlitzer();
  }
}
function endFlitzer() {
  const F = G.flitzer.st; G.flitzer.done = true; G.flitzer.st = null;
  const team = F.poss >= 0 ? F.poss : 0, gx = goalX(team), s = atkDir(team);
  let x = clamp(F.bx, 2, CW - 2); if (Math.abs(x - gx) < 22) x = gx - s * 22; if (Math.abs(x - ownX(team)) < 18) x = ownX(team) + s * 18;
  setupSetPiece('free', team, x, clamp(F.by, 4, CH - 4));
}
// im Spiel: Zeitpunkt prüfen (nur bei ruhigem Ball, nicht bei Schuss oder Standard)
function flitzerCheck() {
  const F = G.flitzer; if (!F || F.done || F.st || G.phase !== 'play' || G.half !== F.half || G.clock < F.at) return;
  const b = G.ball; if (b.shot || b.z > 0.5 || G.so || Math.abs(b.x - CW / 2) > 30) return;
  startFlitzer();
}
function flitzerItems() {
  const F = G && G.flitzer && G.flitzer.st; if (!F) return [];
  const one = o => ({ y: o.y, draw: () => drawPlayerAt({ look: o.look, x: o.x, y: o.y, z: 0, face: o.face, pose: o.pose, fr: o.fr }, false) });
  return [one(F.runner), ...F.ords.map(one)];
}
