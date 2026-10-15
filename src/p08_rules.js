// ================= Spielablauf: Bewegung, Ball, Regeln, Uhr =================
const minuteOf = () => {
  if (G.half <= 2) return Math.min(45, Math.floor(G.clock / G.hlen * 45)) + (G.half === 2 ? 45 : 0) + (G.clock > G.hlen ? 0 : 1);
  return Math.min(15, Math.floor(G.clock / (G.hlen / 3) * 15)) + (G.half === 4 ? 105 : 90) + 1;
};
const halfLen = () => G.half <= 2 ? G.hlen : G.hlen / 3;
const isHumanTeam = t => G.pl ? !G.demo && G.pl.some(s => s.team === t) : G.human === t && !G.watch;
function gameTick(dt) {
  if (G.hitStop > 0) { G.hitStop -= dt; return; }   // Treffer-Stopp: ein paar Frames Standbild beim Hammer und beim Ballgewinn
  // Zeitlupe beim Zielen mit dem Daumen (wie bei Padel- und Korb-Legenden): weich auf halbes Tempo, höchstens 1,6 s pro Schuss
  const aiming = !!TOUCH.aim && G.phase === 'play' && G.ctrl && G.ball.owner === G.ctrl && G.ctrl.chargeArm;
  G.aimSlowT = aiming ? (G.aimSlowT || 0) + dt : 0;
  G.timeK = (G.timeK ?? 1) + ((aiming && G.aimSlowT < 1.6 ? 0.5 : 1) - (G.timeK ?? 1)) * Math.min(1, dt * 8);
  dt *= G.timeK;
  dt *= SETTINGS.speed * (G.ff || 1) * (G.slowF || 1);   // Zeitlupe kurz vor einem Tor (p18)
  const steps = dt > 1 / 45 ? 2 : 1;
  for (let i = 0; i < steps; i++) step(dt / steps);
}
function step(dt) {
  G.frame = (G.frame || 0) + 1;
  G.t += dt; G.phaseT += dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.ticker) { G.ticker.t -= dt; if (G.ticker.t <= 0) G.ticker = null; }
  if (G.cut) { G.cut.t += dt; if (G.cut.t > G.cut.dur) G.cut = null; }
  if (G.spray) { G.spray.t += dt; if (G.spray.t > 2.2) G.spray = null; }
  if (G.netHit) G.netHit.t += dt;
  G.shake = Math.max(0, G.shake - dt); G.excite = Math.max(0, G.excite - dt * 0.35); G.flagT = Math.max(0, (G.flagT || 0) - dt);
  if (!G.demo) AU.setExcite(Math.min(1, G.excite * 0.6 + (G.ball.x < 22 || G.ball.x > CW - 22 ? 0.25 : 0) + (G.derby ? 0.2 : 0)));
  updateParts(dt);
  if (G.tut) { tutTick(dt); if (!G || !G.tut) return; }
  flairStep(dt);
  switch (G.phase) {
    case 'intro': if (G.phaseT > 0.3 && (IN.any || G.watch)) { G.phase = 'kickoff'; G.phaseT = 0; AU.whistle(1); clearEdges(); } return;
    case 'replay': return stepReplay(dt);
    case 'halfend': moveAll(dt); if (G.phaseT > 2.2) endOfHalf(); return;
    case 'flitzer': stepFlitzer(dt); return;
    case 'end': moveAll(dt); return;
    case 'pause': case 'etpause': return;
  }
  if (G.phase === 'play' && !G.tut) {
    G.clock += dt; G.possT += dt; if (G.poss >= 0) G.stats.poss[G.poss] += dt;
    for (const p of G.players) if (!p.off) p.d.ms.min += dt;
    if (G.clock >= halfLen() + G.added * halfLen() / 45 && !G.so) {
      // laufenden Angriff, Schuss oder Elfmeter noch zu Ende spielen lassen (höchstens etwas über die Nachspielzeit hinaus)
      const b = G.ball, cap = G.clock < (halfLen() + G.added * halfLen() / 45) * 1.08 + 3;
      const hold = cap && (b.shot || (b.owner && Math.abs(b.x - CW / 2) > 30) || (!b.owner && b.passTo && Math.abs(b.x - CW / 2) > 30));
      if (!hold) return whistleHalf();
    }
    if (G.flitzer) flitzerCheck();
    if (G.clock > halfLen() * 0.97 && !G.addShown && !G.so) { G.addShown = true; G.added = 1 + ((Math.random() * 3) | 0) + (G.half === 2 && G.score[0] === G.score[1] ? 1 : 0); if (!G.demo) banner(`+${G.added}`, '#3ddc84', 'NACHSPIELZEIT', 1.4); }
  }
  // Standards: CPU führt nach kurzer Pause aus, der Mensch wählt selbst
  if (G.phase === 'kickoff' || G.phase === 'setpiece' || G.phase === 'penalty') { if (G.pl) mpSetPiece(dt); else stepSetPiece(dt); }
  if (G.phase === 'whistle' || G.phase === 'dead') { if (G.phaseT > (G.pending ? G.pending.t : 1)) resolvePending(); }
  if (G.tut && G.phase === 'goal' && G.phaseT > 1.4) { tutSetup(); return; }
  if (G.phase === 'goal' && G.phaseT > 3.2) { if (G.so) return; startReplay(); return; }
  if (G.phase === 'play' || G.phase === 'whistle' || G.phase === 'dead' || G.phase === 'goal') {
    if (G.phase === 'play' && G.so) { for (const p of G.players) { p.tx = p.x; p.ty = p.y; p.urg = 0; } const g = G.pen ? G.pen.gk : null; if (g) gkAI(g, dt); }
    else if (G.phase === 'play') { aiTeam(0, dt); aiTeam(1, dt); for (const g of G.gk) if (g && !g.off) gkAI(g, dt); if (G.pl) mpHumanControl(dt); else humanControl(dt); }
    else if (G.phase === 'whistle') for (const p of G.players) p.urg = Math.min(p.urg, 0.15);
    else if (G.phase === 'dead' && G.pendSpots) for (const [p, sp] of G.pendSpots) { p.tx = sp[0]; p.ty = sp[1]; p.urg = 0.85; }
    else if (G.phase === 'goal') celebrate();
    if (G.tut && G.phase === 'play') tutStep(dt);
    const own = G.ball.owner;
    if (G.phase === 'play' && own && !isHumanCtrl(own) && !G.so) carrierAI(own, dt);
  }
  moveAll(dt);
  updateBall(dt);
  if (G.phase === 'play') { passAssist(dt); checkBlocks(); tryCollect(); }
  recordFrame(dt);
  if (G.so) stepShootout(dt);
}
const isHumanCtrl = p => G.pl ? !G.demo && G.pl.some(s => s.ctrl === p) : G.human === p.team && !G.watch && G.ctrl === p && !G.demo;

// ---------- Mensch ----------
const passHoldPow = c => clamp((G.t - c.passHold - 0.12) / 0.65, 0, 1);
const holdPow = t0 => G.t - t0 > 0.15 ? clamp((G.t - t0 - 0.12) / 0.65, 0, 1) : null;   // nur angetippt = null (wie bisher)
function humanControl(dt) {
  if (G.human < 0 || G.watch || G.demo) return;
  const me = G.human, b = G.ball;
  let c = G.ctrl;
  if (!c || c.off || c.team !== me) c = G.ctrl = nearestTo(me, b.x, b.y);
  if (!c) return;
  const hasBall = b.owner === c, ours = b.owner && b.owner.team === me;
  G.idleT = Math.hypot(IN.x, IN.y) > 0.15 ? 0 : (G.idleT || 0) + dt;   // Stick losgelassen (Daumen weg): nach 0,8 s spielt dein Mann von selbst mit
  const incoming = !b.owner && (b.passTo === c);
  // Auto-Wechsel in der Abwehr: zum Spieler, der am nächsten dran ist (nicht während des Laufens mit dem Stick).
  // Ist dein Spieler überlaufen (der Gegner ist an ihm vorbei Richtung Tor), wechselt es auch beim Laufen zum Verteidiger davor.
  if (SETTINGS.autoswitch && !ours && !incoming && G.t - (G.manT || 0) > 0.9) {
    const n = !b.owner ? bestChaser(me) : nearestTo(me, b.owner.x, b.owner.y, G.pl ? (G.pl.find(s => s !== G.slot && s.team === me) || {}).ctrl : undefined);
    const still = Math.hypot(IN.x, IN.y) < 0.2;
    const o = b.owner && b.owner.team !== me ? b.owner : null, beaten = o && (o.x - c.x) * atkDir(me) < -2.5 && dist(c.x, c.y, o.x, o.y) > 2;
    const front = beaten && G.t - (G.autoT || 0) > 0.7 ? switchCands()[0] : null;
    if (front && (o.x - front.x) * atkDir(me) > 0.5 && dist(front.x, front.y, o.x, o.y) < 16) { G.ctrl = c = front; G.autoT = G.t; }
    else if (n && n !== c && (still || dist(c.x, c.y, b.x, b.y) - dist(n.x, n.y, b.x, b.y) > 8) && dist(c.x, c.y, b.x, b.y) - dist(n.x, n.y, b.x, b.y) > 2.5) { G.ctrl = c = n; G.autoT = G.t; }
  }
  const DEF = LASTIN === 'key' && LAY().def;   // Tastenbelegung in der Abwehr (Legenden: D Tackling, Leertaste Grätsche, A Druck)
  G.pressHelp = (DEF ? IN[DEF.pr] : IN.k) && !ours;
  if (hasBall) {
    if (isGK(c)) {
      if (IN.pa) { const q = choosePass(c, IN.x, IN.y); if (q) gkThrow(c, q); }
      else if (IN.pc || IN.pb || IN.pk) gkPunt(c, Math.hypot(IN.x, IN.y) > 0.3 ? choosePass(c, IN.x, IN.y, 'lob') : null);
      else { c.holdT = (c.holdT || 0) + dt; if (c.holdT > 5) gkHold(c, 99); }
      return;
    }
    // Schuss nur aufladen, wenn die Taste mit dem Ball am Fuß gedrückt wurde (nicht noch vom Tackling gehalten)
    // Antippen = halbhoher, platzierter Schuss; halten bis gelb = Hammer; rot = drüber (wie bei EA FC, nur flotter)
    if (IN.pb) { c.chargeArm = true; c.charge = Math.max(c.charge || 0, 0.22); c.taim = null; TOUCH.aimLast = null; }
    const ta = TOUCH.aim || TOUCH.aimLast;
    if (ta && c.chargeArm) { if (!c.taim) c.taim = { y0: shotAim(c, 0.5, 0).y }; c.taim.y = clamp(c.taim.y0 + ta.dy * 0.09, GY1 + 0.3, GY2 - 0.3); }
    if (IN.b && c.chargeArm) { c.charge = Math.min(1.05, (c.charge || 0) + dt / 0.8); }
    // während des Aufladens: Pass oder Trick = Schlenzer, Flanke/Hoch = Heber
    if (IN.b && c.chargeArm && c.charge > 0 && (IN.pa || IN.pf || IN.pc)) {
      const pw = clamp(c.charge, 0.2, 1), aim = Math.abs(IN.y) > 0.25 ? IN.y : 0; c.chargeArm = false; c.charge = 0;
      shoot(c, pw, aim, IN.pc ? { chip: true } : { finesse: true }); return;
    }
    if (IN.rb && c.chargeArm && c.charge > 0) {
      c.chargeArm = false; const pw = clamp(c.charge, 0.1, 1.05); c.charge = 0; TOUCH.aimLast = null;
      if (c.taim) { const y = c.taim.y; c.taim = null; shoot(c, pw, 0, { aimPt: { y }, auto: true }); } else shoot(c, pw, Math.abs(IN.y) > 0.25 ? IN.y : 0);
      return;
    }
    if (LASTIN === 'touch') { if (IN.pa) { const pw = TOUCH.pow; TOUCH.pow = null; pass(c, choosePass(c, IN.x, IN.y, 'pass', 0.7, pw), pw); return; } }
    else {
      // Tastatur und Gamepad wie am Handy: antippen = kurzer Pass, gedrückt halten = fester und weiter (türkiser Balken), beim Loslassen geht der Ball
      if (IN.pa) c.passHold = G.t;
      if (c.passHold != null && !IN.a) {
        if (IN.ra) { const pw = passHoldPow(c); c.passHold = null; pass(c, choosePass(c, IN.x, IN.y, 'pass', 0.7, pw), pw); return; }
        c.passHold = null;   // alter Stand (Taste woanders losgelassen)
      }
    }
    if (LASTIN === 'touch') { if (IN.pk) { const pw = TOUCH.kpow; TOUCH.kpow = null; through(c, choosePass(c, IN.x, IN.y, 'through', 0.7, pw), pw); return; } }
    else {
      // Steilpass wie der Pass: antippen = normal, halten = weiter in die Tiefe (Balken), beim Loslassen geht der Ball
      if (IN.pk) c.thrHold = G.t;
      if (c.thrHold != null && !IN.k) {
        if (IN.rk) { const h = G.t - c.thrHold, pw = h > 0.15 ? clamp((h - 0.12) / 0.65, 0, 1) : null; c.thrHold = null; through(c, choosePass(c, IN.x, IN.y, 'through', 0.7, pw), pw); return; }
        c.thrHold = null;
      }
    }
    // Flanke / hoher Ball: antippen = wie bisher, halten = Kraft (Flanke: kurzer Pfosten → Elfmeterpunkt → langer Pfosten; hoher Ball: weiter)
    const doCross = pw => {
      const gx = goalX(me);
      if (Math.abs(c.y - MY) > 11 && Math.abs(c.x - gx) < 34 && Math.abs(IN.x) < 0.5 + (Math.abs(IN.y) > 0.3 ? 0.3 : 0)) cross(c, 0, pw);
      else lob(c, choosePass(c, IN.x, IN.y, 'lob', 0.7, pw));
    };
    if (LASTIN === 'touch') { if (IN.pc) { const pw = TOUCH.cpow; TOUCH.cpow = null; doCross(pw); return; } }
    else {
      if (IN.pc) c.crsHold = G.t;
      if (c.crsHold != null && !IN.c) {
        if (IN.rc) { const pw = holdPow(c.crsHold); c.crsHold = null; doCross(pw); return; }
        c.crsHold = null;
      }
    }
    if (IN.pf) { const d = TOUCH.fdir || IN; TOUCH.fdir = null; trick(c, d.x, d.y, d.kind); }
  } else {
    c.charge = 0; c.chargeArm = false; c.passHold = null; c.thrHold = null; c.crsHold = null;
    const eta = incoming ? dist(c.x, c.y, b.x, b.y) / Math.max(2, Math.hypot(b.vx, b.vy)) : 9;
    if (incoming && b.passer && b.passer.team === me && eta < 1.1) {
      // Direktabnahme vormerken (nur kurz bevor ein Pass bei dir ankommt): Schuss, Pass, Steilpass
      if (IN.pb) c.queue = { k: 'shot', t: G.t }; else if (IN.pa) c.queue = { k: 'pass', t: G.t, x: IN.x, y: IN.y }; else if (IN.pk) c.queue = { k: 'through', t: G.t, x: IN.x, y: IN.y };
      else if (IN.pc && !ours) c.queue = { k: 'cross', t: G.t };
    } else if (incoming) {
      // Pass zu dir noch unterwegs: nichts auslösen, der Spieler läuft dem Ball entgegen
    } else if (!ours && !b.owner && airNear(c)) {
      // hoher Ball kommt auf dich zu: Schuss/Tackling = wegköpfen (Stickrichtung), Pass = zum Mitspieler köpfen
      if (IN.pb || IN.pc || IN.pk) c.queue = { k: 'clear', t: G.t, x: IN.x, y: IN.y }; else if (IN.pa) c.queue = { k: 'pass', t: G.t, x: IN.x, y: IN.y };
    } else if (!ours) {
      // Abwehr wie EA FC: Pass-Taste oder Q wechselt, Schuss-Taste tackelt, Flanken-Taste grätscht
      if (!b.owner && dist(c.x, c.y, b.x, b.y) < 3) { if (DEF ? IN['p' + DEF.sl] : IN.pc) slide(c, IN.x, IN.y); return; }   // loser Ball direkt vor dir: hinlaufen statt wechseln
      if (IN.pa || IN.pf) switchPlayer();
      const o = b.owner;
      if (o && o.team !== me && !isGK(o) && c.cd <= 0 && c.stun <= 0 && !c.act && G.t - (o.gotT || 0) > 0.25) {
        const front = (c.x - o.x) * o.hx + (c.y - o.y) * o.hy > 0;
        if (dist(c.x, c.y, b.x, b.y) < 0.8 && Math.random() < dt * (front ? 1.7 : 0.6) * clamp(0.75 + (A_(c, 'zwk') - A_(o, 'tec')) / 90, 0.35, 1.25)) { poke(c, o); return; }
      }
      const tk = DEF ? IN['p' + DEF.tk] : IN.pb, sl = DEF ? IN['p' + DEF.sl] : IN.pc;   // Legenden-Tastatur: D Tackling, Leertaste Grätsche
      if (tk) tackle(c, b.owner && b.owner.team !== me && !isGK(b.owner) && dist(c.x, c.y, b.owner.x, b.owner.y) < 1.8 ? b.owner : null);
      if (sl) slide(c, IN.x, IN.y);
    } else if (IN.pa && ours && b.owner !== c && !isGK(b.owner)) {
      // Ball fordern: der Ballführer (KI) spielt sofort zu dir
      const o = b.owner; if (o.think > 0.1) { o.think = 0; pass(o, c); }
    }
  }
}
// hoher Ball (Flanke, Ecke, Abschlag) landet in den nächsten 1,2 s in Kopfhöhe in deiner Nähe
function airNear(c) {
  const b = G.ball; if (b.owner || (b.z < 0.9 && b.vz <= 0)) return false;
  for (const q of ballPath()) { if (q.t > 1.2) break; if (q.z < 2.5 && q.z > 0.9 && dist(q.x, q.y, c.x, c.y) < 4) return true; }
  return false;
}
// Kopfball-Spot: kommt ein hoher Ball in Kopfhöhe in Reichweite deines Spielers, läuft er von selbst zum Treffpunkt.
// Der Stick bewegt ihn dann nicht mehr weg, sondern gibt die Richtung des Kopfballs vor (Ecke im Tor, wegköpfen, ablegen).
function headSpot(p) {
  const b = G.ball; if (b.owner || b.shot || G.phase !== 'play' || isGK(p) || (b.z < 0.9 && b.vz <= 0)) return null;
  let best = null, bd = 1e9;
  for (const q of ballPath()) {
    if (q.t > 1.4) break; if (q.z > 2.4 || q.z < 0.9) continue;
    const d = dist(q.x, q.y, p.x, p.y); if (d < 5 && d - q.t * maxSpeed(p, true) < 0.6 && d < bd) { bd = d; best = q; }
  }
  return best;
}
function bestChaser(t) { let best = null, bt = 1e9; for (const p of teamP(t)) { if (isGK(p)) continue; const q = interceptOf(p); if (q.t < bt) { bt = q.t; best = p; } } return best; }
// Spielerwechsel in der Abwehr wie bei EA FC: nicht stur der Nächste zum Ball (der ist oft schon überlaufen), sondern der Verteidiger,
// der am besten in den Laufweg des Gegners kommt; bevorzugt einer zwischen Ball und eigenem Tor. Mit Richtung (Stick) beim Drücken:
// der Mitspieler in dieser Richtung. Schnell nochmal drücken schaltet zum Nächsten in der Liste weiter.
function switchCands(dx = 0, dy = 0) {
  const me = G.human, b = G.ball, c = G.ctrl, o = b.owner && b.owner.team !== me ? b.owner : null, s = atkDir(me), ox = ownX(me);
  const taken = G.pl ? new Set(G.pl.filter(sl => sl !== G.slot).map(sl => sl.ctrl)) : null;
  // Gefahrenpunkt: wo der Ball gleich ist (Ballführer mit Laufrichtung, etwas Richtung eigenes Tor), sonst wo der freie Ball hinrollt
  let tx = o ? o.x + o.vx * 0.7 : b.x + b.vx * 0.5, ty = o ? o.y + o.vy * 0.7 : b.y + b.vy * 0.5;
  tx += (ox - tx) * 0.1; ty += (MY - ty) * 0.1;
  const all = teamP(me).filter(p => !isGK(p) && p !== c && !(taken && taken.has(p)));
  if (Math.hypot(dx, dy) > 0.5 && c) {   // mit Richtung: wer in dieser Richtung vom aktuellen Spieler steht, der Nächste zuerst
    const m = Math.hypot(dx, dy), dir = all.filter(p => { const d = dist(p.x, p.y, c.x, c.y) || 1; return ((p.x - c.x) * dx + (p.y - c.y) * dy) / d / m > 0.45; });
    if (dir.length) return dir.sort((a, q) => dist(a.x, a.y, c.x, c.y) - dist(q.x, q.y, c.x, c.y));
  }
  const score = p => { const d = dist(p.x, p.y, tx, ty), goalSide = (p.x - tx) * s < -0.5; return d - (goalSide ? 5 : 0) + (goalSide ? 0 : Math.max(0, (p.x - tx) * s) * 0.6); };
  return all.sort((a, q) => score(a) - score(q));
}
function switchPlayer() {
  const cands = switchCands(IN.x, IN.y), quick = G.t - (G.manT || 0) < 0.8;
  const n = quick && cands[0] === G.prevCtrl ? cands[1] || cands[0] : cands[0];   // schnell nochmal: weiter zum Nächsten statt zurück
  if (n) { G.prevCtrl = G.ctrl; G.ctrl = n; G.lastSwitch = n; G.manT = G.t; AU.select(); buzz(8); }
}

// ---------- Bewegung ----------
function moveAll(dt) {
  for (const p of G.players) { if (G.pl) mpMove(p, dt); else movePlayer(p, dt); }
  // Abstand halten (keine Knäuel)
  const ps = G.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], c = ps[j]; if (a.off || c.off) continue;
    const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (d < 0.75 && d > 0.001) { const k = (0.75 - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
  }
}
function movePlayer(p, dt) {
  if (p.off) return;
  const a = p.act;
  if (a) { a.t += dt; if (a.t >= a.dur) { p.act = null; if (a.type === 'slide' || a.type === 'dive') p.stun = Math.max(p.stun, a.type === 'dive' ? 0.25 : 0.35); } }
  p.stun = Math.max(0, p.stun - dt); p.cd = Math.max(0, p.cd - dt);
  if (p.z > 0 || p.vz > 0) { p.vz -= GRAV * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
  if (p.wall && G.wallHold && G.t < G.wallHold) { p.vx = 0; p.vy = 0; return integ(p, dt); }   // Mauer bleibt stehen und springt nur
  const live = ['play', 'whistle', 'dead', 'goal', 'halfend', 'end'].includes(G.phase);
  let dvx = 0, dvy = 0, sprint = false, acc = 26;
  const act = p.act && p.act.type;
  if (act === 'slide') { slideStep(p, dt); p.vx *= 1 - 2.6 * dt; p.vy *= 1 - 2.6 * dt; return integ(p, dt, 'slide'); }
  if (act === 'dive' || act === 'block') { diveStep(p, dt); return; }
  if (act === 'fall' || act === 'stumble' || (G.spray && G.spray.p === p)) { p.vx *= 1 - 5 * dt; p.vy *= 1 - 5 * dt; return integ(p, dt, act === 'fall' || (G.spray && G.spray.p === p) ? 'fall' : 'run'); }
  if (act === 'trick') { if (p.act.kind === 'drehung') { p.face = Math.floor(p.act.t * 12) % 2 ? -1 : 1; p.faceT = G.t; } return integ(p, dt, 'run'); }   // Drehung: blickt im schnellen Wechsel hin und her
  if (p.stun > 0 || !live) { p.vx *= 1 - 6 * dt; p.vy *= 1 - 6 * dt; return integ(p, dt); }
  // Arcade: der angespielte Spieler läuft dem Ball von selbst entgegen, auch wenn noch eine Richtung gedrückt ist
  const selfRun = G.ball.passTo === p || (!G.ball.owner && p.role === 'chase') || (G.ball.owner !== p && (G.idleT || 0) > 0.8);
  const hs = G.phase === 'play' && isHumanCtrl(p) ? headSpot(p) : null; p.headAim = !!hs;
  if (G.phase === 'play' && isHumanCtrl(p) && !hs && !passIncoming(p) && (Math.hypot(IN.x, IN.y) > 0.15 || !selfRun)) {
    sprint = IN.s; const v = maxSpeed(p, sprint) * (G.ball.owner === p ? 0.93 : 1);
    dvx = IN.x * v; dvy = IN.y * v; acc = G.ball.owner === p ? 38 : 44;   // direktes Ansprechen auf den Stick (ISS-Gefühl)
    // Torwart mit Ball in der Hand bleibt im Strafraum
    if (isGK(p) && G.ball.owner === p) { dvx *= 0.6; dvy *= 0.6; }
  } else {
    const dx = (hs ? hs.x : p.tx) - p.x, dy = (hs ? hs.y : p.ty) - p.y, d = Math.hypot(dx, dy);
    if (d > 0.25) {
      sprint = (hs || p.urg > 0.92) && d > 3;
      const v = maxSpeed(p, sprint) * (0.55 + 0.45 * p.urg) * Math.min(1, d / 2.2) * (G.phase === 'goal' || G.phase === 'dead' ? 0.8 : 1) * (passIncoming(p) && isHumanTeam(p.team) ? 1.15 : 1);
      dvx = dx / d * v; dvy = dy / d * v;
    }
  }
  if (G.ball.owner === p && !isGK(p)) { dvx *= 0.94; dvy *= 0.94; }
  const ax = clamp(dvx - p.vx, -acc * dt, acc * dt), ay = clamp(dvy - p.vy, -acc * dt, acc * dt);
  p.vx += ax; p.vy += ay;
  p.sprint = sprint && Math.hypot(p.vx, p.vy) > 5;
  // Kondition: Laufen kostet, Sprint viel, Stehen erholt
  const sp = Math.hypot(p.vx, p.vy), k = 180 / Math.max(60, G.hlen) * (1.45 - A_(p, 'aus') / 100) * (p.d.trait === 'Dauerläufer' ? 0.75 : 1);
  if (G.phase === 'play') p.d.energy = clamp(p.d.energy - dt * k * (0.0006 + sp * 0.00016 + (p.sprint ? 0.0014 : 0)) + (sp < 1 ? dt * 0.0012 : 0), 0.15, 1);
  integ(p, dt);
}
function integ(p, dt, forcePose) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, -3, CW + 3); p.y = clamp(p.y, -2, CH + 2);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0.4 && (!p.act || p.act.type !== 'slide')) { p.hx = p.vx / sp; p.hy = p.vy / sp; const f = p.vx > 0 ? 1 : -1; if (Math.abs(p.vx) > 0.6 && f !== p.face && G.t - (p.faceT || 0) > 0.2) { p.face = f; p.faceT = G.t; } }
  p.animT += sp * dt * 1.7;
  const a = p.act && p.act.type;
  if (forcePose) { p.pose = forcePose; p.fr = Math.floor(p.animT) % 6; return; }
  if (a === 'kick') p.pose = p.act.t < 0.12 ? 'kick1' : 'kick2';
  else if (a === 'throw') p.pose = p.act.t < 0.15 ? 'throw1' : 'throw2';
  else if (a === 'head') p.pose = 'head';
  else if (a === 'tackle') p.pose = 'tackle';
  else if (G.ball.owner === p && isGK(p)) p.pose = 'hold';
  else if (G.sp && G.sp.taker === p && G.sp.type === 'throw') p.pose = 'throw1';
  else if (isGK(p) && sp < 1 && G.phase === 'play' && dist(G.ball.x, G.ball.y, p.x, p.y) < 25) { p.pose = 'gk'; p.fr = Math.floor(G.t * 2) % 2; return; }
  else p.pose = sp > 0.6 ? 'run' : sp < 0.35 ? 'idle' : (p.pose === 'run' ? 'run' : 'idle');   // Hysterese: kein Flackern zwischen Laufen und Stehen
  p.fr = p.pose === 'run' ? Math.floor(p.animT) % 6 : Math.floor(G.t * 1.5 + p.i) % 2;
  if (p.pose === 'run' && !G.ball.owner && G.phase === 'play' && sp > 0.5) p.fr = Math.floor(p.animT) % 6;
}
// Torwart im Flug: seitlich zum Ball, danach am Boden
function diveStep(g, dt) {
  const a = g.act, k = clamp(a.t / 0.35, 0, 1);
  if (a.type === 'dive') { g.y = lerp(a.y0, a.y1, ease(k)); g.pose = 'stretch'; }
  else { g.y = lerp(a.y0, a.y1, k); g.pose = 'gk'; }
  g.vx = 0; g.vy = 0;
  resolveSave(g);
}
// Parade im richtigen Moment ausführen
function resolveSave(g) {
  const b = G.ball, pl = b.plan;
  if (!pl || pl.g !== g || pl.done || b.owner || pl.fid !== b.fid) return;
  if (G.t < pl.at - 0.03 && Math.abs(b.x - g.x) > 0.6) return;
  pl.done = true;
  if (!pl.ok) return;
  const s = atkDir(g.team);
  g.d.ms.sv++; if (b.shot && b.shot.pen && !G.so) g.d.penSaved = (g.d.penSaved || 0) + 1;
  if (pl.catchIt) { giveBall(g); AU.catch(); say(pick([`${g.d.name} hält sicher.`, `Gefangen! ${g.d.name} ist da.`, `Kein Problem für ${g.d.name}.`])); }
  else {
    b.parryBy = b.shot ? b.shot.by : null; b.owner = null; b.last = g; b.lastTeam = g.team; b.shot = null; b.kind = 'parry'; b.fid++; b.passer = null; G.offs = null; b.plan = null;
    const side = b.y > MY ? 1 : -1, r = Math.random();
    if (b.z > 1.5 && r < 0.45) { b.vx = -s * rnd(1.5, 3); b.vy = rnd(-1, 1); b.vz = rnd(4, 6); }                 // über die Latte gelenkt
    else if (Math.abs(b.y - MY) > 1.6 && r < 0.5) { b.vx = -s * rnd(1, 2.5); b.vy = side * rnd(7, 10); b.vz = rnd(0.5, 2); }   // um den Pfosten
    else { b.vx = s * rnd(3, 8); b.vy = (b.y > g.y ? 1 : -1) * rnd(3, 8) + rnd(-2, 2); b.vz = rnd(1, 4.5); }   // abgewehrt ins Feld
    b.nc = g; b.ncT = 0.4;
    AU.catch(); banner('PARADE!', '#7cf2ff', g.d.name.toUpperCase(), 1.1); say(pick([`Glanzparade von ${g.d.name}!`, `${g.d.name} fliegt und lenkt ihn weg!`, `Stark gehalten von ${g.d.name}!`]));
    if (!G.demo) AU.ooh(0.9);
  }
  G.excite = Math.max(G.excite, 1);
}

// ---------- Ball ----------
function updateBall(dt) {
  const b = G.ball, o = b.owner;
  b.ncT = Math.max(0, b.ncT - dt);
  if (o) {
    if (isGK(o) && !(G.sp && G.sp.taker === o)) { b.x = o.x + o.face * 0.25; b.y = o.y + 0.05; b.z = 1.0; }
    else if (G.sp && G.sp.taker === o && G.sp.type === 'throw') { b.x = o.x - o.face * 0.1; b.y = o.y; b.z = 2.1; }
    else if (G.sp && G.sp.taker === o) { /* Ball liegt am Punkt */ }
    else {
      const sp = Math.hypot(o.vx, o.vy), lead = 0.45 + (o.sprint ? 0.45 : 0) + Math.sin(o.animT * 1.2) * 0.08 * Math.min(1, sp / 4);
      // weich am Fuß führen: der Ball läuft mit und dreht beim Richtungswechsel um den Spieler herum statt zu springen
      const tx = o.x + o.hx * lead, ty = o.y + o.hy * lead * 0.9, k = Math.min(1, dt * (G.t - (o.gotT || 0) < 0.15 ? 60 : 16));
      b.x += o.vx * dt; b.y += o.vy * dt; b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
      if (Math.hypot(b.x - o.x, b.y - o.y) > 1.3) { b.x = tx; b.y = ty; }
      b.z = 0; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      if (sp > 0.5) b.roll = (b.roll || 0) + sp * dt * 3;
    }
    return;
  }
  if (['setpiece', 'kickoff', 'penalty'].includes(G.phase)) return;
  if (G.phase === 'goal' || G.phase === 'replay') return netBall(dt);
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy, b.vz) * dt / 0.35));
  for (let i = 0; i < n; i++) {
    const px = b.x, py = b.y, pz = b.z, h = dt / n;
    ballPhys(b, h);
    if (b.bounced) { b.bounced = false; if (Math.abs(b.vz) > 2) AU.bounce(Math.min(1, Math.abs(b.vz) / 6)); }
    b.roll = (b.roll || 0) + Math.hypot(b.vx, b.vy) * h * 3;
    // Torwart: Parade planen
    if (G.phase === 'play' && !b.owner) {
      for (const g of G.gk) {
        if (!g || g.off) continue;
        const gx = ownX(g.team), toward = (gx - b.x) * b.vx > 0 && Math.abs(b.vx) > 3;
        if (toward && Math.abs(b.x - gx) < 35 && b.planFid !== b.fid && b.lastTeam !== g.team && !(b.shot && b.shot.pen)) {
          b.planFid = b.fid; const pl = planSave(g); b.plan = pl || null;
        }
        if (b.plan && b.plan.g === g && !b.plan.done && (g.act && (g.act.type === 'dive' || g.act.type === 'block') || G.t >= b.plan.at - 0.03)) resolveSave(g);
      }
    }
    if (b.owner) return;
    if (G.phase !== 'play') continue;
    // Torlinie überquert?
    for (const gx of [0, CW]) {
      if ((px - gx) * (b.x - gx) <= 0 && px !== b.x) {
        const k = (gx - px) / (b.x - px), y = lerp(py, b.y, k), z = lerp(pz, b.z, k), r = BALL_R;
        const postHit = [GY1, GY2].find(py0 => Math.abs(y - py0) < 0.06 + r && z < GH + 0.06);
        if (postHit != null) { b.x = gx + (px - gx) * 0.5 + (px > gx ? 0.05 : -0.05); b.vx = -b.vx * rnd(0.45, 0.7); b.vy += Math.sign(y - postHit || 1) * Math.abs(b.vx) * 0.4; AU.post(); pfosten(); continue; }
        if (y > GY1 && y < GY2 && Math.abs(z - GH) < 0.06 + r) { b.x = gx + (px - gx) * 0.5 + (px > gx ? 0.05 : -0.05); b.vx = -b.vx * 0.5; b.vz = z < GH ? -Math.abs(b.vz) * 0.5 - 1 : Math.abs(b.vz) * 0.6 + 1; AU.post(); pfosten(true); continue; }
        if (y > GY1 + r && y < GY2 - r && z < GH - r) { return scoreGoal(gx === CW ? (atkDir(0) > 0 ? 0 : 1) : (atkDir(0) > 0 ? 1 : 0), y, z); }
      }
    }
    if ((b.x < -BALL_R && px >= -BALL_R) || (b.x > CW + BALL_R && px <= CW + BALL_R)) return ballOut('goalline');
    if ((b.y < -BALL_R && py >= -BALL_R) || (b.y > CH + BALL_R && py <= CH + BALL_R)) return ballOut('touch');
    if (b.x < -4 || b.x > CW + 4 || b.y < -4 || b.y > CH + 4) return ballOut(b.x < 0 || b.x > CW ? 'goalline' : 'touch');
  }
  if (b.trail) { b.trail.push([b.x, b.y, b.z]); if (b.trail.length > 6) b.trail.shift(); if (!b.shot && Math.hypot(b.vx, b.vy) < 14) b.trail.length = 0; }
}
function pfosten(bar) {
  if (G.demo) return; banner(bar ? 'LATTE!' : 'PFOSTEN!', '#ffc83a', '', 1); AU.ooh(1); G.excite = Math.max(G.excite, 1.4); G.shake = 0.2;
  say(pick(bar ? ['An die Latte! Das war knapp.', 'Lattenkracher!'] : ['Pfosten! Da fehlte nicht viel.', 'Nur das Aluminium rettet!']));
}
// Ball im Netz: abbremsen, Netz beult aus
function netBall(dt) {
  const b = G.ball; if (b.owner) return;
  const s = b.x > CW / 2 ? 1 : -1, gx = s > 0 ? CW : 0, back = gx + s * (NET_D - 0.2);
  ballPhys(b, dt);
  if ((b.x - back) * s > 0) { b.x = back; b.vx = -b.vx * 0.15; b.vy *= 0.4; }
  b.y = clamp(b.y, GY1 + 0.15, GY2 - 0.15); if (b.z > GH - 0.2) { b.z = GH - 0.2; b.vz = -Math.abs(b.vz) * 0.3; }
  if (Math.abs(b.x - gx) > 0.3 && Math.abs(b.x - gx) < NET_D) { b.vx *= 1 - 3 * dt; b.vy *= 1 - 3 * dt; }
}
// Blocks: Schuss prallt an einem Verteidiger ab
function checkBlocks() {
  const b = G.ball; if (b.owner || b.blockChecked === b.fid) return;
  if (b.kind === 'cross' && b.passer && b.z < 2 && dist(b.x, b.y, b.passer.x, b.passer.y) < 3.5) {
    for (const o of opps(b.passer)) if (!isGK(o) && dist(o.x, o.y, b.x, b.y) < 0.8 && Math.random() < 0.45) {
      b.blockChecked = b.fid; b.fid++; b.last = o; b.lastTeam = o.team; b.kind = 'block'; b.passTo = null; G.offs = null;
      const s = atkDir(b.passer.team); b.vx = s * rnd(3, 9); b.vy = (b.y < MY ? -1 : 1) * rnd(0, 3); b.vz = rnd(1, 4); AU.tackle(); return;
    }
    return;
  }
  if (!b.shot) return;
  // jeder Verteidiger hat genau eine Chance auf den Block (Mauer: auch im Sprung bis 2,3 m)
  if (b.triedFid !== b.fid) { b.triedFid = b.fid; b.tried = new Set(); }
  for (const o of G.players) {
    if (o.off || o.team === b.shot.team || isGK(o) || b.tried.has(o)) continue;
    // Mauer: blockt, was sie wirklich trifft (Körperbreite, Kopfhöhe plus Sprung); sonst Verteidiger mit Glück
    const hit = o.wall ? dist(o.x, o.y, b.x, b.y) < 0.5 && b.z < 1.95 + (o.z || 0) : dist(o.x, o.y, b.x, b.y) < 0.65 && b.z < 1.8;
    if (hit) {
      b.tried.add(o); if (Math.random() > (o.wall ? 0.9 : 0.45)) continue;
      b.blockChecked = b.fid; b.shot = null; b.plan = null; b.fid++; b.last = o; b.lastTeam = o.team; b.kind = 'block'; G.offs = null;
      const sp = Math.hypot(b.vx, b.vy) * 0.4, sg = Math.random() < 0.5 ? 1 : -1; b.vx = b.vx * rnd(0.05, 0.55); b.vy = sg * rnd(sp * 0.5, sp * 1.1); b.vz = rnd(0.5, 3.5);
      AU.tackle(); if (!G.demo) { banner('GEBLOCKT', '#9cff57', o.d.name.toUpperCase(), 0.8); AU.ooh(0.6); }
      return;
    }
  }
}
// freier Ball: wer bekommt ihn?
// läuft gerade ein Pass genau zu diesem Spieler?
const passIncoming = p => { const b = G.ball; return !b.owner && b.passTo === p && p.recv && p.recv.fid === b.fid && ['pass', 'through', 'throw', 'lob', 'cross'].includes(b.kind); };
// Pass-Hilfe: flache Pässe ziehen auf den letzten Metern leicht zum Empfänger (gleicht kleine Ungenauigkeiten aus)
function passAssist(dt) {
  const b = G.ball, q = b.passTo; if (!q || !passIncoming(q) || b.z > 0.6 || q.off) return;
  const dx = q.x - b.x, dy = q.y - b.y, d = Math.hypot(dx, dy), v = Math.hypot(b.vx, b.vy); if (d > 6 || d < 0.2 || v < 1) return;
  if ((dx * b.vx + dy * b.vy) / (d * v) < 0.5) return;   // schon vorbei oder ganz falsche Richtung
  const k = Math.min(1, dt * (isHumanTeam(q.team) ? 7 : 4));
  b.vx += (dx / d * v - b.vx) * k; b.vy += (dy / d * v - b.vy) * k;
}
// Arcade-Fairness: ein flacher Pass des Menschen wird nicht automatisch abgefangen, wenn ein Gegner zufällig in der Linie steht.
// Jeder Gegner bekommt pro Pass einen Versuch (Schwierigkeit, Zweikampf, Ballgeschwindigkeit); daneben gegriffen = der Ball rollt durch.
function missesPass(p) {
  const b = G.ball, ps = b.passer;
  if (!ps || ps.team === p.team || !isHumanTeam(ps.team) || isHumanTeam(p.team) || isGK(p) || !['pass', 'through'].includes(b.kind) || b.z > 0.6) return false;
  if (p.icptFid === b.fid) return p.icptMiss;
  const v = Math.hypot(b.vx, b.vy), near = dist(p.x, p.y, ps.x, ps.y) < 3.5;
  let pr = (G.diff.icpt ?? 0.55) + (A_(p, 'zwk') - 60) / 250 - Math.max(0, v - 12) * 0.03;
  if (near) pr *= 0.55;   // direkt angeschossen: kaum Zeit zu reagieren
  if (v < 6) pr = 1;      // langsam ausrollender Ball wird immer erlaufen
  p.icptFid = b.fid; p.icptMiss = Math.random() > clamp(pr, 0.1, 1);
  if (p.icptMiss && !p.act) p.act = { type: 'stumble', t: 0, dur: 0.22 };
  return p.icptMiss;
}
// Reichweite bei hohen Bällen: dein gesteuerter Spieler und Verteidiger im eigenen Strafraum springen höher und weiter
function airR(p) { const b = G.ball; let r = 0.8; if (inBox(p.team, b.x, b.y)) r = 1.15; if (isHumanCtrl(p)) r += 0.3; return r; }
function tryCollect() {
  const b = G.ball; if (b.owner) return;
  let best = null, bd = 1e9;
  for (const p of G.players) {
    if (p.off || p.stun > 0) continue;
    if (G.so && !isGK(p)) continue;
    if (b.shot && b.shot.team !== p.team && !isGK(p) && Math.hypot(b.vx, b.vy) > 12) continue;   // Schuss: nur Block (checkBlocks), kein Annehmen
    const a = p.act && p.act.type; if (a === 'slide' || a === 'fall' || a === 'stumble' || a === 'dive') continue;
    if (b.nc === p && b.ncT > 0) continue;
    const gk = isGK(p) && inBox(p.team, b.x, b.y), maxZ = gk ? 2.6 : 2.3, mine = passIncoming(p), r = gk ? 1.05 : mine ? (b.z > 1.0 ? (b.kind === 'cross' ? 1.45 : 1.1) : 1.35) : b.z > 1.0 ? airR(p) : 0.62;
    if (b.z > maxZ + p.z) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < r && !mine && missesPass(p)) continue;
    const w = mine ? d * 0.6 : b.z > 1.0 && inBox(p.team, b.x, b.y) ? d * 0.7 : d;   // Kopfballduell im Strafraum: Verteidiger ebenbürtig
    if (d < r && w < bd) { bd = w; best = p; }
  }
  if (!best) return;
  const p = best, gk = isGK(p) && inBox(p.team, b.x, b.y);
  // geplante Parade läuft: Torwart entscheidet über die Parade, nicht hier
  if (b.plan && b.plan.g === p && b.plan.fid === b.fid && !b.plan.done) return;
  if (b.shot && b.plan && b.plan.g === p && !b.plan.ok && b.plan.fid === b.fid && Math.hypot(b.vx, b.vy) > 12) return;
  // Abseits?
  if (G.offs && G.offs.team === p.team && G.offs.set.has(p)) return offside(p);
  if (G.offs && (G.offs.team !== p.team || !G.offs.set.has(p))) G.offs = null;
  const rel = Math.hypot(b.vx - p.vx, b.vy - p.vy, b.vz);
  if (gk) {
    if (rel < 21 || Math.random() < A_(p, 'tw') / 140) { giveBall(p); AU.catch(); if (b.z > 1.4) say(`${p.d.name} pflückt den Ball runter.`); }
    else { b.vx = -b.vx * 0.3; b.vy += rnd(-4, 4); b.vz = rnd(1, 3); b.last = p; b.lastTeam = p.team; b.fid++; b.shot = null; b.nc = p; b.ncT = 0.3; AU.catch(); }
    return;
  }
  // hoher Ball: Kopfball nur, wenn es sich lohnt (Flanke im Strafraum, Abwehr am eigenen Tor, Ball würde sonst drüberfliegen), sonst mit der Brust annehmen oder runterfallen lassen
  if (b.z > 1.0) {
    if (p.cd > 0) return;
    const q = p.queue, wantShot = q && q.k === 'shot' && G.t - q.t < 1.5;
    const attackBox = inBox(1 - p.team, p.x, p.y) && ['cross', 'lob', 'head', 'clear', 'parry'].includes(b.kind);
    const defend = prog(p.team, p.x) < 0.3 && b.lastTeam !== p.team;
    const overHim = b.vz < 0 ? false : b.z > 1.5;
    const slow = Math.hypot(b.vx, b.vy) < 11;
    const hq = isHumanCtrl(p) && q && ['clear', 'pass'].includes(q.k) && G.t - q.t < 1.5;
    if (wantShot || hq || attackBox || defend || (overHim && b.z < 2.3)) { header(p, wantShot); return; }
    if ((b.z <= 1.6 && slow) || (passIncoming(p) && b.z <= 2)) { giveBall(p, true); AU.touch(); return; }
    return;
  }
  // zu hart zum Annehmen: springt weg
  if (rel > 17 && !passIncoming(p) && Math.random() > A_(p, 'tec') / 130) {
    b.vx = b.vx * -0.25 + rnd(-3, 3); b.vy = b.vy * 0.3 + rnd(-3, 3); b.vz = rnd(0.5, 2.5); b.last = p; b.lastTeam = p.team; b.fid++; b.shot = null; b.nc = p; b.ncT = 0.25; b.kind = 'loose'; AU.touch(); return;
  }
  // Direktabnahme
  const q = p.queue && G.t - p.queue.t < 0.9 ? p.queue : null;
  const wasCross = b.kind === 'cross' || b.kind === 'lob', fromMate = b.passer && b.passer.team === p.team;
  const lastB = b.passer;
  giveBall(p, true); AU.touch();
  if (lastB) p.assistFrom = lastB.team === p.team && lastB !== p ? lastB : null;
  if (q) {
    p.queue = null;
    const I = inOf(p);
    if (q.k === 'shot') return shoot(p, clamp(I.b ? 0.22 + I.bHeld / 0.7 : 0.65, 0.3, 1), Math.abs(I.y) > 0.25 ? I.y : 0, { volley: b.z > 0.3 });
    if (q.k === 'pass') return pass(p, choosePass(p, q.x, q.y));
    if (q.k === 'through') return through(p, choosePass(p, q.x, q.y, 'through'));
    if (q.k === 'cross') return cross(p, 0);
  }
  // CPU: Direktschuss nach Flanke oder Querpass im Strafraum
  if (!isHumanCtrl(p) && fromMate && inBox(1 - p.team, p.x, p.y) && shotQuality(p) > 0.35 && Math.random() < (wasCross ? 0.7 : 0.45)) shoot(p, rnd(0.5, 0.85), null, { volley: wasCross });
}
function offside(p) {
  const b = G.ball; AU.whistle(1); G.stats.offs[p.team]++; G.flagT = 2.2; G.flagX = p.x;
  banner('ABSEITS', '#ffc83a', p.d.name.toUpperCase(), 1.2); say(pick([`Die Fahne geht hoch: Abseits von ${p.d.name}.`, `${p.d.name} stand im Abseits.`, 'Abseits! Der Linienrichter hat gut aufgepasst.']));
  G.pending = { k: 'free', team: 1 - p.team, x: p.x, y: p.y, t: 1.3 }; G.offs = null;
  b.owner = null; b.vx *= 0.3; b.vy *= 0.3; b.passTo = null;
  G.phase = 'whistle'; G.phaseT = 0;
}
function ballOut(kind) {
  if (tutOut()) return;
  const b = G.ball, last = b.lastTeam;
  if (G.so) return;
  b.passTo = null; b.plan = null; G.offs = null;
  if (kind === 'touch') {
    const team = last < 0 ? 0 : 1 - last;
    G.pending = { k: 'throw', team, x: clamp(b.x, 0.5, CW - 0.5), y: b.y < MY ? 0 : CH, t: 1.0 };
    if (!G.demo) say(pick(['Einwurf.', `Einwurf für ${G.T[team].short}.`]), 1.6);
  } else {
    const gx = b.x < CW / 2 ? 0 : CW, def = ownX(0) === gx ? 0 : 1;
    if (last === def) {
      G.pending = { k: 'corner', team: 1 - def, x: gx, y: b.y, t: 1.4 }; G.stats.corners[1 - def]++;
      if (!G.demo) { banner('ECKE', '#ffc83a', G.T[1 - def].short.toUpperCase(), 0.9); AU.crowd(0.5); }
    } else {
      G.pending = { k: 'goal', team: def, x: gx, y: b.y, t: 1.3 };
      if (b.shot && !G.demo) { AU.ooh(0.8); say(pick(['Vorbei!', 'Drüber! Das muss er machen.', 'Knapp daneben.', 'Weit am Tor vorbei.'])); }
    }
  }
  b.shot = null;
  AU.whistle(1);
  G.phase = 'dead'; G.phaseT = 0;
  const p = G.pending;
  G.pendSpots = setPieceSpots(p.k, p.team, p.k === 'corner' ? (p.x === CW ? CW - 0.3 : 0.3) : p.x, p.k === 'throw' ? (p.y < MY ? 0 : CH) : p.y, null);
}
function resolvePending() {
  if (G.tut) return tutSetup();
  const p = G.pending; G.pending = null; G.pendSpots = null;
  if (!p) { G.phase = 'play'; return; }
  autoSubs();
  if (p.k === 'pen') return setupSetPiece('pen', p.team, 0, 0);
  setupSetPiece(p.k, p.team, p.x, p.y, p.who);
}
// ---------- Standards ausführen ----------
function stepSetPiece(dt) {
  const sp = G.sp; if (!sp) return;
  sp.t += dt;
  const tk = sp.taker, human = isHumanTeam(sp.team) && !G.demo;
  // Gegner halten Abstand, Mitspieler bleiben stehen
  for (const p of G.players) { p.vx = 0; p.vy = 0; if (p !== tk) { p.pose = isGK(p) ? 'gk' : 'idle'; p.fr = Math.floor(G.t * 1.5 + p.i) % 2; } }
  if (sp.type === 'pen') G.pen.guessIn = G.pl ? (slotOfTeam(1 - sp.team) || { IN }).IN.y : IN.y;
  if (human) {
    if (G.phase === 'kickoff' && sp.t < 0.3) return;
    const c = tk; G.ctrl = c;
    if (sp.type === 'throw' || sp.type === 'corner' || sp.type === 'goal') { if (Math.abs(IN.x) > 0.2 || Math.abs(IN.y) > 0.2) { c.hx = IN.x; c.hy = IN.y; } }
    if (sp.type === 'pen' || sp.type === 'free') {
      if (aimWanted()) { if (aimStep(dt, sp, c)) return; }   // Zielansicht hinter dem Ball (p17)
      else {
        if (IN.b) c.charge = Math.min(1.05, (c.charge || 0) + dt / 0.85);
        if (IN.rb && c.charge > 0) { const pw = clamp(c.charge, 0.15, 1.05); c.charge = 0; return spShot(c, pw, Math.abs(IN.y) > 0.25 ? IN.y : 0); }
      }
    }
    if (sp.type === 'kick') {
      if (IN.pa || IN.pc || IN.pk || IN.pb) { const q = choosePass(c, IN.x || -atkDir(c.team), IN.y, 'pass', 0.2) || mates(c).filter(m => !isGK(m)).sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0]; return IN.pc ? lob(c, choosePass(c, IN.x, IN.y, 'lob')) : pass(c, q); }
    } else if (sp.type === 'goal') {
      if (IN.pa) return pass(c, choosePass(c, IN.x, IN.y));
      if (IN.pc || IN.pb || IN.pk) return gkPunt(c, Math.hypot(IN.x, IN.y) > 0.3 ? choosePass(c, IN.x, IN.y, 'lob') : null);
    } else if (sp.type === 'corner') {
      // Zielvisier im Strafraum: Richtung verschiebt es, Flanke oder Schuss flankt genau dorthin, Pass = kurz ausgeführt
      const gx = goalX(sp.team), s = atkDir(sp.team);
      if (!sp.caim) { const side = c.y < MY ? -1 : 1, q = cornerRecv(c, gx - s * 7, MY + side * 1.5); sp.caim = q ? { x: q.x + s * 1, y: q.y } : { x: gx - s * 7, y: MY + side * 1.5 }; }
      sp.caim.x = clamp(sp.caim.x + IN.x * dt * 13, Math.min(gx - s * 2.5, gx - s * 22), Math.max(gx - s * 2.5, gx - s * 22));
      sp.caim.y = clamp(sp.caim.y + IN.y * dt * 13, MY - 17, MY + 17);
      // Flanke oder Schuss halten = Kraft: kurz = hoher Bogen, lang = scharf und flach; beim Loslassen fliegt der Ball
      if ((IN.pc || IN.pb) && sp.chold == null) sp.chold = G.t;
      if (sp.chold != null && !IN.c && !IN.b) { const pw = holdPow(sp.chold); sp.chold = null; return crossTo(c, sp.caim.x, sp.caim.y, pw); }
      if (IN.pa) return pass(c, mates(c).filter(m => !isGK(m)).sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0]);
    } else if (sp.type !== 'pen') {
      if (IN.pa) return pass(c, choosePass(c, IN.x, IN.y));
      if (IN.pk) return through(c, choosePass(c, IN.x, IN.y, 'through'));
      if (IN.pc) { const gx = goalX(c.team); return Math.abs(c.x - gx) < 35 && sp.type !== 'throw' ? cross(c, 0) : lob(c, choosePass(c, IN.x, IN.y, 'lob')); }
    }
    if (sp.t > (sp.aim || sp.caim ? 20 : sp.type === 'pen' ? 9 : 7) && sp.chold == null) return cpuSetPiece(sp);
    return;
  }
  const delay = sp.type === 'kick' ? 0.9 : sp.type === 'pen' ? 1.6 : sp.type === 'corner' ? 1.3 : 0.9;
  if (sp.t > delay * (G.watch ? 1 : 1)) cpuSetPiece(sp);
}
function cpuSetPiece(sp) {
  const tk = sp.taker, gx = goalX(tk.team), d = dist(tk.x, tk.y, gx, MY);
  switch (sp.type) {
    case 'kick': return pass(tk, mates(tk).filter(m => !isGK(m)).sort((a, b) => dist(a.x, a.y, tk.x, tk.y) - dist(b.x, b.y, tk.x, tk.y))[0]);
    case 'throw': { const q = mates(tk).filter(m => !isGK(m) && dist(m.x, m.y, tk.x, tk.y) < 20).sort((a, b) => (openness(b) - dist(b.x, b.y, tk.x, tk.y) * 0.15) - (openness(a) - dist(a.x, a.y, tk.x, tk.y) * 0.15))[0] || choosePass(tk, 0, 0); return pass(tk, q); }
    case 'corner': return Math.random() < 0.12 ? pass(tk, choosePass(tk, 0, 0)) : cross(tk, Math.random() < 0.5 ? -1 : 1);
    case 'goal': return Math.random() < 0.65 ? gkPunt(tk) : pass(tk, mates(tk).filter(m => grpOf(m) === 'AB').sort((a, b) => openness(b) - openness(a))[0]);
    case 'pen': return spShot(tk, rnd(0.45, 0.85), pick([-1, -1, 1, 1, -0.6, 0.6, 0]));
    default:
      if (d < 30 && Math.abs(tk.y - MY) < 16 && Math.random() < 0.75) return spShot(tk, rnd(0.55, 0.85), pick([-1, 1, -0.7, 0.7]));
      if (d < 36 && Math.abs(tk.y - MY) > 12) return cross(tk, 0);
      return pass(tk, choosePass(tk, 0, 0));
  }
}
// Freistoß- oder Elfmeterschuss; beim Elfmeter rät der Torwart eine Ecke
function spShot(tk, pw, aim, target) {
  const pen = G.sp && G.sp.type === 'pen', fk = G.sp && G.sp.type === 'free';
  shoot(tk, pw, aim, { pen, target });
  if (fk && G.ball.shot && G.players.some(p => p.wall)) { G.ball.shot.fk = true; G.wallHold = G.t + 0.6; }   // Torwart sieht den Ball hinter der Mauer spät, die Mauer bleibt stehen
  if (pen) {
    const b = G.ball, g = G.pen.gk, guess = penGuess(g), gy = MY + guess * 2.4;
    const path = ballPath(); let at = 0.5, py = MY, pz = 1;
    for (const q of path) if ((q.x - g.x) * atkDir(tk.team) >= 0) { at = q.t; py = q.y; pz = q.z; break; }
    const side = Math.abs(py - MY) < 1.2 ? 0 : Math.sign(py - MY);
    const tw = A_(g, 'tw') + (g.d.trait === 'Elfmeterkiller' ? 10 : 0);
    let ok = false;
    const onT = py > GY1 && py < GY2 && pz < GH;
    if (onT && guess === side) ok = Math.random() < (side === 0 ? 0.85 : 0.55 + (tw - 60) / 120 - (Math.abs(py - MY) > 2.9 ? 0.25 : 0) - (pz > 1.8 ? 0.2 : 0) + (1 - pw) * 0.2);
    else if (onT && side === 0 && pz < 0.9) ok = Math.random() < 0.25;   // flach in die Mitte: manchmal noch mit dem Fuß
    b.plan = { g, fid: b.fid, at: G.t + at, y: guess ? gy : MY, z: pz, ok, catchIt: false, onT };
    if (b.shot && onT) { b.shot.counted = true; G.stats.onT[tk.team]++; tk.d.ms.sot++; }
    if (G.so) G.so.kickT = 0;
    G.pen.kicked = true;
  }
}

// ---------- Tor ----------
function scoreGoal(team, y, z) {
  const b = G.ball, sh = b.shot, last = b.last;
  if (isHumanTeam(team) && !G.demo) buzz(60);
  // abgefälschte Parade, die doch reingeht, zählt für den Schützen
  const shooter = last && isGK(last) && b.kind === 'parry' && b.parryBy && b.parryBy.team === team ? b.parryBy : null;
  const scorer = shooter || (last && last.team === team ? last : null), og = !scorer;
  G.netHit = { side: b.x > CW / 2 ? 1 : 0, y, z, t: 0 };
  AU.net(); b.plan = null;
  if (G.tut) tutEvent({ k: 'goal', team });
  if (G.so) { G.so.res = 1; G.phase = 'goal'; G.phaseT = 0; return; }
  G.score[team]++;
  const min = minuteOf();
  const who = scorer || last;
  if (scorer) { scorer.d.ms.g++; if (scorer.assistFrom && scorer.assistFrom.team === team && scorer.assistFrom !== scorer) scorer.assistFrom.d.ms.a++; }
  else if (last) last.d.ms.og++;
  G.log.push({ min, team, name: who ? who.d.name : '?', pid: who ? who.d.pid : null, og, pen: !!(sh && sh.pen), head: !!(sh && sh.header), assist: scorer && scorer.assistFrom ? scorer.assistFrom.d.name : null });
  G.scorer = who; G.scoreTeam = team; G.phase = 'goal'; G.phaseT = 0; G.excite = 2.2; G.shake = 0.3;
  const big = !G.demo;
  banner(og ? 'EIGENTOR!' : 'TOOOR!', og ? '#ff4f3a' : '#ffc83a', `${who ? who.d.name.toUpperCase() : ''} · ${min}.`, 2.6, true);
  const special = flairGoal(team, scorer, sh, og); if (special && G.banner) G.banner.txt = special;
  if (big) {
    AU.jingle('goal');
    const homeFans = team === 0 && !(G.event && G.event.neutral);
    AU.cheer(homeFans ? 1 : 0.5);
    if (Math.random() < 0.3) setTimeout(() => AU.bark(), 1400);
    say(og ? pick([`Eigentor! ${who.d.name} trifft ins eigene Netz.`, 'Bitter: Eigentor!']) : sh && sh.pen ? `${who.d.name} verwandelt sicher vom Punkt!` : sh && sh.header ? `Kopfballtor durch ${who.d.name}!` : pick([`${who.d.name} trifft! ${G.score[0]}:${G.score[1]}.`, `Was für ein Ding von ${who.d.name}!`, `Tor für ${G.T[team].short}! ${who.d.name} lässt sich feiern.`]), 4);
    AU.say(og ? 'Eigentor!' : `Tor für ${G.T[team].short}! Torschütze: ${who ? who.d.name : ''}`);
    G.parts.push(...burst(b.x, b.y, 1, '#ffffff', 10, 3));
  }
  // Jubellauf zur Eckfahne
  if (who) who.celeb = { x: b.x > CW / 2 ? CW - 6 : 6, y: who.y < MY ? 4 : CH - 4, pose: pick(['plane', 'cheer', 'knee']) };
}
function celebrate() {
  const sc = G.scorer;
  for (const p of G.players) {
    if (p.off) continue;
    if (isGK(p)) { p.tx = ownX(p.team) + atkDir(p.team) * 2; p.ty = MY; p.urg = 0.3; continue; }
    if (p === sc && sc.celeb) { p.tx = sc.celeb.x; p.ty = sc.celeb.y; p.urg = 1; continue; }
    if (p.team === G.scoreTeam && sc && sc.team === G.scoreTeam) { p.tx = sc.x - atkDir(p.team) * (1 + (p.i % 3)); p.ty = sc.y + ((p.i % 4) - 1.5) * 1.2; p.urg = 0.9; }
    else { p.tx = CW / 2 - atkDir(p.team) * (10 + p.i * 2); p.ty = lerp(p.y, MY, 0.3); p.urg = 0.25; }
  }
}
function celebPose(p) {
  if (G.phase !== 'goal' || p.off) return null;
  if (p === G.scorer && p.celeb) return dist(p.x, p.y, p.celeb.x, p.celeb.y) < 2 ? (p.celeb.pose === 'knee' ? 'knee' : p.celeb.pose === 'faust' ? 'faust' : 'cheer') : p.celeb.pose === 'plane' ? 'plane' : 'cheer';
  if (G.scorer && p.team === G.scorer.team && G.scoreTeam === p.team && Math.hypot(p.vx, p.vy) > 0.5) return 'cheer';
  if (p.team !== G.scoreTeam && Math.hypot(p.vx, p.vy) < 0.8) return 'sad';
  return null;
}

// ---------- Wiederholung ----------
function recordFrame(dt) {
  if (G.demo || G.phase === 'replay') return;
  G.recT += dt; if (G.recT < 1 / 30) return; G.recT = 0;
  G.rec.push({ p: G.players.map(p => [p.x, p.y, p.z, p.pose, p.fr, p.face, p.act && (p.act.type === 'dive' || p.act.type === 'slide') ? p.act.type : 0, p.act && p.act.dy || 0]), b: [G.ball.x, G.ball.y, G.ball.z], cx: G.cam.x, cy: G.cam.y });
  if (G.rec.length > 200) G.rec.shift();
}
function startReplay() {
  if (G.demo || SETTINGS.replay === false || G.rec.length < 40 || G.noReplay) return afterGoal();
  const n = G.rec.length, from = Math.max(0, n - 170), to = n - 50;   // die letzten Sekunden vor dem Jubel
  G.replay = { fr: G.rec.slice(from, Math.max(from + 20, to)), i: 0 };
  G.phase = 'replay'; G.phaseT = 0;
}
function stepReplay(dt) {
  const R = G.replay; if (!R) return afterGoal();
  R.i += dt * 30 * (R.i > R.fr.length - 40 ? 0.45 : 0.8);
  if (IN.any && G.phaseT > 0.3) R.i = R.fr.length;
  if (R.i >= R.fr.length - 1) { G.replay = null; return afterGoal(); }
  const f = R.fr[Math.floor(R.i)];
  G.players.forEach((p, i) => { const s = f.p[i]; if (!s) return; [p.x, p.y, p.z, p.pose, p.fr, p.face] = s; p.rp = s[6] ? { type: s[6], dy: s[7] } : null; });
  [G.ball.x, G.ball.y, G.ball.z] = f.b; G.ball.owner = null;
}
function afterGoal() {
  for (const p of G.players) { p.rp = null; p.celeb = null; }
  G.rec = []; G.netHit = null; G.scorer = null;
  autoSubs();
  setupKickoff(1 - G.scoreTeam, false); G.phase = 'kickoff'; G.phaseT = 0;
}

// ---------- Halbzeit, Abpfiff, Verlängerung, Elfmeterschießen ----------
function whistleHalf() {
  const last = G.half === 2 ? !(G.ko && G.score[0] === G.score[1]) : G.half === 4;
  AU.whistle(last ? 3 : 2, true);
  G.phase = 'halfend'; G.phaseT = 0; G.ball.passTo = null;
  if (!G.demo) banner(G.half === 1 ? 'HALBZEIT' : G.half === 3 ? 'VERLÄNGERUNG: SEITENWECHSEL' : last || G.half === 4 ? 'ABPFIFF' : 'ENDE DER REGULÄREN SPIELZEIT', '#ffc83a', `${G.T[0].k} ${G.score[0]} : ${G.score[1]} ${G.T[1].k}`, 2.2, true);
  for (const p of G.players) { p.tx = p.x; p.ty = p.y; p.urg = 0; }
}
function endOfHalf() {
  if (G.demo) { newDemo(); return; }
  if (G.half === 1) { G.phase = 'pause'; return ACT.halftime(); }
  if (G.half === 2 || G.half === 4) {
    if (G.ko && G.score[0] === G.score[1]) {
      if (G.half === 2 && G.et) { G.phase = 'etpause'; return ACT.extraTime(); }
      return startShootout();
    }
    G.phase = 'end'; return ACT.fulltime();
  }
  if (G.half === 3) return nextHalf();
}
function nextHalf() {
  G.half++; G.clock = 0; G.added = 0; G.addShown = false; G.swap = !G.swap;
  for (const p of G.players) if (!p.off) p.d.energy = Math.min(1, p.d.energy + (G.half === 2 ? 0.12 : 0.05));
  autoSubs();
  setupKickoff(G.half % 2 === 0 ? 1 - G.kickoffTeam : G.kickoffTeam, true); G.phase = 'kickoff'; G.phaseT = 0;
}
function startShootout() {
  G.so = { k: [[], []], turn: Math.random() < 0.5 ? 0 : 1, order: [0, 1].map(t => teamP(t).filter(p => !isGK(p)).sort((a, b) => (b.d.sch + b.d.tec * 0.4) - (a.d.sch + a.d.tec * 0.4)).concat([G.gk[t]])), n: [0, 0], res: null, kickT: 0, wait: 0 };
  G.swap = false;
  if (!G.demo) banner('ELFMETERSCHIESSEN', '#ffc83a', 'JE FÜNF SCHÜTZEN, DANN K.-O.', 2.4, true);
  AU.whistle(1);
  G.so.wait = 2.2; G.phase = 'sowait'; G.phaseT = 0;
}
function soNext() {
  const S = G.so, t = S.turn, list = S.order[t], tk = list[S.n[t] % list.length];
  // Schießen immer aufs Tor rechts (x = CW): Team t greift nach rechts an
  G.swap = t === 1;
  setupSetPiece('pen', t, 0, 0, tk); S.res = null; S.kickT = 0;
}
function stepShootout(dt) {
  const S = G.so;
  if (G.phase === 'sowait') { S.wait -= dt; if (S.wait <= 0) soNext(); return; }
  if (G.phase === 'goal') { S.wait = (S.wait || 0) + dt; }
  if (G.pen && G.pen.kicked) {
    S.kickT += dt;
    const b = G.ball, done = S.res === 1 || (S.kickT > 2.6) || b.owner;
    if (!done) return;
    if (S.res === 1 && S.kickT < 1.6) return;   // Torjubel kurz zeigen
    const t = S.turn; S.k[t].push(S.res === 1 ? 1 : 0); S.n[t]++;
    if (S.res !== 1 && !G.demo) { AU.ooh(1); banner(b.owner === G.gk[1 - t] || (b.plan && b.plan.ok) ? 'GEHALTEN!' : 'VERSCHOSSEN!', '#7cf2ff', '', 1.2); }
    G.pen = null; b.plan = null; G.netHit = null;
    const [a, c] = [S.k[0].reduce((x, y) => x + y, 0), S.k[1].reduce((x, y) => x + y, 0)], [na, nc] = [S.k[0].length, S.k[1].length];
    const left0 = Math.max(0, 5 - na), left1 = Math.max(0, 5 - nc);
    let win = -1;
    if (na <= 5 && nc <= 5) { if (a > c + left1) win = 0; else if (c > a + left0) win = 1; }
    if (na >= 5 && nc >= 5 && na === nc && a !== c) win = a > c ? 0 : 1;
    if (win >= 0) { S.winner = win; G.phase = 'end'; AU.whistle(3, true); setTimeout(() => { if (G && G.so === S) { G.paused = false; ACT.fulltime(); } }, 1600); banner(`${G.T[win].short.toUpperCase()} GEWINNT`, '#ffc83a', `IM ELFMETERSCHIESSEN ${a}:${c}`, 3, true); return; }
    S.turn = 1 - t; S.wait = 1.0; G.phase = 'sowait'; G.phaseT = 0;
  }
}
const winnerOf = () => G.so && G.so.winner != null ? G.so.winner : G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : -1;
