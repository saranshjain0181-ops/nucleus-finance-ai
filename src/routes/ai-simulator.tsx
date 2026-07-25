import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeAICosts, fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/ai-simulator")({
  head: () => ({
    meta: [
      { title: "AI Cost Simulator — FinOps Studio" },
      { name: "description", content: "Token economics, human vs agent, and margin collapse point." },
    ],
  }),
  component: AISim,
});

function AISim() {
  const { state, update } = useFinance();
  const ai = computeAICosts(state);

  const chartData = useMemo(() => {
    const points: { users: number; margin: number; cost: number; revenue: number }[] = [];
    const step = Math.max(500, Math.round(state.mau / 20));
    const maxUsers = Math.max(state.mau * 4, 20000);
    for (let u = step; u <= maxUsers; u += step) {
      const revenue = u * state.subscriptionPrice;
      const apiCost = ai.costPerUser * u;
      const totalCost = apiCost + state.cloudCost + state.vectorDbCost;
      const margin = revenue ? ((revenue - totalCost) / revenue) * 100 : 0;
      points.push({ users: u, margin, cost: totalCost, revenue });
    }
    return points;
  }, [state, ai.costPerUser]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-400">Innovation Layer</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">AI Token & Compute Economics</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Most SaaS models ignore inference costs. Here you can see where AI COGS eats your margin.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI title="Cost / User / Month" value={fmtCurrency(ai.costPerUser)} tone="warn" />
        <KPI title="Monthly AI COGS" value={fmtCurrency(ai.totalMonthlyCogs)} tone="warn" />
        <KPI title="Revenue" value={fmtCurrency(ai.revenue)} tone="pos" />
        <KPI
          title="AI Gross Margin"
          value={fmtPct(ai.grossMarginPct)}
          tone={ai.grossMarginPct >= 60 ? "pos" : ai.grossMarginPct >= 30 ? "warn" : "neg"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token Inputs</CardTitle>
            <CardDescription>Assumes 40/60 input/output split</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Tokens per interaction" value={state.tokensPerInteraction} onChange={(v) => update({ tokensPerInteraction: v })} />
            <Field label="Interactions per user / month" value={state.interactionsPerUser} onChange={(v) => update({ interactionsPerUser: v })} />
            <Field label="Cost / 1M input tokens ($)" value={state.inputCostPer1M} onChange={(v) => update({ inputCostPer1M: v })} />
            <Field label="Cost / 1M output tokens ($)" value={state.outputCostPer1M} onChange={(v) => update({ outputCostPer1M: v })} />
            <Field label="Monthly Active Users" value={state.mau} onChange={(v) => update({ mau: v })} />
            <Field label="Subscription Price ($/mo)" value={state.subscriptionPrice} onChange={(v) => update({ subscriptionPrice: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Human vs Agent</CardTitle>
            <CardDescription>Find the crossover where AI stops being cheaper.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Human salary ($/yr)" value={state.humanSalary} onChange={(v) => update({ humanSalary: v })} />
              <Field label="Human tasks / hour" value={state.humanTasksPerHour} onChange={(v) => update({ humanTasksPerHour: v })} />
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm">
              <Row label="Human cost / task" value={fmtCurrency(ai.humanCostPerTask)} />
              <Row label="AI cost / task" value={fmtCurrency(ai.aiCostPerTask)} />
              <Row
                label="Crossover users (AI > 1 human/mo cost)"
                value={ai.crossoverUsers === Infinity ? "∞" : Math.round(ai.crossoverUsers).toLocaleString()}
                emphasize
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gross Margin Collapse Point</CardTitle>
          <CardDescription>Where scaling users starts destroying value.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="users" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="margin" stroke="#10b981" fill="url(#mg)" name="Gross Margin %" />
              <Line type="monotone" dataKey="margin" stroke="#f59e0b" dot={false} name="Zero line" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cloud Infrastructure</CardTitle>
            <CardDescription>Fixed monthly costs added to AI COGS.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Cloud servers ($/mo)" value={state.cloudCost} onChange={(v) => update({ cloudCost: v })} />
            <Field label="Vector DB ($/mo)" value={state.vectorDbCost} onChange={(v) => update({ vectorDbCost: v })} />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base">Pricing Optimizer</CardTitle>
            <CardDescription>Minimum subscription price to hold a 75% gross margin.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-300">{fmtCurrency(ai.minPriceFor75)} <span className="text-base text-muted-foreground">/user/mo</span></div>
            <p className="mt-3 text-xs text-muted-foreground">
              Currently charging {fmtCurrency(state.subscriptionPrice)}. {state.subscriptionPrice >= ai.minPriceFor75 ? "You're safely priced." : "You are underpricing your AI COGS."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${emphasize ? "border-t border-border/60 pt-3 mt-2 font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function KPI({ title, value, tone }: { title: string; value: string; tone: "pos" | "neg" | "warn" }) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-amber-400";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`text-2xl font-bold ${color}`}>{value}</CardContent>
    </Card>
  );
}
