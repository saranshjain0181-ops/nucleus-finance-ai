import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, Brain, Check, Sparkles, ThumbsDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fmtCurrency } from "@/lib/finance-store";
import { computeIllustrativeHedgeProtection, getIllustrativeFxSeries } from "@/lib/strategy-models";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/rl-treasury")({
  head: () => ({
    meta: [
      { title: "RL Treasury Copilot — FinOps Studio" },
      {
        name: "description",
        content:
          "A reinforcement-learning agent that sweeps idle cash across T-Bills, money market funds and high-yield savings, trained by your approvals.",
      },
      { property: "og:title", content: "RL Treasury Copilot — FinOps Studio" },
      {
        property: "og:description",
        content: "Balance liquidity against yield with an RLHF-trained treasury agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RlTreasuryView,
});

type Rec = {
  id: string;
  title: string;
  detail: string;
  amount: number;
  yield: number;
  confidence: number;
  horizon: string;
};

const BASE_RECS: Rec[] = [
  {
    id: "r1",
    title: "Sweep OpEx surplus into 30-day T-Bills",
    detail: "Move $250,000 from OpEx Checking to a 5.00% yield T-Bill for 30 days to capture $1,027 yield.",
    amount: 250_000,
    yield: 1027,
    confidence: 94,
    horizon: "30 days",
  },
  {
    id: "r2",
    title: "Ladder payroll buffer into Money Market",
    detail: "Park $400,000 of the payroll buffer in a T+1 liquid money market fund at 4.65% while keeping same-day access.",
    amount: 400_000,
    yield: 1550,
    confidence: 88,
    horizon: "rolling",
  },
  {
    id: "r3",
    title: "Top up High-Yield Savings",
    detail: "Shift $120,000 of idle collections into 4.30% high-yield savings; policy floor of 3 months runway preserved.",
    amount: 120_000,
    yield: 430,
    confidence: 81,
    horizon: "open",
  },
  {
    id: "r4",
    title: "Roll maturing 90-day bill",
    detail: "Reinvest $300,000 maturing next Tuesday at 5.12% rather than holding in checking (0.00%).",
    amount: 300_000,
    yield: 3840,
    confidence: 76,
    horizon: "90 days",
  },
];

const SANKEY_DATA = {
  nodes: [
    { name: "Operating Cash" },
    { name: "OpEx Checking" },
    { name: "Payroll Buffer" },
    { name: "High-Yield Savings" },
    { name: "Money Market Fund" },
    { name: "T-Bills (30-90d)" },
  ],
  links: [
    { source: 0, target: 1, value: 900 },
    { source: 0, target: 2, value: 620 },
    { source: 1, target: 5, value: 250 },
    { source: 1, target: 3, value: 120 },
    { source: 2, target: 4, value: 400 },
    { source: 2, target: 5, value: 300 },
  ],
};

const NODE_COLORS = ["#38bdf8", "#818cf8", "#c084fc", "#34d399", "#fbbf24", "#f472b6"];

function SankeyNode({ x, y, width, height, index, payload }: any) {
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={NODE_COLORS[index % NODE_COLORS.length]} fillOpacity={0.9} radius={3} />
      <text x={x + width + 8} y={y + height / 2} textAnchor="start" dominantBaseline="middle" fontSize="11" fill="currentColor">
        {payload.name}
      </text>
    </Layer>
  );
}

function RlTreasuryView() {
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  const [reward, setReward] = useState(0.62);

  const pending = BASE_RECS.filter((r) => !decided[r.id]);
  const approved = BASE_RECS.filter((r) => decided[r.id] === "approved");
  const capturedYield = approved.reduce((a, r) => a + r.yield, 0);
  const deployed = approved.reduce((a, r) => a + r.amount, 0);

  const decide = (id: string, verdict: "approved" | "rejected") => {
    setDecided((d) => ({ ...d, [id]: verdict }));
    setReward((r) => Math.max(0.05, Math.min(0.99, r + (verdict === "approved" ? 0.07 : -0.04))));
  };

  const policyLabel = useMemo(
    () => (reward > 0.8 ? "Aggressive yield" : reward > 0.5 ? "Balanced" : "Liquidity-first"),
    [reward],
  );

  const [fxPair, setFxPair] = useState("USD/INR");
  const [payrollNotional, setPayrollNotional] = useState(200_000);
  const [executedHedges, setExecutedHedges] = useState<string[]>([]);
  const fxSeries = useMemo(() => getIllustrativeFxSeries(fxPair), [fxPair]);
  const fxReferenceRate = fxSeries[0]?.rate ?? 0;
  const projectedRate = fxSeries[fxSeries.length - 1]?.rate ?? fxReferenceRate;
  const projectedMovePct = fxReferenceRate > 0 ? Math.abs((projectedRate - fxReferenceRate) / fxReferenceRate) * 100 : 0;
  const protectedAmount = computeIllustrativeHedgeProtection(payrollNotional, projectedMovePct);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Reinforcement Learning</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">RL Treasury Copilot</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The agent explores cash allocations, is rewarded for yield and penalised for liquidity breaches, and retrains
          on every approval you give.
        </p>
      </header>

      <Tabs defaultValue="copilot" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="copilot">Treasury copilot</TabsTrigger>
          <TabsTrigger value="fx">FX hedging</TabsTrigger>
        </TabsList>
        <TabsContent value="copilot" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Capital deployed", value: fmtCurrency(deployed), tone: "text-cyan-400" },
          { label: "Yield captured (annualised)", value: fmtCurrency(capturedYield * 12), tone: "text-emerald-400" },
          { label: "Policy stance", value: policyLabel, tone: "text-fuchsia-400" },
          { label: "Human feedback signals", value: `${Object.keys(decided).length}`, tone: "text-amber-400" },
        ].map((k) => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${k.tone}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-cyan-400" /> Cash Allocation Flow
            </CardTitle>
            <CardDescription>Values in $K, current policy epoch.</CardDescription>
          </CardHeader>
          <CardContent className="h-[420px] text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={SANKEY_DATA}
                nodePadding={28}
                margin={{ left: 10, right: 130, top: 10, bottom: 10 }}
                node={<SankeyNode />}
                link={{ stroke: "#22d3ee", strokeOpacity: 0.25 }}
              >
                <RTooltip
                  contentStyle={{ background: "#0b1220", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`$${v}K`, "Flow"]}
                />
              </Sankey>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-fuchsia-400" /> Copilot Recommendations
            </CardTitle>
            <CardDescription>Approve or reject to send a reward signal (RLHF).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Policy reward score</span>
                <span className="font-semibold text-emerald-400">{(reward * 100).toFixed(0)}%</span>
              </div>
              <Progress value={reward * 100} className="mt-2 h-2" />
            </div>

            {pending.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
                All recommendations reviewed — the agent is re-exploring the action space.
              </p>
            )}

            {pending.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.confidence >= 90
                        ? "border-emerald-500/50 text-emerald-400"
                        : r.confidence >= 80
                          ? "border-cyan-500/50 text-cyan-400"
                          : "border-amber-500/50 text-amber-400"
                    }
                  >
                    {r.confidence}% conf.
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Horizon: {r.horizon}</span>
                  <span>•</span>
                  <span className="text-emerald-400">+{fmtCurrency(r.yield)} yield</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-500 text-black hover:bg-emerald-400"
                    onClick={() => decide(r.id, "approved")}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>
                    <ThumbsDown className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}

            {Object.keys(decided).length > 0 && (
              <div className="space-y-1 pt-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Feedback log</p>
                {BASE_RECS.filter((r) => decided[r.id]).map((r) => (
                  <p key={r.id} className="font-mono text-[11px] text-muted-foreground">
                    <span className={decided[r.id] === "approved" ? "text-emerald-400" : "text-rose-400"}>
                      {decided[r.id] === "approved" ? "reward +1" : "reward −1"}
                    </span>{" "}
                    · {r.title}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="fx" className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Global liquidity</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Cross-border FX hedging</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Model currency exposure between USD collections and foreign payroll obligations.</p>
            </div>
            <Badge variant="outline">Illustrative market scenario</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Currency pair</p><p className="mt-1 text-2xl font-semibold">{fxPair}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Illustrative forward reference</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fxReferenceRate.toFixed(4)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Modeled move protection</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCurrency(protectedAmount)}</p></CardContent></Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowLeftRight className="h-4 w-4 text-chart-1" /> FX volatility path</CardTitle><CardDescription>Deterministic illustrative weekly path; not a live market feed.</CardDescription></CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fxSeries} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <defs><linearGradient id="fxAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <RTooltip formatter={(value: number) => [value.toFixed(4), fxPair]} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Area type="monotone" dataKey="rate" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#fxAreaFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Exposure assumptions</CardTitle><CardDescription>Change the payroll amount and modeled currency pair.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <label className="block space-y-1.5 text-xs text-muted-foreground">Currency pair
                  <Select value={fxPair} onValueChange={setFxPair}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="USD/INR">USD / INR</SelectItem><SelectItem value="USD/EUR">USD / EUR</SelectItem><SelectItem value="USD/GBP">USD / GBP</SelectItem></SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5 text-xs text-muted-foreground">Foreign payroll obligation (USD equivalent)<Input type="number" min={0} value={payrollNotional} onChange={(event) => setPayrollNotional(Number(event.target.value))} /></label>
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Modeled 12-week move</span><span className="tabular-nums">{projectedMovePct.toFixed(1)}%</span></div>
                  <div className="mt-2 flex justify-between gap-3"><span className="text-muted-foreground">Potential FX cost avoided</span><span className="font-semibold tabular-nums">{fmtCurrency(protectedAmount)}</span></div>
                </div>
                <Button className="w-full" onClick={() => setExecutedHedges((current) => current.includes(fxPair) ? current : [...current, fxPair])} disabled={executedHedges.includes(fxPair)}>
                  {executedHedges.includes(fxPair) ? "Scenario marked for review" : "Mark hedge scenario"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">This action only marks a local planning scenario. It does not contact a bank, place an order, or execute a currency contract.</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Illustrative hedge scenarios</CardTitle><CardDescription>Examples based on the currently selected pair and payroll notional.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[{ tenor: "3 months", pct: projectedMovePct * 0.45 }, { tenor: "6 months", pct: projectedMovePct }].map((scenario) => (
                <div key={scenario.tenor} className="rounded-md border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{scenario.tenor} forward scenario</p><p className="mt-1 text-xs text-muted-foreground">Reference rate {fxReferenceRate.toFixed(4)} · modeled move {scenario.pct.toFixed(1)}%</p></div><Badge variant="outline">Example</Badge></div>
                  <p className="mt-3 text-xl font-semibold tabular-nums">Protects about {fmtCurrency(computeIllustrativeHedgeProtection(payrollNotional, scenario.pct))}</p>
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => setExecutedHedges((current) => current.includes(`${fxPair}-${scenario.tenor}`) ? current : [...current, `${fxPair}-${scenario.tenor}`])} disabled={executedHedges.includes(`${fxPair}-${scenario.tenor}`)}>{executedHedges.includes(`${fxPair}-${scenario.tenor}`) ? "Marked for review" : "Mark for review"}</Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <p className="text-xs leading-relaxed text-muted-foreground">Rates and forward scenarios are synthetic examples for planning only; they are not investment advice, quotes, or executable trades.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
