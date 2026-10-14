(function () {
  // ---------- color helpers ----------

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function toHex(rgb) {
    return "#" + rgb.map(function (v) {
      return v.toString(16).padStart(2, "0");
    }).join("");
  }

  function parseHex(str) {
    var m = /^#?([0-9a-f]{6})$/i.exec(str.trim());
    if (!m) {
      return null;
    }
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function cssRgb(rgb) {
    return "rgb(" + rgb.join(",") + ")";
  }

  // h in [0, 360), s and l in [0, 100] -> [r, g, b] in [0, 255]
  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) {
      return l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  function rgbToLab(rgb) {
    var lin = rgb.map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
    var y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
    var z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
    var f = function (t) {
      return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    };
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // CIE76 color difference: ~2 is barely noticeable, 50+ is a different color
  function deltaE(a, b) {
    var la = rgbToLab(a), lb = rgbToLab(b);
    return Math.sqrt(
      Math.pow(la[0] - lb[0], 2) + Math.pow(la[1] - lb[1], 2) + Math.pow(la[2] - lb[2], 2)
    );
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.classList.toggle("is-win", kind === "win");
    el.classList.toggle("is-error", kind === "error");
  }

  // ---------- mode tabs ----------

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".mode-tab"));
  var panels = { rgb: $("mode-rgb"), wheel: $("mode-wheel") };

  function showMode(mode) {
    tabs.forEach(function (tab) {
      var active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.keys(panels).forEach(function (key) {
      panels[key].hidden = key !== mode;
    });
    if (mode === "wheel") {
      renderPick();
    }
    try {
      history.replaceState(null, "", mode === "wheel" ? "#wheel" : "#rgb");
    } catch (e) {}
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showMode(tab.dataset.mode);
    });
  });

  // ---------- mode 1: guess the RGB ----------

  var rgb = {
    target: null,
    guesses: 0,
    done: false,
    inputs: [$("in-r"), $("in-g"), $("in-b")],
    hex: $("in-hex"),
    form: $("rgb-form"),
    submit: $("rgb-submit"),
    status: $("rgb-status"),
    history: $("rgb-history"),
    targetEl: $("rgb-target"),
    lastEl: $("rgb-last")
  };

  function readRgbInputs() {
    var values = rgb.inputs.map(function (input) {
      return input.value.trim() === "" ? NaN : Number(input.value);
    });
    var valid = values.every(function (v) {
      return Number.isInteger(v) && v >= 0 && v <= 255;
    });
    return valid ? values : null;
  }

  rgb.inputs.forEach(function (input) {
    input.addEventListener("input", function () {
      var values = readRgbInputs();
      if (values) {
        rgb.hex.value = toHex(values);
      }
    });
  });

  rgb.hex.addEventListener("input", function () {
    var values = parseHex(rgb.hex.value);
    if (values) {
      rgb.inputs.forEach(function (input, i) {
        input.value = values[i];
      });
    }
  });

  function newRgbRound() {
    rgb.target = [randInt(0, 255), randInt(0, 255), randInt(0, 255)];
    rgb.guesses = 0;
    rgb.done = false;
    rgb.targetEl.style.backgroundColor = cssRgb(rgb.target);
    rgb.lastEl.style.backgroundColor = "";
    rgb.lastEl.classList.add("swatch-empty");
    rgb.history.innerHTML = "";
    rgb.inputs.forEach(function (input) { input.value = ""; });
    rgb.hex.value = "";
    rgb.submit.disabled = false;
    $("rgb-giveup").disabled = false;
    setStatus(rgb.status, "", null);
  }

  function hintHtml(label, guess, target) {
    var cls, arrow, title;
    if (guess === target) {
      cls = "ok"; arrow = "✓"; title = "exact";
    } else if (guess < target) {
      cls = "up"; arrow = "↑"; title = "go higher";
    } else {
      cls = "down"; arrow = "↓"; title = "go lower";
    }
    return '<span class="hint ' + cls + '" title="' + title + '"><b>' + label + "</b>" +
      guess + ' <span class="arrow">' + arrow + "</span></span>";
  }

  rgb.form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (rgb.done) {
      return;
    }

    var guess = readRgbInputs();
    if (!guess) {
      setStatus(rgb.status, "Enter whole numbers from 0 to 255 for R, G and B (or a hex like #3a7bd5).", "error");
      return;
    }

    rgb.guesses += 1;
    rgb.lastEl.classList.remove("swatch-empty");
    rgb.lastEl.style.backgroundColor = cssRgb(guess);

    var li = document.createElement("li");
    li.innerHTML =
      '<span class="num">' + rgb.guesses + "</span>" +
      '<span class="mini" style="background:' + cssRgb(guess) + '"></span>' +
      '<span class="hex">' + toHex(guess) + "</span>" +
      hintHtml("R", guess[0], rgb.target[0]) +
      hintHtml("G", guess[1], rgb.target[1]) +
      hintHtml("B", guess[2], rgb.target[2]);
    rgb.history.insertBefore(li, rgb.history.firstChild);

    var won = guess.every(function (v, i) { return v === rgb.target[i]; });
    if (won) {
      endRgbRound("Got it in " + rgb.guesses + (rgb.guesses === 1 ? " guess" : " guesses") +
        "! The color was " + toHex(rgb.target) + ".", "win");
    } else {
      var off = Math.round(deltaE(guess, rgb.target));
      setStatus(rgb.status, "Guess " + rgb.guesses + " — color distance ΔE " + off + ". Follow the arrows.", null);
    }
  });

  function endRgbRound(text, kind) {
    rgb.done = true;
    rgb.submit.disabled = true;
    $("rgb-giveup").disabled = true;
    setStatus(rgb.status, text, kind);
  }

  $("rgb-new").addEventListener("click", function () {
    newRgbRound();
    rgb.inputs[0].focus();
  });
  $("rgb-giveup").addEventListener("click", function () {
    var t = rgb.target;
    endRgbRound("The color was " + toHex(t) + " (rgb " + t.join(", ") + ").", null);
  });

  // ---------- mode 2: match on the wheel ----------

  var wheel = {
    canvas: $("wheel"),
    wrap: $("wheel-wrap"),
    marker: $("wheel-marker"),
    sliders: { h: $("sl-h"), s: $("sl-s"), l: $("sl-l") },
    outputs: { h: $("out-h"), s: $("out-s"), l: $("out-l") },
    targetEl: $("wheel-target"),
    pickEl: $("wheel-pick"),
    status: $("wheel-status"),
    scoreEl: $("wheel-score"),
    submit: $("wheel-submit"),
    target: null,
    pick: { h: 0, s: 0, l: 50 },
    drawnL: null,
    done: false,
    rounds: 0,
    total: 0,
    best: 0
  };

  function drawWheel() {
    if (wheel.drawnL === wheel.pick.l) {
      return;
    }
    var ctx = wheel.canvas.getContext("2d");
    var size = wheel.canvas.width;
    var r = size / 2;
    var image = ctx.createImageData(size, size);
    var data = image.data;

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var dx = x - r + 0.5;
        var dy = r - y - 0.5;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) {
          continue;
        }
        var hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        var c = hslToRgb(hue, Math.min(dist / r, 1) * 100, wheel.pick.l);
        var i = (y * size + x) * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    wheel.drawnL = wheel.pick.l;
  }

  var drawQueued = false;
  function queueDraw() {
    if (drawQueued) {
      return;
    }
    drawQueued = true;
    requestAnimationFrame(function () {
      drawQueued = false;
      drawWheel();
    });
  }

  function renderPick() {
    var p = wheel.pick;
    ["h", "s", "l"].forEach(function (k) {
      wheel.sliders[k].value = p[k];
      wheel.outputs[k].textContent = p[k];
    });
    wheel.pickEl.style.backgroundColor = cssRgb(hslToRgb(p.h, p.s, p.l));

    var size = wheel.wrap.clientWidth;
    var angle = p.h * Math.PI / 180;
    var rad = (p.s / 100) * (size / 2);
    wheel.marker.style.left = size / 2 + Math.cos(angle) * rad + "px";
    wheel.marker.style.top = size / 2 - Math.sin(angle) * rad + "px";
    wheel.marker.style.backgroundColor = cssRgb(hslToRgb(p.h, p.s, p.l));

    queueDraw();
  }

  function pickFromPointer(event) {
    if (wheel.done) {
      return;
    }
    var rect = wheel.wrap.getBoundingClientRect();
    var r = rect.width / 2;
    var dx = event.clientX - rect.left - r;
    var dy = r - (event.clientY - rect.top);
    var dist = Math.min(Math.sqrt(dx * dx + dy * dy), r);
    wheel.pick.h = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360) % 360;
    wheel.pick.s = Math.round((dist / r) * 100);
    renderPick();
  }

  wheel.wrap.addEventListener("pointerdown", function (event) {
    wheel.wrap.setPointerCapture(event.pointerId);
    pickFromPointer(event);
  });
  wheel.wrap.addEventListener("pointermove", function (event) {
    if (wheel.wrap.hasPointerCapture(event.pointerId)) {
      pickFromPointer(event);
    }
  });

  ["h", "s", "l"].forEach(function (k) {
    wheel.sliders[k].addEventListener("input", function () {
      wheel.pick[k] = Number(wheel.sliders[k].value);
      renderPick();
    });
  });

  function setWheelLocked(locked) {
    wheel.done = locked;
    wheel.submit.disabled = locked;
    ["h", "s", "l"].forEach(function (k) {
      wheel.sliders[k].disabled = locked;
    });
  }

  function newWheelRound() {
    wheel.target = { h: randInt(0, 359), s: randInt(25, 100), l: randInt(20, 80) };
    wheel.targetEl.style.backgroundColor = cssRgb(hslToRgb(wheel.target.h, wheel.target.s, wheel.target.l));
    wheel.pick = { h: 0, s: 0, l: 50 };
    setWheelLocked(false);
    setStatus(wheel.status, "", null);
    renderPick();
  }

  wheel.submit.addEventListener("click", function () {
    if (wheel.done) {
      return;
    }
    var t = wheel.target, p = wheel.pick;
    var d = deltaE(hslToRgb(t.h, t.s, t.l), hslToRgb(p.h, p.s, p.l));
    var score = Math.max(0, Math.round(100 - d * 1.5));
    var verdict = score >= 95 ? "Perfect eye!" : score >= 85 ? "Very close." : score >= 65 ? "Not bad." : "Way off.";

    wheel.rounds += 1;
    wheel.total += score;
    wheel.best = Math.max(wheel.best, score);
    setWheelLocked(true);

    setStatus(wheel.status,
      verdict + " Score " + score + "/100 (ΔE " + d.toFixed(1) + "). Target was hsl(" +
      t.h + ", " + t.s + "%, " + t.l + "%), you picked hsl(" + p.h + ", " + p.s + "%, " + p.l + "%).",
      score >= 85 ? "win" : null);
    wheel.scoreEl.textContent = "Rounds " + wheel.rounds + " · average " +
      Math.round(wheel.total / wheel.rounds) + " · best " + wheel.best;
  });

  $("wheel-next").addEventListener("click", newWheelRound);
  window.addEventListener("resize", renderPick);

  // ---------- start ----------

  newRgbRound();
  newWheelRound();
  showMode(location.hash === "#wheel" ? "wheel" : "rgb");
})();
