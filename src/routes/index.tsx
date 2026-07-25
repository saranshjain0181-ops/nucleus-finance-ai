import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computePnL, computeAICosts, fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import { ArrowRight, Bot, Calculator, Database, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — FinOps Studio" },
      { name: "description", content: "Snapshot of your P&L, unit economics, and AI cost surface." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { state } = useFinance();
  const pnl = computePnL(state);
  const ai = computeAICosts(state);

  const kpis = [
    { label: "Net Sales", value: fmtCurrency(pnl.netSales), sub: "TTM proxy" },
    { label: "Gross Margin", value: fmtPct(pnl.grossMarginPct), sub: fmtCurrency(pnl.grossProfit) },
    { label: "EBITDA Margin", value: fmtPct(pnl.ebitdaMarginPct), sub: fmtCurrency(pnl.ebitda) },
    { label: "AI Gross Margin", value: fmtPct(ai.grossMarginPct), sub: `MAU ${state.mau.toLocaleString()}` },
  ];

  const quickLinks = [
    { to: "/data", icon: Database, title: "Data Ingestion", desc: "Import CSV or edit raw entries" },
    { to: "/pnl", icon: TrendingUp, title: "P&L Waterfall", desc: "Auto-computed income statement" },
    { to: "/ai-simulator", icon: TrendingUp, title: "AI Cost Simulator", desc: "Token economics & margin collapse" },
    { to: "/calculators", icon: Calculator, title: "Calculator Matrix", desc: "50+ finance calculators" },
    { to: "/ai-cfo", icon: Bot, title: "AI CFO", desc: "Ask questions about your numbers" },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Financial Command Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Model your P&L, unit economics, and AI compute costs — then ask your AI CFO what to fix.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/50 bg-card/50 backdrop-blur transition hover:border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">{k.label}</CardDescription>
              <CardTitle className="text-2xl">{k.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">{k.sub}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="group rounded-xl border border-border/50 bg-card/40 p-5 transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <q.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold">{q.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
