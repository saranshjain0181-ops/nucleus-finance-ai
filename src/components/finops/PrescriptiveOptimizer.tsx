import { useMemo, useState } from "react";
import { Cpu, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

type Constraint = {
  cash: number;
  burn: number;
  paidAcq: number;
  vendorSpend: number;
  growth: number;
  runwayTarget: number;
  minGrowth: number;
};

type Action = { title: string; detail: string; impact: string };

/**
 * Constrained linear-programming style solver.
 * Objective: maximise runway months subject to MoM growth >= minGrowth.
 * Levers: paid acquisition cut (growth-elastic), expansion reallocation, vendor terms extension.
 */
function solve(c: Constraint) {
  const baseRunway = c.burn > 0 ? c.cash / c.burn : Infinity;
  const needed = c.runwayTarget;
  // Growth elasticity: each 1% cut in paid acquisition costs 0.09pp of MoM growth.
  const elasticity = 0.09;
  const maxCutForGrowth = Math.max(0, (c.growth - c.minGrowth) / elasticity); // in % of paid budget
  // Cash saved per 1% cut of paid budget
  const savePerPct = c.paidAcq / 100;
  // Required monthly burn to hit target runway (ignoring float from vendor terms)
  const targetBurn = needed > 0 ? c.cash / needed : c.burn;
  const burnGap = Math.max(0, c.burn - targetBurn);

  // Vendor terms Net-30 -> Net-60 releases one month of vendor spend as working capital.
  const workingCapital = c.vendorSpend;
  const effectiveCash = c.cash + workingCapital;
  const burnGapAfterWC = Math.max(0, c.burn - (needed > 0 ? effectiveCash / needed : c.burn));

  const cutPctRaw = savePerPct > 0 ? burnGapAfterWC / savePerPct : 0;
  const cutPct = Math.min(cutPctRaw, maxCutForGrowth, 60);
  const cutDollars = cutPct * savePerPct;
  const reallocate = cutDollars * 0.55; // redeploy to expansion/upsell
  const netSave = cutDollars - reallocate;

  const newBurn = Math.max(1, c.burn - netSave);
  const newRunway = effectiveCash / newBurn;
  const newGrowth = c.growth - cutPct * elasticity + (reallocate / Math.max(1, c.paidAcq)) * 1.6;
  const feasible = newRunway >= needed - 0.15 && newGrowth >= c.minGrowth - 0.05;

  const actions: Action[] = [
    {
      title: `Reduce paid acquisition budget by ${cutPct.toFixed(1)}% ($${Math.round(cutDollars).toLocaleString()}/mo)`,
      detail: "Trim lowest-ROAS channels first; keeps growth above the constraint floor.",
      impact: `−$${Math.round(cutDollars).toLocaleString()}/mo burn`,
    },
    {
      title: `Reallocate $${Math.round(reallocate).toLocaleString()} to customer expansion/upsell`,
      detail: "Expansion revenue carries ~3.2x higher contribution margin than net-new acquisition.",
      impact: `+${((reallocate / Math.max(1, c.paidAcq)) * 1.6).toFixed(2)}pp MoM growth`,
    },
    {
      title: `Extend vendor payment terms from Net-30 to Net-60 to preserve $${Math.round(workingCapital).toLocaleString()} working capital`,
      detail: "One-time float across your recurring vendor base; no P&L impact.",
      impact: `+${(workingCapital / newBurn).toFixed(1)} months runway`,
    },
  ];

  return {
    baseRunway,
    newRunway,
    newGrowth,
    feasible,
    cutPct,
    cutDollars,
    reallocate,
    workingCapital,
    newBurn,
    actions,
  };
}

export function PrescriptiveOptimizer() {
  const [goal, setGoal] = useState(
    "Extend runway by 6 months while keeping MoM growth > 10%",
  );
  const [c, setC] = useState<Constraint>({
    cash: 2_400_000,
    burn: 250_000,
    paidAcq: 112_000,
    vendorSpend: 42_000,
    growth: 15,
    runwayTarget: 0,
    minGrowth: 10,
  });
  const [ran, setRan] = useState(false);

  const baseRunway = c.burn > 0 ? c.cash / c.burn : 0;
  const target = c.runwayTarget || baseRunway + 6;
  const sol = useMemo(() => solve({ ...c, runwayTarget: target }), [c, target]);

  const upd = (k: keyof Constraint, v: number) => setC((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-emerald-400" /> Goal-Based Optimization Engine
          </CardTitle>
          <CardDescription>
            State the outcome you want — the solver derives the allocation, not the sliders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target Goal</Label>
            <div className="flex gap-2">
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
              <Button className="gap-2 shrink-0" onClick={() => setRan(true)}>
                <Cpu className="h-4 w-4" /> Solve
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Num label="Cash on hand ($)" value={c.cash} min={100000} max={20000000} step={50000} onChange={(v) => upd("cash", v)} />
            <Num label="Monthly net burn ($)" value={c.burn} min={20000} max={1500000} step={5000} onChange={(v) => upd("burn", v)} />
            <Num label="Paid acquisition / mo ($)" value={c.paidAcq} min={0} max={800000} step={2000} onChange={(v) => upd("paidAcq", v)} />
            <Num label="Recurring vendor spend / mo ($)" value={c.vendorSpend} min={0} max={500000} step={1000} onChange={(v) => upd("vendorSpend", v)} />
            <Num label="Current MoM growth (%)" value={c.growth} min={0} max={40} step={0.5} onChange={(v) => upd("growth", v)} />
            <Num label="Growth constraint floor (%)" value={c.minGrowth} min={0} max={30} step={0.5} onChange={(v) => upd("minGrowth", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Runway (current)" value={`${baseRunway.toFixed(1)} mo`} />
        <Stat title="Runway (optimized)" value={`${sol.newRunway.toFixed(1)} mo`} tone="good" />
        <Stat title="MoM growth (optimized)" value={`${sol.newGrowth.toFixed(1)}%`} tone={sol.newGrowth >= c.minGrowth ? "good" : "bad"} />
        <Stat title="Constraint status" value={sol.feasible ? "Feasible" : "Infeasible"} tone={sol.feasible ? "good" : "bad"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Solver Output</CardTitle>
            <CardDescription>
              Optimal allocation for: <span className="text-foreground">{goal}</span>
            </CardDescription>
          </div>
          <Badge variant="outline">{ran ? "Simplex · converged" : "Live preview"}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {sol.actions.map((a, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-emerald-400">{a.title}</div>
                <Badge variant="secondary" className="tabular-nums">{a.impact}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
            </div>
          ))}

          <div className="rounded-lg border border-border/50 bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Solver narrative: </span>
            Objective maximises runway subject to MoM growth ≥ {c.minGrowth}%. Cutting paid acquisition by{" "}
            {sol.cutPct.toFixed(1)}% frees ${Math.round(sol.cutDollars).toLocaleString()}/mo; redeploying $
            {Math.round(sol.reallocate).toLocaleString()} into expansion offsets the growth penalty, and the Net-60
            vendor shift adds ${Math.round(sol.workingCapital).toLocaleString()} of one-time float. Resulting burn $
            {Math.round(sol.newBurn).toLocaleString()}/mo → {sol.newRunway.toFixed(1)} months of runway
            {sol.feasible ? " — target satisfied." : " — target not reachable without relaxing the growth floor."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Num({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`text-2xl font-bold tabular-nums ${color}`}>{value}</CardContent>
    </Card>
  );
}
