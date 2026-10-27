(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = () => innerWidth < 900;
  const TAU = Math.PI * 2;

  /* ---------- star colours (cosmic violet / magenta / gold) ---------- */
  const C = {
    violet: [138, 92, 255],
    magenta: [209, 79, 224],
    gold: [246, 207, 124],
    indigo: [42, 28, 92],
    white: [240, 236, 255]
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* glow sprite: white core -> colour -> transparent */
  function sprite(col, size = 64) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const x = c.getContext("2d"), h = size / 2;
    const g = x.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,.95)");
    g.addColorStop(0.18, rgba(col, .75));
    g.addColorStop(0.45, rgba(col, .18));
    g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  const SPR = { gold: sprite(C.gold), violet: sprite(C.violet), magenta: sprite(C.magenta), white: sprite(C.white) };
  const sprKeys = ["white", "white", "white", "violet", "violet", "gold", "magenta"];

  /* =========================================================
     COSMOS — nebula + glowing stars, slow parallax
     ========================================================= */
  const cv = $("#cosmos"), cx = cv.getContext("2d");
  let W, H, DPR, neb = null;
  function buildNebula() {
    const s = small() ? 3 : 2;
    neb = document.createElement("canvas");
    neb.width = Math.ceil(innerWidth / s); neb.height = Math.ceil(innerHeight * 1.6 / s);
    const n = neb.getContext("2d"), w = neb.width, h = neb.height;
    n.globalCompositeOperation = "lighter";
    const blobs = small() ? 9 : 16;
    for (let i = 0; i < blobs; i++) {
      const col = [[150,150,158],[110,110,118],[70,70,78],[130,130,138],[90,90,98]][i % 5];
      const x = w * (.1 + Math.random() * .8), y = h * Math.random(), r = Math.max(w, h) * (.12 + Math.random() * .28);
      const g = n.createRadialGradient(x, y, 0, x, y, r);
      const a = .03 + Math.random() * .06;
      g.addColorStop(0, rgba(col, a)); g.addColorStop(.5, rgba(col, a * .45)); g.addColorStop(1, rgba(col, 0));
      n.fillStyle = g; n.beginPath(); n.ellipse(x, y, r, r * (.4 + Math.random() * .5), Math.random() * TAU, 0, TAU); n.fill();
    }
    /* dark dust lanes */
    n.globalCompositeOperation = "source-over";
    for (let i = 0; i < 5; i++) {
      const x = w * Math.random(), y = h * Math.random(), r = w * (.1 + Math.random() * .2);
      const g = n.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(11,11,13,.55)"); g.addColorStop(1, "rgba(11,11,13,0)");
      n.fillStyle = g; n.beginPath(); n.ellipse(x, y, r * 1.8, r * .35, Math.random() * TAU, 0, TAU); n.fill();
    }
  }
  /* bright star: wide bloom, tapered diffraction spikes, hot core — pre-rendered once */
  function brightSprite(col, size = 256) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const x = c.getContext("2d"), h = size / 2;
    x.globalCompositeOperation = "lighter";
    let g = x.createRadialGradient(h, h, 0, h, h, h * .6);
    g.addColorStop(0, rgba(col, .42)); g.addColorStop(.3, rgba(col, .1)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    const spike = (ang, len, w, a) => {
      x.save(); x.translate(h, h); x.rotate(ang);
      const gg = x.createLinearGradient(0, 0, len, 0);
      gg.addColorStop(0, `rgba(255,255,255,${a})`); gg.addColorStop(.2, rgba(col, a * .55)); gg.addColorStop(1, rgba(col, 0));
      x.fillStyle = gg; x.beginPath(); x.moveTo(0, -w); x.lineTo(len, 0); x.lineTo(0, w); x.closePath(); x.fill();
      x.restore();
    };
    for (let i = 0; i < 4; i++) spike(i * Math.PI / 2, h * .96, size * .007, .8);
    for (let i = 0; i < 4; i++) spike(Math.PI / 4 + i * Math.PI / 2, h * .3, size * .003, .28);
    g = x.createRadialGradient(h, h, 0, h, h, h * .16);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.3, "rgba(255,255,255,.95)"); g.addColorStop(.6, rgba(col, .45)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(h, h, h * .16, 0, TAU); x.fill();
    return c;
  }
  const BRIGHT = { white: brightSprite(C.white), violet: brightSprite(C.violet), gold: brightSprite(C.gold), magenta: brightSprite(C.magenta) };
  const mixW = (c, k) => [0, 1, 2].map(i => Math.round(255 + (c[i] - 255) * k));
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

  /* static deep field, drawn once:
     star clouds that form the Milky Way, thousands of field stars in three magnitudes,
     coloured halo stars, open clusters. Only stars carry colour. */
  let field = null, bright = [], twinkle = [];
  function buildField() {
    const fw = W, fh = Math.round(H * 1.5), px = Math.max(1, DPR);
    field = document.createElement("canvas"); field.width = fw; field.height = fh;
    const f = field.getContext("2d");
    const ang = -.42, cxm = fw * .5, cym = fh * .3, dir = [Math.cos(ang), Math.sin(ang)], nrm = [-Math.sin(ang), Math.cos(ang)];
    const inBand = (spread) => { const tt = (Math.random() - .5) * fw * 2.4, o = gauss() * fh * spread; return [cxm + dir[0] * tt + nrm[0] * o, cym + dir[1] * tt + nrm[1] * o]; };
    const area = (fw / px) * (fh / px);
    const dens = small() ? .6 : 1;
    /* 1. faint glow of the band itself (neutral) */
    f.save(); f.translate(cxm, cym); f.rotate(ang);
    const band = f.createLinearGradient(0, -fh * .16, 0, fh * .16);
    band.addColorStop(0, "rgba(210,210,220,0)"); band.addColorStop(.5, "rgba(210,210,220,.09)"); band.addColorStop(1, "rgba(210,210,220,0)");
    f.fillStyle = band; f.fillRect(-fw * 1.3, -fh * .16, fw * 2.6, fh * .32);
    f.restore();
    /* 2. star clouds: a dense haze of tiny stars that makes the band read as made of stars */
    const tints = [null, null, null, null, null, null, C.violet, C.gold, C.violet, C.magenta, C.gold];
    const nCloud = Math.round(area / 22 * dens);
    for (let i = 0; i < nCloud; i++) {
      const [x, y] = inBand(.05);
      if (x < 0 || y < 0 || x > fw || y > fh) continue;
      const tint = tints[(Math.random() * tints.length) | 0], c = tint ? mixW(tint, .5) : [232, 232, 240];
      f.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(.04 + Math.random() * .15).toFixed(3)})`;
      f.fillRect(x, y, px, px);
    }
    /* dust lanes cut through the clouds */
    for (let i = 0; i < 26; i++) {
      const tt = (Math.random() - .5) * fw * 2, x = cxm + dir[0] * tt + nrm[0] * gauss() * fh * .02, y = cym + dir[1] * tt + nrm[1] * gauss() * fh * .02, r = fw * (.025 + Math.random() * .05);
      f.save(); f.translate(x, y); f.rotate(ang + (Math.random() - .5) * .25); f.scale(1, .22);
      const g = f.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, "rgba(11,11,13,.38)"); g.addColorStop(.6, "rgba(11,11,13,.16)"); g.addColorStop(1, "rgba(11,11,13,0)");
      f.fillStyle = g; f.beginPath(); f.arc(0, 0, r, 0, TAU); f.fill(); f.restore();
    }
    /* 3. field stars, three magnitudes */
    const nField = Math.round(area / 170 * dens);
    for (let i = 0; i < nField; i++) {
      const [x, y] = Math.random() < .45 ? inBand(.09) : [Math.random() * fw, Math.random() * fh];
      if (x < 0 || y < 0 || x > fw || y > fh) continue;
      const tint = tints[(Math.random() * tints.length) | 0], c = tint ? mixW(tint, .7) : [240, 240, 246];
      const m = Math.random();
      const a = m < .7 ? .25 + Math.random() * .35 : m < .95 ? .5 + Math.random() * .35 : .85 + Math.random() * .15;
      const sz = (m < .7 ? 1 : m < .95 ? 1.5 : 2.2) * px;
      f.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
      f.beginPath(); f.arc(x, y, sz / 2, 0, TAU); f.fill();
    }
    f.globalCompositeOperation = "lighter";
    /* 4. coloured halo stars */
    const nMed = Math.round((small() ? 50 : 160) * fh / (H * 1.5));
    for (let i = 0; i < nMed; i++) {
      const [x, y] = Math.random() < .4 ? inBand(.1) : [Math.random() * fw, Math.random() * fh];
      const k = sprKeys[(Math.random() * sprKeys.length) | 0], r = (3 + Math.random() * 7) * px;
      f.globalAlpha = .45 + Math.random() * .5; f.drawImage(SPR[k], x - r, y - r, r * 2, r * 2);
    }
    /* 5. open clusters (Pleiades-like knots of blue-white stars) */
    const nCl = small() ? 2 : 4;
    for (let c = 0; c < nCl; c++) {
      const ccx = fw * (.08 + Math.random() * .84), ccy = fh * Math.random(), rad = (24 + Math.random() * 30) * px;
      const g = f.createRadialGradient(ccx, ccy, 0, ccx, ccy, rad * 1.6);
      g.addColorStop(0, rgba(C.violet, .09)); g.addColorStop(1, rgba(C.violet, 0));
      f.globalAlpha = 1; f.fillStyle = g; f.beginPath(); f.arc(ccx, ccy, rad * 1.6, 0, TAU); f.fill();
      const n = 10 + (Math.random() * 14) | 0;
      for (let i = 0; i < n; i++) {
        const rr = Math.abs(gauss()) * rad * .5, a = Math.random() * TAU, r = (2.5 + Math.random() * 5) * px;
        f.globalAlpha = .6 + Math.random() * .4;
        f.drawImage(Math.random() < .7 ? SPR.white : SPR.violet, ccx + Math.cos(a) * rr - r, ccy + Math.sin(a) * rr - r, r * 2, r * 2);
      }
    }
    f.globalAlpha = 1;
    /* 6. bright stars with spikes and twinkling stars (animated each frame) */
    const bk = ["white", "white", "violet", "gold", "violet", "magenta", "white", "gold"];
    const nB = small() ? 7 : 18;
    bright = Array.from({ length: nB }, (_, i) => ({ x: .03 + Math.random() * .94, y: Math.random() * 1.5, s: (i < 4 ? 90 + Math.random() * 50 : 34 + Math.random() * 46), k: bk[(Math.random() * bk.length) | 0], ph: Math.random() * TAU, sp: .25 + Math.random() * .5, rot: (Math.random() - .5) * .3 }));
    const nT = small() ? 40 : 110;
    twinkle = Array.from({ length: nT }, () => ({ x: Math.random(), y: Math.random() * 1.5, s: 4 + Math.random() * 7, k: sprKeys[(Math.random() * sprKeys.length) | 0], ph: Math.random() * TAU, sp: .8 + Math.random() * 2.4 }));
  }
  function resize() {
    DPR = Math.min(1.5, devicePixelRatio || 1);
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    buildNebula(); buildField(); sizeLines(); sizeHole();
  }
  let t = 0, shipK = 1, foldVisible = true;
  function drawCosmos() {
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1;
    cx.fillStyle = "#0b0b0d"; cx.fillRect(0, 0, W, H);
    const nh = (neb.height / neb.width) * W;
    const off = ((scrollY * .08) % (nh - H)) || 0;
    cx.drawImage(neb, Math.sin(t * .00004) * 20 * DPR - 10 * DPR, -off - (nh - H) * .2 + Math.cos(t * .00003) * 14 * DPR, W + 20 * DPR, nh);
    const fo = Math.min(scrollY * DPR * .05, field.height - H);
    cx.drawImage(field, 0, -fo);
    cx.globalCompositeOperation = "lighter";
    for (const b of bright) {
      let y = (b.y * H - scrollY * DPR * .1) % (H * 1.5); if (y < -100) y += H * 1.5;
      if (y > H + 100) continue;
      const k = .5 + .5 * Math.sin(b.ph + t * .001 * b.sp);
      const sz = b.s * DPR * (.86 + k * .18);
      cx.globalAlpha = .62 + k * .38;
      cx.save(); cx.translate(b.x * W, y); cx.rotate(b.rot); cx.drawImage(BRIGHT[b.k], -sz / 2, -sz / 2, sz, sz); cx.restore();
    }
    for (const tw of twinkle) {
      let y = (tw.y * H - scrollY * DPR * .07) % (H * 1.5); if (y < -20) y += H * 1.5;
      if (y > H + 20) continue;
      const k = Math.pow(.5 + .5 * Math.sin(tw.ph + t * .001 * tw.sp), 3);
      const sz = tw.s * DPR * (.7 + k * .6);
      cx.globalAlpha = .15 + k * .85;
      cx.drawImage(SPR[tw.k], tw.x * W - sz / 2, y - sz / 2, sz, sz);
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
    drawShip();
    const dim = Math.min(1, Math.max(0, scrollY / (innerHeight * .9))) * .58;
    if (dim > 0) { cx.fillStyle = `rgba(11,11,13,${dim.toFixed(3)})`; cx.fillRect(0, 0, W, H); }
  }

  /* a Sputnik-type sphere with four swept antennas drifts across now and then */
  let ship = null, nextShip = performance.now() + 3500, lastBeep = 0, beepAlt = false;
  function drawShip() {
    const now = performance.now();
    if (!ship && now > nextShip) {
      const dir = Math.random() < .5 ? 1 : -1;
      ship = { x: dir > 0 ? -80 * DPR : W + 80 * DPR, y: H * (.12 + Math.random() * .7), vx: dir * (.3 + Math.random() * .3) * DPR, vy: (Math.random() - .5) * .08 * DPR, k: (4 + Math.random() * 3) * DPR, dir, rot: Math.random() * TAU };
    }
    if (!ship) return;
    ship.x += ship.vx * shipK; ship.y += ship.vy * shipK; ship.rot += .002 * shipK;   // shipK: elapsed time in 60fps frames
    const { x, y, k, dir } = ship;
    cx.save(); cx.translate(x, y); cx.scale(dir, 1); cx.rotate(Math.sin(ship.rot) * .12);
    /* antennas trail behind the direction of travel */
    cx.strokeStyle = "rgba(233,233,235,.55)"; cx.lineWidth = .8 * DPR;
    [[-.55, -4.6, -2.2], [-.85, -5.6, -.8], [-.85, -5.6, .8], [-.55, -4.6, 2.2]].forEach(([ax, ex, ey], i) => {
      const ay = [-.6, -.25, .25, .6][i];
      cx.beginPath(); cx.moveTo(ax * k, ay * k); cx.lineTo(ex * k, ey * k); cx.stroke();
    });
    const g = cx.createRadialGradient(-.35 * k, -.4 * k, 0, 0, 0, k);
    g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(.35, "rgba(190,190,198,.85)"); g.addColorStop(1, "rgba(60,60,66,.9)");
    cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, k, 0, TAU); cx.fill();
    cx.strokeStyle = "rgba(11,11,13,.5)"; cx.lineWidth = .6 * DPR; cx.beginPath(); cx.ellipse(0, 0, k, k * .18, 0, 0, TAU); cx.stroke();
    cx.globalCompositeOperation = "lighter";
    const gl = cx.createRadialGradient(-.35 * k, -.4 * k, 0, -.35 * k, -.4 * k, k * 2.4);
    gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = gl; cx.beginPath(); cx.arc(-.35 * k, -.4 * k, k * 2.4, 0, TAU); cx.fill();
    cx.restore();
    /* while it is in view and sound is on: alternating beeps, about three a second */
    if (x < -120 * DPR || x > W + 120 * DPR) { ship = null; nextShip = now + 14000 + Math.random() * 10000; }
  }

  /* =========================================================
     CONSTELLATIONS — gold threads that draw in as each stage arrives
     (shapes are simplified versions of the real star patterns)
     ========================================================= */
  const ln = $("#lines"), lx = ln.getContext("2d");
  let LW, LH;
  function sizeLines() { LW = ln.width = innerWidth * DPR; LH = ln.height = innerHeight * DPR; }
  const CONST = [
    { sec: "#s01", name: "Ursa Major", side: .84, k: 30, pts: [[0,0],[1,-.2],[1.8,-.25],[2.6,-.15],[2.7,.5],[3.7,.6],[3.8,-.1]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
    { sec: "#s02", name: "Cassiopeia", side: .86, k: 36, pts: [[0,0],[.8,.7],[1.6,.2],[2.4,.8],[3.2,.1]], e: [[0,1],[1,2],[2,3],[3,4]] },
    { sec: "#s03", name: "Lyra", side: .9, k: 46, pts: [[0,0],[.4,.5],[.9,.4],[1.1,1.0],[.6,1.1]], e: [[0,1],[1,2],[2,3],[3,4],[4,1]] },
    { sec: "#s04", name: "Cygnus", side: .86, k: 38, pts: [[1,0],[1,1],[1,2],[1,3],[0,1.1],[2,.9]], e: [[0,1],[1,2],[2,3],[4,1],[1,5]] },
    { sec: "#s05", name: "Orion", side: .86, k: 34, pts: [[0,0],[2,.2],[.7,1.6],[1,1.5],[1.3,1.4],[.4,3],[2,2.8]], e: [[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]] },
    { sec: "#s06", name: "Aquila", side: .86, k: 40, pts: [[1,0],[1.3,-.3],[.7,.3],[0,-.6],[2.2,.8]], e: [[1,0],[0,2],[0,3],[0,4]] },
    { sec: "#s07", name: "Scorpius", side: .84, k: 30, pts: [[0,0],[.3,.5],[.5,1.1],[.6,1.8],[.9,2.4],[1.5,2.8],[2.1,2.6],[2.4,2.1],[-.4,-.2],[.3,-.4]], e: [[8,0],[0,9],[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
    { sec: "#s09", name: "Crux", side: .88, k: 48, pts: [[.5,0],[.5,1.6],[0,.7],[1.1,.6]], e: [[0,1],[2,3]] },
    { sec: "#s10", name: "Corona Borealis", side: .86, k: 34, pts: [[0,0],[.5,.5],[1.2,.75],[2,.7],[2.6,.4],[3,0]], e: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
    { sec: "#s11", name: "Gemini", side: .86, k: 34, pts: [[0,0],[1,-.1],[.1,1],[1.1,.9],[.2,2],[1.2,1.9],[.3,2.9],[1.3,2.8]], e: [[0,2],[2,4],[4,6],[1,3],[3,5],[5,7],[2,3]] },
    { sec: "#s12", name: "Andromeda", side: .86, k: 34, pts: [[0,0],[.9,.25],[1.8,.4],[2.8,.45],[1.7,-.4],[2.5,-.9]], e: [[0,1],[1,2],[2,3],[1,4],[4,5]] },
    { sec: "#oath", name: "Polaris", side: .82, k: 50, pts: [[0,0]], e: [] }
  ].map(c => ({ ...c, el: $(c.sec) }));
  function drawLines() {
    lx.clearRect(0, 0, LW, LH);
    if (small()) return;
    lx.font = `italic ${15 * DPR}px "Cormorant Garamond", Georgia, serif`;
    for (const c of CONST) {
      if (!c.el) continue;
      const r = c.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) continue;
      const prog = reduce ? 1 : Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (innerHeight * .6)));
      const ox = c.side * innerWidth - (c.k * 2.2), oy = r.top + Math.min(r.height * .22, 220);
      const P = c.pts.map(([x, y]) => [(ox + x * c.k) * DPR, (oy + y * c.k) * DPR]);
      /* threads */
      lx.lineWidth = .8 * DPR; lx.globalCompositeOperation = "lighter";
      const nE = c.e.length;
      c.e.forEach(([a, b], i) => {
        const local = Math.min(1, Math.max(0, prog * (nE + 1) - i));
        if (local <= 0) return;
        const [x1, y1] = P[a], [x2, y2] = P[b];
        const g = lx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(233,233,235,.45)"); g.addColorStop(1, "rgba(233,233,235,.22)");
        lx.strokeStyle = g; lx.beginPath(); lx.moveTo(x1, y1); lx.lineTo(x1 + (x2 - x1) * local, y1 + (y2 - y1) * local); lx.stroke();
      });
      /* nodes */
      P.forEach(([x, y], i) => {
        const s = (i === 0 ? 22 : 13) * DPR * (.5 + prog * .5);
        lx.globalAlpha = .4 + prog * .6;
        lx.drawImage(i === 0 ? SPR.gold : SPR.white, x - s / 2, y - s / 2, s, s);
      });
      lx.globalAlpha = .35 + prog * .45; lx.globalCompositeOperation = "source-over";
      lx.fillStyle = "#9a9aa0";
      const minY = Math.min(...P.map(p => p[1])), minX = Math.min(...P.map(p => p[0]));
      lx.fillText(c.name, minX, minY - 16 * DPR);
      lx.globalAlpha = 1;
    }
  }

  /* =========================================================
     EVENT HORIZON — black hole with accretion disk + photon ring
     ========================================================= */
  const hc = $("#hole"), hfc = $("#holeFront"), hbx = hc.getContext("2d"), hfx = hfc.getContext("2d"); let hx = hbx;
  let HW, HH, parts = [];
  function sizeHole() {
    const b = hc.getBoundingClientRect();
    HW = hc.width = hfc.width = Math.max(10, b.width * DPR); HH = hc.height = hfc.height = Math.max(10, b.height * DPR);
    const n = small() ? 360 : 900;
    parts = Array.from({ length: n }, () => {
      const u = Math.random();
      const R = 1.45 + Math.pow(u, 1.6) * 2.4;            /* in shadow radii */
      return { a: Math.random() * TAU, R, w: .9 / Math.pow(R, 1.5), s: .6 + Math.random() * 1.4, hot: R < 2.1 };
    });
  }
  function diskBand(cxh, cyh, r, tilt, front) {
    hx.save();
    hx.beginPath(); front ? hx.rect(0, cyh, HW, HH) : hx.rect(0, 0, HW, cyh); hx.clip();
    hx.translate(cxh, cyh); hx.scale(1, tilt);
    const g = hx.createRadialGradient(0, 0, r * 1.3, 0, 0, r * 4.3);
    g.addColorStop(0, "rgba(246,207,124,0)");
    g.addColorStop(.06, "rgba(255,240,205,.9)");
    g.addColorStop(.16, "rgba(246,207,124,.62)");
    g.addColorStop(.38, "rgba(214,160,72,.28)");
    g.addColorStop(.7, "rgba(170,118,44,.1)");
    g.addColorStop(1, "rgba(170,118,44,0)");
    hx.globalCompositeOperation = "lighter";
    hx.fillStyle = g; hx.beginPath(); hx.arc(0, 0, r * 4.3, 0, TAU); hx.fill();
    hx.restore();
  }
  function drawHole(dt) {
    hx = hbx;
    hbx.clearRect(0, 0, HW, HH); hfx.clearRect(0, 0, HW, HH);
    const cxh = HW / 2, cyh = HH * .5, r = HH * .2, tilt = .16;
    const step = reduce ? 0 : dt * .0005;
    /* wide soft halo */
    let g = hx.createRadialGradient(cxh, cyh, r, cxh, cyh, Math.min(r * 2.6, HH * .49));
    g.addColorStop(0, "rgba(246,207,124,.16)"); g.addColorStop(.35, "rgba(214,160,72,.05)"); g.addColorStop(1, "rgba(214,160,72,0)");
    hx.fillStyle = g; hx.fillRect(0, 0, HW, HH);
    /* far half of the disk */
    diskBand(cxh, cyh, r, tilt, false);
    hx.globalCompositeOperation = "lighter";
    const dot = (p, front) => {
      if ((Math.sin(p.a) > 0) !== front) return;
      const x = cxh + Math.cos(p.a) * p.R * r, y = cyh + Math.sin(p.a) * p.R * r * tilt;
      const beam = .35 + .65 * (.5 - .5 * Math.cos(p.a + .3));
      const spr = p.hot ? SPR.white : SPR.gold;
      const s = (p.hot ? 7 : 5) * p.s * DPR;
      hx.globalAlpha = Math.min(1, .15 + beam * .55);
      hx.drawImage(spr, x - s / 2, y - s / 2, s, s);
    };
    for (const p of parts) { p.a += p.w * step; dot(p, false); }
    hx.globalAlpha = 1;
    /* lensed image of the far disk: a luminous ring bent over the shadow */
    hx.save();
    hx.shadowColor = "rgba(246,207,124,.9)"; hx.shadowBlur = 20 * DPR;
    g = hx.createLinearGradient(cxh, cyh - r * 1.4, cxh, cyh + r * 1.4);
    g.addColorStop(0, "rgba(255,244,214,.98)"); g.addColorStop(.35, "rgba(246,207,124,.8)"); g.addColorStop(.5, "rgba(214,160,72,.25)"); g.addColorStop(.65, "rgba(246,207,124,.5)"); g.addColorStop(1, "rgba(255,236,190,.7)");
    hx.strokeStyle = g;
    hx.lineWidth = r * .16; hx.beginPath(); hx.ellipse(cxh, cyh, r * 1.24, r * 1.2, 0, Math.PI, TAU); hx.stroke();
    hx.lineWidth = r * .07; hx.beginPath(); hx.ellipse(cxh, cyh, r * 1.18, r * 1.12, 0, 0, Math.PI); hx.stroke();
    hx.restore();
    hx.globalCompositeOperation = "source-over";
    /* the shadow */
    hx.fillStyle = "#000"; hx.beginPath(); hx.arc(cxh, cyh, r * 1.02, 0, TAU); hx.fill();
    g = hx.createRadialGradient(cxh, cyh, r * 1.0, cxh, cyh, r * 1.1);
    g.addColorStop(0, "rgba(0,0,0,.9)"); g.addColorStop(1, "rgba(0,0,0,0)");
    hx.fillStyle = g; hx.beginPath(); hx.arc(cxh, cyh, r * 1.1, 0, TAU); hx.fill();
    hx.strokeStyle = "rgba(255,236,190,.75)"; hx.lineWidth = .8 * DPR;
    hx.beginPath(); hx.arc(cxh, cyh, r * 1.04, 0, TAU); hx.stroke();
    /* near half crosses in front — drawn on the layer above the portrait */
    hx = hfx;
    diskBand(cxh, cyh, r, tilt, true);
    hx.globalCompositeOperation = "lighter";
    for (const p of parts) dot(p, true);
    hx.globalAlpha = 1; hx.globalCompositeOperation = "source-over";
    hx = hbx;
  }

  /* =========================================================
     LOOP
     ========================================================= */
  let last = performance.now(), holeVisible = true;
  new IntersectionObserver(es => { holeVisible = es[0].isIntersecting; }).observe(hc);
  /* 핸드폰 부담 줄이기:
     - 별하늘 배경과 별자리 선은 핸드폰에서 스크롤 중 1초 30번, 멈춰 있을 때 1초 15번만 다시 그린다 (컴퓨터는 그대로 60번)
     - 08 발현 능력 별 지도는 화면에 보일 때만 그린다 */
  const MOBILE = matchMedia("(pointer: coarse)").matches || small();
  let lastBg = 0, lastScrollT = 0;
  addEventListener("scroll", () => { lastScrollT = performance.now(); }, { passive: true });
  function frame(now) {
    const dt = Math.min(64, now - last); last = now; t = now;
    const gap = !MOBILE ? 0 : (now - lastScrollT < 300 ? 33 : 66);
    if (now - lastBg >= gap - 2) {
      shipK = lastBg ? Math.min(4, (now - lastBg) / 16.7) : 1; lastBg = now;
      drawCosmos(); drawLines();
    }
    if (holeVisible) drawHole(dt);
    if (foldVisible) drawFold(now);
    if (!reduce) requestAnimationFrame(frame);
  }
  resize(); addEventListener("resize", resize);
  requestAnimationFrame(frame);
  if (reduce) addEventListener("scroll", () => { drawCosmos(); drawLines(); }, { passive: true });

  /* =========================================================
     EMPTY RADAR (awaiting stats) + NATAL SKY CHART
     ========================================================= */
  const SVGNS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  /* 5 stats on a 0–100 scale (HP 200 is shown on its own above the chart) */
  const STATS = [["공격력", 85], ["방어력", 40], ["민첩성", 90], ["정확성", 80], ["정신력", 25]];
  const rg = $("#radarG");
  const rpt = (i, r) => { const a = -Math.PI / 2 + i * TAU / STATS.length; return [Math.cos(a) * r, Math.sin(a) * r]; };
  let radarShape = null, statsDone = false;
  if (rg) {
    [25, 50, 75, 100].forEach(r => mk("circle", { r, cx: 0, cy: 0 }, rg));
    STATS.forEach(([n, v], i) => {
      const [x, y] = rpt(i, 100);
      mk("line", { x1: 0, y1: 0, x2: x, y2: y }, rg);
      const [lx, ly] = rpt(i, 120);
      const t = mk("text", { x: lx, y: ly - 2, "text-anchor": "middle" }, rg); t.textContent = n;
      const tv = mk("text", { x: lx, y: ly + 9, "text-anchor": "middle", class: "v" }, rg); tv.textContent = v;
    });
    radarShape = mk("polygon", { class: "shape", points: STATS.map(() => "0,0").join(" ") }, rg);
  }
  function runStats() {
    if (statsDone || !radarShape) return; statsDone = true;
    radarShape.setAttribute("points", STATS.map(([, v], i) => rpt(i, v).join(",")).join(" "));
    STATS.forEach(([, v], i) => { const [x, y] = rpt(i, v); setTimeout(() => mk("circle", { cx: x, cy: y, r: 2.4, class: "pt" }, rg), 900); });
    $$("#gauges li").forEach((li, i) => setTimeout(() => { $("i", li).style.width = li.dataset.v + "%"; }, i * 90));
  }
  const statsEl = $(".stats");
  if (statsEl) {
    if (reduce) runStats();
    else new IntersectionObserver((es, ob) => es.forEach(e => { if (e.isIntersecting) { runStats(); ob.disconnect(); } }), { threshold: .25 }).observe(statsEl);
  }
  const vg = $("#vgrid");
  if (vg) {
    for (let x = 0; x <= 540; x += 30) mk("line", { x1: x, x2: x, y1: 0, y2: 236 }, vg);
    for (let y = 0; y <= 236; y += 30) mk("line", { x1: 0, x2: 540, y1: y, y2: y }, vg);

  }
  const cg = $("#chartG");
  if (cg) {
    mk("circle", { r: 104, class: "ring ring--o" }, cg);
    [26, 52, 78].forEach(r => mk("circle", { r, class: "ring" }, cg));
    for (let h = 0; h < 24; h++) {
      const a = (h / 24) * TAU - Math.PI / 2, maj = h % 6 === 0;
      mk("line", { x1: Math.cos(a) * 104, y1: Math.sin(a) * 104, x2: Math.cos(a) * (maj ? 96 : 100), y2: Math.sin(a) * (maj ? 96 : 100) }, cg);
      if (maj) { const t = mk("text", { x: Math.cos(a) * 113, y: Math.sin(a) * 113 + 2, "text-anchor": "middle" }, cg); t.textContent = String(h).padStart(2, "0") + "h"; }
    }
    for (let i = 0; i < 90; i++) {
      const rr = Math.sqrt(Math.random()) * 100, a = Math.random() * TAU, z = Math.random();
      mk("circle", { cx: Math.cos(a) * rr, cy: Math.sin(a) * rr, r: (.4 + z * 1.1).toFixed(2), class: z > .93 ? "st st--g" : z > .86 ? "st st--v" : "st", opacity: (.35 + z * .6).toFixed(2) }, cg);
    }
    /* natal constellation: Scorpius (born 11.03), simplified shape in gold */
    const SCO = [[-46,-52],[-30,-46],[-14,-56],[-30,-30],[-26,-12],[-20,6],[-10,24],[4,40],[22,50],[42,46],[54,32],[50,18]];
    const SCO_E = [[1,0],[1,2],[1,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]];
    SCO_E.forEach(([a, b]) => mk("line", { x1: SCO[a][0], y1: SCO[a][1], x2: SCO[b][0], y2: SCO[b][1], class: "natal" }, cg));
    SCO.forEach(([x, y], i) => mk("circle", { cx: x, cy: y, r: i === 3 ? 3 : 1.8, class: "natal-st" }, cg));
    const t = mk("text", { x: 0, y: 84, "text-anchor": "middle", class: "natal-t" }, cg); t.textContent = "SCORPIUS · 11.03";
  }


  /* ================= photosensitivity + audio warning gate =================
     Shown once per tab. Enter buttons unlock after the warning has been on
     screen for LOCK ms. "소리 켜고 보기" / "소리 끄고 보기" both enter;
     "웹사이트 보지 않기" offers the Google Docs text instead. */
  function runGate(onEnter) {
    const gate = $("#gate"), key = "astro-gate";
    let ok = false;
    try { ok = sessionStorage.getItem(key) === "1"; } catch (e) {}
    if (!gate || ok) {
      if (gate) gate.remove();
      let pref = false;
      try { pref = sessionStorage.getItem("astro-sound") === "1"; } catch (e) {}
      if (pref) setSound(true);   // 새로고침 시 이전 선택 유지 (브라우저가 막으면 OFF로 돌아감)
      onEnter(); return;
    }
    document.body.classList.add("is-gated");
    const LOCK = 3000;
    const actions = $("#gateActions"), alt = $("#gateAlt");
    const enter = $("#gateEnter"), mute = $("#gateMute"), decline = $("#gateDecline"), back = $("#gateBack");
    const doc = $("#gateDoc"), bar = $("#gateBar"), status = $("#gateStatus"), timer = $(".gate__timer");
    const t0 = performance.now();
    let lastSec = -1;
    const lockLoop = now => {
      const k = Math.min(1, (now - t0) / LOCK);
      bar.style.width = k * 100 + "%";
      const left = Math.ceil((LOCK - (now - t0)) / 1000);
      if (k < 1) {
        if (left !== lastSec) { lastSec = left; status.textContent = "경고 확인 중 … " + left; }
        requestAnimationFrame(lockLoop);
      } else {
        status.textContent = "확인 완료 — 보는 방법을 선택하세요";
        timer.classList.add("is-ready");
        enter.disabled = false; mute.disabled = false;
        if (!actions.hidden) enter.focus();
      }
    };
    requestAnimationFrame(lockLoop);
    setTimeout(() => decline.focus(), 50);
    const go = withSound => {
      if (enter.disabled) return;
      try { sessionStorage.setItem(key, "1"); } catch (e) {}
      setSound(withSound);        // 클릭 직후라 브라우저 자동재생 제한에 걸리지 않음
      gate.classList.add("is-done");
      document.body.classList.remove("is-gated");
      setTimeout(() => gate.remove(), 700);
      onEnter();
    };
    enter.addEventListener("click", () => go(true));
    mute.addEventListener("click", () => go(false));
    decline.addEventListener("click", () => { actions.hidden = true; alt.hidden = false; doc.focus(); });
    back.addEventListener("click", () => { alt.hidden = true; actions.hidden = false; (enter.disabled ? decline : enter).focus(); });
    if (doc.getAttribute("aria-disabled") === "true") doc.addEventListener("click", e => e.preventDefault());
    gate.addEventListener("keydown", e => {   // 경고 창 안에서만 Tab 이동
      if (e.key !== "Tab") return;
      const f = $$("button:not([disabled]),a[href]", gate).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ================= launch countdown: T−3, T−2, T−1 at 0.8 s ================= */
  function runLaunch() {
    const launch = $("#launch"); if (!launch) return;
    let seen = false;
    try { seen = sessionStorage.getItem("astro-launched") === "1"; } catch (e) {}
    if (reduce || seen) { launch.remove(); return; }
    const lN = $("#launchN"), lMsg = $("#launchMsg");
    const steps = [["3", "guidance internal"], ["2", "main engine start"], ["1", "ignition"]];
    let i = 0, done = false;
    launch.classList.remove("is-wait");
    document.body.classList.add("is-launching");
    const show = () => { lN.textContent = steps[i][0]; lMsg.textContent = steps[i][1]; lN.classList.remove("tick"); void lN.offsetWidth; lN.classList.add("tick"); };
    const end = () => {
      if (done) return; done = true;
      lMsg.textContent = "lift off";
      launch.classList.add("is-lift");
      setTimeout(() => { launch.classList.add("is-done"); document.body.classList.remove("is-launching"); }, 260);
      try { sessionStorage.setItem("astro-launched", "1"); } catch (e) {}
      setTimeout(() => launch.remove(), 1400);
    };
    show();
    const iv = setInterval(() => { i++; if (i >= steps.length) { clearInterval(iv); end(); return; } show(); }, 800);
    $("#launchSkip").addEventListener("click", () => { clearInterval(iv); end(); });
  }

  /* =========================================================
     REVEAL / RAIL / SIGNAL
     ========================================================= */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .1, rootMargin: "0px 0px -6% 0px" });
  $$(".rv").forEach(el => io.observe(el));
  const links = $$(".rail a"), stages = $$(".stage"), fill = $("#railFill"), sig = $("#sig");
  let cur = -1;
  function onScroll() {
    const h = document.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    fill.style.height = (p * 100).toFixed(2) + "%";
    sig.textContent = Math.max(4, Math.round(100 - p * 92)) + "%";
    let c = 0; stages.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * .45) c = i; });
    if (c !== cur) { cur = c; links.forEach((a, i) => { a.classList.toggle("is-on", i === c); a.classList.toggle("is-past", i < c); }); chime(c); }
  }
  addEventListener("scroll", onScroll, { passive: true });

  /* =========================================================
     TALENT — 별들의 저편에서 (fold simulator)
     ========================================================= */
  const fc = $("#foldCanvas"), fx = fc.getContext("2d");
  const fold = $("#fold"), hint = $("#foldHint");
  const uEl = $("#fUses"), dEl = $("#fDist"), drEl = $("#fDrift"), sEl = $("#fStatus"), meter = $("#fMeter");
  const MAP = 140;                         /* map spans 140 m */
  const ZONES = [ { x: .3, y: .32, r: .17 }, { x: .72, y: .7, r: .15 }, { x: .25, y: .78, r: .11 } ]; /* familiar ground */
  const mapStars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: .4 + Math.random(), k: sprKeys[(Math.random() * sprKeys.length) | 0] }));
  let pos = { x: .5, y: .5 }, uses = 0, anim = null, trail = [], FS = 0;
  function sizeFold() { const b = fc.getBoundingClientRect(); FS = fc.width = fc.height = Math.max(10, Math.round(b.width * DPR)); }
  new ResizeObserver(sizeFold).observe(fc); sizeFold();
  new IntersectionObserver(es => { foldVisible = es[0].isIntersecting; }).observe(fc);
  const familiar = (x, y) => ZONES.some(z => Math.hypot(x - z.x, y - z.y) < z.r);

  function drawFold(now) {
    if (!FS) return;
    const S = FS;
    fx.clearRect(0, 0, S, S);
    fx.fillStyle = "#08080a"; fx.fillRect(0, 0, S, S);
    /* familiar zones lit */
    for (const z of ZONES) {
      const g = fx.createRadialGradient(z.x * S, z.y * S, 0, z.x * S, z.y * S, z.r * S);
      g.addColorStop(0, "rgba(233,233,235,.10)"); g.addColorStop(1, "rgba(233,233,235,0)");
      fx.fillStyle = g; fx.beginPath(); fx.arc(z.x * S, z.y * S, z.r * S, 0, TAU); fx.fill();
      fx.strokeStyle = "rgba(233,233,235,.14)"; fx.setLineDash([2 * DPR, 4 * DPR]); fx.stroke(); fx.setLineDash([]);
    }
    /* stars */
    fx.globalCompositeOperation = "lighter";
    for (const s of mapStars) { const r = (6 + s.s * 8) * DPR; fx.globalAlpha = .35 + .4 * Math.sin(now * .001 + s.x * 9) ** 2; fx.drawImage(SPR[s.k], s.x * S - r / 2, s.y * S - r / 2, r, r); }
    fx.globalAlpha = 1; fx.globalCompositeOperation = "source-over";
    /* range rings around current position (25 / 50 / 75 / 100 m) */
    fx.font = `${9 * DPR}px "IBM Plex Mono", monospace`; fx.fillStyle = "#606066";
    [25, 50, 75, 100].forEach(m => {
      const rr = (m / MAP) * S;
      fx.strokeStyle = m === 100 ? "rgba(233,233,235,.45)" : "rgba(233,233,235,.10)";
      fx.lineWidth = (m === 100 ? 1 : .7) * DPR;
      fx.beginPath(); fx.arc(pos.x * S, pos.y * S, rr, 0, TAU); fx.stroke();
      fx.fillText(m + "m", pos.x * S + rr * .71 + 4 * DPR, pos.y * S - rr * .71);
    });
    /* trail of past folds */
    trail.forEach(tr => {
      const age = Math.max(0, (now - tr.t) / 700); if (age > 1) return;
      fx.strokeStyle = `rgba(233,233,235,${(.25 * (1 - age)).toFixed(3)})`; fx.lineWidth = 1 * DPR;
      fx.beginPath(); fx.moveTo(tr.a.x * S, tr.a.y * S); fx.quadraticCurveTo(tr.c.x * S, tr.c.y * S, tr.b.x * S, tr.b.y * S); fx.stroke();
    });
    trail = trail.filter(tr => now - tr.t < 700);
    /* active fold animation */
    if (anim) {
      const k = Math.min(1, Math.max(0, (now - anim.t) / 160));
      const e = 1 - Math.pow(1 - k, 4);
      const { a, b, c } = anim;
      const g = fx.createLinearGradient(a.x * S, a.y * S, b.x * S, b.y * S);
      g.addColorStop(0, "rgba(245,245,247,.95)"); g.addColorStop(1, "rgba(160,160,168,.8)");
      fx.strokeStyle = g; fx.lineWidth = 1.4 * DPR;
      fx.beginPath(); fx.moveTo(a.x * S, a.y * S);
      const n = 24; for (let i = 1; i <= n * e; i++) { const q = i / n; fx.lineTo(((1 - q) ** 2 * a.x + 2 * (1 - q) * q * c.x + q * q * b.x) * S, ((1 - q) ** 2 * a.y + 2 * (1 - q) * q * c.y + q * q * b.y) * S); }
      fx.stroke();
      [a, b].forEach((p, i) => {
        const rr = (8 + e * 34) * DPR * (i ? 1 : 1.2);
        fx.strokeStyle = `rgba(233,233,235,${((1 - e) * .9).toFixed(3)})`; fx.lineWidth = 1 * DPR;
        fx.beginPath(); fx.arc(p.x * S, p.y * S, rr, 0, TAU); fx.stroke();
      });
      fx.globalCompositeOperation = "lighter";
      const fl = (1 - k) * 60 * DPR; fx.globalAlpha = 1 - k; fx.drawImage(BRIGHT.white, b.x * S - fl / 2, b.y * S - fl / 2, fl, fl); fx.globalAlpha = 1;
      fx.globalCompositeOperation = "source-over";
      if (anim.miss) { /* intended point vs landing point */
        fx.strokeStyle = "rgba(233,233,235,.5)"; fx.setLineDash([2 * DPR, 3 * DPR]);
        fx.beginPath(); fx.arc(anim.want.x * S, anim.want.y * S, 5 * DPR, 0, TAU); fx.moveTo(anim.want.x * S, anim.want.y * S); fx.lineTo(b.x * S, b.y * S); fx.stroke(); fx.setLineDash([]);
      }
      if (!anim.moved) { pos = { ...b }; anim.moved = true; }
      if (k >= 1) { trail.push({ ...anim, t: now }); anim = null; }
    }
    /* the traveller */
    const pr = 26 * DPR;
    fx.globalCompositeOperation = "lighter"; fx.drawImage(SPR.white, pos.x * S - pr / 2, pos.y * S - pr / 2, pr, pr); fx.globalCompositeOperation = "source-over";
    fx.strokeStyle = "rgba(233,233,235,.9)"; fx.lineWidth = 1 * DPR;
    fx.beginPath(); fx.moveTo(pos.x * S - 9 * DPR, pos.y * S); fx.lineTo(pos.x * S - 4 * DPR, pos.y * S); fx.moveTo(pos.x * S + 4 * DPR, pos.y * S); fx.lineTo(pos.x * S + 9 * DPR, pos.y * S);
    fx.moveTo(pos.x * S, pos.y * S - 9 * DPR); fx.lineTo(pos.x * S, pos.y * S - 4 * DPR); fx.moveTo(pos.x * S, pos.y * S + 4 * DPR); fx.lineTo(pos.x * S, pos.y * S + 9 * DPR); fx.stroke();
  }

  /* 혼잣말: 원문에 트라우마 설정이 없어 쿠드랴프카 본인의 대사 조각만 쓴다. 설정이 생기면 이 줄만 바꾸면 된다 */
  /* 혼잣말은 index.html 의 <ul id="murmurLines"> 에서 읽는다 (그곳에서 수정) */
  const MURMUR = $$("#murmurLines li").map(li => li.textContent.trim()).filter(Boolean);
  if (!MURMUR.length) MURMUR.push("…");
  const other = $("#otherside");
  let otherTimer = 0;
  function showOtherside() {
    other.innerHTML = "";
    const n = small() ? 10 : 22;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.textContent = MURMUR[i % MURMUR.length];
      s.style.left = (Math.random() * 82) + "%"; s.style.top = (Math.random() * 90) + "%";
      s.style.fontSize = (14 + Math.random() * 28) + "px"; s.style.animationDelay = (Math.random() * 4) + "s";
      other.appendChild(s);
    }
    document.body.classList.add("is-otherside");
    clearTimeout(otherTimer);
    otherTimer = setTimeout(() => document.body.classList.remove("is-otherside"), 4200);
  }
  function applyStrain() {
    const s = uses <= 10 ? (uses / 10) * .55 : Math.min(1, .7 + (uses - 10) * .1);
    document.documentElement.style.setProperty("--strain", s.toFixed(3));
    document.body.classList.toggle("is-strained", uses > 0);
    document.body.classList.toggle("is-wobble", uses >= 4 && !reduce);
    fold.classList.toggle("is-critical", uses > 10);
    uEl.textContent = uses;
    meter.style.width = Math.min(100, uses / 14 * 100) + "%";
    sEl.textContent = uses === 0 ? "STABLE" : uses <= 3 ? "STABLE" : uses <= 7 ? "STABLE · 환각 경미" : uses <= 10 ? "STABLE · 환각 심화" : "CRITICAL · 전투 불능 위험";
  }
  /* 5초 규칙: 이동 직후 5초 안에 바로 이전 지점으로 되돌아가면 횟수를 차감하지 않는다 */
  const backBtn = $("#fBack"), backT = $("#fBackT"), BACK_MS = 5000;
  let backTo = null, backUntil = 0, backTimer = 0;
  function armBack(from) {
    backTo = { ...from }; backUntil = performance.now() + BACK_MS;
    clearInterval(backTimer);
    const tick = () => {
      const left = backUntil - performance.now();
      if (left <= 0 || !backTo) { clearInterval(backTimer); backTo = null; backBtn.disabled = true; backT.textContent = ""; return; }
      backBtn.disabled = false; backT.textContent = "· " + (left / 1000).toFixed(1) + "s";
    };
    tick(); backTimer = setInterval(tick, 100);
  }
  function returnBack() {
    if (!backTo || performance.now() > backUntil) return false;
    if (anim) { trail.push({ ...anim, t: performance.now() }); anim = null; }
    const land = backTo, mid = { x: (pos.x + land.x) / 2, y: (pos.y + land.y) / 2 }, nx = -(land.y - pos.y), ny = land.x - pos.x;
    const dist = Math.hypot(land.x - pos.x, land.y - pos.y) * MAP;
    anim = { a: { ...pos }, b: land, c: { x: mid.x - nx * .35, y: mid.y - ny * .35 }, t: performance.now(), miss: false, want: land };
    backTo = null; backUntil = 0; clearInterval(backTimer); backBtn.disabled = true; backT.textContent = "";
    dEl.textContent = dist.toFixed(1) + "m"; drEl.textContent = "0.0m";
    hint.textContent = "5초 안에 이전 지점으로 복귀 — 사용 횟수가 차감되지 않았습니다";
    whoosh();
    return true;
  }
  backBtn.addEventListener("click", returnBack);
  fc.addEventListener("click", ev => {
    const b = fc.getBoundingClientRect();
    const want = { x: (ev.clientX - b.left) / b.width, y: (ev.clientY - b.top) / b.height };
    if (backTo && Math.hypot(want.x - backTo.x, want.y - backTo.y) * MAP < 4 && returnBack()) return;   // 이전 지점을 다시 누른 경우
    if (anim) { trail.push({ ...anim, t: performance.now() }); anim = null; }
    const dist = Math.hypot(want.x - pos.x, want.y - pos.y) * MAP;
    if (dist > 100) { hint.textContent = `${dist.toFixed(1)}m — 최대 100m를 넘어 공간을 접을 수 없습니다`; dEl.textContent = "OUT"; return; }
    if (dist < 2) return;
    uses++;
    const known = familiar(want.x, want.y);
    let land = { ...want }, drift = 0;
    if (!known) {
      drift = (1 + Math.random() * 3.5) * (1 + Math.max(0, uses - 6) * .25);
      const a = Math.random() * TAU;
      land = { x: Math.min(.98, Math.max(.02, want.x + Math.cos(a) * drift / MAP)), y: Math.min(.98, Math.max(.02, want.y + Math.sin(a) * drift / MAP)) };
    }
    const mid = { x: (pos.x + land.x) / 2, y: (pos.y + land.y) / 2 }, nx = -(land.y - pos.y), ny = land.x - pos.x;
    anim = { a: { ...pos }, b: land, c: { x: mid.x + nx * .35, y: mid.y + ny * .35 }, t: performance.now(), miss: !known, want };
    dEl.textContent = dist.toFixed(1) + "m";
    drEl.textContent = known ? "0.0m" : "+" + drift.toFixed(1) + "m";
    hint.textContent = known ? "익숙한 장소 — 정확히 도착했습니다" : "처음 보는 장소 — 도착 지점이 빗나갔습니다";
    applyStrain(); whoosh(); armBack(anim.a);
    if (uses > 10) setTimeout(showOtherside, 500);
  });
  $("#fReset").addEventListener("click", () => {
    uses = 0; trail = []; pos = { x: .5, y: .5 };
    backTo = null; clearInterval(backTimer); backBtn.disabled = true; backT.textContent = "";
    dEl.textContent = drEl.textContent = "—";
    hint.textContent = "별 지도에서 이동할 지점을 누르세요";
    document.body.classList.remove("is-otherside");
    applyStrain();
  });
  applyStrain();

  /* =========================================================
     SPECIAL — 별들의 사슬 (canvas chain simulator)
     1) 최초 대상은 판정 없이 연결  2) 추가 연결마다 정신력 판정, 실패 시 직전까지 고정 (최대 7명)
     3) 다음 턴 공격 적중 → 사슬이 연쇄로 부서지며 연결된 모두가 같은 피해
     판정 성공률은 시연용 임의값(두 번째 90%, 이후 10%p씩 감소)
     ========================================================= */
  const chainStage = $("#chainStage");
  if (chainStage) {
    const cv = $("#chainCanvas"), g = cv.getContext("2d");
    const tWrap = $("#chainTargets"), chain = $("#chain");
    const nEl = $("#cN"), nextEl = $("#cNext"), chkEl = $("#cCheck"), stEl = $("#cStatus"), loadEl = $("#cLoad");
    const chHint = $("#chainHint"), banner = $("#chainBanner");
    const strikeBtn = $("#cStrike"), resetBtnC = $("#cReset");
    const GOLD = "246,207,124", WHITE = "245,245,247";
    /* 적은 최대 5명. 사슬은 최대 7회, 같은 적을 다시 이을 수 있다(바로 직전 대상만 제외) */
    const POS_WIDE = [[.14,.34],[.36,.18],[.60,.40],[.85,.22],[.46,.72]];
    const POS_TALL = [[.22,.16],[.76,.14],[.50,.40],[.20,.66],[.78,.68]];
    let W = 0, H = 0, CDPR = 1, POS = POS_WIDE;
    const enemies = POS_WIDE.map((_, i) => ({ i, state: "idle", flash: -1e9, pulse: -1e9 }));
    let linked = [], links = [], fails = [], parts = [], texts = [], locked = false, struck = false, busy = false, strikeT0 = 0;
    const dust = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + .2, a: Math.random() * .5 + .1, k: Math.random() * TAU }));

    /* targets as real buttons (click + keyboard) */
    const btns = enemies.map(e => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chain__t"; b.setAttribute("aria-label", "적 E" + (e.i + 1) + " 연결");
      b.addEventListener("click", ev => { ev.stopPropagation(); pick(e.i); });
      tWrap.appendChild(b); return b;
    });
    function layout() {
      const r = chainStage.getBoundingClientRect();
      CDPR = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.round(W * CDPR); cv.height = Math.round(H * CDPR);
      POS = W / H < 1.1 ? POS_TALL : POS_WIDE;
      btns.forEach((b, i) => { b.style.left = POS[i][0] * 100 + "%"; b.style.top = POS[i][1] * 100 + "%"; });
    }
    new ResizeObserver(layout).observe(chainStage); layout();
    const P = i => ({ x: POS[i][0] * W, y: POS[i][1] * H });
    const lerp = (a, b, t) => a + (b - a) * t, easeOut = t => 1 - Math.pow(1 - t, 3);

    /* particles */
    function burst(x, y, n, opt = {}) {
      if (reduce) n = Math.min(n, 6);
      for (let k = 0; k < n; k++) {
        const a = opt.dir != null ? opt.dir + (Math.random() - .5) * (opt.spread || 1) : Math.random() * TAU;
        const sp = (opt.speed || 160) * (.35 + Math.random() * .9);
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: (opt.life || .7) * (.6 + Math.random() * .7),
          r: (opt.size || 1.8) * (.5 + Math.random()), col: opt.col || GOLD, g: opt.g == null ? 260 : opt.g, shard: !!opt.shard, rot: Math.random() * TAU, vr: (Math.random() - .5) * 14 });
      }
    }
    function shards(a, b, col, n) {   // a line breaking into falling pieces
      if (reduce) n = Math.min(n, 5);
      const nx = -(b.y - a.y), ny = b.x - a.x, len = Math.hypot(nx, ny) || 1;
      for (let k = 0; k < n; k++) {
        const t = Math.random(), x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t), side = Math.random() < .5 ? -1 : 1;
        const sp = 60 + Math.random() * 160;
        parts.push({ x, y, vx: nx / len * sp * side + (Math.random() - .5) * 60, vy: ny / len * sp * side - 40 - Math.random() * 80,
          life: 0, max: .9 + Math.random() * .7, r: 2 + Math.random() * 4, col, g: 420, shard: true, rot: Math.random() * TAU, vr: (Math.random() - .5) * 18 });
      }
    }
    const say = (x, y, text, col, big) => texts.push({ x, y, text, col: col || GOLD, t0: performance.now(), big: !!big });
    let finalHits = null;   // after the shatter: { enemyIndex: times hit } shown under each star until reset
    function shake(hard) {
      if (reduce) return;
      chain.classList.remove("is-shake"); void chain.offsetWidth; chain.classList.add("is-shake");
      if (hard) { document.body.classList.remove("is-quake"); void document.body.offsetWidth; document.body.classList.add("is-quake"); }
      setTimeout(() => { chain.classList.remove("is-shake"); document.body.classList.remove("is-quake"); }, 460);
    }
    const chanceFor = n => Math.max(.1, .9 - .1 * (n - 1));   // n = how many are already linked

    function paint() {
      nEl.textContent = Math.max(0, linked.length - 1);
      const canLink = !locked && !struck && linked.length > 0 && linked.length < 7;
      nextEl.textContent = !linked.length ? "최초 · 판정 없음" : canLink ? Math.round(chanceFor(linked.length) * 100) + "%" : "—";
      loadEl.style.width = (Math.max(0, linked.length - 1) / 6 * 100) + "%";
      strikeBtn.disabled = struck || busy || linked.length < 2;
      resetBtnC.disabled = busy;
      const lastI = linked[linked.length - 1];
      btns.forEach((b, i) => { b.disabled = struck || locked || (linked.length > 0 && i === lastI); });
    }
    function setBanner(html) { banner.innerHTML = html || ""; banner.classList.toggle("is-on", !!html); }

    function pick(i) {
      if (busy) return;
      if (struck) { chHint.textContent = "사슬이 이미 부서졌습니다 — 초기화를 누르세요"; return; }
      if (locked) { chHint.textContent = linked.length >= 7 ? "사슬을 최대 6번까지 이었습니다" : "판정 실패 — 더 이상 연결할 수 없습니다"; return; }
      if (linked.length && i === linked[linked.length - 1]) { chHint.textContent = "바로 직전 대상과는 이을 수 없습니다 — 다른 적을 고르세요"; return; }
      const now = performance.now(), p = P(i);
      if (!linked.length) {
        linked.push(i); enemies[i].state = "linked"; enemies[i].pulse = now;
        burst(p.x, p.y, 26, { speed: 140 }); say(p.x, p.y - 30, "TARGET");
        chkEl.textContent = "—"; chkEl.className = ""; stEl.textContent = "LINKING";
        chHint.textContent = "최초 대상 지정 — 다음 적을 눌러 사슬을 뻗으세요"; chime(0); paint(); return;
      }
      const chance = chanceFor(linked.length), prev = linked[linked.length - 1], ok = Math.random() < chance;
      busy = true; paint();
      if (ok) {
        const same = links.filter(l => (l.a === prev && l.b === i) || (l.a === i && l.b === prev)).length;
        links.push({ a: prev, b: i, t0: now, dur: reduce ? 1 : 360, state: "grow", bend: same ? (same % 2 ? 1 : -1) * Math.ceil(same / 2) * .28 : 0 });
        chkEl.textContent = "성공 · " + Math.round(chance * 100) + "%"; chkEl.className = "is-good";
        whoosh();
        setTimeout(() => {
          const q = P(i), t = performance.now();
          linked.push(i); enemies[i].state = "linked"; enemies[i].pulse = t;
          const again = linked.slice(0, -1).includes(i);
          burst(q.x, q.y, again ? 48 : 34, { speed: again ? 230 : 190 }); say(q.x, q.y - 30, again ? "LINK " + linked.length + " · 중복" : "LINK " + linked.length);
          chime(linked.length); busy = false;
          const uniq = new Set(linked).size;
          if (linked.length >= 7) { locked = true; stEl.textContent = "MAX 6"; chHint.textContent = "사슬 6번 완료 (적 " + uniq + "명) — 다음 턴 공격으로 연쇄시키세요"; }
          else { stEl.textContent = "LINKING"; chHint.textContent = "사슬 " + (linked.length - 1) + "번 · 적 " + uniq + "명 — 계속 잇거나 공격하세요 (중복 연결 가능)"; }
          paint();
        }, reduce ? 0 : 360);
      } else {
        fails.push({ a: prev, b: i, t0: now });
        chkEl.textContent = "실패 · " + Math.round(chance * 100) + "%"; chkEl.className = "is-bad";
        setTimeout(() => {
          const A = P(prev), B = P(i), m = { x: lerp(A.x, B.x, .55), y: lerp(A.y, B.y, .55) };
          shards(A, m, WHITE, 26); burst(m.x, m.y, 18, { col: WHITE, speed: 220 }); say(m.x, m.y - 40, "정신력 판정 실패", WHITE, true);
          enemies[i].flash = performance.now() - 200; burst(B.x, B.y, 14, { col: "160,160,168", speed: 90, life: .6 });
          shake(true); thud();
          locked = true; busy = false; stEl.textContent = "HOLD " + linked.length;
          chHint.textContent = "판정 실패 — 직전까지 연결된 사슬(" + (linked.length - 1) + "번 · 적 " + new Set(linked).size + "명)만 유지";
          paint();
        }, reduce ? 0 : 520);
      }
    }
    chainStage.addEventListener("click", ev => {   // click near a star on the canvas also picks it
      const r = chainStage.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      let best = -1, bd = 44;
      POS.forEach((_, i) => { const p = P(i), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) pick(best);
    });

    strikeBtn.addEventListener("click", () => {
      if (strikeBtn.disabled) return;
      struck = true; busy = true; strikeT0 = performance.now(); paint();
      stEl.textContent = "SHATTER"; chHint.textContent = "공격 적중 — 사슬이 연쇄적으로 부서집니다"; setBanner("");
      const STEP = reduce ? 0 : 230;
      const first = P(linked[0]);
      burst(first.x, first.y, 50, { col: WHITE, speed: 320, life: .6 }); shake(false); whoosh();
      enemies[linked[0]].flash = performance.now(); say(first.x, first.y - 54, "HIT", WHITE, true);
      links.forEach(l => { l.state = "on"; });
      const run = {};
      linked.forEach((idx, k) => setTimeout(() => {
        const t = performance.now(), p = P(idx);
        if (k > 0) {
          const l = links[k - 1]; l.state = "break"; l.bt = t;
          shardsCurve(l, GOLD, 34); crack();
        }
        run[idx] = (run[idx] || 0) + 1;
        enemies[idx].flash = t; enemies[idx].state = "hit";
        burst(p.x, p.y, 30 + run[idx] * 12, { speed: 220 + run[idx] * 40, life: .9 }); chime(k + 1);
        say(p.x, p.y - 34, "피해 ×" + run[idx], run[idx] > 1 ? WHITE : GOLD, run[idx] > 1);
      }, STEP * (k + 1)));
      setTimeout(() => {
        const t = performance.now();
        [...new Set(linked)].forEach(idx => { enemies[idx].pulse = t; const p = P(idx); burst(p.x, p.y, 14, { speed: 120, life: .5 }); });
        const uniq = new Set(linked).size;
        finalHits = {}; linked.forEach(i => { finalHits[i] = (finalHits[i] || 0) + 1; });
        setBanner("최종 피해 총 " + linked.length + "회<small>적 " + uniq + "명 · 이어진 횟수만큼 동일 피해</small>");
        stEl.textContent = "DONE";
        chHint.textContent = Object.keys(finalHits).map(i => "E" + (+i + 1) + " ×" + finalHits[i]).join(" · ") + " — 초기화로 다시 해 보세요";
        busy = false; paint();
      }, STEP * (linked.length + 1) + 240);
    });
    resetBtnC.addEventListener("click", () => {
      linked = []; links = []; fails = []; parts = []; texts = []; locked = false; struck = false; busy = false; finalHits = null;
      enemies.forEach(e => { e.state = "idle"; e.flash = e.pulse = -1e9; });
      chkEl.textContent = "—"; chkEl.className = ""; stEl.textContent = "READY"; chHint.textContent = "최초 대상을 고르세요"; setBanner(""); paint();
    });

    /* ---------- drawing ---------- */
    /* each link is a quadratic curve; repeated pairs bend to alternate sides so they never overlap */
    function cvOf(l) {
      const A = P(l.a), B = P(l.b), dx = B.x - A.x, dy = B.y - A.y, b = l.bend || 0;
      return { A, B, C: { x: (A.x + B.x) / 2 - dy * b, y: (A.y + B.y) / 2 + dx * b } };
    }
    const qp = (c, t) => ({ x: (1 - t) * (1 - t) * c.A.x + 2 * (1 - t) * t * c.C.x + t * t * c.B.x, y: (1 - t) * (1 - t) * c.A.y + 2 * (1 - t) * t * c.C.y + t * t * c.B.y });
    function glowCurve(c, upto, alpha, width) {
      const n = 28, pts = [];
      for (let k = 0; k <= n; k++) pts.push(qp(c, upto * k / n));
      [[7, .18, GOLD], [3, .45, GOLD], [1, 1, "255,248,226"]].forEach(([wm, am, col]) => {
        g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = `rgba(${col},${(alpha * am).toFixed(3)})`; g.lineWidth = width * wm;
        g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
      });
    }
    function shardsCurve(l, col, n) {
      const c = cvOf(l);
      if (reduce) n = Math.min(n, 5);
      for (let k = 0; k < n; k++) {
        const t = Math.random(), q = qp(c, t), q2 = qp(c, Math.min(1, t + .01));
        const tx = q2.x - q.x, ty = q2.y - q.y, len = Math.hypot(tx, ty) || 1, side = Math.random() < .5 ? -1 : 1, sp = 60 + Math.random() * 160;
        parts.push({ x: q.x, y: q.y, vx: -ty / len * sp * side + (Math.random() - .5) * 60, vy: tx / len * sp * side - 40 - Math.random() * 80,
          life: 0, max: .9 + Math.random() * .7, r: 2 + Math.random() * 4, col, g: 420, shard: true, rot: Math.random() * TAU, vr: (Math.random() - .5) * 18 });
      }
    }
    function glowLine(a, b, alpha, width) {
      g.lineCap = "round";
      g.strokeStyle = `rgba(${GOLD},${(alpha * .18).toFixed(3)})`; g.lineWidth = width * 7; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = `rgba(${GOLD},${(alpha * .45).toFixed(3)})`; g.lineWidth = width * 3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = `rgba(255,248,226,${alpha.toFixed(3)})`; g.lineWidth = width; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    function star(x, y, r, col, a) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(.25, `rgba(${col},${a * .5})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    let last = performance.now(), visible = false;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(chainStage);
    function draw(now) {
      requestAnimationFrame(draw);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!visible || !W) return;
      g.setTransform(CDPR, 0, 0, CDPR, 0, 0);
      g.clearRect(0, 0, W, H);
      /* dust */
      for (const d of dust) { g.fillStyle = `rgba(233,233,235,${(d.a * (.6 + .4 * Math.sin(now * .001 + d.k))).toFixed(3)})`; g.fillRect(d.x * W, d.y * H, d.r, d.r); }
      g.globalCompositeOperation = "lighter";
      /* links */
      for (const l of links) {
        const c = cvOf(l);
        if (l.state === "grow") {
          const k = Math.min(1, (now - l.t0) / l.dur), e = easeOut(k), tip = qp(c, e);
          glowCurve(c, e, 1, 1.6);
          star(tip.x, tip.y, 26, GOLD, .9);
          if (!reduce && Math.random() < .9) burst(tip.x, tip.y, 2, { speed: 90, life: .45, size: 1.4, g: 60 });
          if (k >= 1) l.state = "on";
        } else if (l.state === "on") {
          const sh = .75 + .25 * Math.sin(now * .006 + l.a);
          glowCurve(c, 1, sh, 1.4);
          /* light traveling along the thread */
          const q = qp(c, ((now - l.t0) / 1400) % 1);
          star(q.x, q.y, 10, GOLD, .7);
          if (struck) glowCurve(c, 1, 1, 2.2);   /* charged: brighter while waiting to break */
        } else if (l.state === "break") {
          const k = (now - l.bt) / 260;
          if (k < 1) { glowCurve(c, 1, 1 - k, 2.6 * (1 - k) + .4); const m = qp(c, .5); star(m.x, m.y, 60 * (1 - k), WHITE, .5 * (1 - k)); }
        }
      }
      /* pulse racing along the chain during the strike */
      if (struck && busy && links.length && !reduce) {
        const STEP = 230, el = (now - strikeT0) / STEP - 1, seg = Math.floor(el);
        if (seg >= 0 && seg < links.length) {
          const q = qp(cvOf(links[seg]), el - seg);
          star(q.x, q.y, 34, WHITE, 1); burst(q.x, q.y, 3, { col: WHITE, speed: 120, life: .3, size: 1.2, g: 0 });
        }
      }
      /* failed attempts: grow to 55%, flicker, snap */
      fails = fails.filter(f => now - f.t0 < 900);
      for (const f of fails) {
        const A = P(f.a), B = P(f.b), t = now - f.t0;
        if (t < 300) { const e = easeOut(t / 300) * .55; glowLine(A, { x: lerp(A.x, B.x, e), y: lerp(A.y, B.y, e) }, .9, 1.4); }
        else if (t < 520) { if (Math.floor(t / 45) % 2 === 0) glowLine(A, { x: lerp(A.x, B.x, .55), y: lerp(A.y, B.y, .55) }, .5, 1); }
      }
      /* enemies */
      enemies.forEach((e, i) => {
        const p = P(i), on = e.state !== "idle";
        const tw = .8 + .2 * Math.sin(now * .003 + i * 1.7);
        star(p.x, p.y, on ? 34 : 20, on ? GOLD : WHITE, on ? .85 * tw : .55 * tw);
        star(p.x, p.y, 6, on ? "255,244,214" : WHITE, 1);
        const pk = (now - e.pulse) / 700;
        if (pk >= 0 && pk < 1) { g.strokeStyle = `rgba(${GOLD},${(1 - pk).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 10 + pk * 46, 0, TAU); g.stroke(); }
        const fk = (now - e.flash) / 500;
        if (fk >= 0 && fk < 1) { star(p.x, p.y, 70 * (1 - fk * .4), WHITE, .9 * (1 - fk)); g.strokeStyle = `rgba(${WHITE},${(1 - fk).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 14 + fk * 70, 0, TAU); g.stroke(); }
      });
      /* particles */
      parts = parts.filter(q => (q.life += dt) < q.max);
      for (const q of parts) {
        q.vy += q.g * dt; q.vx *= .985; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        const a = Math.max(0, 1 - q.life / q.max);
        if (q.shard) {
          g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = `rgba(${q.col},${a.toFixed(3)})`;
          g.beginPath(); g.moveTo(-q.r, 0); g.lineTo(0, -q.r * .35); g.lineTo(q.r * .8, 0); g.lineTo(0, q.r * .35); g.closePath(); g.fill(); g.restore();
        } else { g.fillStyle = `rgba(${q.col},${a.toFixed(3)})`; g.beginPath(); g.arc(q.x, q.y, q.r * (.4 + a * .6), 0, TAU); g.fill(); }
      }
      g.globalCompositeOperation = "source-over";
      /* labels */
      enemies.forEach((e, i) => {
        const p = P(i); g.font = `10px "IBM Plex Mono", monospace`; g.textAlign = "center";
        g.fillStyle = e.state !== "idle" ? `rgba(${GOLD},.95)` : "rgba(133,133,140,.9)"; g.fillText("E" + (i + 1), p.x, p.y + 30);
      });
      /* after the shatter: how many times each enemy takes the final damage */
      if (finalHits) for (const i in finalHits) {
        const p = P(+i); g.textAlign = "center";
        g.font = `600 13px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif`;
        g.fillStyle = `rgba(${GOLD},.95)`; g.fillText("동일 피해 ×" + finalHits[i], p.x, p.y - 30);
      }
      texts = texts.filter(t => now - t.t0 < 1300);
      for (const t of texts) {
        const k = (now - t.t0) / 1300, a = k < .15 ? k / .15 : 1 - (k - .15) / .85;
        g.font = `${t.big ? 600 : 500} ${t.big ? 16 : 12}px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif`; g.textAlign = "center";
        g.fillStyle = `rgba(${t.col},${Math.max(0, a).toFixed(3)})`; g.fillText(t.text, t.x, t.y - k * 26);
      }
    }
    requestAnimationFrame(draw);
    paint();
  }

  /* =========================================================
     SOUND — background music (assets/bgm.mp3) + synthesized effects, off by default.
     If the music file is missing, the old soft synth pad plays instead.
     ========================================================= */
  const btn = $("#soundBtn"), label = $("#soundLabel"), bgm = $("#bgm");
  const VOL = 0.25;             // 배경 음악 기본 볼륨 (0 ~ 1)
  let ac = null, master = null, on = false, padBuilt = false, missing = !bgm, fadeRaf = 0;
  const saveSound = v => { try { sessionStorage.setItem("astro-sound", v ? "1" : "0"); } catch (e) {} };
  function initAudio() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  }
  function buildPad() {
    if (padBuilt) return; padBuilt = true;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(master);
    [110, 164.81, 220.6, 329.6].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = [.05, .035, .025, .012][i];
      const lfo = ac.createOscillator(); lfo.frequency.value = .05 + i * .03;
      const lg = ac.createGain(); lg.gain.value = g.gain.value * .6; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(lp); o.start();
    });
  }
  function chime(i) {
    if (!on || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = [659.3, 784, 880, 987.8, 1174.7][i % 5];
    g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.05, ac.currentTime + .02);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + 2.2);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 2.3);
  }
  function sputnikBeep(alt) {
    if (!on || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = alt ? 1046.5 : 784;
    g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.025, ac.currentTime + .01);
    g.gain.setValueAtTime(.025, ac.currentTime + .14); g.gain.linearRampToValueAtTime(0, ac.currentTime + .16);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .2);
  }
  function thud() {          // failed check: low drop
    if (!on || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(180, ac.currentTime); o.frequency.exponentialRampToValueAtTime(48, ac.currentTime + .35);
    g.gain.setValueAtTime(.18, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .4);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .42);
  }
  function crack() {         // chain link shattering: short bright noise
    if (!on || !ac) return;
    const len = ac.sampleRate * .09, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = "highpass"; f.frequency.value = 2400; g.gain.value = .22;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
  }
  function whoosh() {
    if (!on || !ac) return;
    const len = ac.sampleRate * .22, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = "bandpass"; f.Q.value = 6; f.frequency.setValueAtTime(300, ac.currentTime); f.frequency.exponentialRampToValueAtTime(4200, ac.currentTime + .18);
    g.gain.value = .25; s.buffer = buf; s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
  }
  function fadeTo(target, ms, done) {
    cancelAnimationFrame(fadeRaf);
    const from = bgm.volume, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      bgm.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
    };
    fadeRaf = requestAnimationFrame(step);
  }
  function paintSound() {
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "SOUND ON" : "SOUND OFF";
  }
  function padTo(v) {                       // fallback pad only when there is no music file
    if (!ac) return;
    if (v > 0) buildPad();
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.linearRampToValueAtTime(v, ac.currentTime + 1.2);
  }
  function setSound(want) {
    on = want; saveSound(want); paintSound();
    if (want) {
      initAudio(); if (ac.state === "suspended") ac.resume();
      if (missing) padTo(1);
      else {
        bgm.volume = 0;
        const p = bgm.play();
        if (p && p.catch) p.catch(err => {
          if (err && err.name === "NotSupportedError") { missing = true; if (on) padTo(1); return; }   // 파일 없음 → 합성 패드
          on = false; saveSound(false); paintSound();                                              // 브라우저가 자동재생을 막음
        });
        fadeTo(VOL, 1500);
      }
      chime(2);
    } else {
      padTo(0);
      if (!missing) fadeTo(0, 500, () => { if (!on) bgm.pause(); });
    }
  }
  if (bgm) {
    const markMissing = () => { missing = true; if (on) padTo(1); };
    bgm.addEventListener("error", markMissing);
    if (bgm.error) markMissing();
  }
  btn.addEventListener("click", () => setSound(!on));
  document.addEventListener("visibilitychange", () => {
    if (!on || missing) return;
    if (document.hidden) bgm.pause(); else bgm.play().catch(() => {});
  });
  paintSound();

  runGate(runLaunch);
  onScroll();
  /* ---------- 선관 링크: 주소를 넣기 전(href="#")에는 눌러도 움직이지 않게 ---------- */
  document.querySelectorAll('.link__a, .rel__link').forEach(a => a.addEventListener("click", e => {
    if (a.getAttribute("href") === "#") e.preventDefault();
  }));
})();
