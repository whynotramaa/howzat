(function () {
  if (window.PEOPLE) return;
  const I = window.INK, C = I.C;

  function rot(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  }

  function bean(ctx, o) {
    const s = o.s || 200, b = o.b || 0, seed = o.seed || 1, lean = o.lean || 0;
    const X = (p) => {
      const r = rot(p, lean);
      return [o.x + r[0] * s, o.y + r[1] * s];
    };
    const body = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * I.TAU;
      const w = 0.3 + 0.05 * Math.sin(a);
      body.push(X([Math.cos(a) * w, -0.55 + Math.sin(a) * 0.56]));
    }
    const arm = (a, id) => {
      if (!a) return;
      const pts = [X(a[0]), X(a[1]), X(a[2])];
      I.tube(ctx, pts, s * 0.13, o.color, { seed: seed * 20 + id, b, amp: 1.2 });
      const h = pts[2];
      I.circle(ctx, h[0], h[1], s * 0.075, { fill: C.skin, w: Math.max(2, s * 0.018), seed: seed * 20 + id + 5, b });
    };
    if (o.back) arm(o.back, 1);
    if (o.legs) for (const [k, l] of o.legs.entries()) I.tube(ctx, l.map(X), s * 0.14, o.legColor || C.ink, { seed: seed * 20 + 9 + k, b, amp: 1 });
    I.stroke(ctx, body, { closed: true, fill: o.color, w: Math.max(2.5, s * 0.022), seed: seed * 20 + 2, b, amp: 1.6 });
    if (o.pattern) o.pattern(X, s);
    const hb = o.headOff || [0, 0];
    const hc = X([hb[0], -1.38 + hb[1]]), hr = s * 0.3;
    I.stroke(ctx, [X([0, -1.05]), X([hb[0] * 0.5, -1.14 + hb[1] * 0.5])], { w: s * 0.1, color: C.skin, seed: seed * 20 + 3, b });
    if (o.hair === 'hood') I.circle(ctx, hc[0], hc[1] + hr * 0.05, hr * 1.28, { fill: o.color, w: Math.max(2.5, s * 0.02), seed: seed * 20 + 4, b });
    I.circle(ctx, hc[0], hc[1], hr, { fill: C.skin, w: Math.max(2.5, s * 0.02), seed: seed * 20 + 6, b });
    const hairPts = (pts) => I.stroke(ctx, pts.map((p) => [hc[0] + p[0] * hr, hc[1] + p[1] * hr]), { closed: true, fill: o.hairColor || C.ink, w: Math.max(2, s * 0.018), seed: seed * 20 + 7, b, amp: 1.2 });
    if (o.hair === 'bun') {
      hairPts([[-1.02, -0.05], [-0.9, -0.62], [-0.3, -1.02], [0.45, -0.98], [0.98, -0.45], [1.02, 0.02], [0.6, -0.42], [-0.2, -0.55], [-0.75, -0.25]]);
      I.circle(ctx, hc[0] + hr * 0.62, hc[1] - hr * 0.95, hr * 0.35, { fill: o.hairColor || C.ink, w: 2, seed: seed * 20 + 8, b });
    } else if (o.hair === 'tuft') {
      hairPts([[-1.0, -0.15], [-0.85, -0.55], [-0.6, -0.4], [-0.75, -0.05]]);
      hairPts([[1.0, -0.15], [0.85, -0.55], [0.6, -0.4], [0.75, -0.05]]);
    } else if (o.hair === 'short') {
      hairPts([[-1.0, -0.1], [-0.8, -0.75], [0, -1.06], [0.8, -0.75], [1.0, -0.1], [0.55, -0.45], [-0.5, -0.5]]);
    } else if (o.hair === 'cap') {
      hairPts([[-1.0, -0.2], [-0.75, -0.85], [0.1, -1.05], [0.85, -0.7], [1.0, -0.25], [1.55, -0.2], [1.5, -0.05], [-1.0, -0.05]]);
    }
    const look = o.look || [0, 0];
    const ex = hc[0] + look[0] * hr * 0.3, ey = hc[1] - hr * 0.05 + look[1] * hr * 0.25;
    const mood = o.mood || 'flat';
    if (o.glasses) for (const sg of [-1, 1]) I.circle(ctx, ex + sg * hr * 0.36, ey, hr * 0.24, { w: Math.max(1.6, s * 0.012), seed: seed * 20 + 10 + sg, b });
    for (const sg of [-1, 1]) {
      if (mood === 'happy' || mood === 'cheer') I.stroke(ctx, [[ex + sg * hr * 0.36 - hr * 0.12, ey + hr * 0.04], [ex + sg * hr * 0.36, ey - hr * 0.1], [ex + sg * hr * 0.36 + hr * 0.12, ey + hr * 0.04]], { w: Math.max(2, s * 0.018), seed: seed * 20 + 12 + sg, b, amp: 0.4 });
      else I.dot(ctx, ex + sg * hr * 0.36, ey, Math.max(2, hr * 0.085), C.ink);
    }
    if (mood === 'frown') for (const sg of [-1, 1]) I.stroke(ctx, [[ex + sg * hr * 0.2, ey - hr * 0.22], [ex + sg * hr * 0.5, ey - hr * 0.3]], { w: Math.max(2, s * 0.016), seed: seed * 20 + 14 + sg, b, amp: 0.3 });
    const my = ey + hr * 0.42, mx = ex;
    if (mood === 'cheer') I.stroke(ctx, I.ring(mx, my, hr * 0.22, hr * 0.17), { closed: true, fill: C.ink, w: 2, seed: seed * 20 + 16, b, amp: 0.5 });
    else if (mood === 'happy') I.stroke(ctx, [[mx - hr * 0.25, my - hr * 0.04], [mx, my + hr * 0.12], [mx + hr * 0.25, my - hr * 0.04]], { w: Math.max(2, s * 0.018), seed: seed * 20 + 17, b, amp: 0.4 });
    else if (mood === 'frown') I.stroke(ctx, [[mx - hr * 0.2, my + hr * 0.08], [mx, my - hr * 0.03], [mx + hr * 0.2, my + hr * 0.08]], { w: Math.max(2, s * 0.018), seed: seed * 20 + 18, b, amp: 0.4 });
    else I.stroke(ctx, [[mx - hr * 0.14, my], [mx + hr * 0.14, my]], { w: Math.max(2, s * 0.016), seed: seed * 20 + 19, b, amp: 0.3 });
    if (o.headset) {
      I.stroke(ctx, [[hc[0] - hr * 1.05, hc[1]], [hc[0] - hr * 0.8, hc[1] - hr * 0.95], [hc[0] + hr * 0.8, hc[1] - hr * 0.95], [hc[0] + hr * 1.05, hc[1]]], { w: Math.max(3, s * 0.03), seed: seed * 20 + 20, b });
      for (const sg of [-1, 1]) I.circle(ctx, hc[0] + sg * hr * 1.02, hc[1] + hr * 0.05, hr * 0.22, { fill: C.ink, w: 2, seed: seed * 20 + 21 + sg, b });
      I.stroke(ctx, [[hc[0] - hr * 1.0, hc[1] + hr * 0.2], [hc[0] - hr * 0.7, hc[1] + hr * 0.75], [hc[0] - hr * 0.25, hc[1] + hr * 0.7]], { w: Math.max(2, s * 0.014), seed: seed * 20 + 24, b });
    }
    arm(o.front, 3);
    return { head: hc, hr, X };
  }

  function rrect(x, y, w, h, r) {
    const p = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (i / 4) * (Math.PI / 2);
        p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return p;
  }

  function bars(ctx, x, y, s, n, b, col = C.ink) {
    for (let i = 0; i < 4; i++) {
      const h = s * (0.3 + i * 0.23), on = i < n;
      I.stroke(ctx, rrect(x + i * s * 0.32, y - h, s * 0.2, h, s * 0.04), { closed: true, fill: on ? col : 'rgba(0,0,0,0)', w: Math.max(1.2, s * 0.05), color: on ? col : C.grey, seed: 2000 + i, b, amp: 0.4 });
    }
  }

  function chip(ctx, x, y, r, label, o = {}) {
    const fill = o.fill || (label === '6' ? C.tang : label === '4' ? '#fde3cf' : label === 'W' ? C.ink : C.white);
    I.circle(ctx, x, y, r, { fill, w: Math.max(2, r * 0.1), seed: o.seed || 2100, b: o.b || 0, color: o.color || C.ink, alpha: o.alpha ?? 1 });
    I.text(ctx, label, x, y + r * 0.36, { size: r * 1.05, color: label === 'W' ? C.white : label === '4' ? '#b9480c' : C.ink, font: "'Behind The Nineties'", alpha: o.alpha ?? 1 });
  }

  function phone(ctx, x, y, w, o = {}) {
    const h = w * 2.05, b = o.b || 0, seed = o.seed || 2200;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    const x0 = -w / 2, y0 = -h / 2;
    I.stroke(ctx, rrect(x0, y0, w, h, w * 0.14), { closed: true, fill: C.ink, w: Math.max(2, w * 0.02), seed, b, amp: 1 });
    const sx = x0 + w * 0.06, sy = y0 + w * 0.08, sw = w * 0.88, sh = h - w * 0.16;
    const lit = o.lit ?? 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.25 + 0.75 * lit;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha = 1;
    const u = sw / 100;
    if (o.screen === 'score' && lit > 0.05) {
      ctx.globalAlpha = lit;
      I.dot(ctx, sx + 9 * u, sy + 12 * u, 2.4 * u, C.cobalt);
      I.stroke(ctx, [[sx + 15 * u, sy + 12 * u], [sx + 40 * u, sy + 12 * u]], { w: 2.2 * u, color: C.paper3, seed: seed + 1, b, amp: 0.3 });
      I.text(ctx, o.score || '141/4', sx + sw / 2, sy + 62 * u, { size: 30 * u, color: C.ink, alpha: lit });
      I.text(ctx, o.over || '19.0', sx + sw / 2, sy + 80 * u, { size: 11 * u, color: C.grey, font: "'Apple Garamond'", alpha: lit });
      const ch = o.chips || [];
      ch.forEach((c, i) => chip(ctx, sx + sw / 2 + (i - (ch.length - 1) / 2) * 17 * u, sy + 104 * u, 7 * u, c, { seed: seed + 10 + i, b }));
      if (o.flash) {
        ctx.globalAlpha = o.flash * 0.9;
        I.stroke(ctx, rrect(sx + 6 * u, sy + 30 * u, sw - 12 * u, 58 * u, 8 * u), { closed: true, w: 3 * u, color: C.cobalt, seed: seed + 20, b });
      }
      ctx.globalAlpha = 1;
      I.stroke(ctx, [[sx + 10 * u, sy + 128 * u], [sx + 10 * u + 80 * u * (o.progress ?? 0.7), sy + 128 * u]], { w: 2.6 * u, color: C.cobalt, seed: seed + 21, b, amp: 0.4 });
    } else if (o.screen === 'buffer') {
      ctx.fillStyle = C.grass;
      ctx.fillRect(sx, sy + 30 * u, sw, 70 * u);
      I.stroke(ctx, [[sx + 30 * u, sy + 95 * u], [sx + 40 * u, sy + 40 * u], [sx + 60 * u, sy + 40 * u], [sx + 70 * u, sy + 95 * u]], { closed: true, fill: C.pitch, w: 1.5, seed: seed + 30, b, amp: 0.6 });
      ctx.fillStyle = 'rgba(25,25,23,0.45)';
      ctx.fillRect(sx, sy + 30 * u, sw, 70 * u);
      const a = (o.spin || 0) * I.TAU;
      const arc = [];
      for (let i = 0; i <= 14; i++) arc.push([sx + sw / 2 + Math.cos(a + i * 0.32) * 11 * u, sy + 65 * u + Math.sin(a + i * 0.32) * 11 * u]);
      I.stroke(ctx, arc, { w: 3 * u, color: C.white, seed: seed + 31, b, amp: 0.5 });
      I.stroke(ctx, [[sx + 8 * u, sy + 108 * u], [sx + sw - 8 * u, sy + 108 * u]], { w: 2 * u, color: C.paper3, seed: seed + 32, b, amp: 0.3 });
      I.stroke(ctx, [[sx + 8 * u, sy + 108 * u], [sx + 30 * u, sy + 108 * u]], { w: 2 * u, color: C.red, seed: seed + 33, b, amp: 0.3 });
    } else if (o.screen === 'pad') {
      I.text(ctx, o.score || '141/4', sx + 10 * u, sy + 30 * u, { size: 17 * u, align: 'left' });
      I.text(ctx, o.over || '19.0', sx + 10 * u, sy + 42 * u, { size: 7 * u, align: 'left', color: C.grey, font: "'Apple Garamond'" });
      const keys = ['0', '1', '2', '3', '4', '5', '6', 'OUT'];
      keys.forEach((k, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const kx = sx + 6 * u + col * 22.5 * u, ky = sy + 112 * u + row * 26 * u, kw = 20 * u, kh = 23 * u;
        const pressed = o.press === k ? o.pressAmt || 0 : 0;
        const fill = k === '6' ? (pressed ? C.tang : '#f8c8a5') : k === 'OUT' ? C.ink : k === '4' ? '#fde3cf' : C.paper2;
        const sc = 1 - pressed * 0.08;
        ctx.save();
        ctx.translate(kx + kw / 2, ky + kh / 2);
        ctx.scale(sc, sc);
        I.stroke(ctx, rrect(-kw / 2, -kh / 2, kw, kh, 3 * u), { closed: true, fill, w: 1.6 * u * 0.5 + 1, seed: seed + 40 + i, b, amp: 0.6 });
        I.text(ctx, k, 0, k === 'OUT' ? 2.6 * u : 4.6 * u, { size: k === 'OUT' ? 6.5 * u : 13 * u, color: k === 'OUT' ? C.white : C.ink });
        ctx.restore();
      });
      const q = o.queue || [];
      q.forEach((c, i) => chip(ctx, sx + 12 * u + i * 13 * u, sy + 70 * u, 5.5 * u, c, { seed: seed + 60 + i, b }));
    }
    ctx.restore();
    if (o.bars != null) bars(ctx, sx + sw - 20 * (sw / 100), sy + 9 * (sw / 100), 6 * (sw / 100), o.bars, b, o.bars === 0 ? C.red : C.ink);
    ctx.restore();
  }

  function standRows(ctx, t, b, o = {}) {
    for (let r = 0; r < 7; r++) {
      const y = 140 + r * 120 + (o.dy || 0);
      I.stroke(ctx, [[-40, y], [I.W + 40, y + 10]], { w: 3, color: C.ink, seed: 2400 + r, b, alpha: 0.35 });
      for (let i = 0; i < 46; i++) {
        const x = ((i + (r % 2) * 0.5) / 46) * (I.W + 80) - 40, col = [C.pink, C.yellow, C.cobalt, C.sky, C.tang][(i * 7 + r * 3) % 5];
        const jump = (o.cheer || 0) * Math.max(0, Math.sin(t * 11 + i * 1.7 + r)) * 22;
        const jx = (I.hash(i, r, b) - 0.5) * 3;
        I.dot(ctx, x + jx, y - 26 - jump, 15, col, 0.85);
        I.dot(ctx, x + jx, y - 52 - jump, 10, C.skin, 0.85);
      }
    }
  }

  function vStand(ctx, t, b, st = {}) {
    I.paper(ctx);
    ctx.save();
    ctx.translate(-st.pan || 0, 0);
    standRows(ctx, t, b, { cheer: st.cheer || 0.15 });
    ctx.restore();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = C.yellow;
    ctx.beginPath();
    ctx.moveTo(1500, -20);
    ctx.lineTo(1760, -20);
    ctx.lineTo(1000, 1100);
    ctx.lineTo(300, 1100);
    ctx.fill();
    ctx.globalAlpha = 1;
    const c = st.cheer || 0, react = st.react || 0;
    const lift = Math.sin(react * Math.PI) * 30;
    bean(ctx, {
      x: 820, y: 1180 - lift, s: 520, color: C.sky, seed: 31, b, mood: react > 0.5 ? 'cheer' : 'flat', look: [0.3, -0.6], hair: 'short',
      back: [[-0.22, -0.95], [-0.42, -1.25], [-0.3, -1.55]], front: [[0.22, -0.95], [0.42, -1.25], [0.3, -1.55]],
      pattern: (X, s) => I.stroke(ctx, [X([-0.28, -0.6]), X([0.3, -0.58])], { w: s * 0.05, color: C.white, seed: 33, b }),
    });
    const kx = 820, ky = 1180 - lift - 520 * 1.62;
    const up = I.clamp(react * 1.4, 0, 1);
    bean(ctx, {
      x: kx, y: ky, s: 300, color: C.yellow, seed: 32, b, mood: react > 0.3 ? 'cheer' : 'happy', look: [0.5, -0.5], hair: 'cap', hairColor: C.sky,
      back: [[-0.24, -0.9], [-0.55 - up * 0.1, -1.0 - up * 0.6], [-0.7 - up * 0.1, -1.1 - up * 1.0]],
      front: [[0.24, -0.9], [0.6 + 0.2 * (1 - up), -1.0 - up * 0.6], [0.95 - up * 0.2, -1.2 - up * 0.9]],
    });
  }

  function vDesk(ctx, t, b, st = {}) {
    I.paper(ctx);
    I.stroke(ctx, [[1180, 120], [1780, 120], [1780, 560], [1180, 560]], { closed: true, fill: C.paper2, w: 4, seed: 2500, b });
    for (let i = 0; i < 26; i++) I.dot(ctx, 1210 + I.hash(i, 1) * 540, 150 + I.hash(i, 2) * 380, 4 + I.hash(i, 3) * 4, i % 4 ? C.yellow : C.ink, 0.8);
    I.stroke(ctx, [[1480, 120], [1480, 560]], { w: 4, seed: 2501, b });
    I.stroke(ctx, [[0, 820], [1920, 805]], { w: 5, seed: 2502, b });
    I.stroke(ctx, [[0, 820], [1920, 805], [1920, 1100], [0, 1100]], { closed: true, fill: C.paper3, w: 0, seed: 2503, b });
    I.stroke(ctx, [[300, 805], [270, 470], [340, 430]], { w: 9, seed: 2504, b });
    I.stroke(ctx, [[240, 470], [420, 400], [470, 470], [300, 520]], { closed: true, fill: C.ink, w: 3, seed: 2505, b });
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = C.yellow;
    ctx.beginPath();
    ctx.moveTo(300, 500);
    ctx.lineTo(460, 470);
    ctx.lineTo(980, 820);
    ctx.lineTo(120, 820);
    ctx.fill();
    ctx.globalAlpha = 1;
    I.stroke(ctx, [[560, 800], [580, 560], [1020, 560], [1040, 800]], { closed: true, fill: C.white, w: 4, seed: 2506, b });
    for (let i = 0; i < 6; i++) I.stroke(ctx, [[620, 600 + i * 30], [640 + I.hash(i, 9) * 300, 600 + i * 30]], { w: 3, color: C.paper3, seed: 2510 + i, b });
    const react = st.react || 0, look = st.look || 0;
    bean(ctx, {
      x: 1250, y: 1150, s: 470, color: C.pink, seed: 41, b, hair: 'bun', lean: -0.06 - look * 0.05,
      mood: react > 0.4 ? 'happy' : 'flat', look: [-0.3 - look * 0.5, 0.3 + look * 0.4], headOff: [-look * 0.08, look * 0.05],
      back: [[-0.24, -0.9], [-0.55, -0.6], [-0.85, -0.65]],
      front: [[0.2, -0.9], [-0.1, -0.55], [-0.45 - react * 0.15, -0.62 - react * 0.25]],
    });
    I.stroke(ctx, [[780, 805], [790, 690], [880, 690], [890, 805]], { closed: true, fill: C.cobalt, w: 4, seed: 2520, b });
    phone(ctx, 835, 640, 120, { rot: -0.12, screen: 'score', b, seed: 2530, ...(st.phone || {}) });
  }

  function vBus(ctx, t, b, st = {}) {
    I.paper(ctx, C.paper2);
    const shift = t * 900;
    I.stroke(ctx, [[120, 120], [1500, 120], [1500, 640], [120, 640]], { closed: true, fill: '#2d2f3a', w: 6, seed: 2600, b });
    ctx.save();
    ctx.beginPath();
    ctx.rect(120, 120, 1380, 520);
    ctx.clip();
    for (let i = 0; i < 9; i++) {
      const x = ((i * 260 - shift) % 2340 + 2340) % 2340 - 200;
      I.stroke(ctx, [[x, 600], [x, 260], [x + 50, 230]], { w: 6, color: C.paper3, seed: 2610 + i, b });
      I.dot(ctx, x + 60, 238, 12, C.yellow);
      I.stroke(ctx, [[x + 60, 250], [x - 60, 640]], { w: 120, color: C.yellow, seed: 2620 + i, b, alpha: 0.08 });
    }
    for (let i = 0; i < 6; i++) {
      const x = ((i * 380 - shift * 1.6) % 2280 + 2280) % 2280 - 200;
      I.stroke(ctx, [[x, 600], [x + 240, 600], [x + 240, 380], [x, 380]], { closed: true, fill: '#3a3d4a', w: 3, color: C.paper3, seed: 2630 + i, b });
      for (let k = 0; k < 4; k++) I.dot(ctx, x + 40 + k * 50, 430, 7, k % 2 ? C.yellow : C.pink, 0.7);
    }
    if (st.rain) {
      ctx.translate(0, 0);
      window.WORLD.rain(ctx, t, st.rain, { ang: 0.6, len: 30 });
    }
    ctx.restore();
    I.stroke(ctx, [[810, 120], [810, 640]], { w: 10, seed: 2640, b });
    I.stroke(ctx, [[0, 700], [1920, 690]], { w: 6, seed: 2641, b });
    I.stroke(ctx, [[1100, 1100], [1120, 520], [1500, 520], [1520, 1100]], { closed: true, fill: C.tang, w: 5, seed: 2642, b });
    const react = st.react || 0, frown = st.frown || 0;
    const hop = Math.sin(I.clamp(react * 1.3, 0, 1) * Math.PI) * 60;
    bean(ctx, {
      x: 1300, y: 1150 - hop, s: 460, color: C.yellow, seed: 51, b, hair: 'hood',
      mood: react > 0.3 ? 'cheer' : frown > 0.5 ? 'frown' : 'flat', look: [-0.6, 0.6],
      back: [[-0.24, -0.9], [-0.55, -0.6], [-0.72, -0.82]], front: [[0.2, -0.9], [-0.15, -0.5], [-0.5, -0.78]],
    });
    phone(ctx, 1030 + (react > 0.3 ? 0 : 0), 760 - hop, 150, { rot: 0.18, b, seed: 2650, ...(st.phone || { screen: 'score' }) });
  }

  function vPorch(ctx, t, b, st = {}) {
    I.paper(ctx);
    I.stroke(ctx, [[0, 860], [1920, 850]], { w: 6, seed: 2700, b });
    for (let i = 0; i < 14; i++) I.stroke(ctx, [[60 + i * 140, 860], [70 + i * 140, 560]], { w: 7, seed: 2701 + i, b });
    I.stroke(ctx, [[0, 560], [1920, 548]], { w: 9, seed: 2720, b });
    I.stroke(ctx, [[0, 860], [1920, 850], [1920, 1100], [0, 1100]], { closed: true, fill: C.paper3, w: 0, seed: 2721, b });
    for (let i = 0; i < 30; i++) I.dot(ctx, 40 + I.hash(i, 1) * 1840, 80 + I.hash(i, 2) * 380, 2 + I.hash(i, 3) * 3, C.ink, 0.5);
    I.circle(ctx, 1640, 180, 70, { fill: C.white, w: 4, seed: 2722, b });
    I.stroke(ctx, [[260, 860], [280, 700], [560, 700], [580, 860]], { closed: true, fill: C.tang, w: 4, seed: 2723, b });
    I.stroke(ctx, [[300, 700], [300, 560], [540, 560], [540, 700]], { closed: true, fill: C.grass, w: 4, seed: 2724, b });
    I.circle(ctx, 360, 630, 34, { fill: C.paper, w: 4, seed: 2725, b });
    for (let i = 0; i < 4; i++) I.stroke(ctx, [[420, 600 + i * 18], [520, 600 + i * 18]], { w: 3, seed: 2726 + i, b });
    I.stroke(ctx, [[520, 560], [600, 420]], { w: 4, seed: 2730, b });
    const react = st.react || 0;
    I.stroke(ctx, [[900, 1100], [880, 600], [1400, 600], [1380, 1100]], { closed: true, fill: C.willow, w: 5, seed: 2740, b });
    bean(ctx, {
      x: 1140, y: 1120, s: 480, color: C.grass, seed: 61, b, hair: 'tuft', hairColor: C.grey, glasses: true,
      mood: react > 0.4 ? 'happy' : 'flat', look: [-0.2, 0.5], lean: -react * 0.05,
      back: [[-0.24, -0.9], [-0.5, -0.55], [-0.6, -0.8]], front: [[0.22, -0.9], [-0.1, -0.5], [-0.4, -0.85 - react * 0.1]],
      pattern: (X, s) => { for (const y of [-0.85, -0.65, -0.45, -0.25]) I.dot(ctx, X([0.02, y])[0], X([0.02, y])[1], s * 0.022, C.paper); },
    });
    phone(ctx, 960, 690, 130, { rot: 0.1, b, seed: 2750, ...(st.phone || { screen: 'score' }) });
  }

  function pressBox(ctx, t, b, st = {}) {
    I.paper(ctx);
    I.stroke(ctx, [[60, 80], [1860, 80], [1860, 640], [60, 640]], { closed: true, fill: st.storm ? '#c9cdd3' : C.paper2, w: 7, seed: 2800, b });
    ctx.save();
    ctx.beginPath();
    ctx.rect(60, 80, 1800, 560);
    ctx.clip();
    I.stroke(ctx, [[-20, 640], [500, 330], [1420, 330], [1940, 640]], { closed: true, fill: C.grassSoft, w: 4, seed: 2801, b });
    I.stroke(ctx, [[900, 640], [930, 360], [990, 360], [1020, 640]], { closed: true, fill: C.pitch, w: 3, seed: 2802, b });
    for (let i = 0; i < 60; i++) I.dot(ctx, 80 + I.hash(i, 1) * 1760, 130 + I.hash(i, 2) * 160, 9, [C.pink, C.yellow, C.cobalt, C.sky][i % 4], 0.6);
    if (st.storm) window.WORLD.rain(ctx, t, st.storm, { ang: 0.3 });
    ctx.restore();
    I.stroke(ctx, [[960, 80], [960, 640]], { w: 6, seed: 2803, b });
    I.stroke(ctx, [[0, 760], [1920, 750], [1920, 1100], [0, 1100]], { closed: true, fill: C.paper3, w: 5, seed: 2804, b });
    bean(ctx, {
      x: 640, y: 1160 - Math.sin((st.cheer || 0) * Math.PI) * 30, s: 480, color: C.cobalt, seed: 71, b, hair: 'short', headset: true, mood: st.mood || 'flat', look: st.look || [0.6, 0.6],
      back: I.mix([[-0.24, -0.9], [0.05, -0.55], [0.35, -0.75]], [[-0.24, -0.9], [-0.5, -1.3], [-0.42, -1.75]], st.cheer || 0),
      front: I.mix([[0.22, -0.9], [0.5, -0.55], [0.72, -0.72]], [[0.22, -0.9], [0.5, -1.3], [0.42, -1.75]], st.cheer || 0),
    });
  }

  window.PEOPLE = { bean, phone, chip, bars, rrect, vStand, vDesk, vBus, vPorch, pressBox, standRows };
})();
