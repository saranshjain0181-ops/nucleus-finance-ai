import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Network, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency } from "@/lib/finance-store";

export const Route = createFileRoute("/risk-graph")({
  head: () => ({
    meta: [
      { title: "Supply Chain & Risk Graph — FinOps Studio" },
      {
        name: "description",
        content:
          "GNN-style force-directed mapping of vendors, banks and customers with contagion simulation and blocked-revenue impact.",
      },
      { property: "og:title", content: "Supply Chain & Risk Graph — FinOps Studio" },
      {
        property: "og:description",
        content: "Map hidden dependencies and simulate systemic failure across your financial ecosystem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskGraphView,
});

type Kind = "startup" | "vendor" | "bank" | "customer";
type GNode = { id: string; label: string; kind: Kind; weight: number; x: number; y: number; vx: number; vy: number };
type GEdge = { source: string; target: string; volume: number; freq: number };

const KIND_COLOR: Record<Kind, string> = {
  startup: "#f472b6",
  vendor: "#38bdf8",
  bank: "#facc15",
  customer: "#34d399",
};

const RAW_NODES: { id: string; label: string; kind: Kind; weight: number }[] = [
  { id: "co", label: "Your Startup", kind: "startup", weight: 34 },
  { id: "aws", label: "AWS", kind: "vendor", weight: 24 },
  { id: "openai", label: "OpenAI", kind: "vendor", weight: 20 },
  { id: "stripe", label: "Stripe", kind: "vendor", weight: 26 },
  { id: "snowflake", label: "Snowflake", kind: "vendor", weight: 16 },
  { id: "svb", label: "SVB", kind: "bank", weight: 22 },
  { id: "hdfc", label: "HDFC Bank", kind: "bank", weight: 18 },
  { id: "c1", label: "Acme Corp", kind: "customer", weight: 20 },
  { id: "c2", label: "Northwind", kind: "customer", weight: 17 },
  { id: "c3", label: "Globex", kind: "customer", weight: 15 },
  { id: "c4", label: "Initech", kind: "customer", weight: 13 },
];

const EDGES: GEdge[] = [
  { source: "co", target: "aws", volume: 580_000, freq: 12 },
  { source: "co", target: "openai", volume: 310_000, freq: 12 },
  { source: "co", target: "snowflake", volume: 140_000, freq: 12 },
  { source: "co", target: "svb", volume: 2_400_000, freq: 60 },
  { source: "co", target: "hdfc", volume: 900_000, freq: 40 },
  { source: "stripe", target: "co", volume: 1_850_000, freq: 320 },
  { source: "c1", target: "stripe", volume: 720_000, freq: 12 },
  { source: "c2", target: "stripe", volume: 540_000, freq: 12 },
  { source: "c3", target: "stripe", volume: 360_000, freq: 12 },
  { source: "c4", target: "hdfc", volume: 230_000, freq: 12 },
  { source: "aws", target: "snowflake", volume: 90_000, freq: 12 },
  { source: "svb", target: "stripe", volume: 480_000, freq: 24 },
];

const W = 900;
const H = 560;

function seedNodes(): GNode[] {
  return RAW_NODES.map((n, i) => {
    const a = (i / RAW_NODES.length) * Math.PI * 2;
    return {
      ...n,
      x: W / 2 + Math.cos(a) * (n.kind === "startup" ? 0 : 220),
      y: H / 2 + Math.sin(a) * (n.kind === "startup" ? 0 : 170),
      vx: 0,
      vy: 0,
    };
  });
}

/** Downstream nodes reachable from a failed node (undirected contagion spread). */
function contagionFrom(failed: string): Set<string> {
  const hit = new Set<string>([failed]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of EDGES) {
      if (hit.has(e.source) && !hit.has(e.target) && e.volume > 200_000) {
        hit.add(e.target);
        changed = true;
      }
      if (hit.has(e.target) && !hit.has(e.source) && e.volume > 200_000) {
        hit.add(e.source);
        changed = true;
      }
    }
  }
  return hit;
}

function RiskGraphView() {
  const [nodes, setNodes] = useState<GNode[]>(seedNodes);
  const [failed, setFailed] = useState<string | null>(null);
  const [target, setTarget] = useState("svb");
  const [hover, setHover] = useState<GNode | null>(null);
  const raf = useRef<number | null>(null);

  // Lightweight force-directed relaxation (spring + repulsion + centering).
  useEffect(() => {
    let alpha = 1;
    const tick = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        const byId = new Map(next.map((n) => [n.id, n]));
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d2 = dx * dx + dy * dy || 0.01;
            const f = 26000 / d2;
            const d = Math.sqrt(d2);
            dx /= d;
            dy /= d;
            a.vx -= dx * f;
            a.vy -= dy * f;
            b.vx += dx * f;
            b.vy += dy * f;
          }
        }
        for (const e of EDGES) {
          const a = byId.get(e.source);
          const b = byId.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const k = (d - 190) * 0.012;
          a.vx += (dx / d) * k;
          a.vy += (dy / d) * k;
          b.vx -= (dx / d) * k;
          b.vy -= (dy / d) * k;
        }
        for (const n of next) {
          n.vx += (W / 2 - n.x) * 0.004;
          n.vy += (H / 2 - n.y) * 0.004;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x = Math.min(W - 60, Math.max(60, n.x + n.vx * alpha));
          n.y = Math.min(H - 50, Math.max(50, n.y + n.vy * alpha));
        }
        return next;
      });
      alpha *= 0.985;
      if (alpha > 0.02) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const affected = useMemo(() => (failed ? contagionFrom(failed) : new Set<string>()), [failed]);
  const blocked = useMemo(
    () =>
      failed
        ? EDGES.filter((e) => affected.has(e.source) && affected.has(e.target)).reduce((a, e) => a + e.volume, 0)
        : 0,
    [affected, failed],
  );
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Graph Neural Network</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Supply Chain &amp; Risk Graph</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Message-passing over your counterparty graph surfaces hidden dependencies a table can never show.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RAW_NODES.filter((n) => n.kind !== "startup").map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label} fails
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => setFailed(target)}>
            <Zap className="mr-2 h-4 w-4" /> Simulate Contagion
          </Button>
          <Button variant="outline" onClick={() => setFailed(null)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="p-0">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[560px] w-full bg-[#060b14]">
              <defs>
                <radialGradient id="glow">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>
              {EDGES.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const hot = affected.has(e.source) && affected.has(e.target);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={hot ? "#f43f5e" : "#1e40af"}
                    strokeOpacity={hot ? 0.9 : 0.45}
                    strokeWidth={Math.max(1, Math.log10(e.volume) - 3.4) * 2}
                  />
                );
              })}
              {nodes.map((n) => {
                const hot = affected.has(n.id);
                const color = hot ? "#f43f5e" : KIND_COLOR[n.kind];
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                    className="cursor-pointer"
                  >
                    {hot && <circle cx={n.x} cy={n.y} r={n.weight * 2.4} fill="url(#glow)" />}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.weight}
                      fill={color}
                      fillOpacity={0.22}
                      stroke={color}
                      strokeWidth={2}
                    />
                    <text
                      x={n.x}
                      y={n.y + n.weight + 14}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill={color}
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
              {hover && (
                <g>
                  <rect
                    x={Math.min(hover.x + 14, W - 210)}
                    y={Math.max(hover.y - 46, 8)}
                    width="196"
                    height="52"
                    rx="8"
                    fill="#0b1220"
                    stroke="#334155"
                  />
                  <text x={Math.min(hover.x + 26, W - 198)} y={Math.max(hover.y - 26, 28)} fontSize="11" fill="#e2e8f0">
                    {hover.label} · {hover.kind}
                  </text>
                  <text
                    x={Math.min(hover.x + 26, W - 198)}
                    y={Math.max(hover.y - 10, 44)}
                    fontSize="11"
                    fill={affected.has(hover.id) ? "#fb7185" : "#94a3b8"}
                  >
                    {affected.has(hover.id)
                      ? `Blocked flow: ${fmtCurrency(
                          EDGES.filter((e) => e.source === hover.id || e.target === hover.id).reduce(
                            (a, e) => a + e.volume,
                            0,
                          ),
                        )}`
                      : `Annual flow: ${fmtCurrency(
                          EDGES.filter((e) => e.source === hover.id || e.target === hover.id).reduce(
                            (a, e) => a + e.volume,
                            0,
                          ),
                        )}`}
                  </text>
                </g>
              )}
            </svg>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={failed ? "border-rose-500/50 bg-rose-500/5" : "border-border/60"}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4 text-rose-400" /> Contagion Impact
              </CardTitle>
              <CardDescription>
                {failed ? `Simulating failure of ${RAW_NODES.find((n) => n.id === failed)?.label}` : "No failure simulated"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Blocked transaction volume</p>
                <p className="text-3xl font-semibold text-rose-400">{fmtCurrency(blocked)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nodes impacted</p>
                <p className="text-xl font-semibold">
                  {affected.size} / {RAW_NODES.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...affected].map((id) => (
                  <Badge key={id} variant="outline" className="border-rose-500/40 text-rose-300">
                    {RAW_NODES.find((n) => n.id === id)?.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(Object.keys(KIND_COLOR) as Kind[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: KIND_COLOR[k] }} />
                  <span className="capitalize text-muted-foreground">{k}</span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Edge thickness encodes annual transaction volume; contagion propagates along edges above $200K.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
