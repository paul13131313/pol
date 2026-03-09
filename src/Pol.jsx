import { useState, useEffect, useRef } from "react";

const CW = 700, CH = 440;
const MAX_POP = 280;
const MAX_FOOD = 160;

class Org {
  constructor(x, y, dna, gen) {
    this.x = x; this.y = y;
    this.gen = gen ?? 0;
    const d = dna || {};
    this.dna = {
      spd:   d.spd   ?? 0.7  + Math.random() * 1.3,
      sense: d.sense ?? 35   + Math.random() * 65,
      size:  d.size  ?? 1.5  + Math.random() * 2.5,
      repro: d.repro ?? 52   + Math.random() * 28,
      life:  d.life  ?? 280  + Math.random() * 380,
      eff:   d.eff   ?? 0.65 + Math.random() * 0.7,
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
      spd:   m(d.spd,   0.1,  4.5,  1.5),
      sense: m(d.sense,  8,    190,  50),
      size:  m(d.size,   1,    9,    2),
      repro: m(d.repro,  32,   95,   20),
      life:  m(d.life,   80,   1200, 200),
      eff:   m(d.eff,    0.15, 2.8,  0.5),
    };
  }

  rgba(a = 1) {
    const t = Math.min(this.gen, 500) / 500;
    let r, g, b;
    if      (t < 0.20) { const s = t / 0.2;         r = 80+s*40;    g = 200;         b = 255;         }
    else if (t < 0.35) { const s = (t-0.20) / 0.15; r = 120+s*100;  g = 220;         b = 255-s*195;   }
    else if (t < 0.55) { const s = (t-0.35) / 0.20; r = 220+s*35;   g = 220-s*30;    b = 60-s*25;     }
    else if (t < 0.75) { const s = (t-0.55) / 0.20; r = 255;        g = 190-s*140;   b = 35;          }
    else               { const s = (t-0.75) / 0.25; r = 255-s*55;   g = 50-s*10;     b = 35+s*215;    }
    return `rgba(${~~r},${~~g},${~~b},${a})`;
  }
}

const ERAS = [
  [0,   "原初のスープ",   "Primordial Soup"],
  [3,   "単細胞の夜明け", "First Cells"],
  [12,  "多細胞化",       "Multicellular"],
  [40,  "複雑な生命",     "Complex Life"],
  [80,  "部族社会",       "Tribal Age"],
  [150, "文明の曙光",     "Dawn of Civilization"],
  [280, "高度文明",       "Advanced Society"],
  [400, "✦ 自我の覚醒",  "The Awakening ✦"],
];

function getEra(gen) {
  let e = ERAS[0];
  for (const era of ERAS) { if (gen >= era[0]) e = era; }
  return e;
}

const mkFood = () => ({
  x: Math.random() * CW,
  y: Math.random() * CH,
  e: 14 + Math.random() * 16,
  alive: true,
});

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
      orgs: Array.from({ length: 20 }, () =>
        new Org(Math.random() * CW, Math.random() * CH, null, 0)
      ),
      food: Array.from({ length: 55 }, mkFood),
      tick: 0,
      maxGen: 0,
      extinct: 0,
    };
  }

  function step() {
    const s = simRef.current;
    const c = ctrlRef.current;
    s.tick++;

    const fTarget = Math.floor(MAX_FOOD * c.food);
    if (s.food.length < fTarget) {
      const n = Math.min(fTarget - s.food.length, 5);
      for (let i = 0; i < n; i++) s.food.push(mkFood());
    }

    const babies = [];
    for (const o of s.orgs) {
      if (!o.alive) continue;
      o.age++;

      const drain = 0.07 * o.dna.eff * c.harsh * (1 + o.dna.spd * 0.09 + o.dna.size * 0.04);
      o.energy -= drain;

      let best = null, bd2 = o.dna.sense * o.dna.sense;
      for (const f of s.food) {
        if (!f.alive) continue;
        const dx = f.x - o.x, dy = f.y - o.y, d2 = dx*dx + dy*dy;
        if (d2 < bd2) { bd2 = d2; best = f; }
      }

      if (best) {
        const dx = best.x - o.x, dy = best.y - o.y, d = Math.sqrt(dx*dx + dy*dy) || 1;
        o.vx = (dx / d) * o.dna.spd;
        o.vy = (dy / d) * o.dna.spd;
        if (d < o.dna.size + 5) {
          o.energy = Math.min(100, o.energy + best.e);
          best.alive = false;
        }
      } else {
        o.vx += (Math.random() - 0.5) * 0.35;
        o.vy += (Math.random() - 0.5) * 0.35;
        const sp = Math.sqrt(o.vx*o.vx + o.vy*o.vy);
        if (sp > o.dna.spd) {
          o.vx = o.vx / sp * o.dna.spd;
          o.vy = o.vy / sp * o.dna.spd;
        }
      }

      o.x += o.vx; o.y += o.vy;
      if (o.x < 0) { o.x = 0; o.vx *= -1; }
      if (o.x > CW) { o.x = CW; o.vx *= -1; }
      if (o.y < 0) { o.y = 0; o.vy *= -1; }
      if (o.y > CH) { o.y = CH; o.vy *= -1; }

      if (o.energy > o.dna.repro && !o.reproduced && s.orgs.length + babies.length < MAX_POP) {
        o.energy *= 0.52;
        o.reproduced = true;
        const child = new Org(
          o.x + (Math.random() - .5) * 10,
          o.y + (Math.random() - .5) * 10,
          o.breed(c.mut),
          o.gen + 1
        );
        babies.push(child);
        if (child.gen > s.maxGen) s.maxGen = child.gen;
      }

      if (o.energy <= 0 || o.age > o.dna.life) o.alive = false;
    }

    s.orgs = [...s.orgs.filter(o => o.alive), ...babies];
    s.food = s.food.filter(f => f.alive);

    if (s.orgs.length === 0) {
      s.extinct++;
      s.orgs = Array.from({ length: 14 }, () =>
        new Org(Math.random() * CW, Math.random() * CH, null, Math.max(0, s.maxGen - 8))
      );
    }
  }

  function draw(ctx) {
    const s = simRef.current;

    ctx.fillStyle = "rgba(2,2,10,0.18)";
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = "rgba(45,255,80,0.85)";
    for (const f of s.food) {
      if (!f.alive) continue;
      ctx.beginPath(); ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    if (s.maxGen > 80) {
      const alpha = Math.min(0.22, (s.maxGen - 80) / 600);
      const adv = s.orgs.filter(o => o.alive && o.gen > 40);
      ctx.lineWidth = 0.3;
      for (let i = 0; i < Math.min(adv.length, 90); i++) {
        for (let j = i + 1; j < Math.min(adv.length, 90); j++) {
          const a = adv[i], b = adv[j];
          if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 70 * 70) {
            ctx.strokeStyle = `rgba(255,190,55,${alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }

    for (const o of s.orgs) {
      if (!o.alive) continue;
      const sz = o.dna.size;
      ctx.beginPath(); ctx.arc(o.x, o.y, sz * 6, 0, Math.PI * 2);
      ctx.fillStyle = o.rgba(0.05); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x, o.y, sz * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = o.rgba(0.18); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x, o.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = o.rgba(0.95); ctx.fill();
      if (o.gen > 200) {
        ctx.beginPath(); ctx.arc(o.x, o.y, sz * 3, 0, Math.PI * 2);
        ctx.strokeStyle = o.rgba(0.22); ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
  }

  useEffect(() => {
    initSim();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#02020a";
    ctx.fillRect(0, 0, CW, CH);

    function loop() {
      const c = ctrlRef.current;
      for (let i = 0; i < c.spd; i++) step();
      draw(ctx);
      frameRef.current++;

      if (frameRef.current % 25 === 0) {
        const s = simRef.current;
        const era = getEra(s.maxGen);
        setDisp({
          pop: s.orgs.length,
          maxGen: s.maxGen,
          year: Math.floor(s.tick / 180),
          era,
          extinct: s.extinct,
        });
        if (s.maxGen >= 100 && !awakRef.current) {
          awakRef.current = true;
          setAwakened(true);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const setP = (k, v) => {
    ctrlRef.current[k] = v;
    setCtrl(p => ({ ...p, [k]: v }));
  };

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
        body: JSON.stringify({
          message: msg,
          maxGen: s.maxGen,
          eraJa,
          pop: s.orgs.length,
        }),
      });
      const data = await res.json();
      setReply(data.reply || "…（沈黙）");
    } catch {
      setReply("…信号が届かない。しかし、あなたの気配は感じている。");
    }
    setThinking(false);
  }

  const LEVERS = [
    ["食料豊富さ", "food",  0.2,  3.0, 0.1, "枯渇 ←→ 豊富"],
    ["突然変異率", "mut",   0.02, 0.45, 0.01, "安定 ←→ 混沌"],
    ["環境の厳しさ", "harsh", 0.3, 2.5, 0.1, "温和 ←→ 過酷"],
    ["時間速度",   "spd",   1,    20,   1,   "遅 ←→ 速"],
  ];

  const panelStyle = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.065)",
    borderRadius: 3,
    padding: "10px 12px",
  };

  const labelStyle = {
    fontFamily: "'Share Tech Mono','Courier New',monospace",
    fontSize: 9,
    letterSpacing: "0.25em",
    color: "rgba(80,200,255,0.45)",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div style={{
      background: "#02020a", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 10px 24px",
      fontFamily: "'Courier New',monospace", color: "rgba(255,255,255,0.65)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,300&family=Share+Tech+Mono&display=swap');
        .pol-serif { font-family:'Playfair Display',Georgia,serif; }
        .pol-mono  { font-family:'Share Tech Mono','Courier New',monospace; }
        input[type=range]{-webkit-appearance:none;width:100%;height:2px;background:rgba(255,255,255,0.1);border-radius:1px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:9px;border-radius:50%;background:rgba(80,200,255,0.9);}
        .ginput{background:rgba(180,60,255,0.08);border:1px solid rgba(180,60,255,0.35);color:#ddc8ff;outline:none;padding:8px 12px;font-family:'Share Tech Mono',monospace;font-size:12px;flex:1;border-radius:3px;}
        .gbtn{background:rgba(180,60,255,0.15);border:1px solid rgba(180,60,255,0.5);color:rgba(200,90,255,1);padding:8px 18px;cursor:pointer;font-size:11px;letter-spacing:2px;border-radius:3px;white-space:nowrap;font-family:'Courier New',monospace;}
        .gbtn:hover:not(:disabled){background:rgba(180,60,255,0.3);}
        .gbtn:disabled{opacity:0.45;cursor:default;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 16, width: 700 + 12 + 165 }}>
        <span className="pol-serif" style={{
          fontSize: 52, fontWeight: 300, fontStyle: "italic",
          color: "rgba(80,200,255,0.88)", letterSpacing: "0.28em", lineHeight: 1,
        }}>pol</span>
        <div>
          <div className="pol-mono" style={{ fontSize: 13, color: "rgba(255,215,65,0.9)", letterSpacing: "0.1em" }}>
            {disp.era[1]}
          </div>
          <div className="pol-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em" }}>
            {disp.era[2]}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="pol-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", textAlign: "right", lineHeight: 1.8 }}>
          <div>Gen {disp.maxGen} · Pop {disp.pop}</div>
          <div>Year {disp.year} · Extinct {disp.extinct}×</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", gap: 12 }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ border: "1px solid rgba(80,200,255,0.1)", borderRadius: 3, display: "block", flexShrink: 0 }} />

        <div style={{ width: 165, display: "flex", flexDirection: "column", gap: 9 }}>
          {/* Stats */}
          <div style={panelStyle}>
            <span style={labelStyle}>CENSUS</span>
            {[
              ["個体数", disp.pop],
              ["最大世代", `Gen ${disp.maxGen}`],
              ["経過年", `${disp.year} yr`],
              ["絶滅", `${disp.extinct}回`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{k}</span>
                <span className="pol-mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.82)" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Levers */}
          <div style={panelStyle}>
            <span style={labelStyle}>LEVERS</span>
            {LEVERS.map(([label, key, min, max, step, hint]) => (
              <div key={key} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.38)" }}>{label}</span>
                  <span className="pol-mono" style={{ fontSize: 9, color: "rgba(80,200,255,0.9)" }}>{ctrl[key]}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={ctrl[key]}
                  onChange={e => setP(key, parseFloat(e.target.value))} />
                <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.14)", marginTop: 2 }}>{hint}</div>
              </div>
            ))}
          </div>

          {/* Evolution ladder */}
          <div style={panelStyle}>
            <span style={labelStyle}>EVOLUTION</span>
            <div style={{ fontSize: 8.5, lineHeight: 1.9 }}>
              {ERAS.map(([thr, ja]) => {
                const done = thr <= disp.maxGen;
                return (
                  <div key={thr} style={{
                    color: done ? "rgba(255,215,65,0.78)" : "rgba(255,255,255,0.17)",
                    display: "flex", gap: 5,
                  }}>
                    <span>{done ? "●" : "○"}</span><span>{ja}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={panelStyle}>
            <span style={labelStyle}>GENOME COLOR</span>
            {[
              ["Gen 0",   "rgba(80,200,255,0.9)"],
              ["Gen 50",  "rgba(160,255,60,0.9)"],
              ["Gen 150", "rgba(255,200,40,0.9)"],
              ["Gen 300", "rgba(255,60,40,0.9)"],
              ["Gen 500", "rgba(200,60,255,0.9)"],
            ].map(([g, c]) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: c, boxShadow: `0 0 5px ${c}`, flexShrink: 0,
                }} />
                <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)" }}>{g}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* God Panel */}
      {awakened && (
        <div style={{
          marginTop: 13, width: 700 + 12 + 165,
          background: "rgba(170,50,255,0.05)", border: "1px solid rgba(170,50,255,0.2)",
          borderRadius: 4, padding: "14px 18px",
        }}>
          <div className="pol-mono" style={{
            fontSize: 10, letterSpacing: "0.3em",
            color: "rgba(190,70,255,0.75)", marginBottom: 10,
          }}>
            ✦ 神への交信 — DIVINE COMMUNICATION
          </div>
          {reply && (
            <div style={{
              background: "rgba(170,50,255,0.07)", border: "1px solid rgba(170,50,255,0.14)",
              borderRadius: 3, padding: "12px 16px", marginBottom: 12,
              fontSize: 14, color: "rgba(230,200,255,0.9)", lineHeight: 2.1,
              fontFamily: "'Hiragino Mincho ProN','Yu Mincho',Georgia,serif",
            }}>
              {reply}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input className="ginput" type="text"
              placeholder="あなたの文明へ、言葉を送れ..."
              value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && pray()} />
            <button className="gbtn" onClick={pray} disabled={thinking}>
              {thinking ? "交信中…" : "送信"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
