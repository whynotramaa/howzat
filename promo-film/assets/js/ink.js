(function () {
  if (window.INK) return;
  const W = 1920, H = 1080, PI = Math.PI, TAU = PI * 2;
  const C = {
    paper: '#f4f2ec', paper2: '#ebe6da', paper3: '#e0d9c8', ink: '#191917',
    cobalt: '#2557d6', tang: '#f07a2a', grass: '#4a9d5b', grassSoft: '#a9cf9f',
    pink: '#e65b95', yellow: '#f2b632', sky: '#4aa3df', red: '#d8402f',
    willow: '#ead9a8', pitch: '#e6d29f', white: '#fffdf7', skin: '#f3e3cf', grey: '#8d8a82',
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const E = {
    lin: (u) => u,
    in2: (u) => u * u,
    out2: (u) => 1 - (1 - u) * (1 - u),
    io2: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
    in3: (u) => u * u * u,
    out3: (u) => 1 - Math.pow(1 - u, 3),
    io3: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    out4: (u) => 1 - Math.pow(1 - u, 4),
    outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    inExpo: (u) => (u <= 0 ? 0 : Math.pow(2, 10 * u - 10)),
    outBack: (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2),
    spring: (u, z = 0.5, w = 14) => {
      if (u <= 0) return 0;
      if (u >= 1.6) return 1;
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + ((z * w) / wd) * Math.sin(wd * u));
    },
  };
  const ramp = (t, a, b, e = E.io2) => e(clamp((t - a) / (b - a), 0, 1));
  function mix(a, b, u) {
    if (typeof a === 'number') return a + (b - a) * u;
    if (Array.isArray(a)) return a.map((x, i) => mix(x, b[i], u));
    const o = {};
    for (const k in a) o[k] = k in b ? mix(a[k], b[k], u) : a[k];
    for (const k in b) if (!(k in a)) o[k] = b[k];
    return o;
  }
  function key(t, keys, e = E.io2) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1, ee] = keys[i + 1];
      if (t <= t1) return mix(v0, v1, (ee || e)((t - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
  }
  function cr(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3));
  }
  function path(pts, u) {
    u = clamp(u, 0, 1);
    const n = pts.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f));
    return cr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n, i + 2)], f - i);
  }

  function hash(a, b = 0, c = 0) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul((c | 0) + 0x5bd1e995, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i, a = hash(i, seed), b = hash(i + 1, seed);
    return a + (b - a) * f * f * (3 - 2 * f);
  }
  const boil = (t) => Math.floor(t * 12 + 1e-6);

  function wobble(pts, o) {
    const amp = o.amp ?? 1.6, step = o.step ?? 22, seed = (o.seed || 0) * 131 + (o.b || 0) * 7919;
    const P = o.closed ? pts.concat([pts[0]]) : pts;
    const out = [];
    let acc = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const x0 = P[i][0], y0 = P[i][1], dx = P[i + 1][0] - x0, dy = P[i + 1][1] - y0;
      const L = Math.hypot(dx, dy), n = Math.max(1, Math.min(60, Math.ceil(L / step)));
      const nx = L ? -dy / L : 0, ny = L ? dx / L : 0;
      for (let k = 0; k < n; k++) {
        const u = k / n, off = (noise1((acc + L * u) / 55, seed) - 0.5) * 2 * amp;
        out.push([x0 + dx * u + nx * off, y0 + dy * u + ny * off]);
      }
      acc += L;
    }
    const l = P[P.length - 1];
    out.push([l[0] + (hash(seed, 1) - 0.5) * amp, l[1] + (hash(seed, 2) - 0.5) * amp]);
    return out;
  }
  function trace(ctx, q) {
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length - 1; i++) ctx.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    ctx.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
  }
  function stroke(ctx, pts, o = {}) {
    if (!pts || pts.length < 2) return;
    const q = wobble(pts, o);
    trace(ctx, q);
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.w !== 0) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.color || C.ink;
      ctx.lineWidth = o.w ?? 3;
      ctx.stroke();
    }
    if (o.sketch) {
      const q2 = wobble(pts, { ...o, seed: (o.seed || 0) + 977 });
      trace(ctx, q2);
      ctx.globalAlpha = (o.alpha ?? 1) * 0.45;
      ctx.lineWidth = Math.max(1, (o.w ?? 3) * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function tube(ctx, pts, w, fill, o = {}) {
    const ow = o.outline ?? Math.max(1.6, w * 0.14);
    stroke(ctx, pts, { ...o, w: w + ow * 2, color: o.ink || C.ink, sketch: false });
    stroke(ctx, pts, { ...o, w, color: fill, sketch: false });
  }
  function ring(cx, cy, rx, ry = rx, n, a0 = 0) {
    n = n || Math.max(12, Math.min(72, Math.round(Math.max(rx, ry) * 0.5)));
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return p;
  }
  function circle(ctx, x, y, r, o = {}) {
    stroke(ctx, ring(x, y, r), { closed: true, amp: Math.min(o.amp ?? 1.4, r * 0.12), step: Math.max(6, r * 0.35), ...o });
  }
  function dot(ctx, x, y, r, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.4, r), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = o.color || C.ink;
    ctx.font = `${o.weight || 400} ${o.size || 48}px ${o.font || "'Behind The Nineties'"}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.tracking != null) ctx.letterSpacing = o.tracking + 'px';
    if (o.rot) {
      ctx.translate(x, y);
      ctx.rotate(o.rot);
      ctx.fillText(s, 0, 0);
    } else ctx.fillText(s, x, y);
    ctx.restore();
  }
  function paper(ctx, color = C.paper) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }

  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
  };
  function cam(pos, target, fov = 50, roll = 0, shift = [0, 0]) {
    const f = V.norm(V.sub(target, pos));
    let r = V.norm(V.cross(f, [0, 1, 0]));
    let u = V.cross(r, f);
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const r2 = V.add(V.mul(r, c), V.mul(u, s));
      u = V.sub(V.mul(u, c), V.mul(r, s));
      r = r2;
    }
    return { pos, f, r, u, foc: H / 2 / Math.tan((fov * PI) / 360), near: 0.2, cx: W / 2 + shift[0], cy: H / 2 + shift[1] };
  }
  const depth = (c, p) => V.dot(V.sub(p, c.pos), c.f);
  function proj(c, p) {
    const d = V.sub(p, c.pos), z = V.dot(d, c.f);
    if (z < c.near) return null;
    return [c.cx + (V.dot(d, c.r) * c.foc) / z, c.cy - (V.dot(d, c.u) * c.foc) / z, z];
  }
  function clipLine(c, pts) {
    const out = [];
    let cur = [], prev = null, pz = 0;
    for (const p of pts) {
      const z = depth(c, p);
      if (prev) {
        if (z >= c.near && pz < c.near) {
          const u = (c.near - pz) / (z - pz);
          cur = [proj(c, V.lerp(prev, p, u + 1e-4))];
        } else if (z < c.near && pz >= c.near) {
          const u = (c.near - pz) / (z - pz);
          cur.push(proj(c, V.lerp(prev, p, u - 1e-4)));
          if (cur.length > 1) out.push(cur);
          cur = [];
        }
      }
      if (z >= c.near) cur.push(proj(c, p));
      prev = p;
      pz = z;
    }
    if (cur.length > 1) out.push(cur.filter(Boolean));
    return out;
  }
  function offscreen(q, m = 200) {
    let a = 1e9, b = -1e9, cc = 1e9, d = -1e9;
    for (const p of q) {
      if (p[0] < a) a = p[0];
      if (p[0] > b) b = p[0];
      if (p[1] < cc) cc = p[1];
      if (p[1] > d) d = p[1];
    }
    return b < -m || a > W + m || d < -m || cc > H + m;
  }
  function pxw(c, ww, z, o) {
    return clamp((ww * c.foc) / z, o.wmin ?? 0.7, o.wmax ?? 60);
  }
  function line3(ctx, c, pts, o = {}) {
    for (const q of clipLine(c, o.closed ? pts.concat([pts[0]]) : pts)) {
      if (q.length < 2 || offscreen(q)) continue;
      const z = q.reduce((s, p) => s + p[2], 0) / q.length;
      const w = o.ww ? pxw(c, o.ww, z, o) : o.w ?? 2.4;
      if (o.tube) tube(ctx, q, w, o.tube, { ...o, closed: false });
      else stroke(ctx, q, { ...o, w, closed: false, amp: o.amp ?? Math.min(2.2, 0.6 + w * 0.25) });
    }
  }
  function poly3(ctx, c, pts, o = {}) {
    const q = [];
    for (const p of pts) {
      const s = proj(c, p);
      if (!s) return;
      q.push(s);
    }
    if (offscreen(q)) return;
    stroke(ctx, q, { closed: true, amp: 1.2, ...o });
  }
  function disc3(ctx, c, p, r, o = {}) {
    const s = proj(c, p);
    if (!s) return null;
    const pr = clamp((r * c.foc) / s[2], o.min ?? 0.5, o.max ?? 400);
    if (s[0] < -pr - 50 || s[0] > W + pr + 50 || s[1] < -pr - 50 || s[1] > H + pr + 50) return s;
    if (pr < 3) dot(ctx, s[0], s[1], pr, o.fill || o.color || C.ink, o.alpha ?? 1);
    else circle(ctx, s[0], s[1], pr, { w: o.w ?? Math.max(1.4, pr * 0.12), ...o });
    return [s[0], s[1], s[2], pr];
  }
  function List() {
    const a = [];
    return {
      add(z, fn, layer = 1) {
        a.push([layer, z, fn]);
      },
      flush() {
        a.sort((p, q) => p[0] - q[0] || q[1] - p[1]);
        for (const it of a) it[2]();
        a.length = 0;
      },
    };
  }

  const BASE = {
    pel: [0, 1.0, 0], chs: [0, 1.45, 0], hed: [0, 1.72, 0],
    lsh: [-0.21, 1.47, 0], lel: [-0.26, 1.19, 0.02], lha: [-0.27, 0.93, 0.06],
    rsh: [0.21, 1.47, 0], rel: [0.26, 1.19, 0.02], rha: [0.27, 0.93, 0.06],
    lhp: [-0.11, 0.98, 0], lkn: [-0.12, 0.53, 0.04], lft: [-0.13, 0.05, 0.08],
    rhp: [0.11, 0.98, 0], rkn: [0.12, 0.53, 0.04], rft: [0.13, 0.05, 0.08],
  };
  const pose = (over) => Object.assign({}, BASE, over);
  function toWorld(f, j) {
    const c = Math.cos(f.yaw || 0), s = Math.sin(f.yaw || 0), k = f.s || 1;
    const x = j[0] * k, y = j[1] * k, z = j[2] * k;
    return [f.pos[0] + x * c + z * s, f.pos[1] + y, f.pos[2] - x * s + z * c];
  }
  function figure3(D, ctx, c, f) {
    const P = {};
    for (const k in f.pose) P[k] = toWorld(f, f.pose[k]);
    const kit = f.kit || {};
    const seed = f.seed || 1, b = f.b || 0;
    const part = (pts, ww, fill, id) => {
      const z = pts.reduce((s, p) => s + depth(c, p), 0) / pts.length;
      D.add(z, () => line3(ctx, c, pts, { ww: ww * (f.s || 1), tube: fill, seed: seed * 40 + id, b, wmin: 1.2 }), f.layer ?? 1);
    };
    part([P.lhp, P.lkn, P.lft], 0.16, kit.pants || C.white, 1);
    part([P.rhp, P.rkn, P.rft], 0.16, kit.pants || C.white, 2);
    if (kit.pads) {
      part([V.lerp(P.lkn, P.lhp, 0.25), V.lerp(P.lkn, P.lft, 0.85)], 0.2, C.white, 3);
      part([V.lerp(P.rkn, P.rhp, 0.25), V.lerp(P.rkn, P.rft, 0.85)], 0.2, C.white, 4);
    }
    const tz = (depth(c, P.chs) + depth(c, P.pel)) / 2;
    D.add(tz, () => {
      const q = [P.lsh, P.rsh, P.rhp, P.lhp].map((p) => proj(c, p));
      if (q.some((p) => !p)) return;
      stroke(ctx, q, { closed: true, fill: kit.shirt || C.sky, w: clamp((0.035 * c.foc) / tz, 1.4, 7), seed: seed * 40 + 5, b, amp: 1 });
      if (kit.stripe) {
        const m1 = proj(c, V.lerp(P.lsh, P.rsh, 0.5)), m2 = proj(c, V.lerp(P.lhp, P.rhp, 0.5));
        if (m1 && m2) stroke(ctx, [m1, m2], { w: clamp((0.06 * c.foc) / tz, 1, 10), color: kit.stripe, seed: seed * 40 + 6, b });
      }
    }, f.layer ?? 1);
    part([P.lsh, P.lel, P.lha], 0.11, kit.shirt || C.sky, 7);
    part([P.rsh, P.rel, P.rha], 0.11, kit.shirt || C.sky, 8);
    if (f.bat) {
      const g = V.lerp(P.lha, P.rha, 0.5), tip = toWorld(f, f.bat), dir = V.norm(V.sub(tip, g));
      const h = V.add(g, V.mul(dir, 0.28 * (f.s || 1)));
      part([V.sub(g, V.mul(dir, 0.08)), h], 0.045, C.ink, 9);
      part([h, tip], 0.12, C.willow, 10);
    }
    for (const [j, id] of [['lha', 11], ['rha', 12]]) {
      D.add(depth(c, P[j]) - 0.01, () => disc3(ctx, c, P[j], 0.06 * (f.s || 1), { fill: kit.gloves || C.skin, seed: seed * 40 + id, b, min: 1.2 }), f.layer ?? 1);
    }
    const hz = depth(c, P.hed);
    D.add(hz - 0.05, () => {
      const neck = [V.lerp(P.chs, P.hed, 0.2), V.lerp(P.chs, P.hed, 0.6)];
      line3(ctx, c, neck, { ww: 0.07 * (f.s || 1), tube: C.skin, seed: seed * 40 + 13, b, wmin: 1 });
      const d = disc3(ctx, c, P.hed, 0.135 * (f.s || 1), { fill: C.skin, seed: seed * 40 + 14, b, min: 1.5 });
      if (!d || d[3] < 2.5) return;
      const [x, y, , r] = d;
      if (kit.helmet || kit.cap) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - r * 1.4, y - r * 1.6, r * 2.8, r * (kit.cap ? 1.25 : 1.5));
        ctx.clip();
        circle(ctx, x, y - r * 0.08, r * 1.05, { fill: kit.helmet || kit.cap, w: Math.max(1.2, r * 0.12), seed: seed * 40 + 15, b });
        ctx.restore();
      }
      const fwd = V.sub(toWorld(f, V.add(f.pose.hed, [0, 0, 0.3])), P.hed);
      const facing = V.dot(V.norm(fwd), c.f);
      if (facing < 0.25 && r > 5) {
        const side = toWorld(f, V.add(f.pose.hed, [0.055, 0.015, 0.12]));
        const side2 = toWorld(f, V.add(f.pose.hed, [-0.055, 0.015, 0.12]));
        for (const e of [side, side2]) {
          const s = proj(c, e);
          if (s) dot(ctx, s[0], s[1], Math.max(1.2, r * 0.11), C.ink);
        }
        if (kit.helmet) {
          const g1 = proj(c, toWorld(f, V.add(f.pose.hed, [-0.1, -0.05, 0.15]))), g2 = proj(c, toWorld(f, V.add(f.pose.hed, [0.1, -0.05, 0.15])));
          if (g1 && g2) stroke(ctx, [g1, g2], { w: Math.max(1, r * 0.1), seed: seed * 40 + 16, b });
        }
      }
    }, f.layer ?? 1);
    return P;
  }

  const fonts = () =>
    Promise.all([
      document.fonts.load("400 80px 'Behind The Nineties'"),
      document.fonts.load("400 40px 'Apple Garamond'"),
      document.fonts.load("300 40px 'Apple Garamond'"),
    ]).catch(() => null);

  function scene(id, start, dur, draw) {
    const cv = document.getElementById(id + '-cv');
    const ctx = cv.getContext('2d');
    let ready = false;
    const fp = fonts().then(() => (ready = true));
    let lastT = -1;
    function at(time) {
      const t = time - start;
      if (t < -0.001 || t > dur + 0.05) return;
      lastT = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      draw(ctx, Math.max(0, t), boil(Math.max(0, t) + start));
    }
    window.addEventListener('hf-seek', (e) => {
      if (ready) at(e.detail.time);
      else e.detail.waitUntil(fp.then(() => at(e.detail.time)));
    });
    fp.then(() => {
      if (lastT < 0) at(start);
    });
    const tl = gsap.timeline({ paused: true });
    tl.to({}, { duration: dur }, 0);
    return tl;
  }

  window.INK = { W, H, PI, TAU, C, E, clamp, lerp, ramp, key, mix, path, hash, rng, noise1, boil, wobble, stroke, tube, ring, circle, dot, text, paper, V, cam, proj, depth, clipLine, line3, poly3, disc3, List, BASE, pose, toWorld, figure3, scene, fonts };
})();
