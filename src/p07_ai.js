// ================= KI: Grundordnung, Laufwege, Pressing, Entscheidungen am Ball, Torwart =================
const maxSpeed = (p, sprint) => (4.7 + A_(p, 'tmp') * 0.03) * (sprint ? 1.3 : 1) * (p.d.trait === 'Turbo' ? 1.04 : 1);
// Ballflug vorausberechnen (dieselbe Physik wie im Spiel): 90 Punkte im Abstand von 1/30 s
function ballPhys(o, dt) {
  if (o.z > 0 || o.vz > 0) {
    o.vz -= GRAV * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    const k = 1 - AIRDRAG * dt; o.vx *= k; o.vy *= k;
    if (o.spin) { o.vx += -o.vy * o.spin * 0.08 * dt; o.vy += o.vx * o.spin * 0.08 * dt; }
    if (o.z <= 0) {
      o.z = 0;
      if (o.vz < -1.6) { o.vz = -o.vz * (PITCH.ground === 2 ? 0.42 : 0.5); o.vx *= 0.86; o.vy *= 0.86; o.bounced = true; }
      else o.vz = 0;
    }
  } else {
    const v = Math.hypot(o.vx, o.vy);
    if (v > 0) { const nv = Math.max(0, v - FRIC() * dt); o.vx *= nv / v; o.vy *= nv / v; }
    o.x += o.vx * dt; o.y += o.vy * dt;
  }
}
let PATH = null, PATHF = -1;
function ballPath() {
  if (PATHF === G.frame && PATH) return PATH;
  const b = G.ball, o = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, spin: b.spin }, out = [];
  for (let i = 1; i <= 90; i++) { ballPhys(o, 1 / 30); out.push({ x: o.x, y: o.y, z: o.z, t: i / 30 }); }
  PATH = out; PATHF = G.frame; return out;
}
// frühester Punkt, an dem p den freien Ball erreicht (z bis Fußhöhe, Kopfhöhe oder beim Torwart bis Fanghöhe)
function interceptOf(p, opts = {}) {
  const b = G.ball; if (b.owner) return { x: b.owner.x, y: b.owner.y, t: dist(p.x, p.y, b.owner.x, b.owner.y) / maxSpeed(p, true) };
  const path = ballPath(), v = maxSpeed(p, true), react = opts.react ?? 0.12, maxZ = opts.maxZ ?? (inBox(1 - p.team, b.x, b.y) || prog(p.team, b.x) < 0.25 ? 2.2 : 1.4);
  for (const q of path) {
    if (q.z > maxZ) continue;
    if (q.x < -0.5 || q.x > CW + 0.5 || q.y < -0.5 || q.y > CH + 0.5) break;
    const need = Math.max(0, dist(p.x, p.y, q.x, q.y) - 0.5);
    if (need <= v * Math.max(0, q.t - react)) return q;
  }
  const last = path[path.length - 1];
  return { x: clamp(last.x, 0.5, CW - 0.5), y: clamp(last.y, 0.5, CH - 0.5), t: 3 + dist(p.x, p.y, last.x, last.y) / v };
}

// ---------- Grundordnung ----------
// Position im Mannschaftsblock: Abwehrlinie und Breite richten sich nach Ball und Ballbesitz
function formSpot(p) {
  const t = p.team, F = FORMS[G.form[t]][p.i], b = G.ball, s = atkDir(t), own = ownX(t);
  const bp = clamp(prog(t, b.x), 0, 1), inPos = G.poss === t;
  const back = inPos ? lerp(0.1, 0.5, bp) : lerp(0.07, 0.38, bp);
  const len = inPos ? 0.6 : 0.4;
  let du = back + (F[1] - 0.18) / 0.44 * len + (G.ment[t] - 1) * 0.04;
  du = clamp(du, 0.04, 0.93);
  const width = inPos ? 1 : 0.68;
  const vv = 0.5 + (F[2] - 0.5) * width;
  let y = relY(t, vv) + (b.y - MY) * (inPos ? 0.22 : 0.38) * (1 - Math.abs(F[2] - 0.5));
  let x = own + s * du * CW;
  // nicht hinter die eigene Abwehr zurück, Stürmer nicht ins Abseits
  if (inPos && G.phase === 'play') { const lim = offLine(t) - 0.008; if (prog(t, x) > lim) x = fromProg(t, lim); }
  return [clamp(x, 1, CW - 1), clamp(y, 1.5, CH - 1.5)];
}
// Abseitslinie aus Sicht von Team t: vorletzter Gegner oder Ball (in prog), mindestens Mittellinie
function offLine(t) {
  const ps = G.players.filter(q => q.team !== t && !q.off).map(q => prog(t, q.x)).sort((a, b) => b - a);
  return Math.max(ps[1] ?? 1, prog(t, G.ball.x), 0.5);
}
function gkSpot(g) {
  const t = g.team, gx = ownX(t), s = atkDir(t), b = G.ball;
  const d = dist(b.x, b.y, gx, MY), out = clamp(d * 0.09, 0.6, 4.5) * (G.poss === t && prog(t, b.x) > 0.5 ? 1.8 : 1);
  const ang = Math.atan2(b.y - MY, (b.x - gx) * s);
  return [gx + s * Math.cos(ang) * Math.min(out, 9), clamp(MY + Math.sin(ang) * out, GY1 - 0.6, GY2 + 0.6)];
}

// ---------- Teamsteuerung ----------
function aiTeam(t, dt) {
  const b = G.ball, own = b.owner, ps = teamP(t), field = ps.filter(p => !isGK(p));
  const roles = new Map();
  // freier Ball: wer ist zuerst dran?
  if (!own) {
    let chaser = b.passTo && b.passTo.team === t && !b.passTo.off ? b.passTo : null, ct = 1e9, cpt = null;
    for (const p of field) { const q = interceptOf(p); if (q.t < ct) { ct = q.t; cpt = q; if (!chaser || chaser !== b.passTo) chaser = p; } }
    if (b.passTo && b.passTo.team === t && !b.passTo.off) { chaser = b.passTo; cpt = interceptOf(chaser, { maxZ: 2.4 }); }
    if (chaser) roles.set(chaser, { k: 'chase', x: cpt.x, y: cpt.y, urg: 1 });
    // ein zweiter läuft mit (Abpraller, zweiter Ball)
    const second = field.filter(p => p !== chaser).sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))[0];
    if (second && dist(second.x, second.y, b.x, b.y) < 14) { const q = interceptOf(second); roles.set(second, { k: 'chase2', x: lerp(q.x, second.x, 0.3), y: lerp(q.y, second.y, 0.3), urg: 0.6 }); }
  } else if (own.team !== t) {
    // Gegner am Ball: Pressing, Absicherung, Deckung im eigenen Drittel
    const gx = ownX(t), holdsGK = isGK(own) && G.phase === 'play';
    if (!holdsGK) {
      const pr = field.slice().sort((a, c) => pressCost(a, own) - pressCost(c, own));
      const presser = pr[0];
      if (presser) {
        const k = 1.1 / Math.max(1, dist(own.x, own.y, gx, MY));
        roles.set(presser, { k: 'press', x: own.x + (gx - own.x) * k + own.vx * 0.25, y: own.y + (MY - own.y) * k + own.vy * 0.25, urg: 1 });
      }
      const cover = pr[1];
      if (cover && (G.ment[t] === 2 || G.pressHelp && t === G.human || prog(t, own.x) < 0.35)) {
        const k = 5 / Math.max(5, dist(own.x, own.y, gx, MY));
        roles.set(cover, { k: 'cover', x: own.x + (gx - own.x) * k, y: own.y + (MY - own.y) * k, urg: 0.8 });
      }
      // Manndeckung im eigenen Drittel
      if (prog(t, own.x) < 0.45) {
        const atk = teamP(own.team).filter(q => !isGK(q) && q !== own && prog(t, q.x) < 0.42).sort((a, c) => dist(a.x, a.y, gx, MY) - dist(c.x, c.y, gx, MY));
        const free = field.filter(p => !roles.has(p) && grpOf(p) !== 'ST');
        for (const a of atk) {
          let bm = null, bd = 12;
          for (const p of free) { if (roles.has(p)) continue; const d = dist(p.x, p.y, a.x, a.y); if (d < bd) { bd = d; bm = p; } }
          if (bm) { const k = 1.3 / Math.max(1, dist(a.x, a.y, gx, MY)); roles.set(bm, { k: 'mark', x: a.x + (gx - a.x) * k + (b.x - a.x) * 0.06, y: a.y + (MY - a.y) * k + (b.y - a.y) * 0.06, urg: 0.85 }); }
        }
      }
    }
  } else {
    // eigener Ballbesitz: Anspielstation, Läufe in die Tiefe, Strafraum besetzen
    const gx = goalX(t), s = atkDir(t), carrier = own;
    const sup = field.filter(p => p !== carrier && grpOf(p) === 'MF').sort((a, c) => dist(a.x, a.y, carrier.x, carrier.y) - dist(c.x, c.y, carrier.x, carrier.y))[0];
    if (sup && !isGK(carrier)) {
      const side = (sup.y > carrier.y ? 1 : -1), sx0 = carrier.x - s * 7, sy0 = carrier.y + side * 9;
      roles.set(sup, { k: 'support', x: clamp(sx0, 2, CW - 2), y: clamp(sy0, 3, CH - 3), urg: 0.7 });
    }
    const line = offLine(t), cp = prog(t, carrier.x);
    const wide = Math.abs(carrier.y - MY) > 13 && Math.abs(carrier.x - gx) < 30;
    for (const p of field) {
      if (p === carrier || roles.has(p)) continue;
      if (p.run && p.run.gg && p.run.until > G.t && !isGK(carrier)) { roles.set(p, { k: 'run', x: p.run.x, y: p.run.y, urg: 1 }); continue; }   // Doppelpass-Lauf
      const g = grpOf(p);
      if (wide && (g === 'ST' || slotOf(p) === 'OM' || (slotOf(p) === 'ZM' && Math.random() < 0.002))) {
        // Flanke kommt: kurzer Pfosten, langer Pfosten, Elfmeterpunkt
        const near = carrier.y < MY ? -1 : 1, z = [[6, near * 2], [7.5, -near * 3], [PEN_D, 0]][(p.i + (p.team ? 1 : 0)) % 3];
        roles.set(p, { k: 'box', x: gx - s * z[0], y: MY + z[1], urg: 0.85 }); continue;
      }
      if ((g === 'ST' || slotOf(p) === 'LM' || slotOf(p) === 'RM' || slotOf(p) === 'OM') && cp > 0.25 && !isGK(carrier)) {
        if (p.run && p.run.until > G.t) { roles.set(p, { k: 'run', x: p.run.x, y: p.run.y, urg: 1 }); continue; }
        const pp = prog(t, p.x);
        if (pp < line && line - pp < 0.1 && Math.random() < dt * (g === 'ST' ? 0.55 : 0.18) * (G.ment[t] === 2 ? 1.4 : 1) * (isHumanCtrl(carrier) ? 1.7 : 1)) {
          const tx = fromProg(t, Math.min(line + 0.12, 0.96)), ty = lerp(p.y, MY, 0.35);
          p.run = { until: G.t + 2.4, x: clamp(tx, 2, CW - 2), y: clamp(ty, 3, CH - 3) };
          roles.set(p, { k: 'run', x: p.run.x, y: p.run.y, urg: 1 }); continue;
        }
      }
    }
  }
  // Ziele setzen
  for (const p of ps) {
    if (isGK(p)) continue;
    const r = roles.get(p);
    if (r) { p.tx = r.x; p.ty = r.y; p.urg = r.urg; p.role = r.k; }
    else { const [x, y] = formSpot(p); p.tx = x; p.ty = y; p.role = 'form'; p.urg = dist(p.x, p.y, x, y) > 12 ? 0.75 : 0.45; }
    if (p.recv && p.recv.fid === b.fid && b.passTo === p && !b.owner) { const q = interceptOf(p); p.tx = q.x; p.ty = q.y; p.urg = 1; p.role = 'recv'; }
    // Zweikampf: der Presser greift an, wenn er nah genug dran ist
    if (r && r.k === 'press' && own && own.team !== t && !isHumanCtrl(p) && p.cd <= 0 && p.stun <= 0) {
      const d = dist(p.x, p.y, own.x, own.y), cpuVsHuman = G.human >= 0 && own.team === G.human;
      if (d < 1.4 && Math.random() < dt * (cpuVsHuman ? 1.2 * G.diff.tackle : 1.3)) tackle(p, own);
      else if (d < 2.6 && d > 1.2 && Math.random() < dt * 0.16 * (cpuVsHuman ? G.diff.tackle : 1) * (p.d.trait === 'Blutgrätsche' ? 2 : 1)) slide(p, own.x + own.vx * 0.3 - p.x, own.y + own.vy * 0.3 - p.y);
    }
  }
}
// Wer presst? Nähe zum Ballführer, torseitig stehende bevorzugt, Stürmer helfen nur vorne
function pressCost(p, own) {
  const gx = ownX(p.team), d = dist(p.x, p.y, own.x, own.y), goalSide = dist(p.x, p.y, gx, MY) < dist(own.x, own.y, gx, MY);
  return d * (goalSide ? 0.8 : 1.15) + (grpOf(p) === 'ST' && prog(p.team, own.x) < 0.45 ? 12 : 0) + (p.stun > 0 ? 8 : 0);
}

// ---------- KI am Ball ----------
function carrierAI(p, dt) {
  const b = G.ball, t = p.team, s = atkDir(t), gx = goalX(t);
  if (isGK(p)) return gkHold(p, dt);
  p.think -= dt;
  const pr = pressure(p), d = dist(p.x, p.y, gx, MY);
  if (p.think > 0 && pr > 2.4) return dribble(p);
  p.think = (pr > 4 ? rnd(0.5, 1.0) : pr > 2.4 ? rnd(0.3, 0.6) : rnd(0.18, 0.35)) * G.diff.think;   // mit Platz: Ball führen, Spiel aufbauen
  // Optionen bewerten
  const opts = [];
  const sq = shotQuality(p);
  if (d < 30 && !(p.shotCD > G.t)) opts.push({ k: 'shot', v: sq * 3.1 + (d < 11 ? 0.9 : d < 17 ? 0.55 : d < 22 ? 0.1 : 0) - (d > 23 ? 0.6 : 0) + (inBox(1 - t, p.x, p.y) ? 0.25 : 0) });
  // Pässe
  let bp = null, bv = -1e9;
  for (const q of mates(p)) { if (isGK(q) && pr > 3) continue; const v = passScore(p, q, 'pass'); if (v > bv) { bv = v; bp = q; } }
  if (bp) opts.push({ k: 'pass', q: bp, v: bv * 0.5 + (pr < 2 ? 0.25 : 0.05) });
  // Steilpass auf einen Läufer
  for (const q of mates(p)) {
    if (!q.run || q.run.until < G.t || isGK(q)) continue;
    const onside = prog(t, q.x) <= offLine(t) + 0.002;
    if (!onside) continue;
    const tx = q.x + s * 9, lane = laneOpen(p, tx, q.y, null), risk = interceptRisk(p, { x: tx, y: q.y }, 12);
    if (lane > 1.6 && risk < 0.55) opts.push({ k: 'through', q, v: 1.35 + prog(t, tx) * 0.7 - risk * 0.8 + rnd(0, 0.3) });
  }
  // hoher Ball nach vorn, wenn flach alles zu ist
  const fwd = mates(p).filter(q => !isGK(q) && prog(t, q.x) > prog(t, p.x) + 0.15 && prog(t, q.x) <= offLine(t)).sort((a, c) => openness(c) - openness(a))[0];
  if (fwd && pr < 2.2 && bv < 0.3 && openness(fwd) > 7) opts.push({ k: 'lob', q: fwd, v: Math.min(openness(fwd), 10) * 0.03 + (prog(t, p.x) < 0.3 ? 0.1 : 0) });
  // Flanke
  if (Math.abs(p.y - MY) > 12 && Math.abs(p.x - gx) < 26) {
    const inB = mates(p).filter(q => !isGK(q) && Math.abs(q.x - gx) < 18 && Math.abs(q.y - MY) < 14).length;
    if (inB) opts.push({ k: 'cross', v: 0.9 + inB * 0.25 + (Math.abs(p.x - gx) < 14 ? 0.3 : 0) });
  }
  // Dribbeln
  const space = spaceAhead(p);
  opts.push({ k: 'drib', v: clamp(space / 9, 0, 1) * 1.3 * clamp(pr / 3, 0.25, 1) + (d < 22 && space > 4 ? 0.3 : 0) + (pr > 4 ? 0.35 : 0.1) + (prog(t, p.x) > 0.62 ? 0.3 : 0) });   // im letzten Drittel Richtung Tor ziehen
  // Befreiungsschlag in Not
  if (prog(t, p.x) < 0.18 && pr < 1.6 && bv < 0.4) opts.push({ k: 'clear', v: 1.4 - pr * 0.25 });
  for (const o of opts) o.v += rnd(0, 0.35);
  opts.sort((a, c) => c.v - a.v);
  const o = opts[0];
  switch (o.k) {
    case 'shot': shoot(p, clamp(0.45 + (d > 18 ? 0.3 : 0) + rnd(-0.1, 0.2), 0.2, 0.92), null); break;
    case 'pass': pass(p, o.q); break;
    case 'through': through(p, o.q); break;
    case 'lob': lob(p, o.q); break;
    case 'cross': cross(p, 0); break;
    case 'clear': clearBall(p); break;
    default: dribble(p);
  }
}
// freie Bahn vor dem Ballführer (Abstand zum nächsten Gegner im Kegel Richtung Tor)
function spaceAhead(p) {
  const s = atkDir(p.team); let m = 14;
  for (const o of opps(p)) { const dx = (o.x - p.x) * s, dy = o.y - p.y; if (dx > -1 && Math.abs(dy) < dx * 0.9 + 2) m = Math.min(m, Math.hypot(dx, dy)); }
  return m;
}
function shotQuality(p) {
  const gx = goalX(p.team), d = dist(p.x, p.y, gx, MY);
  const a1 = Math.atan2(GY1 - p.y, gx - p.x), a2 = Math.atan2(GY2 - p.y, gx - p.x), th = Math.abs(a1 - a2);
  let blk = 0; for (const o of opps(p)) if (!isGK(o) && segDist(o.x, o.y, p.x, p.y, gx, MY) < 0.9 && dist(o.x, o.y, p.x, p.y) < d) blk++;
  return clamp((30 - d) / 24, 0, 1) ** 1.4 * 0.55 + clamp(th / 0.55, 0, 1) * 0.45 - blk * 0.18 + (A_(p, 'sch') - 60) / 200;
}
// Dribbeln: Richtung Tor, Gegnern ausweichen, vom Seitenaus weg
function dribble(p) {
  const s = atkDir(p.team), gx = goalX(p.team);
  let dx = gx - p.x, dy = (MY - p.y) * (Math.abs(gx - p.x) < 25 ? 1 : 0.25);
  const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  for (const o of opps(p)) {
    const ox = o.x - p.x, oy = o.y - p.y, d = Math.hypot(ox, oy);
    if (d < 6 && ox * s > -1) { const w = (6 - d) / 6 * 1.4; dx -= ox / d * w * 0.6; dy -= oy / d * w * (Math.abs(oy) < 0.5 ? 1.6 : 1); }
  }
  if (p.y < 4) dy += 0.8; if (p.y > CH - 4) dy -= 0.8;
  const mm = Math.hypot(dx, dy) || 1;
  p.tx = p.x + dx / mm * 5; p.ty = p.y + dy / mm * 5; p.urg = spaceAhead(p) > 7 ? 1 : 0.8;
  // Haken, wenn ein Gegner direkt vor ihm steht
  if (p.cd <= 0 && Math.random() < 0.02 && pressure(p) < 1.6) trick(p, 0, 0);
}

// ---------- Torwart ----------
function gkAI(g, dt) {
  const b = G.ball, t = g.team, gx = ownX(t), s = atkDir(t);
  if (g.act && g.act.type === 'dive') return;
  if (b.owner === g) { if (G.human !== t || G.watch || G.ctrl !== g) gkHold(g, dt); return; }
  // geplante Parade
  if (b.plan && b.plan.g === g && !b.owner && !b.plan.done && b.plan.fid === b.fid) { g.tx = gx + s * 0.4; g.ty = clamp(b.plan.y, GY1 - 1, GY2 + 1); g.urg = 1; if (G.t >= b.plan.at - 0.32 && !g.act) startDive(g); return; }
  // freier Ball im Strafraum: rauslaufen, wenn er klar zuerst dran ist
  if (!b.owner && inBox(t, b.x, b.y)) {
    const q = interceptOf(g, { maxZ: 2.6, react: 0.1 });
    const opp = Math.min(...opps(g).map(o => interceptOf(o).t));
    if (inBox(t, q.x, q.y) && q.t < opp - 0.15) { g.tx = q.x; g.ty = q.y; g.urg = 1; return; }
  }
  // Gegner läuft allein im Strafraum aufs Tor: entgegen
  if (b.owner && b.owner.team !== t && inBox(t, b.owner.x, b.owner.y) && dist(b.owner.x, b.owner.y, gx, MY) < 13) {
    const o = b.owner, blockers = teamP(t).filter(q => !isGK(q) && segDist(q.x, q.y, o.x, o.y, gx, MY) < 1.5).length;
    if (!blockers) { g.tx = lerp(gx + s * 1, o.x, 0.6); g.ty = lerp(MY, o.y, 0.7); g.urg = 1; if (dist(g.x, g.y, o.x, o.y) < 1.4 && g.cd <= 0) gkSmother(g, o); return; }
  }
  const [x, y] = gkSpot(g); g.tx = x; g.ty = y; g.urg = 0.7;
}
function gkSmother(g, o) {
  g.cd = 0.9;
  if (Math.random() < 0.3 + (A_(g, 'tw') - A_(o, 'tec')) / 100) { giveBall(g); g.d.ms.sv++; banner('ABGELAUFEN!', '#7cf2ff', g.d.name.toUpperCase(), 1); AU.catch(); }
  else { g.stun = 0.6; g.act = { type: 'fall', t: 0, dur: 0.6 }; }
}
// Torwart hat den Ball in der Hand: kurz warten, dann abwerfen oder abschlagen
function gkHold(g, dt) {
  g.holdT = (g.holdT || 0) + dt;
  const b = G.ball; b.z = 1.1;
  const [x, y] = gkSpot(g); g.tx = lerp(g.x, ownX(g.team) + atkDir(g.team) * 6, 0.02); g.ty = lerp(g.y, y, 0.02); g.urg = 0.3; void x;
  if (g.holdT < (G.human === g.team ? 4 : rnd(1.0, 1.6))) return;
  g.holdT = 0;
  const near = mates(g).filter(q => dist(q.x, q.y, g.x, g.y) < 28 && openness(q) > 6).sort((a, c) => openness(c) - openness(a))[0];
  if (near && Math.random() < 0.6) gkThrow(g, near); else gkPunt(g);
}
// Parade planen, sobald ein Ball aufs Tor zufliegt
function planSave(g) {
  const b = G.ball, t = g.team, gx = ownX(t), s = atkDir(t);
  const path = ballPath();
  let cross = null, onGoal = null;
  for (const q of path) {
    if (!cross && (q.x - g.x) * s <= 0) cross = q;
    if ((q.x - gx) * s <= 0) { onGoal = q; break; }
  }
  if (!onGoal) return null;
  const onT = onGoal.y > GY1 - 0.15 && onGoal.y < GY2 + 0.15 && onGoal.z < GH + 0.15;
  const c = cross || onGoal, v = Math.hypot(b.vx, b.vy, b.vz);
  const sh = b.shot; if (sh && onT && !sh.counted) { sh.counted = true; G.stats.onT[sh.team]++; sh.by.d.ms.sot++; }
  const cpuKeeper = G.human >= 0 && t !== G.human;
  const react = (0.1 + (1 - A_(g, 'tw') / 100) * 0.16) * (cpuKeeper ? G.diff.react : 1) + (b.shot && b.shot.fk ? 0.45 : 0);
  const tw = A_(g, 'tw') + (cpuKeeper ? G.diff.gk : 0) + (g.d.trait === 'Katze' ? 4 : 0);
  const reach = 3.2 * Math.max(0, c.t - react - 0.08) + 1.1 + tw / 100 * 1.4;
  const lat = Math.abs(c.y - g.y), hz = c.z;
  let ok = false, catchIt = false;
  if (lat <= reach && hz < 2.65 && (onT || lat < 1.2)) {
    let pr = 1.0 - (lat / Math.max(0.5, reach)) ** 2 * 0.55 - Math.max(0, v - 19) * 0.022 + (tw - 65) / 90 - (hz > 1.9 ? 0.1 : 0);
    if (sh && sh.fk && hz > 1.6 && lat > 1.8) pr -= 0.25;   // Freistoß in den Winkel
    if (sh && sh.finesse && lat > 1.6) pr -= 0.18;           // Schlenzer an den Innenpfosten
    if (sh && sh.pen) pr = 0;   // Elfmeter: eigene Regel
    ok = Math.random() < clamp(pr, 0.03, 0.97);
    catchIt = ok && v < 17 && lat < 1 && hz < 2;
  }
  if (!onT && !ok) return null;
  return { g, fid: b.fid, at: G.t + c.t, y: c.y, z: c.z, ok, catchIt, onT };
}
function startDive(g) {
  const pl = G.ball.plan, dy = pl.y - g.y, big = Math.abs(dy) > 0.8 || pl.z > 1.7;
  g.act = { type: big ? 'dive' : 'block', t: 0, dur: big ? 0.9 : 0.4, dy: Math.sign(dy) || 1, z: pl.z, y0: g.y, y1: pl.y, at: pl.at };
  if (big) { g.vz = clamp(pl.z * 2.6, 1.5, 4.2); }
}
// Elfmeter: Torwart rät eine Ecke (Mensch: Richtung beim Schuss, CPU: Zufall mit Gefühl)
function penGuess(g) {
  if (G.human === g.team && !G.watch) return Math.abs(IN.y) > 0.3 ? Math.sign(IN.y) : 0;
  const r = Math.random(); return r < 0.43 ? -1 : r < 0.86 ? 1 : 0;
}
