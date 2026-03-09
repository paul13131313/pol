import { useState, useEffect, useRef } from "react";

// ── Constants ──
const PX = 3;
const GW = 240, GH = 150;
const CW = GW * PX, CH = GH * PX;
const MAX_POP = 200;
const MAX_FOOD = 120;

// ── Map generation ──
const riverCenter = [];
for (let x = 0; x < GW; x++) {
  riverCenter[x] = Math.floor(GH * 0.35 + Math.sin(x * 0.028) * 14 + Math.sin(x * 0.075) * 6);
}

const MAP_GRASS = 0, MAP_GRASS2 = 1, MAP_WATER = 2, MAP_SHORE = 3, MAP_SAND = 4;
const baseMap = [];
for (let y = 0; y < GH; y++) {
  baseMap[y] = [];
  for (let x = 0; x < GW; x++) {
    const distR = Math.abs(y - riverCenter[x]);
    if (distR < 3) baseMap[y][x] = MAP_WATER;
    else if (distR < 4) baseMap[y][x] = MAP_SHORE;
    else if (distR < 6) baseMap[y][x] = MAP_SAND;
    else baseMap[y][x] = ((x * 7 + y * 13) % 11 < 2) ? MAP_GRASS2 : MAP_GRASS;
  }
}

const TILE_COLORS = {
  [MAP_GRASS]:  ["#1a4a12","#1c4e14","#1a4612"],
  [MAP_GRASS2]: ["#163e0e","#184210","#163c0e"],
  [MAP_WATER]:  ["#0a2a5a","#0c2e60","#0a2856"],
  [MAP_SHORE]:  ["#1a3a1a","#1c3c1c","#1a381a"],
  [MAP_SAND]:   ["#2a4a1a","#2c4e1c","#2a4818"],
};

function isWater(x, y) {
  if (x < 0 || x >= GW || y < 0 || y >= GH) return false;
  return baseMap[y][x] === MAP_WATER;
}

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

function getSpriteKey(gen) {
  if (gen < 25)  return "cell";
  if (gen < 70)  return "amphibian";
  if (gen < 140) return "bird";
  if (gen < 220) return "mammal";
  return "human";
}

// Sprites (top-down view)
const SPRITE = {
  cell:      [[0,0]],
  amphibian: [[0,0],[1,0],[0,1],[1,1],[2,0]],
  bird:      [[1,0],[0,1],[1,1],[2,1],[1,2],[-1,1],[3,1]],
  mammal:    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[2,2]],
  human:     [[1,0],[0,1],[1,1],[2,1],[1,2],[1,3],[0,3],[2,3]],
};

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

// ── Structures placed on map ──
const TREES = [
  {x:15,y:20},{x:45,y:15},{x:80,y:25},{x:120,y:18},{x:155,y:22},{x:190,y:28},{x:225,y:16},
  {x:30,y:80},{x:70,y:90},{x:110,y:75},{x:150,y:85},{x:200,y:95},{x:55,y:120},{x:130,y:130},
  {x:20,y:110},{x:95,y:135},{x:175,y:125},{x:210,y:105},{x:60,y:30},{x:170,y:40},
  {x:35,y:95},{x:100,y:100},{x:140,y:115},{x:215,y:80},{x:10,y:65},{x:230,y:70},
].filter(t => !isWater(t.x, t.y));

const EXTRA_TREES = [
  {x:50,y:70},{x:85,y:110},{x:160,y:70},{x:195,y:50},{x:25,y:45},{x:115,y:40},
  {x:180,y:135},{x:65,y:140},{x:125,y:95},{x:205,y:115},
].filter(t => !isWater(t.x, t.y));

// Road path (horizontal, avoiding river)
const ROAD_Y = Math.floor(GH * 0.72);

// Structures
const HUTS = [{x:60,y:ROAD_Y-4},{x:90,y:ROAD_Y+4},{x:155,y:ROAD_Y-3},{x:185,y:ROAD_Y+5}];
const HOUSES = [{x:40,y:ROAD_Y-8},{x:110,y:ROAD_Y+6},{x:170,y:ROAD_Y-6},{x:210,y:ROAD_Y+3}];
const BUILDINGS = [{x:75,y:ROAD_Y-10},{x:130,y:ROAD_Y-5},{x:195,y:ROAD_Y-8}];
const TOWERS = [{x:100,y:ROAD_Y-12},{x:160,y:ROAD_Y-10}];

// ── Organism ──
class Org {
  constructor(x, y, dna, gen) {
    this.x = x; this.y = y;
    this.gen = gen ?? 0;
    const d = dna || {};
    this.dna = {
      spd:   d.spd   ?? 0.3 + Math.random() * 0.6,
      sense: d.sense ?? 12  + Math.random() * 20,
      size:  d.size  ?? 1,
      repro: d.repro ?? 52  + Math.random() * 28,
      life:  d.life  ?? 280 + Math.random() * 380,
      eff:   d.eff   ?? 0.65+ Math.random() * 0.7,
    };
    this.vx = (Math.random() - 0.5) * this.dna.spd;
    this.vy = (Math.random() - 0.5) * this.dna.spd;
    this.energy = 28 + Math.random() * 22;
    this.age = 0;
    this.reproduced = false;
    this.alive = true;
  }

  breed(mut) {
    const d = this.dna;
    const m = (v, lo, hi, sc) => Math.max(lo, Math.min(hi, v + (Math.random()-0.5)*mut*sc));
    return {
      spd:   m(d.spd,   0.1, 2.5, 0.8),
      sense: m(d.sense,  5,   60,  15),
      size:  m(d.size,   1,   3,   0.5),
      repro: m(d.repro,  32,  95,  20),
      life:  m(d.life,   80,  1200,200),
      eff:   m(d.eff,    0.15,2.8, 0.5),
    };
  }
}

const mkFood = () => {
  let fx, fy;
  for (let i = 0; i < 20; i++) {
    fx = Math.floor(Math.random() * GW);
    fy = Math.floor(Math.random() * GH);
    if (!isWater(fx, fy)) break;
  }
  return { x: fx, y: fy, alive: true };
};

function spawnOrg(maxGen) {
  let ox, oy;
  for (let i = 0; i < 20; i++) {
    ox = Math.floor(Math.random() * GW);
    oy = Math.floor(Math.random() * GH);
    if (!isWater(ox, oy)) break;
  }
  return new Org(ox, oy, null, Math.max(0, maxGen - 8));
}

// ── Drawing ──
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function drawSprite(ctx, ox, oy, key, color) {
  const pts = SPRITE[key];
  for (const [dx, dy] of pts) {
    const fx = Math.floor(ox) + dx, fy = Math.floor(oy) + dy;
    if (fx >= 0 && fx < GW && fy >= 0 && fy < GH) px(ctx, fx, fy, color);
  }
}

function drawTreeTopDown(ctx, tx, ty) {
  // Trunk (center)
  px(ctx, tx, ty, "#4a2a0a");
  px(ctx, tx+1, ty, "#4a2a0a");
  // Canopy (circle)
  for (let dy = -2; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx*dx + dy*dy <= 5) {
        const c = (dx + dy) % 2 === 0 ? "#1a6a1a" : "#2a7a2a";
        px(ctx, tx + dx, ty + dy - 1, c);
      }
    }
  }
}

function drawHutTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 4; dy++)
    for (let dx = 0; dx < 4; dx++)
      px(ctx, bx+dx, by+dy, "#8a6a3a");
  // Roof pattern
  px(ctx, bx+1, by, "#6a2a1a"); px(ctx, bx+2, by, "#6a2a1a");
  px(ctx, bx, by+1, "#6a2a1a"); px(ctx, bx+3, by+1, "#6a2a1a");
  // Door
  px(ctx, bx+1, by+3, "#3a1a0a"); px(ctx, bx+2, by+3, "#3a1a0a");
}

function drawHouseTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 6; dx++)
      px(ctx, bx+dx, by+dy, "#6a6a7a");
  // Roof highlight
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by, "#8a4a3a");
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by+1, "#7a3a2a");
  // Windows
  px(ctx, bx+1, by+2, "#aaaa33"); px(ctx, bx+4, by+2, "#aaaa33");
  px(ctx, bx+1, by+3, "#aaaa33"); px(ctx, bx+4, by+3, "#aaaa33");
  // Door
  px(ctx, bx+2, by+4, "#3a2a1a"); px(ctx, bx+3, by+4, "#3a2a1a");
}

function drawBuildingTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < 8; dx++)
      px(ctx, bx+dx, by+dy, "#5a5a6a");
  // Roof edge
  for (let dx = 0; dx < 8; dx++) { px(ctx, bx+dx, by, "#4a4a5a"); px(ctx, bx+dx, by+6, "#4a4a5a"); }
  for (let dy = 0; dy < 7; dy++) { px(ctx, bx, by+dy, "#4a4a5a"); px(ctx, bx+7, by+dy, "#4a4a5a"); }
  // Windows
  for (let wy = 1; wy < 6; wy += 2) {
    for (let wx = 1; wx < 7; wx += 2) {
      px(ctx, bx+wx, by+wy, "#aaaa33");
    }
  }
}

function drawTowerTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 8; dy++)
    for (let dx = 0; dx < 6; dx++)
      px(ctx, bx+dx, by+dy, "#4a4a5a");
  // Shadow/depth effect
  for (let dy = 0; dy < 8; dy++) px(ctx, bx+5, by+dy, "#3a3a4a");
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by+7, "#3a3a4a");
  // Windows lit
  for (let wy = 1; wy < 7; wy += 2)
    for (let wx = 1; wx < 5; wx += 2)
      px(ctx, bx+wx, by+wy, Math.random() > 0.3 ? "#ffee66" : "#2a2a3a");
  // Antenna
  px(ctx, bx+3, by-1, "#ff3333");
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
    const orgs = [];
    for (let i = 0; i < 20; i++) orgs.push(spawnOrg(0));
    simRef.current = { orgs, food: Array.from({ length: 40 }, mkFood), tick: 0, maxGen: 0, extinct: 0 };
  }

  function step() {
    const s = simRef.current;
    const c = ctrlRef.current;
    s.tick++;

    const fTarget = Math.floor(MAX_FOOD * c.food);
    if (s.food.length < fTarget && s.tick % 3 === 0) s.food.push(mkFood());

    const babies = [];
    for (const o of s.orgs) {
      if (!o.alive) continue;
      o.age++;

      const drain = 0.06 * o.dna.eff * c.harsh * (1 + o.dna.spd * 0.08);
      o.energy -= drain;

      let best = null, bd2 = o.dna.sense * o.dna.sense;
      for (const f of s.food) {
        if (!f.alive) continue;
        const dx = f.x - o.x, dy = f.y - o.y, d2 = dx*dx + dy*dy;
        if (d2 < bd2) { bd2 = d2; best = f; }
      }

      if (best) {
        const dx = best.x - o.x, dy = best.y - o.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        o.vx = (dx / d) * o.dna.spd;
        o.vy = (dy / d) * o.dna.spd;
        if (d < 3) { o.energy = Math.min(100, o.energy + 18); best.alive = false; }
      } else {
        if (Math.random() < 0.04) {
          o.vx = (Math.random() - 0.5) * o.dna.spd * 2;
          o.vy = (Math.random() - 0.5) * o.dna.spd * 2;
        }
      }

      let nx = o.x + o.vx, ny = o.y + o.vy;
      // Bounce off edges
      if (nx < 0) { nx = 0; o.vx *= -1; }
      if (nx >= GW) { nx = GW - 1; o.vx *= -1; }
      if (ny < 0) { ny = 0; o.vy *= -1; }
      if (ny >= GH) { ny = GH - 1; o.vy *= -1; }
      // Avoid water (except cells/amphibians)
      const sprKey = getSpriteKey(o.gen);
      if (sprKey !== "cell" && sprKey !== "amphibian" && isWater(Math.floor(nx), Math.floor(ny))) {
        o.vx *= -1; o.vy *= -1;
      } else {
        o.x = nx; o.y = ny;
      }

      if (o.energy > o.dna.repro && !o.reproduced && s.orgs.length + babies.length < MAX_POP) {
        o.energy *= 0.52;
        o.reproduced = true;
        let cx = Math.floor(o.x + (Math.random() - 0.5) * 8);
        let cy = Math.floor(o.y + (Math.random() - 0.5) * 8);
        cx = Math.max(0, Math.min(GW - 1, cx));
        cy = Math.max(0, Math.min(GH - 1, cy));
        const child = new Org(cx, cy, o.breed(c.mut), o.gen + 1);
        babies.push(child);
        if (child.gen > s.maxGen) s.maxGen = child.gen;
      }

      if (o.energy <= 0 || o.age > o.dna.life) o.alive = false;
    }

    s.orgs = [...s.orgs.filter(o => o.alive), ...babies];
    s.food = s.food.filter(f => f.alive);

    if (s.orgs.length === 0) {
      s.extinct++;
      s.orgs = Array.from({ length: 14 }, () => spawnOrg(s.maxGen));
    }
  }

  function draw(ctx) {
    const s = simRef.current;
    const frame = frameRef.current;

    // Base map tiles
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const tile = baseMap[y][x];
        const cols = TILE_COLORS[tile];
        const ci = (x * 3 + y * 7 + (tile === MAP_WATER ? Math.floor(frame / 30) : 0)) % cols.length;
        px(ctx, x, y, cols[ci]);
      }
    }

    // Road (gen 70+)
    if (s.maxGen >= 70) {
      const roadColor = s.maxGen >= 220 ? "#5a5a5a" : "#5a4a2a";
      for (let x = 0; x < GW; x++) {
        if (!isWater(x, ROAD_Y) && !isWater(x, ROAD_Y + 1)) {
          px(ctx, x, ROAD_Y, roadColor);
          px(ctx, x, ROAD_Y + 1, roadColor);
          if (s.maxGen >= 220) px(ctx, x, ROAD_Y + 2, roadColor);
        }
      }
      // Road dashes (stone road)
      if (s.maxGen >= 220) {
        for (let x = 0; x < GW; x += 6) {
          px(ctx, x, ROAD_Y + 1, "#7a7a7a");
          px(ctx, x + 1, ROAD_Y + 1, "#7a7a7a");
        }
      }
    }

    // Trees
    if (s.maxGen >= 25) {
      for (const t of TREES) drawTreeTopDown(ctx, t.x, t.y);
    }
    if (s.maxGen >= 70) {
      for (const t of EXTRA_TREES) drawTreeTopDown(ctx, t.x, t.y);
    }

    // Structures
    if (s.maxGen >= 140) {
      for (const h of HUTS) drawHutTopDown(ctx, h.x, h.y);
    }
    if (s.maxGen >= 220) {
      for (const h of HOUSES) drawHouseTopDown(ctx, h.x, h.y);
    }
    if (s.maxGen >= 320) {
      for (const b of BUILDINGS) drawBuildingTopDown(ctx, b.x, b.y);
    }
    if (s.maxGen >= 400) {
      for (const t of TOWERS) drawTowerTopDown(ctx, t.x, t.y);
    }

    // Food
    for (const f of s.food) {
      if (!f.alive) continue;
      px(ctx, f.x, f.y, "#44dd55");
    }

    // Creatures (sorted by y for depth)
    const sorted = s.orgs.filter(o => o.alive).sort((a, b) => a.y - b.y);
    for (const o of sorted) {
      const stage = getStage(o.gen);
      const sprKey = getSpriteKey(o.gen);
      // Shadow for birds
      if (sprKey === "bird") {
        px(ctx, Math.floor(o.x), Math.floor(o.y) + 3, "rgba(0,0,0,0.2)");
      }
      drawSprite(ctx, o.x, sprKey === "bird" ? o.y - 2 : o.y, sprKey, stage.color);
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
    setThinking(true); setReply("");
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
    ["食料豊富さ","food",0.2,3.0,0.1,"枯渇 ←→ 豊富"],
    ["突然変異率","mut",0.02,0.45,0.01,"安定 ←→ 混沌"],
    ["環境の厳しさ","harsh",0.3,2.5,0.1,"温和 ←→ 過酷"],
    ["時間速度","spd",1,20,1,"遅 ←→ 速"],
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
        input[type=range]{-webkit-appearance:none;width:100%;height:2px;background:rgba(255,255,255,0.1);outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:8px;height:8px;border-radius:0;background:rgba(80,200,255,0.9);}
        .ginput{background:rgba(100,50,200,0.1);border:2px solid rgba(100,50,200,0.4);color:#ddc8ff;outline:none;padding:6px 10px;font-family:'Press Start 2P',monospace;font-size:8px;flex:1;border-radius:0;}
        .gbtn{background:rgba(100,50,200,0.2);border:2px solid rgba(100,50,200,0.6);color:rgba(180,80,255,1);padding:6px 14px;cursor:pointer;font-size:8px;letter-spacing:1px;border-radius:0;white-space:nowrap;font-family:'Press Start 2P',monospace;}
        .gbtn:hover:not(:disabled){background:rgba(100,50,200,0.4);}
        .gbtn:disabled{opacity:0.4;cursor:default;}
        canvas{image-rendering:pixelated;image-rendering:crisp-edges;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 14, width: CW + 12 + 155 }}>
        <span className="pol-title" style={{ fontSize: 24, color: "rgba(80,200,255,0.9)", letterSpacing: "0.2em" }}>pol</span>
        <div>
          <div className="pol-title" style={{ fontSize: 8, color: "rgba(255,215,65,0.9)", letterSpacing: "0.08em" }}>{disp.era[1]}</div>
          <div className="pol-mono" style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>{disp.era[2]}</div>
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
          <div style={panelStyle}>
            <span style={labelStyle}>CENSUS</span>
            {[["個体数",disp.pop],["最大世代",`Gen ${disp.maxGen}`],["経過年",`${disp.year} yr`],["絶滅",`${disp.extinct}回`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:7,color:"rgba(255,255,255,0.3)"}}>{k}</span>
                <span className="pol-mono" style={{fontSize:9,color:"rgba(255,255,255,0.8)"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={panelStyle}>
            <span style={labelStyle}>LEVERS</span>
            {LEVERS.map(([label,key,min,max,step,hint])=>(
              <div key={key} style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:7,color:"rgba(255,255,255,0.35)"}}>{label}</span>
                  <span className="pol-mono" style={{fontSize:8,color:"rgba(80,200,255,0.9)"}}>{ctrl[key]}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={ctrl[key]} onChange={e=>setP(key,parseFloat(e.target.value))}/>
                <div style={{fontSize:6,color:"rgba(255,255,255,0.12)",marginTop:1}}>{hint}</div>
              </div>
            ))}
          </div>
          <div style={panelStyle}>
            <span style={labelStyle}>EVOLUTION</span>
            <div style={{fontSize:7,lineHeight:2}}>
              {ERAS.map(([thr,ja])=>{
                const done = thr <= disp.maxGen;
                return (<div key={thr} style={{color:done?"rgba(255,215,65,0.8)":"rgba(255,255,255,0.15)",display:"flex",gap:4}}>
                  <span>{done?"■":"□"}</span><span>{ja}</span>
                </div>);
              })}
            </div>
          </div>
          <div style={panelStyle}>
            <span style={labelStyle}>CREATURES</span>
            {STAGES.map(s=>(
              <div key={s.name} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                <div style={{width:7,height:7,background:s.color,flexShrink:0}}/>
                <span style={{fontSize:7,color:"rgba(255,255,255,0.35)"}}>{s.name}</span>
                <span className="pol-mono" style={{fontSize:7,color:"rgba(255,255,255,0.2)",marginLeft:"auto"}}>Gen {s.gen}+</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* God Panel */}
      {awakened && (
        <div style={{marginTop:10,width:CW+12+155,background:"rgba(100,30,200,0.08)",border:"2px solid rgba(100,30,200,0.25)",padding:"10px 14px"}}>
          <div className="pol-title" style={{fontSize:7,letterSpacing:"0.2em",color:"rgba(160,60,255,0.7)",marginBottom:8}}>
            ✦ 神への交信 — DIVINE COMMUNICATION
          </div>
          {reply && (
            <div style={{background:"rgba(100,30,200,0.08)",border:"1px solid rgba(100,30,200,0.15)",padding:"10px 12px",marginBottom:10,fontSize:12,color:"rgba(220,190,255,0.9)",lineHeight:2,fontFamily:"'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"}}>
              {reply}
            </div>
          )}
          <div style={{display:"flex",gap:6}}>
            <input className="ginput" type="text" placeholder="言葉を送れ..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&pray()}/>
            <button className="gbtn" onClick={pray} disabled={thinking}>{thinking?"交信中":"送信"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
