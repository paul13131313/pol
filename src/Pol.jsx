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

// World themes that evolve with civilization
const WORLD_THEMES = [
  { gen: 0,   // 原始の大地
    grass:  ["#1a4a12","#1c4e14","#1a4612"],
    grass2: ["#163e0e","#184210","#163c0e"],
    water:  ["#0a2a5a","#0c2e60","#0a2856"],
    shore:  ["#1a3a1a","#1c3c1c","#1a381a"],
    sand:   ["#2a4a1a","#2c4e1c","#2a4818"],
    bg: "#0b0b1a" },
  { gen: 140, // 開拓の時代
    grass:  ["#2a5518","#2c581a","#2a5216"],
    grass2: ["#1e4410","#204812","#1e4210"],
    water:  ["#0c3068","#0e346e","#0c2e64"],
    shore:  ["#2a4520","#2c4822","#2a4320"],
    sand:   ["#3a5520","#3c5822","#3a5320"],
    bg: "#0a0a18" },
  { gen: 320, // 文明の大地
    grass:  ["#2a4a22","#2c4e24","#2a4822"],
    grass2: ["#223e18","#244220","#223c18"],
    water:  ["#0a3070","#0c3478","#0a2e6c"],
    shore:  ["#2a3a2a","#2c3c2c","#2a382a"],
    sand:   ["#3a4a2a","#3c4e2c","#3a4828"],
    bg: "#08081a" },
  { gen: 550, // 産業革命 — 煤けた色調
    grass:  ["#2a3a22","#2c3e24","#2a3822"],
    grass2: ["#223018","#24341a","#222e18"],
    water:  ["#0a2848","#0c2c4e","#0a2644"],
    shore:  ["#2a3228","#2c342a","#2a3028"],
    sand:   ["#3a3a28","#3c3e2a","#3a3828"],
    bg: "#0a0a14" },
  { gen: 750, // 情報時代 — サイバーな色調
    grass:  ["#18302a","#1a3430","#18302a"],
    grass2: ["#142828","#16302c","#142828"],
    water:  ["#0a2050","#0c2456","#0a1e4c"],
    shore:  ["#1a2a2a","#1c2e2c","#1a282a"],
    sand:   ["#2a3030","#2c3434","#2a2e30"],
    bg: "#060610" },
  { gen: 1000, // 星間文明 — 宇宙的な輝き
    grass:  ["#1a2040","#1c2444","#1a1e3e"],
    grass2: ["#141838","#16203c","#141838"],
    water:  ["#0a1860","#0c1c68","#0a165c"],
    shore:  ["#1a1a3a","#1c1e3e","#1a1a38"],
    sand:   ["#2a2040","#2c2444","#2a1e3e"],
    bg: "#04040c" },
];

function getWorldTheme(gen) {
  let from = WORLD_THEMES[0], to = WORLD_THEMES[0];
  for (let i = 0; i < WORLD_THEMES.length; i++) {
    if (gen >= WORLD_THEMES[i].gen) {
      from = WORLD_THEMES[i];
      to = WORLD_THEMES[i + 1] || from;
    }
  }
  if (from === to) return from;
  const t = Math.min(1, (gen - from.gen) / (to.gen - from.gen));
  // Lerp colors
  const lerp = (a, b, t) => {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      const ca = parseInt(a[i].slice(1), 16), cb = parseInt(b[i].slice(1), 16);
      const r = Math.round(((ca >> 16) & 255) * (1-t) + ((cb >> 16) & 255) * t);
      const g = Math.round(((ca >> 8) & 255) * (1-t) + ((cb >> 8) & 255) * t);
      const bl = Math.round((ca & 255) * (1-t) + (cb & 255) * t);
      result.push(`#${((r<<16)|(g<<8)|bl).toString(16).padStart(6,'0')}`);
    }
    return result;
  };
  return {
    gen: from.gen,
    grass: lerp(from.grass, to.grass, t),
    grass2: lerp(from.grass2, to.grass2, t),
    water: lerp(from.water, to.water, t),
    shore: lerp(from.shore, to.shore, t),
    sand: lerp(from.sand, to.sand, t),
    bg: lerp([from.bg], [to.bg], t)[0],
  };
}

const TILE_KEY_MAP = {
  [MAP_GRASS]: "grass",
  [MAP_GRASS2]: "grass2",
  [MAP_WATER]: "water",
  [MAP_SHORE]: "shore",
  [MAP_SAND]: "sand",
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
  [550, "産業革命",       "Industrial Revolution"],
  [750, "情報時代",       "Information Age"],
  [1000,"✦ 星間文明",    "Interstellar Civilization ✦"],
];

function getEra(gen) {
  let e = ERAS[0];
  for (const era of ERAS) { if (gen >= era[0]) e = era; }
  return e;
}

// ── Seeded random for deterministic structure placement ──
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// Generate structures based on civilization level
function genStructures(maxGen, type, seed, count) {
  const r = seededRand(seed);
  const result = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * (GW - 10) + 5);
    const y = Math.floor(r() * (GH - 10) + 5);
    if (!isWater(x, y)) result.push({ x, y });
  }
  return result;
}

// Road path (horizontal, avoiding river)
const ROAD_Y = Math.floor(GH * 0.72);
const ROAD2_Y = Math.floor(GH * 0.28);

// Base trees (always there from gen 25)
const BASE_TREES = genStructures(0, "tree", 42, 26);

// ── Organism ──
class Org {
  constructor(x, y, dna, gen) {
    this.x = x; this.y = y;
    this.gen = gen ?? 0;
    const d = dna || {};
    this.dna = {
      spd:   d.spd   ?? 0.15 + Math.random() * 0.25,
      sense: d.sense ?? 12  + Math.random() * 20,
      size:  d.size  ?? 1,
      repro: d.repro ?? 55  + Math.random() * 25,
      life:  d.life  ?? 350 + Math.random() * 450,
      eff:   d.eff   ?? 0.55+ Math.random() * 0.6,
    };
    this.vx = (Math.random() - 0.5) * this.dna.spd;
    this.vy = (Math.random() - 0.5) * this.dna.spd;
    this.energy = 40 + Math.random() * 30;
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
  return new Org(ox, oy, null, Math.max(0, maxGen - 3));
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
  px(ctx, tx, ty, "#4a2a0a");
  px(ctx, tx+1, ty, "#4a2a0a");
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
  px(ctx, bx+1, by, "#6a2a1a"); px(ctx, bx+2, by, "#6a2a1a");
  px(ctx, bx, by+1, "#6a2a1a"); px(ctx, bx+3, by+1, "#6a2a1a");
  px(ctx, bx+1, by+3, "#3a1a0a"); px(ctx, bx+2, by+3, "#3a1a0a");
}

function drawHouseTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 5; dy++)
    for (let dx = 0; dx < 6; dx++)
      px(ctx, bx+dx, by+dy, "#6a6a7a");
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by, "#8a4a3a");
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by+1, "#7a3a2a");
  px(ctx, bx+1, by+2, "#aaaa33"); px(ctx, bx+4, by+2, "#aaaa33");
  px(ctx, bx+1, by+3, "#aaaa33"); px(ctx, bx+4, by+3, "#aaaa33");
  px(ctx, bx+2, by+4, "#3a2a1a"); px(ctx, bx+3, by+4, "#3a2a1a");
}

function drawBuildingTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < 8; dx++)
      px(ctx, bx+dx, by+dy, "#5a5a6a");
  for (let dx = 0; dx < 8; dx++) { px(ctx, bx+dx, by, "#4a4a5a"); px(ctx, bx+dx, by+6, "#4a4a5a"); }
  for (let dy = 0; dy < 7; dy++) { px(ctx, bx, by+dy, "#4a4a5a"); px(ctx, bx+7, by+dy, "#4a4a5a"); }
  for (let wy = 1; wy < 6; wy += 2)
    for (let wx = 1; wx < 7; wx += 2)
      px(ctx, bx+wx, by+wy, "#aaaa33");
}

function drawTowerTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 8; dy++)
    for (let dx = 0; dx < 6; dx++)
      px(ctx, bx+dx, by+dy, "#4a4a5a");
  for (let dy = 0; dy < 8; dy++) px(ctx, bx+5, by+dy, "#3a3a4a");
  for (let dx = 0; dx < 6; dx++) px(ctx, bx+dx, by+7, "#3a3a4a");
  for (let wy = 1; wy < 7; wy += 2)
    for (let wx = 1; wx < 5; wx += 2)
      px(ctx, bx+wx, by+wy, Math.random() > 0.3 ? "#ffee66" : "#2a2a3a");
  px(ctx, bx+3, by-1, "#ff3333");
}

function drawSkyscraperTopDown(ctx, bx, by) {
  for (let dy = 0; dy < 10; dy++)
    for (let dx = 0; dx < 7; dx++)
      px(ctx, bx+dx, by+dy, "#3a3a4a");
  for (let dy = 0; dy < 10; dy++) { px(ctx, bx+6, by+dy, "#2a2a3a"); }
  for (let dx = 0; dx < 7; dx++) { px(ctx, bx+dx, by+9, "#2a2a3a"); }
  // Glass windows
  for (let wy = 1; wy < 9; wy++)
    for (let wx = 1; wx < 6; wx += 2)
      px(ctx, bx+wx, by+wy, Math.random() > 0.2 ? "#66ccff" : "#1a1a2a");
  // Roof antenna
  px(ctx, bx+3, by-1, "#ffffff");
  px(ctx, bx+3, by-2, "#ff3333");
}

function drawFarmPatch(ctx, fx, fy) {
  for (let dy = 0; dy < 4; dy++)
    for (let dx = 0; dx < 5; dx++) {
      const c = (dx + dy) % 2 === 0 ? "#3a6a1a" : "#2a5a10";
      px(ctx, fx+dx, fy+dy, c);
    }
  // Rows
  for (let dx = 0; dx < 5; dx++) px(ctx, fx+dx, fy+1, "#4a3a1a");
  for (let dx = 0; dx < 5; dx++) px(ctx, fx+dx, fy+3, "#4a3a1a");
}

function drawSatelliteDish(ctx, sx, sy) {
  px(ctx, sx, sy, "#aaaaaa");
  px(ctx, sx+1, sy, "#aaaaaa");
  px(ctx, sx, sy-1, "#888888");
  px(ctx, sx+1, sy-1, "#888888");
  px(ctx, sx+2, sy-2, "#cccccc");
}

// ── Main Component ──
export default function Pol() {
  const canvasRef = useRef(null);
  const simRef    = useRef(null);
  const rafRef    = useRef(null);
  const frameRef  = useRef(0);
  const ctrlRef   = useRef({ food: 1.2, mut: 0.12, harsh: 0.85, spd: 4 });
  const awakRef   = useRef(false);

  const [disp, setDisp]         = useState({ pop: 6, maxGen: 0, year: 0, era: ERAS[0], extinct: 0, civLv: 0, bg: "#0b0b1a" });
  const [ctrl, setCtrl]         = useState({ food: 1.2, mut: 0.12, harsh: 0.85, spd: 4 });
  const [awakened, setAwakened] = useState(false);
  const [msg, setMsg]           = useState("");
  const [reply, setReply]       = useState("");
  const [thinking, setThinking] = useState(false);

  function initSim() {
    const orgs = [];
    for (let i = 0; i < 6; i++) orgs.push(spawnOrg(0));
    simRef.current = { orgs, food: Array.from({ length: 40 }, mkFood), tick: 0, maxGen: 0, extinct: 0, civLv: 0 };
  }

  function step() {
    const s = simRef.current;
    const c = ctrlRef.current;
    s.tick++;

    // Civilization level accumulates based on population and generation
    if (s.tick % 60 === 0 && s.orgs.length > 5) {
      s.civLv += Math.floor(s.orgs.length * 0.1) + Math.floor(s.maxGen * 0.05);
    }

    const fTarget = Math.floor(MAX_FOOD * c.food);
    if (s.food.length < fTarget && s.tick % 3 === 0) s.food.push(mkFood());

    const babies = [];
    for (const o of s.orgs) {
      if (!o.alive) continue;
      o.age++;

      const drain = 0.05 * o.dna.eff * c.harsh * (1 + o.dna.spd * 0.06);
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
        if (d < 3) { o.energy = Math.min(100, o.energy + 22); best.alive = false; }
      } else {
        if (Math.random() < 0.02) {
          o.vx = (Math.random() - 0.5) * o.dna.spd;
          o.vy = (Math.random() - 0.5) * o.dna.spd;
        }
      }

      let nx = o.x + o.vx, ny = o.y + o.vy;
      if (nx < 0) { nx = 0; o.vx *= -1; }
      if (nx >= GW) { nx = GW - 1; o.vx *= -1; }
      if (ny < 0) { ny = 0; o.vy *= -1; }
      if (ny >= GH) { ny = GH - 1; o.vy *= -1; }
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

    // Auto-replenish: when population drops low, spawn reinforcements
    if (s.orgs.length < 4 && s.tick % 8 === 0) {
      s.orgs.push(spawnOrg(s.maxGen));
    }
    // Full extinction: rapid recovery
    if (s.orgs.length === 0) {
      s.extinct++;
      for (let i = 0; i < 8; i++) s.orgs.push(spawnOrg(s.maxGen));
    }
  }

  function draw(ctx) {
    const s = simRef.current;
    const frame = frameRef.current;
    const mg = s.maxGen;
    const theme = getWorldTheme(mg);

    // Base map tiles with evolving theme
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const tile = baseMap[y][x];
        const cols = theme[TILE_KEY_MAP[tile]];
        const ci = (x * 3 + y * 7 + (tile === MAP_WATER ? Math.floor(frame / 30) : 0)) % cols.length;
        px(ctx, x, y, cols[ci]);
      }
    }

    // Roads
    if (mg >= 70) {
      const roadColor = mg >= 550 ? "#6a6a6a" : mg >= 220 ? "#5a5a5a" : "#5a4a2a";
      const drawRoad = (ry, width) => {
        for (let x = 0; x < GW; x++) {
          let ok = true;
          for (let w = 0; w < width; w++) { if (isWater(x, ry + w)) { ok = false; break; } }
          if (ok) for (let w = 0; w < width; w++) px(ctx, x, ry + w, roadColor);
        }
      };
      drawRoad(ROAD_Y, mg >= 220 ? 3 : 2);
      if (mg >= 320) drawRoad(ROAD2_Y, 2);
      // Road dashes
      if (mg >= 220) {
        for (let x = 0; x < GW; x += 6) {
          px(ctx, x, ROAD_Y + 1, "#7a7a7a");
          px(ctx, x + 1, ROAD_Y + 1, "#7a7a7a");
        }
      }
      // Vertical connecting roads (gen 550+)
      if (mg >= 550) {
        for (const vx of [60, 120, 180]) {
          for (let y = ROAD2_Y; y <= ROAD_Y; y++) {
            if (!isWater(vx, y)) px(ctx, vx, y, "#4a4a4a");
          }
        }
      }
    }

    // Farm patches (gen 140+)
    if (mg >= 140) {
      const farmCount = Math.min(12, Math.floor((mg - 140) / 30) + 2);
      const farms = genStructures(mg, "farm", 777, farmCount);
      for (const f of farms) drawFarmPatch(ctx, f.x, f.y);
    }

    // Trees
    if (mg >= 25) {
      for (const t of BASE_TREES) drawTreeTopDown(ctx, t.x, t.y);
    }
    if (mg >= 70) {
      const extraTrees = genStructures(mg, "tree2", 123, 10);
      for (const t of extraTrees) drawTreeTopDown(ctx, t.x, t.y);
    }

    // Huts (gen 140+, count grows)
    if (mg >= 140) {
      const hutCount = Math.min(10, Math.floor((mg - 140) / 20) + 2);
      const huts = genStructures(mg, "hut", 200, hutCount);
      for (const h of huts) drawHutTopDown(ctx, h.x, h.y);
    }

    // Houses (gen 220+)
    if (mg >= 220) {
      const houseCount = Math.min(12, Math.floor((mg - 220) / 25) + 2);
      const houses = genStructures(mg, "house", 300, houseCount);
      for (const h of houses) drawHouseTopDown(ctx, h.x, h.y);
    }

    // Buildings (gen 320+)
    if (mg >= 320) {
      const buildCount = Math.min(8, Math.floor((mg - 320) / 30) + 1);
      const buildings = genStructures(mg, "bldg", 400, buildCount);
      for (const b of buildings) drawBuildingTopDown(ctx, b.x, b.y);
    }

    // Towers (gen 400+)
    if (mg >= 400) {
      const towerCount = Math.min(6, Math.floor((mg - 400) / 40) + 1);
      const towers = genStructures(mg, "tower", 500, towerCount);
      for (const t of towers) drawTowerTopDown(ctx, t.x, t.y);
    }

    // Skyscrapers (gen 550+)
    if (mg >= 550) {
      const skyCount = Math.min(8, Math.floor((mg - 550) / 50) + 1);
      const skyscrapers = genStructures(mg, "sky", 600, skyCount);
      for (const s of skyscrapers) drawSkyscraperTopDown(ctx, s.x, s.y);
    }

    // Satellite dishes (gen 750+)
    if (mg >= 750) {
      const dishCount = Math.min(5, Math.floor((mg - 750) / 60) + 1);
      const dishes = genStructures(mg, "dish", 700, dishCount);
      for (const d of dishes) drawSatelliteDish(ctx, d.x, d.y);
    }

    // Starport glow (gen 1000+)
    if (mg >= 1000) {
      const cx = 120, cy = 75;
      const pulse = Math.sin(frame * 0.05) * 0.3 + 0.7;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (dx*dx + dy*dy <= 9)
            px(ctx, cx+dx, cy+dy, `rgba(100,200,255,${pulse * 0.3})`);
      px(ctx, cx, cy, `rgba(200,240,255,${pulse})`);
      px(ctx, cx-1, cy, `rgba(150,220,255,${pulse*0.6})`);
      px(ctx, cx+1, cy, `rgba(150,220,255,${pulse*0.6})`);
      px(ctx, cx, cy-1, `rgba(150,220,255,${pulse*0.6})`);
      px(ctx, cx, cy+1, `rgba(150,220,255,${pulse*0.6})`);
    }

    // Creatures (sorted by y for depth)
    const sorted = s.orgs.filter(o => o.alive).sort((a, b) => a.y - b.y);
    for (const o of sorted) {
      const stage = getStage(o.gen);
      const sprKey = getSpriteKey(o.gen);
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
        const themeBg = getWorldTheme(s.maxGen).bg;
        setDisp({ pop: s.orgs.length, maxGen: s.maxGen, year: Math.floor(s.tick / 180), era, extinct: s.extinct, civLv: s.civLv, bg: themeBg });
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
      background: disp.bg, minHeight: "100vh", transition: "background 3s ease",
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
            {[["個体数",disp.pop],["最大世代",`Gen ${disp.maxGen}`],["経過年",`${disp.year} yr`],["文明力",disp.civLv],["絶滅",`${disp.extinct}回`]].map(([k,v])=>(
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
