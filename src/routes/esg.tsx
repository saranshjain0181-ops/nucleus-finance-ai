import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Leaf, MapPin, Server, Sprout } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { computeCarbonEstimate } from "@/lib/strategy-models";
import { fmtCurrency } from "@/lib/finance-store";

export const Route = createFileRoute("/esg")({
  head: () => ({
    meta: [
      { title: "ESG & Carbon Ledger — FinOps Studio" },
      { name: "description", content: "Estimate compute emissions, carbon costs, and the financial impact of regional workload shifts." },
      { property: "og:title", content: "ESG & Carbon Ledger — FinOps Studio" },
      { property: "og:description", content: "Model compute emissions and carbon-cost exposure by region." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EsgView,
});

function EsgView() {
  const [monthlyMwh, setMonthlyMwh] = useState(120);
  const [usEastIntensity, setUsEastIntensity] = useState(0.38);
  const [europeIntensity, setEuropeIntensity] = useState(0.08);
  const [relocationPct, setRelocationPct] = useState(0);
  const [carbonPrice, setCarbonPrice] = useState(85);
  const [offsetPrice, setOffsetPrice] = useState(32);
  const [relocationCost, setRelocationCost] = useState(18_000);

  const estimate = useMemo(
    () => computeCarbonEstimate({
      monthlyMwh,
      usEastTonnesPerMwh: usEastIntensity,
      europeNorthTonnesPerMwh: europeIntensity,
      relocationPct,
      carbonPricePerTonne: carbonPrice,
      offsetPricePerTonne: offsetPrice,
      annualRelocationCost: relocationCost,
    }),
    [monthlyMwh, usEastIntensity, europeIntensity, relocationPct, carbonPrice, offsetPrice, relocationCost],
  );
  const chartData = [
    { region: "US-East baseline", tonnes: estimate.baselineEmissions },
    { region: "Relocation mix", tonnes: estimate.projectedEmissions },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Sustainable infrastructure</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">ESG & Carbon Ledger</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Estimate cloud workload emissions and compare the economics of lower-carbon regions.</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><Sprout className="h-3.5 w-3.5 text-chart-2" /> Planning estimate</Badge>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Projected annual emissions", value: `${estimate.projectedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e`, icon: Leaf },
          { label: "Emissions avoided", value: `${estimate.avoidedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e`, icon: ArrowDownRight },
          { label: "Carbon cost avoided", value: fmtCurrency(estimate.carbonTaxSavings), icon: ArrowDownRight },
          { label: "Net carbon ROI", value: fmtCurrency(estimate.netCarbonRoi), icon: ArrowUpRight },
        ].map((metric) => (
          <Card key={metric.label} className="border-border/60">
            <CardContent className="p-4">
              <metric.icon className="mb-3 h-4 w-4 text-chart-2" />
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 break-words text-2xl font-semibold tabular-nums">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-chart-2" /> Compute region map</CardTitle>
              <CardDescription>Illustrative region comparison. Actual emissions vary by provider, workload, and reporting boundary.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-5 sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
                <div className="relative grid min-h-48 grid-cols-2 items-center gap-4 sm:min-h-56 sm:grid-cols-3">
                  <div className="justify-self-center text-center">
                    <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border border-chart-3/50 bg-chart-3/10 text-chart-3"><Server className="h-4 w-4" /></div>
                    <p className="text-sm font-medium">US-East</p><p className="text-xs text-muted-foreground">Higher carbon intensity</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:col-span-1 sm:flex-col">
                    <span className="h-px w-10 bg-border sm:h-10 sm:w-px" /><span>{relocationPct}% shifted</span><span className="h-px w-10 bg-border sm:h-10 sm:w-px" />
                  </div>
                  <div className="col-span-2 justify-self-center text-center sm:col-span-1">
                    <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border border-chart-2/50 bg-chart-2/10 text-chart-2"><Leaf className="h-4 w-4" /></div>
                    <p className="text-sm font-medium">Europe-North</p><p className="text-xs text-muted-foreground">Lower carbon intensity</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Annual emissions comparison</CardTitle><CardDescription>Tonnes of CO₂ equivalent based on current assumptions.</CardDescription></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="region" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`, "Annual emissions"]} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="tonnes" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Compute relocation optimizer</CardTitle><CardDescription>Move modeled monthly workload from US-East to Europe-North.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between gap-3 text-sm"><span>Workload shifted</span><span className="font-semibold tabular-nums">{relocationPct}%</span></div>
                <Slider aria-label="Workload shifted to Europe-North" min={0} max={100} step={5} value={[relocationPct]} onValueChange={(value) => setRelocationPct(value[0] ?? 0)} />
                <div className="flex justify-between text-xs text-muted-foreground"><span>US-East</span><span>Europe-North</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs text-muted-foreground">Monthly energy (MWh)<Input type="number" min={0} value={monthlyMwh} onChange={(event) => setMonthlyMwh(Number(event.target.value))} /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Carbon price / tonne<Input type="number" min={0} value={carbonPrice} onChange={(event) => setCarbonPrice(Number(event.target.value))} /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Offset price / tonne<Input type="number" min={0} value={offsetPrice} onChange={(event) => setOffsetPrice(Number(event.target.value))} /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Annual relocation cost<Input type="number" min={0} value={relocationCost} onChange={(event) => setRelocationCost(Number(event.target.value))} /></label>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Estimated offset value</span><span className="tabular-nums">{fmtCurrency(estimate.offsetSavings)}</span></div>
                <div className="mt-2 flex justify-between gap-3"><span className="text-muted-foreground">Relocation investment</span><span className="tabular-nums">−{fmtCurrency(estimate.annualRelocationCost)}</span></div>
              </div>
              <Button className="w-full" variant="outline" onClick={() => setRelocationPct(100)}>Model full relocation</Button>
            </CardContent>
          </Card>
          <p className="text-xs leading-relaxed text-muted-foreground">Carbon factors, carbon prices, and offset prices are editable planning assumptions; this view is not a verified emissions inventory or tax filing.</p>
        </aside>
      </div>
    </div>
  );
}