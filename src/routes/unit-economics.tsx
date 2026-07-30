import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { fmtCurrency, fmtPct, useFinance } from "@/lib/finance-store";
import { SurvivalAnalysis } from "@/components/finops/SurvivalAnalysis";
import {
  computeCohorts,
  computeNrrSeries,
  syntheticCohorts,
  type CohortRow,
  type NrrPoint,
} from "@/lib/cohorts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/unit-economics")({
  head: () => ({
    meta: [
      { title: "Survival Analysis & Unit Economics — FinOps Studio" },
      {
        name: "description",
        content:
          "Kaplan-Meier survival curves, live cohort retention and net revenue retention driven by your ingested customer data.",
      },
      { property: "og:title", content: "Unit Economics & Cohort Studio — FinOps Studio" },
      {
        property: "og:description",
        content: "Cohort retention heatmap and NRR time series synced straight from your uploaded subscription files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnitView,
});

const PERIODS = 12;

function UnitView() {
  const { state, update, set } = useFinance();
  const [mode, setMode] = useState<"customer" | "revenue">("customer");

  const records = state.cohortData?.records ?? [];
  const hasLiveData = records.length > 0;

  const ltv = useMemo(() => {
    const monthlyMargin = state.arpu * (state.grossMarginPct / 100);
    const monthlyChurn = state.churnRate / 100;
    return monthlyChurn ? monthlyMargin / monthlyChurn : 0;
  }, [state.arpu, state.grossMarginPct, state.churnRate]);

  const paybackMonths = useMemo(() => {
    const monthlyMargin = state.arpu * (state.grossMarginPct / 100);
    return monthlyMargin ? state.cac / monthlyMargin : 0;
  }, [state.arpu, state.grossMarginPct, state.cac]);

  const derivedCohorts = useMemo<CohortRow[]>(() => {
    if (hasLiveData) {
      const c = computeCohorts(records, PERIODS);
      if (c.length) return c;
    }
    return syntheticCohorts(state.churnRate, PERIODS);
  }, [hasLiveData, records, state.churnRate]);

  const derivedNrr = useMemo<NrrPoint[]>(() => (hasLiveData ? computeNrrSeries(records) : []), [hasLiveData, records]);

  const cohorts = state.manualOverride && state.manualCohorts ? state.manualCohorts : derivedCohorts;
  const nrrSeries = state.manualOverride && state.manualNrr ? state.manualNrr : derivedNrr;

  const latestNrr = nrrSeries.length ? nrrSeries[nrrSeries.length - 1].nrr : null;

  const toggleOverride = (on: boolean) => {
    if (on) {
      update({
        manualOverride: true,
        manualCohorts: state.manualCohorts ?? derivedCohorts.map((c) => ({ ...c, cells: c.cells.map((x) => ({ ...x })) })),
        manualNrr: state.manualNrr ?? derivedNrr.map((p) => ({ ...p })),
      });
      toast.message("Manual override on", { description: "Edit the grid below to reshape the charts instantly." });
    } else {
      set("manualOverride", false);
    }
  };

  const editCell = (rowIdx: number, cellIdx: number, value: number) => {
    const next = (state.manualCohorts ?? derivedCohorts).map((c, i) =>
      i !== rowIdx
        ? c
        : {
            ...c,
            cells: c.cells.map((cell, j) =>
              j !== cellIdx ? cell : { ...cell, [mode === "customer" ? "retention" : "nrr"]: value },
            ),
          },
    );
    set("manualCohorts", next);
  };

  const editNrr = (idx: number, value: number) => {
    const base = state.manualNrr ?? derivedNrr;
    set(
      "manualNrr",
      base.map((p, i) => (i === idx ? { ...p, nrr: value } : p)),
    );
  };

  const clearImported = () => {
    update({ cohortData: null, manualOverride: false, manualCohorts: null, manualNrr: null });
    toast.success("Imported customer data cleared");
  };

  const cellColor = (pct: number) => {
    const p = Math.max(0, Math.min(150, pct));
    const hue = Math.min(140, (p / 100) * 140);
    return `hsl(${hue}, 70%, ${20 + (p / 150) * 25}%)`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Growth</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Unit Economics &amp; Cohort Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasLiveData
              ? `Live from ${records.length.toLocaleString()} subscription records (${state.cohortData?.source || "uploads"}).`
              : "Modelled from your churn assumption — upload customer data in Data Ingestion for live cohorts."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={hasLiveData ? "text-emerald-400" : "text-muted-foreground"}>
            {hasLiveData ? "Live data" : "Simulated"}
          </Badge>
          <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
            <Label className="text-xs">Manual Data Override</Label>
            <Switch checked={state.manualOverride} onCheckedChange={toggleOverride} />
          </div>
          {hasLiveData && (
            <Button size="sm" variant="ghost" onClick={clearImported}>
              Clear imported
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="LTV" value={fmtCurrency(ltv)} />
        <MetricCard title="CAC" value={fmtCurrency(state.cac)} />
        <MetricCard title="LTV : CAC" value={`${state.cac ? (ltv / state.cac).toFixed(1) : "—"}x`} />
        <MetricCard
          title="Net Revenue Retention"
          value={latestNrr !== null ? fmtPct(latestNrr) : `${paybackMonths.toFixed(1)} mo payback`}
        />
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

      {/* ---------------- NRR time series ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net Revenue Retention</CardTitle>
          <CardDescription>
            (Starting MRR + Expansion − Contraction − Churn) ÷ Starting MRR, recomputed on every ingestion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nrrSeries.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Upload a customer/subscription file (Customer ID, Cohort Join Date, Plan, MRR, Status, Activity Month) to
              build the NRR series.
            </p>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nrrSeries}>
                    <defs>
                      <linearGradient id="nrrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(152 70% 45%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(152 70% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number, n) => [n === "nrr" ? `${v.toFixed(1)}%` : fmtCurrency(v), n]}
                    />
                    <Area type="monotone" dataKey="nrr" stroke="hsl(152 70% 45%)" fill="url(#nrrFill)" strokeWidth={2} />
                    <Line type="monotone" dataKey="expansion" stroke="hsl(200 80% 55%)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {state.manualOverride && (
                <div className="mt-4 overflow-x-auto">
                  <p className="mb-2 text-xs text-muted-foreground">Override NRR % per month</p>
                  <div className="flex gap-2">
                    {(state.manualNrr ?? nrrSeries).map((p, i) => (
                      <div key={p.month} className="w-24 shrink-0">
                        <Label className="text-[10px] text-muted-foreground">{p.month}</Label>
                        <Input
                          type="number"
                          className="h-8 text-right"
                          value={Number(p.nrr.toFixed(1))}
                          onChange={(e) => editNrr(i, Number(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Cohort heatmap ---------------- */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Cohort Retention Heatmap</CardTitle>
            <CardDescription>
              {state.manualOverride ? "Editing values directly — charts update instantly." : "Derived from ingested cohorts."}
            </CardDescription>
          </div>
          <div className="flex gap-1 rounded-lg border border-border/50 p-0.5">
            <Button size="sm" variant={mode === "customer" ? "default" : "ghost"} onClick={() => setMode("customer")}>
              Customer Retention
            </Button>
            <Button size="sm" variant={mode === "revenue" ? "default" : "ghost"} onClick={() => setMode("revenue")}>
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
                  <th className="p-2 text-left text-muted-foreground">Size</th>
                  {Array.from({ length: PERIODS }, (_, i) => (
                    <th key={i} className="p-2 text-center text-muted-foreground">
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c, ri) => (
                  <tr key={c.label}>
                    <td className="p-2 font-medium">{c.label}</td>
                    <td className="p-2 tabular-nums text-muted-foreground">{c.size || "—"}</td>
                    {c.cells.map((cell, i) => {
                      const pct = mode === "customer" ? cell.retention : cell.nrr;
                      if (state.manualOverride) {
                        return (
                          <td key={i} className="p-1">
                            <Input
                              type="number"
                              className="h-7 w-16 text-right text-[11px]"
                              value={Number(pct.toFixed(1))}
                              onChange={(e) => editCell(ri, i, Number(e.target.value) || 0)}
                            />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={i}
                          className="p-2 text-center tabular-nums"
                          style={{ background: cellColor(pct), color: "#f8fafc" }}
                          title={`${pct.toFixed(1)}% · ${cell.customers} customers · ${fmtCurrency(cell.mrr)} MRR`}
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
