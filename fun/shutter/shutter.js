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
  // Blur is exaggerated so the effect reads on a small flat-shaded scene.
  var BLUR_GAIN = 2.4;

  var APERTURES = [1.4, 1.8, 2, 2.8, 3.5, 4, 5.6, 8, 11, 16, 22];
  var SHUTTERS = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
  var ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];

  // The focus ring works in log distance. Past 200 m it snaps to infinity.
  var U_MIN = Math.log(0.5);
  var U_FAR = Math.log(200);
  var U_INF = U_FAR + 0.7;

  var BULBS = ["255,206,140", "255,168,92", "255,120,110", "170,240,150", "140,200,255"];

  var TIMES = {
    noon: {
      label: "Noon", ev: 14, tint: [1, 1, 1], fog: "#cfe2e4", fogDist: 260,
      skyTop: "#73afd9", skyBot: "#d6ecf1",
      sun: { az: -0.5, el: 0.62, r: 0.03, color: "255,250,228", glow: 0.55 },
      rays: 0.1, clouds: 0.45, specks: 0.75, fireflies: 0, stars: 0,
      lights: 0.3, win: 0, shLen: 0.35, shA: 0.22
    },
    golden: {
      label: "Golden hour", ev: 11, tint: [1.12, 0.86, 0.64], fog: "#f2c48f", fogDist: 190,
      skyTop: "#eea36e", skyBot: "#fde1ab",
      sun: { az: -0.75, el: 0.16, r: 0.035, color: "255,236,186", glow: 0.9 },
      rays: 0.22, clouds: 0.3, specks: 1, fireflies: 0, stars: 0,
      lights: 0.5, win: 0.2, shLen: 2.4, shA: 0.26
    },
    overcast: {
      label: "Overcast", ev: 12, tint: [0.84, 0.88, 0.9], fog: "#c2c8cb", fogDist: 105,
      skyTop: "#a2abb1", skyBot: "#d2d6d7",
      sun: null, rays: 0, clouds: 1, specks: 0, fireflies: 0, stars: 0,
      lights: 0.45, win: 0.3, shLen: 0, shA: 0.14
    },
    dusk: {
      label: "Dusk", ev: 7, tint: [0.6, 0.54, 0.76], fog: "#7b6e98", fogDist: 150,
      skyTop: "#2b376c", skyBot: "#e39780",
      sun: { az: -0.3, el: -0.05, r: 0.035, color: "255,170,130", glow: 0.7, hidden: true },
      rays: 0, clouds: 0.35, specks: 0, fireflies: 0.55, stars: 0.35,
      lights: 0.9, win: 0.75, shLen: 0, shA: 0.1
    },
    night: {
      label: "Night", ev: 0, tint: [0.34, 0.42, 0.66], fog: "#222d52", fogDist: 170,
      skyTop: "#050a1d", skyBot: "#1d2a52",
      sun: null, moon: { az: 0.42, el: 0.3, r: 0.028 },
      rays: 0, clouds: 0.25, specks: 0, fireflies: 1, stars: 1,
      lights: 1, win: 1, shLen: 0, shA: 0.08
    }
  };

  var C = {
    grass: "#83b05e", grassDark: "#6a9a4c", grassNear: "#5c8c43",
    dirt: "#d3b07a", dirtDark: "#b8945f", pebble: "#e6d2a8",
    leaf: "#3f8a57", leafLight: "#5ea86d", leaf2: "#4f9a50", leaf2Light: "#73b766",
    pine: "#2f6e4f", pineLight: "#468a63", pine2: "#2c6655", pine2Light: "#3f806c",
    trunk: "#6e4c36", trunkLight: "#8a6446", trunkDark: "#563a29",
    bush: "#4a9259", bushLight: "#69ad72",
    hillA: "#8db193", hillB: "#77a07f",
    rock: "#9a968a", rockLight: "#b9b5a8",
    fern: "#3d8a4a", fernLight: "#5cab5f",
    flower: "#f2d16b", flower2: "#ee8c6c",
    wood: "#a8744a", woodDark: "#8a5c38", woodLight: "#c48d5c",
    roof: "#7a4a3a", roofLight: "#94604b", door: "#5d3b2a",
    sign: "#d7b27c", signText: "#4a3020",
    wire: "#2a2622",
    glass: "#5d7286", glassLit: "#ffd58a",
    skin: "#eab48b", skinDark: "#d39a72",
    shirt: "#a84e37", shirtDark: "#8b3f2c",
    shorts: "#2b2a26", hair: "#26231f",
    shoe: "#f4efe4", shoeDark: "#d6cfc0",
    // city
    pave: "#c9c4b8", paveDark: "#aaa497", curb: "#dcd7cb",
    asphalt: "#4b4c51", asphaltLight: "#5b5c62", lane: "#efe9d6",
    bldFar: "#9eabb8", bld: "#8596a8", bld2: "#9a8f8a", bldLight: "#a9b8c6",
    cornice: "#6e6660", frame: "#efe9dc", awning: "#f4efe2",
    pole: "#3b3d42", planter: "#7d7468", bollard: "#33353a", band: "#f2c14e",
    hydrant: "#c8443a", tire: "#222326",
    // beach
    sea: "#3f8fb0", seaDeep: "#2c7393", seaLight: "#8fd0de", seaShallow: "#6cc4c0",
    foam: "#f4fbf8", sand: "#ecd39e", sandWet: "#c9ab78", sandDark: "#cfb27c", sandLight: "#f6e4bb",
    palmTrunk: "#a07850", palmLeaf: "#3f9a5a", palmLeafLight: "#62b86c", coconut: "#6b4a2e",
    straw: "#d8b46a", strawDark: "#b8913f", bamboo: "#c9a35e",
    island: "#6f9a86", lightA: "#e8564a", lightB: "#f6f1e4",
    gull: "#f4f4f0", gullTip: "#3a3a3a", shell: "#f3d9cf", castle: "#e2c588", ball1: "#e8564a", ball2: "#3b6fb6"
  };

  var FACADES = ["#b5654a", "#e2d3b5", "#5f8f8a", "#d9a441", "#8a6f9e", "#c98a6a", "#7d9bb3"];
  var AWNINGS = ["#2f6e4f", "#a84e37", "#3b6fb6", "#2b2a26", "#c98a2a"];
  var SHOPS = ["CAFE", "BOOKS", "RAMEN", "FLOWERS", "BAKERY", "RECORDS", "PIZZA", "TAILOR"];
  var CAR_COLS = ["#d64f3c", "#3b6fb6", "#f2c14e", "#e8e4da", "#2f3236", "#5aa37a", "#e07b39"];

  var DEFAULTS = {
    apIdx: 2, shIdx: 3, isoIdx: 0, focal: 50, focusU: Math.log(6),
    subject: "standing", subjectZ: 6, speed: 5, pan: false, focusMode: "mf"
  };

  var state = {
    scene: "forest", tod: "golden",
    apIdx: DEFAULTS.apIdx, shIdx: DEFAULTS.shIdx, isoIdx: DEFAULTS.isoIdx,
    focal: DEFAULTS.focal, focusU: DEFAULTS.focusU,
    subject: DEFAULTS.subject, subjectZ: DEFAULTS.subjectZ, speed: DEFAULTS.speed,
    pan: DEFAULTS.pan, focusMode: DEFAULTS.focusMode,
    playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    hist: true, zebra: false, peak: true, grid: false
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

  // Base colour -> lit by the time of day -> faded into haze by distance.
  var colCache = {};
  function colArr(h, z) {
    var T = TIMES[state.tod];
    var c = hexRgb(h);
    var f = hexRgb(T.fog);
    var a = z === Infinity ? 1 : 1 - Math.exp(-z / (T.fogDist * (scene().fogScale || 1)));
    return [
      Math.min(255, c[0] * T.tint[0]) * (1 - a) + f[0] * a,
      Math.min(255, c[1] * T.tint[1]) * (1 - a) + f[1] * a,
      Math.min(255, c[2] * T.tint[2]) * (1 - a) + f[2] * a
    ];
  }

  function col(h, z) {
    var key = state.scene + state.tod + h + z;
    var out = colCache[key];
    if (!out) {
      var r = colArr(h, z);
      out = colCache[key] = "rgb(" + Math.round(r[0]) + "," + Math.round(r[1]) + "," + Math.round(r[2]) + ")";
    }
    return out;
  }

  // Glass that lights up from inside as it gets dark. k is 0 (dark) to 1 (lit).
  function glow(z, k, lit) {
    k = Math.round(clamp(k, 0, 1) * 20) / 20;
    lit = lit || C.glassLit;
    var key = "g" + state.scene + state.tod + z + k + lit;
    var out = colCache[key];
    if (!out) {
      var a = colArr(C.glass, z);
      var b = hexRgb(lit);
      out = colCache[key] = "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
    }
    return out;
  }

  function aperture() { return APERTURES[state.apIdx]; }
  function shutter() { return SHUTTERS[state.shIdx]; }
  function iso() { return ISOS[state.isoIdx]; }
  function cadence() { return 1 + 0.09 * state.speed; }
  function running() { return state.subject === "runner"; }
  function scene() { return SCENES[state.scene]; }

  function focusDist() {
    return state.focusU >= U_FAR + 0.35 ? Infinity : Math.exp(Math.min(state.focusU, U_FAR));
  }
  function distU(d) { return isFinite(d) ? clamp(Math.log(d), U_MIN, U_FAR) : U_INF; }

  function fmtShutter(t) {
    return t >= 1 ? t + "″" : "1/" + Math.round(1 / t);
  }

  function fmtDist(d) {
    if (!isFinite(d)) return "∞";
    if (d < 10) return d.toFixed(1) + " m";
    if (d < 1000) return Math.round(d) + " m";
    return (d / 1000).toFixed(1) + " km";
  }

  function sunFor() {
    var T = TIMES[state.tod];
    var o = scene().sun && scene().sun[state.tod];
    if (!T.sun) return null;
    if (!o) return T.sun;
    return { az: o.az, el: o.el, r: T.sun.r, color: T.sun.color, glow: T.sun.glow, hidden: T.sun.hidden };
  }

  // ---------------------------------------------------------------------------
  // Optics
  // ---------------------------------------------------------------------------

  function focusMm() { var d = focusDist(); return isFinite(d) ? d * 1000 : FAR; }

  // Circle of confusion on the sensor (mm) for an object at z metres.
  function cocMm(z) {
    var f = state.focal;
    var A = f / aperture() * BLUR_GAIN;
    var S = focusMm();
    var D = isFinite(z) ? z * 1000 : FAR;
    return A * f * Math.abs(S - D) / (D * (S - f));
  }

  function cocPx(z) { return cocMm(z) / SENSOR * W; }
  function sigmaOf(z) { return Math.min(46, cocPx(z) * 0.42); }

  function dofLimits() {
    var f = state.focal;
    var N = aperture() / BLUR_GAIN;
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
  function sAt(z) { return V.fpx / z; }

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

  function quad(ctx, pts, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
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

  function rect(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  function line(ctx, x0, y0, x1, y1, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, w);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function text(ctx, str, x, y, size, color, weight) {
    if (size < 2.5) return;
    ctx.font = (weight || 700) + " " + size.toFixed(1) + "px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function groundFill(ctx, s, color) {
    var top = gy(s);
    ctx.fillStyle = color;
    ctx.fillRect(V.sx0, top, V.sx1 - V.sx0, V.sy1 - top);
  }

  // A cast shadow on the ground; long and to the right when the sun is low.
  function shadow(ctx, bx, by, w, hgt) {
    var T = TIMES[state.tod];
    var len = T.shLen * hgt;
    ctx.fillStyle = "rgba(20,24,14," + T.shA + ")";
    ctx.beginPath();
    ctx.ellipse(bx + len * 0.5, by, (w + len) * 0.5, Math.max(1, w * 0.13 + hgt * 0.015), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // A soft pool of lamp light on the ground.
  function pool(ctx, x, y, rx, ry, rgb, a) {
    if (a < 0.02 || rx < 1) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, "rgba(" + rgb + "," + a.toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function leafDots(ctx, cx, cy, r, seed, dark, light) {
    var dr = r * 0.085;
    if (dr < 0.7) return;
    for (var k = 0; k < 8; k++) {
      var a = hash(seed, k * 3) * 6.283;
      var rr = r * (0.2 + 0.62 * hash(seed, k * 3 + 1));
      var x = cx + Math.cos(a) * rr;
      disc(ctx, x, cy + Math.sin(a) * rr, dr * (0.7 + 0.6 * hash(seed, k * 3 + 2)), x < cx ? dark : light);
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

  function frond(ctx, bx, by, ang, len, fill, droop) {
    var dx = Math.sin(ang);
    var dy = -Math.cos(ang);
    var tipA = ang * (droop || 1.35);
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

  // ---------------------------------------------------------------------------
  // Trees and nature
  // ---------------------------------------------------------------------------

  function pineAt(ctx, bx, by, hp, z, alt) {
    var tw = hp * 0.07;
    shadow(ctx, bx, by, tw * 3, hp);
    rect(ctx, bx - tw / 2, by - hp * 0.25, tw, hp * 0.25, col(C.trunk, z));
    var dark = col(alt ? C.pine2 : C.pine, z);
    var light = col(alt ? C.pine2Light : C.pineLight, z);
    for (var k = 0; k < 3; k++) {
      var b = by - hp * (0.14 + k * 0.25);
      var top = k === 2 ? by - hp : by - hp * (0.56 + k * 0.22);
      var hw = hp * (0.3 - k * 0.065);
      tri(ctx, bx, top, bx - hw, b, bx + hw, b, dark);
      tri(ctx, bx, top, bx - hw, b, bx, b, light);
      if (hw > 6) {
        rect(ctx, bx - hw * 0.8, b - Math.max(0.8, hp * 0.012), hw * 1.6, Math.max(0.8, hp * 0.012), dark);
      }
    }
  }

  function roundAt(ctx, bx, by, hp, z, alt, seed) {
    var tw = hp * 0.075;
    shadow(ctx, bx, by, hp * 0.35, hp);
    rect(ctx, bx - tw / 2, by - hp * 0.62, tw, hp * 0.62, col(C.trunk, z));
    rect(ctx, bx - tw / 2, by - hp * 0.62, tw * 0.4, hp * 0.62, col(C.trunkLight, z));
    var dark = col(alt ? C.leaf2 : C.leaf, z);
    var light = col(alt ? C.leaf2Light : C.leafLight, z);
    var r = hp * 0.27;
    var cy = by - hp + r;
    disc(ctx, bx + r * 0.6, cy + r * 0.62, r * 0.7, dark);
    disc(ctx, bx - r * 0.55, cy + r * 0.72, r * 0.62, dark);
    disc(ctx, bx, cy, r, dark);
    halfLeft(ctx, bx, cy, r, light);
    halfLeft(ctx, bx - r * 0.55, cy + r * 0.72, r * 0.62, light);
    leafDots(ctx, bx, cy, r, seed || 1, dark, light);
  }

  function bigTreeAt(ctx, bx, by, hp, tw, z, alt, seed) {
    var trunkTop = by - hp * 0.8;
    shadow(ctx, bx, by, tw * 3, hp);
    var trunk = col(C.trunk, z);
    rect(ctx, bx - tw / 2, trunkTop, tw, by - trunkTop, trunk);
    tri(ctx, bx - tw * 0.5, by - tw * 0.9, bx - tw * 1.05, by + 1, bx - tw * 0.5, by + 1, trunk);
    tri(ctx, bx + tw * 0.5, by - tw * 0.9, bx + tw * 1.05, by + 1, bx + tw * 0.5, by + 1, trunk);
    rect(ctx, bx - tw / 2, trunkTop, tw * 0.36, by - trunkTop, col(C.trunkLight, z));
    // bark lines and a knot: fine detail that shows focus clearly
    var dark = col(C.trunkDark, z);
    var lw = Math.max(0.7, tw * 0.05);
    for (var k = 0; k < 4; k++) {
      var lx = bx - tw * 0.32 + tw * 0.2 * k;
      var y0 = trunkTop + (by - trunkTop) * (0.05 + 0.3 * hash(seed, k));
      rect(ctx, lx, y0, lw, (by - trunkTop) * (0.25 + 0.3 * hash(seed, k + 9)), dark);
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(bx + tw * 0.15, by - hp * 0.35, tw * 0.14, tw * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trunk;
    ctx.lineWidth = tw * 0.28;
    ctx.lineCap = "round";
    ctx.beginPath();
    var side = alt ? 1 : -1;
    ctx.moveTo(bx, by - hp * 0.55);
    ctx.lineTo(bx + side * tw * 2.4, by - hp * 0.7);
    ctx.stroke();
    var dk = col(alt ? C.leaf2 : C.leaf, z);
    var lt = col(alt ? C.leaf2Light : C.leafLight, z);
    var r = hp * 0.2;
    var top = by - hp;
    disc(ctx, bx - r * 0.95, top + r * 1.7, r * 0.8, dk);
    disc(ctx, bx + r * 1.0, top + r * 1.55, r * 0.85, dk);
    disc(ctx, bx + side * tw * 2.4, by - hp * 0.7, r * 0.45, dk);
    disc(ctx, bx, top + r, r, dk);
    halfLeft(ctx, bx, top + r, r, lt);
    halfLeft(ctx, bx - r * 0.95, top + r * 1.7, r * 0.8, lt);
    halfLeft(ctx, bx + side * tw * 2.4, by - hp * 0.7, r * 0.45, lt);
    leafDots(ctx, bx, top + r, r, seed, dk, lt);
    leafDots(ctx, bx + r * 1.0, top + r * 1.55, r * 0.85, seed + 3, dk, lt);
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
      if (o.skip && o.skip(x)) continue;
      var h = o.hMin + (o.hMax - o.hMin) * hash(i, o.seed + 2);
      var alt = hash(i, o.seed + 4) < 0.5;
      if (hash(i, o.seed + 3) < o.pine) pineAt(ctx, sx(x, s), by, h * s, z, alt);
      else roundAt(ctx, sx(x, s), by, h * s, z, alt, i * 7 + o.seed);
    }
  }

  function mushroom(ctx, x, y, h, z) {
    rect(ctx, x - h * 0.12, y - h * 0.75, h * 0.24, h * 0.75, col("#efe6d2", z));
    ctx.fillStyle = col("#c8543c", z);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.7, h * 0.42, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    disc(ctx, x - h * 0.18, y - h * 0.86, h * 0.07, col("#f6efe0", z));
    disc(ctx, x + h * 0.14, y - h * 0.95, h * 0.06, col("#f6efe0", z));
  }

  function flowerAt(ctx, x, by, fh, sd, z, which) {
    rect(ctx, x - 0.008 * sd, by - fh, 0.016 * sd + 0.5, fh, col(C.grassNear, z));
    var fc = col(which ? C.flower : C.flower2, z);
    for (var pt = 0; pt < 5; pt++) {
      var a = pt * Math.PI * 0.4;
      disc(ctx, x + Math.cos(a) * 0.03 * sd, by - fh + Math.sin(a) * 0.03 * sd, 0.022 * sd + 0.4, fc);
    }
    disc(ctx, x, by - fh, 0.018 * sd + 0.3, col("#fff4d6", z));
  }

  // ---------------------------------------------------------------------------
  // Sky, clouds, hills (shared)
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

    var sun = sunFor();
    if (sun) {
      var sp = skyPos(sun.az, sun.el);
      var gr = V.fpx * 0.5;
      var rg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, gr);
      rg.addColorStop(0, "rgba(" + sun.color + "," + sun.glow + ")");
      rg.addColorStop(1, "rgba(" + sun.color + ",0)");
      ctx.fillStyle = rg;
      ctx.fillRect(sp.x - gr, sp.y - gr, gr * 2, gr * 2);
      if (!sun.hidden) disc(ctx, sp.x, sp.y, Math.max(2, V.fpx * sun.r), "rgb(" + sun.color + ")");
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

  function drawRays(ctx) {
    var T = TIMES[state.tod];
    var sun = sunFor();
    if (!T.rays || !sun) return;
    var p = skyPos(sun.az, sun.el);
    var base = Math.atan2(H * 0.6 - p.y, W * 0.5 - p.x);
    var len = W * 2.2;
    ctx.globalCompositeOperation = "screen";
    for (var k = 0; k < 7; k++) {
      var a = base + (k - 3) * 0.11 + 0.03 * Math.sin(V.t * 0.25 + k * 1.7);
      var spread = 0.025 + 0.03 * hash(k, 77);
      var strength = T.rays * (0.45 + 0.55 * hash(k, 78));
      var g = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(a) * len * 0.6, p.y + Math.sin(a) * len * 0.6);
      g.addColorStop(0, "rgba(" + sun.color + ",0)");
      g.addColorStop(0.35, "rgba(" + sun.color + "," + strength.toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + sun.color + ",0)");
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

  // Strings of fairy lights: scalloped wires between posts every `span` metres.
  function festoonY(x, span, top, droop) {
    var u = mod(x, span) / span;
    return top - droop * 4 * u * (1 - u);
  }

  function festoonLayer(z, span, top, droop) {
    return {
      z: z,
      draw: function (ctx, s) {
        var x0 = V.camX + (V.sx0 - W / 2) / s;
        var x1 = V.camX + (V.sx1 - W / 2) / s;
        var step = span / 24;
        ctx.strokeStyle = col(C.wire, z);
        ctx.lineWidth = Math.max(0.7, 0.012 * s);
        ctx.lineJoin = "round";
        ctx.beginPath();
        var first = true;
        for (var x = Math.floor(x0 / step) * step; x <= x1 + step; x += step) {
          var X = sx(x, s);
          var Y = sy(festoonY(x, span, top, droop), s);
          if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
        }
        ctx.stroke();
      }
    };
  }

  function festoonLights(out, G, z, span, top, droop, gap, a) {
    var r = G.range(z);
    for (var x = Math.ceil(r[0] / gap) * gap; x <= r[1]; x += gap) {
      var k = Math.round(x / gap);
      out.push({ x: x, y: festoonY(x, span, top, droop) - 0.07, z: z - 0.02, r: 0.045, c: BULBS[mod(k, 5)], a: a * (0.88 + 0.12 * Math.sin(G.t * 2 + k)), halo: 1 });
    }
  }

  // ---------------------------------------------------------------------------
  // Scene: forest with a hut
  // ---------------------------------------------------------------------------

  var HUT_CELL = 45;
  var HUT_X = 3;

  function nearHut(x, pad) {
    var d = mod(x - HUT_X, HUT_CELL);
    return d < 2.4 + pad || d > HUT_CELL - 2.4 - pad;
  }

  function forestFar(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    treeRow(ctx, s, z, { cell: 2.4, seed: 100, presence: 0.86, hMin: 8, hMax: 15, pine: 0.62 });
  }

  function forestBack(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    treeRow(ctx, s, z, { cell: 4.2, seed: 200, presence: 0.8, hMin: 8, hMax: 13, pine: 0.45 });
  }

  function hutAt(ctx, x, s, z) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var cx = sx(x, s);
    var w = 4.4 * s;
    var wh = 2.4 * s;
    var rh = 1.7 * s;
    var ov = 0.45 * s;
    var L = cx - w / 2;
    shadow(ctx, cx, by, w, 3.5 * s);
    pool(ctx, cx + w * 0.2, by + 0.3 * s, 3 * s, 0.6 * s, "255,190,110", 0.4 * T.win);

    rect(ctx, L, by - wh, w, wh, col(C.wood, z));
    rect(ctx, L, by - wh, w * 0.12, wh, col(C.woodLight, z));
    var plank = Math.max(0.7, 0.025 * s);
    for (var k = 1; k < 8; k++) rect(ctx, L, by - wh * k / 8, w, plank, col(C.woodDark, z));
    rect(ctx, L - 0.05 * s, by - wh, 0.14 * s, wh, col(C.woodDark, z));
    rect(ctx, L + w - 0.09 * s, by - wh, 0.14 * s, wh, col(C.woodDark, z));

    // door
    var dx = cx + 0.55 * s;
    rect(ctx, dx, by - 1.95 * s, 0.95 * s, 1.95 * s, col(C.door, z));
    rect(ctx, dx + 0.12 * s, by - 1.8 * s, 0.71 * s, 0.75 * s, col(C.woodDark, z));
    disc(ctx, dx + 0.8 * s, by - 0.95 * s, 0.05 * s + 0.4, col("#e7c56a", z));

    // window with a warm glow at night
    var wx = cx - 1.65 * s;
    var wy = by - 1.95 * s;
    rect(ctx, wx - 0.08 * s, wy - 0.08 * s, 1.26 * s, 1.06 * s, col(C.woodLight, z));
    rect(ctx, wx, wy, 1.1 * s, 0.9 * s, glow(z, T.win));
    rect(ctx, wx + 0.53 * s, wy, 0.05 * s + 0.5, 0.9 * s, col(C.woodLight, z));
    rect(ctx, wx, wy + 0.43 * s, 1.1 * s, 0.05 * s + 0.5, col(C.woodLight, z));
    // flower box
    rect(ctx, wx - 0.1 * s, wy + 0.95 * s, 1.3 * s, 0.2 * s, col(C.woodDark, z));
    for (var f = 0; f < 5; f++) disc(ctx, wx + (0.05 + f * 0.27) * s, wy + 0.92 * s, 0.08 * s + 0.4, col(f % 2 ? C.flower2 : C.flower, z));

    // lantern bracket
    rect(ctx, dx + 1.1 * s, by - 2.05 * s, 0.05 * s + 0.4, 0.3 * s, col(C.wire, z));
    rect(ctx, dx + 1.02 * s, by - 1.85 * s, 0.22 * s, 0.26 * s, glow(z, 0.3 + 0.7 * T.win, "#ffcf7a"));

    // roof
    var ry = by - wh;
    tri(ctx, L - ov, ry + 0.05 * s, L + w + ov, ry + 0.05 * s, cx, ry - rh, col(C.roof, z));
    tri(ctx, L - ov, ry + 0.05 * s, cx, ry + 0.05 * s, cx, ry - rh, col(C.roofLight, z));
    for (var k2 = 1; k2 < 5; k2++) {
      var yy = ry - rh * k2 / 5;
      var hw = (w / 2 + ov) * (1 - k2 / 5);
      rect(ctx, cx - hw, yy, hw * 2, Math.max(0.7, 0.03 * s), col(C.woodDark, z));
    }
    // chimney
    rect(ctx, cx + 1.0 * s, ry - rh * 0.95, 0.42 * s, rh * 0.6, col(C.rock, z));
    rect(ctx, cx + 0.96 * s, ry - rh * 0.97, 0.5 * s, 0.1 * s, col(C.rockLight, z));
    // eave wire for the fairy lights
    ctx.strokeStyle = col(C.wire, z);
    ctx.lineWidth = Math.max(0.6, 0.015 * s);
    ctx.beginPath();
    ctx.moveTo(L - ov * 0.6, ry + 0.1 * s);
    ctx.lineTo(cx, ry - rh + 0.12 * s);
    ctx.lineTo(L + w + ov * 0.6, ry + 0.1 * s);
    ctx.stroke();

    // bench and a little sign
    rect(ctx, L - 1.4 * s, by - 0.45 * s, 1.1 * s, 0.1 * s, col(C.woodLight, z));
    rect(ctx, L - 1.3 * s, by - 0.45 * s, 0.08 * s, 0.45 * s, col(C.woodDark, z));
    rect(ctx, L - 0.45 * s, by - 0.45 * s, 0.08 * s, 0.45 * s, col(C.woodDark, z));
  }

  function forestHut(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    var r = cellRange(s, HUT_CELL, 6);
    for (var i = r[0]; i <= r[1]; i++) hutAt(ctx, i * HUT_CELL + HUT_X, s, z);
  }

  function forestMid(ctx, s, z) {
    groundFill(ctx, s, col(C.grass, z));
    var by = gy(s);
    var r = cellRange(s, 7.5, 6);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 300) > 0.75) continue;
      var x = (i + 0.2 + 0.6 * hash(i, 301)) * 7.5;
      if (nearHut(x, 1.5)) continue;
      var h = 9 + 4 * hash(i, 302);
      var tw = 0.45 + 0.3 * hash(i, 303);
      bigTreeAt(ctx, sx(x, s), by, h * s, tw * s, z, hash(i, 304) < 0.5, i * 13);
    }
    var rb = cellRange(s, 3.2, 2);
    for (var j = rb[0]; j <= rb[1]; j++) {
      if (hash(j, 310) > 0.55) continue;
      var bx = (j + hash(j, 311)) * 3.2;
      if (nearHut(bx, 0.5)) continue;
      bushAt(ctx, sx(bx, s), by + 1, (0.5 + 0.5 * hash(j, 312)) * s, z);
    }
  }

  function signpost(ctx, x, s, z) {
    var by = gy(s);
    var X = sx(x, s);
    shadow(ctx, X, by, 0.3 * s, 1.4 * s);
    rect(ctx, X - 0.05 * s, by - 1.45 * s, 0.1 * s, 1.45 * s, col(C.woodDark, z));
    var bw = 0.95 * s;
    var bh = 0.3 * s;
    var y1 = by - 1.35 * s;
    quad(ctx, [X - 0.25 * s, y1, X + bw - 0.15 * s, y1, X + bw, y1 + bh / 2, X + bw - 0.15 * s, y1 + bh, X - 0.25 * s, y1 + bh], col(C.sign, z));
    text(ctx, "TRAIL", X + bw * 0.32, y1 + bh / 2 + 0.01 * s, 0.17 * s, col(C.signText, z), 800);
    var y2 = by - 0.95 * s;
    quad(ctx, [X + 0.25 * s, y2, X - bw + 0.15 * s, y2, X - bw, y2 + bh / 2, X - bw + 0.15 * s, y2 + bh, X + 0.25 * s, y2 + bh], col(C.sign, z));
    text(ctx, "HUT", X - bw * 0.36, y2 + bh / 2 + 0.01 * s, 0.17 * s, col(C.signText, z), 800);
  }

  function forestPath(ctx, s, z) {
    var fpx = V.fpx;
    var yBack = gy(fpx / 11);
    var yEdge = gy(fpx / 8.8);
    var yFront = gy(fpx / 7.3);
    var x0 = V.sx0;
    var w = V.sx1 - V.sx0;
    rect(ctx, x0, yBack, w, yEdge - yBack + 1, col(C.grass, z));
    rect(ctx, x0, yEdge, w, yFront - yEdge + 1, col(C.dirt, z));
    rect(ctx, x0, yEdge, w, (yFront - yEdge) * 0.14, col(C.dirtDark, z));
    rect(ctx, x0, yFront, w, V.sy1 - yFront, col(C.grassDark, z));

    var sp = fpx / 8;
    var rp = cellRange(sp, 0.7, 0.5);
    for (var p = rp[0]; p <= rp[1]; p++) {
      if (hash(p, 420) > 0.4) continue;
      var py = yEdge + (yFront - yEdge) * (0.3 + 0.6 * hash(p, 421));
      rect(ctx, sx((p + hash(p, 422)) * 0.7, sp), py, 0.06 * sp, 0.03 * sp, col(C.pebble, z));
    }

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
        flowerAt(ctx, bx, yEdge, (0.22 + 0.1 * hash(i, 404)) * s1, s1, z, hash(i, 405) < 0.5);
      }
    }

    var rs = cellRange(s1, HUT_CELL, 2);
    for (var k = rs[0]; k <= rs[1]; k++) signpost(ctx, k * HUT_CELL - 3.2, s1, z);

    var s2 = fpx / 7.2;
    var r2 = cellRange(s2, 0.9, 1);
    for (var j = r2[0]; j <= r2[1]; j++) {
      if (hash(j, 410) > 0.45) continue;
      tuft(ctx, sx((j + hash(j, 411)) * 0.9, s2), yFront + 2, (0.12 + 0.1 * hash(j, 412)) * s2, col(C.grassNear, z));
    }
  }

  function forestVerge(ctx, s, z) {
    var fpx = V.fpx;
    var bands = [6.6, 5.4, 4.4, 3.6, 3.0];
    for (var b = 0; b < bands.length; b++) {
      var yb = gy(fpx / bands[b]);
      if (yb > V.sy1) break;
      rect(ctx, V.sx0, yb, V.sx1 - V.sx0, V.sy1 - yb, col(b % 2 ? C.grassDark : C.grassNear, z));
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
          flowerAt(ctx, x, by, (0.16 + 0.1 * hash(i, seed + 4)) * sd, sd, z, hash(i, seed + 5) < 0.5);
        } else if (kind < 0.46) {
          mushroom(ctx, x, by, (0.1 + 0.06 * hash(i, seed + 6)) * sd, z);
        }
      }
    }
  }

  function forestFerns(ctx, s, z) {
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
        frond(ctx, bx, by + 2, ang, L * (0.7 + 0.3 * Math.cos(ang)), col(j % 2 ? C.fernLight : C.fern, z));
      }
    }
    var rt = cellRange(s, 0.45, 0.3);
    for (var k = rt[0]; k <= rt[1]; k++) {
      if (hash(k, 610) > 0.5) continue;
      tuft(ctx, sx((k + hash(k, 611)) * 0.45, s), by + 2, (0.22 + 0.2 * hash(k, 612)) * s, col(hash(k, 613) < 0.5 ? C.fern : C.grassNear, z));
    }
  }

  var FLY_GROUPS = [
    { zMin: 19, zMax: 32, cell: 2.6, seed: 800 },
    { zMin: 9.5, zMax: 14.5, cell: 2.2, seed: 820 },
    { zMin: 3.2, zMax: 5.5, cell: 1.3, seed: 840 }
  ];

  function forestLights(G, out) {
    var T = TIMES[state.tod];
    // fairy lights along the hut roof, plus the door lantern
    var rh = G.range(20);
    for (var i = Math.floor((rh[0] - 6) / HUT_CELL); i <= Math.ceil((rh[1] + 6) / HUT_CELL); i++) {
      var hx = i * HUT_CELL + HUT_X;
      for (var k = 0; k <= 16; k++) {
        var u = k / 16;
        var t2 = u <= 0.5 ? u / 0.5 : (1 - u) / 0.5;
        var px = hx - 2.5 + 5 * u;
        out.push({ x: px, y: 2.42 + 1.55 * t2, z: 19.8, r: 0.055, c: BULBS[k % 5], a: T.lights * (0.85 + 0.15 * Math.sin(G.t * 3 + k)), halo: 1 });
      }
      out.push({ x: hx + 0.55 + 1.13, y: 1.72, z: 19.8, r: 0.1, c: "255,196,120", a: 0.25 + 0.75 * T.win, halo: 1 });
    }
    festoonLights(out, G, 3, 7, 1.55, 0.38, 0.5, T.lights);

    if (T.specks) {
      var sun = sunFor();
      var rs = G.range(36);
      for (var j = Math.floor(rs[0] / 2.2); j <= Math.ceil(rs[1] / 2.2); j++) {
        if (hash(j, 700) > 0.45) continue;
        var tw = 0.55 + 0.45 * Math.sin(G.t * (1.2 + hash(j, 703)) + hash(j, 704) * 6.28);
        out.push({ x: (j + hash(j, 701)) * 2.2, y: 4 + 7 * hash(j, 702), z: 36, r: 0.04, c: sun.color, a: T.specks * tw * 0.9 });
      }
    }

    if (T.fireflies) {
      for (var g = 0; g < FLY_GROUPS.length; g++) {
        var F = FLY_GROUPS[g];
        var rf = G.range(F.zMax);
        for (var n = Math.floor(rf[0] / F.cell); n <= Math.ceil(rf[1] / F.cell); n++) {
          if (hash(n, F.seed) > 0.42) continue;
          var t = G.t;
          var pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (1.2 + hash(n, F.seed + 7)) + 6 * hash(n, F.seed + 8)), 3);
          out.push({
            x: (n + 0.5) * F.cell + 0.6 * F.cell * Math.sin(t * 0.3 * (1 + hash(n, F.seed + 2)) + 6 * hash(n, F.seed + 3)),
            y: 0.4 + 1.6 * hash(n, F.seed + 4) + 0.35 * Math.sin(t * 0.5 * (1 + hash(n, F.seed + 5)) + 6 * hash(n, F.seed + 6)),
            z: F.zMin + (F.zMax - F.zMin) * hash(n, F.seed + 1),
            r: 0.03, c: "220,255,140", a: T.fireflies * (0.15 + 0.85 * pulse), halo: 1
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scene: city street
  // ---------------------------------------------------------------------------

  function citySkyline(ctx, s, z) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var r = cellRange(s, 22, 40);
    var fill = col(C.bldFar, z);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1100) < 0.12) continue;
      var w = 12 + 16 * hash(i, 1101);
      var ht = 40 + 130 * Math.pow(hash(i, 1102), 2);
      var X = sx(i * 22 + 6 * hash(i, 1103), s);
      rect(ctx, X, by - ht * s, w * s, ht * s + 1, fill);
      if (T.win > 0.1 && 3 * s >= 2) {
        ctx.fillStyle = glow(z, T.win, "#ffd98f");
        for (var row = 0; row < ht / 4 - 1; row++) {
          for (var c = 0; c < w / 3 - 1; c++) {
            if (hash(i * 911 + row * 37 + c, 1104) > 0.3) continue;
            ctx.fillRect(X + (1.5 + c * 3) * s, by - (3 + row * 4) * s, 1.2 * s, 1.6 * s);
          }
        }
      }
    }
  }

  function cityTowers(ctx, s, z) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var r = cellRange(s, 34, 30);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1200) > 0.82) continue;
      var w = 16 + 14 * hash(i, 1201);
      var ht = 30 + 60 * hash(i, 1203);
      var X = sx(i * 34 + 4 * hash(i, 1202), s);
      var Y = by - ht * s;
      rect(ctx, X, Y, w * s, ht * s + 1, col(hash(i, 1204) < 0.5 ? C.bld : C.bld2, z));
      rect(ctx, X, Y, w * s * 0.16, ht * s + 1, col(C.bldLight, z));
      rect(ctx, X + w * s * 0.2, Y - 3 * s, 2.5 * s, 3 * s, col(C.cornice, z));
      if (2.6 * s < 2.4) continue;
      var rows = Math.floor((ht - 3) / 3.4);
      var cols = Math.floor((w - 2) / 2.6);
      for (var rr = 0; rr < rows; rr++) {
        for (var cc = 0; cc < cols; cc++) {
          var on = hash(i * 977 + rr * 31 + cc, 1205) < 0.45;
          ctx.fillStyle = on ? glow(z, T.win * 0.95 + 0.05 * hash(rr, cc)) : col(C.glass, z);
          ctx.fillRect(X + (1.2 + cc * 2.6) * s, by - (2 + rr * 3.4 + 2.2) * s, 1.4 * s, 2 * s);
        }
      }
    }
  }

  function shopFacade(ctx, i, s, z) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var x0 = i * 11;
    var ht = 9 + 8 * hash(i, 1300);
    var X = sx(x0, s);
    var Wd = 11 * s - Math.max(1, 0.12 * s);
    rect(ctx, X, by - ht * s, Wd, ht * s, col(FACADES[Math.floor(hash(i, 1301) * FACADES.length)], z));
    rect(ctx, X, by - ht * s, Wd, 0.55 * s, col(C.cornice, z));
    rect(ctx, X, by - 4.55 * s, Wd, 0.2 * s, col(C.cornice, z));

    for (var y = 5.4; y < ht - 1.4; y += 3.1) {
      for (var c = 0; c < 4; c++) {
        var wx = X + (1.0 + c * 2.55) * s;
        var wy = by - (y + 1.8) * s;
        rect(ctx, wx - 0.1 * s, wy - 0.1 * s, 1.5 * s, 2.0 * s, col(C.frame, z));
        var on = hash(i * 131 + Math.round(y) * 7 + c, 1302) < 0.5;
        rect(ctx, wx, wy, 1.3 * s, 1.8 * s, on ? glow(z, T.win) : glow(z, 0));
        rect(ctx, wx + 0.62 * s, wy, 0.06 * s + 0.4, 1.8 * s, col(C.frame, z));
      }
    }

    // shop front
    var shopLit = 0.12 + 0.88 * T.win;
    rect(ctx, X + 0.8 * s, by - 2.9 * s, 5.8 * s, 2.55 * s, col(C.frame, z));
    rect(ctx, X + 0.95 * s, by - 2.75 * s, 5.5 * s, 2.3 * s, glow(z, shopLit, "#ffe2a8"));
    for (var sh = 0; sh < 2; sh++) rect(ctx, X + 1.0 * s, by - (1.2 + sh * 0.7) * s, 5.4 * s, 0.07 * s + 0.4, col(C.cornice, z));
    for (var it = 0; it < 7; it++) {
      var ix = X + (1.2 + it * 0.75) * s;
      rect(ctx, ix, by - (1.2 + (it % 2) * 0.7 + 0.35) * s, 0.35 * s, 0.35 * s, col(AWNINGS[mod(i + it, AWNINGS.length)], z));
    }
    rect(ctx, X + 7.3 * s, by - 2.6 * s, 1.3 * s, 2.6 * s, col(C.frame, z));
    rect(ctx, X + 7.42 * s, by - 2.48 * s, 1.06 * s, 2.48 * s, glow(z, shopLit * 0.8, "#ffe2a8"));

    // striped awning
    var aw = AWNINGS[Math.floor(hash(i, 1303) * AWNINGS.length)];
    var ax0 = X + 0.5 * s;
    var ax1 = X + 9.0 * s;
    var stripes = 10;
    for (var st = 0; st < stripes; st++) {
      var a0 = ax0 + (ax1 - ax0) * st / stripes;
      var a1 = ax0 + (ax1 - ax0) * (st + 1) / stripes;
      quad(ctx, [a0, by - 3.6 * s, a1, by - 3.6 * s, a1 + 0.12 * s, by - 2.95 * s, a0 + 0.12 * s, by - 2.95 * s], col(st % 2 ? C.awning : aw, z));
    }
    // sign
    var name = SHOPS[mod(i, SHOPS.length)];
    rect(ctx, X + 1.2 * s, by - 4.4 * s, 6.8 * s, 0.68 * s, col("#2b2a26", z));
    text(ctx, name, X + 4.6 * s, by - 4.06 * s, 0.46 * s, glow(z, 0.25 + 0.75 * T.win, "#ffe9b0"), 800);
    if (hash(i, 1304) < 0.45) {
      text(ctx, "OPEN", X + 3.7 * s, by - 2.2 * s, 0.38 * s, glow(z, 0.35 + 0.65 * T.win, "#ff6fb5"), 800);
    }
  }

  function farLamp(ctx, x, s, z) {
    var by = gy(s);
    var X = sx(x, s);
    rect(ctx, X - 0.07 * s, by - 4.4 * s, 0.14 * s, 4.4 * s, col(C.pole, z));
    rect(ctx, X - 0.25 * s, by - 4.6 * s, 0.5 * s, 0.25 * s, col(C.pole, z));
  }

  function cityStreet(ctx, s, z) {
    groundFill(ctx, s, col(C.pave, z));
    var r = cellRange(s, 11, 12);
    for (var i = r[0]; i <= r[1]; i++) shopFacade(ctx, i, s, z);
    var rl = cellRange(s, 22, 2);
    for (var j = rl[0]; j <= rl[1]; j++) farLamp(ctx, j * 22 + 10.8, s, z);
  }

  function zQuad(ctx, xa, xb, za, zb, fill) {
    var sa = V.fpx / za;
    var sb = V.fpx / zb;
    quad(ctx, [sx(xa, sa), gy(sa), sx(xb, sa), gy(sa), sx(xb, sb), gy(sb), sx(xa, sb), gy(sb)], fill);
  }

  function cityRoad(ctx, s, z) {
    var fpx = V.fpx;
    var yCurb = gy(fpx / 22.3);
    var yFar = gy(fpx / 21.5);
    rect(ctx, V.sx0, yCurb, V.sx1 - V.sx0, yFar - yCurb + 1, col(C.curb, z));
    rect(ctx, V.sx0, yFar, V.sx1 - V.sx0, V.sy1 - yFar, col(C.asphalt, z));
    var r = cellRange(fpx / 16, 6, 4);
    for (var i = r[0]; i <= r[1]; i++) zQuad(ctx, i * 6, i * 6 + 2.8, 16.15, 15.85, col(C.lane, z));
    var rc = cellRange(fpx / 21, 60, 10);
    for (var c = rc[0]; c <= rc[1]; c++) {
      for (var k = 0; k < 6; k++) {
        var x = c * 60 + 9 + k * 1.1;
        zQuad(ctx, x, x + 0.55, 21.2, 11.8, col(C.lane, z));
      }
    }
    var rm = cellRange(fpx / 14, 27, 2);
    for (var m = rm[0]; m <= rm[1]; m++) {
      var mx = m * 27 + 15;
      var sm = fpx / 14;
      ctx.fillStyle = col(C.asphaltLight, z);
      ctx.beginPath();
      ctx.ellipse(sx(mx, sm), gy(sm), 0.45 * sm, 0.06 * sm, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var LANES = [
    { z: 18.5, v: -8, cell: 26, seed: 1400 },
    { z: 13.6, v: 10, cell: 30, seed: 1450 }
  ];

  function laneCars(lane, t, s, margin, fn) {
    var a = V.camX + (V.sx0 - W / 2) / s - margin - lane.v * t;
    var b = V.camX + (V.sx1 - W / 2) / s + margin - lane.v * t;
    for (var i = Math.floor(a / lane.cell); i <= Math.ceil(b / lane.cell); i++) {
      if (hash(i, lane.seed) > 0.62) continue;
      fn(i, (i + 0.6 * hash(i, lane.seed + 1)) * lane.cell + lane.v * t);
    }
  }

  function carAt(ctx, x, s, z, color, dir) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var L = 4.3;
    function X(u) { return sx(dir > 0 ? x + u : x + L - u, s); }
    shadow(ctx, X(L / 2), by, L * s, 0.4 * s);
    var body = col(color, z);
    ctx.fillStyle = body;
    ctx.beginPath();
    var x0 = Math.min(X(0), X(L));
    var x1 = Math.max(X(0), X(L));
    var r = 0.18 * s;
    ctx.moveTo(x0 + r, by - 0.98 * s);
    ctx.lineTo(x1 - r, by - 0.98 * s);
    ctx.quadraticCurveTo(x1, by - 0.98 * s, x1, by - 0.75 * s);
    ctx.lineTo(x1, by - 0.32 * s);
    ctx.lineTo(x0, by - 0.32 * s);
    ctx.lineTo(x0, by - 0.75 * s);
    ctx.quadraticCurveTo(x0, by - 0.98 * s, x0 + r, by - 0.98 * s);
    ctx.fill();
    quad(ctx, [X(0.95), by - 0.96 * s, X(1.55), by - 1.48 * s, X(3.2), by - 1.48 * s, X(3.55), by - 0.96 * s], body);
    quad(ctx, [X(1.15), by - 1.0 * s, X(1.65), by - 1.4 * s, X(2.3), by - 1.4 * s, X(2.3), by - 1.0 * s], glow(z, 0.1 * T.win, "#9fb4c4"));
    quad(ctx, [X(2.42), by - 1.0 * s, X(2.42), by - 1.4 * s, X(3.1), by - 1.4 * s, X(3.38), by - 1.0 * s], glow(z, 0.1 * T.win, "#9fb4c4"));
    rect(ctx, x0, by - 0.62 * s, x1 - x0, 0.05 * s + 0.4, col("#ffffff", z));
    var lampF = X(L - 0.05);
    var lampB = X(0.05);
    disc(ctx, lampF, by - 0.72 * s, 0.1 * s + 0.4, glow(z, 0.3 + 0.7 * T.win, "#fff4d8"));
    disc(ctx, lampB, by - 0.76 * s, 0.08 * s + 0.4, glow(z, 0.3 + 0.7 * T.win, "#ff4a3d"));
    var wr = 0.34 * s;
    var w1 = X(0.85);
    var w2 = X(3.45);
    disc(ctx, w1, by - wr, wr, col(C.tire, z));
    disc(ctx, w2, by - wr, wr, col(C.tire, z));
    disc(ctx, w1, by - wr, wr * 0.45, col("#b8bcc2", z));
    disc(ctx, w2, by - wr, wr * 0.45, col("#b8bcc2", z));
  }

  function laneLayer(lane) {
    return {
      z: lane.z,
      dynamic: true,
      motion: function (s, F) { return (Math.abs(lane.v) + F.panV) * F.T * s; },
      draw: function (ctx, s, z, tau) {
        var t = sim.t - tau;
        laneCars(lane, t, s, 6, function (i, x) {
          carAt(ctx, x, s, z, CAR_COLS[Math.floor(hash(i, lane.seed + 2) * CAR_COLS.length)], lane.v > 0 ? 1 : -1);
        });
      }
    };
  }

  function cityKerb(ctx, s, z) {
    var T = TIMES[state.tod];
    var fpx = V.fpx;
    var y0 = gy(fpx / 11.7);
    var y1 = gy(fpx / 11.35);
    rect(ctx, V.sx0, y0, V.sx1 - V.sx0, y1 - y0 + 1, col(C.curb, z));
    rect(ctx, V.sx0, y1, V.sx1 - V.sx0, V.sy1 - y1, col(C.pave, z));
    var by = gy(s);
    var r = cellRange(s, 15, 3);
    for (var i = r[0]; i <= r[1]; i++) {
      var x = i * 15 + 4;
      var X = sx(x, s);
      pool(ctx, sx(x + 0.6, s), gy(fpx / 10), 3.2 * s, 0.7 * s, "255,214,150", 0.5 * T.win);
      shadow(ctx, X, by, 0.4 * s, 4.5 * s);
      rect(ctx, X - 0.08 * s, by - 4.5 * s, 0.16 * s, 4.5 * s, col(C.pole, z));
      rect(ctx, X - 0.14 * s, by - 0.5 * s, 0.28 * s, 0.5 * s, col(C.pole, z));
      line(ctx, X, by - 4.45 * s, X + 0.62 * s, by - 4.55 * s, 0.08 * s, col(C.pole, z));
      quad(ctx, [X + 0.38 * s, by - 4.62 * s, X + 0.86 * s, by - 4.62 * s, X + 0.78 * s, by - 4.42 * s, X + 0.46 * s, by - 4.42 * s], col(C.pole, z));
      // planter with a tree
      var px = x + 7.5;
      var PX = sx(px, s);
      roundAt(ctx, PX, by - 0.55 * s, 4.2 * s, z, hash(i, 1500) < 0.5, i * 17 + 3);
      rect(ctx, PX - 0.6 * s, by - 0.6 * s, 1.2 * s, 0.6 * s, col(C.planter, z));
      rect(ctx, PX - 0.6 * s, by - 0.6 * s, 0.4 * s, 0.6 * s, col("#958b7d", z));
    }
  }

  function citySidewalk(ctx, s, z) {
    var fpx = V.fpx;
    var zTop = 9.6;
    var yTop = gy(fpx / zTop);
    rect(ctx, V.sx0, yTop, V.sx1 - V.sx0, V.sy1 - yTop, col(C.pave, z));
    var joint = col(C.paveDark, z);
    var rows = [8.4, 7.3, 6.4, 5.6, 4.9, 4.3, 3.8, 3.4, 3.0, 2.7];
    for (var k = 0; k < rows.length; k++) {
      var y = gy(fpx / rows[k]);
      if (y > V.sy1) break;
      rect(ctx, V.sx0, y, V.sx1 - V.sx0, Math.max(0.7, 0.02 * fpx / rows[k]), joint);
    }
    var sNear = fpx / 2.4;
    var sFar = fpx / zTop;
    var r = cellRange(sNear, 1.6, 2);
    ctx.strokeStyle = joint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = r[0]; i <= r[1]; i++) {
      var x = i * 1.6;
      ctx.moveTo(sx(x, sFar), gy(sFar));
      ctx.lineTo(sx(x, sNear), gy(sNear));
    }
    ctx.stroke();
    // a drain grate
    var sg = fpx / 8;
    var rg = cellRange(sg, 18, 1);
    for (var g = rg[0]; g <= rg[1]; g++) {
      var gx = sx(g * 18 + 2.5, sg);
      rect(ctx, gx, gy(sg) - 0.04 * sg, 0.8 * sg, 0.1 * sg, col("#5c5a55", z));
      for (var b = 0; b < 6; b++) rect(ctx, gx + (0.06 + b * 0.13) * sg, gy(sg) - 0.03 * sg, 0.04 * sg, 0.08 * sg, col("#3a3936", z));
    }
  }

  function cityFore(ctx, s, z) {
    var by = gy(s);
    var r = cellRange(s, 2.8, 1);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1600) > 0.55) continue;
      var X = sx((i + 0.3 * hash(i, 1601)) * 2.8, s);
      shadow(ctx, X, by, 0.25 * s, 0.9 * s);
      rect(ctx, X - 0.09 * s, by - 0.9 * s, 0.18 * s, 0.9 * s, col(C.bollard, z));
      disc(ctx, X, by - 0.9 * s, 0.09 * s, col(C.bollard, z));
      rect(ctx, X - 0.09 * s, by - 0.72 * s, 0.18 * s, 0.08 * s, col(C.band, z));
    }
    var rh = cellRange(s, 30, 1);
    for (var h = rh[0]; h <= rh[1]; h++) {
      var hx = sx(h * 30 - 1.6, s);
      shadow(ctx, hx, by, 0.4 * s, 0.75 * s);
      rect(ctx, hx - 0.15 * s, by - 0.62 * s, 0.3 * s, 0.62 * s, col(C.hydrant, z));
      disc(ctx, hx, by - 0.62 * s, 0.15 * s, col(C.hydrant, z));
      rect(ctx, hx - 0.25 * s, by - 0.45 * s, 0.5 * s, 0.1 * s, col(C.hydrant, z));
      rect(ctx, hx - 0.19 * s, by - 0.12 * s, 0.38 * s, 0.12 * s, col("#9a3329", z));
    }
  }

  function cityLights(G, out) {
    var T = TIMES[state.tod];
    var lampA = 0.12 + 0.88 * T.win;
    var r = G.range(11);
    for (var i = Math.floor(r[0] / 15) - 1; i <= Math.ceil(r[1] / 15); i++) {
      out.push({ x: i * 15 + 4.62, y: 4.48, z: 10.95, r: 0.16, c: "255,226,170", a: lampA, halo: 1 });
    }
    var rf = G.range(28);
    for (var j = Math.floor(rf[0] / 22) - 1; j <= Math.ceil(rf[1] / 22); j++) {
      out.push({ x: j * 22 + 10.8, y: 4.5, z: 27.9, r: 0.18, c: "255,226,170", a: lampA, halo: 1 });
      for (var k = 0; k < 2; k++) {
        var si = j * 2 + k;
        if (hash(si, 1304) < 0.45) out.push({ x: si * 11 + 3.7, y: 2.2, z: 27.9, r: 0.45, c: "255,111,181", a: 0.15 + 0.6 * T.win });
      }
    }
    // headlights and taillights. Index ranges use the mid-exposure time so the
    // list of lights is identical for every time sample (needed for trails).
    for (var l = 0; l < LANES.length; l++) {
      var lane = LANES[l];
      var rr = G.range(lane.z);
      var pad = Math.abs(lane.v) * G.T + lane.cell;
      var a = rr[0] - pad - lane.v * G.tRef;
      var b = rr[1] + pad - lane.v * G.tRef;
      var dir = lane.v > 0 ? 1 : -1;
      for (var n = Math.floor(a / lane.cell); n <= Math.ceil(b / lane.cell); n++) {
        if (hash(n, lane.seed) > 0.62) continue;
        var x = (n + 0.6 * hash(n, lane.seed + 1)) * lane.cell + lane.v * G.t;
        var front = dir > 0 ? x + 4.3 : x;
        var back = dir > 0 ? x : x + 4.3;
        out.push({ x: front, y: 0.72, z: lane.z - 0.3, r: 0.12, c: "255,246,220", a: 0.25 + 0.75 * T.win, halo: 1 });
        out.push({ x: back, y: 0.76, z: lane.z - 0.3, r: 0.09, c: "255,60,50", a: 0.25 + 0.75 * T.win });
      }
    }
    festoonLights(out, G, 4.6, 8, 2.0, 0.42, 0.55, T.lights);
  }

  // ---------------------------------------------------------------------------
  // Scene: beach
  // ---------------------------------------------------------------------------

  var BAR_CELL = 70;
  var BAR_X = -5.5;

  function beachIsland(ctx, s, z) {
    var by = gy(s);
    var r = cellRange(s, 1700, 400);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1700) > 0.75) continue;
      var x = i * 1700 + 300 * hash(i, 1701);
      var w = 260 + 200 * hash(i, 1702);
      var ht = 25 + 30 * hash(i, 1703);
      ctx.fillStyle = col(C.island, 700);
      ctx.beginPath();
      ctx.ellipse(sx(x, s), by, w / 2 * s, ht * s, 0, Math.PI, 0);
      ctx.fill();
      var lx = sx(x + w * 0.22, s);
      var ly = sy(ht * 0.55, s);
      for (var k = 0; k < 4; k++) rect(ctx, lx - 2.5 * s, ly - (k + 1) * 4 * s, 5 * s, 4 * s, col(k % 2 ? C.lightB : C.lightA, 700));
      rect(ctx, lx - 3 * s, ly - 18 * s, 6 * s, 2 * s, col(C.cornice, 700));
    }
  }

  function beachSea(ctx, s, z) {
    var T = TIMES[state.tod];
    var g = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + V.fpx * 0.25);
    g.addColorStop(0, col(C.sea, 1400));
    g.addColorStop(0.12, col(C.sea, 260));
    g.addColorStop(1, col(C.seaDeep, 40));
    ctx.fillStyle = g;
    ctx.fillRect(V.sx0, HORIZON - 0.5, V.sx1 - V.sx0, V.sy1 - HORIZON);
    // sun or moon reflection path
    var src = sunFor();
    var rgb = src && !src.hidden ? src.color : T.moon ? "215,225,255" : null;
    var body = src && !src.hidden ? src : T.moon;
    if (rgb && body.el > -0.02) {
      var p = skyPos(body.az, body.el);
      var cw = V.fpx * 0.05;
      ctx.globalCompositeOperation = "lighter";
      for (var k = 0; k < 46; k++) {
        var f = k / 46;
        var y = HORIZON + f * f * (V.sy1 - HORIZON);
        var len = cw * (0.4 + hash(k, 1710)) * (1 + f * 3);
        var jit = Math.sin(V.t * 1.3 + k * 1.7) * cw * 0.3;
        ctx.fillStyle = "rgba(" + rgb + "," + (0.28 * (1 - f * 0.6)).toFixed(3) + ")";
        ctx.fillRect(p.x - len / 2 + jit, y, len, Math.max(0.7, 1 + f * 4));
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function beachBoats(ctx, s, z) {
    var r = cellRange(s, 220, 20);
    var by = gy(s);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1720) > 0.55) continue;
      var x = i * 220 + 80 * hash(i, 1721) + V.t * 0.6;
      var bob = Math.sin(V.t * 1.1 + i) * 0.25 * s;
      var X = sx(x, s);
      var yb = by + bob;
      quad(ctx, [X - 4 * s, yb - 1.1 * s, X + 4.2 * s, yb - 1.1 * s, X + 3 * s, yb, X - 3.2 * s, yb], col(hash(i, 1722) < 0.5 ? "#f1ece0" : "#c8543c", z));
      rect(ctx, X - 0.1 * s, yb - 11 * s, 0.2 * s, 10 * s, col(C.cornice, z));
      tri(ctx, X + 0.1 * s, yb - 10.6 * s, X + 0.1 * s, yb - 1.6 * s, X + 4 * s, yb - 1.6 * s, col("#fbf8f0", z));
      tri(ctx, X - 0.1 * s, yb - 9.2 * s, X - 0.1 * s, yb - 1.6 * s, X - 3 * s, yb - 1.6 * s, col("#e9b44c", z));
    }
  }

  function beachWaves(ctx, s, z) {
    var depths = [150, 105, 80, 62, 48, 38, 30];
    for (var k = 0; k < depths.length; k++) {
      var d = depths[k];
      var sd = V.fpx / d;
      var y0 = gy(sd);
      var amp = 0.08 * sd;
      ctx.strokeStyle = col(C.seaLight, d);
      ctx.lineWidth = Math.max(0.6, 0.06 * sd);
      ctx.beginPath();
      for (var px = V.sx0; px <= V.sx1; px += 8) {
        var xw = V.camX + (px - W / 2) / sd;
        var y = y0 + Math.sin(xw * 0.35 + V.t * 0.9 + d) * amp;
        if (px === V.sx0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
  }

  function beachSurf(ctx, s, z) {
    var fpx = V.fpx;
    var yTop = gy(fpx / 27);
    rect(ctx, V.sx0, yTop, V.sx1 - V.sx0, V.sy1 - yTop, col(C.seaShallow, z));
    var lines = [[24, 0.15, 0.4], [20.4, 0.28, 0.9]];
    for (var k = 0; k < lines.length; k++) {
      var zf = lines[k][0] + 0.6 * Math.sin(V.t * 0.5 + k);
      var sf = fpx / zf;
      var yf = gy(sf);
      var th = lines[k][1] * sf;
      ctx.fillStyle = col(C.foam, z);
      ctx.beginPath();
      ctx.moveTo(V.sx0, yf);
      for (var px = V.sx0; px <= V.sx1 + 6; px += 6) {
        var xw = V.camX + (px - W / 2) / sf;
        ctx.lineTo(px, yf - th * (0.5 + 0.5 * Math.sin(xw * 1.3 + V.t * lines[k][2])));
      }
      for (var px2 = V.sx1 + 6; px2 >= V.sx0; px2 -= 6) {
        var xw2 = V.camX + (px2 - W / 2) / sf;
        ctx.lineTo(px2, yf + th * (0.4 + 0.3 * Math.sin(xw2 * 2.1 + 1)));
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function palmAt(ctx, bx, by, s, h, z, seed) {
    var lean = (hash(seed, 1) - 0.5) * 0.6;
    shadow(ctx, bx, by, 0.6 * s, h * s);
    var n = 9;
    var pts = [];
    for (var k = 0; k <= n; k++) {
      var u = k / n;
      pts.push([bx + lean * h * Math.pow(u, 1.6) * s, by - u * h * s]);
    }
    ctx.strokeStyle = col(C.palmTrunk, z);
    ctx.lineCap = "round";
    for (var j = 0; j < n; j++) {
      ctx.lineWidth = (0.36 - 0.14 * j / n) * s;
      ctx.beginPath();
      ctx.moveTo(pts[j][0], pts[j][1]);
      ctx.lineTo(pts[j + 1][0], pts[j + 1][1]);
      ctx.stroke();
      rect(ctx, pts[j][0] - 0.16 * s, pts[j][1] - 0.04 * s, 0.32 * s, Math.max(0.6, 0.04 * s), col(C.coconut, z));
    }
    var top = pts[n];
    for (var f = 0; f < 8; f++) {
      var ang = -2.4 + 4.8 * f / 7 + (hash(seed, f + 3) - 0.5) * 0.3;
      frond(ctx, top[0], top[1], ang, (2.2 + 0.6 * hash(seed, f + 20)) * s, col(f % 2 ? C.palmLeafLight : C.palmLeaf, z), 1.2);
    }
    for (var c = 0; c < 3; c++) disc(ctx, top[0] + (c - 1) * 0.16 * s, top[1] + 0.15 * s, 0.12 * s, col(C.coconut, z));
  }

  function tikiBar(ctx, x, s, z) {
    var T = TIMES[state.tod];
    var by = gy(s);
    var X0 = sx(x - 2.8, s);
    var X1 = sx(x + 2.8, s);
    shadow(ctx, sx(x, s), by, 5.6 * s, 3 * s);
    pool(ctx, sx(x, s), by + 0.3 * s, 4 * s, 0.7 * s, "255,180,100", 0.4 * T.win);
    for (var p = 0; p < 4; p++) {
      var px = X0 + (X1 - X0) * (0.05 + p * 0.3);
      rect(ctx, px, by - 2.6 * s, 0.18 * s, 2.6 * s, col(C.bamboo, z));
      for (var r = 1; r < 4; r++) rect(ctx, px, by - r * 0.65 * s, 0.18 * s, Math.max(0.6, 0.04 * s), col(C.strawDark, z));
    }
    // shelf with bottles
    rect(ctx, X0 + 0.3 * s, by - 1.95 * s, (X1 - X0) - 0.6 * s, 0.07 * s, col(C.woodDark, z));
    for (var b = 0; b < 12; b++) {
      var bxp = X0 + (0.5 + b * 0.4) * s;
      rect(ctx, bxp, by - 2.3 * s, 0.13 * s, 0.35 * s, glow(z, 0.3 + 0.5 * T.win, BOTTLES[b % BOTTLES.length]));
    }
    rect(ctx, X0, by - 1.15 * s, X1 - X0, 1.15 * s, col(C.wood, z));
    rect(ctx, X0, by - 1.15 * s, X1 - X0, 0.12 * s, col(C.woodLight, z));
    for (var pl = 0; pl < 9; pl++) rect(ctx, X0 + (X1 - X0) * pl / 9, by - 1.0 * s, Math.max(0.6, 0.03 * s), 1.0 * s, col(C.woodDark, z));
    // straw roof
    quad(ctx, [X0 - 0.6 * s, by - 2.6 * s, X1 + 0.6 * s, by - 2.6 * s, X1 - 0.3 * s, by - 3.6 * s, X0 + 0.3 * s, by - 3.6 * s], col(C.straw, z));
    for (var fr = 0; fr < 22; fr++) {
      var fx = X0 - 0.6 * s + (X1 - X0 + 1.2 * s) * (fr + 0.5) / 22;
      tri(ctx, fx - 0.18 * s, by - 2.62 * s, fx + 0.18 * s, by - 2.62 * s, fx, by - 2.25 * s, col(fr % 2 ? C.strawDark : C.straw, z));
    }
    rect(ctx, sx(x - 1.3, s), by - 3.45 * s, 2.6 * s, 0.55 * s, col("#3a2a1e", z));
    text(ctx, "TIKI BAR", sx(x, s), by - 3.17 * s, 0.36 * s, glow(z, 0.2 + 0.8 * T.win, "#ffd27a"), 800);
    // stools
    for (var st = 0; st < 3; st++) {
      var stx = X0 + (1 + st * 1.6) * s;
      rect(ctx, stx, by - 0.75 * s, 0.07 * s, 0.75 * s, col(C.woodDark, z));
      rect(ctx, stx - 0.2 * s, by - 0.8 * s, 0.47 * s, 0.1 * s, col(C.woodLight, z));
    }
    // torches
    for (var tch = 0; tch < 2; tch++) {
      var tx = sx(x + (tch ? 3.4 : -3.4), s);
      rect(ctx, tx - 0.05 * s, by - 1.85 * s, 0.1 * s, 1.85 * s, col(C.bamboo, z));
      quad(ctx, [tx - 0.12 * s, by - 1.95 * s, tx + 0.12 * s, by - 1.95 * s, tx + 0.08 * s, by - 1.75 * s, tx - 0.08 * s, by - 1.75 * s], col(C.woodDark, z));
    }
  }

  var BOTTLES = ["#5aa37a", "#c98a2a", "#3b6fb6", "#d64f3c"];

  function beachShore(ctx, s, z) {
    var fpx = V.fpx;
    var yShore = gy(fpx / 18.8);
    var yWet = gy(fpx / 17);
    rect(ctx, V.sx0, yShore, V.sx1 - V.sx0, yWet - yShore + 1, col(C.sandWet, z));
    rect(ctx, V.sx0, yWet, V.sx1 - V.sx0, V.sy1 - yWet, col(C.sand, z));
    var by = gy(s);
    var r = cellRange(s, 13, 4);
    for (var i = r[0]; i <= r[1]; i++) {
      if (hash(i, 1800) > 0.6) continue;
      var x = (i + hash(i, 1801)) * 13;
      if (Math.abs(mod(x - BAR_X + BAR_CELL / 2, BAR_CELL) - BAR_CELL / 2) < 6) continue;
      palmAt(ctx, sx(x, s), by, s, 6 + 2.5 * hash(i, 1802), z, i * 3 + 1);
    }
    var rb = cellRange(s, BAR_CELL, 6);
    for (var j = rb[0]; j <= rb[1]; j++) tikiBar(ctx, j * BAR_CELL + BAR_X, s, z);
  }

  function beachSand(ctx, s, z) {
    var fpx = V.fpx;
    var ripples = [12, 10, 8.5, 7.2, 6.1, 5.2, 4.5, 3.9, 3.4];
    for (var k = 0; k < ripples.length; k++) {
      var d = ripples[k];
      var sd = fpx / d;
      var y0 = gy(sd);
      if (y0 > V.sy1 + 4) break;
      ctx.strokeStyle = col(k % 2 ? C.sandLight : C.sandDark, z);
      ctx.lineWidth = Math.max(0.7, 0.025 * sd);
      ctx.beginPath();
      for (var px = V.sx0; px <= V.sx1; px += 10) {
        var xw = V.camX + (px - W / 2) / sd;
        var y = y0 + Math.sin(xw * 0.9 + d) * 0.03 * sd;
        if (px === V.sx0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    // footprints
    var sf = fpx / 9;
    var rf = cellRange(sf, 0.75, 1);
    ctx.fillStyle = col(C.sandDark, z);
    for (var f = rf[0]; f <= rf[1]; f++) {
      ctx.beginPath();
      ctx.ellipse(sx(f * 0.75, sf), gy(sf) + (f % 2 ? 0.12 : -0.05) * sf * 0.25, 0.11 * sf, 0.03 * sf, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // shells
    var sh = fpx / 7.5;
    var rs = cellRange(sh, 1.1, 1);
    for (var i = rs[0]; i <= rs[1]; i++) {
      if (hash(i, 1900) > 0.25) continue;
      var X = sx((i + hash(i, 1901)) * 1.1, sh);
      var Y = gy(sh) + (hash(i, 1902) - 0.5) * 0.4 * sh * 0.25;
      ctx.fillStyle = col(C.shell, z);
      ctx.beginPath();
      ctx.arc(X, Y, 0.06 * sh, Math.PI, 0);
      ctx.fill();
    }
    // sandcastle and a beach ball
    var sc = fpx / 6.6;
    var rc = cellRange(sc, 40, 2);
    for (var c = rc[0]; c <= rc[1]; c++) {
      var cx = sx(c * 40 - 2.6, sc);
      var cy = gy(sc);
      shadow(ctx, cx, cy, 0.9 * sc, 0.5 * sc);
      rect(ctx, cx - 0.45 * sc, cy - 0.22 * sc, 0.9 * sc, 0.22 * sc, col(C.castle, z));
      for (var tw = 0; tw < 3; tw++) {
        var tx = cx + (tw - 1) * 0.32 * sc;
        var th = (tw === 1 ? 0.5 : 0.38) * sc;
        rect(ctx, tx - 0.1 * sc, cy - th, 0.2 * sc, th, col(C.castle, z));
        rect(ctx, tx - 0.1 * sc, cy - th, 0.07 * sc, th, col(C.sandLight, z));
      }
      rect(ctx, cx - 0.005 * sc, cy - 0.7 * sc, 0.012 * sc + 0.4, 0.2 * sc, col(C.cornice, z));
      tri(ctx, cx, cy - 0.7 * sc, cx + 0.14 * sc, cy - 0.65 * sc, cx, cy - 0.6 * sc, col(C.lightA, z));
      var bx = sx(c * 40 + 1.6, sc);
      var br = 0.18 * sc;
      disc(ctx, bx, cy - br, br, col(C.ball1, z));
      ctx.fillStyle = col("#ffffff", z);
      ctx.beginPath();
      ctx.arc(bx, cy - br, br, -0.5, 0.5);
      ctx.lineTo(bx, cy - br);
      ctx.fill();
      ctx.fillStyle = col(C.ball2, z);
      ctx.beginPath();
      ctx.arc(bx, cy - br, br, 2.6, 3.6);
      ctx.lineTo(bx, cy - br);
      ctx.fill();
    }
  }

  function beachFore(ctx, s, z) {
    var by = gy(s);
    var r = cellRange(s, 16, 3);
    for (var i = r[0]; i <= r[1]; i++) {
      var x = i * 16 + 2.3;
      var X = sx(x, s);
      shadow(ctx, X, by, 2.4 * s, 2 * s);
      line(ctx, X, by, X - 0.1 * s, by - 2.1 * s, 0.05 * s, col("#e8e4da", z));
      var cy = by - 2.1 * s;
      var rr = 1.25 * s;
      for (var k = 0; k < 8; k++) {
        ctx.fillStyle = col(k % 2 ? C.lightB : C.lightA, z);
        ctx.beginPath();
        ctx.moveTo(X - 0.1 * s, cy - 0.35 * s);
        ctx.ellipse(X - 0.1 * s, cy + 0.1 * s, rr, 0.45 * s, 0, Math.PI + k * Math.PI / 8, Math.PI + (k + 1) * Math.PI / 8);
        ctx.closePath();
        ctx.fill();
      }
    }
    var rt = cellRange(s, 0.6, 0.3);
    for (var t = rt[0]; t <= rt[1]; t++) {
      if (hash(t, 2000) > 0.35) continue;
      tuft(ctx, sx((t + hash(t, 2001)) * 0.6, s), by + 2, (0.3 + 0.3 * hash(t, 2002)) * s, col("#8aa35a", z));
    }
  }

  var GULL_Z = 30;
  var gullLayer = {
    z: GULL_Z,
    dynamic: true,
    motion: function (s, F) { return (5 + F.panV) * F.T * s + 0.3 * s; },
    draw: function (ctx, s, z, tau) {
      var t = sim.t - tau;
      var r = cellRange(s, 35, 3);
      var shift = Math.floor(5 * t / 35);
      for (var i = r[0] - shift - 1; i <= r[1] - shift + 1; i++) {
        if (hash(i, 2100) > 0.55) continue;
        var x = (i + hash(i, 2101)) * 35 + 5 * t;
        var y = 7 + 4 * hash(i, 2102) + 0.4 * Math.sin(t * 0.7 + i);
        var flap = Math.sin(t * 9 + i * 2);
        var X = sx(x, s);
        var Y = sy(y, s);
        var span = 0.6 * s;
        ctx.strokeStyle = col(C.gull, z);
        ctx.lineWidth = Math.max(0.8, 0.08 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(X - span, Y + flap * 0.25 * s);
        ctx.quadraticCurveTo(X - span * 0.4, Y - 0.25 * s - flap * 0.1 * s, X, Y);
        ctx.quadraticCurveTo(X + span * 0.4, Y - 0.25 * s - flap * 0.1 * s, X + span, Y + flap * 0.25 * s);
        ctx.stroke();
        disc(ctx, X - span, Y + flap * 0.25 * s, 0.05 * s + 0.4, col(C.gullTip, z));
        disc(ctx, X + span, Y + flap * 0.25 * s, 0.05 * s + 0.4, col(C.gullTip, z));
      }
    }
  };

  function beachLights(G, out) {
    var T = TIMES[state.tod];
    var r = G.range(15);
    for (var i = Math.floor((r[0] - 6) / BAR_CELL); i <= Math.ceil((r[1] + 6) / BAR_CELL); i++) {
      var x = i * BAR_CELL + BAR_X;
      for (var k = 0; k <= 14; k++) {
        var u = k / 14;
        out.push({ x: x - 3.3 + 6.6 * u, y: 2.5 - 0.25 * 4 * u * (1 - u), z: 14.9, r: 0.05, c: BULBS[k % 5], a: T.lights * (0.85 + 0.15 * Math.sin(G.t * 2.5 + k)), halo: 1 });
      }
      for (var tch = 0; tch < 2; tch++) {
        out.push({ x: x + (tch ? 3.4 : -3.4), y: 2.05, z: 14.9, r: 0.1, c: "255,150,60", a: (0.3 + 0.7 * T.win) * (0.8 + 0.2 * Math.sin(G.t * 13 + tch * 3)), halo: 1 });
      }
    }
    var ri = G.range(1500);
    for (var j = Math.floor(ri[0] / 1700) - 1; j <= Math.ceil(ri[1] / 1700); j++) {
      if (hash(j, 1700) > 0.75) continue;
      var lx = j * 1700 + 300 * hash(j, 1701) + (260 + 200 * hash(j, 1702)) * 0.22;
      var ht = 25 + 30 * hash(j, 1703);
      var beam = Math.pow(Math.max(0, Math.cos(G.t * 1.4 + j)), 16);
      out.push({ x: lx, y: ht * 0.55 + 17, z: 1490, r: 1.6, c: "255,240,200", a: T.win * (0.25 + 0.75 * beam), halo: 1 });
    }
    if (T.win > 0.3) {
      var rb = G.range(260);
      for (var b = Math.floor(rb[0] / 220) - 1; b <= Math.ceil(rb[1] / 220); b++) {
        if (hash(b, 1720) > 0.55) continue;
        out.push({ x: b * 220 + 80 * hash(b, 1721) + G.t * 0.6, y: 11 + Math.sin(G.t * 1.1 + b) * 0.25 - 0.2, z: 258, r: 0.4, c: "255,90,80", a: T.win });
      }
    }
    // glitter on the water under the sun or moon
    var src = sunFor();
    var body = src && !src.hidden ? src : T.moon;
    if (body && body.el > -0.02) {
      var rgb = src && !src.hidden ? src.color : "215,225,255";
      var px = W / 2 + Math.tan(body.az) * V.fpx;
      var strength = state.tod === "golden" ? 1 : state.tod === "noon" ? 0.7 : 0.6;
      for (var g = 0; g < 70; g++) {
        var d = 26 + 240 * Math.pow(hash(g, 2200), 2);
        var sd = V.fpx / d;
        var spread = V.fpx * 0.03 + sd * 4;
        var gx = G.camRef + (px + (hash(g, 2201) - 0.5) * 2 * spread - W / 2) / sd;
        var tw = Math.pow(Math.max(0, Math.sin(G.t * (4 + 3 * hash(g, 2202)) + 6.28 * hash(g, 2203))), 10);
        out.push({ x: gx, y: 0.03, z: d, r: 0.07, c: rgb, a: strength * tw });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scenes
  // ---------------------------------------------------------------------------

  var SCENES = {
    forest: {
      label: "Forest",
      layers: [
        { z: Infinity, draw: drawSky },
        { z: 3000, draw: drawClouds },
        { z: 900, draw: drawHills },
        { z: 80, draw: forestFar },
        { z: 35, draw: forestBack },
        { z: 30, overlay: true, draw: drawRays },
        { z: 20, draw: forestHut },
        { z: 15, draw: forestMid },
        { z: 8.4, draw: forestPath },
        { z: 5.6, draw: forestVerge },
        festoonLayer(3, 7, 1.55, 0.38),
        { z: 2.2, draw: forestFerns }
      ],
      lights: forestLights,
      marks: [
        { z: 2.2, label: "ferns" }, { z: 3, label: "lights" }, { z: 9.2, label: "sign" },
        { z: 15, label: "trees" }, { z: 20, label: "hut" }, { z: 80, label: "forest" }, { z: 900, label: "hills" }
      ]
    },
    city: {
      label: "City",
      layers: [
        { z: Infinity, draw: drawSky },
        { z: 3000, draw: drawClouds },
        { z: 700, draw: citySkyline },
        { z: 140, draw: cityTowers },
        { z: 28, draw: cityStreet },
        laneLayer(LANES[0]),
        { z: 16, draw: cityRoad },
        laneLayer(LANES[1]),
        { z: 11, draw: cityKerb },
        { z: 7, draw: citySidewalk },
        festoonLayer(4.6, 8, 2.0, 0.42),
        { z: 3.2, draw: cityFore }
      ],
      lights: cityLights,
      movingLights: true,
      marks: [
        { z: 3.2, label: "bollards" }, { z: 4.6, label: "lights" }, { z: 11, label: "lamps" },
        { z: 13.6, label: "cars" }, { z: 28, label: "shops" }, { z: 140, label: "towers" }
      ]
    },
    beach: {
      label: "Beach",
      fogScale: 2.6,
      sun: { golden: { az: -0.2, el: 0.06 }, noon: { az: -0.3, el: 0.7 } },
      layers: [
        { z: Infinity, draw: drawSky },
        { z: 3000, draw: drawClouds },
        { z: 1500, draw: beachIsland },
        { z: 600, draw: beachSea },
        { z: 260, draw: beachBoats },
        { z: 55, draw: beachWaves },
        gullLayer,
        { z: 21, draw: beachSurf },
        { z: 15, draw: beachShore },
        { z: 7, draw: beachSand },
        { z: 2.8, draw: beachFore }
      ],
      lights: beachLights,
      marks: [
        { z: 2.8, label: "umbrella" }, { z: 6.6, label: "castle" }, { z: 15, label: "bar" },
        { z: 21, label: "surf" }, { z: 260, label: "boats" }, { z: 1500, label: "island" }
      ]
    }
  };

  // ---------------------------------------------------------------------------
  // Subject: a runner or a person standing and waving
  // ---------------------------------------------------------------------------

  function runPose(ph, A, lean) {
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
    return { hip: hip, sh: sh, head: head, legs: legs, arms: arms, dy: -minY, lean: lean };
  }

  function standPose(t) {
    var breathe = 0.006 * Math.sin(t * 1.7);
    var hip = [0, 0.94];
    var sh = [0.01, 1.44 + breathe];
    var head = [0.03, 1.65 + breathe];
    var legs = [];
    var arms = [];
    var spread = [0.07, -0.06];
    for (var side = 0; side < 2; side++) {
      var th = spread[side];
      var knee = [Math.sin(th) * 0.46, hip[1] - Math.cos(th) * 0.46];
      var sa = th - 0.03;
      var foot = [knee[0] + Math.sin(sa) * 0.44, knee[1] - Math.cos(sa) * 0.44];
      legs.push([hip, knee, foot, [foot[0] + 0.13, foot[1]]]);
    }
    // wave every few seconds with the near arm
    var c = mod(t, 6.5);
    var wave = c < 2.4 ? Math.sin(Math.PI * c / 2.4) : 0;
    wave = Math.min(1, wave * 1.6);
    for (var a = 0; a < 2; a++) {
      var ua = a === 0 ? 0.1 + wave * 2.5 : -0.08;
      var elbow = [sh[0] + Math.sin(ua) * 0.29, sh[1] - Math.cos(ua) * 0.29];
      var fa = a === 0 ? ua + 0.15 - wave * 0.5 + wave * 0.45 * Math.sin(t * 10) : ua + 0.12;
      arms.push([sh, elbow, [elbow[0] + Math.sin(fa) * 0.27, elbow[1] - Math.cos(fa) * 0.27]]);
    }
    var minY = Math.min(legs[0][2][1], legs[1][2][1]) - 0.04;
    return { hip: hip, sh: sh, head: head, legs: legs, arms: arms, dy: -minY, lean: 0 };
  }

  function drawPerson(ctx, s, z, px, P) {
    var bx = sx(px, s);
    var by = gy(s);
    var dy = P.dy;

    function X(p) { return bx + p[0] * s; }
    function Y(p) { return by - (p[1] + dy) * s; }

    function limb(pts, width, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * s;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(X(pts[0]), Y(pts[0]));
      for (var i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), Y(pts[i]));
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

    shadow(ctx, bx + 0.05 * s, by, 0.6 * s, 1.7 * s);

    arm(P.arms[1], false);
    leg(P.legs[1], false);
    limb([P.hip, [P.hip[0] + Math.sin(P.lean) * 0.03, P.hip[1] + 0.03]], 0.28, col(C.shorts, z));
    var waist = [P.hip[0] + Math.sin(P.lean) * 0.12, P.hip[1] + 0.12];
    limb([waist, P.sh], 0.3, col(C.shirt, z));
    // collar and a chest logo: small details that make focus easy to judge
    var lx = waist[0] + (P.sh[0] - waist[0]) * 0.6 + 0.04;
    var ly = waist[1] + (P.sh[1] - waist[1]) * 0.6;
    limb([[lx - 0.035, ly], [lx + 0.035, ly]], 0.05, col("#f2d16b", z));
    limb([[P.sh[0] - 0.05, P.sh[1] + 0.06], [P.sh[0] + 0.07, P.sh[1] + 0.06]], 0.04, col(C.shirtDark, z));
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
    disc(ctx, hx + hr * 0.42, hy + hr * 0.42, hr * 0.1, col("#c97b62", z));

    arm(P.arms[0], true);
  }

  var SUBJECT = {
    z: 6,
    dynamic: true,
    subject: true,
    draw: function (ctx, s, z, tau, F) {
      var x = F.subjectX(tau);
      if (running()) {
        var A = clamp(state.speed / 5, 0.4, 1);
        drawPerson(ctx, s, z, x, runPose(sim.phase - tau * cadence() * Math.PI * 2, A, Math.min(0.32, 0.04 + 0.03 * state.speed)));
      } else {
        drawPerson(ctx, s, z, x, standPose(sim.t - tau));
      }
    },
    bounds: function (s, tau, F) {
      var cx = W / 2 + (F.subjectX(tau) - F.camAt(tau)) * s;
      return [cx - 1.6 * s, sy(2.4, s), cx + 1.6 * s, gy(s) + 0.3 * s];
    }
  };

  function layerList() {
    var arr = scene().layers.slice();
    SUBJECT.z = state.subjectZ;
    arr.push(SUBJECT);
    arr.sort(function (a, b) { return b.z - a.z; });
    return arr;
  }

  // ---------------------------------------------------------------------------
  // Canvases
  // ---------------------------------------------------------------------------

  var viewfinder = document.getElementById("viewfinder");
  var main = document.getElementById("view");
  var mctx = main.getContext("2d");
  var sceneCanvas = document.createElement("canvas");
  var sctx = sceneCanvas.getContext("2d");
  var q = Math.min(window.devicePixelRatio || 1, 1.5);
  var liveMax = 24;

  var hasFilter = (function () {
    var c = document.createElement("canvas").getContext("2d");
    if (!("filter" in c)) return false;
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  })();

  var zbuf = document.createElement("canvas");
  var zctx = zbuf.getContext("2d");
  var pk = document.createElement("canvas");
  var pkctx = pk.getContext("2d");
  var pt = document.createElement("canvas");
  var ptctx = pt.getContext("2d");

  function sizeCanvases() {
    var w = Math.round(W * q);
    var h = Math.round(H * q);
    [main, sceneCanvas, zbuf, pk, pt].forEach(function (c) { c.width = w; c.height = h; });
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

  var grainPat = mctx.createPattern(makeNoise(256, false), "repeat");
  var speckPat = mctx.createPattern(makeNoise(256, true), "repeat");

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

  function nFromPx(px, nMax) {
    return px > 0.75 ? clamp(Math.ceil(px / 2) + 1, 2, nMax) : 1;
  }

  function frameInfo(capture) {
    var T = shutter();
    var run = running();
    var v = run ? state.speed : 0;
    var z = state.subjectZ;
    var w = viewWidthAt(z);
    var lead = w * 0.12;
    var pan = state.pan && run;
    var F = {
      T: T,
      nMax: capture ? 96 : liveMax,
      panV: pan ? v : 0,
      camAt: function (tau) {
        return pan ? sim.dist - tau * v + lead : STATIC_X;
      },
      subjectX: function (tau) {
        if (!run) return STATIC_X - w * 0.1;
        var d = sim.dist - tau * v;
        if (pan) return d;
        var loop = w + 2.5 + v * 0.3;
        return STATIC_X - w / 2 - 1.2 + mod(d, loop);
      }
    };
    var s = V.fpx / z;
    var limb = run ? (1.2 * v + 1.5) * T * s : 0.9 * T * s;
    var body = run && !pan ? v * T * s : 0;
    F.nSubject = clamp(Math.ceil((body + limb * 0.6) / 2.5) + 1, 1, F.nMax);
    return F;
  }

  // Point lights are sampled across the exposure so moving ones leave trails.
  function collectLights(F, capture) {
    var sc = scene();
    var T = F.T;
    var moving = F.panV > 0 || sc.movingLights;
    var m = moving ? (capture ? 40 : 14) : 1;
    var cams = [F.camAt(T), F.camAt(0)];
    var camLo = Math.min(cams[0], cams[1]);
    var camHi = Math.max(cams[0], cams[1]);
    var G = {
      T: T,
      tRef: sim.t - T / 2,
      camRef: F.camAt(T / 2),
      t: 0,
      range: function (z) {
        var hw = (W / 2 + 90) / (V.fpx / z);
        return [camLo - hw, camHi + hw];
      }
    };
    var samples = [];
    for (var j = 0; j < m; j++) {
      var tau = m === 1 ? T / 2 : T * (1 - j / (m - 1));
      G.t = sim.t - tau;
      var arr = [];
      sc.lights(G, arr);
      samples.push({ cam: F.camAt(tau), arr: arr });
    }
    var base = samples[Math.floor((m - 1) / 2)].arr;
    var out = [];
    for (var i = 0; i < base.length; i++) {
      var L = base[i];
      if (L.a <= 0.01) continue;
      var s = V.fpx / L.z;
      var pts = [];
      for (var k = 0; k < m; k++) {
        var p = samples[k].arr[i];
        if (!p) continue;
        pts.push(W / 2 + (p.x - samples[k].cam) * s, HORIZON + (CAM_H - p.y) * s);
      }
      out.push({ z: L.z, r: L.r, c: L.c, a: L.a, halo: L.halo, pts: pts });
    }
    out.sort(function (a, b) { return b.z - a.z; });
    return out;
  }

  function bokehPath(ctx, x, y, r, hex) {
    ctx.beginPath();
    if (hex) {
      for (var i = 0; i < 6; i++) {
        var t = 0.3 + i * Math.PI / 3;
        if (i === 0) ctx.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
        else ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }

  function drawLight(ctx, L) {
    var s = V.fpx / L.z;
    var rs = Math.max(0.6, L.r * s);
    var rb = Math.max(rs, cocPx(L.z) * 0.5);
    var k = clamp(3 * (rs / rb) * (rs / rb), 0.12, 1);
    var p = L.pts;
    var n = p.length / 2;
    var len = 0;
    var minX = p[0];
    var maxX = p[0];
    for (var i = 1; i < n; i++) {
      var d = Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
      if (d < W * 0.4) len += d;
      minX = Math.min(minX, p[i * 2]);
      maxX = Math.max(maxX, p[i * 2]);
    }
    var mid = Math.floor((n - 1) / 2) * 2;
    var y = p[mid + 1];
    if (maxX < -rb * 3 - 10 || minX > W + rb * 3 + 10 || y < -rb * 3 - 10 || y > H + rb * 3 + 10) return;
    var a = L.a;
    if (len < 0.8) {
      var x = p[mid];
      if (L.halo && rb < rs * 3) disc(ctx, x, y, rs * 3.4, "rgba(" + L.c + "," + (a * 0.14).toFixed(3) + ")");
      var hex = aperture() >= 4 && rb > rs * 2.5;
      ctx.fillStyle = "rgba(" + L.c + "," + (a * k).toFixed(4) + ")";
      bokehPath(ctx, x, y, rb, hex);
      ctx.fill();
      if (rb > 5) {
        ctx.strokeStyle = "rgba(" + L.c + "," + (a * k * 0.6).toFixed(4) + ")";
        ctx.lineWidth = Math.max(0.8, rb * 0.1);
        bokehPath(ctx, x, y, rb * 0.95, hex);
        ctx.stroke();
      }
    } else {
      var ta = a * k * clamp(2 * rb / (len + 2 * rb) * 4, 0.1, 1);
      ctx.strokeStyle = "rgba(" + L.c + "," + ta.toFixed(4) + ")";
      ctx.lineWidth = 2 * rb;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (var j = 1; j < n; j++) {
        var jump = Math.hypot(p[j * 2] - p[j * 2 - 2], p[j * 2 + 1] - p[j * 2 - 1]) >= W * 0.4;
        if (jump) ctx.moveTo(p[j * 2], p[j * 2 + 1]);
        else ctx.lineTo(p[j * 2], p[j * 2 + 1]);
      }
      ctx.stroke();
    }
  }

  function renderLayer(L, F, lights, nextZ) {
    var z = L.z;
    if (L.overlay) {
      sctx.setTransform(q, 0, 0, q, 0, 0);
      V.camX = F.camAt(F.T / 2);
      V.t = sim.t - F.T / 2;
      L.draw(sctx);
      resetCtx(sctx);
      return;
    }
    var s = isFinite(z) ? V.fpx / z : 0;
    var sigma = sigmaOf(z);
    var sigDev = sigma * q;
    var d = chooseD(sigDev);
    var k = q / d;
    var shift = F.panV && s ? F.panV * F.T * s : 0;
    var n = L.dynamic ? (L.subject ? F.nSubject : nFromPx(L.motion(s, F), F.nMax)) : nFromPx(shift, F.nMax);
    var padX = Math.min(W * 0.6, (L.dynamic ? 0 : shift / 2) + sigma * 3 + 6);
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

    if (L.dynamic) {
      resetCtx(bctx);
      bctx.clearRect(0, 0, cw, ch);
      for (var i = 0; i < n; i++) {
        var tau = F.T * (1 - (i + 0.5) / n);
        V.camX = F.camAt(tau);
        V.t = sim.t - tau;
        var x0 = 0;
        var y0 = 0;
        var x1 = cw;
        var y1 = ch;
        if (L.bounds) {
          var bb = L.bounds(s, tau, F);
          x0 = Math.max(0, Math.floor((bb[0] + padX) * k));
          y0 = Math.max(0, Math.floor((bb[1] + padY) * k));
          x1 = Math.min(cw, Math.ceil((bb[2] + padX) * k));
          y1 = Math.min(ch, Math.ceil((bb[3] + padY) * k));
          if (x1 <= x0 || y1 <= y0) continue;
        }
        actx.setTransform(1, 0, 0, 1, 0, 0);
        actx.clearRect(x0, y0, x1 - x0, y1 - y0);
        actx.setTransform(k, 0, 0, k, padX * k, padY * k);
        L.draw(actx, s, z, tau, F);
        bctx.globalCompositeOperation = "lighter";
        bctx.globalAlpha = n > 1 ? add : 1;
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

    var ox = -padX * q;
    var oy = -padY * q;
    var ow = cw * d;
    var oh = ch * d;
    resetCtx(sctx);
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(src, 0, 0, cw, ch, ox, oy, ow, oh);

    if (state.peak) {
      var smear = L.dynamic ? (L.subject ? 0 : L.motion(s, F)) : shift;
      peakLayer(src, cw, ch, ox, oy, ow, oh, z, smear);
    }

    // point lights that sit between this layer and the next nearer one
    var drew = false;
    for (var li = 0; li < lights.length; li++) {
      var Lt = lights[li];
      if (Lt.z < z && Lt.z >= nextZ) {
        if (!drew) {
          sctx.setTransform(q, 0, 0, q, 0, 0);
          sctx.globalCompositeOperation = "lighter";
          drew = true;
        }
        drawLight(sctx, Lt);
      }
    }
    if (drew) resetCtx(sctx);
  }

  // Focus peaking, step 1: build a mask of what is in focus. Each layer erases
  // the mask where it covers nearer-than-before content, then adds its own
  // coverage weighted by sharpness.
  function peakLayer(src, cw, ch, ox, oy, ow, oh, z, smear) {
    resetCtx(pkctx);
    pkctx.globalCompositeOperation = "destination-out";
    pkctx.drawImage(src, 0, 0, cw, ch, ox, oy, ow, oh);
    var sharp = clamp(1.7 - cocPx(z) / 1.4, 0, 1) * clamp(1.5 - smear / 3, 0, 1);
    if (sharp > 0.05) {
      pkctx.globalCompositeOperation = "source-over";
      pkctx.globalAlpha = sharp;
      pkctx.drawImage(src, 0, 0, cw, ch, ox, oy, ow, oh);
    }
    resetCtx(pkctx);
  }

  // Step 2: find edges in the finished (pre-exposure) image, turn edge strength
  // into opacity with an SVG colour matrix, and keep only the in-focus parts.
  function drawPeaking() {
    resetCtx(ptctx);
    ptctx.drawImage(sceneCanvas, 0, 0);
    ptctx.globalCompositeOperation = "difference";
    var o = Math.max(1, Math.round(q));
    ptctx.drawImage(sceneCanvas, o, o);
    resetCtx(ptctx);
    ptctx.fillStyle = "#000";
    ptctx.fillRect(0, 0, pt.width, o);
    ptctx.fillRect(0, 0, o, pt.height);
    resetCtx(zctx);
    zctx.clearRect(0, 0, zbuf.width, zbuf.height);
    zctx.filter = "url(#peak-filter)";
    zctx.drawImage(pt, 0, 0);
    zctx.filter = "none";
    zctx.globalCompositeOperation = "destination-in";
    zctx.drawImage(pk, 0, 0);
    resetCtx(zctx);
    mctx.drawImage(zbuf, 0, 0);
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
    var layers = layerList();
    var lights = collectLights(F, capture);

    resetCtx(sctx);
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);
    var peaking = state.peak && !capture && hasFilter;
    var keepPeak = state.peak;
    state.peak = peaking;
    if (peaking) {
      resetCtx(pkctx);
      pkctx.clearRect(0, 0, pk.width, pk.height);
    }
    for (var i = 0; i < layers.length; i++) {
      var next = i + 1 < layers.length ? layers[i + 1].z : -1;
      renderLayer(layers[i], F, lights, next);
    }
    state.peak = keepPeak;
    vignette(sctx);

    // Exposure: scale linear light by 2^offset, applied in sRGB-ish space.
    var b = Math.min(7, Math.pow(2, exposureOffset() / 2.2));
    resetCtx(mctx);
    mctx.drawImage(sceneCanvas, 0, 0);
    if (b > 1.001) {
      mctx.globalCompositeOperation = "lighter";
      for (var r = b - 1; r > 0.001; r -= 1) {
        mctx.globalAlpha = Math.min(1, r);
        mctx.drawImage(sceneCanvas, 0, 0);
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
    return peaking;
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
    var layers = layerList();
    for (var i = layers.length - 1; i >= 0; i--) {
      var L = layers[i];
      if (L.overlay) continue;
      if (!isFinite(L.z)) return Infinity;
      var s = V.fpx / L.z;
      V.camX = F.camAt(tau);
      V.t = sim.t - tau;
      V.sx0 = lx - 2;
      V.sx1 = lx + 2;
      V.sy0 = ly - 2;
      V.sy1 = ly + 2;
      if (L.dynamic) {
        V.sx0 = -W;
        V.sx1 = 2 * W;
      }
      resetCtx(hitCtx);
      hitCtx.clearRect(0, 0, 1, 1);
      hitCtx.setTransform(1, 0, 0, 1, -lx, -ly);
      if (L.dynamic) L.draw(hitCtx, s, L.z, tau, F);
      else L.draw(hitCtx, s, L.z);
      if (hitCtx.getImageData(0, 0, 1, 1).data[3] > 100) return L.z;
    }
    return Infinity;
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  var $ = function (id) { return document.getElementById(id); };
  var inputs = { ap: $("ap"), sh: $("sh"), iso: $("iso"), focal: $("focal"), dist: $("dist"), speed: $("speed") };

  function setSeg(id, value) {
    var btns = $(id).querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].dataset.v === value;
      btns[i].classList.toggle("is-active", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function syncInputs() {
    inputs.ap.value = state.apIdx;
    inputs.sh.value = state.shIdx;
    inputs.iso.value = state.isoIdx;
    inputs.focal.value = state.focal;
    inputs.dist.value = state.subjectZ;
    inputs.speed.value = state.speed;
    setSeg("scene", state.scene);
    setSeg("tod", state.tod);
    setSeg("subj", state.subject);
    setSeg("cam", state.pan ? "pan" : "static");
    setSeg("fmode", state.focusMode);
  }

  function updateText() {
    var N = aperture();
    var T = shutter();
    var off = exposureOffset();
    var tod = TIMES[state.tod];
    var fd = focusDist();

    $("ap-out").textContent = "f/" + N;
    $("sh-out").textContent = fmtShutter(T);
    $("iso-out").textContent = iso();
    $("focal-out").textContent = state.focal + " mm";
    $("dist-out").textContent = state.subjectZ.toFixed(1) + " m";
    $("speed-out").textContent = state.speed.toFixed(1) + " m/s";
    $("speed-control").hidden = !running();
    inputs.speed.disabled = !running();
    $("cam").querySelector("[data-v=pan]").disabled = !running();

    $("hud-shutter").textContent = fmtShutter(T);
    $("hud-aperture").textContent = "F" + N;
    $("hud-iso").textContent = "ISO " + iso();
    $("hud-focal").textContent = state.focal + "mm";
    $("hud-focus").textContent = (state.focusMode === "mf" ? "MF " : "AF ") + (isFinite(fd) ? fd.toFixed(1) + "m" : "∞");
    $("hud-mode").textContent = (state.pan && running() ? "PAN" : "TRIPOD") + " · " + scene().label.toUpperCase() + " · " + tod.label.toUpperCase() + (state.playing ? "" : " · PAUSED");
    var ev = $("hud-ev");
    ev.textContent = (off >= 0 ? "+" : "−") + Math.abs(off).toFixed(1);
    ev.classList.toggle("is-off", Math.abs(off) > 0.7);
    $("meter-needle").style.left = (50 + clamp(off, -3.2, 3.2) / 3 * 50) + "%";
    viewfinder.classList.toggle("is-af", state.focusMode === "af");

    var lim = dofLimits();
    $("dof-range").textContent = "Sharp from " + fmtDist(lim.near) + " to " + fmtDist(lim.far);
    ringCanvas.setAttribute("aria-valuetext", isFinite(fd) ? fd.toFixed(1) + " metres" : "infinity");

    var roExp;
    if (off > 0.4) roExp = "Overexposed " + off.toFixed(1) + " stops";
    else if (off < -0.4) roExp = "Underexposed " + (-off).toFixed(1) + " stops";
    else roExp = "Well exposed";
    $("ro-exp").textContent = roExp;
    $("ro-exp-sub").textContent = tod.label + " is EV " + tod.ev + ", camera EV " + cameraEv().toFixed(1);

    V.fpx = state.focal / SENSOR * W;
    var subjPx = state.speed * T * (V.fpx / state.subjectZ);
    var bgPx = state.speed * T * (V.fpx / 20);
    if (!running()) {
      $("ro-mot").textContent = "Subject standing";
      $("ro-mot-sub").textContent = scene().movingLights ? "Slow shutter turns car lights into trails." : "Try Running to see motion blur.";
    } else if (state.pan) {
      $("ro-mot").textContent = bgPx < 1.5 ? "Pan too short to streak" : "Background streaks " + Math.round(bgPx) + " px";
      $("ro-mot-sub").textContent = "Tracking keeps the runner sharp.";
    } else {
      $("ro-mot").textContent = subjPx < 1.5 ? "Runner frozen" : "Runner smears " + Math.round(subjPx) + " px";
      $("ro-mot-sub").textContent = subjPx < 1.5 ? "Fast enough to stop motion." : "Faster shutter freezes, or pan.";
    }

    var sb = cocPx(state.subjectZ);
    $("ro-foc").textContent = sb < 1.5 ? "Subject sharp" : sb < 4 ? "Subject slightly soft" : "Subject out of focus";
    var bg = cocPx(Math.max(state.subjectZ * 3, 20));
    $("ro-foc-sub").textContent = "Subject blur " + sb.toFixed(1) + " px, background " + bg.toFixed(0) + " px";

    var stops = Math.log2(iso() / 100);
    $("ro-noise").textContent = stops < 1.5 ? "Clean" : stops < 3.5 ? "Slight grain" : stops < 5.5 ? "Grainy" : "Very noisy";
    $("ro-noise-sub").textContent = "ISO " + iso() + " amplifies the signal " + Math.pow(2, stops) + "×";

    drawRing();
  }

  inputs.ap.addEventListener("input", function () { state.apIdx = +this.value; updateText(); });
  inputs.sh.addEventListener("input", function () { state.shIdx = +this.value; updateText(); });
  inputs.iso.addEventListener("input", function () { state.isoIdx = +this.value; updateText(); });
  inputs.focal.addEventListener("input", function () { state.focal = +this.value; updateText(); });
  inputs.dist.addEventListener("input", function () { state.subjectZ = +this.value; updateText(); });
  inputs.speed.addEventListener("input", function () { state.speed = +this.value; updateText(); });

  function segHandler(id, fn) {
    $(id).addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || b.disabled) return;
      fn(b.dataset.v);
      setSeg(id, b.dataset.v);
      updateText();
    });
  }

  segHandler("scene", function (v) { state.scene = v; });
  segHandler("tod", function (v) { state.tod = v; });
  segHandler("subj", function (v) {
    state.subject = v;
    if (v !== "runner") {
      state.pan = false;
      setSeg("cam", "static");
    }
  });
  segHandler("cam", function (v) { state.pan = v === "pan"; });
  segHandler("fmode", function (v) { state.focusMode = v; });

  $("opt-hist").addEventListener("change", function () {
    state.hist = this.checked;
    viewfinder.classList.toggle("hide-hist", !state.hist);
  });
  $("opt-zebra").addEventListener("change", function () { state.zebra = this.checked; });
  $("opt-peak").addEventListener("change", function () { state.peak = this.checked; });
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
    updateText();
  });

  // ---------------------------------------------------------------------------
  // Focus: manual ring, wheel, keys, or tap-to-focus in AF mode
  // ---------------------------------------------------------------------------

  var focusAnim = null;
  var reticle = $("reticle");
  var reticleTimer = 0;

  function setFocusU(u) {
    focusAnim = null;
    state.focusU = clamp(u, U_MIN, U_INF);
    updateText();
  }

  function focusTo(d) {
    focusAnim = { from: state.focusU, to: distU(d), start: performance.now() };
  }

  function stepFocus(now) {
    if (!focusAnim) return;
    var t = clamp((now - focusAnim.start) / 260, 0, 1);
    var e = 1 - Math.pow(1 - t, 3);
    state.focusU = focusAnim.from + (focusAnim.to - focusAnim.from) * e;
    if (t >= 1) {
      focusAnim = null;
      reticle.classList.add("is-locked");
    }
    updateText();
  }

  main.addEventListener("click", function (e) {
    if (state.focusMode !== "af") return;
    var rect = main.getBoundingClientRect();
    var lx = (e.clientX - rect.left) / rect.width * W;
    var ly = (e.clientY - rect.top) / rect.height * H;
    focusTo(depthAt(lx, ly));
    reticle.style.left = (lx / W * 100) + "%";
    reticle.style.top = (ly / H * 100) + "%";
    reticle.classList.remove("is-locked");
    reticle.classList.add("is-active");
    clearTimeout(reticleTimer);
    reticleTimer = setTimeout(function () { reticle.classList.remove("is-active", "is-locked"); }, 1400);
  });

  function onWheel(e) {
    e.preventDefault();
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setFocusU(state.focusU - dy * 0.0025);
  }
  main.addEventListener("wheel", function (e) {
    if (state.focusMode === "mf") onWheel(e);
  }, { passive: false });

  var ringCanvas = $("ring");
  var rctx = ringCanvas.getContext("2d");
  var RING_TICKS = [0.5, 0.7, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50, 100, 200];

  function ringScale(w) { return w / 4.4; }

  function drawRing() {
    var w = ringCanvas.clientWidth || 600;
    var h = 60;
    var dpr = window.devicePixelRatio || 1;
    if (ringCanvas.width !== Math.round(w * dpr)) {
      ringCanvas.width = Math.round(w * dpr);
      ringCanvas.height = Math.round(h * dpr);
    }
    var x = rctx;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2b2a27");
    g.addColorStop(0.5, "#1c1b19");
    g.addColorStop(1, "#262522");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    var K = ringScale(w);
    var cx = w / 2;
    var u0 = state.focusU;
    function ux(u) { return cx + (u - u0) * K; }

    // knurled grip that slides as the ring turns
    var off = mod(-u0 * K, 7);
    x.fillStyle = "rgba(255,255,255,0.08)";
    for (var gx = off - 7; gx < w; gx += 7) x.fillRect(gx, 0, 3, 11);
    x.fillStyle = "rgba(0,0,0,0.35)";
    x.fillRect(0, 11, w, 1);

    // depth of field bracket
    var lim = dofLimits();
    var nx = ux(distU(lim.near));
    var fx = ux(distU(lim.far));
    x.fillStyle = "rgba(168,78,55,0.38)";
    x.fillRect(nx, 13, Math.max(2, fx - nx), 34);
    x.fillStyle = "#e08a6e";
    x.fillRect(nx, 13, 1.5, 34);
    x.fillRect(fx - 1.5, 13, 1.5, 34);

    // distance scale
    var mono = getComputedStyle(document.body).getPropertyValue("--mono") || "monospace";
    x.font = "11px " + mono;
    x.textAlign = "center";
    x.textBaseline = "alphabetic";
    for (var i = 0; i < RING_TICKS.length; i++) {
      var d = RING_TICKS[i];
      var tx = ux(Math.log(d));
      if (tx < -20 || tx > w + 20) continue;
      var major = d === 0.5 || d === 1 || d === 2 || d === 3 || d === 5 || d === 10 || d === 20 || d === 50 || d === 200;
      x.fillStyle = "rgba(255,255,255," + (major ? 0.85 : 0.4) + ")";
      x.fillRect(tx - 0.5, 34, 1, major ? 9 : 5);
      if (major) x.fillText(d + (d < 10 ? "m" : ""), tx, 56);
    }
    var ix = ux(U_INF);
    x.fillStyle = "rgba(255,255,255,0.85)";
    x.fillRect(ix - 0.5, 34, 1, 9);
    x.font = "15px " + mono;
    x.fillText("∞", ix, 57);

    // scene landmarks
    x.font = "10px Inter, system-ui, sans-serif";
    x.textBaseline = "middle";
    var marks = scene().marks.filter(function (mk) {
      return Math.abs(distU(mk.z) - distU(state.subjectZ)) * K > 34;
    }).concat([{ z: state.subjectZ, subject: true }]);
    var lastX = -1e9;
    for (var m = 0; m < marks.length; m++) {
      var mk = marks[m];
      var mx = ux(distU(mk.z));
      if (mx < -30 || mx > w + 30) continue;
      if (!mk.subject) {
        if (mx - lastX < 38) continue;
        lastX = mx;
      }
      var inF = mk.z >= lim.near && mk.z <= lim.far;
      if (mk.subject) {
        x.fillStyle = inF ? "#8df0a6" : "#f0c36a";
        x.beginPath();
        x.arc(mx, 21, 4, 0, Math.PI * 2);
        x.fill();
        x.fillText(running() ? "runner" : "person", mx, 30);
      } else {
        x.fillStyle = inF ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)";
        x.fillRect(mx - 0.5, 17, 1, 6);
        x.fillText(mk.label, mx, 28);
      }
    }

    // fixed focus index
    x.fillStyle = "#ff7a5c";
    x.beginPath();
    x.moveTo(cx - 6, 12);
    x.lineTo(cx + 6, 12);
    x.lineTo(cx, 19);
    x.closePath();
    x.fill();
    x.fillRect(cx - 1, 12, 2, 36);
  }

  var dragX = null;
  ringCanvas.addEventListener("pointerdown", function (e) {
    dragX = e.clientX;
    ringCanvas.setPointerCapture(e.pointerId);
    if (state.focusMode !== "mf") {
      state.focusMode = "mf";
      setSeg("fmode", "mf");
    }
  });
  ringCanvas.addEventListener("pointermove", function (e) {
    if (dragX === null) return;
    var K = ringScale(ringCanvas.clientWidth);
    setFocusU(state.focusU - (e.clientX - dragX) / K);
    dragX = e.clientX;
  });
  ringCanvas.addEventListener("pointerup", function () { dragX = null; });
  ringCanvas.addEventListener("pointercancel", function () { dragX = null; });
  ringCanvas.addEventListener("wheel", onWheel, { passive: false });
  ringCanvas.addEventListener("keydown", function (e) {
    var step = { ArrowLeft: 0.04, ArrowDown: 0.04, ArrowRight: -0.04, ArrowUp: -0.04, PageDown: 0.3, PageUp: -0.3 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setFocusU(state.focusU + step);
  });
  window.addEventListener("resize", drawRing);

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

  var film = $("film");
  var shootBtn = $("shoot");
  var blink = $("blink");
  var shotCount = 0;

  function shoot() {
    shutterSound();
    render(true);
    var url = main.toDataURL("image/jpeg", 0.92);
    var meta = fmtShutter(shutter()) + " · f/" + aperture() + " · ISO " + iso() + " · " + state.focal + "mm";
    shotCount++;
    addThumb({ url: url, meta: meta, where: scene().label + ", " + TIMES[state.tod].label }, shotCount);
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
    $("photo-meta").textContent = shot.meta + " · " + shot.where;
    var a = $("photo-download");
    a.href = shot.url;
    a.download = "shutter-" + n + ".jpg";
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  $("photo-close").addEventListener("click", function () { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); });
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
      var peaking = render(false);
      frame++;
      if (frame % 4 === 0) analyze();
      if (peaking) drawPeaking();
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
  requestAnimationFrame(tick);
})();
