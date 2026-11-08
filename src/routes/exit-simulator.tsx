import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeDollarSign, CircleDollarSign, Landmark, Percent, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { computeExitWaterfall } from "@/lib/strategy-models";
import { fmtCurrency, useFinance } from "@/lib/finance-store";

export const Route = createFileRoute("/exit-simulator")({
  head: () => ({
    meta: [
      { title: "Exit Simulator — FinOps Studio" },
      { name: "description", content: "Model an M&A or IPO-style exit and estimate the proceeds waterfall for debt, preferred investors, founders, and employees." },
      { property: "og:title", content: "Exit Simulator — FinOps Studio" },
      { property: "og:description", content: "Explore an illustrative exit payout waterfall using editable ownership and transaction assumptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExitSimulator,
});

function ExitSimulator() {
  const { state } = useFinance();
  const [arrMultiple, setArrMultiple] = useState(8);
  const [arrOverride, setArrOverride] = useState<number | null>(null);
  const [premiumPct, setPremiumPct] = useState(20);
  const [ventureDebt, setVentureDebt] = useState(2_000_000);
  const [preferred, setPreferred] = useState(12_000_000);
  const [founderPct, setFounderPct] = useState(55);
  const [esopPct, setEsopPct] = useState(12);
  const [taxPct, setTaxPct] = useState(20);
  const arr = arrOverride ?? (typeof state.extractedFields.arr === "number" ? state.extractedFields.arr : state.revenue);
  const result = useMemo(() => computeExitWaterfall({
    arr,
    revenueMultiple: arrMultiple,
    acquisitionPremiumPct: premiumPct,
    ventureDebt,
    preferredPreference: preferred,
    founderOwnershipPct: founderPct,
    esopOwnershipPct: esopPct,
    exitTaxPct: taxPct,
  }), [arr, arrMultiple, premiumPct, ventureDebt, preferred, founderPct, esopPct, taxPct]);
  const waterfall = [{
    stage: "Exit proceeds",
    debt: result.debtPaid,
    preferred: result.preferredPaid,
    founder: result.founderAfterTax,
    esop: result.esopAfterTax,
    otherCommon: Math.max(0, result.commonEquity - result.founderPreTax - result.esopPreTax - result.totalExitTax + result.founderTax + result.esopTax),
    tax: result.totalExitTax,
  }];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Capital events</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Exit Simulator</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Model how an M&amp;A or public-market valuation could flow through debt and preference claims to equity holders.</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3.5 w-3.5 text-chart-4" /> Scenario only</Badge>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Modeled gross exit" value={fmtCurrency(result.grossExitValue)} />
        <Metric icon={Landmark} label="Debt + preferred paid" value={fmtCurrency(result.debtPaid + result.preferredPaid)} />
        <Metric icon={BadgeDollarSign} label="Founder after-tax proceeds" value={fmtCurrency(result.founderAfterTax)} />
        <Metric icon={Percent} label="Employee pool after tax" value={fmtCurrency(result.esopAfterTax)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction assumptions</CardTitle><CardDescription>Change any input to recalculate the payout instantly.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between gap-3 text-sm"><span>Exit revenue multiple</span><span className="font-semibold">{arrMultiple}×</span></div>
              <Slider aria-label="Exit revenue multiple" min={1} max={20} step={0.5} value={[arrMultiple]} onValueChange={(value) => setArrMultiple(value[0] ?? 8)} />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between gap-3 text-sm"><span>Acquisition premium</span><span className="font-semibold">{premiumPct}%</span></div>
              <Slider aria-label="Acquisition premium" min={0} max={100} step={5} value={[premiumPct]} onValueChange={(value) => setPremiumPct(value[0] ?? 20)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs text-muted-foreground">ARR used<Input type="number" min={0} value={arr} onChange={(event) => setArrOverride(Math.max(0, Number(event.target.value)))} aria-label="ARR used in model" /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">Venture debt<Input type="number" min={0} value={ventureDebt} onChange={(event) => setVentureDebt(Number(event.target.value))} /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">Preferred preference<Input type="number" min={0} value={preferred} onChange={(event) => setPreferred(Number(event.target.value))} /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">Founder ownership (%)<Input type="number" min={0} max={100} value={founderPct} onChange={(event) => setFounderPct(Number(event.target.value))} /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">ESOP pool (%)<Input type="number" min={0} max={100} value={esopPct} onChange={(event) => setEsopPct(Number(event.target.value))} /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">Exit tax estimate (%)<Input type="number" min={0} max={100} value={taxPct} onChange={(event) => setTaxPct(Number(event.target.value))} /></label>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">ARR uses the accepted document value when available; otherwise the current P&amp;L revenue is used as a proxy.</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Payout waterfall</CardTitle><CardDescription>Gross proceeds satisfy debt and preferred claims first; residual common equity is allocated by ownership, then estimated tax is applied.</CardDescription></CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfall} margin={{ top: 12, right: 12, bottom: 14, left: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => fmtCurrency(value)} />
                  <Tooltip formatter={(value: number) => [fmtCurrency(value), "Payout"]} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="debt" name="Venture debt" stackId="proceeds" fill="var(--color-chart-1)" />
                  <Bar dataKey="preferred" name="Preferred" stackId="proceeds" fill="var(--color-chart-3)" />
                  <Bar dataKey="founder" name="Founder · after tax" stackId="proceeds" fill="var(--color-chart-2)" />
                  <Bar dataKey="esop" name="ESOP · after tax" stackId="proceeds" fill="var(--color-chart-4)" />
                  <Bar dataKey="otherCommon" name="Other common · after tax" stackId="proceeds" fill="var(--color-chart-5)" />
                  <Bar dataKey="tax" name="Estimated tax" stackId="proceeds" fill="var(--color-muted-foreground)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Breakdown label="Gross exit value" value={result.grossExitValue} />
            <Breakdown label="Common equity after claims" value={result.commonEquity} />
            <Breakdown label="Estimated exit tax" value={result.totalExitTax} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Illustrative only. Actual liquidation preferences, debt covenants, dilution, transaction expenses, tax treatment, and equity waterfalls depend on legal documents and jurisdiction-specific advice.</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return <Card><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-chart-4" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtCurrency(value)}</p></CardContent></Card>;
}