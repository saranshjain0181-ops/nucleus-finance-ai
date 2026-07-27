import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import { SurvivalAnalysis } from "@/components/finops/SurvivalAnalysis";

export const Route = createFileRoute("/unit-economics")({
  head: () => ({
    meta: [
      { title: "Survival Analysis & Unit Economics — FinOps Studio" },
      { name: "description", content: "Kaplan-Meier survival curves, hazard-rate matrix, probabilistic LTV, CAC and cohort retention." },
    ],
  }),
  component: UnitView,
});

function UnitView() {
  const { state, update } = useFinance();
  const [mode, setMode] = useState<"customer" | "revenue">("customer");

  const ltv = useMemo(() => {
    const monthlyMargin = state.arpu * (state.grossMarginPct / 100);
    const monthlyChurn = state.churnRate / 100;
    return monthlyChurn ? monthlyMargin / monthlyChurn : 0;
  }, [state.arpu, state.grossMarginPct, state.churnRate]);

  const paybackMonths = useMemo(() => {
    const monthlyMargin = state.arpu * (state.grossMarginPct / 100);
    return monthlyMargin ? state.cac / monthlyMargin : 0;
  }, [state.arpu, state.grossMarginPct, state.cac]);

  // Cohort matrix
  const cohorts = useMemo(() => {
    const seed = state.churnRate / 100;
    const cohortsArr = Array.from({ length: 8 }, (_, ci) => {
      const label = `M${ci + 1}`;
      const cells = Array.from({ length: 12 }, (_, mi) => {
        const base = Math.pow(1 - seed - ci * 0.005, mi);
        const retention = Math.max(0, base);
        const nrr = retention * (1 + mi * 0.015); // NRR grows via expansion
        return { retention: retention * 100, nrr: nrr * 100 };
      });
      return { label, cells };
    });
    return cohortsArr;
  }, [state.churnRate]);

  const cellColor = (pct: number) => {
    // Green (100) -> Yellow (50) -> Red (0)
    const p = Math.max(0, Math.min(150, pct));
    const hue = Math.min(140, (p / 100) * 140);
    return `hsl(${hue}, 70%, ${20 + (p / 150) * 25}%)`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Growth</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Unit Economics & Cohort Studio</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="LTV" value={fmtCurrency(ltv)} />
        <MetricCard title="CAC" value={fmtCurrency(state.cac)} />
        <MetricCard title="LTV : CAC" value={`${state.cac ? (ltv / state.cac).toFixed(1) : "—"}x`} />
        <MetricCard title="CAC Payback" value={`${paybackMonths.toFixed(1)} mo`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Field label="ARPU / month ($)" value={state.arpu} onChange={(v) => update({ arpu: v })} />
          <Field label="CAC ($)" value={state.cac} onChange={(v) => update({ cac: v })} />
          <Field label="Gross Margin %" value={state.grossMarginPct} onChange={(v) => update({ grossMarginPct: v })} />
          <Field label="Monthly Churn %" value={state.churnRate} onChange={(v) => update({ churnRate: v })} />
        </CardContent>
      </Card>

      <SurvivalAnalysis />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Cohort Retention Heatmap</CardTitle>
          <div className="flex gap-1 rounded-lg border border-border/50 p-0.5">
            <Button
              size="sm"
              variant={mode === "customer" ? "default" : "ghost"}
              onClick={() => setMode("customer")}
            >
              Customer Retention
            </Button>
            <Button
              size="sm"
              variant={mode === "revenue" ? "default" : "ghost"}
              onClick={() => setMode("revenue")}
            >
              Net Revenue Retention
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground">Cohort</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="p-2 text-center text-muted-foreground">
                      M{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.label}>
                    <td className="p-2 font-medium">{c.label}</td>
                    {c.cells.map((cell, i) => {
                      const pct = mode === "customer" ? cell.retention : cell.nrr;
                      return (
                        <td
                          key={i}
                          className="p-2 text-center tabular-nums"
                          style={{ background: cellColor(pct), color: pct > 60 ? "#fff" : "#f8fafc" }}
                          title={`${pct.toFixed(1)}%`}
                        >
                          {fmtPct(pct)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
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
