(function () {
  if (window.WORLD) return;
  const I = window.INK, C = I.C, V = I.V, TAU = I.TAU;
  const CROWD = [C.pink, C.yellow, C.cobalt, C.sky, C.tang, C.ink, C.pink, C.yellow, C.grass];

  function ellipse(ex, ez, y, s, n = 72, a0 = 0, a1 = TAU) {
    const p = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      p.push([ex * s * Math.cos(a), y, ez * s * Math.sin(a)]);
    }
    return p;
  }

  function stadium(o) {
    const ex = o.ex, ez = o.ez, kind = o.kind || 'cricket', seed = o.seed || 7;
    const R = I.rng(seed);
    const SEC = 48, inS = 1.1, outS = 1.72, y0 = 1.6, y1 = 30, roofY = 41;
    const st = (a, v) => {
      const s = inS + v * (outS - inS);
      return [ex * s * Math.cos(a), y0 + v * (y1 - y0), ez * s * Math.sin(a)];
    };
    const crowd = [];
    for (let k = 0; k < SEC; k++) crowd.push([]);
    const N = o.crowd ?? 2600;
    for (let i = 0; i < N; i++) {
      const a = R() * TAU, v = 0.04 + R() * 0.92;
      const sec = Math.floor((a / TAU) * SEC) % SEC;
      crowd[sec].push({ p: st(a, v), col: CROWD[Math.floor(R() * CROWD.length)], ph: R(), id: i });
    }
    const towers = [0.7, 2.44, 3.84, 5.58].map((a) => {
      const s = 1.98, base = [ex * s * Math.cos(a), 0, ez * s * Math.sin(a)];
      const inward = V.norm([-base[0], 0, -base[2]]), side = [inward[2], 0, -inward[0]];
      const top = [base[0], 66, base[2]];
      return { base, top, inward, side, a };
    });
    const grass = [];
    for (let i = 0; i < 380; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * 0.97;
      const x = ex * r * Math.cos(a), z = ez * r * Math.sin(a);
      if (kind === 'cricket' && Math.abs(x) < 3 && Math.abs(z) < 13) continue;
      const L = 0.9 + R() * 1.4, ang = R() * 0.6 - 0.3;
      grass.push([[x, 0, z], [x + Math.sin(ang) * L, 0, z + Math.cos(ang) * L]]);
    }

    function draw(D, ctx, c, t, b, s = {}) {
      const cheer = s.cheer || 0, lights = s.lights ?? 1;
      D.add(0, () => {
        const q = ellipse(ex, ez, 0, 1.0, 96);
        I.line3(ctx, c, q, { ww: 0.35, color: C.grass, seed: 3, b, wmin: 1.4, wmax: 9 });
        for (let i = 0; i < grass.length; i += 1) I.line3(ctx, c, grass[i], { ww: 0.16, color: C.grassSoft, seed: 100 + i, b, wmin: 0.8, wmax: 6 });
        if (kind === 'cricket') {
          for (let k = -6; k <= 6; k++) {
            const x = (k / 7) * ex, zz = ez * Math.sqrt(Math.max(0, 1 - (x / ex) ** 2)) * 0.97;
            I.line3(ctx, c, [[x, 0, -zz], [x, 0, zz]], { ww: 0.12, color: C.grassSoft, seed: 60 + k, b, wmin: 0.6, wmax: 4, alpha: 0.7 });
          }
          I.poly3(ctx, c, [[-1.6, 0, -11], [1.6, 0, -11], [1.6, 0, 11], [-1.6, 0, 11]], { fill: C.pitch, w: 1.6, seed: 4, b });
          for (const zc of [-10.06, 10.06, -8.84, 8.84]) I.line3(ctx, c, [[-1.6, 0.01, zc], [1.6, 0.01, zc]], { ww: 0.06, color: C.white, seed: 5 + zc, b, wmin: 1, amp: 0.6 });
          for (const zc of [-8.84, 8.84]) I.line3(ctx, c, [[-2.4, 0.01, zc], [2.4, 0.01, zc]], { ww: 0.06, color: C.white, seed: 9 + zc, b, wmin: 1, amp: 0.6 });
          I.line3(ctx, c, ellipse(27, 27, 0.01, 1, 60), { ww: 0.1, color: C.white, seed: 12, b, wmin: 0.8, alpha: 0.85 });
        } else {
          const L = 50, Wd = 32;
          I.line3(ctx, c, [[-Wd, 0, -L], [Wd, 0, -L], [Wd, 0, L], [-Wd, 0, L]], { closed: true, ww: 0.14, color: C.white, seed: 20, b, wmin: 1, wmax: 6 });
          I.line3(ctx, c, [[-Wd, 0, 0], [Wd, 0, 0]], { ww: 0.14, color: C.white, seed: 21, b, wmin: 1 });
          I.line3(ctx, c, ellipse(9, 9, 0, 1, 48), { ww: 0.14, color: C.white, seed: 22, b, wmin: 1 });
          for (const sg of [-1, 1]) {
            I.line3(ctx, c, [[-20, 0, sg * L], [-20, 0, sg * (L - 16)], [20, 0, sg * (L - 16)], [20, 0, sg * L]], { ww: 0.14, color: C.white, seed: 23 + sg, b, wmin: 1 });
            I.line3(ctx, c, [[-9, 0, sg * L], [-9, 0, sg * (L - 5.5)], [9, 0, sg * (L - 5.5)], [9, 0, sg * L]], { ww: 0.14, color: C.white, seed: 25 + sg, b, wmin: 1 });
          }
        }
      }, 0);
      if (lights > 0) {
        D.add(0, () => {
          towers.forEach((tw, i) => {
            const on = I.clamp(lights * 4 - i, 0, 1);
            if (on <= 0) return;
            const L = V.add(tw.top, V.mul(tw.side, -6)), Rr = V.add(tw.top, V.mul(tw.side, 6));
            const aim = V.mul(tw.base, 0.12);
            const q = [I.proj(c, L), I.proj(c, Rr), I.proj(c, V.add(aim, V.mul(tw.side, -30))), I.proj(c, V.add(aim, V.mul(tw.side, 30)))];
            if (q.some((p) => !p)) return;
            ctx.globalAlpha = 0.13 * on;
            ctx.fillStyle = C.yellow;
            ctx.beginPath();
            ctx.moveTo(q[0][0], q[0][1]);
            ctx.lineTo(q[1][0], q[1][1]);
            ctx.lineTo(q[3][0], q[3][1]);
            ctx.lineTo(q[2][0], q[2][1]);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          });
        }, 0.5);
      }
      for (let k = 0; k < SEC; k++) {
        const a0 = (k / SEC) * TAU, a1 = ((k + 1) / SEC) * TAU, am = (a0 + a1) / 2;
        const mid = st(am, 0.5), z = I.depth(c, mid);
        if (z < -40) continue;
        D.add(z, () => {
          const corners = [st(a0, 0), st(a1, 0), st(a1, 1), st(a0, 1)];
          I.poly3(ctx, c, corners, { fill: k % 2 ? C.paper2 : C.paper3, w: 1.3, seed: 300 + k, b, alpha: 1 });
          for (const v of [0.33, 0.66]) I.line3(ctx, c, [st(a0, v), st(a1, v)], { ww: 0.12, seed: 400 + k * 3 + v * 9, b, wmin: 0.6, wmax: 3, alpha: 0.5 });
          I.line3(ctx, c, [st(a0, 1), [ex * 1.8 * Math.cos(a0), roofY, ez * 1.8 * Math.sin(a0)]], { ww: 0.3, seed: 500 + k, b, wmin: 0.8, wmax: 5 });
          for (const m of crowd[k]) {
            const jump = cheer * Math.max(0, Math.sin(t * 10 + m.ph * 9)) * 0.9;
            const p = [m.p[0], m.p[1] + 0.5 + jump, m.p[2]];
            const s = I.proj(c, p);
            if (!s || s[0] < -20 || s[0] > I.W + 20 || s[1] < -20 || s[1] > I.H + 20) continue;
            const r = I.clamp((0.42 * c.foc) / s[2], 0.7, 9);
            const jx = (I.hash(m.id, b) - 0.5) * Math.min(2, r * 0.5), jy = (I.hash(m.id, b, 3) - 0.5) * Math.min(2, r * 0.5);
            I.dot(ctx, s[0] + jx, s[1] + jy, r, m.col);
            if (r > 3.2) I.dot(ctx, s[0] + jx, s[1] + jy - r * 1.35, r * 0.62, C.skin);
            if (cheer > 0.3 && r > 2 && m.id % 3 === 0) {
              const up = r * (2.4 + jump * 2);
              I.stroke(ctx, [[s[0] + jx - r * 0.6, s[1] + jy], [s[0] + jx - r * 0.9, s[1] + jy - up]], { w: Math.max(0.8, r * 0.3), color: m.col, seed: m.id, b, amp: 0.4 });
            }
          }
        }, 1);
        if (k % 2 === 0) {
          const rz = I.depth(c, [ex * 1.8 * Math.cos(am), roofY, ez * 1.8 * Math.sin(am)]);
          D.add(rz, () => {
            I.line3(ctx, c, [[ex * 1.8 * Math.cos(a0), roofY, ez * 1.8 * Math.sin(a0)], [ex * 1.8 * Math.cos(a1 + TAU / SEC), roofY, ez * 1.8 * Math.sin(a1 + TAU / SEC)]], { ww: 0.5, seed: 600 + k, b, wmin: 1, wmax: 7 });
          }, 1);
        }
      }
      towers.forEach((tw, i) => {
        const z = I.depth(c, tw.top);
        D.add(z, () => {
          for (const sg of [-1, 1]) I.line3(ctx, c, [V.add(tw.base, V.mul(tw.side, sg * 1.6)), V.add(tw.top, V.mul(tw.side, sg * 0.6))], { ww: 0.5, seed: 700 + i * 2 + sg, b, wmin: 1, wmax: 8 });
          for (let h = 6; h < 62; h += 7) I.line3(ctx, c, [V.add([tw.base[0], h, tw.base[2]], V.mul(tw.side, -1.4)), V.add([tw.base[0], h + 7, tw.base[2]], V.mul(tw.side, 1.4))], { ww: 0.18, seed: 720 + i * 20 + h, b, wmin: 0.6, wmax: 3, alpha: 0.7 });
          const bank = [V.add(tw.top, V.mul(tw.side, -6)), V.add(tw.top, V.mul(tw.side, 6)), V.add(V.add(tw.top, V.mul(tw.side, 6)), [0, 6, 0]), V.add(V.add(tw.top, V.mul(tw.side, -6)), [0, 6, 0])];
          const on = I.clamp(lights * 4 - i, 0, 1);
          I.poly3(ctx, c, bank, { fill: on > 0.5 ? C.yellow : C.paper2, w: 2, seed: 760 + i, b });
          for (let gx = -4; gx <= 4; gx += 4) for (let gy = 1.5; gy <= 4.5; gy += 3) {
            const p = V.add(V.add(tw.top, V.mul(tw.side, gx)), [0, gy, 0]);
            I.disc3(ctx, c, p, 0.9, { fill: on > 0.5 ? C.white : C.paper3, seed: 780 + i * 9 + gx + gy, b, min: 0.8, max: 30, w: 1 });
          }
        }, 1);
      });
      if (kind === 'cricket') {
        for (const sg of [-1, 1]) {
          const zc = sg * ez * 1.04;
          D.add(I.depth(c, [0, 4, zc]), () => I.poly3(ctx, c, [[-7, 0, zc], [7, 0, zc], [7, 8, zc], [-7, 8, zc]], { fill: C.white, w: 2, seed: 800 + sg, b }), 1);
        }
        if (s.board) {
          const a = s.boardA ?? 2.55, sc = 1.5;
          const p0 = [ex * sc * Math.cos(a), 22, ez * sc * Math.sin(a)];
          const inward = V.norm([-p0[0], 0, -p0[2]]), side = [-inward[2], 0, inward[0]];
          const tl = V.add(V.add(p0, V.mul(side, -11)), [0, 7, 0]), tr = V.add(V.add(p0, V.mul(side, 11)), [0, 7, 0]);
          const bl = V.add(V.add(p0, V.mul(side, -11)), [0, -5, 0]), br = V.add(V.add(p0, V.mul(side, 11)), [0, -5, 0]);
          D.add(I.depth(c, p0) - 2, () => {
            const q = [tl, tr, br, bl].map((p) => I.proj(c, p));
            if (q.some((p) => !p)) return;
            I.stroke(ctx, q, { closed: true, fill: C.ink, w: 2, seed: 820, b });
            const w = 440, h = 240;
            const ax = (q[1][0] - q[0][0]) / w, ay = (q[1][1] - q[0][1]) / w, bx = (q[3][0] - q[0][0]) / h, by = (q[3][1] - q[0][1]) / h;
            if (Math.abs(ax * by - ay * bx) < 1e-4) return;
            ctx.save();
            ctx.setTransform(ax, ay, bx, by, q[0][0], q[0][1]);
            I.text(ctx, s.board[0], w / 2, 128, { size: 118, color: C.yellow });
            I.text(ctx, s.board[1], w / 2, 205, { size: 52, color: C.white, font: "'Apple Garamond'" });
            ctx.restore();
          }, 1);
        }
      }
    }
    return { draw, ex, ez, towers, st };
  }

  function city(o = {}) {
    const R = I.rng(o.seed || 11), boxes = [];
    for (let gx = -14; gx <= 14; gx++) for (let gz = -14; gz <= 14; gz++) {
      const x = gx * 62 + (R() - 0.5) * 18, z = gz * 62 + (R() - 0.5) * 18;
      const d = Math.hypot(x, z * 0.9);
      if (d < (o.clear ?? 190) || d > 900 || R() < 0.25) continue;
      const w = 18 + R() * 26, dd = 18 + R() * 26, h = 8 + R() * (d < 350 ? 70 : 34) * (R() < 0.15 ? 2 : 1);
      boxes.push({ x, z, w, d: dd, h, id: boxes.length, win: R() < 0.55, tv: R() < 0.3 });
    }
    function draw(D, ctx, c, t, b, s = {}) {
      D.add(0, () => {
        for (let k = -14; k <= 14; k += 2) {
          I.line3(ctx, c, [[k * 62 + 31, 0, -900], [k * 62 + 31, 0, 900]], { ww: 1.2, color: C.paper3, seed: 900 + k, b, wmin: 0.6, wmax: 5, alpha: 0.9 });
          I.line3(ctx, c, [[-900, 0, k * 62 + 31], [900, 0, k * 62 + 31]], { ww: 1.2, color: C.paper3, seed: 950 + k, b, wmin: 0.6, wmax: 5, alpha: 0.9 });
        }
      }, -1);
      for (const bx of boxes) {
        const ctr = [bx.x, bx.h / 2, bx.z], z = I.depth(c, ctr);
        if (z < 1 || z > 2400) continue;
        D.add(z, () => {
          const x0 = bx.x - bx.w / 2, x1 = bx.x + bx.w / 2, z0 = bx.z - bx.d / 2, z1 = bx.z + bx.d / 2, h = bx.h;
          const faces = [
            [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0], [0, 0, -1]],
            [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1], [0, 0, 1]],
            [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1], [-1, 0, 0]],
            [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0], [1, 0, 0]],
          ];
          for (const f of faces) {
            const n = f[4], mid = V.lerp(f[0], f[2], 0.5);
            if (V.dot(n, V.sub(c.pos, mid)) <= 0) continue;
            const shade = n[0] ? C.paper2 : C.paper3;
            I.poly3(ctx, c, f.slice(0, 4), { fill: shade, w: I.clamp((0.5 * c.foc) / z, 0.8, 2.6), seed: 1000 + bx.id * 5 + n[0] + n[2] * 2, b, amp: 0.8 });
            if (bx.win && z < 900) {
              const cols = Math.max(1, Math.floor(bx.w / 9)), rows = Math.max(1, Math.floor(h / 9));
              for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
                const hh = I.hash(bx.id, i * 31 + j, n[0] + n[2] * 3);
                if (hh > 0.4) continue;
                const u = (i + 0.5) / cols, v = (j + 0.6) / (rows + 0.2);
                const p = V.add(V.lerp(V.lerp(f[0], f[1], u), V.lerp(f[3], f[2], u), v), V.mul(n, 0.2));
                let col = C.yellow;
                if (s.tvs && bx.tv && hh < 0.12) col = s.tvs(bx.id * 7 + i + j) || col;
                I.disc3(ctx, c, p, 1.6, { fill: col, w: 0, min: 0.6, max: 14, seed: bx.id + i + j, b });
              }
            }
          }
          const top = [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]];
          if (c.pos[1] > h) I.poly3(ctx, c, top, { fill: C.paper, w: I.clamp((0.5 * c.foc) / z, 0.8, 2.6), seed: 1000 + bx.id * 5 + 4, b, amp: 0.8 });
        }, 1);
      }
    }
    return { draw, boxes };
  }

  function rain(ctx, t, amt, o = {}) {
    if (amt <= 0) return;
    const n = Math.floor(520 * amt), ang = o.ang ?? 0.22, L = o.len ?? 46;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sp = 1500 + I.hash(i, 7) * 900;
      const x = (I.hash(i, 1) * (I.W + 400) - 200 + t * sp * Math.sin(ang) * 0.4) % (I.W + 400);
      const y = ((I.hash(i, 2) * (I.H + 200) + t * sp) % (I.H + 200)) - 100;
      ctx.globalAlpha = 0.25 + I.hash(i, 3) * 0.35;
      ctx.strokeStyle = i % 5 === 0 ? C.cobalt : C.ink;
      ctx.lineWidth = 1 + I.hash(i, 4) * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(ang) * L, y - Math.cos(ang) * L);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function burst3(ctx, c, ctr, u, col, seed, b, o = {}) {
    if (u <= 0 || u >= 1) return;
    const n = o.n || 18, R = (o.r || 30) * I.E.outExpo(Math.min(1, u * 1.6));
    const fade = 1 - I.ramp(u, 0.55, 1, I.E.in2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * I.TAU + I.hash(seed, i) * 0.3, el = (I.hash(seed, i, 2) - 0.3) * 1.4;
      const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const rr = R * (0.35 + 0.65 * (k / 5));
        pts.push(V.add(ctr, [dir[0] * rr, dir[1] * rr - u * u * (o.drop ?? 16) * (k / 5), dir[2] * rr]));
      }
      I.line3(ctx, c, pts, { ww: o.ww || 0.5, color: i % 3 === 0 ? (o.col2 || C.ink) : col, seed: seed * 50 + i, b, wmin: 1, wmax: 7, alpha: fade });
    }
  }

  function burst2(ctx, x, y, u, cols, seed, b, o = {}) {
    if (u <= 0 || u >= 1) return;
    const n = o.n || 16, R = (o.r || 140) * I.E.outExpo(Math.min(1, u * 1.5));
    const fade = 1 - I.ramp(u, 0.5, 1, I.E.in2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * I.TAU + I.hash(seed, i) * 0.4, rr = R * (0.7 + I.hash(seed, i, 1) * 0.5);
      const x0 = x + Math.cos(a) * rr * 0.45, y0 = y + Math.sin(a) * rr * 0.45;
      const x1 = x + Math.cos(a) * rr, y1 = y + Math.sin(a) * rr + u * u * (o.drop ?? 60);
      I.stroke(ctx, [[x0, y0], [(x0 + x1) / 2 + Math.sin(a) * 8, (y0 + y1) / 2], [x1, y1]], { w: o.w || 5, color: cols[i % cols.length], seed: seed * 40 + i, b, alpha: fade });
    }
  }

  function goal(D, ctx, c, zc, dir, b, bulge = 0, hit = [0, 1.6]) {
    const w = 3.66, h = 2.44, depthN = 2.2;
    const P = (x, y, d) => {
      let bz = 0;
      if (bulge) {
        const dx = x - hit[0], dy = y - hit[1];
        bz = bulge * Math.exp(-(dx * dx + dy * dy) / 1.2) * (d > 0 ? 1 : 0.4);
      }
      return [x, y, zc + dir * (d + bz)];
    };
    D.add(I.depth(c, [0, 1.2, zc + dir * 1.5]), () => {
      for (let i = 0; i <= 12; i++) {
        const x = -w + (2 * w * i) / 12;
        I.line3(ctx, c, [P(x, h, 0), P(x, h, depthN * 0.6), P(x, h * 0.55, depthN), P(x, 0, depthN)], { ww: 0.025, color: C.grey, seed: 1200 + i, b, wmin: 0.6, wmax: 2, amp: 0.4 });
      }
      for (let j = 0; j <= 6; j++) {
        const y = (h * j) / 6, d = j / 6 > 0.55 ? depthN * (1 - ((y / h - 0.55) / 0.45) * 0.4) : depthN;
        const row = [];
        for (let i = 0; i <= 12; i++) row.push(P(-w + (2 * w * i) / 12, y, d));
        I.line3(ctx, c, row, { ww: 0.025, color: C.grey, seed: 1300 + j, b, wmin: 0.6, wmax: 2, amp: 0.4 });
      }
      I.line3(ctx, c, [[-w, 0, zc], [-w, h, zc], [w, h, zc], [w, 0, zc]], { ww: 0.12, tube: C.white, seed: 1400, b, wmin: 2 });
    }, 1);
  }

  function trophy(ctx, cx, cy, sc, rot, b, o = {}) {
    const prof = [[0, 0], [0.55, 0], [0.5, 0.08], [0.18, 0.18], [0.14, 0.5], [0.2, 0.62], [0.62, 0.95], [0.72, 1.35], [0.66, 1.4]];
    const ring = (r, y, n = 28) => {
      const p = [];
      for (let i = 0; i <= n; i++) {
        const a = rot + (i / n) * I.TAU;
        p.push([cx + Math.cos(a) * r * sc, cy - y * sc + Math.sin(a) * r * sc * 0.22]);
      }
      return p;
    };
    const left = prof.map(([r, y]) => [cx - r * sc, cy - y * sc]), right = prof.map(([r, y]) => [cx + r * sc, cy - y * sc]).reverse();
    I.stroke(ctx, left.concat(right), { closed: true, fill: o.fill || C.yellow, w: 4, seed: 1500, b, amp: 1.2 });
    for (const [r, y] of [[0.55, 0], [0.18, 0.18], [0.2, 0.62], [0.72, 1.35]]) I.stroke(ctx, ring(r, y), { w: 3, seed: 1510 + y * 10, b, amp: 0.8 });
    for (let k = 0; k < 6; k++) {
      const a = rot + (k / 6) * I.TAU;
      if (Math.sin(a) < 0) continue;
      const pts = prof.slice(4).map(([r, y]) => [cx + Math.cos(a) * r * sc, cy - y * sc + Math.sin(a) * r * sc * 0.22]);
      I.stroke(ctx, pts, { w: 2, seed: 1520 + k, b, alpha: 0.5 });
    }
    for (const sg of [-1, 1]) {
      const hx = cx + sg * 0.68 * sc * Math.abs(Math.cos(rot * 0.5 + 0.3)) * 1.1;
      I.stroke(ctx, [[cx + sg * 0.55 * sc, cy - 1.15 * sc], [hx + sg * 0.25 * sc, cy - 1.12 * sc], [hx + sg * 0.22 * sc, cy - 0.82 * sc], [cx + sg * 0.42 * sc, cy - 0.8 * sc]], { w: 5, seed: 1530 + sg, b });
    }
    if (o.ribbon) I.stroke(ctx, [[cx - 0.17 * sc, cy - 0.4 * sc], [cx + 0.17 * sc, cy - 0.36 * sc]], { w: 0.14 * sc, color: o.ribbon, seed: 1540, b });
  }

  window.WORLD = { stadium, city, rain, burst3, burst2, goal, trophy, ellipse };
})();
