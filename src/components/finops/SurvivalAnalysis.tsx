import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Cohort = {
  id: string;
  label: string;
  color: string;
  baseHazard: number; // monthly churn hazard %
  renewalMonths: number[]; // months where a renewal hazard spike occurs
  spike: number; // multiplier at renewal
  arpu: number;
  marginPct: number;
};

const MONTHS = 36;

const BASE_COHORTS: Cohort[] = [
  { id: "ent", label: "Enterprise", color: "hsl(152 65% 48%)", baseHazard: 0.9, renewalMonths: [12, 24, 36], spike: 4.2, arpu: 2400, marginPct: 82 },
  { id: "mid", label: "Mid-Market", color: "hsl(190 85% 55%)", baseHazard: 1.8, renewalMonths: [11, 23], spike: 3.1, arpu: 780, marginPct: 78 },
  { id: "smb", label: "SMB", color: "hsl(38 92% 58%)", baseHazard: 4.6, renewalMonths: [6, 12], spike: 1.9, arpu: 129, marginPct: 72 },
];

/** Kaplan-Meier estimator: S(t) = Π (1 - d_i/n_i) with a renewal hazard bump. */
function survivalCurve(c: Cohort, hazardScale: number) {
  const rows: { month: number; survival: number; hazard: number }[] = [];
  let s = 1;
  for (let m = 1; m <= MONTHS; m++) {
    const isRenewal = c.renewalMonths.includes(m);
    const hazard = ((c.baseHazard * hazardScale) / 100) * (isRenewal ? c.spike : 1);
    s *= 1 - hazard;
    rows.push({ month: m, survival: s * 100, hazard: hazard * 100 });
  }
  return rows;
}

export function SurvivalAnalysis() {
  const [active, setActive] = useState<string[]>(["ent", "mid", "smb"]);
  const [hazardScale, setHazardScale] = useState(100);

  const curves = useMemo(
    () =>
      BASE_COHORTS.map((c) => ({
        cohort: c,
        rows: survivalCurve(c, hazardScale / 100),
      })),
    [hazardScale],
  );

  const chartData = useMemo(() => {
    return Array.from({ length: MONTHS }, (_, i) => {
      const row: Record<string, number> = { month: i + 1 };
      curves.forEach(({ cohort, rows }) => {
        row[cohort.id] = Number(rows[i].survival.toFixed(2));
      });
      return row;
    });
  }, [curves]);

  const summary = curves.map(({ cohort, rows }) => {
    const peak = rows.reduce((a, b) => (b.hazard > a.hazard ? b : a));
    // Probabilistic LTV = Σ S(t) · ARPU · margin
    const ltv = rows.reduce((s, r) => s + (r.survival / 100) * cohort.arpu * (cohort.marginPct / 100), 0);
    const medianMonth = rows.find((r) => r.survival <= 50)?.month ?? null;
    return { cohort, peak, ltv, medianMonth, rows };
  });

  const toggle = (id: string) =>
    setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id].slice(-3)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-400" /> Kaplan-Meier Survival Curves
            </CardTitle>
            <CardDescription>
              Probabilistic retention over {MONTHS} months — overlay up to 3 cohorts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {BASE_COHORTS.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={active.includes(c.id) ? "default" : "outline"}
                onClick={() => toggle(c.id)}
              >
                <span className="mr-2 h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-muted-foreground">Hazard sensitivity</Label>
              <span className="font-medium tabular-nums">{hazardScale}%</span>
            </div>
            <Slider value={[hazardScale]} min={40} max={200} step={5} onValueChange={([v]) => setHazardScale(v)} />
          </div>

          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeOpacity={0.12} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <RTooltip
                  contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 33% 20%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [
                    `${v}%`,
                    BASE_COHORTS.find((c) => c.id === n)?.label ?? n,
                  ]}
                  labelFormatter={(l) => `Month ${l}`}
                />
                <Legend formatter={(v) => BASE_COHORTS.find((c) => c.id === v)?.label ?? v} />
                {BASE_COHORTS.filter((c) => active.includes(c.id)).map((c) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    stroke={c.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {summary
          .filter((s) => active.includes(s.cohort.id))
          .map((s) => (
            <Card key={s.cohort.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.cohort.color }} />
                  {s.cohort.label}
                </CardTitle>
                <CardDescription className="text-xs">Probabilistic (survival-weighted) LTV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="text-2xl font-bold tabular-nums text-emerald-400">
                  ${Math.round(s.ltv).toLocaleString()}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Median survival</span>
                  <span className="font-medium">{s.medianMonth ? `M${s.medianMonth}` : `>M${MONTHS}`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">36-mo retention</span>
                  <span className="font-medium">{s.rows[MONTHS - 1].survival.toFixed(1)}%</span>
                </div>
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-200">
                  Month {s.peak.month} Renewal Hazard Risk: {s.peak.hazard.toFixed(1)}% — open a save-play window at M
                  {Math.max(1, s.peak.month - 2)}.
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hazard Rate & Churn Probability Matrix</CardTitle>
          <CardDescription>Monthly conditional churn probability — spikes mark renewal windows.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-muted-foreground">Cohort</th>
                {Array.from({ length: MONTHS }, (_, i) => (
                  <th key={i} className="p-1 text-center text-[9px] text-muted-foreground">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary
                .filter((s) => active.includes(s.cohort.id))
                .map((s) => (
                  <tr key={s.cohort.id}>
                    <td className="whitespace-nowrap p-2 font-medium">{s.cohort.label}</td>
                    {s.rows.map((r) => {
                      const intensity = Math.min(1, r.hazard / 12);
                      return (
                        <td
                          key={r.month}
                          title={`Month ${r.month}: ${r.hazard.toFixed(2)}% hazard`}
                          className="p-1 text-center tabular-nums text-[9px]"
                          style={{
                            background: `hsla(6, 85%, 58%, ${0.08 + intensity * 0.8})`,
                            color: intensity > 0.5 ? "#fff" : "#cbd5e1",
                          }}
                        >
                          {r.hazard.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary
              .filter((s) => active.includes(s.cohort.id))
              .map((s) => (
                <Badge key={s.cohort.id} variant="outline" className="text-[11px]">
                  {s.cohort.label}: peak hazard M{s.peak.month} @ {s.peak.hazard.toFixed(1)}%
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
