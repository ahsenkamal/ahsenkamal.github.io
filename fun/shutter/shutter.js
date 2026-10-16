(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Camera + world constants. Distances are in metres, the scene is drawn in a
  // 960x540 logical frame on a 36mm-wide (full frame) sensor.
  // ---------------------------------------------------------------------------

  var W = 960;
  var H = 540;
  var HORIZON = H * 0.44;
  var CAM_H = 1.0;
  var SENSOR = 36;
  var COC_LIMIT = 0.03;
  var FAR = 1e12;
  var STATIC_X = 0;

  var APERTURES = [1.4, 1.8, 2, 2.8, 3.5, 4, 5.6, 8, 11, 16, 22];
  var SHUTTERS = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
  var ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
  var FOCUS_MIN = 0.5;
  var FOCUS_MAX = 200;

  var TIMES = {
    noon: {
      label: "Noon", ev: 14, tint: [1, 1, 1], fog: "#cfe2e4", fogDist: 260,
      skyTop: "#73afd9", skyBot: "#d6ecf1",
      sun: { az: -0.5, el: 0.62, r: 0.03, color: "255,250,228", glow: 0.55 },
      rays: 0.1, clouds: 0.45, specks: 0.75, fireflies: 0, stars: 0
    },
    golden: {
      label: "Golden hour", ev: 11, tint: [1.12, 0.86, 0.64], fog: "#f2c48f", fogDist: 190,
      skyTop: "#eea36e", skyBot: "#fde1ab",
      sun: { az: -0.75, el: 0.16, r: 0.035, color: "255,236,186", glow: 0.9 },
      rays: 0.22, clouds: 0.3, specks: 1, fireflies: 0, stars: 0
    },
    overcast: {
      label: "Overcast", ev: 12, tint: [0.84, 0.88, 0.9], fog: "#c2c8cb", fogDist: 105,
      skyTop: "#a2abb1", skyBot: "#d2d6d7",
      sun: null, rays: 0, clouds: 1, specks: 0, fireflies: 0, stars: 0
    },
    dusk: {
      label: "Dusk", ev: 7, tint: [0.6, 0.54, 0.76], fog: "#7b6e98", fogDist: 150,
      skyTop: "#2b376c", skyBot: "#e39780",
      sun: { az: -0.3, el: -0.05, r: 0.035, color: "255,170,130", glow: 0.7, hidden: true },
      rays: 0, clouds: 0.35, specks: 0, fireflies: 0.55, stars: 0.35
    },
    night: {
      label: "Night", ev: 0, tint: [0.34, 0.42, 0.66], fog: "#222d52", fogDist: 170,
      skyTop: "#050a1d", skyBot: "#1d2a52",
      sun: null, moon: { az: 0.42, el: 0.3, r: 0.028 },
      rays: 0, clouds: 0.25, specks: 0, fireflies: 1, stars: 1
    }
  };

  var C = {
    grass: "#83b05e", grassDark: "#6a9a4c", grassNear: "#5c8c43",
    dirt: "#d3b07a", dirtDark: "#b8945f", pebble: "#e6d2a8",
    leaf: "#3f8a57", leafLight: "#5ea86d", leaf2: "#4f9a50", leaf2Light: "#73b766",
    pine: "#2f6e4f", pineLight: "#468a63", pine2: "#2c6655", pine2Light: "#3f806c",
    trunk: "#6e4c36", trunkLight: "#8a6446",
    bush: "#4a9259", bushLight: "#69ad72",
    hillA: "#8db193", hillB: "#77a07f",
    rock: "#9a968a", rockLight: "#b9b5a8",
    fern: "#3d8a4a", fernLight: "#5cab5f",
    flower: "#f2d16b", flower2: "#ee8c6c",
    skin: "#eab48b", skinDark: "#d39a72",
    shirt: "#a84e37", shirtDark: "#8b3f2c",
    shorts: "#2b2a26", hair: "#26231f",
    shoe: "#f4efe4", shoeDark: "#d6cfc0"
  };

  var DEFAULTS = {
    apIdx: 6, shIdx: 3, isoIdx: 0, focal: 35, focus: 8, speed: 5,
    tod: "noon", pan: false
  };

  var state = {
    apIdx: DEFAULTS.apIdx, shIdx: DEFAULTS.shIdx, isoIdx: DEFAULTS.isoIdx,
    focal: DEFAULTS.focal, focus: DEFAULTS.focus, speed: DEFAULTS.speed,
    tod: DEFAULTS.tod, pan: DEFAULTS.pan,
    playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    hist: true, zebra: false, grid: false
  };

  var sim = { t: 0, dist: 0, phase: 0 };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mod(a, n) { return ((a % n) + n) % n; }

  function hash(i, k) {
    var h = Math.imul(i | 0, 374761393) ^ Math.imul((k | 0) + 1013, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  var rgbCache = {};
  function hexRgb(h) {
    var c = rgbCache[h];
    if (!c) {
      var n = parseInt(h.slice(1), 16);
      c = rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c;
  }

  // Base colour -> lit by the time of day -> faded into atmospheric haze by distance.
  var colCache = {};
  function col(h, z) {
    var key = state.tod + h + z;
    var out = colCache[key];
    if (out) return out;
    var T = TIMES[state.tod];
    var c = hexRgb(h);
    var f = hexRgb(T.fog);
    var a = z === Infinity ? 1 : 1 - Math.exp(-z / T.fogDist);
    var r = [];
    for (var i = 0; i < 3; i++) {
      r[i] = Math.round(Math.min(255, c[i] * T.tint[i]) * (1 - a) + f[i] * a);
    }
    out = "rgb(" + r.join(",") + ")";
    colCache[key] = out;
    return out;
  }

  function aperture() { return APERTURES[state.apIdx]; }
  function shutter() { return SHUTTERS[state.shIdx]; }
  function iso() { return ISOS[state.isoIdx]; }
  function cadence() { return 1 + 0.09 * state.speed; }

  function fmtShutter(t) {
    return t >= 1 ? t + "″" : "1/" + Math.round(1 / t);
  }

  function fmtDist(d) {
    if (!isFinite(d)) return "∞";
    if (d < 10) return d.toFixed(1) + " m";
    if (d < 1000) return Math.round(d) + " m";
    return (d / 1000).toFixed(1) + " km";
  }

  // ---------------------------------------------------------------------------
  // Optics
  // ---------------------------------------------------------------------------

  function focusMm() { return isFinite(state.focus) ? state.focus * 1000 : FAR; }

  // Circle of confusion on the sensor (mm) for an object at z metres.
  function cocMm(z) {
    var f = state.focal;
    var A = f / aperture();
    var S = focusMm();
    var D = isFinite(z) ? z * 1000 : FAR;
    return A * f * Math.abs(S - D) / (D * (S - f));
  }

  function cocPx(z) { return cocMm(z) / SENSOR * W; }
  function sigmaOf(z) { return Math.min(46, cocPx(z) * 0.42); }

  function dofLimits() {
    var f = state.focal;
    var N = aperture();
    var Hd = f * f / (N * COC_LIMIT) + f;
    var S = focusMm();
    if (S >= FAR) return { near: Hd / 1000, far: Infinity };
    var near = S * (Hd - f) / (Hd + S - 2 * f);
    var far = S >= Hd ? Infinity : S * (Hd - f) / (Hd - S);
    return { near: near / 1000, far: far === Infinity ? Infinity : far / 1000 };
  }

  function cameraEv() {
    var N = aperture();
    return Math.log2(N * N / shutter()) - Math.log2(iso() / 100);
  }

  function exposureOffset() { return TIMES[state.tod].ev - cameraEv(); }

  // ---------------------------------------------------------------------------
  // Projection. V holds the current view: screen x/y are logical pixels.
  // ---------------------------------------------------------------------------

  var V = { fpx: 1, camX: 0, t: 0, sx0: 0, sx1: W, sy0: 0, sy1: H };

  function gy(s) { return HORIZON + CAM_H * s; }
  function sx(x, s) { return W / 2 + (x - V.camX) * s; }
  function sy(y, s) { return HORIZON + (CAM_H - y) * s; }

  function cellRange(s, cell, margin) {
    var a = V.camX + (V.sx0 - W / 2) / s - margin;
    var b = V.camX + (V.sx1 - W / 2) / s + margin;
    return [Math.floor(a / cell), Math.ceil(b / cell)];
  }

  function skyPos(az, el) {
    return { x: W / 2 + Math.tan(az) * V.fpx, y: HORIZON - Math.tan(el) * V.fpx };
  }

  // ---------------------------------------------------------------------------
  // Shape primitives
  // ---------------------------------------------------------------------------

  function tri(ctx, ax, ay, bx, by, cx, cy, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }

  function disc(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function halfLeft(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  function groundFill(ctx, s, color) {
    var top = gy(s);
    ctx.fillStyle = color;
    ctx.fillRect(V.sx0, top, V.sx1 - V.sx0, V.sy1 - top);
  }

  function pineAt(ctx, bx, by, hp, z, alt) {
    var tw = hp * 0.07;
    ctx.fillStyle = col(C.trunk, z);
    ctx.fillRect(bx - tw / 2, by - hp * 0.25, tw, hp * 0.25);
    var dark = col(alt ? C.pine2 : C.pine, z);
    var light = col(alt ? C.pine2Light : C.pineLight, z);
    for (var k = 0; k < 3; k++) {
      var b = by - hp * (0.14 + k * 0.25);
      var top = k === 2 ? by - hp : by - hp * (0.56 + k * 0.22);
      var hw = hp * (0.3 - k * 0.065);
      tri(ctx, bx, top, bx - hw, b, bx + hw, b, dark);
      tri(ctx, bx, top, bx - hw, b, bx, b, light);
    }
  }

  function roundAt(ctx, bx, by, hp, z, alt) {
    var tw = hp * 0.075;
    ctx.fillStyle = col(C.trunk, z);
    ctx.fillRect(bx - tw / 2, by - hp * 0.62, tw, hp * 0.62);
    ctx.fillStyle = col(C.trunkLight, z);
    ctx.fillRect(bx - tw / 2, by - hp * 0.62, tw * 0.4, hp * 0.62);
    var dark = col(alt ? C.leaf2 : C.leaf, z);
    var light = col(alt ? C.leaf2Light : C.leafLight, z);
    var r = hp * 0.27;
    var cy = by - hp + r;
    disc(ctx, bx + r * 0.6, cy + r * 0.62, r * 0.7, dark);
    disc(ctx, bx - r * 0.55, cy + r * 0.72, r * 0.62, dark);
    disc(ctx, bx, cy, r, dark);
    halfLeft(ctx, bx, cy, r, light);
    halfLeft(ctx, bx - r * 0.55, cy + r * 0.72, r * 0.62, light);
  }

  function bigTreeAt(ctx, bx, by, hp, tw, z, alt) {
    var trunkTop = by - hp * 0.8;
    ctx.fillStyle = col(C.trunk, z);
    ctx.fillRect(bx - tw / 2, trunkTop, tw, by - trunkTop);
    tri(ctx, bx - tw * 0.5, by - tw * 0.9, bx - tw * 1.05, by + 1, bx - tw * 0.5, by + 1, col(C.trunk, z));
    tri(ctx, bx + tw * 0.5, by - tw * 0.9, bx + tw * 1.05, by + 1, bx + tw * 0.5, by + 1, col(C.trunk, z));
    ctx.fillStyle = col(C.trunkLight, z);
    ctx.fillRect(bx - tw / 2, trunkTop, tw * 0.36, by - trunkTop);
    // a branch
    ctx.strokeStyle = col(C.trunk, z);
    ctx.lineWidth = tw * 0.28;
    ctx.lineCap = "round";
    ctx.beginPath();
    var side = alt ? 1 : -1;
    ctx.moveTo(bx, by - hp * 0.55);
    ctx.lineTo(bx + side * tw * 2.4, by - hp * 0.7);
    ctx.stroke();
    var dark = col(alt ? C.leaf2 : C.leaf, z);
    var light = col(alt ? C.leaf2Light : C.leafLight, z);
    var r = hp * 0.2;
    var top = by - hp;
    disc(ctx, bx - r * 0.95, top + r * 1.7, r * 0.8, dark);
    disc(ctx, bx + r * 1.0, top + r * 1.55, r * 0.85, dark);
    disc(ctx, bx + side * tw * 2.4, by - hp * 0.7, r * 0.45, dark);
    disc(ctx, bx, top + r, r, dark);
    halfLeft(ctx, bx, top + r, r, light);
    halfLeft(ctx, bx - r * 0.95, top + r * 1.7, r * 0.8, light);
    halfLeft(ctx, bx + side * tw * 2.4, by - hp * 0.7, r * 0.45, light);
  }

  function bushAt(ctx, bx, by, r, z) {
    ctx.fillStyle = col(C.bush, z);
    ctx.beginPath();
    ctx.arc(bx, by, r, Math.PI, 0);
    ctx.arc(bx + r * 0.75, by, r * 0.6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = col(C.bushLight, z);
    ctx.beginPath();
    ctx.arc(bx, by, r, Math.PI, Math.PI * 1.5);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fill();
  }

  function treeRow(ctx, s, z, o) {
    var r = cellRange(s, o.cell, o.hMax * 0.5);
    var by = gy(s);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, o.seed) > o.presence) continue;
      var x = (i + 0.15 + 0.7 * hash(i, o.seed + 1)) * o.cell;
      var h = o.hMin + (o.hMax - o.hMin) * hash(i, o.seed + 2);
      var alt = hash(i, o.seed + 4) < 0.5;
      if (hash(i, o.seed + 3) < o.pine) pineAt(ctx, sx(x, s), by, h * s, z, alt);
      else roundAt(ctx, sx(x, s), by, h * s, z, alt);
    }
  }

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------

  var STARS = [];
  for (var si = 0; si < 160; si++) {
    STARS.push({ az: (hash(si, 501) - 0.5) * 2.6, el: 0.03 + hash(si, 502) * 1.0, b: 0.35 + 0.65 * hash(si, 503) });
  }

  function drawSky(ctx) {
    var T = TIMES[state.tod];
    var top = HORIZON - V.fpx * 0.7;
    var g = ctx.createLinearGradient(0, top, 0, HORIZON);
    g.addColorStop(0, T.skyTop);
    g.addColorStop(1, T.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(V.sx0, V.sy0, V.sx1 - V.sx0, V.sy1 - V.sy0);

    if (T.stars) {
      for (var i = 0; i < STARS.length; i++) {
        var st = STARS[i];
        var p = skyPos(st.az, st.el);
        if (p.x < V.sx0 || p.x > V.sx1 || p.y < V.sy0 || p.y > HORIZON) continue;
        var tw = 0.75 + 0.25 * Math.sin(V.t * (1.3 + st.b) + i);
        ctx.fillStyle = "rgba(255,255,240," + (T.stars * st.b * tw).toFixed(3) + ")";
        ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
      }
    }

    if (T.sun) {
      var sp = skyPos(T.sun.az, T.sun.el);
      var gr = V.fpx * 0.5;
      var rg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, gr);
      rg.addColorStop(0, "rgba(" + T.sun.color + "," + T.sun.glow + ")");
      rg.addColorStop(1, "rgba(" + T.sun.color + ",0)");
      ctx.fillStyle = rg;
      ctx.fillRect(sp.x - gr, sp.y - gr, gr * 2, gr * 2);
      if (!T.sun.hidden) disc(ctx, sp.x, sp.y, Math.max(2, V.fpx * T.sun.r), "rgb(" + T.sun.color + ")");
    }

    if (T.moon) {
      var mp = skyPos(T.moon.az, T.moon.el);
      var mr = Math.max(2, V.fpx * T.moon.r);
      disc(ctx, mp.x, mp.y, mr * 5, "rgba(190,205,255,0.06)");
      disc(ctx, mp.x, mp.y, mr * 2.4, "rgba(190,205,255,0.08)");
      disc(ctx, mp.x, mp.y, mr, "#efeedd");
      disc(ctx, mp.x - mr * 0.3, mp.y - mr * 0.2, mr * 0.22, "#dcdac6");
      disc(ctx, mp.x + mr * 0.35, mp.y + mr * 0.3, mr * 0.16, "#dcdac6");
      disc(ctx, mp.x + mr * 0.1, mp.y - mr * 0.5, mr * 0.1, "#dcdac6");
    }
  }

  function drawClouds(ctx, s) {
    var T = TIMES[state.tod];
    if (!T.clouds) return;
    var cell = 650;
    var drift = V.t * 4;
    var color = col(state.tod === "overcast" ? "#eef0f0" : "#ffffff", 70);
    var a = V.camX - drift + (V.sx0 - W / 2) / s - 500;
    var b = V.camX - drift + (V.sx1 - W / 2) / s + 500;
    for (var i = Math.floor(a / cell); i <= Math.ceil(b / cell); i++) {
      if (hash(i, 11) > T.clouds) continue;
      var w = (220 + 260 * hash(i, 14)) * s;
      var x = sx((i + hash(i, 12)) * cell + drift, s);
      var y = sy(380 + 520 * hash(i, 13), s);
      var h = w * 0.13;
      var y0 = y - h;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x - w / 2 + h, y0, h, Math.PI / 2, Math.PI * 1.5);
      ctx.lineTo(x + w / 2 - h, y0 - h);
      ctx.arc(x + w / 2 - h, y0, h, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      disc(ctx, x - w * 0.16, y0 - h * 0.6, h * 1.3, color);
      disc(ctx, x + w * 0.1, y0 - h * 0.9, h * 1.65, color);
    }
  }

  function ridge(x, k) {
    if (k) return 22 + 14 * Math.sin(x / 260 + 2) + 8 * Math.sin(x / 97 + 0.7) + 4 * Math.sin(x / 41);
    return 40 + 20 * Math.sin(x / 210) + 11 * Math.sin(x / 77 + 1.3) + 5 * Math.sin(x / 33 + 0.4);
  }

  function drawHills(ctx, s) {
    for (var k = 0; k < 2; k++) {
      ctx.fillStyle = k ? col(C.hillB, 330) : col(C.hillA, 480);
      ctx.beginPath();
      ctx.moveTo(V.sx0, V.sy1);
      for (var px = V.sx0; px <= V.sx1 + 8; px += 8) {
        var x = V.camX + (px - W / 2) / s;
        ctx.lineTo(px, sy(ridge(x, k), s));
      }
      ctx.lineTo(V.sx1 + 8, V.sy1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawFar(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    treeRow(ctx, s, z, { cell: 2.4, seed: 100, presence: 0.86, hMin: 8, hMax: 15, pine: 0.62 });
  }

  function drawBack(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    treeRow(ctx, s, z, { cell: 4.2, seed: 200, presence: 0.8, hMin: 8, hMax: 13, pine: 0.45 });
  }

  function drawMid(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    var by = gy(s);
    var r = cellRange(s, 7.5, 6);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 300) > 0.75) continue;
      var x = (i + 0.2 + 0.6 * hash(i, 301)) * 7.5;
      var h = 9 + 4 * hash(i, 302);
      var tw = 0.45 + 0.3 * hash(i, 303);
      bigTreeAt(ctx, sx(x, s), by, h * s, tw * s, z, hash(i, 304) < 0.5);
    }
    var rb = cellRange(s, 3.2, 2);
    for (var j = rb[0]; j <= rb[1]; j++) {
      if (hash(j, 310) > 0.55) continue;
      bushAt(ctx, sx((j + hash(j, 311)) * 3.2, s), by + 1, (0.5 + 0.5 * hash(j, 312)) * s, z);
    }
  }

  function tuft(ctx, x, y, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.45, y);
    ctx.lineTo(x - h * 0.3, y - h * 0.7);
    ctx.lineTo(x - h * 0.12, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + h * 0.14, y);
    ctx.lineTo(x + h * 0.34, y - h * 0.75);
    ctx.lineTo(x + h * 0.45, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawPath(ctx, s, z) {
    var fpx = V.fpx;
    var yBack = gy(fpx / 11);
    var yEdge = gy(fpx / 8.8);
    var yFront = gy(fpx / 7.3);
    var x0 = V.sx0;
    var w = V.sx1 - V.sx0;
    ctx.fillStyle = col(C.grass, z);
    ctx.fillRect(x0, yBack, w, yEdge - yBack + 1);
    ctx.fillStyle = col(C.dirt, z);
    ctx.fillRect(x0, yEdge, w, yFront - yEdge + 1);
    ctx.fillStyle = col(C.dirtDark, z);
    ctx.fillRect(x0, yEdge, w, (yFront - yEdge) * 0.14);
    ctx.fillStyle = col(C.grassDark, z);
    ctx.fillRect(x0, yFront, w, V.sy1 - yFront);

    // pebbles on the path
    var sp = fpx / 8;
    var rp = cellRange(sp, 0.7, 0.5);
    for (var p = rp[0]; p <= rp[1]; p++) {
      if (hash(p, 420) > 0.4) continue;
      var py = yEdge + (yFront - yEdge) * (0.3 + 0.6 * hash(p, 421));
      ctx.fillStyle = col(C.pebble, z);
      ctx.fillRect(sx((p + hash(p, 422)) * 0.7, sp), py, 0.06 * sp, 0.03 * sp);
    }

    // back verge: rocks, tufts and flowers
    var s1 = fpx / 9.2;
    var r1 = cellRange(s1, 1.3, 1);
    for (var i = r1[0]; i <= r1[1]; i++) {
      var x = (i + hash(i, 401)) * 1.3;
      var kind = hash(i, 400);
      var bx = sx(x, s1);
      if (kind < 0.18) {
        var rw = (0.25 + 0.25 * hash(i, 402)) * s1;
        ctx.fillStyle = col(C.rock, z);
        ctx.beginPath();
        ctx.ellipse(bx, yEdge, rw, rw * 0.6, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = col(C.rockLight, z);
        ctx.beginPath();
        ctx.ellipse(bx, yEdge, rw, rw * 0.6, 0, Math.PI, Math.PI * 1.5);
        ctx.lineTo(bx, yEdge);
        ctx.fill();
      } else if (kind < 0.6) {
        tuft(ctx, bx, yEdge + 1, (0.18 + 0.12 * hash(i, 403)) * s1, col(C.grassDark, z));
      } else if (kind < 0.75) {
        var fh = (0.22 + 0.1 * hash(i, 404)) * s1;
        ctx.fillStyle = col(C.grassDark, z);
        ctx.fillRect(bx - 0.008 * s1, yEdge - fh, 0.016 * s1 + 0.5, fh);
        disc(ctx, bx, yEdge - fh, 0.045 * s1 + 0.6, col(hash(i, 405) < 0.5 ? C.flower : C.flower2, z));
      }
    }

    // front verge tufts
    var s2 = fpx / 7.2;
    var r2 = cellRange(s2, 0.9, 1);
    for (var j = r2[0]; j <= r2[1]; j++) {
      if (hash(j, 410) > 0.45) continue;
      tuft(ctx, sx((j + hash(j, 411)) * 0.9, s2), yFront + 2, (0.12 + 0.1 * hash(j, 412)) * s2, col(C.grassNear, z));
    }
  }

  function mushroom(ctx, x, y, h, z) {
    ctx.fillStyle = col("#efe6d2", z);
    ctx.fillRect(x - h * 0.12, y - h * 0.75, h * 0.24, h * 0.75);
    ctx.fillStyle = col("#c8543c", z);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.7, h * 0.42, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    disc(ctx, x - h * 0.18, y - h * 0.86, h * 0.07, col("#f6efe0", z));
    disc(ctx, x + h * 0.14, y - h * 0.95, h * 0.06, col("#f6efe0", z));
  }

  // The near meadow between the path and the camera.
  function drawVerge(ctx, s, z) {
    var fpx = V.fpx;
    var bands = [6.6, 5.4, 4.4, 3.6, 3.0];
    for (var b = 0; b < bands.length; b++) {
      var yb = gy(fpx / bands[b]);
      if (yb > V.sy1) break;
      ctx.fillStyle = col(b % 2 ? C.grassDark : C.grassNear, z);
      ctx.fillRect(V.sx0, yb, V.sx1 - V.sx0, V.sy1 - yb);
    }
    var depths = [6.4, 5.6, 4.8];
    for (var d = 0; d < depths.length; d++) {
      var sd = fpx / depths[d];
      var by = gy(sd) + 2;
      var r = cellRange(sd, 0.8, 0.5);
      var seed = 900 + d * 20;
      for (var i = r[0]; i <= r[1]; i++) {
        var kind = hash(i, seed);
        var x = sx((i + hash(i, seed + 1)) * 0.8, sd);
        if (kind < 0.32) {
          tuft(ctx, x, by, (0.14 + 0.12 * hash(i, seed + 2)) * sd, col(hash(i, seed + 3) < 0.5 ? C.grassNear : C.fern, z));
        } else if (kind < 0.42) {
          var fh = (0.16 + 0.1 * hash(i, seed + 4)) * sd;
          ctx.fillStyle = col(C.grassNear, z);
          ctx.fillRect(x - 0.008 * sd, by - fh, 0.016 * sd + 0.5, fh);
          var fc = col(hash(i, seed + 5) < 0.5 ? C.flower : C.flower2, z);
          for (var pt = 0; pt < 5; pt++) {
            var a = pt * Math.PI * 0.4;
            disc(ctx, x + Math.cos(a) * 0.03 * sd, by - fh + Math.sin(a) * 0.03 * sd, 0.022 * sd + 0.4, fc);
          }
          disc(ctx, x, by - fh, 0.018 * sd + 0.3, col("#fff4d6", z));
        } else if (kind < 0.46) {
          mushroom(ctx, x, by, (0.1 + 0.06 * hash(i, seed + 6)) * sd, z);
        }
      }
    }
  }

  function frond(ctx, bx, by, ang, len, fill) {
    var dx = Math.sin(ang);
    var dy = -Math.cos(ang);
    var tipA = ang * 1.35;
    var tx = bx + Math.sin(tipA) * len;
    var ty = by - Math.cos(tipA) * len * 0.92;
    var cx = bx + dx * len * 0.62;
    var cy = by + dy * len * 0.62;
    var w = len * 0.16;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(cx - dy * w, cy + dx * w, tx, ty);
    ctx.quadraticCurveTo(cx + dy * w, cy - dx * w, bx, by);
    ctx.fill();
  }

  function drawFerns(ctx, s, z) {
    var by = gy(s);
    groundFill(ctx, s, col(C.grassNear, z));
    var r = cellRange(s, 1.15, 1);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 600) > 0.5) continue;
      var x = (i + hash(i, 601)) * 1.15;
      var L = (0.45 + 0.35 * hash(i, 602)) * s;
      var n = 5 + Math.floor(hash(i, 603) * 4);
      var bx = sx(x, s);
      for (var j = 0; j < n; j++) {
        var ang = -1.15 + 2.3 * j / (n - 1) + (hash(i * 9 + j, 604) - 0.5) * 0.25;
        var len = L * (0.7 + 0.3 * Math.cos(ang));
        frond(ctx, bx, by + 2, ang, len, col(j % 2 ? C.fernLight : C.fern, z));
      }
    }
    var rt = cellRange(s, 0.45, 0.3);
    for (var k = rt[0]; k <= rt[1]; k++) {
      if (hash(k, 610) > 0.5) continue;
      tuft(ctx, sx((k + hash(k, 611)) * 0.45, s), by + 2, (0.22 + 0.2 * hash(k, 612)) * s, col(hash(k, 613) < 0.5 ? C.fern : C.grassNear, z));
    }
  }

  // ---------------------------------------------------------------------------
  // Runner
  // ---------------------------------------------------------------------------

  function pose(ph, A, lean) {
    var hip = [0, 0.94];
    var sh = [Math.sin(lean) * 0.5, 0.94 + Math.cos(lean) * 0.5];
    var head = [sh[0] + Math.sin(lean) * 0.21 + 0.03, sh[1] + Math.cos(lean) * 0.21];
    var legs = [];
    var arms = [];
    var minY = 9;
    for (var side = 0; side < 2; side++) {
      var q = ph + side * Math.PI;
      var th = A * (0.1 + 0.62 * Math.sin(q));
      var kn = 0.06 + A * (0.15 + 1.45 * Math.pow(Math.max(0, Math.cos(q - 0.35)), 1.6));
      var knee = [hip[0] + Math.sin(th) * 0.46, hip[1] - Math.cos(th) * 0.46];
      var sa = th - kn;
      var foot = [knee[0] + Math.sin(sa) * 0.44, knee[1] - Math.cos(sa) * 0.44];
      var toe = [foot[0] + Math.cos(sa) * 0.13, foot[1] + Math.sin(sa) * 0.13];
      legs.push([hip, knee, foot, toe]);
      minY = Math.min(minY, foot[1] - 0.04, toe[1] - 0.04);
      var ua = 0.05 - A * 0.8 * Math.sin(q);
      var elbow = [sh[0] + Math.sin(ua) * 0.29, sh[1] - Math.cos(ua) * 0.29];
      var fa = ua + 0.3 + A * 1.25;
      var hand = [elbow[0] + Math.sin(fa) * 0.27, elbow[1] - Math.cos(fa) * 0.27];
      arms.push([sh, elbow, hand]);
    }
    return { hip: hip, sh: sh, head: head, legs: legs, arms: arms, dy: -minY };
  }

  function drawRunner(ctx, s, z, rx, ph) {
    var A = clamp(state.speed / 5, 0, 1);
    var lean = Math.min(0.32, 0.04 + 0.03 * state.speed);
    var P = pose(ph, A, lean);
    var bx = sx(rx, s);
    var by = gy(s);
    var dy = P.dy;

    function X(p) { return bx + p[0] * s; }
    function Y(p) { return by - (p[1] + dy) * s; }

    function limb(pts, width, color, upto) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * s;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(X(pts[0]), Y(pts[0]));
      var n = upto || pts.length;
      for (var i = 1; i < n; i++) ctx.lineTo(X(pts[i]), Y(pts[i]));
      ctx.stroke();
    }

    function leg(L, near) {
      limb([L[0], L[1], L[2]], 0.11, col(near ? C.skin : C.skinDark, z));
      limb([L[2], L[3]], 0.085, col(near ? C.shoe : C.shoeDark, z));
      var mid = [L[0][0] + (L[1][0] - L[0][0]) * 0.5, L[0][1] + (L[1][1] - L[0][1]) * 0.5];
      limb([L[0], mid], 0.16, col(C.shorts, z));
    }

    function arm(Ar, near) {
      limb(Ar, 0.085, col(near ? C.skin : C.skinDark, z));
      limb([Ar[0], [Ar[0][0] + (Ar[1][0] - Ar[0][0]) * 0.45, Ar[0][1] + (Ar[1][1] - Ar[0][1]) * 0.45]], 0.11, col(near ? C.shirt : C.shirtDark, z));
    }

    // shadow
    ctx.fillStyle = "rgba(20,25,15,0.2)";
    ctx.beginPath();
    ctx.ellipse(bx + 0.05 * s, by, 0.36 * s, 0.05 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    arm(P.arms[1], false);
    leg(P.legs[1], false);
    limb([P.hip, P.sh], 0.3, col(C.shirt, z));
    limb([P.hip, [P.hip[0] + Math.sin(lean) * 0.08, P.hip[1] + 0.08]], 0.31, col(C.shorts, z));
    leg(P.legs[0], true);

    var hx = X(P.head);
    var hy = Y(P.head);
    var hr = 0.125 * s;
    disc(ctx, hx, hy, hr, col(C.skin, z));
    ctx.fillStyle = col(C.hair, z);
    ctx.beginPath();
    ctx.arc(hx, hy, hr * 1.04, Math.PI * 0.72, Math.PI * 1.9);
    ctx.closePath();
    ctx.fill();
    disc(ctx, hx + hr * 0.5, hy - hr * 0.05, hr * 0.12, col(C.hair, z));

    arm(P.arms[0], true);
  }

  // ---------------------------------------------------------------------------
  // Point lights: sun glints and fireflies, drawn as real bokeh discs.
  // ---------------------------------------------------------------------------

  function bokeh(ctx, x, y, coc, base, rgb, a) {
    var r = Math.max(base, coc * 0.5);
    var k = clamp(2.2 * (base / r) * (base / r), 0.1, 1);
    ctx.fillStyle = "rgba(" + rgb + "," + (a * k).toFixed(4) + ")";
    ctx.beginPath();
    if (r > base * 2.5 && aperture() >= 4) {
      for (var i = 0; i < 6; i++) {
        var t = 0.3 + i * Math.PI / 3;
        if (i === 0) ctx.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
        else ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function forSubframes(z, F, fn) {
    var s = V.fpx / z;
    var shift = state.pan ? state.speed * F.T * s : 0;
    var n = shift > 0.75 ? clamp(Math.ceil(shift / 2) + 1, 2, F.nMax) : 1;
    for (var i = 0; i < n; i++) {
      var tau = F.T * (1 - (i + 0.5) / n);
      V.camX = F.camAt(tau);
      V.t = sim.t - tau;
      fn(1 / n);
    }
  }

  function drawSpecks(ctx, F) {
    var T = TIMES[state.tod];
    if (!T.specks) return;
    var z = 36;
    var coc = cocPx(z);
    var rgb = T.sun.color;
    forSubframes(z, F, function (w) {
      var s = V.fpx / z;
      var r = cellRange(s, 2.2, 1);
      for (var i = r[0]; i <= r[1]; i++) {
        if (hash(i, 700) > 0.45) continue;
        var x = sx((i + hash(i, 701)) * 2.2, s);
        var y = sy(4 + 7 * hash(i, 702), s);
        var tw = 0.55 + 0.45 * Math.sin(V.t * (1.2 + hash(i, 703)) + hash(i, 704) * 6.28);
        bokeh(ctx, x, y, coc, 1.5, rgb, T.specks * tw * 0.9 * w);
      }
    });
  }

  var FLY_GROUPS = [
    { zMin: 19, zMax: 32, cell: 2.6, seed: 800 },
    { zMin: 9.5, zMax: 16, cell: 2.2, seed: 820 },
    { zMin: 3, zMax: 7, cell: 1.3, seed: 840 }
  ];

  function drawFireflies(ctx, F, g) {
    var T = TIMES[state.tod];
    if (!T.fireflies) return;
    var G = FLY_GROUPS[g];
    forSubframes((G.zMin + G.zMax) / 2, F, function (w) {
      var sMin = V.fpx / G.zMax;
      var r = cellRange(sMin, G.cell, 1);
      for (var i = r[0]; i <= r[1]; i++) {
        if (hash(i, G.seed) > 0.42) continue;
        var z = G.zMin + (G.zMax - G.zMin) * hash(i, G.seed + 1);
        var s = V.fpx / z;
        var x = (i + 0.5) * G.cell + 0.6 * G.cell * Math.sin(V.t * 0.3 * (1 + hash(i, G.seed + 2)) + 6 * hash(i, G.seed + 3));
        var y = 0.4 + 1.6 * hash(i, G.seed + 4) + 0.35 * Math.sin(V.t * 0.5 * (1 + hash(i, G.seed + 5)) + 6 * hash(i, G.seed + 6));
        var pulse = Math.pow(0.5 + 0.5 * Math.sin(V.t * (1.2 + hash(i, G.seed + 7)) + 6 * hash(i, G.seed + 8)), 3);
        var px = sx(x, s);
        var py = sy(y, s);
        var coc = cocPx(z);
        var base = Math.max(1.2, 0.025 * s);
        var a = T.fireflies * (0.15 + 0.85 * pulse) * w;
        if (coc < base * 4) disc(ctx, px, py, base * 3.2, "rgba(220,255,140," + (0.12 * a).toFixed(4) + ")");
        bokeh(ctx, px, py, coc, base, "236,255,160", a);
      }
    });
  }

  function drawRays(ctx) {
    var T = TIMES[state.tod];
    if (!T.rays || !T.sun) return;
    var p = skyPos(T.sun.az, T.sun.el);
    var base = Math.atan2(H * 0.6 - p.y, W * 0.5 - p.x);
    var len = W * 2.2;
    ctx.globalCompositeOperation = "screen";
    for (var k = 0; k < 7; k++) {
      var a = base + (k - 3) * 0.11 + 0.03 * Math.sin(V.t * 0.25 + k * 1.7);
      var spread = 0.025 + 0.03 * hash(k, 77);
      var strength = T.rays * (0.45 + 0.55 * hash(k, 78));
      var g = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(a) * len * 0.6, p.y + Math.sin(a) * len * 0.6);
      g.addColorStop(0, "rgba(" + T.sun.color + ",0)");
      g.addColorStop(0.35, "rgba(" + T.sun.color + "," + strength.toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + T.sun.color + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(a - spread) * len, p.y + Math.sin(a - spread) * len);
      ctx.lineTo(p.x + Math.cos(a + spread) * len, p.y + Math.sin(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  var LAYERS = [
    { id: "sky", z: Infinity, draw: drawSky },
    { id: "clouds", z: 3000, draw: drawClouds },
    { id: "hills", z: 900, draw: drawHills },
    { id: "far", z: 80, draw: drawFar },
    {
      id: "back", z: 35, draw: drawBack,
      after: function (ctx, F) {
        ctx.globalCompositeOperation = "lighter";
        drawSpecks(ctx, F);
        drawFireflies(ctx, F, 0);
        ctx.globalCompositeOperation = "source-over";
        drawRays(ctx);
      }
    },
    {
      id: "mid", z: 18, draw: drawMid,
      after: function (ctx, F) {
        ctx.globalCompositeOperation = "lighter";
        drawFireflies(ctx, F, 1);
      }
    },
    { id: "path", z: 8.4, draw: drawPath },
    { id: "verge", z: 5.6, draw: drawVerge },
    {
      id: "runner", z: 8, runner: true,
      after: function (ctx, F) {
        ctx.globalCompositeOperation = "lighter";
        drawFireflies(ctx, F, 2);
      }
    },
    { id: "ferns", z: 2.2, draw: drawFerns }
  ];

  // ---------------------------------------------------------------------------
  // Canvases
  // ---------------------------------------------------------------------------

  var viewfinder = document.getElementById("viewfinder");
  var main = document.getElementById("view");
  var mctx = main.getContext("2d");
  var scene = document.createElement("canvas");
  var sctx = scene.getContext("2d");
  var q = Math.min(window.devicePixelRatio || 1, 1.5);
  var liveMax = 24;

  var hasFilter = (function () {
    var c = document.createElement("canvas").getContext("2d");
    if (!("filter" in c)) return false;
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  })();

  function sizeCanvases() {
    main.width = scene.width = Math.round(W * q);
    main.height = scene.height = Math.round(H * q);
    zbuf.width = main.width;
    zbuf.height = main.height;
  }

  var scratch = {};
  function scr(d, w, h) {
    var o = scratch[d];
    if (!o) {
      var a = document.createElement("canvas");
      var b = document.createElement("canvas");
      o = scratch[d] = { a: a, b: b, actx: a.getContext("2d"), bctx: b.getContext("2d") };
    }
    if (o.a.width < w || o.a.height < h) {
      o.a.width = o.b.width = Math.max(o.a.width, w);
      o.a.height = o.b.height = Math.max(o.a.height, h);
    }
    return o;
  }

  function resetCtx(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (hasFilter) ctx.filter = "none";
  }

  function chooseD(sig) {
    if (!hasFilter) return clamp(Math.round(sig * 1.4), 1, 24);
    return sig < 6 ? 1 : sig < 12 ? 2 : sig < 24 ? 4 : 8;
  }

  // Noise tiles for sensor grain.
  function makeNoise(size, chroma) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    var img = x.createImageData(size, size);
    var d = img.data;
    function g() {
      var u = 1 - Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * Math.random());
    }
    for (var i = 0; i < d.length; i += 4) {
      if (chroma) {
        var m = Math.abs(g()) * 34;
        d[i] = m * (0.6 + Math.random());
        d[i + 1] = m * (0.6 + Math.random());
        d[i + 2] = m * (0.6 + Math.random());
      } else {
        var l = g() * 62;
        d[i] = 128 + l + g() * 14;
        d[i + 1] = 128 + l + g() * 14;
        d[i + 2] = 128 + l + g() * 14;
      }
      d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  var grainTile = makeNoise(256, false);
  var speckTile = makeNoise(256, true);
  var grainPat = mctx.createPattern(grainTile, "repeat");
  var speckPat = mctx.createPattern(speckTile, "repeat");

  // Zebra stripes for clipped highlights.
  var stripe = document.createElement("canvas");
  stripe.width = stripe.height = 16;
  (function () {
    var x = stripe.getContext("2d");
    x.fillStyle = "rgba(0,0,0,0.75)";
    x.fillRect(0, 0, 16, 16);
    x.strokeStyle = "rgba(255,255,255,0.9)";
    x.lineWidth = 4;
    for (var i = -16; i <= 32; i += 8) {
      x.beginPath();
      x.moveTo(i, 16);
      x.lineTo(i + 16, 0);
      x.stroke();
    }
  })();
  var zbuf = document.createElement("canvas");
  var zctx = zbuf.getContext("2d");
  var stripePat = zctx.createPattern(stripe, "repeat");
  var maskCanvas = document.createElement("canvas");
  maskCanvas.width = 192;
  maskCanvas.height = 108;
  var maskCtx = maskCanvas.getContext("2d");
  var hasMask = false;

  var probe = document.createElement("canvas");
  probe.width = 192;
  probe.height = 108;
  var probeCtx = probe.getContext("2d", { willReadFrequently: true });

  var hit = document.createElement("canvas");
  hit.width = hit.height = 1;
  var hitCtx = hit.getContext("2d", { willReadFrequently: true });

  sizeCanvases();

  // ---------------------------------------------------------------------------
  // Frame rendering
  // ---------------------------------------------------------------------------

  function viewWidthAt(z) { return W / (V.fpx / z); }

  function frameInfo(capture) {
    var T = shutter();
    var v = state.speed;
    var w10 = viewWidthAt(8);
    var lead = w10 * 0.12;
    var F = {
      T: T,
      nMax: capture ? 96 : liveMax,
      camAt: function (tau) {
        return state.pan ? sim.dist - tau * v + lead : STATIC_X;
      },
      runnerX: function (tau) {
        var d = sim.dist - tau * v;
        if (state.pan) return d;
        if (v < 0.01) return STATIC_X - w10 * 0.06;
        var loop = w10 + 2.5 + v * 0.3;
        return STATIC_X - w10 / 2 - 1.5 + mod(d, loop);
      }
    };
    var s10 = V.fpx / 8;
    var A = clamp(v / 5, 0, 1);
    var limb = A > 0 ? (1.2 * v + 1.5) * T * s10 : 0;
    var body = state.pan ? 0 : v * T * s10;
    var disp = body + limb * 0.6;
    F.nRunner = v < 0.01 ? 1 : clamp(Math.ceil(disp / 2.5) + 1, 1, F.nMax);
    return F;
  }

  function renderLayer(L, F) {
    var z = L.z;
    var s = isFinite(z) ? V.fpx / z : 0;
    var sigma = sigmaOf(z);
    var sigDev = sigma * q;
    var d = chooseD(sigDev);
    var k = q / d;
    var shift = state.pan && s ? state.speed * F.T * s : 0;
    var n = L.runner ? F.nRunner : shift > 0.75 ? clamp(Math.ceil(shift / 2) + 1, 2, F.nMax) : 1;
    var padX = Math.min(W * 0.6, (L.runner ? 0 : shift / 2) + sigma * 3 + 6);
    var padY = Math.min(H * 0.35, sigma * 3 + 6);
    var cw = Math.ceil((W + 2 * padX) * k);
    var ch = Math.ceil((H + 2 * padY) * k);
    var S = scr(d, cw, ch);
    var A = S.a;
    var B = S.b;
    var actx = S.actx;
    var bctx = S.bctx;
    var add = 1 / n + 0.6 / 255;

    V.sx0 = -padX;
    V.sx1 = W + padX;
    V.sy0 = -padY;
    V.sy1 = H + padY;

    resetCtx(actx);
    actx.clearRect(0, 0, cw, ch);
    var src = A;

    if (L.runner) {
      resetCtx(bctx);
      bctx.clearRect(0, 0, cw, ch);
      for (var i = 0; i < n; i++) {
        var tau = F.T * (1 - (i + 0.5) / n);
        V.camX = F.camAt(tau);
        V.t = sim.t - tau;
        var rx = F.runnerX(tau);
        var ph = sim.phase - tau * cadence() * Math.PI * 2;
        var cx = (W / 2 + (rx - V.camX) * s + padX) * k;
        var x0 = Math.max(0, Math.floor(cx - 1.4 * s * k));
        var x1 = Math.min(cw, Math.ceil(cx + 1.4 * s * k));
        var y0 = Math.max(0, Math.floor((sy(2.3, s) + padY) * k));
        var y1 = Math.min(ch, Math.ceil((gy(s) + 0.3 * s + padY) * k));
        if (x1 <= x0 || y1 <= y0) continue;
        actx.setTransform(1, 0, 0, 1, 0, 0);
        actx.clearRect(x0, y0, x1 - x0, y1 - y0);
        actx.setTransform(k, 0, 0, k, padX * k, padY * k);
        drawRunner(actx, s, z, rx, ph);
        bctx.globalCompositeOperation = "lighter";
        bctx.globalAlpha = add;
        bctx.drawImage(A, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      }
      src = B;
    } else {
      var tauMid = F.T / 2;
      V.camX = F.camAt(tauMid);
      V.t = sim.t - tauMid;
      actx.setTransform(k, 0, 0, k, padX * k, padY * k);
      L.draw(actx, s, z);
      if (n > 1) {
        resetCtx(bctx);
        bctx.clearRect(0, 0, cw, ch);
        bctx.globalCompositeOperation = "lighter";
        bctx.globalAlpha = add;
        for (var j = 0; j < n; j++) {
          var tj = F.T * (1 - (j + 0.5) / n);
          var dx = -(F.camAt(tj) - V.camX) * s * k;
          bctx.drawImage(A, 0, 0, cw, ch, dx, 0, cw, ch);
        }
        src = B;
      }
    }

    var sb = sigDev / d;
    if (hasFilter && sb > 0.4) {
      var dst = src === A ? B : A;
      var dctx = src === A ? bctx : actx;
      resetCtx(dctx);
      dctx.clearRect(0, 0, cw, ch);
      dctx.filter = "blur(" + sb.toFixed(2) + "px)";
      dctx.drawImage(src, 0, 0, cw, ch, 0, 0, cw, ch);
      dctx.filter = "none";
      src = dst;
    }

    resetCtx(sctx);
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(src, 0, 0, cw, ch, -padX * q, -padY * q, cw * d, ch * d);

    if (L.after) {
      sctx.setTransform(q, 0, 0, q, 0, 0);
      V.sx0 = -40;
      V.sx1 = W + 40;
      V.sy0 = -40;
      V.sy1 = H + 40;
      L.after(sctx, F);
      resetCtx(sctx);
    }
  }

  function vignette(ctx) {
    var N = aperture();
    var amt = 0.1 + 0.32 * clamp((4 - N) / 2.6, 0, 1);
    var g = ctx.createRadialGradient(W / 2, H / 2, W * 0.32, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0," + amt.toFixed(3) + ")");
    ctx.setTransform(q, 0, 0, q, 0, 0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    resetCtx(ctx);
  }

  function grainAmount() {
    var stops = Math.log2(iso() / 100);
    return 0.035 * Math.pow(2, stops * 0.52) - 0.035;
  }

  function render(capture) {
    V.fpx = state.focal / SENSOR * W;
    var F = frameInfo(capture);

    resetCtx(sctx);
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, scene.width, scene.height);
    for (var i = 0; i < LAYERS.length; i++) renderLayer(LAYERS[i], F);
    vignette(sctx);

    // Exposure: scale linear light by 2^offset, applied in sRGB-ish space.
    var b = Math.min(7, Math.pow(2, exposureOffset() / 2.2));
    resetCtx(mctx);
    mctx.drawImage(scene, 0, 0);
    if (b > 1.001) {
      mctx.globalCompositeOperation = "lighter";
      for (var r = b - 1; r > 0.001; r -= 1) {
        mctx.globalAlpha = Math.min(1, r);
        mctx.drawImage(scene, 0, 0);
      }
    } else if (b < 0.999) {
      mctx.globalAlpha = 1 - b;
      mctx.fillStyle = "#000";
      mctx.fillRect(0, 0, main.width, main.height);
    }
    resetCtx(mctx);

    var g = grainAmount();
    if (g > 0.004) {
      var gs = Math.max(1, q);
      mctx.setTransform(gs, 0, 0, gs, -Math.floor(Math.random() * 256) * gs, -Math.floor(Math.random() * 256) * gs);
      mctx.globalCompositeOperation = "overlay";
      mctx.globalAlpha = Math.min(0.9, g);
      mctx.fillStyle = grainPat;
      mctx.fillRect(0, 0, main.width / gs + 256, main.height / gs + 256);
      mctx.globalCompositeOperation = "lighter";
      mctx.globalAlpha = Math.min(0.6, g * 0.45);
      mctx.fillStyle = speckPat;
      mctx.fillRect(0, 0, main.width / gs + 256, main.height / gs + 256);
      resetCtx(mctx);
    }
  }

  function analyze() {
    probeCtx.drawImage(main, 0, 0, probe.width, probe.height);
    var data = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
    var bins = new Array(64);
    for (var i = 0; i < 64; i++) bins[i] = 0;
    var mask = maskCtx.createImageData(probe.width, probe.height);
    var md = mask.data;
    var any = false;
    for (var p = 0; p < data.length; p += 4) {
      var r = data[p];
      var g = data[p + 1];
      var b = data[p + 2];
      bins[(0.2126 * r + 0.7152 * g + 0.0722 * b) >> 2]++;
      if (r >= 250 || g >= 250 || b >= 250) {
        md[p + 3] = 255;
        any = true;
      }
    }
    maskCtx.putImageData(mask, 0, 0);
    hasMask = any;
    drawHist(bins);
  }

  function drawZebra() {
    if (!hasMask) return;
    resetCtx(zctx);
    zctx.clearRect(0, 0, zbuf.width, zbuf.height);
    zctx.imageSmoothingEnabled = false;
    zctx.drawImage(maskCanvas, 0, 0, zbuf.width, zbuf.height);
    zctx.globalCompositeOperation = "source-in";
    var off = (performance.now() / 60) % 16;
    zctx.setTransform(1, 0, 0, 1, off, 0);
    zctx.fillStyle = stripePat;
    zctx.fillRect(-off, 0, zbuf.width, zbuf.height);
    resetCtx(zctx);
    mctx.drawImage(zbuf, 0, 0);
  }

  var histCanvas = document.getElementById("hist");
  var hctx = histCanvas.getContext("2d");
  function drawHist(bins) {
    var w = histCanvas.width;
    var h = histCanvas.height;
    hctx.clearRect(0, 0, w, h);
    var max = 1;
    for (var i = 1; i < 63; i++) max = Math.max(max, bins[i]);
    hctx.fillStyle = "rgba(255,255,255,0.85)";
    hctx.beginPath();
    hctx.moveTo(0, h);
    for (var j = 0; j < 64; j++) {
      var v = Math.min(1, Math.sqrt(bins[j] / max));
      hctx.lineTo(j / 63 * w, h - 4 - v * (h - 10));
    }
    hctx.lineTo(w, h);
    hctx.closePath();
    hctx.fill();
    var total = probe.width * probe.height;
    if (bins[63] > total * 0.01) {
      hctx.fillStyle = "#ff6b5a";
      hctx.fillRect(w - 6, 0, 6, h);
    }
    if (bins[0] > total * 0.01) {
      hctx.fillStyle = "#6ba8ff";
      hctx.fillRect(0, 0, 6, h);
    }
  }

  // ---------------------------------------------------------------------------
  // Tap to focus: find the nearest layer that covers the tapped pixel.
  // ---------------------------------------------------------------------------

  function depthAt(lx, ly) {
    V.fpx = state.focal / SENSOR * W;
    var F = frameInfo(false);
    var tau = F.T / 2;
    for (var i = LAYERS.length - 1; i >= 0; i--) {
      var L = LAYERS[i];
      if (!isFinite(L.z)) return Infinity;
      var s = V.fpx / L.z;
      V.camX = F.camAt(tau);
      V.t = sim.t - tau;
      V.sx0 = lx - 2;
      V.sx1 = lx + 2;
      V.sy0 = ly - 2;
      V.sy1 = ly + 2;
      resetCtx(hitCtx);
      hitCtx.clearRect(0, 0, 1, 1);
      hitCtx.setTransform(1, 0, 0, 1, -lx, -ly);
      if (L.runner) {
        V.sx0 = -W;
        V.sx1 = 2 * W;
        drawRunner(hitCtx, s, L.z, F.runnerX(tau), sim.phase - tau * cadence() * Math.PI * 2);
      } else {
        L.draw(hitCtx, s, L.z);
      }
      if (hitCtx.getImageData(0, 0, 1, 1).data[3] > 100) return L.z;
    }
    return Infinity;
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  var $ = function (id) { return document.getElementById(id); };
  var inputs = { ap: $("ap"), sh: $("sh"), iso: $("iso"), focal: $("focal"), focus: $("focus"), speed: $("speed") };

  function focusToSlider(d) {
    if (!isFinite(d)) return 1000;
    return Math.round(clamp(Math.log(d / FOCUS_MIN) / Math.log(FOCUS_MAX / FOCUS_MIN), 0, 0.999) * 1000);
  }

  function sliderToFocus(v) {
    if (v >= 1000) return Infinity;
    return FOCUS_MIN * Math.pow(FOCUS_MAX / FOCUS_MIN, v / 1000);
  }

  function syncInputs() {
    inputs.ap.value = state.apIdx;
    inputs.sh.value = state.shIdx;
    inputs.iso.value = state.isoIdx;
    inputs.focal.value = state.focal;
    inputs.focus.value = focusToSlider(state.focus);
    inputs.speed.value = state.speed;
    setSeg("tod", "tod", state.tod);
    setSeg("cam", "cam", state.pan ? "pan" : "static");
  }

  function setSeg(groupId, key, value) {
    var btns = $(groupId).querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].dataset[key] === value;
      btns[i].classList.toggle("is-active", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function updateText() {
    var N = aperture();
    var T = shutter();
    var off = exposureOffset();
    var tod = TIMES[state.tod];

    $("ap-out").textContent = "f/" + N;
    $("sh-out").textContent = fmtShutter(T);
    $("iso-out").textContent = iso();
    $("focal-out").textContent = state.focal + " mm";
    $("focus-out").textContent = fmtDist(state.focus);
    $("speed-out").textContent = state.speed.toFixed(1) + " m/s";

    $("hud-shutter").textContent = fmtShutter(T);
    $("hud-aperture").textContent = "F" + N;
    $("hud-iso").textContent = "ISO " + iso();
    $("hud-focal").textContent = state.focal + "mm";
    $("hud-mode").textContent = (state.pan ? "PAN" : "TRIPOD") + " · " + tod.label.toUpperCase() + (state.playing ? "" : " · PAUSED");
    var ev = $("hud-ev");
    ev.textContent = (off >= 0 ? "+" : "−") + Math.abs(off).toFixed(1);
    ev.classList.toggle("is-off", Math.abs(off) > 0.7);
    $("meter-needle").style.left = (50 + clamp(off, -3.2, 3.2) / 3 * 50) + "%";

    var lim = dofLimits();
    $("dof-range").textContent = "Sharp from " + fmtDist(lim.near) + " to " + fmtDist(lim.far);

    // Readouts
    var roExp;
    if (off > 0.4) roExp = "Overexposed " + off.toFixed(1) + " stops";
    else if (off < -0.4) roExp = "Underexposed " + (-off).toFixed(1) + " stops";
    else roExp = "Well exposed";
    $("ro-exp").textContent = roExp;
    $("ro-exp-sub").textContent = tod.label + " light is EV " + tod.ev + ", camera is set to EV " + cameraEv().toFixed(1);

    V.fpx = state.focal / SENSOR * W;
    var runnerPx = state.speed * T * (V.fpx / 8);
    var bgPx = state.speed * T * (V.fpx / 18);
    if (state.pan) {
      $("ro-mot").textContent = bgPx < 1.5 ? "Pan too short to streak" : "Background streaks " + Math.round(bgPx) + " px";
      $("ro-mot-sub").textContent = "Tracking the runner keeps them sharp, the world smears.";
    } else {
      $("ro-mot").textContent = state.speed < 0.01 ? "Runner standing still" : runnerPx < 1.5 ? "Runner frozen" : "Runner smears " + Math.round(runnerPx) + " px";
      $("ro-mot-sub").textContent = state.speed < 0.01 ? "Nothing moves, any shutter works." : runnerPx < 1.5 ? "Fast enough to stop the motion." : "Use a faster shutter to freeze them, or pan.";
    }

    var bgBlur = cocPx(35);
    var subjBlur = cocPx(8);
    $("ro-bg").textContent = bgBlur < 1.2 ? "Sharp" : bgBlur < 6 ? "Softly blurred" : "Melted into bokeh";
    $("ro-bg-sub").textContent = "Trees at 35 m blur " + bgBlur.toFixed(1) + " px. Runner at 8 m: " + (subjBlur < 1.2 ? "sharp" : subjBlur.toFixed(1) + " px") + ".";

    var stops = Math.log2(iso() / 100);
    $("ro-noise").textContent = stops < 1.5 ? "Clean" : stops < 3.5 ? "Slight grain" : stops < 5.5 ? "Grainy" : "Very noisy";
    $("ro-noise-sub").textContent = "ISO " + iso() + " amplifies the signal " + Math.pow(2, stops) + "×.";

    drawDof();
  }

  function onChange() {
    updateText();
  }

  inputs.ap.addEventListener("input", function () { state.apIdx = +this.value; onChange(); });
  inputs.sh.addEventListener("input", function () { state.shIdx = +this.value; onChange(); });
  inputs.iso.addEventListener("input", function () { state.isoIdx = +this.value; onChange(); });
  inputs.focal.addEventListener("input", function () { state.focal = +this.value; onChange(); });
  inputs.focus.addEventListener("input", function () { focusAnim = null; state.focus = sliderToFocus(+this.value); onChange(); });
  inputs.speed.addEventListener("input", function () { state.speed = +this.value; onChange(); });

  $("tod").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    state.tod = b.dataset.tod;
    setSeg("tod", "tod", state.tod);
    onChange();
  });

  $("cam").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    state.pan = b.dataset.cam === "pan";
    setSeg("cam", "cam", b.dataset.cam);
    onChange();
  });

  $("opt-hist").addEventListener("change", function () {
    state.hist = this.checked;
    viewfinder.classList.toggle("hide-hist", !state.hist);
  });
  $("opt-zebra").addEventListener("change", function () { state.zebra = this.checked; });
  $("opt-grid").addEventListener("change", function () {
    state.grid = this.checked;
    viewfinder.classList.toggle("show-grid", state.grid);
  });

  var playBtn = $("play");
  function setPlaying(on) {
    state.playing = on;
    playBtn.textContent = on ? "Pause" : "Play";
    updateText();
  }
  playBtn.addEventListener("click", function () { setPlaying(!state.playing); });

  $("reset").addEventListener("click", function () {
    for (var key in DEFAULTS) state[key] = DEFAULTS[key];
    focusAnim = null;
    syncInputs();
    onChange();
  });

  // Focus animation (tap to focus)
  var focusAnim = null;
  var reticle = $("reticle");
  var reticleTimer = 0;

  function logD(d) { return Math.log(isFinite(d) ? d : 5000); }

  function focusTo(target) {
    focusAnim = { from: logD(state.focus), to: logD(target), target: target, start: performance.now() };
  }

  function stepFocus(now) {
    if (!focusAnim) return;
    var t = clamp((now - focusAnim.start) / 260, 0, 1);
    var e = 1 - Math.pow(1 - t, 3);
    if (t >= 1) {
      state.focus = focusAnim.target;
      focusAnim = null;
      reticle.classList.add("is-locked");
    } else {
      state.focus = Math.exp(focusAnim.from + (focusAnim.to - focusAnim.from) * e);
    }
    inputs.focus.value = focusToSlider(state.focus);
    updateText();
  }

  main.addEventListener("click", function (e) {
    var rect = main.getBoundingClientRect();
    var lx = (e.clientX - rect.left) / rect.width * W;
    var ly = (e.clientY - rect.top) / rect.height * H;
    var z = depthAt(lx, ly);
    focusTo(z);
    reticle.style.left = (lx / W * 100) + "%";
    reticle.style.top = (ly / H * 100) + "%";
    reticle.classList.remove("is-locked");
    reticle.classList.add("is-active");
    clearTimeout(reticleTimer);
    reticleTimer = setTimeout(function () { reticle.classList.remove("is-active", "is-locked"); }, 1400);
  });

  // ---------------------------------------------------------------------------
  // Depth-of-field scale
  // ---------------------------------------------------------------------------

  var dofCanvas = $("dof");
  var dctx2 = dofCanvas.getContext("2d");
  var DOF_MAX = 2000;
  var DOF_MARKS = [
    { z: 2.2, label: "ferns", icon: "fern" },
    { z: 5.6, label: "", icon: "fern" },
    { z: 8, label: "runner", icon: "runner" },
    { z: 18, label: "trees", icon: "tree" },
    { z: 35, label: "", icon: "tree" },
    { z: 80, label: "", icon: "tree" },
    { z: 900, label: "hills", icon: "hill" },
    { z: Infinity, label: "sky", icon: "sun" }
  ];

  function dofGeom() {
    var w = dofCanvas.clientWidth;
    var pad = 14;
    var infX = w - pad - 4;
    var span = infX - 26 - pad;
    return { w: w, pad: pad, infX: infX, span: span };
  }

  function dofX(d, g) {
    if (!isFinite(d) || d >= DOF_MAX) return g.infX;
    return g.pad + Math.log(Math.max(d, FOCUS_MIN) / FOCUS_MIN) / Math.log(DOF_MAX / FOCUS_MIN) * g.span;
  }

  function dofInv(x, g) {
    if (x > g.pad + g.span + 10) return Infinity;
    var t = clamp((x - g.pad) / g.span, 0, 1);
    return Math.min(FOCUS_MAX, FOCUS_MIN * Math.pow(DOF_MAX / FOCUS_MIN, t));
  }

  function drawDof() {
    var g = dofGeom();
    var dpr = window.devicePixelRatio || 1;
    var hpx = 72;
    if (dofCanvas.width !== Math.round(g.w * dpr)) {
      dofCanvas.width = Math.round(g.w * dpr);
      dofCanvas.height = Math.round(hpx * dpr);
    }
    var x = dctx2;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, g.w, hpx);
    var axisY = 46;
    var lim = dofLimits();
    var n0 = dofX(lim.near, g);
    var f0 = dofX(lim.far, g);

    x.fillStyle = "rgba(168,78,55,0.13)";
    x.fillRect(n0, 6, Math.max(2, f0 - n0), axisY - 6);
    x.fillStyle = "rgba(168,78,55,0.55)";
    x.fillRect(n0, 6, 1, axisY - 6);
    x.fillRect(f0 - 1, 6, 1, axisY - 6);

    x.strokeStyle = "rgba(27,27,24,0.3)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(g.pad, axisY + 0.5);
    x.lineTo(g.infX, axisY + 0.5);
    x.stroke();

    x.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
    x.textAlign = "center";
    x.fillStyle = "#8c877c";
    var ticks = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 2000];
    for (var i = 0; i < ticks.length; i++) {
      var tx = i === ticks.length - 1 ? g.infX : dofX(ticks[i], g);
      x.fillRect(tx, axisY - 3, 1, 7);
      if (g.w < 420 && (ticks[i] === 0.5 || ticks[i] === 2 || ticks[i] === 20 || ticks[i] === 500)) continue;
      x.fillText(i === ticks.length - 1 ? "∞" : ticks[i] + "m", tx, axisY + 18);
    }

    for (var m = 0; m < DOF_MARKS.length; m++) {
      var mk = DOF_MARKS[m];
      var mx = dofX(mk.z, g);
      var inFocus = mk.z >= lim.near && mk.z <= lim.far;
      var c = inFocus ? "#24231f" : "#b4afa3";
      drawIcon(x, mk.icon, mx, axisY - 10, c);
      if (mk.label && g.w >= 420) {
        x.fillStyle = c;
        x.fillText(mk.label, mx, 12);
      }
    }

    var fx = dofX(state.focus, g);
    x.fillStyle = "#a84e37";
    x.fillRect(fx - 1, 16, 2, axisY - 12);
    x.beginPath();
    x.moveTo(fx - 6, axisY + 9);
    x.lineTo(fx + 6, axisY + 9);
    x.lineTo(fx, axisY + 2);
    x.closePath();
    x.fill();
  }

  function drawIcon(x, kind, cx, by, c) {
    x.fillStyle = c;
    x.beginPath();
    if (kind === "tree") {
      x.moveTo(cx, by - 14);
      x.lineTo(cx - 6, by);
      x.lineTo(cx + 6, by);
    } else if (kind === "fern") {
      x.moveTo(cx - 6, by);
      x.lineTo(cx - 3, by - 8);
      x.lineTo(cx, by);
      x.lineTo(cx + 3, by - 10);
      x.lineTo(cx + 6, by);
    } else if (kind === "runner") {
      x.arc(cx, by - 12, 3, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.rect(cx - 2, by - 8, 4, 8);
    } else if (kind === "hill") {
      x.arc(cx, by, 8, Math.PI, 0);
    } else {
      x.arc(cx, by - 6, 4, 0, Math.PI * 2);
    }
    x.closePath();
    x.fill();
  }

  var dragging = false;
  function dofPointer(e) {
    var rect = dofCanvas.getBoundingClientRect();
    focusAnim = null;
    state.focus = dofInv(e.clientX - rect.left, dofGeom());
    inputs.focus.value = focusToSlider(state.focus);
    updateText();
  }
  dofCanvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    dofCanvas.setPointerCapture(e.pointerId);
    dofPointer(e);
  });
  dofCanvas.addEventListener("pointermove", function (e) { if (dragging) dofPointer(e); });
  dofCanvas.addEventListener("pointerup", function () { dragging = false; });
  dofCanvas.addEventListener("pointercancel", function () { dragging = false; });
  window.addEventListener("resize", drawDof);

  // ---------------------------------------------------------------------------
  // Shooting
  // ---------------------------------------------------------------------------

  var audio = null;
  function click(at, gain) {
    var len = Math.floor(audio.sampleRate * 0.03);
    var buf = audio.createBuffer(1, len, audio.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    var src = audio.createBufferSource();
    src.buffer = buf;
    var g = audio.createGain();
    g.gain.value = gain;
    src.connect(g).connect(audio.destination);
    src.start(at);
  }

  function shutterSound() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      var now = audio.currentTime + 0.01;
      click(now, 0.35);
      click(now + Math.max(0.05, shutter()), 0.25);
    } catch (err) {
      audio = null;
    }
  }

  var shots = [];
  var film = $("film");
  var shootBtn = $("shoot");
  var blink = $("blink");

  function shoot() {
    shutterSound();
    render(true);
    var url = main.toDataURL("image/jpeg", 0.92);
    var meta = fmtShutter(shutter()) + " · f/" + aperture() + " · ISO " + iso() + " · " + state.focal + "mm";
    shots.unshift({ url: url, meta: meta, tod: TIMES[state.tod].label });
    addThumb(shots[0], shots.length);
    $("film-empty").hidden = true;

    blink.classList.remove("is-on");
    void blink.offsetWidth;
    blink.classList.add("is-on");
    shootBtn.classList.add("is-firing");
    setTimeout(function () { shootBtn.classList.remove("is-firing"); }, 160);
  }

  function addThumb(shot, n) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "film-item";
    var img = document.createElement("img");
    img.src = shot.url;
    img.alt = "Photo " + n + ": " + shot.meta;
    var cap = document.createElement("span");
    cap.textContent = shot.meta;
    b.appendChild(img);
    b.appendChild(cap);
    b.addEventListener("click", function () { openShot(shot, n); });
    film.insertBefore(b, film.firstChild);
  }

  var dialog = $("photo-dialog");
  function openShot(shot, n) {
    $("photo-img").src = shot.url;
    $("photo-meta").textContent = shot.meta + " · " + shot.tod;
    var a = $("photo-download");
    a.href = shot.url;
    a.download = "shutter-" + n + ".jpg";
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  $("photo-close").addEventListener("click", function () { dialog.close ? dialog.close() : dialog.removeAttribute("open"); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });

  shootBtn.addEventListener("click", shoot);
  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space" || e.repeat) return;
    var t = e.target;
    if (t && (t.tagName === "BUTTON" || t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox"))) return;
    if (dialog.open) return;
    e.preventDefault();
    shoot();
  });

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(viewfinder);
  }

  var last = performance.now();
  var frame = 0;
  var slowFrames = 0;
  var avgDt = 16;

  function tick(now) {
    var dtMs = now - last;
    last = now;
    var dt = Math.min(0.05, dtMs / 1000);
    if (state.playing) {
      sim.t += dt;
      sim.dist += state.speed * dt;
      sim.phase += dt * cadence() * Math.PI * 2;
    }
    stepFocus(now);

    if (visible && !document.hidden) {
      render(false);
      frame++;
      if (frame % 4 === 0) analyze();
      if (state.zebra) drawZebra();

      // Drop quality on slow devices.
      avgDt = avgDt * 0.95 + dtMs * 0.05;
      if (frame > 90 && avgDt > 34) {
        if (++slowFrames > 60) {
          slowFrames = 0;
          avgDt = 16;
          if (liveMax > 12) liveMax = 12;
          else if (q > 0.75) {
            q = q > 1 ? 1 : 0.75;
            sizeCanvases();
          }
        }
      } else {
        slowFrames = 0;
      }
    }
    requestAnimationFrame(tick);
  }

  syncInputs();
  setPlaying(state.playing);
  onChange();
  requestAnimationFrame(tick);
})();
