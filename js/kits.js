(function () {
  const ORDER = ["home", "away", "third"];
  const HOOPS = { count: 6, start: 0.275, band: 0.05, gap: 0.03 };

  function legacy(t) {
    return {
      label: "Home",
      paper: "#F5F2EC",
      card: "#FFFFFF",
      ink: t.ink || t.accent || "#111827",
      muted: "#5B6170",
      primary: t.primary || "#1F2937",
      onPrimary: t.secondary || "#FFFFFF",
      accent: t.accent || "#111827",
      onAccent: t.secondary || "#FFFFFF",
      header: t.primary || "#1F2937",
      onHeader: t.secondary || "#FFFFFF",
      pattern: {
        type: t.pattern === "stripes" ? "stripes" : "solid",
        base: t.primary || "#1F2937",
        bands: [t.secondary || "#FFFFFF"]
      }
    };
  }

  function all(team) {
    return team.kits || { home: legacy(team.theme || {}) };
  }

  function ids(team) {
    const kits = all(team);
    return ORDER.filter(id => kits[id]).concat(Object.keys(kits).filter(id => !ORDER.includes(id)));
  }

  function get(team, id) {
    const kits = all(team);
    const use = kits[id] ? id : ids(team)[0];
    const kit = kits[use];
    return Object.assign(
      {
        id: use,
        line: "rgba(17,24,39,0.12)",
        headerBand: kit.accent,
        dark: false,
        onPaper: kit.ink,
        onPaperMuted: kit.muted,
        paperPrimary: kit.primary,
        paperOnPrimary: kit.onPrimary
      },
      kit,
      { id: use }
    );
  }

  function hoops(p) {
    const bands = p.bands && p.bands.length ? p.bands : [p.base];
    const out = [];
    for (let i = 0; i < HOOPS.count; i++) {
      const from = HOOPS.start + i * (HOOPS.band + HOOPS.gap);
      out.push({ from, to: from + HOOPS.band, color: bands[i % bands.length] });
    }
    return out;
  }

  const BOLT = [[0, 0], [-3.5, 12], [2.5, 24], [-3.5, 36], [2.5, 48], [-3.5, 60], [2.5, 72], [-3.5, 84], [2.5, 96], [0, 100]];
  const BOLT_X = [14, 86];
  const BOLT_W = 2;

  function boltPoints(cx, mirror) {
    return BOLT.map(([dx, y]) => [cx + (mirror ? -dx : dx), y]);
  }

  function boltSvg(p) {
    const color = (p.bands && p.bands[0]) || "#FFFFFF";
    const lines = BOLT_X.map((cx, i) =>
      '<polyline points="' + boltPoints(cx, i === 1).map(pt => pt.join(",")).join(" ") +
      '" fill="none" stroke="' + color + '" stroke-width="' + BOLT_W + '" stroke-linejoin="miter"/>'
    ).join("");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + "</svg>";
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }

  const ZIG = [[50, 0], [57, 12.5], [43, 25], [57, 37.5], [43, 50], [57, 62.5], [43, 75], [57, 87.5], [50, 100]];

  function splitSvg(p) {
    const color = (p.bands && p.bands[0]) || "#000000";
    const pts = ZIG.map(pt => pt.join(",")).concat(["100,100", "100,0"]).join(" ");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="' + pts + '" fill="' + color + '"/></svg>';
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }

  const CB = [0.33, 0.39, 0.61, 0.67];

  const BAND = [0.36, 0.41, 0.59, 0.64];

  const SASH = [[0, 6], [0, 34], [100, 96], [100, 68]];

  function sashSvg(p) {
    const color = (p.bands && p.bands[0]) || "#FFFFFF";
    const pts = SASH.map(pt => pt.join(",")).join(" ");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="' + pts + '" fill="' + color + '"/></svg>';
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }
  const RAYO_BOLT = [[78, 0], [96, 0], [77, 38], [89, 38], [48, 100], [28, 100], [60, 52], [48, 52]];

  const TIP = [[0.24, 0.3], [0.33, 0.39]];

  const SLEEVE_L = [[0, 0], [30, 0], [22, 46], [0, 60]];

  const ZZ_ROWS = [0.3, 0.46, 0.62, 0.78];
  const ZZ_TEETH = 5;

  function zigzagRow(y) {
    const pts = [];
    for (let i = 0; i <= ZZ_TEETH * 2; i++) pts.push([(i * 100) / (ZZ_TEETH * 2), y * 100 + (i % 2 ? -5 : 5)]);
    return pts;
  }

  function zigzagSvg(p) {
    const bands = p.bands && p.bands.length ? p.bands : ["#FFFFFF"];
    const lines = ZZ_ROWS.map((y, i) =>
      '<polyline points="' + zigzagRow(y).map(pt => pt.join(",")).join(" ") +
      '" fill="none" stroke="' + bands[i % bands.length] + '" stroke-width="3.5" stroke-linejoin="miter"/>'
    ).join("");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + "</svg>";
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }

  const CHECKS = 6;

  function pct(n) {
    return (n * 100).toFixed(2) + "%";
  }

  function css(p) {
    const b = p.bands || [];
    if (p.type === "stripes") {
      return "repeating-linear-gradient(90deg, " + p.base + " 0 18%, " + b[0] + " 18% 30%)";
    }
    if (p.type === "pinstripe") {
      return "repeating-linear-gradient(90deg, " + p.base + " 0 15%, " + b[0] + " 15% 17%)";
    }
    if (p.type === "bolts") {
      return boltSvg(p) + " center / 100% 100% no-repeat, " + p.base;
    }
    if (p.type === "gradient") {
      return "linear-gradient(180deg, " + p.base + ", " + (b[0] || p.base) + ")";
    }
    if (p.type === "sleeves") {
      const c = b[0] || "#FFFFFF";
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<polygon points="' + SLEEVE_L.map(pt => pt.join(",")).join(" ") + '" fill="' + c + '"/>' +
        '<polygon points="' + SLEEVE_L.map(([px, py]) => [100 - px, py].join(",")).join(" ") + '" fill="' + c + '"/></svg>';
      return "url('data:image/svg+xml," + encodeURIComponent(svg) + "') center / 100% 100% no-repeat, " + p.base;
    }
    if (p.type === "zigzag") {
      return zigzagSvg(p) + " center / 100% 100% no-repeat, " + p.base;
    }
    if (p.type === "lightning") {
      const c = b[0] || "#FFFFFF";
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="' +
        RAYO_BOLT.map(pt => pt.join(",")).join(" ") + '" fill="' + c + '"/></svg>';
      return "url('data:image/svg+xml," + encodeURIComponent(svg) + "') right center / auto 100% no-repeat, " + p.base;
    }
    if (p.type === "centreband") {
      const edge = b[0] || "#FFFFFF";
      const mid = b[1] || edge;
      return "linear-gradient(90deg, " + p.base + " 0 " + pct(CB[0]) + ", " + edge + " " + pct(CB[0]) + " " + pct(CB[1]) + ", " +
        mid + " " + pct(CB[1]) + " " + pct(CB[2]) + ", " + edge + " " + pct(CB[2]) + " " + pct(CB[3]) + ", " + p.base + " " + pct(CB[3]) + " 100%)";
    }
    if (p.type === "band") {
      const edge = b[0] || "#FFFFFF";
      const mid = b[1] || edge;
      return "linear-gradient(180deg, " + p.base + " 0 " + pct(BAND[0]) + ", " + edge + " " + pct(BAND[0]) + " " + pct(BAND[1]) + ", " +
        mid + " " + pct(BAND[1]) + " " + pct(BAND[2]) + ", " + edge + " " + pct(BAND[2]) + " " + pct(BAND[3]) + ", " + p.base + " " + pct(BAND[3]) + " 100%)";
    }
    if (p.type === "sash") {
      return sashSvg(p) + " center / 100% 100% no-repeat, " + p.base;
    }
    if (p.type === "tipping") {
      const c = b.length ? b : ["#000000"];
      const stops = [p.base + " 0 " + pct(TIP[0][0])];
      TIP.forEach(([from, to], i) => {
        stops.push(c[i % c.length] + " " + pct(from) + " " + pct(to));
        stops.push(p.base + " " + pct(to) + " " + pct(i + 1 < TIP.length ? TIP[i + 1][0] : 1));
      });
      return "linear-gradient(180deg, " + stops.join(", ") + ")";
    }
    if (p.type === "split") {
      return splitSvg(p) + " center / 100% 100% no-repeat, " + p.base;
    }
    if (p.type === "checks") {
      const c = b[0] || "#000000";
      let cells = "";
      for (let r = 0; r < CHECKS; r++) {
        for (let q = r % 2; q < CHECKS; q += 2) cells += '<rect x="' + q + '" y="' + r + '" width="1" height="1"/>';
      }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + CHECKS + " " + CHECKS + '" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><g fill="' + c + '">' + cells + "</g></svg>";
      return "url('data:image/svg+xml," + encodeURIComponent(svg) + "') center / cover no-repeat, " + p.base;
    }
    if (p.type === "hoops") {
      const stops = [];
      let pos = 0;
      hoops(p).forEach(h => {
        stops.push(p.base + " " + pct(pos) + " " + pct(h.from));
        stops.push(h.color + " " + pct(h.from) + " " + pct(h.to));
        pos = h.to;
      });
      stops.push(p.base + " " + pct(pos) + " 100%");
      return "linear-gradient(180deg, " + stops.join(", ") + ")";
    }
    return p.base;
  }

  function draw(ctx, x, y, w, h, p) {
    const b = p.bands || [];
    ctx.fillStyle = p.base;
    ctx.fillRect(x, y, w, h);
    if (p.type === "stripes" || p.type === "pinstripe") {
      const period = w * (p.type === "stripes" ? 0.3 : 0.17);
      const offset = p.type === "stripes" ? 0.6 : 15 / 17;
      const bandW = period * (p.type === "stripes" ? 0.4 : 2 / 17);
      ctx.fillStyle = b[0];
      for (let sx = x; sx < x + w; sx += period) ctx.fillRect(sx + period * offset, y, bandW, h);
    } else if (p.type === "bolts") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.strokeStyle = b[0] || "#FFFFFF";
      ctx.lineJoin = "miter";
      ctx.lineWidth = BOLT_W * (w + h) / 200;
      BOLT_X.forEach((cx, i) => {
        ctx.beginPath();
        boltPoints(cx, i === 1).forEach(([px, py], j) => {
          const X = x + (px / 100) * w;
          const Y = y + (py / 100) * h;
          if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        });
        ctx.stroke();
      });
      ctx.restore();
    } else if (p.type === "hoops") {
      hoops(p).forEach(hp => {
        ctx.fillStyle = hp.color;
        ctx.fillRect(x, y + h * hp.from, w, h * (hp.to - hp.from));
      });
    } else if (p.type === "sleeves") {
      ctx.fillStyle = b[0] || "#FFFFFF";
      [false, true].forEach(mirror => {
        ctx.beginPath();
        SLEEVE_L.forEach(([px, py], j) => {
          const X = x + ((mirror ? 100 - px : px) / 100) * w;
          const Y = y + (py / 100) * h;
          if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        });
        ctx.closePath();
        ctx.fill();
      });
    } else if (p.type === "zigzag") {
      const bands = b.length ? b : ["#FFFFFF"];
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.lineWidth = 3.5 * (w + h) / 200;
      ctx.lineJoin = "miter";
      ZZ_ROWS.forEach((ry, i) => {
        ctx.strokeStyle = bands[i % bands.length];
        ctx.beginPath();
        zigzagRow(ry).forEach(([px, py], j) => {
          const X = x + (px / 100) * w;
          const Y = y + (py / 100) * h;
          if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        });
        ctx.stroke();
      });
      ctx.restore();
    } else if (p.type === "lightning") {
      ctx.fillStyle = b[0] || "#FFFFFF";
      ctx.beginPath();
      RAYO_BOLT.forEach(([px, py], j) => {
        const X = x + w - h + (px / 100) * h;
        const Y = y + (py / 100) * h;
        if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.fill();
    } else if (p.type === "centreband") {
      const edge = b[0] || "#FFFFFF";
      ctx.fillStyle = edge;
      ctx.fillRect(x + w * CB[0], y, w * (CB[3] - CB[0]), h);
      ctx.fillStyle = b[1] || edge;
      ctx.fillRect(x + w * CB[1], y, w * (CB[2] - CB[1]), h);
    } else if (p.type === "band") {
      const edge = b[0] || "#FFFFFF";
      ctx.fillStyle = edge;
      ctx.fillRect(x, y + h * BAND[0], w, h * (BAND[3] - BAND[0]));
      ctx.fillStyle = b[1] || edge;
      ctx.fillRect(x, y + h * BAND[1], w, h * (BAND[2] - BAND[1]));
    } else if (p.type === "sash") {
      ctx.fillStyle = b[0] || "#FFFFFF";
      ctx.beginPath();
      SASH.forEach(([px, py], j) => {
        const X = x + (px / 100) * w;
        const Y = y + (py / 100) * h;
        if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.fill();
    } else if (p.type === "tipping") {
      const c = b.length ? b : ["#000000"];
      TIP.forEach(([from, to], i) => {
        ctx.fillStyle = c[i % c.length];
        ctx.fillRect(x, y + h * from, w, h * (to - from));
      });
    } else if (p.type === "gradient") {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, p.base);
      g.addColorStop(1, b[0] || p.base);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    } else if (p.type === "checks") {
      const cell = Math.max(w, h) / CHECKS;
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);
      ctx.fillStyle = b[0] || "#000000";
      for (let r = 0; r < rows; r++) {
        for (let q = r % 2; q < cols; q += 2) ctx.fillRect(x + q * cell, y + r * cell, cell, cell);
      }
    } else if (p.type === "split") {
      ctx.fillStyle = b[0] || p.base;
      ctx.beginPath();
      ZIG.forEach(([px, py], j) => {
        const X = x + (px / 100) * w;
        const Y = y + (py / 100) * h;
        if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, amount) {
    const x = hexRgb(a);
    const y = hexRgb(b);
    if (!x || !y) return b;
    const c = x.map((v, i) => Math.round(v * amount + y[i] * (1 - amount)));
    return "rgb(" + c.join(",") + ")";
  }

  window.Kits = { ids, get, css, draw, mix };
})();