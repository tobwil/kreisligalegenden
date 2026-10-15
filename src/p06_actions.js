// ================= Aktionen: Pass, Steilpass, Flanke, Schuss, Kopfball, Zweikampf, Grätsche, Haken =================
const FRIC = () => [3.0, 2.4, 3.9][PITCH.ground] * (PITCH.wet ? 0.85 : 1);   // Rollwiderstand (m/s²): Kunstrasen schnell, Asche langsam
const AIRDRAG = 0.05;
const pressure = p => { let m = 9; for (const o of opps(p)) if (!isGK(o)) m = Math.min(m, dist(o.x, o.y, p.x, p.y)); return m; };
const openness = q => { let m = 12; for (const o of opps(q)) m = Math.min(m, dist(q.x, q.y, o.x, o.y)); return m; };
function laneOpen(p, tx, ty, ignore) { let m = 9; for (const o of opps(p)) if (o !== ignore) m = Math.min(m, segDist(o.x, o.y, p.x, p.y, tx, ty)); return m; }
// Buchführung bei jedem Schuss oder Pass: letzter Kontakt, Abseits-Momentaufnahme
function kickBall(p, kind, power = 0.3) {
  const b = G.ball, sp = G.sp && G.sp.taker === p ? G.sp.type : null;
  b.owner = null; b.state = 'free'; b.last = p; b.lastTeam = p.team; b.fid++; b.kind = kind; b.passer = p; b.nc = p; b.ncT = 0.3; b.shot = null; b.plan = null; b.trail = []; b.passTo = null; b.spin = 0;
  b.fromSP = sp;
  if (!p.act || p.act.type !== 'slide') p.act = { type: kind === 'throw' ? 'throw' : 'kick', t: 0, dur: 0.32 };
  p.cd = 0.25; p.queue = null;
  G.offs = sp === 'throw' || sp === 'goal' || sp === 'corner' ? null : offsideSet(p);
  if (G.sp && G.sp.taker === p) { G.sp = null; G.phase = 'play'; }
  if (kind !== 'throw') AU.kick(power);
  G.possT = 0;
}
// Abseits: Mitspieler in der gegnerischen Hälfte, näher an der Torlinie als Ball und vorletzter Gegner
function offsideSet(p) {
  if (!SETTINGS.offside) return null;
  const t = p.team, bp = prog(t, G.ball.x);
  const line = opps(p).map(q => prog(t, q.x)).sort((a, b) => b - a)[1] ?? 1;
  const set = new Set();
  for (const q of mates(p)) { const qp = prog(t, q.x); if (qp > 0.5 && qp > bp + 0.003 && qp > line + 0.004) set.add(q); }
  return set.size ? { team: t, set } : null;
}
const groundSpeed = (d, va) => Math.sqrt(va * va + 2 * FRIC() * d);
function launchAir(tx, ty, tz, T) {
  const b = G.ball, k = 1 + AIRDRAG * T * 0.5;
  b.vx = (tx - b.x) / T * k; b.vy = (ty - b.y) / T * k; b.vz = (tz - b.z + 0.5 * GRAV * T * T) / T;
}
function aimErr(p, k) { const press = pressure(p); return (0.012 + (100 - A_(p, k)) / 100 * 0.07) * (press < 1.5 ? 1.5 : 1) * (G.sp && G.sp.taker === p ? 0.55 : 1) * (p.team === G.human ? 0.85 : 1); }
function rotV(vx, vy, a) { const c = Math.cos(a), s = Math.sin(a); return [vx * c - vy * s, vx * s + vy * c]; }
function noteRecv(q, x, y, run) { q.recv = { x, y, t: G.t, fid: G.ball.fid }; if (run) q.runT = G.t; }

// ---------- Passauswahl ----------
// Mit Richtung: Mitspieler im Kegel (erst eng, dann weit), sonst der beste freie Mitspieler
function choosePass(p, dx, dy, kind = 'pass', cone = 0.7, pow = null) {
  let best = null, bs = -1e9; const hasDir = Math.hypot(dx, dy) > 0.3;
  for (const q of mates(p)) {
    const d = dist(p.x, p.y, q.x, q.y); if (d < 2) continue;
    if (isGK(q) && !hasDir) continue;
    let sc;
    if (hasDir) {
      const dot = ((q.x - p.x) * dx + (q.y - p.y) * dy) / d / Math.hypot(dx, dy); if (dot < cone) continue;
      const lane = kind === 'lob' ? 4 : laneOpen(p, q.x, q.y);
      sc = dot * 6 - d * (kind === 'lob' ? 0.005 : 0.035) + Math.min(openness(q), 8) * 0.15 + (kind === 'through' ? prog(p.team, q.x) * 3 : 0) + Math.min(lane, 4) * 0.45 - (lane < 1.1 ? 1.5 : 0);
      // wie EA FC: in Stickrichtung den Mitspieler wählen, der den Ball auch sicher bekommt
      if (kind !== 'lob') sc -= interceptRisk(p, q, kind === 'through' ? 12 : 15) * 3.2;
      if (pow != null) sc -= Math.abs(d - (7 + pow * 28)) * 0.09;   // Touch: kurz gedrückt = naher Mitspieler, lang = weiter weg
      if (isGK(q)) sc -= 2;
    } else sc = passScore(p, q, kind) - (pow != null ? Math.abs(d - (7 + pow * 28)) * 0.05 : 0);
    if (sc > bs) { bs = sc; best = q; }
  }
  return best || (hasDir && cone > 0.2 ? choosePass(p, dx, dy, kind, 0.1, pow) : hasDir ? choosePass(p, 0, 0, kind, 0.7, pow) : null);
}
// Abfanggefahr: erreicht ein Gegner die Passlinie, bevor der Ball dort ist? (flacher Pass, ca. 14 m/s)
function interceptRisk(p, q, v = 14) {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
  let risk = 0;
  for (const o of opps(p)) {
    const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / (L * L), 0, 1); if (t < 0.08) continue;
    const cx = p.x + dx * t, cy = p.y + dy * t, dd = Math.hypot(o.x - cx, o.y - cy);
    const tBall = t * L / v + 0.05, tOpp = Math.max(0, dd - 0.9) / maxSpeed(o, true) + (isGK(o) ? 0.1 : 0.22);
    if (tOpp < tBall) risk = Math.max(risk, clamp((tBall - tOpp) / 0.4 + 0.4, 0, 1));
  }
  return risk;
}
// Wert eines Passes (auch für die KI): Raumgewinn, Freiheit des Empfängers, freie Passlinie, Abseits
function passScore(p, q, kind) {
  const d = dist(p.x, p.y, q.x, q.y), gain = prog(p.team, q.x) - prog(p.team, p.x), open = Math.min(openness(q), 9), lane = laneOpen(p, q.x, q.y);
  let sc = gain * 3.2 + open * 0.11 + Math.min(lane, 4) * (kind === 'lob' ? 0.04 : 0.22) - Math.max(0, d - (kind === 'lob' ? 45 : 28)) * 0.05 - d * 0.004;
  if (G.offs === null && SETTINGS.offside) { const line = opps(p).map(o => prog(p.team, o.x)).sort((a, b) => b - a)[1] ?? 1; if (prog(p.team, q.x) > Math.max(line, prog(p.team, p.x), 0.5) + 0.003) sc -= 5; }
  if (lane < 1.2 && kind !== 'lob') sc -= 2.4; else if (lane < 2 && kind !== 'lob') sc -= 0.6;   // zugestellte Passwege meiden
  if (inBox(1 - p.team, q.x, q.y)) sc += 0.35;
  if (kind === 'pass') sc -= interceptRisk(p, q) * (prog(p.team, p.x) > 0.62 ? 1.4 : 3);   // vorne darf es riskanter sein
  return sc;
}

// ---------- Pässe ----------
function pass(p, q, pow = null) {
  if (!q) return;
  const b = G.ball; let tx = q.x, ty = q.y;
  const hum = isHumanTeam(p.team);
  let d = dist(b.x, b.y, tx, ty), va = clamp(7.5 + d * 0.17, 8, 13.5) * (hum ? 1.12 : 1) * (pow != null ? 0.88 + pow * 0.3 : 1), v0 = clamp(groundSpeed(d, va), 10, 31);   // zackig wie im Arcade-Fußball, die Annahme-Hilfe fängt ihn
  const t = (v0 - va) / FRIC();
  tx = clamp(q.x + q.vx * t * 0.75, 0.5, CW - 0.5); ty = clamp(q.y + q.vy * t * 0.75, 0.5, CH - 0.5);
  d = dist(b.x, b.y, tx, ty); v0 = clamp(groundSpeed(d, va), 9, 30);
  const err = aimErr(p, 'pas'), a = Math.atan2(ty - b.y, tx - b.x) + gauss() * err;
  const thr = G.sp && G.sp.taker === p && G.sp.type === 'throw';
  kickBall(p, thr ? 'throw' : 'pass', 0.25);
  if (thr) { b.z = 2; b.y = clamp(b.y, 0.15, CH - 0.15); launchAir(tx, ty, 0.6, clamp(d / 13, 0.35, 1.6)); }
  else { b.vx = Math.cos(a) * v0 * (1 + gauss() * err * 0.4); b.vy = Math.sin(a) * v0 * (1 + gauss() * err * 0.4); b.vz = 0; }
  b.passTo = q; noteRecv(q, tx, ty);
  G.stats.passes[p.team]++; p.d.ms.ps++;
  if (isHumanTeam(p.team)) { giveAndGo(p, q); toCtrl(p.team, q, p); }
}
// Doppelpass: wer den Ball abgibt, startet in den freien Raum nach vorne und bietet sich für den Rückpass an
function giveAndGo(p, q) {
  if (isGK(p) || G.ctrl !== p || G.phase !== 'play' || G.sp) return;
  const t = p.team, s = atkDir(t), gain = (q.x - p.x) * s;
  if (prog(t, p.x) < 0.3 || gain < -6) return;
  const line = offLine(t), tp = Math.min(prog(t, p.x) + 0.15, Math.max(line - 0.01, prog(t, p.x) + 0.04), 0.93);
  const side = Math.abs(q.y - p.y) > 4 ? Math.sign(p.y - q.y) * 2.5 : (p.y > MY ? -3 : 3);
  p.run = { until: G.t + 2.4, x: clamp(fromProg(t, tp), 2, CW - 2), y: clamp(lerp(p.y, MY, 0.25) + side, 3, CH - 3), gg: true };
}
// Steilpass in den Lauf: flach in den Raum vor dem Mitspieler
function through(p, q) {
  if (!q) return;
  const b = G.ball, s = atkDir(p.team), gx = goalX(p.team);
  let L = clamp(7 + A_(q, 'tmp') * 0.04, 7, 12);
  let tx = q.x + s * L, ty = q.y + (MY - q.y) * 0.18;
  if (Math.abs(tx - gx) < 4) tx = gx - s * 4;
  tx = clamp(tx, 1, CW - 1); ty = clamp(ty, 1.5, CH - 1.5);
  const d = dist(b.x, b.y, tx, ty), va = 2.5, v0 = clamp(groundSpeed(d, va), 7, 26);
  const err = aimErr(p, 'pas') * 1.2, a = Math.atan2(ty - b.y, tx - b.x) + gauss() * err;
  kickBall(p, 'through', 0.3);
  b.vx = Math.cos(a) * v0; b.vy = Math.sin(a) * v0; b.vz = 0;
  b.passTo = q; noteRecv(q, tx, ty, true);
  G.stats.passes[p.team]++; p.d.ms.ps++;
  if (isHumanTeam(p.team)) { giveAndGo(p, q); toCtrl(p.team, q, p); }
}
// hoher Ball: über die Abwehr zum Mitspieler (landet vor ihm)
function lob(p, q) {
  if (!q) return;
  const b = G.ball, d0 = dist(b.x, b.y, q.x, q.y), T = clamp(0.75 + d0 * 0.032, 0.8, 2.4);
  let tx = clamp(q.x + q.vx * T * 0.7, 1, CW - 1), ty = clamp(q.y + q.vy * T * 0.7, 1, CH - 1);
  const err = aimErr(p, 'pas') * 1.3, d = dist(b.x, b.y, tx, ty);
  const a = gauss() * err; tx += Math.cos(a) * 0 + gauss() * err * d * 0.5; ty += gauss() * err * d * 0.5;
  kickBall(p, 'lob', 0.45);
  launchAir(tx, ty, 0, T);
  b.passTo = q; noteRecv(q, tx, ty);
  G.stats.passes[p.team]++; p.d.ms.ps++;
  toCtrl(p.team, q, p);
}
// Flanke in den Strafraum: auf Kopfhöhe am kurzen oder langen Pfosten oder am Elfmeterpunkt. aim: -1 kurz, 1 lang, 0 automatisch
function cross(p, aim = 0) {
  const b = G.ball, gx = goalX(p.team), s = atkDir(p.team), side = b.y < MY ? -1 : 1;
  const zones = [[gx - s * 6, MY + side * 2.5], [gx - s * 8, MY - side * 3.5], [gx - s * PEN_D, MY]];
  const inB = mates(p).filter(q => !isGK(q) && Math.abs(q.x - gx) < 20 && Math.abs(q.y - MY) < 16);
  let tgt = null, best = -1e9;
  for (const q of inB) { const sc = q.d.kop * 0.02 + Math.min(openness(q), 5) * 0.3 - Math.abs(q.x - gx) * 0.05 + (aim < 0 ? -(q.y - MY) * side * 0.2 : aim > 0 ? (q.y - MY) * side * 0.2 : 0); if (sc > best) { best = sc; tgt = q; } }
  let tx, ty;
  if (tgt) { tx = tgt.x + s * 1.5; ty = tgt.y; } else { const z = zones[aim < 0 ? 0 : aim > 0 ? 1 : (Math.random() * 3) | 0]; tx = z[0]; ty = z[1]; }
  tx = clamp(tx, gx === CW ? CW - 13 : 3, gx === CW ? CW - 3 : 13);
  const d = dist(b.x, b.y, tx, ty), T = clamp(0.35 + d / 19, 0.6, 2.0), err = aimErr(p, 'pas') * (p.d.trait === 'Flankengott' ? 0.6 : 1.1);
  tx += gauss() * err * d * 0.45; ty += gauss() * err * d * 0.45;
  kickBall(p, 'cross', 0.5);
  launchAir(tx, ty, rnd(1.4, 1.9), T);
  if (tgt) { b.passTo = tgt; noteRecv(tgt, tx, ty); }
  G.stats.passes[p.team]++; p.d.ms.ps++;
  if (tgt) toCtrl(p.team, tgt, p);
  if (!G.demo) AU.crowd(0.5);
}
// Befreiungsschlag: hoch und weit Richtung Seitenlinie
function clearBall(p) {
  const b = G.ball, s = atkDir(p.team), tx = clamp(p.x + s * rnd(30, 45), 3, CW - 3), ty = clamp(p.y < MY ? rnd(4, 16) : rnd(CH - 16, CH - 4), 2, CH - 2);
  kickBall(p, 'clear', 0.8); launchAir(tx + gauss() * 4, ty + gauss() * 4, 0, rnd(1.8, 2.5));
}
// Torwart: Abwurf (Hand) oder Abschlag
function gkThrow(p, q) {
  if (!q) return;
  const b = G.ball, d = dist(b.x, b.y, q.x, q.y);
  kickBall(p, 'pass', 0.15); b.z = 1.6;
  launchAir(q.x + q.vx * 0.5, q.y + q.vy * 0.5, 0.3, clamp(d / 15, 0.4, 1.6));
  b.passTo = q; noteRecv(q, q.x, q.y); p.act = { type: 'throw', t: 0, dur: 0.35 };
  toCtrl(p.team, q, p);
}
function gkPunt(p, q) {
  const b = G.ball, s = atkDir(p.team);
  q = q || mates(p).filter(m => grpOf(m) === 'ST').sort((a, c) => openness(c) - openness(a))[0];
  const tx = q ? q.x : p.x + s * 45, ty = q ? q.y : MY + rnd(-12, 12);
  kickBall(p, 'lob', 0.9); b.z = 0.5;
  launchAir(clamp(tx + gauss() * 4, 2, CW - 2), clamp(ty + gauss() * 4, 2, CH - 2), 0, rnd(2.2, 2.8));
  if (q) { b.passTo = q; noteRecv(q, tx, ty); toCtrl(p.team, q, p); }
}

// ---------- Schuss ----------
// power 0..1 (Aufladen), aimY -1 (hinterer Pfosten, oben im Bild) … 1 (vorderer Pfosten) oder null (automatisch), o: { header, volley, pen }
function shoot(p, power, aimY, o = {}) {
  const b = G.ball, gx = goalX(p.team), s = atkDir(p.team), gk = G.gk[1 - p.team];
  const d = dist(b.x, b.y, gx, MY);
  let ty, tz;
  if (o.target) { ty = o.target.y; tz = o.target.z; }   // Zielansicht: Ziel und Streuung kommen fertig
  else if (aimY == null) {
    const gy = gk && !gk.off ? gk.y : MY, away = gy > MY + 0.2 ? -1 : gy < MY - 0.2 ? 1 : (b.y > MY ? -1 : 1);
    ty = MY + away * rnd(2.3, 3.4); tz = o.header ? rnd(0.2, 1.4) : 0.15 + power * 1.75 + rnd(-0.1, 0.4);
  } else { const a = shotAim(p, power, aimY); ty = a.y; tz = o.header ? rnd(0.2, 1.4) : a.z; }
  if (o.aimPt) { ty = o.aimPt.y; tz = 0.15 + Math.min(power, 1) * 1.75; const k = shotKind(p, power, ty); if (k === 'chip') o.chip = true; if (k === 'finesse') o.finesse = true; }
  if (o.finesse) { const side = Math.sign(ty - MY) || 1; ty = MY + side * (GW / 2 - 0.5); tz = 0.35 + Math.min(power, 0.8) * 1.1; }   // Schlenzer: flach-halbhoch an den Innenpfosten
  if (o.chip) { const side = Math.abs(ty - MY) > 1 ? Math.sign(ty - MY) : 0; ty = MY + side * 1.6; tz = 1.75; }                       // Heber: unter die Latte
  if (power > 0.93 && !o.pen && !o.target && !o.finesse && !o.chip) tz += (power - 0.93) * 12;   // überzogen: drüber
  const sch = o.header ? A_(p, 'kop') : A_(p, 'sch');
  let err = (0.04 + d * 0.0036) * (1.55 - sch / 100) * (pressure(p) < 1.4 ? 1.45 : 1) * (o.header ? 1.3 : 1) * (o.volley ? 1.35 : 1) * (p.d.energy < 0.45 ? 1.2 : 1);
  if (o.pen) err *= 0.45; if (p.d.trait === 'Knipser') err *= 0.85;
  if (isHumanTeam(p.team)) err *= TOUCHDEV ? 0.72 : 0.8;   // Arcade: der eigene Schuss geht eher dahin, wo das Zielkreuz steht
  if (!isHumanTeam(p.team) && G.human >= 0) err *= 1 - G.diff.cpu / 60;
  if (o.finesse) err *= 0.62; if (o.chip) err *= 0.75;
  if (!o.target) { ty += gauss() * err * d; tz = Math.max(0.05, tz + gauss() * err * d * 0.5); }
  let v = o.target ? o.target.v : (o.header ? 11 + A_(p, 'kop') * 0.07 : 16 + power * 13 + sch * 0.05 + (p.d.trait === 'Freistoßkönig' && G.sp ? 1.5 : 0)) * (o.volley ? 1.05 : 1);
  if (o.finesse) v = 17 + Math.min(power, 0.8) * 7 + sch * 0.04;
  const tx = gx + s * 0.4, dd = dist(b.x, b.y, tx, ty);
  let T = dd / v;
  if (o.chip) T = clamp(0.55 + dd * 0.045 - power * 0.15, 0.7, 1.6);   // hoher Bogen über den herauslaufenden Torwart
  kickBall(p, 'shot', 0.6 + power * 0.4);
  if (o.header) b.z = 1.8; else if (o.volley) b.z = Math.max(b.z, 0.5);
  launchAir(tx, ty, tz, T);
  b.shot = { by: p, team: p.team, t0: G.t, d, pen: !!o.pen, header: !!o.header, finesse: !!o.finesse, chip: !!o.chip };
  p.shotCD = G.t + 2.5;
  b.spin = o.target || o.chip ? 0 : (aimY || 0) * 0.6;
  G.stats.shots[p.team]++; p.d.ms.sh++;
  if (!G.so) G.excite = Math.max(G.excite, 0.8);
  AU.crowd(0.5); if (o.header) AU.header();
  if (isHumanCtrl(p)) buzz(power > 0.7 ? 25 : 15);
  if (isHumanCtrl(p) && !G.so && (power > 0.7 || o.volley || o.header)) { G.hitStop = 0.055; G.shake = Math.max(G.shake, 0.12); }
  p.act = { type: o.header ? 'head' : 'kick', t: 0, dur: 0.38 };
}
// Ziel eines Schusses mit Richtung (auch fürs Zielkreuz im Tor): Stick hoch/runter = Ecke, ohne Richtung weg vom Torwart in die Ecke
function shotAim(p, power, aimY) {
  const gk = G.gk[1 - p.team], b = G.ball;
  let y;
  if (Math.abs(aimY) < 0.25) { const gy = gk && !gk.off ? gk.y : MY, away = gy > MY + 0.2 ? -1 : gy < MY - 0.2 ? 1 : (b.y > MY ? -1 : 1); y = MY + away * 2.3; }
  else y = MY + clamp(aimY * 1.4, -1, 1) * (GW / 2 - 0.55);
  return { y, z: 0.15 + Math.min(power, 1) * 1.75 };
}
// Schussart beim Zielen mit dem Daumen, ganz nach Gefühl: leicht gegen einen herausgelaufenen Torwart = Heber,
// leicht in die Ecke = Schlenzer, sonst ein normaler Schuss (fest = Hammer)
function shotKind(p, power, ty) {
  const gk = G.gk[1 - p.team], gx = goalX(p.team), d = dist(G.ball.x, G.ball.y, gx, MY);
  if (power < 0.42 && gk && !gk.off && Math.abs(gk.x - gx) > 3 && d < 24) return 'chip';
  if (power < 0.62 && Math.abs(ty - MY) > 2.2) return 'finesse';
  return power > 0.75 ? 'hammer' : 'shot';
}
// Kopfball: aufs Tor, Abwehr oder zum Mitspieler
function header(p, wantShot) {
  if (G.ball.passer && G.ball.passer.team === p.team && G.ball.passer !== p) p.assistFrom = G.ball.passer; else p.assistFrom = null;
  const b = G.ball, gx = goalX(p.team), d = dist(p.x, p.y, gx, MY), s = atkDir(p.team);
  p.vz = Math.max(p.vz, 2.6); p.z = Math.max(p.z, 0.05);
  const front = (gx - p.x) * s > 0, angOk = Math.abs(p.y - MY) < d * 0.9;
  // dein Spieler köpft im Strafraum von selbst aufs Tor (wie bei ISS), mit Pass vorgemerkt legt er stattdessen ab
  const mine = isHumanCtrl(p), layOff = mine && p.queue && p.queue.k === 'pass' && G.t - p.queue.t < 1.5;
  if (!layOff && (wantShot || mine || p.team !== G.human || G.ctrl !== p) && d < 17 && front && angOk && (wantShot || mine || Math.random() < 0.85)) {
    shoot(p, 0.5, isHumanCtrl(p) && Math.abs(inOf(p).y) > 0.25 ? inOf(p).y : null, { header: true }); return;
  }
  AU.header();
  const q0 = mine && p.queue && G.t - p.queue.t < 1.5 ? p.queue : null;
  if (q0 && (q0.k === 'clear' || q0.k === 'pass')) {
    p.queue = null; kickBall(p, 'head', 0.4); b.z = 1.9; G.offs = null; p.act = { type: 'head', t: 0, dur: 0.4 };
    if (q0.k === 'pass') { const m = choosePass(p, q0.x, q0.y) || choosePass(p, 0, 0); if (m) { launchAir(m.x, m.y, 0, clamp(dist(p.x, p.y, m.x, m.y) / 11, 0.6, 1.4)); b.passTo = m; noteRecv(m, m.x, m.y); toCtrl(p.team, m, p); return; } }
    let dx = q0.x, dy = q0.y; if (Math.hypot(dx, dy) < 0.3) { dx = s; dy = p.y < MY ? -0.6 : 0.6; }   // ohne Richtung: nach vorn und nach außen
    const m = Math.hypot(dx, dy); launchAir(clamp(p.x + dx / m * 18, 1, CW - 1), clamp(p.y + dy / m * 18, 1, CH - 1), 0, 1.25);
    feat('kopf-abwehr', p); return;
  }
  if ((inBox(p.team, p.x, p.y) || prog(p.team, p.x) < 0.3) && Math.abs(p.x - ownX(p.team)) < 13 && Math.random() < 0.3) {
    // in Not: ins Toraus köpfen (lieber Ecke als Gegentor)
    kickBall(p, 'head', 0.4); b.z = 1.9; G.offs = null;
    launchAir(ownX(p.team) - s * 2, clamp(p.y + (p.y < MY ? -1 : 1) * rnd(6, 14), -3, CH + 3), 0, rnd(0.6, 0.9));
  } else if (inBox(p.team, p.x, p.y) || prog(p.team, p.x) < 0.3) {
    // klären: weg vom eigenen Tor
    kickBall(p, 'head', 0.4); b.z = 1.9;
    launchAir(clamp(p.x + s * rnd(14, 22), 2, CW - 2), clamp(p.y + (p.y < MY ? -1 : 1) * rnd(4, 12), 2, CH - 2), 0, rnd(1.0, 1.4));
  } else {
    const q = choosePass(p, s, 0, 'pass', 0.2) || choosePass(p, 0, 0);
    kickBall(p, 'head', 0.3); b.z = 1.9;
    const tx = q ? q.x : p.x + s * 10, ty = q ? q.y : p.y;
    launchAir(tx, ty, 0, clamp(dist(p.x, p.y, tx, ty) / 11, 0.6, 1.3));
    if (q) { b.passTo = q; noteRecv(q, tx, ty); toCtrl(p.team, q, p); }
  }
  p.act = { type: 'head', t: 0, dur: 0.4 };
}

// ---------- Zweikampf ----------
// Tackling im Stehen: Erfolg nach Zweikampf gegen Technik, von hinten riskant
function tackle(d, c) {
  if (d.cd > 0 || d.stun > 0) return;
  d.cd = 0.7; d.act = { type: 'tackle', t: 0, dur: 0.35 };
  if (!c || dist(d.x, d.y, c.x, c.y) > 1.6) { d.cd = 0.4; AU.tackle(); return; }
  const behind = (c.hx * (d.x - c.x) + c.hy * (d.y - c.y)) / Math.max(0.1, dist(d.x, d.y, c.x, c.y)) < -0.3;
  let pr = 0.38 + (A_(d, 'zwk') - A_(c, 'tec')) / 110 - (behind ? 0.15 : 0) + (c.d.energy < 0.4 ? 0.06 : 0);
  if (G.human >= 0 && !isHumanTeam(d.team)) pr += (G.diff.tackle - 1) * 0.12;
  if (isHumanCtrl(d)) pr += G.diff.htk ?? 0.12;   // Arcade: dein Tackling sitzt öfter
  if (d.d.trait === 'Blutgrätsche' || d.d.trait === 'Dampfwalze') pr += 0.05;
  AU.tackle();
  if (Math.random() < pr) {
    d.d.ms.tk++; if (isHumanCtrl(d)) { G.hitStop = 0.04; G.shake = Math.max(G.shake, 0.08); }
    if (Math.random() < 0.6) giveBall(d);
    else { const b = G.ball; b.owner = null; b.state = 'free'; b.last = d; b.lastTeam = d.team; b.fid++; b.kind = 'loose'; b.passer = null; b.vx = (c.x - d.x) * 2 + rnd(-3, 3); b.vy = (c.y - d.y) * 2 + rnd(-3, 3); b.vz = rnd(0, 1.5); b.nc = c; b.ncT = 0.3; G.offs = null; }
    c.stun = 0.35; c.act = { type: 'stumble', t: 0, dur: 0.35 };
  } else {
    const fr = (behind ? 0.32 : 0.1) * (d.d.trait === 'Blutgrätsche' ? 1.5 : 1) * (isHumanTeam(c.team) ? G.diff.foul : 0.8);
    if (Math.random() < fr) foul(d, c, behind ? 1 : 0);
    else { d.stun = 0.45; d.act = { type: 'stumble', t: 0, dur: 0.45 }; }
  }
}
// Ball spitzeln: wer als Verteidiger dem Ballführer in den Ball läuft, stochert ihn weg (wie bei ISS, ohne Taste)
function poke(d, c) {
  const b = G.ball; d.cd = 0.6; d.d.ms.tk++;
  b.owner = null; b.state = 'free'; b.last = d; b.lastTeam = d.team; b.fid++; b.kind = 'loose'; b.passer = null; b.shot = null; b.plan = null; G.offs = null;
  const ax = d.x - c.x, ay = d.y - c.y, m = Math.hypot(ax, ay) || 1;
  b.vx = ax / m * rnd(2, 4) + c.vx * 0.3; b.vy = ay / m * rnd(2, 4) + c.vy * 0.3; b.vz = 0; b.nc = c; b.ncT = 0.35;
  c.stun = Math.max(c.stun, 0.2); AU.tackle();
  if (isHumanCtrl(d)) { G.hitStop = 0.035; G.shake = Math.max(G.shake, 0.06); }
}
// Grätsche: rutscht 3–4 m in Blickrichtung. Ball zuerst = sauber, Gegner zuerst = Foul
function slide(d, dx, dy) {
  if (d.cd > 0 || d.stun > 0 || d.act && d.act.type === 'slide') return;
  let m = Math.hypot(dx, dy); if (m < 0.2) { dx = d.hx; dy = d.hy; m = Math.hypot(dx, dy) || 1; }
  dx /= m; dy /= m; d.hx = dx; d.hy = dy; if (Math.abs(dx) > 0.2) d.face = Math.sign(dx);
  const sp = Math.max(7.5, Math.hypot(d.vx, d.vy) + 2.5);
  d.act = { type: 'slide', t: 0, dur: 0.6, dx, dy, hit: false }; d.vx = dx * sp; d.vy = dy * sp; d.cd = 1.2;
  AU.slide();
}
function slideStep(d, dt) {
  const a = d.act, b = G.ball;
  if (a.t > 0.42 || a.hit) return;
  const fx = d.x + a.dx * 0.7, fy = d.y + a.dy * 0.7;
  const own = b.owner;
  // Ball getroffen?
  if (b.z < 0.6 && dist(fx, fy, b.x, b.y) < 0.85 && own !== d) {
    a.hit = true; d.d.ms.tk++;
    if (own) { own.stun = 0.5; own.act = { type: 'fall', t: 0, dur: 0.7 }; }
    b.owner = null; b.state = 'free'; b.last = d; b.lastTeam = d.team; b.fid++; b.kind = 'loose'; b.passer = null; b.shot = null; b.plan = null; G.offs = null;
    b.vx = a.dx * rnd(5, 9) + rnd(-2, 2); b.vy = a.dy * rnd(5, 9) + rnd(-2, 2); b.vz = rnd(0, 1); b.nc = d; b.ncT = 0.25; b.z = 0.05;
    AU.tackle(); if (own && !G.demo) { G.excite = Math.max(G.excite, 0.5); AU.crowd(0.4); }
    return;
  }
  // Gegner getroffen (ohne Ball): Foul
  for (const o of opps(d)) {
    if (isGK(o) && o.act && o.act.type === 'dive') continue;
    if (dist(fx, fy, o.x, o.y) < 0.65 && (o === own || dist(o.x, o.y, b.x, b.y) < 4)) {
      a.hit = true;
      const behind = (o.hx * (d.x - o.x) + o.hy * (d.y - o.y)) / Math.max(0.1, dist(d.x, d.y, o.x, o.y)) < -0.2;
      foul(d, o, behind ? 2 : 1); return;
    }
  }
}
// Haken: Richtungswechsel um 90° mit Antritt, kann den Gegenspieler stehen lassen
function trick(p, dx, dy) {
  if (p.cd > 0) return; p.cd = 1.1;
  let m = Math.hypot(dx, dy);
  if (m < 0.3) { dx = -p.hy; dy = p.hx; if (Math.random() < 0.5) { dx = -dx; dy = -dy; } m = 1; }
  else { const px = -p.hy, py = p.hx, dot = px * dx + py * dy; dx = dot >= 0 ? px : -px; dy = dot >= 0 ? py : -py; m = 1; }
  p.act = { type: 'trick', t: 0, dur: 0.3, dx, dy }; p.vx = dx * 7.5; p.vy = dy * 7.5; p.hx = dx; p.hy = dy;
  for (const o of opps(p)) if (!isGK(o) && dist(o.x, o.y, p.x, p.y) < 2.2 && Math.random() < 0.38 + (A_(p, 'tec') - A_(o, 'zwk')) / 120 + (p.d.trait === 'Schlitzohr' ? 0.1 : 0)) {
    o.stun = 0.7; o.act = { type: 'stumble', t: 0, dur: 0.6 };
    feat('haken', p, 'HAKEN!', `${p.d.name.toUpperCase()} LÄSST ${o.d.name.toUpperCase()} STEHEN`);
  }
  AU.touch();
}

// ---------- Fouls, Karten ----------
// sev: 0 leicht, 1 normal, 2 rücksichtslos (Grätsche von hinten)
function foul(d, c, sev) {
  if (G.phase !== 'play') return;
  const t = c.team, s = atkDir(t), gx = goalX(t), b = G.ball;
  G.stats.fouls[d.team]++; AU.whistle(1); AU.foul();
  c.act = { type: 'fall', t: 0, dur: 1.1 }; c.stun = 1.1; c.vx = c.vy = 0;
  G.shake = Math.max(G.shake, 0.15);
  const inPen = inBox(d.team, c.x, c.y);
  // Notbremse: letzter Mann, Angreifer frei aufs Tor
  const oppsAhead = teamP(d.team).filter(q => q !== d && !isGK(q) && (q.x - c.x) * s > 0).length;
  const dogso = oppsAhead === 0 && dist(c.x, c.y, gx, MY) < 32 && Math.abs(c.y - MY) < 20 && (b.owner === c || dist(b.x, b.y, c.x, c.y) < 3);
  let card = null;
  if (dogso && !inPen) card = 'red';
  else if (sev >= 2 && Math.random() < 0.7) card = 'yellow';
  else if (sev === 1 && Math.random() < 0.18) card = 'yellow';
  else if (dogso && inPen && Math.random() < 0.4) card = 'yellow';
  if (d.d.trait === 'Blutgrätsche' && card === null && sev >= 1 && Math.random() < 0.2) card = 'yellow';
  if (card === 'yellow' && d.d.yc >= 1) card = 'yr';
  let sub = `${d.d.name.toUpperCase()} GEGEN ${c.d.name.toUpperCase()}`;
  if (inPen) { banner('ELFMETER!', '#ff4f3a', sub, 1.8, true); G.pending = { k: 'pen', team: t, t: card ? 2.6 : 1.8 }; say(pick(['Strafstoß! Der Schiri zeigt auf den Punkt.', 'Elfmeter! Die Heimfans toben.', 'Klarer Fall – Elfmeter!'])); AU.crowd(0.9); }
  else { banner('FOUL', '#ffc83a', sub, 1.0); G.pending = { k: 'free', team: t, x: c.x, y: c.y, who: c, t: card ? 2.4 : 1.2 }; }
  if (card) giveCard(d, card);
  if (!card && Math.random() < 0.08 && !G.demo) { G.spray = { p: c, t: 0 }; say(`${c.d.name} bleibt liegen. Der Betreuer kommt mit dem Eisspray.`); AU.spray(); }
  G.phase = 'whistle'; G.phaseT = 0; b.passTo = null;
}
function giveCard(p, card) {
  const t = p.team;
  if (card === 'yellow') { p.d.yc = 1; p.d.ms.yc = 1; G.stats.yellow[t]++; G.cut = { kind: 'card', p, t: 0, dur: 1.8, col: '#ffd200', title: 'GELBE KARTE' }; say(`Gelb für ${p.d.name}.`); }
  else {
    if (card === 'yr') { G.stats.yellow[t]++; p.d.ms.yc = 1; }
    p.d.ms.rc = 1; G.stats.red[t]++; G.cut = { kind: 'card', p, t: 0, dur: 2.2, col: '#ff3a2a', title: card === 'yr' ? 'GELB-ROT' : 'ROTE KARTE' };
    say(card === 'yr' ? `Gelb-Rot für ${p.d.name}! ${G.T[t].short} nur noch zu zehnt.` : `Rot für ${p.d.name}! Notbremse.`);
    sendOff(p);
  }
  if (G.career) G.cardLog = (G.cardLog || []).concat([{ team: t, pid: p.d.pid, card }]);
}
function sendOff(p) {
  if (isGK(p)) {   // Torwart vom Platz: ein Feldspieler geht ins Tor
    const q = teamP(p.team).filter(m => m !== p).sort((a, c) => c.d.tw - a.d.tw)[0];
    if (q) { const i = q.i; q.i = 0; p.i = i; q.look = lookOf(q.d, G.kits[q.team], true); G.gk[p.team] = q; say(`${q.d.name} muss ins Tor!`); }
  }
  p.off = true; p.x = CW / 2 + (p.team ? 4 : -4); p.y = -3; p.vx = p.vy = 0;
  if (G.ctrl === p) G.ctrl = nearestTo(p.team, G.ball.x, G.ball.y);
  if (G.ball.owner === p) { G.ball.owner = null; G.ball.state = 'free'; }
}
