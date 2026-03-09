import { useState, useEffect, useRef } from "react";

// ── Constants ──
const PX = 3;
const GW = 240, GH = 150;
const CW = GW * PX, CH = GH * PX;
const GROUND_Y = 112;
const MAX_POP = 200;
const MAX_FOOD = 120;

// ── Terrain heightmap ──
const terrain = [];
for (let x = 0; x < GW; x++) {
  terrain[x] = Math.floor(
    GROUND_Y + Math.sin(x * 0.025) * 6 + Math.sin(x * 0.06) * 3 + Math.sin(x * 0.13) * 1.5
  );
}

// ── Color palette (8-bit style) ──
const PAL = {
  sky:    ["#0b0b1a","#0f0f2d","#141440","#1a1a55","#24246a"],
  star:   "#444466",
  ground: ["#2a5e1a","#1e4a12","#163a0e"],
  earth:  ["#3d2815","#2e1f10","#1f150b"],
  water:  "#1a3a6a",
  cloud:  "#1a1a3a",
  tree_trunk: "#5a3a1a",
  tree_leaf:  "#1a6a1a",
  tree_leaf2: "#2a8a2a",
  hut:    "#8a6a3a",
  hut_roof: "#6a2a1a",
  stone:  "#6a6a7a",
  brick:  "#8a4a3a",
  window: "#aaaa33",
  road:   "#3a3a3a",
  light:  "#ffee66",
};

// ── Creature stages ──
const STAGES = [
  { gen: 0,   name: "単細胞",  color: "#44bbff" },
  { gen: 25,  name: "両生類",  color: "#33dd55" },
  { gen: 70,  name: "鳥類",    color: "#dddd33" },
  { gen: 140, name: "哺乳類",  color: "#ff8833" },
  { gen: 220, name: "人類",    color: "#ff4455" },
];

function getStage(gen) {
  let s = STAGES[0];
  for (const st of STAGES) { if (gen >= st.gen) s = st; }
  return s;
}

// ── Pixel sprites (relative to creature pos) ──
const SPRITE = {
  // [dx, dy] pairs
  cell:      [[0,0],[1,0]],
  amphibian: [[0,0],[1,0],[2,0],[0,-1],[2,-1],[0,1],[2,1]],
  bird:      [[0,0],[1,0],[2,0],[1,-1],[1,-2],[-1,-1],[3,-1]],
  mammal:    [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,1],[3,1]],
  human:     [[1,0],[1,-1],[0,-1],[2,-1],[1,-2],[1,-3],[0,-3],[2,-3],[0,-4],[1,-4],[2,-4]],
};

function getSpriteKey(gen) {
  if (gen < 25)  return "cell";
  if (gen < 70)  return "amphibian";
  if (gen < 140) return "bird";
  if (gen < 220) return "mammal";
  return "human";
}

// ── Eras ──
const ERAS = [
  [0,   "海の時代",       "Age of the Sea"],
  [25,  "両生類の時代",   "Age of Amphibians"],
  [70,  "鳥類の時代",     "Age of Birds"],
  [140, "哺乳類の時代",   "Age of Mammals"],
  [220, "人類の時代",     "Age of Humans"],
  [320, "文明の曙光",     "Dawn of Civilization"],
  [400, "✦ 自我の覚醒",  "The Awakening ✦"],
];

function getEra(gen) {
  let e = ERAS[0];
  for (const era of ERAS) { if (gen >= era[0]) e = era; }
  return e;
}

// ── Structures (appear at gen thresholds) ──
const STRUCTURES = [
  { gen: 25,  type: "tree",  x: 22 },
  { gen: 25,  type: "tree",  x: 58 },
  { gen: 25,  type: "tree",  x: 95 },
  { gen: 25,  type: "tree",  x: 138 },
  { gen: 25,  type: "tree",  x: 178 },
  { gen: 25,  type: "tree",  x: 215 },
  { gen: 70,  type: "tree",  x: 40 },
  { gen: 70,  type: "tree",  x: 115 },
  { gen: 70,  type: "tree",  x: 195 },
  { gen: 140, type: "hut",   x: 50 },
  { gen: 140, type: "hut",   x: 160 },
  { gen: 220, type: "house", x: 80 },
  { gen: 220, type: "house", x: 190 },
  { gen: 220, type: "house", x: 30 },
  { gen: 320, type: "building", x: 60 },
  { gen: 320, type: "building", x: 130 },
  { gen: 320, type: "building", x: 200 },
  { gen: 400, type: "tower", x: 100 },
  { gen: 400, type: "tower", x: 170 },
  { gen: 400, type: "tower", x: 40 },
];

// ── Organism ──
class Org {
  constructor(x, y, dna, gen) {
    this.x = x; this.y = y;
    this.gen = gen ?? 0;
    const d = dna || {};
    this.dna = {
      spd:   d.spd   ?? 0.4  + Math.random() * 0.8,
      sense: d.sense ?? 15   + Math.random() * 25,
      size:  d.size  ?? 1,
      repro: d.repro ?? 52   + Math.random() * 28,
      life:  d.life  ?? 280  + Math.random() * 380,
      eff:   d.eff   ?? 0.65 + Math.random() * 0.7,
    };
    this.vx = (Math.random() - 0.5) * this.dna.spd;
    this.energy = 28 + Math.random() * 22;
    this.age = 0;
    this.reproduced = false;
    this.alive = true;
  }

  breed(mut) {
    const d = this.dna;
    const m = (v, lo, hi, sc) => Math.max(lo, Math.min(hi, v + (Math.random()-0.5)*mut*sc));
    return {
      spd:   m(d.spd,   0.1, 3.0,  1.0),
      sense: m(d.sense,  5,   80,   20),
      size:  m(d.size,   1,   3,    0.5),
      repro: m(d.repro,  32,  95,   20),
      life:  m(d.life,   80,  1200, 200),
      eff:   m(d.eff,    0.15,2.8,  0.5),
    };
  }
}

// ── Food ──
const mkFood = () => {
  const fx = Math.floor(Math.random() * GW);
  return { x: fx, y: terrain[fx] - 1, alive: true };
};

// ── Drawing helpers ──
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function drawSprite(ctx, ox, oy, key, color) {
  const pts = SPRITE[key];
  for (const [dx, dy] of pts) {
    px(ctx, Math.floor(ox) + dx, Math.floor(oy) + dy, color);
  }
}

function drawTree(ctx, bx, maxGen) {
  const by = terrain[Math.min(bx, GW - 1)] - 1;
  const trunkH = 4 + (maxGen > 140 ? 2 : 0);
  for (let i = 0; i < trunkH; i++) px(ctx, bx, by - i, PAL.tree_trunk);
  // Canopy
  const r = maxGen > 140 ? 3 : 2;
  for (let dy = -r; dy <= 0; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy <= r*r + 1) {
        const c = (dx + dy) % 2 === 0 ? PAL.tree_leaf : PAL.tree_leaf2;
        px(ctx, bx + dx, by - trunkH + dy, c);
      }
    }
  }
}

function drawHut(ctx, bx) {
  const by = terrain[Math.min(bx, GW - 1)] - 1;
  // Walls
  for (let dy = 0; dy < 4; dy++)
    for (let dx = 0; dx < 5; dx++)
      px(ctx, bx + dx, by - dy, PAL.hut);
  // Roof
  for (let dx = -1; dx < 7; dx++) px(ctx, bx + dx, by - 4, PAL.hut_roof);
  for (let dx = 0; dx < 5; dx++) px(ctx, bx + dx, by - 5, PAL.hut_roof);
  for (let dx = 1; dx < 4; dx++) px(ctx, bx + dx, by - 6, PAL.hut_roof);
  // Door
  px(ctx, bx + 2, by, "#2a1a0a");
  px(ctx, bx + 2, by - 1, "#2a1a0a");
}

function drawHouse(ctx, bx) {
  const by = terrain[Math.min(bx, GW - 1)] - 1;
  // Walls
  for (let dy = 0; dy < 6; dy++)
    for (let dx = 0; dx < 7; dx++)
      px(ctx, bx + dx, by - dy, PAL.stone);
  // Roof
  for (let dx = -1; dx < 9; dx++) px(ctx, bx + dx, by - 6, PAL.brick);
  for (let dx = 0; dx < 7; dx++) px(ctx, bx + dx, by - 7, PAL.brick);
  for (let dx = 1; dx < 6; dx++) px(ctx, bx + dx, by - 8, PAL.brick);
  // Windows
  px(ctx, bx + 1, by - 3, PAL.window); px(ctx, bx + 1, by - 4, PAL.window);
  px(ctx, bx + 5, by - 3, PAL.window); px(ctx, bx + 5, by - 4, PAL.window);
  // Door
  px(ctx, bx + 3, by, "#2a1a0a");
  px(ctx, bx + 3, by - 1, "#2a1a0a");
  px(ctx, bx + 3, by - 2, "#2a1a0a");
}

function drawBuilding(ctx, bx) {
  const by = terrain[Math.min(bx, GW - 1)] - 1;
  const h = 14;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < 8; dx++)
      px(ctx, bx + dx, by - dy, "#5a5a6a");
  // Windows
  for (let wy = 2; wy < h - 1; wy += 3) {
    for (let wx = 1; wx < 7; wx += 2) {
      px(ctx, bx + wx, by - wy, PAL.window);
      px(ctx, bx + wx, by - wy - 1, PAL.window);
    }
  }
  // Door
  for (let dy = 0; dy < 3; dy++) {
    px(ctx, bx + 3, by - dy, "#3a3a4a");
    px(ctx, bx + 4, by - dy, "#3a3a4a");
  }
}

function drawTower(ctx, bx) {
  const by = terrain[Math.min(bx, GW - 1)] - 1;
  const h = 22;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < 6; dx++)
      px(ctx, bx + dx, by - dy, "#4a4a5a");
  // Windows (lit)
  for (let wy = 2; wy < h - 1; wy += 2) {
    for (let wx = 1; wx < 5; wx += 2) {
      const lit = Math.random() > 0.3;
      px(ctx, bx + wx, by - wy, lit ? PAL.light : "#2a2a3a");
    }
  }
  // Antenna
  px(ctx, bx + 3, by - h, "#8a8a9a");
  px(ctx, bx + 3, by - h - 1, "#ff3333");
}

// ── Main Component ──
export default function Pol() {
  const canvasRef = useRef(null);
  const simRef    = useRef(null);
  const rafRef    = useRef(null);
  const frameRef  = useRef(0);
  const ctrlRef   = useRef({ food: 1.2, mut: 0.12, harsh: 0.85, spd: 8 });
  const awakRef   = useRef(false);

  const [disp, setDisp]         = useState({ pop: 20, maxGen: 0, year: 0, era: ERAS[0], extinct: 0 });
  const [ctrl, setCtrl]         = useState({ food: 1.2, mut: 0.12, harsh: 0.85, spd: 8 });
  const [awakened, setAwakened] = useState(false);
  const [msg, setMsg]           = useState("");
  const [reply, setReply]       = useState("");
  const [thinking, setThinking] = useState(false);

  function initSim() {
    simRef.current = {
      orgs: Array.from({ length: 20 }, () => {
        const ox = Math.floor(Math.random() * GW);
        return new Org(ox, terrain[ox] - 2, null, 0);
      }),
      food: Array.from({ length: 40 }, mkFood),
      tick: 0, maxGen: 0, extinct: 0,
    };
  }

  function step() {
    const s = simRef.current;
    const c = ctrlRef.current;
    s.tick++;

    const fTarget = Math.floor(MAX_FOOD * c.food);
    if (s.food.length < fTarget && s.tick % 3 === 0) {
      s.food.push(mkFood());
    }

    const babies = [];
    for (const o of s.orgs) {
      if (!o.alive) continue;
      o.age++;

      const drain = 0.06 * o.dna.eff * c.harsh * (1 + o.dna.spd * 0.08);
      o.energy -= drain;

      // Find nearest food
      let best = null, bd2 = o.dna.sense * o.dna.sense;
      for (const f of s.food) {
        if (!f.alive) continue;
        const dx = f.x - o.x, dy = f.y - o.y, d2 = dx*dx + dy*dy;
        if (d2 < bd2) { bd2 = d2; best = f; }
      }

      if (best) {
        const dx = best.x - o.x;
        o.vx = Math.sign(dx) * o.dna.spd;
        const d = Math.abs(dx);
        if (d < 3) { o.energy = Math.min(100, o.energy + 18); best.alive = false; }
      } else {
        if (Math.random() < 0.05) o.vx = (Math.random() - 0.5) * o.dna.spd * 2;
      }

      o.x += o.vx;
      if (o.x < 0) { o.x = 0; o.vx *= -1; }
      if (o.x >= GW) { o.x = GW - 1; o.vx *= -1; }

      // Snap to terrain (birds fly a bit above)
      const sprKey = getSpriteKey(o.gen);
      const flyOffset = sprKey === "bird" ? 6 + Math.sin(o.age * 0.1) * 3 : 1;
      o.y = terrain[Math.floor(o.x)] - flyOffset;

      // Reproduce
      if (o.energy > o.dna.repro && !o.reproduced && s.orgs.length + babies.length < MAX_POP) {
        o.energy *= 0.52;
        o.reproduced = true;
        const cx = Math.max(0, Math.min(GW - 1, Math.floor(o.x + (Math.random() - 0.5) * 8)));
        const child = new Org(cx, terrain[cx] - 1, o.breed(c.mut), o.gen + 1);
        babies.push(child);
        if (child.gen > s.maxGen) s.maxGen = child.gen;
      }

      if (o.energy <= 0 || o.age > o.dna.life) o.alive = false;
    }

    s.orgs = [...s.orgs.filter(o => o.alive), ...babies];
    s.food = s.food.filter(f => f.alive);

    if (s.orgs.length === 0) {
      s.extinct++;
      s.orgs = Array.from({ length: 14 }, () => {
        const ox = Math.floor(Math.random() * GW);
        return new Org(ox, terrain[ox] - 2, null, Math.max(0, s.maxGen - 8));
      });
    }
  }

  function draw(ctx) {
    const s = simRef.current;

    // Clear
    ctx.fillStyle = "#0b0b1a";
    ctx.fillRect(0, 0, CW, CH);

    // Sky bands
    const bands = PAL.sky;
    const bandH = Math.floor(GROUND_Y / bands.length);
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i * bandH * PX, CW, bandH * PX);
    }

    // Stars
    if (frameRef.current % 60 < 50) {
      ctx.fillStyle = PAL.star;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 73 + 17) * 37) % GW;
        const sy = ((i * 41 + 7) * 29) % (GROUND_Y - 10);
        if (Math.random() > 0.1) px(ctx, sx, sy, PAL.star);
      }
    }

    // Ground
    for (let x = 0; x < GW; x++) {
      const ty = terrain[x];
      // Surface
      px(ctx, x, ty, PAL.ground[0]);
      // Below surface
      for (let dy = 1; dy < GH - ty; dy++) {
        const ci = dy < 3 ? 1 : 2;
        const col = dy < 6 ? PAL.ground[Math.min(ci, 2)] : PAL.earth[Math.min(dy - 6, 2)];
        px(ctx, x, ty + dy, col);
      }
    }

    // Roads (gen 220+)
    if (s.maxGen >= 220) {
      for (let x = 0; x < GW; x++) {
        px(ctx, x, terrain[x], PAL.road);
      }
    }

    // Structures
    for (const st of STRUCTURES) {
      if (s.maxGen < st.gen) continue;
      switch (st.type) {
        case "tree":     drawTree(ctx, st.x, s.maxGen); break;
        case "hut":      drawHut(ctx, st.x); break;
        case "house":    drawHouse(ctx, st.x); break;
        case "building": drawBuilding(ctx, st.x); break;
        case "tower":    drawTower(ctx, st.x); break;
      }
    }

    // Food (pixel plants)
    for (const f of s.food) {
      if (!f.alive) continue;
      px(ctx, f.x, f.y, "#33cc44");
      if (Math.random() > 0.5) px(ctx, f.x, f.y - 1, "#44dd55");
    }

    // Creatures
    for (const o of s.orgs) {
      if (!o.alive) continue;
      const stage = getStage(o.gen);
      const sprKey = getSpriteKey(o.gen);
      drawSprite(ctx, o.x, o.y, sprKey, stage.color);
    }
  }

  useEffect(() => {
    initSim();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    function loop() {
      const c = ctrlRef.current;
      for (let i = 0; i < c.spd; i++) step();
      draw(ctx);
      frameRef.current++;

      if (frameRef.current % 25 === 0) {
        const s = simRef.current;
        const era = getEra(s.maxGen);
        setDisp({ pop: s.orgs.length, maxGen: s.maxGen, year: Math.floor(s.tick / 180), era, extinct: s.extinct });
        if (s.maxGen >= 220 && !awakRef.current) { awakRef.current = true; setAwakened(true); }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const setP = (k, v) => { ctrlRef.current[k] = v; setCtrl(p => ({ ...p, [k]: v })); };

  async function pray() {
    if (!msg.trim() || thinking) return;
    setThinking(true);
    setReply("");
    const s = simRef.current;
    const [, eraJa] = getEra(s.maxGen);
    try {
      const res = await fetch("/api/pray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, maxGen: s.maxGen, eraJa, pop: s.orgs.length }),
      });
      const data = await res.json();
      setReply(data.reply || "…（沈黙）");
    } catch {
      setReply("…信号が届かない。しかし、あなたの気配は感じている。");
    }
    setThinking(false);
  }

  const LEVERS = [
    ["食料豊富さ", "food",  0.2, 3.0, 0.1, "枯渇 ←→ 豊富"],
    ["突然変異率", "mut",   0.02, 0.45, 0.01, "安定 ←→ 混沌"],
    ["環境の厳しさ", "harsh", 0.3, 2.5, 0.1, "温和 ←→ 過酷"],
    ["時間速度",   "spd",   1, 20, 1, "遅 ←→ 速"],
  ];

  const panelStyle = {
    background: "rgba(10,10,30,0.85)",
    border: "1px solid rgba(80,200,255,0.12)",
    borderRadius: 2, padding: "8px 10px",
  };

  const labelStyle = {
    fontFamily: "'Press Start 2P','Share Tech Mono',monospace",
    fontSize: 7, letterSpacing: "0.15em",
    color: "rgba(80,200,255,0.5)", marginBottom: 6, display: "block",
  };

  return (
    <div style={{
      background: "#0b0b1a", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "12px 10px 24px",
      fontFamily: "'Press Start 2P','Courier New',monospace", color: "rgba(255,255,255,0.65)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap');
        .pol-title { font-family:'Press Start 2P',monospace; }
        .pol-mono  { font-family:'Share Tech Mono','Courier New',monospace; }
        input[type=range]{-webkit-appearance:none;width:100%;height:2px;background:rgba(255,255,255,0.1);border-radius:0;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:8px;height:8px;border-radius:0;background:rgba(80,200,255,0.9);}
        .ginput{background:rgba(100,50,200,0.1);border:2px solid rgba(100,50,200,0.4);color:#ddc8ff;outline:none;padding:6px 10px;font-family:'Press Start 2P',monospace;font-size:8px;flex:1;border-radius:0;}
        .gbtn{background:rgba(100,50,200,0.2);border:2px solid rgba(100,50,200,0.6);color:rgba(180,80,255,1);padding:6px 14px;cursor:pointer;font-size:8px;letter-spacing:1px;border-radius:0;white-space:nowrap;font-family:'Press Start 2P',monospace;}
        .gbtn:hover:not(:disabled){background:rgba(100,50,200,0.4);}
        .gbtn:disabled{opacity:0.4;cursor:default;}
        canvas{image-rendering:pixelated;image-rendering:crisp-edges;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 14, width: CW + 12 + 155 }}>
        <span className="pol-title" style={{
          fontSize: 24, color: "rgba(80,200,255,0.9)", letterSpacing: "0.2em", lineHeight: 1,
        }}>pol</span>
        <div>
          <div className="pol-title" style={{ fontSize: 8, color: "rgba(255,215,65,0.9)", letterSpacing: "0.08em" }}>
            {disp.era[1]}
          </div>
          <div className="pol-mono" style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
            {disp.era[2]}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="pol-mono" style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textAlign: "right", lineHeight: 1.8 }}>
          <div>Gen {disp.maxGen} · Pop {disp.pop}</div>
          <div>Year {disp.year} · Extinct {disp.extinct}×</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", gap: 10 }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ border: "2px solid rgba(80,200,255,0.15)", display: "block", flexShrink: 0, imageRendering: "pixelated" }} />

        <div style={{ width: 155, display: "flex", flexDirection: "column", gap: 7 }}>
          {/* Stats */}
          <div style={panelStyle}>
            <span style={labelStyle}>CENSUS</span>
            {[["個体数", disp.pop], ["最大世代", `Gen ${disp.maxGen}`], ["経過年", `${disp.year} yr`], ["絶滅", `${disp.extinct}回`]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{k}</span>
                <span className="pol-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.8)" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Levers */}
          <div style={panelStyle}>
            <span style={labelStyle}>LEVERS</span>
            {LEVERS.map(([label, key, min, max, step, hint]) => (
              <div key={key} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)" }}>{label}</span>
                  <span className="pol-mono" style={{ fontSize: 8, color: "rgba(80,200,255,0.9)" }}>{ctrl[key]}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={ctrl[key]}
                  onChange={e => setP(key, parseFloat(e.target.value))} />
                <div style={{ fontSize: 6, color: "rgba(255,255,255,0.12)", marginTop: 1 }}>{hint}</div>
              </div>
            ))}
          </div>

          {/* Evolution */}
          <div style={panelStyle}>
            <span style={labelStyle}>EVOLUTION</span>
            <div style={{ fontSize: 7, lineHeight: 2 }}>
              {ERAS.map(([thr, ja]) => {
                const done = thr <= disp.maxGen;
                return (
                  <div key={thr} style={{ color: done ? "rgba(255,215,65,0.8)" : "rgba(255,255,255,0.15)", display: "flex", gap: 4 }}>
                    <span>{done ? "■" : "□"}</span><span>{ja}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Creature Legend */}
          <div style={panelStyle}>
            <span style={labelStyle}>CREATURES</span>
            {STAGES.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <div style={{ width: 7, height: 7, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)" }}>{s.name}</span>
                <span className="pol-mono" style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>Gen {s.gen}+</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* God Panel */}
      {awakened && (
        <div style={{
          marginTop: 10, width: CW + 12 + 155,
          background: "rgba(100,30,200,0.08)", border: "2px solid rgba(100,30,200,0.25)",
          padding: "10px 14px",
        }}>
          <div className="pol-title" style={{ fontSize: 7, letterSpacing: "0.2em", color: "rgba(160,60,255,0.7)", marginBottom: 8 }}>
            ✦ 神への交信 — DIVINE COMMUNICATION
          </div>
          {reply && (
            <div style={{
              background: "rgba(100,30,200,0.08)", border: "1px solid rgba(100,30,200,0.15)",
              padding: "10px 12px", marginBottom: 10,
              fontSize: 12, color: "rgba(220,190,255,0.9)", lineHeight: 2,
              fontFamily: "'Hiragino Mincho ProN','Yu Mincho',Georgia,serif",
            }}>
              {reply}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input className="ginput" type="text" placeholder="言葉を送れ..."
              value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && pray()} />
            <button className="gbtn" onClick={pray} disabled={thinking}>
              {thinking ? "交信中" : "送信"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
