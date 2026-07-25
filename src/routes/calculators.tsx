import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtPct } from "@/lib/finance-store";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/calculators")({
  head: () => ({
    meta: [
      { title: "Calculator Matrix — FinOps Studio" },
      { name: "description", content: "50+ finance calculators across VC, Corporate Finance, Micro, and Treasury." },
    ],
  }),
  component: CalcMatrix,
});

function CalcMatrix() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Toolkit</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Calculator Matrix</h1>
      </header>

      <Tabs defaultValue="vc" orientation="vertical" className="flex flex-col gap-6 lg:flex-row">
        <TabsList className="flex h-auto flex-row overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:justify-start lg:bg-transparent lg:p-0">
          {[
            ["vc", "VC Metrics"],
            ["corp", "Corporate Finance"],
            ["micro", "Microeconomics"],
            ["capex", "Capital Budgeting"],
            ["treasury", "Treasury"],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="justify-start lg:w-full">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 space-y-6">
          <TabsContent value="vc" className="space-y-6">
            <VCCalcs />
          </TabsContent>
          <TabsContent value="corp" className="space-y-6">
            <CorpCalcs />
          </TabsContent>
          <TabsContent value="micro" className="space-y-6">
            <MicroCalcs />
          </TabsContent>
          <TabsContent value="capex" className="space-y-6">
            <CapexCalcs />
          </TabsContent>
          <TabsContent value="treasury" className="space-y-6">
            <TreasuryCalcs />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function CalcCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SliderField({ label, value, onChange, min, max, step, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number; suffix?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="tabular-nums font-medium">{value.toLocaleString()}{suffix}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

function Result({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "";
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// -------- VC Metrics ----------
function VCCalcs() {
  const [cac, setCac] = useState(300);
  const [monthlyGrossProfit, setMgp] = useState(60);
  const [ltv, setLtv] = useState(2400);
  const [newArr, setNewArr] = useState(1_200_000);
  const [salesMktg, setSm] = useState(400_000);
  const [growth, setGrowth] = useState(60);
  const [ebitda, setEbitda] = useState(-10);
  const [netBurn, setNb] = useState(200_000);
  const [netNewArrMonth, setNnam] = useState(80_000);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CalcCard title="CAC Payback Period" desc="Months to recoup customer acquisition cost">
        <SliderField label="CAC ($)" value={cac} onChange={setCac} min={10} max={5000} step={10} suffix="$" />
        <SliderField label="Monthly Gross Profit / customer" value={monthlyGrossProfit} onChange={setMgp} min={5} max={2000} step={5} suffix="$" />
        <Result label="Payback" value={`${(cac / monthlyGrossProfit).toFixed(1)} months`} tone={cac / monthlyGrossProfit < 12 ? "good" : "bad"} />
      </CalcCard>

      <CalcCard title="LTV : CAC Ratio" desc="Health of unit economics">
        <SliderField label="LTV ($)" value={ltv} onChange={setLtv} min={100} max={20000} step={100} suffix="$" />
        <SliderField label="CAC ($)" value={cac} onChange={setCac} min={10} max={5000} step={10} suffix="$" />
        <Result label="Ratio" value={`${(ltv / cac).toFixed(2)}x`} tone={ltv / cac >= 3 ? "good" : "bad"} />
      </CalcCard>

      <CalcCard title="Magic Number" desc="Efficiency of go-to-market spend">
        <SliderField label="Net New ARR (quarter, $)" value={newArr} onChange={setNewArr} min={0} max={10_000_000} step={10000} suffix="$" />
        <SliderField label="Prior Q Sales & Mktg ($)" value={salesMktg} onChange={setSm} min={10000} max={5_000_000} step={10000} suffix="$" />
        <Result label="Magic #" value={(newArr / salesMktg).toFixed(2)} tone={newArr / salesMktg > 0.75 ? "good" : "bad"} />
      </CalcCard>

      <CalcCard title="Rule of 40" desc="Growth% + EBITDA Margin% ≥ 40">
        <SliderField label="Growth Rate (%)" value={growth} onChange={setGrowth} min={-20} max={200} step={1} suffix="%" />
        <SliderField label="EBITDA Margin (%)" value={ebitda} onChange={setEbitda} min={-80} max={80} step={1} suffix="%" />
        <Result label="Score" value={`${growth + ebitda}`} tone={growth + ebitda >= 40 ? "good" : "bad"} />
      </CalcCard>

      <CalcCard title="Burn Multiple" desc="Capital efficiency (lower is better)">
        <SliderField label="Net Burn ($/mo)" value={netBurn} onChange={setNb} min={0} max={5_000_000} step={10000} suffix="$" />
        <SliderField label="Net New ARR ($/mo)" value={netNewArrMonth} onChange={setNnam} min={1000} max={5_000_000} step={1000} suffix="$" />
        <Result label="Burn Multiple" value={(netBurn / netNewArrMonth).toFixed(2)} tone={netBurn / netNewArrMonth < 1.5 ? "good" : "bad"} />
      </CalcCard>
    </div>
  );
}

// -------- Corporate Finance ----------
function CorpCalcs() {
  const [wacc, setWacc] = useState(10);
  const [termGrowth, setTerm] = useState(2.5);
  const [cashFlows, setCashFlows] = useState([120, 140, 165, 190, 220]);
  const [initial, setInitial] = useState(500);

  const npv = useMemo(() => {
    const disc = wacc / 100;
    const pv = cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + disc, i + 1), 0);
    const terminalCf = cashFlows[cashFlows.length - 1] * (1 + termGrowth / 100);
    const terminalValue = terminalCf / (disc - termGrowth / 100);
    const tvPV = terminalValue / Math.pow(1 + disc, cashFlows.length);
    return { npv: pv - initial, dcfValue: pv + tvPV, terminalValue };
  }, [cashFlows, wacc, termGrowth, initial]);

  const irr = useMemo(() => {
    let low = -0.99, high = 5;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const npvMid = cashFlows.reduce((s, cf, k) => s + cf / Math.pow(1 + mid, k + 1), 0) - initial;
      if (npvMid > 0) low = mid;
      else high = mid;
    }
    return ((low + high) / 2) * 100;
  }, [cashFlows, initial]);

  return (
    <div className="grid gap-6">
      <CalcCard title="DCF Valuation" desc="Discounted cash flow with terminal value">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Initial Investment ($k)</Label>
            <Input type="number" value={initial} onChange={(e) => setInitial(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">WACC / Discount Rate (%)</Label>
            <Input type="number" value={wacc} onChange={(e) => setWacc(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Terminal Growth (%)</Label>
            <Input type="number" value={termGrowth} onChange={(e) => setTerm(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">5-Year Cash Flows ($k)</Label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {cashFlows.map((cf, i) => (
              <Input
                key={i}
                type="number"
                value={cf}
                onChange={(e) => {
                  const next = [...cashFlows];
                  next[i] = Number(e.target.value);
                  setCashFlows(next);
                }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Result label="NPV" value={fmtCurrency(npv.npv * 1000)} tone={npv.npv > 0 ? "good" : "bad"} />
          <Result label="DCF Enterprise Value" value={fmtCurrency(npv.dcfValue * 1000)} />
          <Result label="Terminal Value" value={fmtCurrency(npv.terminalValue * 1000)} />
          <Result label="IRR" value={fmtPct(irr)} tone={irr > wacc ? "good" : "bad"} />
        </div>
      </CalcCard>

      <WACCCalc />
    </div>
  );
}

function WACCCalc() {
  const [equity, setEquity] = useState(600);
  const [debt, setDebt] = useState(400);
  const [costEquity, setCe] = useState(12);
  const [costDebt, setCd] = useState(6);
  const [tax, setTax] = useState(25);
  const total = equity + debt;
  const wacc = (equity / total) * costEquity + (debt / total) * costDebt * (1 - tax / 100);
  return (
    <CalcCard title="WACC" desc="Weighted Average Cost of Capital">
      <div className="grid gap-4 md:grid-cols-5">
        <div><Label className="text-xs text-muted-foreground">Equity ($k)</Label><Input type="number" value={equity} onChange={(e) => setEquity(Number(e.target.value))} /></div>
        <div><Label className="text-xs text-muted-foreground">Debt ($k)</Label><Input type="number" value={debt} onChange={(e) => setDebt(Number(e.target.value))} /></div>
        <div><Label className="text-xs text-muted-foreground">Cost of Equity %</Label><Input type="number" value={costEquity} onChange={(e) => setCe(Number(e.target.value))} /></div>
        <div><Label className="text-xs text-muted-foreground">Cost of Debt %</Label><Input type="number" value={costDebt} onChange={(e) => setCd(Number(e.target.value))} /></div>
        <div><Label className="text-xs text-muted-foreground">Tax %</Label><Input type="number" value={tax} onChange={(e) => setTax(Number(e.target.value))} /></div>
      </div>
      <Result label="WACC" value={fmtPct(wacc)} />
    </CalcCard>
  );
}

// -------- Microeconomics ----------
function MicroCalcs() {
  const [p1, setP1] = useState(10);
  const [p2, setP2] = useState(12);
  const [q1, setQ1] = useState(1000);
  const [q2, setQ2] = useState(800);
  const ped = ((q2 - q1) / ((q1 + q2) / 2)) / ((p2 - p1) / ((p1 + p2) / 2));

  const [fixedCost, setFc] = useState(50_000);
  const [pricePerUnit, setPpu] = useState(50);
  const [varCost, setVc] = useState(30);
  const beq = fixedCost / (pricePerUnit - varCost);

  const [demand, setDemand] = useState(20_000);
  const [orderCost, setOc] = useState(200);
  const [holdingCost, setHc] = useState(5);
  const eoq = Math.sqrt((2 * demand * orderCost) / holdingCost);

  const beChart = useMemo(() => {
    const pts = [];
    const step = Math.max(1, Math.round(beq * 0.2));
    for (let q = 0; q <= beq * 2; q += step) {
      pts.push({ q, cost: fixedCost + varCost * q, revenue: pricePerUnit * q });
    }
    return pts;
  }, [beq, fixedCost, varCost, pricePerUnit]);

  return (
    <div className="grid gap-6">
      <CalcCard title="Price Elasticity of Demand (PED)" desc="Midpoint method">
        <div className="grid gap-4 md:grid-cols-4">
          <div><Label className="text-xs text-muted-foreground">Price 1</Label><Input type="number" value={p1} onChange={(e) => setP1(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Price 2</Label><Input type="number" value={p2} onChange={(e) => setP2(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Qty 1</Label><Input type="number" value={q1} onChange={(e) => setQ1(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Qty 2</Label><Input type="number" value={q2} onChange={(e) => setQ2(Number(e.target.value))} /></div>
        </div>
        <Result label="PED" value={ped.toFixed(2)} tone={Math.abs(ped) > 1 ? "good" : "bad"} />
        <p className="text-xs text-muted-foreground">
          {Math.abs(ped) > 1 ? "Elastic: demand responds strongly to price." : "Inelastic: demand is insensitive to price."}
        </p>
      </CalcCard>

      <CalcCard title="Break-Even Quantity" desc="Where revenue meets total cost">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label className="text-xs text-muted-foreground">Fixed Cost ($)</Label><Input type="number" value={fixedCost} onChange={(e) => setFc(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Price per Unit ($)</Label><Input type="number" value={pricePerUnit} onChange={(e) => setPpu(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Variable Cost / Unit ($)</Label><Input type="number" value={varCost} onChange={(e) => setVc(Number(e.target.value))} /></div>
        </div>
        <Result label="Break-Even Units" value={Math.round(beq).toLocaleString()} />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={beChart}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="q" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine x={Math.round(beq)} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "BE", fill: "#f59e0b", fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" dot={false} />
              <Line type="monotone" dataKey="cost" stroke="#ef4444" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CalcCard>

      <CalcCard title="Economic Order Quantity (EOQ)" desc="Optimal order size to minimize inventory cost">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label className="text-xs text-muted-foreground">Annual Demand</Label><Input type="number" value={demand} onChange={(e) => setDemand(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Order Cost ($)</Label><Input type="number" value={orderCost} onChange={(e) => setOc(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Holding Cost / unit / yr ($)</Label><Input type="number" value={holdingCost} onChange={(e) => setHc(Number(e.target.value))} /></div>
        </div>
        <Result label="EOQ" value={Math.round(eoq).toLocaleString()} />
      </CalcCard>
    </div>
  );
}

// -------- Capital Budgeting ----------
function CapexCalcs() {
  const [invest, setInvest] = useState(1_000_000);
  const [cf, setCf] = useState(250_000);
  const [years, setYears] = useState(6);
  const [rate, setRate] = useState(10);

  const npv = Array.from({ length: years }, (_, i) => cf / Math.pow(1 + rate / 100, i + 1)).reduce((a, b) => a + b, 0) - invest;
  const paybackYears = invest / cf;
  const profitabilityIndex = (npv + invest) / invest;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CalcCard title="Payback Period" desc="Simple payback in years">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label className="text-xs text-muted-foreground">Investment ($)</Label><Input type="number" value={invest} onChange={(e) => setInvest(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Annual CF ($)</Label><Input type="number" value={cf} onChange={(e) => setCf(Number(e.target.value))} /></div>
        </div>
        <Result label="Payback" value={`${paybackYears.toFixed(2)} years`} />
      </CalcCard>

      <CalcCard title="NPV (Equal Cash Flows)" desc="Net Present Value of an annuity">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label className="text-xs text-muted-foreground">Years</Label><Input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} /></div>
          <div><Label className="text-xs text-muted-foreground">Rate %</Label><Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
        </div>
        <Result label="NPV" value={fmtCurrency(npv)} tone={npv > 0 ? "good" : "bad"} />
        <Result label="Profitability Index" value={profitabilityIndex.toFixed(2)} tone={profitabilityIndex > 1 ? "good" : "bad"} />
      </CalcCard>
    </div>
  );
}

// -------- Treasury ----------
function TreasuryCalcs() {
  const [principal, setPrincipal] = useState(500_000);
  const [apr, setApr] = useState(7);
  const [termYears, setTermYears] = useState(10);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const schedule = useMemo(() => {
    const monthlyRate = apr / 100 / 12;
    const n = termYears * 12;
    const pmt = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
    const rows: { month: number; payment: number; interest: number; principal: number; balance: number }[] = [];
    let balance = principal;
    for (let m = 1; m <= n; m++) {
      const interest = balance * monthlyRate;
      const princ = pmt - interest;
      balance -= princ;
      rows.push({ month: m, payment: pmt, interest, principal: princ, balance: Math.max(0, balance) });
    }
    return rows;
  }, [principal, apr, termYears]);

  const [noi, setNoi] = useState(240_000);
  const [debtService, setDs] = useState(120_000);
  const dscr = noi / debtService;

  const [dio, setDio] = useState(60);
  const [dso, setDso] = useState(45);
  const [dpo, setDpo] = useState(50);
  const ccc = dio + dso - dpo;

  const totalPages = Math.ceil(schedule.length / pageSize);
  const paginated = schedule.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6">
      <CalcCard title="Amortization Schedule" desc="Monthly loan breakdown">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label className="text-xs text-muted-foreground">Principal ($)</Label><Input type="number" value={principal} onChange={(e) => { setPrincipal(Number(e.target.value)); setPage(1); }} /></div>
          <div><Label className="text-xs text-muted-foreground">APR (%)</Label><Input type="number" value={apr} onChange={(e) => { setApr(Number(e.target.value)); setPage(1); }} /></div>
          <div><Label className="text-xs text-muted-foreground">Term (years)</Label><Input type="number" value={termYears} onChange={(e) => { setTermYears(Number(e.target.value)); setPage(1); }} /></div>
        </div>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => (
                <TableRow key={r.month} className="hover:bg-muted/30">
                  <TableCell>{r.month}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(r.payment)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-400">{fmtCurrency(r.interest)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400">{fmtCurrency(r.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded border border-border/50 px-3 py-1 hover:bg-muted/30 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="rounded border border-border/50 px-3 py-1 hover:bg-muted/30 disabled:opacity-40" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </CalcCard>

      <div className="grid gap-6 md:grid-cols-2">
        <CalcCard title="Debt Service Coverage Ratio (DSCR)" desc="NOI / Debt Service">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label className="text-xs text-muted-foreground">NOI ($)</Label><Input type="number" value={noi} onChange={(e) => setNoi(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Debt Service ($)</Label><Input type="number" value={debtService} onChange={(e) => setDs(Number(e.target.value))} /></div>
          </div>
          <Result label="DSCR" value={dscr.toFixed(2)} tone={dscr >= 1.25 ? "good" : "bad"} />
        </CalcCard>

        <CalcCard title="Cash Conversion Cycle" desc="DIO + DSO - DPO">
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label className="text-xs text-muted-foreground">DIO (days)</Label><Input type="number" value={dio} onChange={(e) => setDio(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">DSO (days)</Label><Input type="number" value={dso} onChange={(e) => setDso(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">DPO (days)</Label><Input type="number" value={dpo} onChange={(e) => setDpo(Number(e.target.value))} /></div>
          </div>
          <Result label="CCC" value={`${ccc} days`} tone={ccc < 60 ? "good" : "bad"} />
        </CalcCard>
      </div>
    </div>
  );
}
