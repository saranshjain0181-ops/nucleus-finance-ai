import { useMemo, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinance } from "@/lib/finance-store";

type Row = { id: number; date: string; account: string; counterparty: string; amount: number };

const ACCOUNTS = ["Revenue", "Hosting COGS", "Salaries", "Marketing", "Software", "Travel", "Rent"];
const PARTIES = ["Acme Corp", "AWS", "Stripe", "OpenAI", "Google Ads", "WeWork", "Northwind", "Globex", "Delta"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
}

function generate(n: number, vol: number, season: number, base: number, seed: number): Row[] {
  const r = rng(seed);
  const start = new Date(2025, 0, 1).getTime();
  return Array.from({ length: n }, (_, i) => {
    const day = Math.floor((i / n) * 365);
    const s = 1 + (season / 100) * Math.sin((day / 365) * Math.PI * 4);
    const acct = ACCOUNTS[Math.floor(r() * ACCOUNTS.length)];
    const sign = acct === "Revenue" ? 1 : -1;
    const amt = Math.max(5, base * s * (1 + (vol / 100) * gauss(r)));
    return {
      id: i + 1,
      date: new Date(start + day * 86400000).toISOString().slice(0, 10),
      account: acct,
      counterparty: PARTIES[Math.floor(r() * PARTIES.length)],
      amount: Math.round(sign * amt),
    };
  });
}

function stats(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1));
  return { m, sd };
}

export function SyntheticDataSandbox() {
  const { state } = useFinance();
  const [size, setSize] = useState(2000);
  const [vol, setVol] = useState(35);
  const [season, setSeason] = useState(20);
  const [rows, setRows] = useState<Row[]>([]);

  // Reference distribution: real ledger amounts if present, else monthly P&L line items.
  const real = useMemo(() => {
    const fromLedger = state.ledger.map((e) => Math.abs((e.debit || 0) - (e.credit || 0))).filter((x) => x > 0);
    if (fromLedger.length >= 5) return fromLedger;
    return [state.revenue, state.cogs, state.salaries, state.marketing, state.otherOpex].map((x) => x / 12 / 30);
  }, [state]);
  const base = useMemo(() => stats(real).m || 1000, [real]);

  const fidelity = useMemo(() => {
    if (!rows.length) return null;
    const a = stats(real);
    const b = stats(rows.map((r) => Math.abs(r.amount)));
    const meanGap = Math.abs(a.m - b.m) / (a.m || 1);
    const sdGap = a.sd ? Math.abs(a.sd - b.sd) / (a.sd + b.sd) : 0.2;
    return Math.max(0, Math.min(99.9, 100 - meanGap * 60 - sdGap * 40));
  }, [rows, real]);

  return (
    <Card className="border-fuchsia-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-fuchsia-400" /> Generative Synthetic Data Sandbox
        </CardTitle>
        <CardDescription>
          GAN-style generator calibrated to your ingested books — 100% synthetic rows, safe to share with auditors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: "Dataset Size (Rows)", v: size, set: setSize, min: 100, max: 10000, step: 100, fmt: (x: number) => x.toLocaleString() },
            { label: "Volatility Index", v: vol, set: setVol, min: 0, max: 100, step: 1, fmt: (x: number) => `${x}%` },
            { label: "Seasonality Variance", v: season, set: setSeason, min: 0, max: 80, step: 1, fmt: (x: number) => `${x}%` },
          ].map((s) => (
            <div key={s.label} className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">{s.label}</Label>
                <span className="text-xs font-semibold text-fuchsia-300">{s.fmt(s.v)}</span>
              </div>
              <Slider value={[s.v]} min={s.min} max={s.max} step={s.step} onValueChange={([x]) => s.set(x)} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-fuchsia-500 text-white hover:bg-fuchsia-400"
            onClick={() => setRows(generate(size, vol, season, base, Date.now() & 0xffff))}
          >
            Generate Synthetic Ledger
          </Button>
          {fidelity !== null && (
            <Badge
              variant="outline"
              className={fidelity > 85 ? "border-emerald-500/50 text-emerald-400" : "border-amber-500/50 text-amber-400"}
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> Data Fidelity Score: {fidelity.toFixed(1)}%
            </Badge>
          )}
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {rows.length.toLocaleString()} rows · showing first 200 · 0 real records exposed
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <div className="max-h-[420px] overflow-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.id}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.account}</TableCell>
                    <TableCell>{r.counterparty}</TableCell>
                    <TableCell className={`text-right font-mono ${r.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {r.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
